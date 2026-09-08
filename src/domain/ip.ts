import { READER, WRITER } from "../db.ts";
import { createHmac } from "crypto";
import { config } from "../config";
import { tryGlobalBlock } from "./enforcements.ts";
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

export const localIpBlockInformation = async (ip: string, instance: string) => {
  const ipHash = hashIp(ip);
};

export const globalIpBlockInformation = async (ip: string) => {
  const ipHash = hashIp(ip);
};

export const blockIpOnInstance = async (
  instance: string,
  ipHash: string,
  reason?: string,
) => {
  const isNewBlock = await WRITER.begin(async (tx) => {
    const [row] = await tx`
    INSERT INTO instance_blocks (instance, ip_hash, reason) VALUES (${instance},${ipHash},${reason}) 
    ON CONFLICT (instance, ip_hash) DO NOTHING
    RETURNING ip_hash
    `;
    await tx`UPDATE posts AS t1
    SET creator_ip_blocked_reason = t2.reason
    FROM instance_blocks AS t2
    WHERE t1.ip_hash = t2.ip_hash
    AND t1.instance - ${instance}`;
    return !!row;
  });
  if (!isNewBlock) return;
  const blockCount = (
    await WRITER`
  INSERT INTO ip_block_stats (ip_hash) VALUES (${ipHash})
  ON CONFLICT (ip_hash) DO UPDATE
    SET block_count = ip_block_stats.block_count + 1, last_blocked_at = now()
RETURNING block_count
  `
  )[0].block_count;
  await tryGlobalBlock(ipHash, blockCount);
};
export const unblockIpOnInstance = async (
  instance: string,
  ipHash: string,
): Promise<void> => {
  await WRITER.begin(async (tx) => {
    const [wasBlocked] = await tx`
    DELETE FROM instance_blocks WHERE instance = ${instance} AND ip_hash = ${ipHash}
    RETURNING ip_hash`;
    if (!wasBlocked) return;
    await tx`
    UPDATE ip_block_stats
    SET block_count = GREATEST (block_count - 1, 0)
    WHERE ip_hash = ${ipHash}`;
    const currentBlockCount = (
      await tx`SELECT block_count FROM ip_block_stats WHERE ip_hash = ${ipHash}`
    )[0].block_count;
    if (currentBlockCount < config.ip_blocking.global_block_threshold) {
      await tx`DELETE FROM global_ip_blocks WHERE ip_hash = ${ipHash} AND reason LIKE 'SYSTEM:%'`;
    }
  });
};
