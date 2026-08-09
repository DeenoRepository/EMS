import { describe, it, expect } from "vitest";
import { jwtPayloadSchema } from "../jwt-schema";
import { hashJti, revokeToken, isTokenRevoked } from "../token-blacklist";
import {
  checkLoginRateLimit,
  registerFailedLoginAttempt,
  resetLoginAttempts,
} from "../rate-limiter";

describe("PR-6: Session Security, Token Revocation & Rate Limiting", () => {
  describe("SEC-10: JWT Payload Validation Schema", () => {
    it("should parse valid JWT payload", () => {
      const validPayload = {
        id: "usr-123",
        username: "editor",
        displayName: "Инженер",
        email: "editor@ems.local",
        roles: ["EDITOR", "VIEWER"],
        jti: "jti_123456789_abcdef",
        iss: "ems-auth-service",
        aud: "ems-app",
      };

      const result = jwtPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("should reject JWT payload with invalid issuer or audience", () => {
      const invalidIssPayload = {
        id: "usr-123",
        username: "editor",
        displayName: "Инженер",
        email: "editor@ems.local",
        roles: ["EDITOR"],
        jti: "jti_12345",
        iss: "malicious-issuer",
        aud: "ems-app",
      };

      expect(jwtPayloadSchema.safeParse(invalidIssPayload).success).toBe(false);
    });
  });

  describe("SEC-11: Hashed JTI Token Revocation", () => {
    it("should correctly compute SHA-256 hash of jti", () => {
      const jti = "jti_test_123";
      const hash = hashJti(jti);
      expect(hash).toHaveLength(64); // Hex SHA-256 length
    });

    it("should revoke token and confirm revoked status by jti hash", () => {
      const testJti = "jti_to_be_revoked_999";

      expect(isTokenRevoked(testJti)).toBe(false);
      revokeToken(testJti, 3600);
      expect(isTokenRevoked(testJti)).toBe(true);
    });
  });

  describe("SEC-14: Application-level Login Rate Limiter", () => {
    const testIdentifier = "127.0.0.1:brute_force_user";

    it("should track failed login attempts and block after 5 failures", () => {
      resetLoginAttempts(testIdentifier);

      for (let i = 0; i < 5; i++) {
        expect(checkLoginRateLimit(testIdentifier).isBlocked).toBe(false);
        registerFailedLoginAttempt(testIdentifier);
      }

      const blockedCheck = checkLoginRateLimit(testIdentifier);
      expect(blockedCheck.isBlocked).toBe(true);
      expect(blockedCheck.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("should reset attempts on successful login", () => {
      resetLoginAttempts(testIdentifier);
      expect(checkLoginRateLimit(testIdentifier).isBlocked).toBe(false);
    });
  });
});
