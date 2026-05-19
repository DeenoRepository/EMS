export function isDebugAuthEnabled() {
  return ((process.env.NEXT_PUBLIC_ENABLE_DEBUG_AUTH_ROUTES || process.env.ENABLE_DEBUG_AUTH_ROUTES || "false").toLowerCase() === "true");
}
