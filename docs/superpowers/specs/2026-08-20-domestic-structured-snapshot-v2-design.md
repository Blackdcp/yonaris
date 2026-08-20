# 国内结构化采集与回答快照 v2 设计

## 状态与决策

本设计用于豆包与 DeepSeek 的本地 Browser Runner。核心决策如下：

1. 浏览器登录、页面操作、回答识别、搜索词与引用卡片提取继续在本地 Chrome 扩展中完成。
2. 扩展不再上传豆包或 DeepSeek 的回答 DOM HTML，也不上传整页 HTML。
3. 扩展只提交结构化回答数据，并上传一张当前任务的最终状态截图作为视觉证据。
4. LAS 根据结构化数据使用 Yonaris 固定模板生成客户可查看、下载的 HTML 和 JSON 回答快照。
5. 现有 `response-snapshot.v1` 历史文件原样保留、继续可读；新任务写入 `response-snapshot.v2`，不回填或覆盖旧文件。
6. 先以豆包完成 1 次只读资格检查、1×1 canary 和正式批次，再让 DeepSeek 复用同一协议。Google AI Overview 等海外服务端采集不在本次改造范围内。

这不是重新开发任务调度系统。现有 batch、task、lease、submit-intent、幂等完成、指标计算、客户权限和 90 天保留机制全部复用。

## 为什么现在改

当前 Browser Runner 同时维护两类快照：

- 扩展把供应商回答 DOM 清洗后嵌入一个 HTML 文件，作为 `page_snapshot` 上传；
- 服务端完成 observation 后又把 `answerHtml` 写入统一 Response Snapshot 的 HTML/JSON。

为了安全上传任意供应商 DOM，扩展不得不判断 CSS 隐藏、裁剪、变换、文字可见性、注释、链接和动态控件。该逻辑正在逼近一个不完整的浏览器渲染器，维护成本高，而且页面每次改版都可能引入新的边界。

客户真正需要的是可审计的回答内容，而不是供应商页面源代码。回答文本、搜索状态、Fan-Out、引用、时间、渠道与截图足以形成可审计证据；客户 HTML 应由 Yonaris 自己生成。

## 产品定义

回答快照证明：某次运行在指定时间、Program、地区和渠道下，Yonaris 采集到了什么回答、搜索信息和引用。

快照 v2 包含三部分：

- 规范 JSON：完整结构化事实和哈希；
- Yonaris HTML：由固定模板从规范 JSON 生成，便于客户阅读和下载；
- 最终状态截图：来自本地浏览器，用来证明采集当时的可见页面状态。

它不承诺还原豆包或 DeepSeek 的完整页面、侧栏、登录状态或像素级交互。产品继续称为“回答快照”或“监测回答存档”，不称为“原站页面镜像”。

## v1 与 v2 兼容关系

| 项目 | 历史 v1 | 国内新 v2 |
| --- | --- | --- |
| 回答 HTML 来源 | 可能包含清洗后的供应商回答 DOM | 只由 Yonaris 固定模板生成 |
| 规范 JSON | 含 `answerHtml` | 不含供应商 HTML，含结构化回答和截图引用 |
| 视觉证据 | 不一定有 | 必须有一张最终状态截图 |
| 客户下载 | HTML / JSON / manifest | HTML / JSON / manifest；详情页另提供截图 |
| 存储键和 revision | 现有规则 | 复用现有规则 |
| 历史数据 | 保持字节不变 | 不回填、不覆盖 v1 |

读路径必须同时支持 v1 和 v2。写路径按适配器版本决定协议，不能把 v1 请求静默解释成 v2，也不能把 v2 结构化结果降级成 `browser_answer_html`。

## 浏览器扩展输出协议

`CollectedAnswerV2` 只包含：

- `answerText`：连接在真实页面中的当前回答区域的 rendered text，标准化换行，不含 HTML；
- `pageUrl`、`observedAt`；
- `webSearchObserved: boolean | null`；
- `webQueries: string[]`；
- `citations: Array<{ url, title }>`；
- `adapterVersion`；
- `captureDiagnostics`：只允许稳定枚举和计数，例如 answer/search/query/citation/completion count，不允许 DOM、CSS、cookie、localStorage 或任意页面片段；
- `screenshotArtifactId`：本任务、当前 lease generation 下上传的截图证据 ID。

