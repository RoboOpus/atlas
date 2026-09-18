const make = (tag, text, className) => { const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item; };
try {
  const response = await fetch("/atlas/data/reading-notes.json"); if (!response.ok) throw new Error("Unable to read notes");
  const data = await response.json();
  document.querySelector("#reading-status").textContent = `${data.notes.length} 篇公开来源笔记 · 全部保留草稿状态`;
  for (const note of [...data.notes].sort((a, b) => b.checked_at.localeCompare(a.checked_at) || a.id.localeCompare(b.id))) {
    const card = make("article", "", "search-result"), title = make("h2", ""), link = make("a", note.title); link.href = note.url; title.append(link);
    card.append(make("p", `${note.track} · ${note.source_type} · 核对 ${note.checked_at}`, "result-meta"), title, make("p", note.summary, "result-summary"), make("p", `${note.claims.length} 条证据关联主张 · 未经人工终审`, "evidence-label"));
    document.querySelector("#reading-notes").append(card);
  }
} catch { document.querySelector("#reading-status").textContent = "来源笔记加载失败，请刷新重试。"; }
