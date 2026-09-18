# RoboOpus Atlas

RoboOpus 具身智能与机器人知识库的总入口与跨项目治理仓库。

目标项目站：<https://roboopus.github.io/atlas/>

## 当前范围

- 在 `/atlas/search/` 联合检索 Atlas 十一类公开资料与 WAM 论文目录、两篇原创正文、地图、Benchmark 和雷达；支持来源站筛选、候选去重与加载失败提示。详见 [联合检索说明](planning/FEDERATED_SEARCH.md)。
- 在 `/atlas/inbox/` 生成本地单链接收录请求；`npm run inbox` 提供导入、元数据读取、原创笔记整理、预览与显式公开导出流程。
- 在 `/atlas/reading/` 阅读来源笔记；笔记接入统一检索，并区分来源陈述、编辑推断与社区观点。详见 [收件箱操作说明](planning/INBOX_WORKFLOW.md)。
- 在 `/atlas/maintenance/` 查看覆盖缺口、待人工复核正文、价格重查提醒、采集快照日期与尚未启用任务。
- 在 `/atlas/frontier/changes/` 查看 arXiv 持久归档与逐批发现记录。雷达上限仅限制展示，历史候选仍可统一检索。
- 完整项目的已实现/待实现/缺少输入边界记录在 [项目完成度](planning/PROJECT_COMPLETION.md)。
- 汇总 WAM、Frontier、Robotics、Hardware、Adjacent、Lab 六条建设线。
- 保存各板块的一级知识树和首批字段规范。
- 在 `/atlas/catalog/` 发布可搜索、可筛选的非 WAM 一级目录。
- 在 `/atlas/sources/` 发布可搜索、可筛选的可信来源注册表。
- 在 `/atlas/pipeline/` 发布来源到知识节点的跨板块采集任务清单。
- 在 `/atlas/frontier/` 发布跨主题 arXiv 候选雷达，并把候选路由到 WAM、Robotics、Hardware、Adjacent。
- 在 `/atlas/frontier/venues/` 发布顶会采集与公开状态表；OpenReview Group 可访问和论文可抓取分开记录。
- 在 `/atlas/frontier/works/` 发布论文身份表，把 arXiv、会议论文集、项目页、官方代码与模型归一到同一成果。
- 在 `/atlas/robotics/`、`/atlas/hardware/`、`/atlas/adjacent/` 发布三张可筛选领域地图。
- 在 `/atlas/robotics/benchmarks/` 发布机器人 Benchmark 与数据集注册表，优先对齐协议、指标、版本与许可，不制作跨任务总排名。
- 在 `/atlas/robotics/control-lab/` 发布可筛选控制实验台账，区分“协议已定义”和“实验已完成”。
- 在 `/atlas/knowledge/` 发布由 Markdown 自动生成的来源核对知识正文与详情页。
- 发布机器可读的 `site/data/atlas.json`。
- 发布 64 个种子节点组成的 `site/data/catalog.json`。
- 发布 73 个来源入口组成的 `site/data/sources.json`，标明第一方/线索源、接入方式与使用边界。
- 发布 19 个采集任务组成的 `site/data/ingestion-jobs.json`。
- 发布 50 个结构化入口组成的 `site/data/field-guides.json`，连接知识节点与一手来源。
- 已发布 16 篇知识正文，覆盖机器人基础、硬件选型与跨领域实验设计；每篇标明来源、关联节点、编辑状态和是否经过人工复核。
- 6 条首批硬件价格快照以追加式 JSON 保存，价格与地区、币种、税运费、库存和日期绑定。
- 首批论文身份以 `content/work-identities.json` 保存；确定性匹配器仅对唯一、无冲突的精确论文标识符建议自动连接，共享项目/代码链接、身份冲突及标题近似进入复核。
- 3 个控制实验协议以 `content/control-experiments.json` 保存，真机实验必须经过显式安全复核。
- 12 条 Benchmark / 数据集记录以 `content/benchmark-registry.json` 保存，覆盖 RoboDojo、LIBERO、CALVIN、RoboCasa365、ManiSkill、RoboTwin 2.0、BEHAVIOR-1K、Meta-World、Habitat-Lab、DROID、Open X-Embodiment 与 BridgeData V2。
- 每天北京时间 08:20 运行 Frontier arXiv 发现任务；自动化只能创建 `candidate`，不能发布人工结论。
- 每周一北京时间 08:45 刷新 OpenReview 重点会议元数据；ICRA、IROS 等非 OpenReview 主会保留官网/出版入口流程。
- 不在这里复制各专题的全部内容；专题稳定后进入各自普通仓库和 GitHub Pages 项目站。

## 本地运行

```powershell
npm run dev
```

打开 <http://localhost:3001/atlas/>。

## 校验

```powershell
npm run build
npm test
```

统一检索与维护 JSON 是忽略 Git 的构建产物；本地开发前先执行 build。定时刷新与正式发布也会重建它们。搜索在浏览器本地匹配，不接第三方搜索服务；查询会保存在 URL 中，分享或重新打开链接时会随请求发送给站点，请勿输入私密内容。

## 候选归档与发现记录

`content/frontier-archive.json` 和 `content/frontier-events.json` 是受 Git 追踪的持久源数据。构建时发布对应 JSON 镜像，并把全部归档接到统一检索；`site/data/frontier-papers.json` 只保留配置上限内的排序窗口。

- 首次导入旧雷达记为 baseline，不伪装成新发现；此前已被窗口截断的数据不能凭空恢复。
- 同一 arXiv ID 去重，保留 firstSeen、编辑状态与备注；新条目强制 candidate。
- 分数随时间重新计算，但单纯排名变化不会被记为科研内容更新。
- API 日期、RSS/列表公告日期分开；旧记录没有逐条来源证据时标为 legacy-unverified，等待 API 再核验。日期含义参考 [arXiv API 手册](https://info.arxiv.org/help/api/user-manual.html) 和 [RSS 说明](https://info.arxiv.org/help/rss.html)。
- 后备列表不抹掉已知摘要；旧 API 版本不能覆盖新版本元数据。
- 每次成功收录保存运行时间；事件只在新增或元数据变化时追加。空响应/请求失败不伪造成功收录。
- 自动工作流同时提交雷达、归档和事件源文件，构建派生索引后再部署。

## 仓库边界

- 只允许写入 `RoboOpus/atlas` 及用户明确授权的其他 `RoboOpus` 仓库。
- 不创建、不修改、不部署 `RoboOpus/RoboOpus.github.io`。
- 不操作用户的其他仓库或组织。
- 所有网站使用 `https://roboopus.github.io/<repository>/` 项目站。
