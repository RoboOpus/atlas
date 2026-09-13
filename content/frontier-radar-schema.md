# Frontier arXiv 候选雷达规范

`site/data/frontier-papers.json` 是跨主题发现池，不是论文排行榜，也不是已核验知识页。WAM 专题数据继续由 `RoboOpus/wam` 维护；Atlas 只保留跨板块发现和路由信息。

## 自动流程

1. 每天北京时间 08:20 对 arXiv 官方 API 发起一次查询。
2. 覆盖 `cs.RO`、`eess.SY`，并从 `cs.AI`、`cs.CV`、`cs.LG` 中筛选机器人、具身、操作和自主系统相关记录。
3. 按 arXiv ID 去重，保留历史人工状态和编辑备注。
4. 根据标题、摘要、分类和新近程度计算 `triageScore`，并路由到 WAM、Robotics、Hardware 或 Adjacent。
5. 只有数据变化时才提交；部署由 Atlas 现有 Pages 工作流完成。

主查询持续限流或暂时不可用时，任务等待至少三秒后读取官方 `cs.RO` RSS。RSS 在周末通常没有条目，此时保留旧候选池并正常结束。

## 字段边界

- `triageScore` 只表示元数据路由相关度，不表示质量、正确性、录用、引用或可复现性。
- `matchedTopics` 是规则命中，不是模型生成的论文结论。
- `routes` 是建议的后续板块，可以多选。
- 自动流程只能创建 `candidate`；`verified`、`reviewed` 必须由人工核对论文版本、项目页、代码和实验口径。
- 保存标题、摘要、作者、分类、标识符和链接等描述性元数据，不镜像 PDF 或源码。

## 失败保护

- arXiv 返回空结果时拒绝覆盖旧候选池。
- 请求使用单连接、显式 User-Agent、超时与指数退避。
- GitHub Actions 可延迟，且公共仓库长期无活动时定时任务可能停用；保留 `workflow_dispatch` 手动入口。
