import { config } from "../config";

export const purgeCache = async (tag: string) => {
  if (!config.caching.purging) return;
  const endpoint = config.caching.purge_endpoint;
  const body = JSON.stringify({ tags: [tag] });
  const token = process.env.CACHE_CLEARING_TOKEN;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body,
  });
  if (!res.ok) throw res;
  return res;
};

export const purgeInstanceCache = async (instance: string) => {
  const res = await purgeCache(`instance-${instance}`);
  return 0;
};