协议明确禁止 `answerHtml`、outerHTML、innerHTML、完整页面 HTML、DOM 属性转储、脚本、样式、cookie、浏览器存储和网络凭据。扩展 API 客户端、服务端 Zod schema 和完成服务都必须以 strict schema 拒绝这些额外字段。

## 本地采集边界

扩展只负责浏览器事实，不计算业务指标：

1. 按现有 lease 获取任务，打开新的供应商会话；
2. 在不可逆提交前记录 submit-intent，并只提交一次 Prompt；
3. 使用供应商专用、版本化 selector 定位最新回答和其完成控件；
4. 从当前回答读取结构化文本、搜索摘要、查询项和引用；
5. 截取当前任务的最终状态截图；
6. 上传截图，提交结构化 completion；
7. LAS 原子持久化 observation、引用、查询和 Response Snapshot outbox。

扩展不承担以下职责：

- 不构造客户 HTML；
- 不保存或上传供应商 DOM；
- 不计算品牌提及、Visibility、Share of Voice 或 Opportunities；
- 不连接数据库或对象存储；
- 不决定跨客户权限、保留期或导出策略。

## DOM 识别策略

本设计停止扩张通用的“任意 CSS 是否实际绘制”引擎。采集改为供应商专用、失败关闭：

- 答案、搜索块、查询项、引用卡片和完成控件都必须在适配器的现场资格检查中验证；
- 任一关键 selector 为 0 个或多个、计数与页面摘要不一致、URL 变化、仍在生成、登录墙、验证码或风控出现时，任务进入 `page_drift` 或对应技术失败；
- `answerText` 使用连接中的回答节点 rendered text，不通过 detached clone 生成；
- 只删除浏览器语义明确隐藏的节点，例如 `hidden`、`aria-hidden=true`、`inert`、`display:none`、`visibility:hidden` 和 `content-visibility:hidden`；
- 不再为了生成 HTML 而解析任意 `clip-path`、mask、3D transform、comment 或 CSS 序列化；
- 如果一个文本节点同时包含可见和不可确认的离屏片段，不上传部分推断结果，直接按 `page_drift` 失败；
- 引用必须有非空可见标题、绝对 HTTP(S) URL、无用户名密码、规范化后不超过 10,000 字符；
- 搜索摘要声明的查询数和引用数必须与最终有序去重结果完全一致，禁止部分上传。

适配器资格检查只能读取现有会话，不能点击、填写或发送 Prompt。资格检查通过不等于生产启用；服务端批准版本仍是独立开关。

## 最终状态截图

v2 国内任务要求恰好一个 `screenshot` evidence artifact，不再要求扩展上传 `page_snapshot` HTML。

截图规则：

- 由扩展在收集完成后、提交 completion 前调用 Chrome 截图能力生成；
- content adapter 返回当前 Prompt、最新回答（包含其内的搜索/引用卡片）与其 action group 的已验证 viewport bounding union；background 捕获当前活动任务标签页后只保留该 union 与 viewport 的交集，不上传侧栏、账号菜单、输入框或其他历史轮次；
- 裁剪后的截图必须同时出现当前回答区域的一部分和与其绑定的完成控件；
- 当前 Prompt 或长回答超出当前 viewport 时，完整语义内容仍由 JSON/生成 HTML 保存；截图只是当时可见交集的视觉佐证，不冒充整页长截图；
- 首版统一使用 JPEG，质量 82，最大 2 MiB；超限时在本地等比缩小后重编码，仍超限则任务技术失败；
- 截图不得在数据库 JSON 中 base64 内嵌；继续走现有 evidence artifact 上传、SHA-256、lease ownership 和附件绑定流程；
- 截图上传失败、媒体探测失败或 lease 变化时不允许完成任务。

当前 evidence artifact 存储可直接承载这一小批量发布。截图上限远低于现有 8 MiB 单文件和 40 MiB 单任务上限。大规模定时采集前，再把 evidence binary 从 PostgreSQL 迁移到现有 `filesystem | kodo` 存储抽象；这不是豆包/DeepSeek 首次跑通的前置条件。

