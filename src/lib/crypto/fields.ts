/**
 * Field encryption for sensitive taxpayer data (TIN, registered name/address,
 * entry notes). AES-256-GCM with a random 96-bit IV per value; the auth tag
 * detects tampering. Format: "v1:<iv b64>:<tag b64>:<ciphertext b64>".
 * Key: FIELD_ENCRYPTION_KEY = 32 random bytes, base64. Rotating it requires
 * re-encrypting existing values (see README).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function parseKey(b64: string | undefined): Buffer | null {
  if (!b64) return null;
  const key = Buffer.from(b64, "base64");
  return key.length === 32 ? key : null;
}

export function encryptField(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}

/** Returns null for a missing value, a wrong key, or tampered data (never throws). */
export function decryptField(value: string | null | undefined, key: Buffer): string | null {
  if (!value) return null;
  const [version, iv, tag, ct] = value.split(":");
  if (version !== "v1" || !iv || !tag || ct === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
