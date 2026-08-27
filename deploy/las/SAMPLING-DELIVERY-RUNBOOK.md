# Sampling 客户交付与见证 UAT Runbook（V1）

本 Runbook 适用于当前 Yonaris 的人工 consumer-surface Sampling 交付。目标是固定考核分母、保留可核验的执行证据，并把计分样本与观察样本分开。执行入口为管理员登录后的 `Sampling`（`/admin/sampling`）。

> **LAS 发布状态：No-Go。** 当前仓库只有 migration readiness 验证器，
> 没有可信的 root-owned backup/rehearsal attestation producer。禁止手工伪造
> attestation/evidence，禁止执行 migration 或生产 deploy。以下 Sampling
> 操作规范可用于已经独立验证的环境和产品验收，但不能解除 LAS 的发布阻断。

## Browser Runner（默认关闭）

Browser Runner 是平台侧的执行能力，不属于客户账户权限。当前发布只提供“显式启动一批”的执行链，不创建 cron、定时任务或每日自动批次；在合同生效并完成真实站 UAT 之前，生产环境必须保持 `BROWSER_RUNNER_ENABLED=false` 或不配置该变量。

它不改变 Yonaris 的指标公式：冻结任务数为 `N`，成功保存的有效回答数为 `S`，其中品牌被提及的回答数为 `M`，Visibility 仍为 `M / S`。登录墙、验证码、页面漂移、网络错误和采集失败都不会伪装成 `brandMentioned=false`，只会让 success coverage `S / N` 降低。只有拿到有效回答且答案确实未提及品牌时，才保存成功观察并以 `brandMentioned=false` 进入指标。

自动批次遵循以下固定流程：

1. 管理员创建 `Browser Runner` batch；创建只冻结 manifest 和分母，不执行任务。
2. 管理员显式点击 `Start automated run`，中国节点上的 Runner 才能领取该批次。
3. 每个任务在发送 prompt 前先持久化 submit intent；一旦 intent 存在，系统禁止自动重发。
4. 仅白名单内的提交前瞬时错误允许一次自动重试，总尝试数最多为 2。登录、验证码、页面漂移和适配器未验证直接进入人工队列。
5. Runner 继续处理整批其余任务，不因单条异常暂停。自动阶段结束后统一显示 `Needs human`。
6. 提交前异常可由管理员工作台完成；提交后异常只能通过 Runner 保留的同一浏览器 profile 恢复原回答，不得重新提问。无法恢复时由管理员确认终局技术失败。
7. 每个自动成功任务必须同时关联一张截图和一份 HTML/PDF 页面快照；两者都受 lease、SHA-256、大小和类型校验。
8. 全部冻结任务成功后结果才标记 `Final`；存在终局技术失败时标记 `Incomplete`，而不是修改 Visibility 分母。

Program 的测量窗口按其 IANA timezone 解释。StepFun 国内 Program 使用 `CN / zh-CN / Asia/Shanghai`，因此创建界面中的日期时间统一按北京时间解释，与管理员电脑所在时区无关。

真实豆包执行还必须满足四个条件：Runner 位于经批准的中国网络节点；使用独立 profile；当前 DOM selector/fingerprint 已经人工 UAT；遇验证码或登录限制时不绕过平台控制。仅填写 `CN` 环境变量不能证明实际出口在中国，因此在接入可核验的出口证明前，记录必须保持 `executionMarketVerified=false`。

Runner 必须部署在专用隔离主机或 VLAN，浏览器进程不能接触数据库、Redis、Docker socket、平台密钥或管理网络。网络出口层必须拒绝 RFC1918、loopback、link-local、云 metadata 以及 Yonaris 控制面的浏览器页面访问，只放行经批准的豆包网页资源；Runner 的 Node 控制进程再通过独立 HTTPS 通道访问 Yonaris Runner API。代码中的顶层豆包 URL 校验不是网络隔离，也不能阻止网页子资源探测内网。状态目录应位于加密卷；成功上传后的证据及时清理，保留的人工接管 profile 和异常材料按默认 7 天期限清理，并审计清理失败。

## 1. 能力边界

Yonaris 当前会校验并保存：冻结的 scope、prompt 文本、目标平台、样本序号、会话/搜索要求、测量窗口和 evaluation role；任务 claim/lease；完整回答、页面 URL、引用、执行时间；证据文件类型、大小、SHA-256 及其与成功 observation 的关联；按冻结 manifest 计算的 coverage。

以下信息当前仅是人工声明，不是系统自动验证：

