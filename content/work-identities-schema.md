# Work identity registry

`content/work-identities.json` 解决“同一成果有多个网页身份”的问题。一个 work 可以同时连接 arXiv、OpenReview forum、会议论文集、DOI、项目页、官方代码和模型，但不会因为标题相似就自动合并。

## 关键规则

- `id` 是 Atlas 内部稳定 ID，不随标题或出版状态变化。
- `identifiers.arxiv`、`doi`、`openreview` 分栏存储；未知值保持 `null`。
- arXiv 记录的 DataCite DOI 只代表 arXiv 对象，不冒充同行评审 venue DOI。
- `identity_state` 目前使用 `arxiv-only`、`project-linked`、`venue-linked`、`fully-linked`。
- `links.code` 只登记作者或项目明确指向的官方仓库；社区复现另建 implementation 关系。
- 自动任务可以提出合并候选，最终合并至少需要作者重叠和一手来源互链之一。

## 确定性候选匹配

`scripts/match-work-identities.mjs` 只做候选匹配，不直接改写身份表：

- arXiv、DOI 或 OpenReview 标识符精确相同、没有冲突且只对应一个成果时，允许输出 `auto-link`；它仍只是匹配建议，不会改写注册表或证明论文质量。
- 标识符也可从 arXiv abs/pdf、DOI、OpenReview forum/pdf 论文链接提取。arXiv 版本归到同一 work，OpenReview 不折叠 ID 大小写。一般 URL 保留身份查询参数、路径大小写与锚点，只删除明确追踪参数。
- 候选 URL 与登记的一手项目页、官方代码、模型或出版页相同，但没有可确认的唯一论文 ID 时，只输出 `review`：一个项目/仓库可能服务多篇论文。
- 同种标识符冲突、显式 ID 与页面 URL 冲突、标识符格式错误、重复注册或多个身份命中，都阻止自动选择。
- 只有标题、作者和年份组合相符时，只输出 `review`，必须人工或一手互链确认。
- 标题相似但作者证据缺失时保持 `unmatched`。

CLI 输出版本为 `0.2.0`。仅 `auto-link` 的顶层 `work_id` 非空；`review` 将候选及证据保存在 `alternatives`，`requires_review=true`。`ambiguous` 表示多候选或身份冲突；排序只为了稳定显示，不能作为选择理由。`unmatched` 的顶层 ID 也为空。每项证据包含精确 ID 类型、冲突/无效 ID 类型、URL、标题相似度、作者重叠与年份差。

这些规则由 `tests/work-identity-matcher.test.mjs` 验证，包括输入顺序不改变歧义结果、共用代码库、大小写和查询参数、ID 冲突、缺失年份与遗留 arXiv 编号。

```powershell
node scripts/match-work-identities.mjs site/data/frontier-archive.json content/work-identities.json
```

这是只读诊断；不会联网核验 ID 是否实际存在，也不会据此自动补全作者、会议、DOI 或论文结论。OpenReview 的 ID 可能对应评论等 Note 对象，使用前仍须核对是否是目标投稿，而非把任何 Note 当论文。

格式参考：[arXiv identifier](https://info.arxiv.org/help/arxiv_identifier.html)、[OpenReview Note](https://docs.openreview.net/reference/api-v2/entities/note)。

## 发布

构建脚本将源数据原样发布到 `site/data/work-identities.json`，前端页位于 `/atlas/frontier/works/`。
