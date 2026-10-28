import crypto from "node:crypto";

/**
 * Encrypts the provided secret using the provided AAD for integrity and the provided key for encryption.
 * This is especially useful as a helper function for storing any potentially sensitive data.
 *
 * @param secret The string to encrypt
 * @param aad Additional authentication data to use for keeping integrity of the encrypted secret
 * @param key The key to use for encryption
 */
export const encryptedSecret = (
  secret: string,
  aad: string,
  key: string,
): string => {
  if (!key || typeof key !== "string") {
    throw new Error("Invalid encryption key provided");
  }
  const KEY = Buffer.from(key, "hex");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return [
    "v2",
    iv.toString("base64"),
    tag.toString("base64"),
    ct.toString("base64"),
  ].join(":");
};

/**
 * Decrypts the provided secret using the provided AAD for integrity and the provided key for decreyption.
 * This is especially useful as a helper function for storing any potentially sensitive data.
 *
 * @param secret The secret to decrypt
 * @param aad Additional authentication data to use for keeping integrity of the secret
 * @param key The key to use for decryption
 */
export const decryptedSecret = (
  secret: string,
  aad: string,
  key: string,
): string => {
  if (!key || typeof key !== "string") {
    throw new Error("Invalid decryption key provided");
  }
  const KEY = Buffer.from(key, "hex");
  const [v, iv, tag, ct] = secret.split(":");
  if (v !== "v2") throw new Error("unsupported notification_endpoint format");
  const d = crypto.createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(iv, "base64"),
  );
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(ct, "base64")),
    d.final(),
  ]).toString("utf8");
};