- `anonymous_clean` 或 `new_account_clean` 是否真实满足；
- 实际 IP、GPS、SIM、代理出口或账号所在国家；
- 账号年龄、历史会话和个性化记录是否为空；
- 平台界面中的搜索开关是否真实生效；
- 截图内容与现场操作是否语义一致。

系统会把成功提交记录为 `measurementEligibility=operator_attested_clean_session`、`localizationEvidence=operator_attested` 和 `executionMarketVerified=false`。对客户只能表述为“经操作员声明并留存系统证据的人工观测”，不得表述为“平台/API/地理位置自动验证”。国内 consumer surface 当前没有自动抓取；本流程中的海外 consumer surface 也按人工 Sampling 执行，Bright Data 等自动采集不等同于本流程的 clean-session 证明。

## 2. 上线前 Go/No-Go

交付负责人逐项确认：

- [ ] 目标 release 包含数据库迁移 `0016_delivery_manifests`、`0017_sampling_scope_lane`、`0018_sampling_evidence_artifacts`。
- [ ] 已安装并验证绑定 active release、五 digest receipt 和 rootless runtime
  的固定参数数据库备份操作，且知道对应的上一稳定 immutable release。
  旧 timer 或候选脚本备份不计入本项；稳定备份操作尚未上线时为 No-Go。
- [ ] Web 可经 HTTPS 登录，Worker 稳定运行，服务器和数据库剩余空间足够保存证据及备份。
- [ ] 至少两名人员参加见证 UAT：一名操作员、一名见证人；两人的姓名、时间、平台、市场和结论记录在交付单中。
- [ ] 客户已书面确认 scored prompt、目标平台、样本数、测量窗口、market、locale、timezone、会话模式和搜索模式。
- [ ] 没有向客户、外包操作员或浏览器下发 `ADMIN_API_KEYS`。

任一项不满足即 No-Go，不创建正式 scored batch。

## 3. Scope 和 Prompt 准备

每个 `market + locale + timezone + evaluation role` 使用独立的 manual-only scope。推荐命名：

- `cn-zh-scored`：正式计分；
- `cn-zh-observation`：非计分观察；
- `us-en-scored`、`us-en-observation`：海外英语市场同理。

在 `Sampling` 中选择客户品牌，点击 `Provision scope`：

1. 填写明确的两位 market（如 `CN`、`US`）、BCP 47 locale（如 `zh-CN`、`en-US`）和 IANA timezone。
2. 正式考核选择 `Scored · counts toward assessment`；探索、排障、试运行选择 `Observation · monitoring only`。
3. 如需复用 prompt，使用 `Copy enabled prompts from`。复制后是独立记录，逐条核对文字、标点、语言和启用状态。
4. 同一批客户确认过的 prompt 不得在见到结果后改写。scored 和 observation 不能共用同一 scope 充当同一统计池。

## 4. 冻结 Batch

点击 `Create batch`，在客户确认后一次性填写：batch 名称、scope、测量窗口、prompt、consumer surface、每个 prompt 的样本数、会话要求和搜索要求，然后点击 `Create and freeze batch`。

点击后系统立即冻结 manifest；prompt 文本、平台、样本槽位、scope、品牌/竞品快照和 protocol 不再可替换。记录 batch 名称、完整 batch UUID（由交付运维查询）和 64 位 `manifest_hash`。若冻结前配置错误，停止执行并取消该 batch，记录原因后新建更正版；若已经看到任何任务结果，不得借“配置错误”取消并替换不利结果。

## 5. 国内与海外见证 UAT

正式 scored batch 前，各完成一个“一条 prompt × 一个样本 × 一个平台”的 observation UAT：

- 国内：`CN / zh-CN / Asia/Shanghai`，从豆包、DeepSeek、Kimi、元宝、千问或文心中选择一个合同相关平台；
- 海外：使用合同对应的 market/locale/timezone，从 ChatGPT、Perplexity、Gemini、Copilot、Claude、Grok 或 Google AI surface 中选择一个。

如果客户明确要求 UAT 本身计入考核，才可改用 scored scope，并从一开始把它视为不可替换的正式样本。

操作员共享完整桌面给见证人，并对每个任务执行：

1. 在 `Sampling` 队列点击 `Claim next`。不要复制、记录或发送 lease token；它只应留在当前浏览器会话中。
2. 按冻结要求建立 clean session：
   - `Anonymous clean`：全新浏览器 profile 或新开的隐私窗口，退出平台账号，确认没有历史对话；
   - `New account`：使用为本批次新建且从未提问的账号，确认没有历史对话。账号凭据不得录入 Yonaris 或出现在证据中。
