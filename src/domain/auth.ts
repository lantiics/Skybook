import {
  generateSecret,
  verify,
  generateURI,
  ScureBase32Plugin,
  generate,
} from "otplib";
import QRCode from "qrcode";
import { User } from "../types/entities";
import { READER, WRITER } from "../db";
import { VerifyResult } from "otplib/functional";
const crypto = require("node:crypto");
export const generateOTP = async (secret: string): Promise<string> => {
  return await generate({ secret });
};
export const passwordIsSafe = (password: string): boolean => {
  return password.length >= 8;
};

/**
 * Returns all necessary data/credentials
 * required to enable two factor authentication using TOTP
 */
export const setupTwoFactor = async (
  user: User["name"],
  uuid: User["identifier"],
): Promise<{
  secret: string;
  qrDataUrl: unknown;
  uri: string;
  codes: string[];
  hashedCodes: string[];
}> => {
  const secret = generateSecret();

  const uri = generateURI({
    issuer: "Skybook",
    label: user,
    secret,
  });
  const opts = {
    errorCorrectionLevel: "H",
    type: "image/jpeg",
    quality: 0.3,
    margin: 1,
    color: {
      dark: "#ffffffff",
      light: "#202020ff",
    },
  };
  const qrDataUrl = await (QRCode.toDataURL(
    uri,
    opts as Partial<QRCode.QRCodeToDataURLOptions>,
  ) as Promise<unknown>);
  const [codes, hashedCodes] = generateRecoveryCodes();
  return {
    secret,
    qrDataUrl,
    uri,
    codes,
    hashedCodes,
  };
};

/**
 * Returns an array of 6 recovery codes (and another array of their hashed forms)
 * for MFA recovery.
 * @returns [codes[], hashedCodes[]]
 *
 */
export const generateRecoveryCodes = (): [string[], string[]] => {
  const codes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < 6; i++) {
    let code = new ScureBase32Plugin()
      .encode(crypto.randomBytes(32))
      .replace(/=/g, "");
    code = code.slice(0, code.length / 3);
    const salt = new ScureBase32Plugin()
      .encode(crypto.randomBytes(32))
      .replace(/=/g, "");
    let hashedCode = code;
    hashedCode = Bun.SHA256.hash(code + salt, "hex");
    hashedCode = [hashedCode, salt, "0"].join(":");
    codes.push(code);
    hashedCodes.push(hashedCode);
  }

  return [codes, hashedCodes];
};

/**
 *  Validates a MFA recovery code for a user.
 *  If the code is valid, we mark it as consumed and update the user's database entry to
 *  mark the used code as such.
 * @param identifier To whom the recovery codes are to be checked against
 * @param code The recovery code to check
 * @param codes An array containing all of the user's MFA recovery codes
 */
export const recoveryCodeValid = async (
  identifier: User["identifier"],
  code: string,
  codes: string[],
): Promise<boolean> => {
  for (const [token, salt, consumed] of codes.map((str) => str.split(":"))) {
    if (consumed === "1") continue;
    const saltedCode = Bun.SHA256.hash(code + salt, "hex");
    if (saltedCode === token) {
      const index = codes.indexOf([token, salt, consumed].join(":"));
      const newState = [token, salt, "1"].join(":");
      codes[index] = newState;
      await WRITER`UPDATE users SET mfa_recovery = ${WRITER.array(codes, "TEXT")} WHERE identifier = ${identifier}`;
      return true;
    }
  }
  return false;
};

/**
 * Saves the provided window to the provided user's database entry.
 * This is to provide TOTP replay protection, and should be used whenever
 * a user provides a valid one-time password.
 * @param identifier To whom the window will be saved
 * @param window The TOTP window to be saved
 */
export const saveLastTotpWindow = async (
  identifier: User["identifier"],
  window: number,
): Promise<void> => {
  await WRITER`UPDATE users SET last_totp_window = ${window} WHERE identifier = ${identifier}`;
};

/**
 * Returns the last TOTP window saved for the provided user.
 * This is to provide TOTP replay protection, and should be used whenever
 * validating a one-time password
 */
export const lastTotpWindow = async (
  identifier: User["identifier"],
): Promise<User["last_totp_window"]> => {
  return (
    await READER`SELECT last_totp_window FROM users WHERE identifier = ${identifier}`
  )[0].last_totp_window;
};

/**
 *
 * @param secret The TOTP secret to be used for validation
 * @param token The provided one-time password to be validated
 * @param identifier - The identifier of the user whom is attempting to authorize.
 * This is to be provided whenever validating a user's login,
 * as it is then used to provide TOTP replay protection.
 *
 *
 * @returns
 */
export const verifyTotp = async (
  secret: string,
  token: string,
  identifier?: User["identifier"],
): Promise<boolean> => {
  let res: VerifyResult;
  if (identifier) {
    const window = await lastTotpWindow(identifier);
    if (window) {
      res = await verify({ secret, token, afterTimeStep: window });
    } else {
      res = await verify({ secret, token });
    }
    if (res.valid) {
      if (!("timeStep" in res)) {
        throw new Error("Timestep is not present in TOTP");
      }
      await saveLastTotpWindow(identifier, res.timeStep);
      return true;
    }
    return false;
  }
  return (await verify({ secret, token })).valid;
};
