# 顶会状态注册表

`content/venue-registry.json` 保存重点会议周期、采集系统和公开可见性；构建时复制到 `site/data/venue-registry.json`。它是“去哪里查、现在能抓到什么”的状态表，不是会议质量排行榜。

## 关键字段

| 字段 | 含义 |
|---|---|
| `id` / `family` / `cycle` | 稳定周期标识、会议系列与年份 |
| `domain` / `relevance_routes` | 领域及应路由到的知识板块 |
| `capture_mode` | `openreview-api-v2` 或 `official-site` |
| `group_id` / `group_url` | OpenReview 周期 Group；非 OpenReview 来源保持 `null` |
| `venue_url` | 官方会议主页 |
| `submissions_public` | OpenReview 明示的公开投稿开关；其他系统为 `null` |
| `paper_ingestion` | `ready-public-submissions`、`metadata-only` 或 `manual-proceedings` |
| `fetch_state` / `checked_at` | 本次抓取状态与 UTC 核验时间 |

## 编辑边界

1. “Group 可访问”不等于“论文公开”，两者必须分字段。
2. OpenReview 的 API 版本按 venue 核验；本表首批只自动刷新 API v2 Group 元数据。
3. ICRA、IROS 等未配置 OpenReview 主会 Group 的会议走官网、程序和出版入口，不能伪装成自动投稿流。
4. 会议日期、地点、公开性会变化；页面显示 `checked_at`，旧快照不得覆盖成无时间戳结论。
5. 自动化只产生状态与候选，不生成录用、质量或长期价值判断。
