const make = (tag, text, className) => { const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item; };
const get = async (url) => { const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); };
try {
  const [archive, ledger, windowData] = await Promise.all([get("/atlas/data/frontier-archive.json"), get("/atlas/data/frontier-events.json"), get("/atlas/data/frontier-papers.json")]);
  const papers = new Map(archive.papers.map((paper) => [paper.id, paper]));
  const events = [...ledger.events].reverse();
  let limit = 20;
  document.querySelector("#changes-status").textContent = `历史归档 ${papers.size} 篇 · 雷达展示 ${windowData.papers.length} 篇 · ${events.length} 批记录 · ${archive.last_success_at ? `最近自动采集 ${archive.last_success_at}` : "归档已初始化，等待新版采集器首次成功运行"}`;
  function render() {
    const grid = document.querySelector("#changes"); grid.replaceChildren();
    for (const event of events.slice(0, limit)) {
      const card = make("article", "", "search-result");
      card.append(make("p", event.at, "result-meta"), make("h2", event.kind === "baseline" ? `已有数据基线 · ${event.baseline_ids.length} 篇` : event.kind === "selection" ? `按需选入候选 · ${event.selected.length} 篇` : `新收录 ${event.added.length} 篇 · 元数据更新 ${event.updated.length} 篇`));
      if (event.note) card.append(make("p", event.note, "result-summary"));
      if (event.source) card.append(make("p", `采集方式：${event.source.mode} · 查询：${event.source.query}`, "scope-note"));
      for (const [label, ids] of [["基线", event.baseline_ids ?? []], ["新收录", event.added], ["元数据更新", event.updated], ["按需选入", event.selected ?? []]]) {
        if (!ids.length) continue;
        const details = make("details", ""); details.append(make("summary", `${label} · ${ids.length} 篇`));
        const list = make("ul", "");
        for (const id of ids) { const li = make("li", ""); const a = make("a", papers.get(id)?.title ?? id); a.href = `/atlas/search/?type=paper&q=${encodeURIComponent(id)}`; li.append(a); list.append(li); }
        details.append(list); card.append(details);
      }
      grid.append(card);
    }
    document.querySelector("#more-events").hidden = events.length <= limit;
  }
  document.querySelector("#more-events").addEventListener("click", () => { limit += 20; render(); });
  render();
} catch { document.querySelector("#changes-status").textContent = "归档加载失败，请刷新重试；数据缺失不表示今日没有变化。"; }
