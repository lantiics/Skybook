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
const crypto = require("node:crypto");
export const generateOTP = async (secret: string) => {
  return await generate({ secret });
};
export const passwordIsSafe = (password: string) => {
  return password.length >= 8;
};

export const setupTwoFactor = async (
  user: User["name"],
  uuid: User["identifier"],
) => {
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

export const generateRecoveryCodes = (): [User["mfa_recovery"], string[]] => {
  const codes = [];
  const hashedCodes = [];
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

export const recoveryCodeValid = async (
  identifier: User["identifier"],
  code: string,
  codes: string[],
) => {
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

export const saveLastTotpWindow = async (
  identifier: User["identifier"],
  window: number,
) => {
  await WRITER`UPDATE users SET last_totp_window = ${window} WHERE identifier = ${identifier}`;
};
export const lastTotpWindow = async (
  identifier: User["identifier"],
): Promise<User["last_totp_window"]> => {
  return (
    await READER`SELECT last_totp_window FROM users WHERE identifier = ${identifier}`
  )[0].last_totp_window;
};
export const verifyTotp = async (
  secret: string,
  token: string,
  identifier?: User["identifier"],
) => {
  let res;
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
