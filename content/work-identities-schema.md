# Work identity registry

`content/work-identities.json` 解决“同一成果有多个网页身份”的问题。一个 work 可以同时连接 arXiv、OpenReview forum、会议论文集、DOI、项目页、官方代码和模型，但不会因为标题相似就自动合并。

## 关键规则

- `id` 是 Atlas 内部稳定 ID，不随标题或出版状态变化。
- `identifiers.arxiv`、`doi`、`openreview` 分栏存储；未知值保持 `null`。
- arXiv 记录的 DataCite DOI 只代表 arXiv 对象，不冒充同行评审 venue DOI。
- `identity_state` 目前使用 `arxiv-only`、`project-linked`、`venue-linked`、`fully-linked`。
- `links.code` 只登记作者或项目明确指向的官方仓库；社区复现另建 implementation 关系。
- 自动任务可以提出合并候选，最终合并至少需要作者重叠和一手来源互链之一。

## 发布

构建脚本将源数据原样发布到 `site/data/work-identities.json`，前端页位于 `/atlas/frontier/works/`。
