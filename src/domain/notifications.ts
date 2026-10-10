import { config } from "../config";
import { READER } from "../db";
import crypto from "node:crypto";
import { Instance, Post } from "../types/entities";

export const notificationUrlIsValidForService = (
  service: string,
  url: string,
) => {
  if (!url.startsWith("https://")) return false;
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
const KEY = Buffer.from(process.env.NOTIFICATION_URL_KEY!, "hex");
export const encryptedURL = (url: string, instance: string) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  c.setAAD(Buffer.from(instance));
  const ct = Buffer.concat([c.update(url, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return [
    "v2",
    iv.toString("base64"),
    tag.toString("base64"),
    ct.toString("base64"),
  ].join(":");
};
export const decryptedURL = (stored: string, instance: string) => {
  const [v, iv, tag, ct] = stored.split(":");
  if (v !== "v2") throw new Error("unsupported notification_endpoint format");
  const d = crypto.createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(iv, "base64"),
  );
  d.setAAD(Buffer.from(instance));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(ct, "base64")),
    d.final(),
  ]).toString("utf8");
};
export const notifyUser = async (
  instance: Instance["name"],
  post: Post | null = null,
  message: string = `A new entry has just been made on your guestbook at ${config.skybook.subdomain_vanity ? `${instance}.${config.skybook.domain}` : `${config.skybook.domain}/${instance}`}!`,
  DB = READER,
) => {
  if (!config.skybook.instance_notifications) return;
  const [
    {
      notification_endpoint: encryptedUrl,
      notification_service: webhookService,
    },
  ] =
    await DB`SELECT notification_endpoint,notification_service FROM instances WHERE name = ${instance}`;
  if (!encryptedUrl || !webhookService) return;
  const userUrl = decryptedURL(encryptedUrl, instance);

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

      /*

      TBD whether we include post content in messages.
      Main worry: Providing potentially excessive data
      to third party services (in the event the entry is
      not immediately visible to anyone who comes across the guestbook instance
      )

      // updateBody({
      //   username: "Skybook",
      //   embeds: [
      //     {
      //       author: { name: post!.author },
      //       description: post!.content,
      //       footer: {
      //         text: `this post is ${post!.is_queued ? "queued" : "not queued"}`,
      //       },
      //     },
      //   ],
      // });


      */
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
      if (!res.ok)
        console.warn(
          "Notification request failed, Notifications proxied:" +
            config.skybook.instance_notification_proxy_url !==
            "",
        );
    });
  }
};
