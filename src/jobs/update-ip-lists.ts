require("dotenv");

import { WRITER, READER } from "../db";

// helpers
const sourceLastUpdatedAt = async (source: "proxy" | "vpn" | "tor") => {
  const [lastUpdated] =
    await READER`SELECT added FROM blocklist_ranges WHERE source = ${source} LIMIT 1`;
  return lastUpdated;
};
const sourceElapsedMinutesUpdateThreshold = async (
  source: "proxy" | "vpn" | "tor",
  minutes: string,
) => {
  const [lastUpdated] =
    await READER`SELECT EXISTS(SELECT 1 FROM blocklist_ranges WHERE source = ${source} AND added < NOW() - INTERVAL '${READER.unsafe(minutes)} minutes')`;
  return lastUpdated.exists;
};
// doProxy

const doProxy = async () => {
  return;
};

//doVpn
const vpnipv4URL =
  "https://raw.githubusercontent.com/X4BNet/lists_vpn/refs/heads/main/output/vpn/ipv4.txt";
const vpnipv6URL =
  "https://raw.githubusercontent.com/X4BNet/lists_vpn/refs/heads/main/output/vpn/ipv6.txt";

const doVpn = async () => {
  if (!(await sourceElapsedMinutesUpdateThreshold("vpn", "720"))) return; // 12 hours
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
  await WRITER`DELETE FROM blocklist_ranges WHERE source = 'vpn'`;
  await WRITER`INSERT INTO blocklist_ranges (source, range) SELECT 'vpn', unnest(${literal}::text[])::cidr`;
};

// doTor
const TorDownloadURL = "https://www.dan.me.uk/torlist/?exit"; // We can only access this list once every 30 minutes; Rate limited elsewise
const torRegex = /ExitAddress (\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b) /g;
const doTor = async () => {
  if (!(await sourceElapsedMinutesUpdateThreshold("tor", "30"))) return;
  const res = await fetch(TorDownloadURL, {
    headers: {
      "User-Agent":
        "hey dan im like doing development on my machine and i may have forgotten to disable the fetching of ips when validating ip blocking sorry",
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
  await WRITER`DELETE FROM blocklist_ranges WHERE source = 'tor'`;
  await WRITER`INSERT INTO blocklist_ranges (source, range) SELECT 'tor', unnest(${literal}::text[])::cidr ON CONFLICT DO NOTHING`;
};

doProxy();
doVpn();
doTor();

setInterval(
  () => {
    doProxy();
    doVpn();
    doTor();
  },
  30 * 60 * 1000,
); // 30 minutes
