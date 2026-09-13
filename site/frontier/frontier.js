const routeLabels = { wam: "WAM", robotics: "Robotics", hardware: "Hardware", adjacent: "Adjacent" };
const routeUrls = {
  wam: "https://roboopus.github.io/wam/",
  robotics: "/atlas/catalog/?track=robotics",
  hardware: "/atlas/catalog/?track=hardware",
  adjacent: "/atlas/catalog/?track=adjacent"
};

const grid = document.querySelector("#paper-grid");
const empty = document.querySelector("#paper-empty");
const count = document.querySelector("#result-count");
const total = document.querySelector("#paper-total");
const generatedAt = document.querySelector("#generated-at");
const search = document.querySelector("#paper-search");
const buttons = [...document.querySelectorAll("[data-route]")];
const query = new URLSearchParams(location.search);
let activeRoute = routeLabels[query.get("route")] ? query.get("route") : "all";
let papers = [];

function createText(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function compactAuthors(authors) {
  if (authors.length <= 4) return authors.join(" · ");
  return `${authors.slice(0, 4).join(" · ")} 等 ${authors.length} 位作者`;
}

function compactAbstract(value) {
  if (value.length <= 360) return value;
  return `${value.slice(0, 357).trimEnd()}…`;
}

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "日期未知" : date.toISOString().slice(0, 10);
}

function render() {
  const needle = search.value.trim().toLocaleLowerCase("zh-CN");
  const filtered = papers.filter((paper) => {
    const inRoute = activeRoute === "all" || paper.routes.includes(activeRoute);
    const haystack = [paper.id, paper.title, ...paper.authors, ...paper.categories, ...paper.matchedTopics.map((topic) => topic.label)].join(" ").toLocaleLowerCase("zh-CN");
    return inRoute && (!needle || haystack.includes(needle));
  });

  grid.replaceChildren();
  for (const paper of filtered) {
    const card = document.createElement("article");
    card.className = "paper-card";

    const top = document.createElement("div");
    top.className = "paper-top";
    top.append(
      createText("span", "", `${paper.primaryCategory} · ${dateLabel(paper.published)}`),
      createText("span", "paper-score", `路由相关度 ${paper.triageScore}`)
    );
    card.append(top);
    card.append(createText("h2", "", paper.title));
    card.append(createText("p", "paper-authors", compactAuthors(paper.authors)));
    card.append(createText("p", "paper-abstract", compactAbstract(paper.abstract)));

    card.append(createText("p", "paper-label", "建议路由"));
    const routes = document.createElement("div");
    routes.className = "paper-tags";
    for (const route of paper.routes) {
      const link = createText("a", "", routeLabels[route] || route);
      link.href = routeUrls[route] || "/atlas/catalog/";
      routes.append(link);
    }
    card.append(routes);

    card.append(createText("p", "paper-label", "元数据命中"));
    const topics = document.createElement("div");
    topics.className = "paper-tags";
    for (const topic of paper.matchedTopics) topics.append(createText("span", "", topic.label));
    card.append(topics);

    const actions = document.createElement("div");
    actions.className = "paper-actions";
    const abstractLink = createText("a", "", "arXiv 摘要 ↗");
    abstractLink.href = paper.url;
    abstractLink.target = "_blank";
    abstractLink.rel = "noreferrer";
    const pdfLink = createText("a", "", "PDF ↗");
    pdfLink.href = paper.pdfUrl;
    pdfLink.target = "_blank";
    pdfLink.rel = "noreferrer";
    actions.append(abstractLink, pdfLink);
    card.append(actions);
    grid.append(card);
  }

  count.textContent = `${filtered.length} / ${papers.length} 篇候选`;
  empty.hidden = filtered.length !== 0;
  buttons.forEach((button) => button.classList.toggle("active", button.dataset.route === activeRoute));
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    activeRoute = button.dataset.route;
    const nextQuery = new URLSearchParams(location.search);
    if (activeRoute === "all") nextQuery.delete("route");
    else nextQuery.set("route", activeRoute);
    history.replaceState(null, "", `${location.pathname}${nextQuery.size ? `?${nextQuery}` : ""}`);
    render();
  });
});

search.addEventListener("input", render);

fetch("/atlas/data/frontier-papers.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    papers = data.papers;
    total.textContent = String(papers.length);
    generatedAt.textContent = data.generated_at ? dateLabel(data.generated_at) : "等待首次成功运行";
    render();
  })
  .catch(() => {
    count.textContent = "候选池加载失败";
    total.textContent = "—";
    generatedAt.textContent = "读取失败";
    empty.hidden = false;
    empty.querySelector("strong").textContent = "暂时无法读取候选池";
    empty.querySelector("p").textContent = "请稍后刷新页面。";
  });
