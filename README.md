# RoboOpus Atlas

RoboOpus 具身智能与机器人知识库的总入口与跨项目治理仓库。

目标项目站：<https://roboopus.github.io/atlas/>

## 当前范围

- 汇总 WAM、Frontier、Robotics、Hardware、Adjacent、Lab 六条建设线。
- 保存各板块的一级知识树和首批字段规范。
- 在 `/atlas/catalog/` 发布可搜索、可筛选的非 WAM 一级目录。
- 在 `/atlas/sources/` 发布可搜索、可筛选的可信来源注册表。
- 在 `/atlas/pipeline/` 发布来源到知识节点的跨板块采集任务清单。
- 在 `/atlas/frontier/` 发布跨主题 arXiv 候选雷达，并把候选路由到 WAM、Robotics、Hardware、Adjacent。
- 在 `/atlas/robotics/`、`/atlas/hardware/`、`/atlas/adjacent/` 发布三张可筛选领域地图。
- 在 `/atlas/knowledge/` 发布由 Markdown 自动生成的来源核对知识正文与详情页。
- 发布机器可读的 `site/data/atlas.json`。
- 发布 58 个种子节点组成的 `site/data/catalog.json`。
- 发布 48 个来源入口组成的 `site/data/sources.json`，标明第一方/线索源、接入方式与使用边界。
- 发布 18 个采集任务组成的 `site/data/ingestion-jobs.json`。
- 发布 34 个结构化入口组成的 `site/data/field-guides.json`，连接知识节点与一手来源。
- 已发布 15 篇知识正文，覆盖机器人基础、硬件选型与跨领域实验设计；每篇标明来源、关联节点、编辑状态和是否经过人工复核。
- 首批硬件价格快照以追加式 JSON 保存，价格与地区、币种、税运费、库存和日期绑定。
- 每天北京时间 08:20 运行 Frontier arXiv 发现任务；自动化只能创建 `candidate`，不能发布人工结论。
- 不在这里复制各专题的全部内容；专题稳定后进入各自普通仓库和 GitHub Pages 项目站。

## 本地运行

```powershell
npm run dev
```

打开 <http://localhost:3001/atlas/>。

## 校验

```powershell
npm run build
```

## 仓库边界

- 只允许写入 `RoboOpus/atlas` 及用户明确授权的其他 `RoboOpus` 仓库。
- 不创建、不修改、不部署 `RoboOpus/RoboOpus.github.io`。
- 不操作用户的其他仓库或组织。
- 所有网站使用 `https://roboopus.github.io/<repository>/` 项目站。
