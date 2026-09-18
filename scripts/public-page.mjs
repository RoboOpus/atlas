import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { sourceUrl, accessMode, extractMetadata } from "./inbox-core.mjs";

export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 0 || b === 168 || b === 88 && c === 99) || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113);
  }
  if (isIP(address) === 6) {
    const parts = address.toLowerCase().split(":");
    return /^[23][0-9a-f]{3}$/.test(parts[0]) && parts[0] !== "2002" && parts[0] !== "3fff" && !(parts[0] === "2001" && (parseInt(parts[1] || "0", 16) <= 0x1ff || parts[1] === "db8"));
  }
  return false;
}
export async function resolvePublic(hostname, resolver = lookup) {
  let timer;
  const addresses = await Promise.race([
    resolver(hostname, { all: true }),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("DNS lookup timed out")), 5000); })
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) throw new Error("DNS includes non-public addresses; automatic reading refused");
  return addresses.find((item) => item.family === 4) ?? addresses[0];
}
export async function requestPublic(value) {
  const url = sourceUrl(value);
  if (accessMode(url.href) !== "public-metadata") throw new Error("This link requires single-link browser assistance; no automatic request was made");
  const address = await resolvePublic(url.hostname);
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const req = request(url, { agent: false, family: address.family, autoSelectFamily: false,
      lookup: (_host, options, callback) => options.all ? callback(null, [address]) : callback(null, address.address, address.family),
      headers: { "User-Agent": "RoboOpusAtlas/0.3 (+https://github.com/RoboOpus/atlas)", Accept: "text/html,text/plain;q=0.8", "Accept-Encoding": "identity" }
    }, (res) => {
      if (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity") { res.destroy(); req.destroy(new Error("Compressed response unsupported; use browser assistance")); return; }
      res.on("data", (chunk) => { size += chunk.length; if (size > 1048576) req.destroy(new Error("Page exceeds 1 MiB metadata limit")); else chunks.push(chunk); });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    // A deadline limits the whole request, not only idle sockets.
    const timer = setTimeout(() => req.destroy(new Error("Public page request timed out")), 15000);
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
}

// Conservative robots handling: specific matching groups override wildcard groups;
// longest rule wins, Allow wins ties. Unsupported/failed retrieval stays assisted.
export function robotsAllows(body, value) {
  const groups = [];
  let group = { agents: [], rules: [] };
  for (const line of body.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const match = line.replace(/#.*$/, "").match(/^\s*([a-z-]+)\s*:\s*(.*?)\s*$/i);
    if (!match) continue;
    const key = match[1].toLowerCase(), value = match[2];
    if (key === "user-agent") {
      if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
      group.agents.push(value.toLowerCase());
    } else if (["allow", "disallow"].includes(key) && group.agents.length) group.rules.push({ allow: key === "allow", pattern: value });
  }
  groups.push(group);
  const bot = "roboopusatlas";
  const specific = groups.filter((item) => item.agents.some((agent) => agent === bot));
  const selected = specific.length ? specific : groups.filter((item) => item.agents.includes("*"));
  const url = new URL(value), target = url.pathname + url.search;
  let decoded = target; try { decoded = decodeURIComponent(target); } catch { return false; }
  const rules = selected.flatMap((item) => item.rules).filter((rule) => rule.pattern).filter((rule) => {
    const end = rule.pattern.endsWith("$");
    const pattern = (end ? rule.pattern.slice(0, -1) : rule.pattern).split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    const regex = new RegExp(`^${pattern}${end ? "$" : ""}`);
    return regex.test(target) || regex.test(decoded);
  }).sort((a, b) => b.pattern.length - a.pattern.length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow ?? true;
}

export async function readPageMetadata(value, transport = requestPublic) {
  let url = sourceUrl(value);
  const checked = new Map();
  for (let redirects = 0; redirects <= 4; redirects++) {
    if (accessMode(url.href) !== "public-metadata") throw new Error("Browser assistance required for this source or redirect");
    if (!checked.has(url.origin)) {
      const robots = await transport(`${url.origin}/robots.txt`);
      if (robots.status !== 404 && robots.status !== 410 && robots.status !== 200) throw new Error(`Robots status ${robots.status}; use browser assistance`);
      if (robots.status === 200 && /<html\b/i.test(robots.body)) throw new Error("Robots response is HTML; cannot establish crawling policy");
      checked.set(url.origin, robots.status === 200 ? robots.body : "");
    }
    if (!robotsAllows(checked.get(url.origin), url.href)) throw new Error("robots.txt disallows automatic reading of this URL");
    const response = await transport(url.href);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.headers.location) throw new Error("Redirect without location");
      url = sourceUrl(new URL(response.headers.location, url).href);
      continue;
    }
    if (response.status !== 200) throw new Error(`HTTP ${response.status}; no login or challenge bypass attempted`);
    const contentType = response.headers["content-type"] ?? "";
    if (!/(text\/html|application\/xhtml\+xml)/i.test(contentType)) throw new Error("Only HTML metadata is read; use an appropriate paper/API reader for this resource");
    const metadata = extractMetadata(response.body, url.href);
    if (metadata.noindex || /noindex|none/i.test(response.headers["x-robots-tag"] ?? "")) throw new Error("Page requests noindex; metadata was not retained");
    if (!metadata.title) throw new Error("No usable page title; browser assistance required");
    return metadata;
  }
  throw new Error("Too many redirects");
}
