# MilkySunlit-AIAgent 详细技术文档（DETAIL）

## 1. 文档目的

本文档用于系统化说明当前小程序聊天能力的技术实现，重点覆盖：

- 聊天链路总体架构
- Prompt 组装与 Memory 注入时机
- 现有 RAG MVP（检索增强）实现
- 数据源、权限模型与边界
- 配置、部署、调试、排障与优化建议

---

## 2. 系统总览

当前聊天系统主要由三部分构成：

1. 小程序页面层（chatBot 页面）
   - 负责初始化模型配置、拉取用户身份、构建 memory prompt
2. 小程序组件层（agent-ui 组件）
   - 负责消息发送、模型请求、工具调用、RAG 上下文检索和注入
3. 云函数层（adminAuth）
   - 负责身份鉴权、共享数据读写、RAG 候选检索与权限过滤

核心文件：

- `miniprogram/pages/chatBot/config.js`
- `miniprogram/pages/chatBot/chatBot.js`
- `miniprogram/components/agent-ui/index.js`
- `cloudfunctions/adminAuth/index.js`

---

## 3. 关键模块说明

## 3.1 `config.js`（固定知识 + 默认配置）

职责：

- 定义人物固定事实（`STATIC_LOCAL_FACTS`）
- 定义默认长期记忆（`DEFAULT_MEMORY_ITEMS`）
- 构建 `modelConfig`、`agentConfig`、页面初始数据

关键点：

- `STATIC_LOCAL_FACTS` 包含 family + people（孙励天、宋陶颖、孙星玥、秦天、山雪、王晓莉）
- `buildStructuredLocalFactsPrompt` 会把结构化人物信息拼成模型可读文本
- `buildStrictLocalNames` 从 aliases 生成“本地人物名白名单”
- 模型配置当前为 Azure OpenAI + GPT-5.4-mini

---

## 3.2 `chatBot.js`（页面初始化与 memory 聚合）

职责：

- 页面 onLoad / onShow 时初始化记忆
- 拉取 viewer identity
- 拉取 `chat_memory` +（按用户条件）共享日记
- 组装并下发给组件：
  - `modelConfig.memoryPrompt`
  - `modelConfig.localFactsPrompt`
  - `modelConfig.strictLocalNames`

关键时序：

1. `onLoad` -> `initMemoryPrompt()`（首次进入）
2. `onShow` -> 如果距离上次刷新超过 5 分钟（`MEMORY_PROMPT_TTL=300000`），再次 `initMemoryPrompt()`

缓存与限制：

- 共享日记本地缓存 1 小时（`DIARY_SYNC_TTL=3600000`）
- `chat_memory` 显式上限 `CHAT_MEMORY_LIMIT=40`（已新增，防止 prompt 线性膨胀）

---

## 3.3 `agent-ui/index.js`（消息主流程）

职责：

- 发送消息、组装 system messages、调用模型
- 注入共享记忆、本地记忆、本地事实、RAG 上下文
- 管理工具能力（日历/记账/菜谱）与兜底

核心流程（model 模式）：

1. 读取 `modelConfig`（含 memory/localFacts/strictNames）
2. 刷新共享概念记忆（`listSharedConceptMemories`，limit=20）
3. 触发 RAG 检索（`retrieveRagContext(query, 8)`）
4. 根据输入是否包含本地人物名，决定是否注入 `strictLocalGuard + localFacts`
5. 组装 `systemMessages + recentConversationMessages.slice(-6)`
6. 调用 Azure OpenAI `/chat/completions`

GPT-5 兼容：

- 若模型名匹配 `gpt-5`，请求参数使用 `max_completion_tokens`
- 其他模型使用 `max_tokens`

---

## 3.4 `adminAuth/index.js`（云端网关 + 数据服务）

职责：

- 统一 action 分发（鉴权、查询、写入）
- 用户身份映射与权限控制
- 共享数据集合读写
- RAG 检索候选构建与打分排序

新增 RAG 相关能力：

- `retrieveRagContext` action
- `normalizeRagLimit`、`normalizeRagQuery`
- `buildRagTokens`（中文 2-gram + 英文词）
- `scoreRagCandidate`（覆盖度/命中/新鲜度/重要性）
- `canViewerAccessMemoryItem`（隐私过滤）

---

## 4. Prompt 组装策略（当前）

模型请求中的系统提示按层叠加：

1. 本地事实守卫（命中人物名时）
2. 本地临时记忆（local storage）
3. 合并记忆（共享概念记忆 + 页面构建 memoryPrompt）
4. RAG 检索上下文（按 query 检索出的 topN）
5. 工具提示（命中意图时：日历/记账/菜谱）
6. 工具上下文预览（calendar/bookkeeping/recipe preview）

最近对话窗口：

- 仅拼最近 6 条对话（防止上下文无限增长）

---

## 5. Memory 注入时机（你最关心）

## 5.1 页面级 memory 注入

触发时机：

- 首次进入页面：`onLoad -> initMemoryPrompt`
- 页面回前台且超过 5 分钟 TTL：`onShow -> initMemoryPrompt`

注入对象：

- `modelConfig.memoryPrompt`：长期记忆文本
- `modelConfig.localFactsPrompt`：结构化本地事实文本
- `modelConfig.strictLocalNames`：人物名数组

## 5.2 请求级 memory 注入

每次发送消息时：

- `agent-ui` 会读取上面的 modelConfig 字段
- 再动态拉取共享概念记忆与 RAG 候选
- 统一在 system messages 中注入

---

## 6. RAG MVP 设计细节

## 6.1 数据源（候选召回）

云函数会并行读取：

- `shared_concept_memory`
- `chat_memory`
- `diaryList`

并做权限控制：

