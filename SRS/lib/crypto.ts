import crypto from "crypto";

const ALGO = "aes-256-gcm";

function keyFromEnv() {
  const input = process.env.APP_ENCRYPTION_KEY ?? "";
  return crypto.createHash("sha256").update(input).digest();
}

export function encryptText(value: string) {
  const iv = crypto.randomBytes(12);
  const key = keyFromEnv();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptText(value: string) {
  const [ivB64, tagB64, dataB64] = value.split(":");
  const decipher = crypto.createDecipheriv(ALGO, keyFromEnv(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
