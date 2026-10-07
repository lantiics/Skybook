require("dotenv");

import { WRITER, READER } from "../db";
import { PipelineSource, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  createReadStream,
  createWriteStream,
  mkdtempSync,
  rmSync,
} from "node:fs";
const os = require("os");
import path from "node:path";
import { createInterface } from "node:readline";

// helpers
const ipv4Regex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/;
const sourceLastUpdatedAt = async (source: "proxy" | "vpn" | "tor") => {
  const [lastUpdated] =
    await READER`SELECT added FROM blocklist_ranges WHERE source = ${source} LIMIT 1`;
  return lastUpdated;
};
const sourceElapsedMinutesUpdateThreshold = async (
  source: "proxy" | "vpn" | "tor",
  minutes: string,
) => {
  const [sourceExists] =
    await READER`SELECT EXISTS(SELECT 1 FROM blocklist_ranges WHERE source = ${source})`;
  if (sourceExists.exists) {
    const [lastUpdated] =
      await READER`SELECT EXISTS(SELECT 1 FROM blocklist_ranges WHERE source = ${source} AND added < NOW() - INTERVAL '${READER.unsafe(minutes)} minutes')`;

    return lastUpdated.exists;
  } else {
    return false;
  }
};
// doProxy

const proxyIpURL = "https://iplists.firehol.org/files/firehol_proxies.netset"; // Last checked: exclusively ipv4 (some subnets, some no subnets)
export const doProxy = async () => {
  if (await sourceElapsedMinutesUpdateThreshold("proxy", "280")) return; // 3 hours
  console.time("Updated proxies");

  const res = await fetch(proxyIpURL);
  if (!res.ok) throw new Error(res.status.toString());
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "proxy-"));
  const tmpFile = path.join(tmpDir, "ips.txt");
  try {
    let _buffer = "";
    const transform = new Transform({
      transform(chunk, _enc, cb) {
        const text = _buffer + chunk.toString();
        const lines = text.split("\n");
        _buffer = lines.pop() as string;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#") || !ipv4Regex.test(trimmed))
            continue;
          this.push(`${trimmed.includes("/") ? trimmed : trimmed + "/32"}\n`);
        }
        cb();
      },
      flush(cb) {
        const trimmed = _buffer.trim();
        if (trimmed && !trimmed.startsWith("#") && ipv4Regex.test(trimmed)) {
          this.push(`${trimmed.includes("/") ? trimmed : trimmed + "/32"}\n`);
        }
        cb();
      },
    });
    await pipeline(
      res.body as PipelineSource<ReadableStream<string>>,
      transform,
      createWriteStream(tmpFile),
    );
    const rl = createInterface({
      input: createReadStream(tmpFile),
      crlfDelay: Infinity,
    });
    const BATCH = 1000;
    let batch: string[] = [];
    console.log("beginning");
    await WRITER.begin(async (tx) => {
      console.log("delete");
      await tx`DELETE FROM blocklist_ranges WHERE source = 'proxy'`;
      console.log("deleted, querying");
      for await (const ip of rl) {
        batch.push(ip);
        if (batch.length >= BATCH) {
          const literal = `{${batch.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",")}}`;
          console.log(literal);

          await tx`INSERT INTO blocklist_ranges (source, range) SELECT 'proxy', unnest(${literal}::text[])::cidr`;
          batch = [];
        }
      }
      if (batch.length) {
        const literal = `{${batch.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",")}}`;
        console.log(literal);
        await tx`INSERT INTO blocklist_ranges (source, range) SELECT 'proxy', unnest(${literal}::text[])::cidr`;
      }
    });
    console.log("done");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  console.timeEnd("Updated proxies");
  return;
};

//doVpn
const vpnipv4URL =
  "https://raw.githubusercontent.com/X4BNet/lists_vpn/refs/heads/main/output/vpn/ipv4.txt";
const vpnipv6URL =
  "https://raw.githubusercontent.com/X4BNet/lists_vpn/refs/heads/main/output/vpn/ipv6.txt";

export const doVpn = async () => {
  if (await sourceElapsedMinutesUpdateThreshold("vpn", "720")) return; // 12 hours
  const ip4s = (await (await fetch(vpnipv4URL)).text())
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const ip6s = (await (await fetch(vpnipv6URL)).text())
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const ips: string[] = [];
  for (const cidr of ip4s) {
    ips.push(cidr);
  }
  for (const cidr of ip6s) {
    ips.push(cidr);
  }
  const literal = `{${ips.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",")}}`;
  await WRITER.begin(async (tx) => {
    await tx`DELETE FROM blocklist_ranges WHERE source = 'vpn'`;
    await tx`INSERT INTO blocklist_ranges (source, range) SELECT 'vpn', unnest(${literal}::text[])::cidr`;
  })
};

// doTor
// We can only access this list once every 30 minutes; Rate limited elsewise.
// If doing development, I recommend downloading the file locally and replacing the URL here
// with a file:// URL.
const TorDownloadURL = "https://www.dan.me.uk/torlist/?exit";
export const doTor = async () => {
  if (await sourceElapsedMinutesUpdateThreshold("tor", "30")) return;
  const res = await fetch(TorDownloadURL, {
    headers: {
      "User-Agent": "Skybook IP blocklist updating (gitlab:lantics/skybook)",
    },
  });
  if (!res.ok) return;
  console.log("it was ok");
  const text = await res.text();

  const ips: string[] = text
    .split("\n")
    .filter((i) => i !== "")
    .map(
      (ip) =>
        ip + (/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/.test(ip) ? "/32" : "/128"),
    );

  const literal = `{${ips.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",")}}`;
  await WRITER.begin(async (tx) => {
    await tx`DELETE FROM blocklist_ranges WHERE source = 'tor'`;
    await tx`INSERT INTO blocklist_ranges (source, range) SELECT 'tor', unnest(${literal}::text[])::cidr ON CONFLICT DO NOTHING`;
  })
};

export const reindex = async () => {
  await WRITER`REINDEX INDEX CONCURRENTLY idx_blocklist_ranges`;
};