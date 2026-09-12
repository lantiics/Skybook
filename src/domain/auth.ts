import { generateSecret, verify, generateURI, ScureBase32Plugin } from "otplib";
import QRCode from "qrcode";
const crypto = require("node:crypto");

export const passwordIsSafe = (password: string) => {
  return password.length > 8;
};

export const setupTwoFactor = async (user: string) => {
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
  //@ts-expect-error
  const qrDataUrl = await (QRCode.toDataURL(uri, opts) as Promise<unknown>);

  return {
    secret,
    qrDataUrl,
    uri,
  };
};

export const generateRecoveryCodes = (): string[] => {
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
