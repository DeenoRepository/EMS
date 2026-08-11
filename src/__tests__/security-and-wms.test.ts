import { describe, it, expect } from "vitest";
import { sanitizeCsvValue } from "@/lib/utils/csv-sanitize";
import { calculateChecksum, generateSignedDownloadUrl } from "@/lib/storage/s3";
import { jwtPayloadSchema } from "@/lib/auth/jwt-schema";
import { z } from "zod";

describe("Security & CSV Formula Injection Prevention (SEC-15)", () => {
  it("should prepend single quote to formula trigger characters (=, +, -, @)", () => {
    expect(sanitizeCsvValue("=1+1")).toBe("'=1+1");
    expect(sanitizeCsvValue("+100")).toBe("'+100");
    expect(sanitizeCsvValue("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
    expect(sanitizeCsvValue("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
  });

  it("should not alter safe string values", () => {
    expect(sanitizeCsvValue("Оборудование насос-1")).toBe("Оборудование насос-1");
    expect(sanitizeCsvValue("SKU-12345")).toBe("SKU-12345");
    expect(sanitizeCsvValue(12345)).toBe("12345");
  });

  it("should handle null and undefined safely", () => {
    expect(sanitizeCsvValue(null)).toBe("");
    expect(sanitizeCsvValue(undefined)).toBe("");
  });
});

describe("Storage File Checksum & Download URL Generation (SEC-06..SEC-08)", () => {
  it("should calculate sha256 checksum correctly", () => {
    const testBuffer = Buffer.from("test document content", "utf-8");
    const checksum = calculateChecksum(testBuffer);
    expect(checksum).toHaveLength(64);
    expect(checksum).toBe("b91e98eb4b72ef7913391ee03ff4d7a8d0bfa81600e12d5d85ee8d92994cf4f5");
  });

  it("should generate valid signed download URLs for S3 storage", () => {
    const s3Path = "s3://ems-documents/documents/12345_test.pdf";
    const signedUrl = generateSignedDownloadUrl(s3Path, 3600);
    expect(signedUrl).toContain("ems-documents/documents/12345_test.pdf");
    expect(signedUrl).toContain("expires=");
    expect(signedUrl).toContain("sig=");
  });

  it("should generate relative download URLs for local storage", () => {
    const localPath = "uploads/documents/12345_test.pdf";
    const downloadUrl = generateSignedDownloadUrl(localPath);
    expect(downloadUrl).toBe("/api/files/download?file=uploads%2Fdocuments%2F12345_test.pdf");
  });
});

describe("JWT Payload Validation (SEC-10)", () => {
  it("should validate valid user JWT payload", () => {
    const payload = {
      id: "usr_123",
      username: "storekeeper1",
      displayName: "Иван Иванов",
      email: "ivan@example.com",
      roles: ["STOREKEEPER"],
      jti: "jti_123456789"
    };

    const parseResult = jwtPayloadSchema.safeParse(payload);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.username).toBe("storekeeper1");
      expect(parseResult.data.roles).toEqual(["STOREKEEPER"]);
    }
  });

  it("should reject payload with missing required fields or invalid roles", () => {
    const invalidPayload = {
      id: "usr_123",
      // missing username
      roles: ["SUPERMAN_ROLE"]
    };

    const parseResult = jwtPayloadSchema.safeParse(invalidPayload);
    expect(parseResult.success).toBe(false);
  });
});

describe("WMS Quantity Validation Schemas (SEC-03)", () => {
  const wmsQuantitySchema = z.number().int().positive();

  it("should accept positive integer quantities", () => {
    expect(wmsQuantitySchema.safeParse(1).success).toBe(true);
    expect(wmsQuantitySchema.safeParse(100).success).toBe(true);
  });

  it("should reject zero, negative, and fractional quantities", () => {
    expect(wmsQuantitySchema.safeParse(0).success).toBe(false);
    expect(wmsQuantitySchema.safeParse(-5).success).toBe(false);
    expect(wmsQuantitySchema.safeParse(1.5).success).toBe(false);
  });
});
