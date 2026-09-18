// Public, read-only federation. Neither search terms nor private inbox data are sent.
export const WAM_INDEX_URL = "https://roboopus.github.io/wam/data/search-index.json";
const supported = new Set(["article", "publication", "guide", "benchmark", "paper"]);
const bounded = (value, max) => typeof value === "string" && value.length <= max;
export function validateWamIndex(data) {
  if (data?.schema_version !== "1.0.0" || data.producer !== "RoboOpus/wam" || !Array.isArray(data.records) || data.records.length > 5000) throw new Error("Unsupported WAM index");
  if (!Number.isFinite(Date.parse(data.generated_at)) || !/^[a-f0-9]{40}$/.test(data.source_revision)) throw new Error("Missing WAM provenance");
  const seen = new Set();
  const records = data.records.map((item) => {
    if (!/^wam:[a-z]+:[A-Za-z0-9._-]+$/.test(item.id) || seen.has(item.id)) throw new Error("Invalid WAM identity");
    seen.add(item.id);
    if (!supported.has(item.type) || !bounded(item.title, 1000) || !item.title.trim() || !bounded(item.summary, 5000) || !bounded(item.text, 120000) || !bounded(item.evidence, 2000)) throw new Error("Invalid WAM content");
    if (!Array.isArray(item.tracks) || item.tracks.length !== 1 || item.tracks[0] !== "wam") throw new Error("Invalid WAM scope");
    const url = new URL(item.url);
    if (url.origin !== "https://roboopus.github.io" || !url.pathname.startsWith("/wam/") || url.username || url.password) throw new Error("WAM link outside project");
    if (item.updated_at !== null && !Number.isFinite(Date.parse(item.updated_at))) throw new Error("Invalid record date");
    const arxiv = item.identifiers?.arxiv ?? null;
    if (arxiv !== null && !/^\d{4}\.\d{4,5}$/.test(arxiv)) throw new Error("Invalid arXiv identity");
    // Allowlist rather than propagating unknown fields from another repository.
    return { id: item.id, type: item.type, title: item.title, summary: item.summary, text: item.text,
      tracks: ["wam"], url: url.href, updated_at: item.updated_at,
      date_label: bounded(item.date_label, 60) ? item.date_label : "来源记录",
      evidence: `WAM 来源记录 · ${item.evidence}`, identifiers: { arxiv }, origins: ["wam"],
      source_repository: "RoboOpus/wam", alternate_sources: [] };
  });
  return { records, generated_at: data.generated_at, source_revision: data.source_revision };
}

export async function loadWamIndex(fetcher = globalThis.fetch, timeoutMs = 8000) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("WAM index timeout")); }, timeoutMs); });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetcher(WAM_INDEX_URL, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", cache: "no-cache" });
      if (!response.ok) throw new Error(`WAM HTTP ${response.status}`);
      if (!/application\/json/i.test(response.headers.get("content-type") ?? "")) throw new Error("WAM index is not JSON");
      const bytes = Number(response.headers.get("content-length"));
      if (bytes > 4 * 1024 * 1024) throw new Error("WAM index too large");
      const reader = response.body.getReader();
      const chunks = []; let total = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          total += value.byteLength;
          if (total > 4 * 1024 * 1024) { await reader.cancel(); throw new Error("WAM index too large"); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const all = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
      return validateWamIndex(JSON.parse(new TextDecoder().decode(all)));
    })()]);
  } finally { clearTimeout(timer); }
}

function candidateIdentity(record) {
  if (record.type !== "paper") return null;
  if (record.identifiers?.arxiv) return record.identifiers.arxiv;
  try {
    const url = new URL(record.url);
    if (url.hostname !== "arxiv.org") return null;
    return url.pathname.match(/^\/abs\/(\d{4}\.\d{4,5})(?:v\d+)?$/)?.[1] ?? null;
  } catch { return null; }
}

export function mergeIndexes(atlas, wam) {
  const merged = atlas.map((item) => ({ ...item, origins: ["atlas"], alternate_sources: [], source_repository: "RoboOpus/atlas" }));
  const candidates = new Map();
  for (const item of merged) { const id = candidateIdentity(item); if (id) candidates.set(id, item); }
  for (const item of wam) {
    const id = candidateIdentity(item), existing = id && candidates.get(id);
    if (existing) {
      existing.origins = [...new Set([...existing.origins, "wam"])];
      existing.tracks = [...new Set([...existing.tracks, ...item.tracks])];
      existing.alternate_sources.push({ title: "WAM 候选记录", url: item.url });
      existing.text += ` ${item.text}`;
      existing.evidence += " · WAM 也收录为候选；未升级证据等级";
    } else {
      const copy = { ...item, origins: ["wam"], alternate_sources: [...(item.alternate_sources ?? [])] };
      merged.push(copy); if (id) candidates.set(id, copy);
    }
  }
  return merged;
}
