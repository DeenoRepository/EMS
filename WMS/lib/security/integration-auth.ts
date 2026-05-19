import { NextRequest } from "next/server";

export function isIntegrationAuthorized(req: NextRequest) {
  const configured = (process.env.WMS_API_TOKEN || "").trim();
  if (!configured) return false;

  const bearer = req.headers.get("authorization") || "";
  const xApiToken = req.headers.get("x-api-token") || "";

  if (bearer.toLowerCase().startsWith("bearer ")) {
    const token = bearer.slice(7).trim();
    if (token && token === configured) return true;
  }

  if (xApiToken.trim() && xApiToken.trim() === configured) return true;
  return false;
}

