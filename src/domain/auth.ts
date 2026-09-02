import { DB } from "../db";
import { generateSecret, generate, verify, generateURI } from "otplib";
import QRCode from "qrcode";

export const passwordIsSafe = (password: string) => {
  return password.length > 8;
};

export const setupTwoFactor = async (user: string) => {
  const secret = generateSecret();

  const uri = generateURI({
    issuer: "dropbox",
    label: user,
    secret,
  });

  const qrDataUrl = await QRCode.toDataURL(uri);

  return {
    secret,
    qrDataUrl,
    uri,
  };
};

const generateToken = async (secret: string) => {
  return await generate({ secret });
};

export const verifyTotp = async (secret: string, token: string) => {
  return (await verify({ secret, token })).valid;
};
