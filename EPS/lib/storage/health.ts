import { access, mkdir } from "fs/promises";
import { constants } from "fs";
import { isAbsolute, join, resolve } from "path";

function resolveHealthStorageRoot() {
  const mode = (process.env.LOCAL_STORAGE_MODE || "UPLOADS").toUpperCase();
  if (mode === "NETWORK_DRIVE") {
    const rawPath = (process.env.NETWORK_STORAGE_PATH || "").trim();
    if (rawPath) {
      return isAbsolute(rawPath)
        ? rawPath
        : resolve(/* turbopackIgnore: true */ process.cwd(), rawPath);
    }
  }
  return join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads");
}

export async function checkStorageHealth() {
  try {
    const root = resolveHealthStorageRoot();
    await mkdir(root, { recursive: true });
    await access(root, constants.W_OK);
    return { ok: true, provider: "local", message: "Local storage writable", path: root };
  } catch {
    return { ok: false, provider: "local", message: "Local storage is not writable" };
  }
}

