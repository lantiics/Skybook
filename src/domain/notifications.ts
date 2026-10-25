import { config } from "../config";
import { READER } from "../db";
import crypto from "node:crypto";
import { Instance, Post } from "../types/entities";
import { LengthError } from "../errors";
import { decryptedSecret } from "./encryption";

export const notificationUrlIsValidForService = (
  service: string,
  url: string,
) => {
  if (!url.startsWith("https://")) return false;
  if (url.length >= 400) throw new LengthError("URL Length is too large");
  switch (service) {
    case "ntfy":
      break; // NTFY can be self-hosted.
    case "custom":
      break;
    case "discord":
      if (!url.startsWith("https://discord.com/api")) return false;
    default:
      return false;
  }
  return true;
};

export const notifyUser = async (
  instance: Instance["name"],
  post: Post | null = null,
  message: string = `A new entry has just been made on your guestbook at ${config.skybook.subdomain_vanity ? `${instance}.${config.skybook.domain}` : `${config.skybook.domain}/${instance}`}!`,
  DB = READER,
) => {
  if (!config.skybook.instance_notifications) return;
  if (!process.env.NOTIFICATION_URL_KEY)
    throw new Error("No notification key is available, unable to notify user");
  const [
    {
      notification_endpoint: encryptedUrl,
      notification_service: webhookService,
    },
  ] =
    await DB`SELECT notification_endpoint,notification_service FROM instances WHERE name = ${instance}`;
  if (!encryptedUrl || !webhookService) return;
  const userUrl = decryptedSecret(
    encryptedUrl,
    instance,
    process.env.NOTIFICATION_URL_KEY,
  );

  let reqHeaders = {
    "User-Agent": `Skybook/${config.skybook.version} (instance-notifications; +https://${config.skybook.domain}; https://gitlab.com/lantics/skybook)`,
  };
  if (process.env.NOTIFICATION_PROXY_HEADERS) {
    reqHeaders = {
      ...reqHeaders,
      ...JSON.parse(process.env.NOTIFICATION_PROXY_HEADERS),
    };
  }
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
      updateBody({
        username: "Skybook",
        content: message + ` \n-# <t:${Math.floor(Date.now() / 1000)}:R>`,
      });
      requestBody.headers["Content-Type"] = "application/json";
      break;
    }
    case "matrix": {
      updateBody({ text: message });
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
    if (config.skybook.instance_notification_proxy_url !== "")
      requestBody.body.FORWARDHEADERS = requestBody.headers;
    requestBody.body = JSON.stringify(requestBody.body);
  }
  if (process.env.NODE_ENV !== "test") {
    fetch(url, requestBody).then((res) => {
      if (!res.ok) {
        console.warn(
          "Notification request failed, Notifications proxied:" +
            config.skybook.instance_notification_proxy_url !==
            "",
        );
        throw res;
      }
    });
  }
};
