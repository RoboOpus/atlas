# 按要求找论文，再选择收录

更新：2026-09-18。按需检索与每日雷达相互独立；目前实现 arXiv 元数据检索，不是通用网页爬虫或论文质量评审。

## 给助手的指令

可以直接提出公开研究问题，例如：

> 找近一个月与机器人接触操作有关的世界模型论文，先给我最多 10 篇候选，说明筛选依据。

> 找 Ha 和 Schmidhuber 的经典 World Models，放入 WAM 候选库。

助手需要将意图转成明确的关键词、日期、板块与排序，执行检索，检查返回条目，再选择相关 ID 收录。含混的“高质量”不是 API 字段：相关性排序、引用量、会议名称和作者声明都不能直接当作质量结论。需要质量判断时，应另做来源核对并说明评价依据。

网站的统一检索只搜索已经公开收录的内容；GitHub Pages 没有接收私密检索指令的后端。未收录的内容通过本地助手/命令行检索，而不是在网页上放一个不会工作的提交按钮。

## 实际流程

1. **检索**：向官方 arXiv API 发出一条查询，返回一页结果并保存为本地私密记录。
2. **查看与选择**：检查标题、作者、版本日期和摘要，明确指定需要的 arXiv ID。不选的条目不进入公开库。
3. **预览公开内容**：仅保留论文元数据、选入时间和目标板块，不包含检索词、私人备注、缓存路径或本地运行 ID。
4. **导出候选批次**：显式 `--public` 写入 `content/paper-selections/`，此时只是本地导出，还没有发布网站。
5. **验证和发布**：构建与测试通过、检查变更后提交到 RoboOpus/atlas。网站归档、发现记录和统一检索随部署更新。

```powershell
# 在 atlas 目录执行。外层单引号保留 arXiv 查询中的双引号。
npm run papers:search -- run '--query=ti:"World Models"' --track=wam --limit=5
npm run papers:search -- list
npm run papers:search -- show --run=search-返回的运行ID
npm run papers:search -- preview --run=search-返回的运行ID --ids=1803.10122
npm run papers:search -- publish --run=search-返回的运行ID --ids=1803.10122 --public
npm run build
npm test
```

按日期检索的参数示例：

```powershell
npm run papers:search -- run '--query=(all:"world model" OR all:"world models") AND cat:cs.RO' --track=robotics --since=2026-08-18 --until=2026-09-18 --sort=submittedDate --limit=10
```

日期过滤使用 arXiv 的 **首次提交日期与 GMT/UTC 日界**，不是本站收录时间，也不是北京时间日界。未指定日期则不加日期限制。`--sort=lastUpdatedDate` 按更新时间排序，但不会将首次提交日期过滤改为更新时间过滤。

| 参数 | 含义与边界 |
| --- | --- |
| `--query` | 必填；arXiv 查询语法，最多 1000 字符 |
| `--track` | frontier / wam / robotics / hardware / adjacent；默认 frontier，不支持私密 Lab 查询 |
| `--limit` | 单页 1–100 条，默认 10 |
| `--start` | 从第几条开始，0–1000，默认 0；继续翻页须另开一次运行 |
| `--sort` | relevance（默认）/ submittedDate / lastUpdatedDate；降序，均非质量排序 |
| `--since`、`--until` | 可选 YYYY-MM-DD 首次提交日期范围，包含边界日 |
| `--ids` | 从对应成功运行中显式选择 ID，以逗号分隔；不接受结果之外的 ID |

## 隐私、版权与可靠性

- `private-cache/paper-search/` 已被 Git 忽略，但只是本地文件，不是加密保险箱；系统备份或同步软件仍可能同步它。
- **查询会发送给 arXiv**。私密 idea、未公开项目细节、凭据不要放进查询。私密是指不发布到本站，不是从未离开本机。
- 公开批次采用字段白名单。摘要属于作者元数据，不是本站独立核验结论；不下载、不镜像论文 PDF 或正文。
- arXiv API 元数据的使用及论文全文许可是不同事项，参见 [API 使用条款](https://info.arxiv.org/help/api/tou.html)。
- 使用固定 HTTPS 官方 API、单连接和至少 3 秒冷却。此 CLI 的锁只协调本地此入口，不能协调其他机器、每日采集器或其他 arXiv 客户端；操作者应避免同时运行它们。
- 30 秒请求超时、4 MiB 响应上限；HTTP 错误、API 错误条目、缺少关键字段或不完整 Atom 都记录失败，不用 RSS 或无关查询冒充成功。
- 空结果记录 `empty`，请求失败记录 `failed`；两者都不能导出公开候选。`--input-file` 仅供隔离测试，标记 `fixture`，禁止公开导出。
- 目前仅支持 2007 年后形式的现代 arXiv ID（如 `1803.10122`）。遇到旧式 ID 会明确报错，不静默略去；旧式论文可走已有单链接笔记流程。
- 单页和 API 总命中数都不代表领域覆盖率。查询语法、分词和相关性需要检查；更改查询或翻页是新的运行，不声称已经穷尽文献。
- API 查询与 Atom 字段参考 [官方手册](https://info.arxiv.org/help/api/user-manual.html)。

## 与每日生长的关系

每日采集继续维护 `content/frontier-archive.json`、`content/frontier-events.json` 与有限雷达窗口。按需检索不更改这些源文件或每日查询配置。

构建阶段将追加式选入批次与每日归档合并：相同 arXiv ID 去重，保留较新 API 元数据、较早首次收录时间以及已有编辑状态/备注，并加入明确选择的板块。新选入条目只记为 `candidate`，无自动加分，不升级为已审核。

发现页将此类事件标为 **按需选入候选**，不冒充新发表论文或每日新发现。`last_success_at` 仍表示每日采集成功时间；按需选入时间位于批次事件中。选入的经典论文即使不符合近期雷达条件，也能在历史归档与统一检索中找到。

重复导出同板块、同元数据的论文不会再创建批次。批次文件受 Git 追踪，可审计但不是防篡改存储；需要修订时必须检查差异，不把本地 `source_mode` 标签当成不可伪造的来源证明。

## 首次真实验收

2026-09-18 实际调用官方 API，成功返回 5 条候选，仅选入 Ha 与 Schmidhuber 的 **World Models（1803.10122，API 返回 v4）**。其余结果保留本地，没有自动发布。

这是检索与选择收录流程的真实样例，不是新增精读或实验复现。WAM 已有论文目录条目与 Atlas 新增候选具有不同用途，联合检索保留两种证据层，不合并成同一份“已审核正文”。