## Response Snapshot v2

服务端使用 `prepareResponseSnapshotBundle` 的 v2 分支生成：

- `snapshot.html.gz`：只包含 Yonaris 自有 CSS 和结构化回答、查询、引用、渠道与时间；
- `snapshot.json.gz`：规范结构化记录；
- `manifest.json`：引用 HTML、JSON 以及截图证据的哈希、媒体类型和字节数。

规范 JSON 使用 `schemaVersion: response-snapshot.v2`，模板使用 `response-snapshot-html.v2`。至少包含：

- run、brand、scope、prompt identity；
- Prompt 与完整 `answerText`；
- citations 和 query fan-out availability/queries；
- 品牌与竞品提及；
- channel、modelVersion、market、locale、timezone、observedAt；
- `captureMethod: consumer_web_browser`；
- `contentSource: rendered_from_structured_response`；
- `visualEvidence: { artifactId, mediaType, sha256, bytes }`；
- adapterVersion 和稳定 capture diagnostics；
- HTML、JSON 和 manifest 的 SHA-256 与大小。

v2 JSON 不含 `answerHtml`。v2 HTML renderer 只接受文本和结构化数组；任何调用方传入 HTML 都是编程错误并在测试中拒绝。

截图继续由 evidence artifact 系统保存，manifest 只引用其不可变 ID 和哈希，不把图片复制进 Response Snapshot outbox。这样无需在第一阶段扩展 `response_snapshots` 固定列、文件系统 bundle 和 outbox 大对象，也避免同一截图存两份。

## 客户读取与下载

现有 Response Snapshot HTML、JSON、manifest 查看和下载接口保持兼容。v2 详情 DTO 增加可选 `visualEvidence`：

- v1 返回 `null` 或历史已有证据引用；
- v2 返回截图元数据和受品牌权限保护的下载 URL；
- 下载截图时复用 brand/scope/run 权限校验并记录访问事件；
- 客户不能通过 artifact ID 猜测或跨品牌读取截图；
- HTML 预览仍使用严格 CSP 和 sandbox，截图以 attachment 或安全 image 响应返回。

截图缺失的 v2 记录不能进入 `ready`。截图过期时与回答快照使用同一 90 天保留边界；清理任务不得只删一方后仍把记录显示为完整 ready。

## LAS 职责与压力

LAS 只做控制面和通用数据面：

- 创建/冻结批次；
- 发放 lease、校验 adapter version、幂等完成；
- 接收结构化 JSON 与截图；
- 计算指标；
- 生成固定 HTML/JSON；
- 保存哈希、元数据和审计记录。

LAS 不启动浏览器、不维护供应商账号、不解析豆包/DeepSeek DOM。相比现有方案，服务端少接收一份可达 1.1 MiB 的浏览器 HTML，CPU 与安全处理更简单。主要新增成本是一张不超过 2 MiB 的 JPEG；在当前 PPIO 批量下可忽略，未来规模化时通过对象存储和生命周期规则水平扩展。

## 失败与一致性语义

- 提交 Prompt 前失败：允许按现有策略重试，不产生 `prompt_run`；
- 提交 Prompt 后 DOM 不确定、截图失败或 completion 失败：进入 needs-human/post-submit 恢复，不自动二次提交；
- 结构化结果和截图必须属于同一 task、lease generation、adapter version 和 runner session；
- 服务端先验证截图已 staged，再创建 observation attempt；
- observation、引用、查询、截图 attach、prompt_run 与 snapshot outbox 保持现有事务边界；
- snapshot 存储失败不回滚成功 observation，outbox 继续幂等重试；
- v2 snapshot 只有 HTML/JSON/manifest 落盘且截图仍可读取时才标记 ready；
- 技术失败不计为品牌未提及，不进入 Visibility 分母。

## 版本与发布顺序

### 阶段 1：协议骨架

- 新增结构化 completion v2 和 Response Snapshot v2；
- 扩展截图上传；
- 服务端生成 HTML，不接受 v2 `answerHtml`；
- v1 读路径和海外写路径保持不变；
- 服务端仍批准豆包 v7，v8 保持不可 claim。

