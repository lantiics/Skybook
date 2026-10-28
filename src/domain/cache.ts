import { config } from "../config";
import { Instance } from "../types/entities";

/**
 * Purges CDN cache for the provided cache-tag,
 * using an API token provided in the environment as authentication.
 */
export const purgeCache = async (tag: string): Promise<void> => {
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
  return;
};

/**
 * Purges the CDN cache for the supplied instance,
 * using a cache-tag formed from the instance name.
 */
export const purgeInstanceCache = async (
  instance: Instance["name"],
): Promise<void> => {
  await purgeCache(`instance-${instance}`);
  return;
};
