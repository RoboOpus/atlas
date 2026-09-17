import { freshness, trackLabels } from "../search/engine.js";
const now = new Date();
function node(tag, text, className) { const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item; }
function link(text, url) { const item = node("a", text); item.href = url; if (url.startsWith("https://")) { item.target = "_blank"; item.rel = "noreferrer"; } return item; }
function age(date, days) {
  const result = freshness(date, now, days);
  const label = { unknown: "日期未知 · 需核验", future: "日期晚于当前时间 · 需核验", stale: `${result.days} 天前 · 建议重查`, "within-window": `${result.days} 天前 · 未触发提醒阈值` }[result.state];
  return node("span", label, result.state === "within-window" ? "" : "attention");
}
try {
  const response = await fetch("/atlas/data/maintenance.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  document.querySelector("#maintenance-status").textContent = `查看日期：${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "long" }).format(now)}（北京时间）。${data.policy}`;
  for (const record of data.coverage) {
    const card = node("article", "", "maintenance-card");
    card.append(node("h2", trackLabels[record.track]), node("p", `${record.nodes} 个目录节点 · ${record.guides} 张领域卡 · ${record.articles} 篇正文`), node("p", record.note));
    if (record.nodes_without_article.length) {
      const details = node("details", "");
      details.append(node("summary", `${record.nodes_without_article.length} 个节点尚未关联正文`));
      const list = node("ul", "");
      for (const item of record.nodes_without_article) { const li = node("li", ""); li.append(link(item.title, `/atlas/catalog/?track=${record.track}#${encodeURIComponent(item.id)}`)); list.append(li); }
      details.append(list); card.append(details);
    }
    document.querySelector("#coverage").append(card);
  }
  for (const record of data.feeds) {
    const li = node("li", ""); li.append(link(record.title, record.url), document.createTextNode(` · ${record.count} 条 · `), age(record.checked_at, record.threshold_days), node("small", `源快照时间：${record.checked_at ?? "未知"}${record.mode ? ` · 读取方式 ${record.mode}` : ""}`)); document.querySelector("#feeds").append(li);
  }
  for (const record of data.review_queue) {
    const li = node("li", ""); li.append(link(record.title, record.url), node("small", `${record.editorial_state} · 内容更新时间 ${record.updated_at}`)); document.querySelector("#reviews").append(li);
  }
  if (!data.review_queue.length) document.querySelector("#reviews").append(node("li", "当前没有待复核正文。"));
  for (const record of data.prices) {
    const li = node("li", ""); li.append(link(record.title, record.url), document.createTextNode(" · "), age(record.checked_at, 90), node("small", `价格快照日期：${record.checked_at}`)); document.querySelector("#prices").append(li);
  }
  for (const record of data.jobs.filter((item) => item.status !== "active")) {
    const li = node("li", ""); li.append(link(record.title, record.url), node("small", `${record.status} · ${record.next_action}`)); document.querySelector("#jobs").append(li);
  }
} catch { document.querySelector("#maintenance-status").textContent = "维护快照加载失败，请刷新重试；未加载的数据不代表已完成。"; }
