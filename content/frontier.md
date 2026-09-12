# Frontier：近期前沿与讨论

## 目标

把“最新”拆成可核验的研究信号，而不是把社交热度当成论文质量。该板块只负责跨主题发现；已经进入 WAM 等专题的内容由相应项目站继续维护。

## 一级目录

1. **论文雷达**：arXiv、顶会、顶刊、机构技术报告。
2. **研究者与访谈**：研究议程、方法判断、实验经验。
3. **社区讨论**：微信公众号、小红书、博客、播客与公开视频。
4. **开源动态**：新仓库、Release、权重、数据集与复现报告。
5. **每周变化**：本周新增了什么证据，哪些判断需要修订。

## 首批数据字段

- `title`、`source_url`、`source_type`、`authors`
- `published_at`、`fetched_at`、`topic`
- `evidence_level`：论文 / 官方项目 / 访谈 / 社区线索
- `status`：inbox / candidate / verified / reviewed
- `hotness` 与 `long_term_value` 分开记录
- `linked_track`：应继续进入 WAM、Robotics、Hardware 或 Adjacent 的方向

## 接入顺序

1. arXiv API 与公开 Feed。
2. GitHub API、Release 和 RSS。
3. 普通网站单 URL。
4. 微信公众号、小红书单链接浏览器辅助读取。

不批量绕过登录、验证码或平台限制；公开页面只保留原创摘要、少量必要摘录与原链接。

## 第一轮验收

- 有统一候选卡 schema。
- 同一成果的 arXiv、会议、代码和项目页能关联。
- 每日任务只产生候选，不直接发布人工结论。
- 每条记录能说明“为什么值得继续看”。
