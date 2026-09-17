// Shared by the browser and Node tests. Ranking means text relevance, never quality.
export const typeLabels = {
  article: "知识正文", guide: "领域卡片", paper: "论文候选", benchmark: "Benchmark / 数据集",
  experiment: "实验协议", node: "知识节点", source: "来源入口", work: "论文身份",
  price: "价格快照", venue: "会议入口"
};
export const trackLabels = { frontier: "Frontier", wam: "WAM 相关", robotics: "Robotics", hardware: "Hardware", adjacent: "Adjacent", lab: "Lab" };
const normalize = (value) => String(value ?? "").normalize("NFKC").toLowerCase();
const aliases = [
  ["阻抗", "impedance"], ["导纳", "admittance"], ["世界模型", "world model"],
  ["视觉语言动作", "vision language action", "vla"], ["状态估计", "state estimation"],
  ["模型预测控制", "mpc", "model predictive control"], ["因子图", "factor graph"],
  ["机械臂", "manipulator"], ["里程计", "odometry"], ["灵巧手", "dexterous hand"]
];

export function queryGroups(query) {
  const normalized = normalize(query).trim();
  const exactAlias = aliases.find((group) => group.includes(normalized));
  if (exactAlias) return [exactAlias];
  return normalized.split(/\s+/u).filter(Boolean).slice(0, 16).map((term) => aliases.find((group) => group.includes(term)) ?? [term]);
}

export function searchRecords(records, { q = "", track = "all", type = "all" } = {}) {
  const groups = queryGroups(q);
  const ranked = [];
  for (const record of records) {
    if (track !== "all" && !record.tracks.includes(track)) continue;
    if (type !== "all" && record.type !== type) continue;
    const title = normalize(record.title);
    const summary = normalize(record.summary);
    const body = normalize(record.text);
    if (!groups.every((group) => group.some((term) => `${title} ${summary} ${body}`.includes(term)))) continue;
    const score = groups.reduce((sum, group) => sum + Math.max(...group.map((term) => title.includes(term) ? 12 : summary.includes(term) ? 5 : 1)), 0);
    ranked.push({ record, score });
  }
  return ranked.sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title, "zh-CN") || a.record.id.localeCompare(b.record.id)).map(({ record }) => record);
}

export function excerpt(record, query, length = 220) {
  const terms = queryGroups(query).flat();
  const text = record.text || record.summary;
  const lower = normalize(text);
  const positions = terms.map((term) => lower.indexOf(term)).filter((position) => position >= 0);
  // Normalization may change character lengths; offsets only select an approximate context.
  const start = positions.length ? Math.max(0, Math.min(...positions) - 55) : 0;
  return `${start ? "…" : ""}${text.slice(start, start + length)}${text.length > start + length ? "…" : ""}`;
}

export function freshness(date, now = new Date(), maxDays = 90) {
  const timestamp = date ? Date.parse(date) : NaN;
  if (!Number.isFinite(timestamp)) return { state: "unknown", days: null };
  const days = Math.floor((now.getTime() - timestamp) / 86400000);
  if (days < 0) return { state: "future", days };
  return { state: days > maxDays ? "stale" : "within-window", days };
}
