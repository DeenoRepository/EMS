#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

OUTPUT_DIR="${OUTPUT_DIR:-/tmp/eps-app-offline-bundle-${TIMESTAMP}}"
FINAL_ARCHIVE="${FINAL_ARCHIVE:-${PROJECT_DIR}/eps-app-offline-bundle-${TIMESTAMP}.tar.gz}"

SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_APT="${SKIP_APT:-false}"
APP_DIR_NAME="eps-app"

APT_PACKAGES=(
  ca-certificates
  curl
  rsync
  nginx
  postgresql
  postgresql-contrib
  nodejs
)

log() {
  printf "\n[%s] %s\n" "$(date +'%F %T')" "$*"
}

as_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

usage() {
  cat <<'EOF'
Usage:
  bash scripts/create-offline-bundle.sh [options]

Options:
  --output-dir <path>         Bundle workspace (default: /tmp/eps-app-offline-bundle-<timestamp>)
  --final-archive <path>      Final compressed archive path (default: <project>/eps-app-offline-bundle-<timestamp>.tar.gz)
  --skip-build                Do not run npm ci / prisma generate / build
  --skip-apt                  Do not download apt packages
  -h, --help                  Show help

Examples:
  bash scripts/create-offline-bundle.sh
  bash scripts/create-offline-bundle.sh --output-dir /tmp/offline-eps --final-archive /tmp/offline-eps.tar.gz
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --final-archive)
      FINAL_ARCHIVE="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD="true"
      shift
      ;;
    --skip-apt)
      SKIP_APT="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

mkdir -p "${OUTPUT_DIR}"
OUTPUT_DIR="$(cd "${OUTPUT_DIR}" && pwd)"

STAGE_DIR="${OUTPUT_DIR}/stage"
APP_STAGE_DIR="${STAGE_DIR}/${APP_DIR_NAME}"
APT_ARCHIVES_DIR="${OUTPUT_DIR}/apt/archives"
MANIFEST="${OUTPUT_DIR}/manifest.txt"

log "Project dir: ${PROJECT_DIR}"
log "Output dir: ${OUTPUT_DIR}"
log "Final archive: ${FINAL_ARCHIVE}"

if [[ "${SKIP_BUILD}" != "true" ]]; then
  log "Installing npm dependencies"
  (cd "${PROJECT_DIR}" && npm ci)

  log "Generating Prisma client"
  (cd "${PROJECT_DIR}" && npm run prisma:generate)

  log "Building Next.js application"
  (cd "${PROJECT_DIR}" && npm run build)
else
  log "Skipping build stage"
fi

log "Staging application files"
rm -rf "${APP_STAGE_DIR}"
mkdir -p "${APP_STAGE_DIR}"
rsync -a \
  --delete \
  --exclude ".git" \
  --exclude ".next/cache" \
  --exclude "offline-bundle-*" \
  --exclude "*.tar.gz" \
  --exclude "*.tgz" \
  "${PROJECT_DIR}/" "${APP_STAGE_DIR}/"

log "Packing application archive"
tar -C "${STAGE_DIR}" -czf "${OUTPUT_DIR}/eps-app-offline.tgz" "${APP_DIR_NAME}"

if [[ "${SKIP_APT}" != "true" ]]; then
  log "Downloading apt packages and dependencies"
  mkdir -p "${APT_ARCHIVES_DIR}/partial"
  as_root apt-get update
  as_root apt-get -y --download-only \
    -o Dir::Cache::archives="${APT_ARCHIVES_DIR}" \
    install "${APT_PACKAGES[@]}"
else
  log "Skipping apt package download"
fi

cat > "${OUTPUT_DIR}/INSTALL_OFFLINE.md" <<'EOF'
# Offline Install Notes

1. Copy bundle directory to target machine.
2. Install `.deb` packages from `apt/archives/`:
   - `sudo dpkg -i *.deb || sudo apt-get -f install` (with local repo/media available)
3. Unpack `eps-app-offline.tgz` into `/home/<username>/eps-app`.
4. Deploy app into `/opt/eps-app`:
   - `sudo rsync -a --delete /home/<username>/eps-app/ /opt/eps-app/`
5. Create `/opt/eps-app/.env`, run migrations, configure systemd/nginx.
EOF

{
  echo "Created: $(date -Is)"
  echo "Project: ${PROJECT_DIR}"
  echo "Node: $(node -v 2>/dev/null || echo 'not found')"
  echo "NPM: $(npm -v 2>/dev/null || echo 'not found')"
  echo "Flags: SKIP_BUILD=${SKIP_BUILD}, SKIP_APT=${SKIP_APT}"
  echo "APT packages:"
  printf '  - %s\n' "${APT_PACKAGES[@]}"
} > "${MANIFEST}"

log "Generating SHA256 checksums"
(
  cd "${OUTPUT_DIR}"
  find . -type f ! -name "SHA256SUMS" -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
)

log "Creating final archive"
mkdir -p "$(dirname "${FINAL_ARCHIVE}")"
tar -C "$(dirname "${OUTPUT_DIR}")" -czf "${FINAL_ARCHIVE}" "$(basename "${OUTPUT_DIR}")"

log "Bundle completed"
echo "Directory: ${OUTPUT_DIR}"
echo "Archive:   ${FINAL_ARCHIVE}"