- 只允许同同步组 openid 的共享数据
- `chat_memory` 按 `public/couple/admin` + owner/admin 身份判断可见性

## 6.2 召回与排序

1. Query 规范化
   - 压缩空白，最大 200 字
2. Token 化
   - 英文/数字词
   - 中文整词片段 + 2-gram
   - 停用词过滤
3. 打分
   - overlap 命中数
   - coverage 覆盖率
   - containsWholeQuery 完整短语命中
   - recencyBonus 新鲜度
   - importantBonus 重要标记
4. 排序与去重
   - score 降序 + createdAt 降序
   - content 去重
   - 默认返回 top 8（limit 可配，最大 20）

## 6.3 前端注入格式

`agent-ui` 将返回结果渲染为：

- `[来源/用户] 内容`
- 来源包括：共享概念记忆、长期记忆、日记

并以 system prompt 注入模型。

---

## 7. Prompt 膨胀控制（已做 + 建议）

已做控制：

- 最近对话仅 6 条
- `chat_memory` 显式 limit=40
- `retrieveRagContext` 默认 top8
- 共享概念记忆 limit=20
- 人物事实“按输入命中人物聚焦注入”

仍建议继续做：

1. 按 token 预算动态截断
   - 给每层（facts/memory/rag/history/tool）设置独立预算
2. memory 条目摘要化
   - 长文本预先压缩为 1~2 句
3. 工具上下文按需最小化
   - 非工具意图时不传预览
4. 周期性清理低价值共享概念
   - 去重 + 过期策略

---

## 8. 数据模型与集合

主要集合：

- `chat_memory`
- `shared_concept_memory`
- `diaryList`
- `shared_calendar`
- `shared_bookkeeping`
- `shared_recipe`
- `chat_logs`

说明：

- `chat_memory`：长期知识条目，支持 enabled/order/privacy
- `shared_concept_memory`：对话中沉淀的共享概念
- `diaryList`：日记类上下文，可用于辅助召回

---

## 9. 权限模型

权限依据：

- `USER_IDENTITY_MAP`（身份映射）
- `ADMIN_OPENIDS`（管理员）
- `DIARY_SYNC_OPENID_GROUPS`（同步组）
- privacyLevel（public/couple/admin）

原则：

- Admin 可见 admin 级数据
- owner 永远可见自己条目
- couple 级数据仅情侣组 + admin + owner 可见
- public 对所有已检索用户可见

---

## 10. 配置项清单（高频）

页面层：

- `MEMORY_PROMPT_TTL`：memory prompt 刷新周期（当前 5 分钟）
- `DIARY_SYNC_TTL`：共享日记缓存周期（当前 1 小时）
- `CHAT_MEMORY_LIMIT`：chat_memory 查询上限（当前 40）

组件层：

- `SHARED_MEMORY_REFRESH_INTERVAL`：共享记忆刷新间隔（当前 15 秒）
- `retrieveRagContext(limit)`：默认 8
- recent conversation: `slice(-6)`

云函数层：

- `DEFAULT_RAG_RESULT_LIMIT`：默认返回数（8）
- `MAX_RAG_CANDIDATE_LIMIT`：候选池上限（120）

---

## 11. 部署与发布步骤

1. 云函数 `adminAuth` 重新上传并部署
2. 小程序重新编译
3. 进入 chat 页面，触发一次 onLoad 初始化
4. 验证 action：
   - `getViewerIdentity`
   - `listSharedConceptMemories`
   - `retrieveRagContext`
5. 验证场景：
   - 人物问答（山雪/王晓莉/秦天）
   - 日历/记账/菜谱工具调用
   - 非命中人物问题的 prompt 体积

---

## 12. 常见问题与排障

## 12.1 GPT-5 模型报参数不支持

症状：

- 提示 `max_tokens is not supported, use max_completion_tokens`

处理：

- 已在组件侧做模型参数自动切换；若仍报错，确认运行的是最新构建版本。

## 12.2 新增人物后回答“查无此人”

排查：

1. `STATIC_LOCAL_FACTS` 是否存在该人物与 aliases
2. `strictLocalNames` 是否包含该别名
3. 是否触发 `initMemoryPrompt`（TTL 可能导致旧缓存）
4. 是否重新编译小程序

## 12.3 Prompt 过长导致回答慢/不稳定

排查：

- 检查 `chat_memory` 条目规模与单条长度
- 检查共享概念记忆是否累积过多
- 检查是否总是命中多工具提示（tool prompt 开销）

---

## 13. 安全建议

1. 不要把 API Key 直接硬编码在客户端
   - 推荐迁移到服务端签名或密钥网关
2. chat logs 中避免记录敏感明文
   - 可做脱敏/截断
3. 对 `chat_memory` 写入增加审核字段
   - 防止污染长期知识库

---

## 14. 后续演进路线（建议）

阶段 1（已完成）

- 规则 + 轻量 RAG（关键词/2gram + 权限过滤 + topN）

阶段 2（推荐）

- 引入 embedding 向量检索（memory_vectors）
- 混合检索：关键词召回 + 向量召回 + 重排
- 动态 token 预算器（按模型上下文上限裁剪）

阶段 3（进阶）

- 失败问答回灌（Self-RAG）
- 事实冲突检测与自动降权
- 评测集与回归测试自动化

---

## 15. 变更摘要（本次）

- 新增 RAG 云端检索 action：`retrieveRagContext`
- 前端请求前注入 RAG 上下文 prompt
- 本地事实改为按命中人物聚焦注入
- `chat_memory` 查询增加显式上限 `CHAT_MEMORY_LIMIT=40`
- GPT-5 参数兼容：`max_completion_tokens`

---

如需，我可以在下一步继续补一份“接口文档版 DETAIL-API.md”（包含每个 action 的请求/响应 JSON 示例和字段定义）。