3. 在提问前让见证人看到平台域名、未登录/新账号状态、空白会话和平台显示的语言/地区信息（如有）。系统不会自行判断这些条件。
4. 从 Workbench 复制冻结 prompt，只提交一次；严格按 `Search on/off` 执行。不要补充上下文，不要刷新重问以挑选答案。
5. 回填平台页面 URL、完整 answer、实际 observation time、引用 URL、web query 和界面显示的 model/version（如有）。页面 URL 必须属于所选平台的允许域名。
6. 上传证据并等待 `Upload verified` 与 SHA-256 显示。系统最低要求为 1 个文件；本 Runbook 的人工验收标准为至少 2 个：执行前 clean-session 状态、执行后的完整结果。若单张长截图或 PDF 同时完整覆盖两者，可由见证人在交付单中批准 1 个文件。
7. 勾选 operator attestation，点击 `Submit observation`。见证人在交付单记录 task、执行时间和结论。
8. 在 Sampling 队列确认 UAT batch 完成，并下载一份已关联证据，核对文件可打开且 SHA-256 与界面一致。

证据仅支持真实 PNG、JPEG、WebP 或 PDF；扩展名伪装的文件会被拒绝。限制为每文件 8 MiB、每任务最多 20 个文件且合计 40 MiB、每 batch 合计 512 MiB。V1 不接受视频；客户要求录像时，将录像存入另行批准的受控归档，只把关键截图/PDF 上传 Yonaris。截图不得包含密码、Cookie、验证码、访问令牌或无关个人信息。

国内或海外任一 UAT 不能完成 evidence upload、submit、download、manifest/coverage 核对，即为 No-Go。

## 6. 正式执行与异常处理

正式任务沿用第 5 节的逐任务步骤，并遵循以下不可变规则：

| 情况 | 操作 | 是否保留在冻结分母 |
| --- | --- | --- |
| 提问前发现网络、账号、窗口或人员临时不可用 | `Release to queue`，记录原因，恢复条件后重新 claim | 是；同一任务重新可用 |
| 已得到完整回答，包括未提及品牌、负面回答或无引用 | 如实提交，不得 release 后重问 | 是；记为 succeeded |
| 平台在有效执行中返回封禁、错误、空结果或其他无法形成 observation 的终止性失败 | `Report failure`，填写稳定错误码和事实描述 | 是；记为 failed |
| 上传或提交发生系统错误，尚未成功落账 | 保留现场信息；系统释放后重新 claim，并重新上传该 claim generation 的证据 | 是；任务身份不变 |

`Release to queue` 只处理临时阻塞，不能用来替换已经看到的不利答案。旧 claim generation 的 staged evidence 不可用于新 claim；需要重新上传。`Report failure` 是终态，任务不能重新 claim；当前 V1 的失败动作只保存错误信息，不会把 staged evidence 附着到失败任务，所需失败截图应另存交付事故档案。succeeded、failed、cancelled 均不得改回 available，也不得另建“补样 batch”覆盖原结果。确需新增样本时，必须先取得客户书面批准，并把它作为新增 manifest 单独披露，不得替换原分母。

## 7. Coverage 和 Manifest 核对

在 Sampling 队列先检查：

- `Resolved/Total` 等于冻结的任务数；正式交付必须没有 `available` 或 `claimed`；
- scored 只取 `Scored` lane，observation 只作监测，不能并入客户计分；
- `Resolved 100%` 仅表示所有任务到达终态，不等于 `Succeeded 100%`。failed 和 cancelled 会提高 completion coverage，但不会提高 success coverage。

随后由发布运维在 LAS 主机执行只读核对，不向客户或操作员提供数据库凭据：

不得把 rootless Docker socket、runtime env 或数据库凭据交给
`yonaris-deploy`，也不得从 mutable checkout 直接执行 `docker compose`。
该只读核对应由 root 运维通过稳定 runtime helper 的固定参数、active
release 和五 digest receipt 完成；若主机尚未安装该只读操作，本步骤应
fail closed 并暂停交付，而不是临时开放 socket。

在 `psql` 中先按唯一 batch 名查完整 UUID，再替换下方 `<batch-uuid>`：

```sql
SELECT id, brand_id, scope_id, name, status, planned_task_count,
       manifest_hash, frozen_at, completed_at, cancelled_at
FROM delivery_batches
WHERE name = '<exact-batch-name>'
ORDER BY created_at DESC;

SELECT evaluation_role, status, count(*) AS samples
FROM delivery_tasks
WHERE batch_id = '<batch-uuid>'
GROUP BY evaluation_role, status
ORDER BY evaluation_role, status;

SELECT t.id AS task_id, t.status, count(e.id) AS attached_evidence,
       min(e.sha256) AS first_evidence_sha256
FROM delivery_tasks t
LEFT JOIN evidence_artifacts e
  ON e.observation_attempt_id = t.observation_attempt_id
 AND e.status = 'attached'
WHERE t.batch_id = '<batch-uuid>'
GROUP BY t.id, t.status
ORDER BY t.id;
```

