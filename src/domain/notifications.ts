import { config } from "../config";
import { WRITER } from "../db";
import crypto from "node:crypto";

export const encryptedURL = (url: string) => {
  const key = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.NOTIFICATION_URL_KEY as string, "hex"),
    Buffer.from(process.env.NOTIFICATION_URL_IV as string, "hex"),
  );
  url = key.update(url, "utf8", "base64");
  url += key.final("base64");
  return url;
};
export const decryptURL = (url: string) => {
  const key = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.NOTIFICATION_URL_KEY as string, "hex"),
    Buffer.from(process.env.NOTIFICATION_URL_IV as string, "hex"),
  );
  url = key.update(Buffer.from(url, "base64")) as any;

  return url.toString();
};
export const notifyUser = async (
  user: string,
  message: string = `A new entry has just been made on your guestbook at ${config.skybook.subdomain_vanity ? `${user}.${config.skybook.domain}` : `${config.skybook.domain}/${user}`}!`,
  DB = WRITER,
) => {
  const {
    notification_endpoint: encryptedUrl,
    notification_service: webhookService,
  } =
    await WRITER`SELECT notification_endpoint,notification_service FROM instances WHERE name = ${user}`;
  const userUrl = decryptURL(encryptedUrl);
  switch (webhookService) {
    case "ntfy":
      break;
  }
  const requestBody: any = {
    method: "POST",
    body:
      config.skybook.instance_notification_proxy_url !== ""
        ? JSON.stringify({
            message,
            url: config.skybook.instance_notification_proxy_url,
          })
        : message,
    headers: { Title: "Skybook" },
  };
  const url =
    config.skybook.instance_notification_proxy_url !== ""
      ? config.skybook.instance_notification_proxy_url
      : userUrl;
  switch (webhookService) {
    case "ntfy": {
      await fetch(url, requestBody);
      return;
    }
  }
  throw new Error(
    "THIS SHOULD NOT BE SEEN: No webhook service available could be used to notify instance owner upon new entry creation.",
  );
};