### 阶段 2：豆包

- 用真实、未清洗的豆包会话做只读现场资格检查，锁定回答、搜索块、查询、引用和完成控件关系；
- 对最终扩展产物做一次精确版本资格检查；
- 确认生产没有 active/claimed/needs-human/post-submit 豆包任务；
- 服务端批准豆包 v8；
- 运行 1 Prompt × 1 sample canary，核验 answer、Fan-Out、citations、截图和 v2 snapshot；
- canary 通过后运行 China Program 正式批次。

### 阶段 3：DeepSeek

- 复用完全相同的 v2 协议、截图、服务端和客户读取；
- 只新增 DeepSeek 专用 selector contract 与只读资格检查；
- 依次执行 1×1 canary 和正式批次；
- 不复制豆包业务流程或另建 DeepSeek 数据表。

### 阶段 4：收尾

- 两个国内适配器稳定后删除扩展的供应商 HTML 构建与上传代码；
- 保留 v1 历史读兼容，不删除 v1 文件；
- 大规模定时运行前迁移 evidence binary 到 filesystem/Kodo；
- 再评估海外渠道是否统一写 v2，当前不改变海外生产链路。

## Google AI Overview 边界

Google AI Overview 继续在 LAS 通过 Bright Data SERP 执行，不迁到本地扩展。国内 v2 改造不能改变其 provider、重试、计费或失败口径。

最新 50 次生产核验必须单独判断：旧 `sdk_serp` 不存在的 400 配置故障不再出现，45 次已成功；剩余 5 次均为 Bright Data 返回 HTTP 200 但响应体为空，因此落为 `brightdata_serp_request_failed`。这 5 次应作为 provider 空响应单独跟踪，不能与国内改造合并处理，也不能把 45/50 描述为 50/50。

## 测试与验收

### 协议与安全

- v2 completion 缺字段、含 `answerHtml` 或任意未知字段时拒绝；
- URL credentials、过长 URL、空引用标题、N/M 不一致时拒绝；
- screenshot 媒体类型、大小、hash、task、lease generation 任一不符时拒绝；
- v7/v8 adapter version 在 claim、resume、heartbeat、submit-intent、submit-confirmed、complete 全链路绑定；
- 未批准 v8 不能获得任务或越过提交边界。

### 快照

- 同一结构化输入产生字节稳定的 v2 HTML/JSON/manifest；
- v2 HTML/JSON 不包含供应商 DOM、script、style、comment 或 `answerHtml`；
- manifest 的 HTML/JSON hash 与真实文件一致，截图引用与 evidence artifact 一致；
- v1 fixture 仍可查看和下载，旧 hash 不变；
- v2 截图跨品牌、跨 scope、过期和缺失访问均失败关闭。

### 本地执行

- submit-intent 后不会自动重复发送 Prompt；
- 资格检查 0 次 click/fill/submit；
- 多答案、生成中、selector 漂移、URL 变化、登录墙、验证码和风控均失败关闭；
- screenshot 在结构化收集之后、completion 之前产生，失败时不完成任务；
- Doubao 与 DeepSeek 各有真实 Chrome canary 证据，不以 Linkedom fixture 代替现场资格。

### 产品验收

- 豆包 1×1 canary 同时产生非空 answer、正确搜索状态、精确 Fan-Out/Citations、可下载截图和 ready v2 snapshot；
- China Program 正式批次没有 v1 `browser_answer_html` 新记录；
- DeepSeek 重复同一验收；
- 客户页面能区分 v1/v2，并可读取历史 v1 与新 v2；
- 指标值只由结构化 observation 计算，不从 HTML 或截图二次解析。

## 非目标

- 不重做现有批次/任务/lease 系统；
- 不把海外采集迁到本地电脑；
- 不保存供应商整页 DOM 或网络 HAR；
- 不提供像素级原站回放；
- 不自动 OCR 截图或从历史 HTML 重新解析 Fan-Out/Citations；
- 不在本次删除历史 v1、Legacy 数据或旧快照；
- 不在未完成真实现场资格和 canary 前批准豆包/DeepSeek 新适配器版本。