交付检查结果必须满足：

- `manifest_hash` 为非空 64 位小写十六进制值；`planned_task_count` 等于第二条查询的总样本数；
- 正式 scored batch 中不存在 observation task；observation batch 中不存在 scored task；
- 每个 succeeded task 至少有 1 个 `attached` evidence，SHA-256 非空；
- failed/cancelled 数量逐项披露，不能只交付 resolved 百分比；
- 客户验收单保存 batch UUID、manifest hash、各状态计数、见证人和导出时间。

## 8. 发布与回滚

只有在 [LAS deployment guide](./README.md) 所列可信 migration evidence
producer 与全部 bootstrap 前置均完成后，才可发布完整 40 位 commit 对应的
immutable release。forced dispatcher 只允许 policy 绑定的 stable runtime
manager 拉取精确 digest、执行迁移，并核对 Web、Worker 和 PostgreSQL 的实际
container/registry digest 与健康状态；候选脚本不能取得 runtime socket：

由 root 运维先核对 portal workflow 输出的 Web、Worker、migration、
PostgreSQL 四个 `sha256:` digest，并把它们与当前获批的 www digest 作为
同一五-digest tuple 写入该 SHA 的 root-owned policy。PostgreSQL 必须使用
仓库变量 `LAS_POSTGRES_IMAGE_DIGEST` 指向已审核的 `postgres:16-alpine`
registry digest。随后 GitHub Actions 通过唯一 forced protocol 执行：

```text
yonaris-las-v1 deploy sha-<full-40-character-commit> \
  sha256:<web> sha256:<worker> sha256:<migrate> sha256:<postgres>
```

www digest 不作为 portal deploy 命令参数传输；dispatcher 从同一 SHA 的
root policy 读取并要求 receipt 最终保存完整五-digest tuple。不得省略四个
portal 参数，也不得把 tag 当作 digest。

旧 `sampling-batch-operation` 名称已从 forced dispatcher、policy parser 和
production workflow 永久移除。`sampling-batch-operations/requests/` 为空，
现有 candidate helper 仍需读取 runtime dotenv 并直接调用 Compose；不得为它
增加 request 或 policy 授权，也不得恢复该旧协议。若未来确需主机侧一次性
Sampling 能力，必须设计一个新名称、新的 fixed-argument stable manager
operation 和新的 exact protocol，并重新评审 active release、五 digest、
幂等与证据边界。当前管理员只从 Portal 手工创建批次，并通过已批准的人工/
浏览器扩展交付流程执行。

发布后先完成第 5 节两条 observation UAT，全部通过才开放正式 scored batch。若失败，立即停止新建、claim 和提交正式任务，保留所有已冻结 manifest 和已落账 observation，不得手改数据库。

应用回滚到上一稳定版本时，仍使用 canonical `deploy` 协议，但目标改为上一
release，并传入其 receipt/policy 中的 Web、Worker、migration、PostgreSQL
四个 digest；当前 active release 还必须有同 tuple 的 `rollback` 授权与
durable receipt。不得直接执行 checkout 中的 `deploy.sh`。若 pending journal
存在，普通操作必须失败，由 root 按 artifact output-language runbook 对账
实际 digest 后恢复。

```text
yonaris-las-v1 deploy sha-<previous-full-40-character-commit> \
  sha256:<previous-web> sha256:<previous-worker> \
  sha256:<previous-migrate> sha256:<previous-postgres>
```

应用回滚不会反向撤销数据库迁移；Sampling manifest、任务和证据应原样保留。数据库 restore 只允许在正式事故流程中进行，并必须评估备份之后的客户写入；不得为了重置不利样本而恢复数据库。

## 9. 凭据与交付材料

Sampling Workbench 和 evidence upload/download 使用管理员浏览器 session，不需要把 `ADMIN_API_KEYS` 交给执行人员。该变量是全局 API v1 Bearer credential，不是客户级 token：

- 不写入浏览器、截图、交付单、脚本参数、聊天、邮件或客户环境；
- 不提供给客户、外包操作员或见证人；
- 手工交付不需要 API v1 时保持未配置；确有后端集成时仅存放在服务端 secret 管理中，由发布运维持有并定期轮换；
- 客户材料只包含经批准的结果、证据、batch UUID、manifest hash、状态计数和上述真实性边界，不包含账号凭据、session、lease、API key 或数据库连接信息。
