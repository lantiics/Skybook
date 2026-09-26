import {
  generateSecret,
  verify,
  generateURI,
  ScureBase32Plugin,
  generate,
} from "otplib";
import QRCode from "qrcode";
import { User } from "../types/entities";
const crypto = require("node:crypto");
export const generateOTP = async (secret: string) => {
  return await generate({ secret });
};
export const passwordIsSafe = (password: string) => {
  return password.length > 8;
};

export const setupTwoFactor = async (user: User["name"]) => {
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
  const codes = generateRecoveryCodes();

  return {
    secret,
    qrDataUrl,
    uri,
    codes,
  };
};

export const generateRecoveryCodes = (): User["mfa_recovery"] => {
  const codes = [];
  for (let i = 0; i < 6; i++) {
    let code = new ScureBase32Plugin()
      .encode(crypto.randomBytes(32))
      .replace(/=/g, "");
    codes.push(code.slice(0, code.length / 3));
  }

  return codes;
};

export const verifyTotp = async (secret: string, token: string) => {
  return (await verify({ secret, token })).valid;
};
