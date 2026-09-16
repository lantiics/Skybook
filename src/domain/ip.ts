import { READER } from "../db.ts";
import { createHmac } from "crypto";

export const hashIp = (ip: string): string => {
  return createHmac("sha256", process.env.IP_HASH_SECRET!)
    .update(ip)
    .digest("hex");
};
export const ipSource = async (ip: string) => {
  const [m] =
    await READER`SELECT source FROM blocklist_ranges WHERE ${ip}::inet <<= range LIMIT 1`;

  return m?.source;
};
const ipIsBlockedOnInstance = async (ip: string, instance: string) => {
  const ipHash = hashIp(ip);
  const [block] =
    await READER`SELECT EXISTS(SELECT 1 FROM instance_blocks WHERE ip_hash = ${ipHash} AND instance = ${instance})`;
  return block.exists;
};

export const ipIsBlockedGlobally = async (ip: string) => {
  const ipHash = hashIp(ip);
  const [block] =
    await READER`SELECT EXISTS(SELECT 1 FROM global_ip_blocks WHERE ip_hash IS ${ipHash})`;
  return block.exists;
};

export const ipIsBlocked = async (ip: string, instance: string) => {
  const blockedLocally = await ipIsBlockedOnInstance(ip, instance);
  const blockedGlobally = await ipIsBlockedGlobally(ip);
  if (!blockedLocally) {
    if (blockedGlobally) {
      return true;
    }
    return false;
  }
  return true;
};
