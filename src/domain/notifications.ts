import { config } from "../config";
import { WRITER } from "../db";
import crypto from "node:crypto";
import { BadRequestError } from "../errors";

export const notificationUrlIsValidForService = (
  service: string,
  url: string,
) => {
  switch (service) {
    case "ntfy":
      break; // NTFY can be self-hosted.
    case "custom":
      break;
    case "discord":
      if (!url.startsWith("https://discord.com/api")) return false;
  }
  return true;
};

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
  if (!encryptedUrl || !webhookService) return;
  const userUrl = decryptURL(encryptedUrl);
  switch (webhookService) {
    case "ntfy":
      break;
  }
  const reqHeaders = {
    "User-Agent": `Skybook/${config.skybook.version} (instance-notifications; +https://${config.skybook.domain}; https://gitlab.com/lantics/skybook)`,
  };
  const requestBody: any = {
    method: "POST",
    body:
      config.skybook.instance_notification_proxy_url !== ""
        ? {
            body: message,
            endpointURL: userUrl,
            FORWARDHEADERS: reqHeaders,
          }
        : message,
    headers: reqHeaders,
  };
  const updateBody = (body: any) => {
    if (config.skybook.instance_notification_proxy_url !== "") {
      requestBody.body.body = body;
    } else {
      requestBody.body = body;
    }
  };

  const url =
    config.skybook.instance_notification_proxy_url !== ""
      ? config.skybook.instance_notification_proxy_url
      : userUrl;
  switch (webhookService) {
    case "ntfy": {
      requestBody.headers.Title = "Skybook";
      break;
    }
    case "discord": {
      updateBody({ username: "Skybook", content: message });
      requestBody.headers["Content-Type"] = "application/json";
      break;
    }
    case "custom":
      break;
    default:
      throw new Error(
        "THIS SHOULD NOT BE SEEN: No webhook service available could be used to notify instance owner upon new entry creation.",
      );
  }
  if (typeof requestBody.body == "object") {
    requestBody.body.FORWARDHEADERS = requestBody.headers;
    requestBody.body = JSON.stringify(requestBody.body);
  }
  if (process.env.NODE_ENV !== "test") {
    fetch(url, requestBody).then((res) => {
      if (!res.ok)
        console.warn(
          "Notification request failed, Notifications proxied:" +
            config.skybook.instance_notification_proxy_url !==
            "",
        );
    });
  }
};
