# 统一回答快照与 LAS 存储设计

## 目标

为国内与海外的每一次成功监测建立统一、只读、可校验的“回答快照”。国内 Browser Runner 与海外 Bright Data 继续使用各自稳定的采集方式，但都输出同一个快照协议。第一阶段将压缩后的 HTML 与 JSON 存在生产 LAS 的独立持久目录中，保留 90 天；后续可无感迁移到七牛 Kodo。

这项能力不改变 Elmo 的 Visibility、Share of Voice、品牌提及、引用或覆盖率公式，也不把技术失败记成品牌未提及。

## 产品定义

“回答快照”证明的是：某次运行在某个时间、地区和 AI 渠道下返回了什么回答、引用与查询信息。

回答快照不是原平台页面证据，不承诺还原 ChatGPT、豆包或 DeepSeek 的完整界面、登录状态、侧栏、按钮或像素级外观。产品中统一使用“回答快照”或“监测回答存档”，不使用“原站页面快照”。

每个快照必须标识其内容来源：

- `native_answer_html`：采集方直接返回回答区域 HTML；
- `browser_answer_html`：Browser Runner 从当前回答容器提取 HTML；
- `rendered_from_structured_response`：上游只返回文本和结构化引用，由 Yonaris 固定模板生成 HTML；
- `reconstructed_from_historical_run`：根据已经落库的历史回答生成，不能冒充当时保存的原生 HTML。

客户对其品牌快照只读，可查看、下载 HTML/JSON，并在后续导出能力中批量下载 90 天内的快照。原站截图和完整页面取证不在本期标准产品范围内。

## 统一快照协议

每个成功的 `prompt_run` 最多对应一个逻辑快照记录，协议版本为 `response-snapshot.v1`。同一记录可以因修复产生多个不可变 artifact revision，但任何时刻只有一个明确的 current revision；旧 revision 在保留期内继续可审计。其规范 JSON 至少包含：

- `schemaVersion`
- `runId`、`brandId`、`scopeId`、`promptId`
- 完整 Prompt 文本
- 完整回答纯文本
- 清洗后的回答 HTML
- 引用 URL、标题、域名和顺序
- Query Fan-out；上游不可用时明确记录 `unavailable`，不能伪造为空查询
- 品牌与竞品提及结果
- 公共 AI 渠道与模型版本
- 市场、语言、时区和 `observedAt`
- `captureMethod`，例如 `brightdata_dataset` 或 `consumer_web_browser`
- `contentSource`
- 生成快照的模板版本
- HTML 与 JSON 各自的 SHA-256、压缩前后字节数；上游原始 payload 可用时另存其哈希，但不向客户暴露不安全的原始代码
- 创建时间、到期时间和保留策略

规范 JSON 使用稳定字段顺序与 UTF-8 编码。HTML 和 JSON 分别计算哈希，manifest 再引用二者哈希。任何重新生成必须产生新的 artifact revision，不能覆盖旧内容并保留旧哈希。

## 国内与海外数据流

### 国内 Browser Runner

Runner 在同一已确认回答容器中提取回答文本、回答 HTML、引用、查询和平台元数据。现有用于内部执行校验的截图证据可以继续短期保留，但不属于客户标准快照，也不影响快照的 90 天保留规则。

登录、验证码、页面漂移或不确定提交等技术失败继续进入现有人工处理流程，不生成 `prompt_run` 或回答快照。有效回答即使没有品牌提及，也正常生成快照并以 `brandMentioned=false` 进入 Elmo 原有分母。

### 海外 Bright Data

继续使用现有 Dataset/SERP 采集路线，不切换到海外 Browser Runner。对于 Dataset 返回的 `answer_html`、`answer_section_html` 或等价回答 HTML，不再在完成快照前丢弃。回答文本、引用、查询和模型元数据继续走现有解析逻辑。

如果某个海外目标没有返回回答 HTML，则使用 Yonaris 固定、无脚本模板把完整回答文本与引用渲染成 HTML，并将 `contentSource` 标记为 `rendered_from_structured_response`。这不会被描述为原站 HTML。

Google AI Overview 等结构化 SERP 路线采用相同回退规则，不为缺失的查询或 HTML 制造虚假原始数据。

## HTML 安全与可重现性

客户可见 HTML 必须经过服务端清洗：

- 删除 script、iframe、form、object、embed 和可执行 SVG；
- 删除事件处理属性、外部样式表、远程字体和主动网络请求；
- 将链接保留为普通可见引用，打开时使用安全的外部链接策略；
- 使用 Yonaris 自有、带版本号的内联样式；
- 禁止 HTML 在 Portal 主页面上下文中执行；
- 预览使用 sandboxed iframe 或独立下载响应，并设置严格 CSP、`nosniff` 与附件头。

快照追求内容可重现，而不是平台像素级重现。模板升级不会静默改变已保存的 HTML；需要新样式时，可以从规范 JSON 生成新的导出文件，但旧 artifact 继续可校验。

## 存储抽象

应用只依赖 `ResponseSnapshotStorage` 接口：

- `put(bundle)`
- `get(storageKey)`
- `head(storageKey)`
- `delete(storageKey)`
- `createDownload(storageKey)`

第一阶段实现 `FilesystemResponseSnapshotStorage`。后续新增 `KodoResponseSnapshotStorage` 时，Portal、指标、权限和快照协议不变。

数据库新增快照元数据记录，至少保存：

- 关联的 run、brand、scope 与 prompt；
- `storageBackend` 与不透明 `storageKey`；
- source kind、schema/template revision；
- HTML/JSON/manifest 哈希和大小；
- `status`：`pending`、`ready`、`failed`、`expired`；
- 创建、可用、失败和到期时间；
- 最后错误的稳定错误码，不保存敏感原始异常。

数据库不长期保存 HTML 或 JSON 大对象。临时恢复材料若为可靠落盘所必需，必须有严格大小上限和短期清理策略。

## LAS 文件系统布局

快照不能存入 Git 工作树、发布目录或 Docker 容器可写层。默认根目录为：

```text
/var/lib/yonaris/response-snapshots/v1/
  <brand-id>/
    <yyyy>/
      <mm>/
        <run-id>/
          snapshot.html.gz
          snapshot.json.gz
          manifest.json
```

目录由专用服务账号拥有，默认目录权限 `0700`、文件权限 `0600`。所有路径必须经过根目录包含性校验，拒绝 symlink、路径穿越与用户提供的文件名。

写入流程为同目录临时文件、flush/fsync、原子 rename、父目录 fsync，再提交 ready 元数据。数据库提交失败产生的孤儿文件由维护任务按短 TTL 清理；文件写入失败不得触发重新询问 AI，也不得把品牌结果改成未提及。

## 一致性与失败处理

回答指标和快照状态是两个独立维度：

- 有效回答继续按 Elmo 原公式进入指标；
- 快照写入瞬时失败时显示 `快照生成中`，后台使用同一份已采集内容重试；
- 持久失败显示 `快照暂不可用` 并告警，不重跑 Prompt、不改变回答和指标；
- 不能从失败任务制造空 HTML、空 JSON 或伪造成功快照；
- 同一个 run 的幂等重试必须验证内容哈希；不同内容不能覆盖同一 revision。

快照缺失率作为独立运维指标，不混入客户 Visibility 或 Delivery Coverage。

## 保留、容量与备份

标准保留期为 90 天，按 `expiresAt` 执行。每日维护任务删除到期对象并将元数据置为 `expired`。删除失败必须告警并在下次维护重试。

第一阶段使用 LAS 时增加以下硬门禁：

- 70% 磁盘使用率告警；
- 80% 在任何新 Prompt 提交前暂停需要快照的任务领取，保留 Portal、数据库和已在途任务的收尾能力；不能继续制造明知无法留档的新回答；
- 定期记录各品牌、渠道与月份的对象数和压缩字节数；
- 快照目录纳入独立备份或复制流程；现有 PostgreSQL 备份不能被视为文件快照备份；
- Docker 日志、镜像和数据库增长与快照容量分别监控。

第一阶段以单客户真实数据验证平均压缩体积和磁盘增长。在 60% 磁盘利用率或多客户正式扩容前完成 Kodo 迁移，不等到 70% 告警后才开始设计。

## 访问控制与客户体验

快照读取只通过已认证的 Portal 服务端接口：

- 平台管理员可以诊断所有品牌；
- 客户账号只能读取其品牌的 ready 快照；
- 客户没有创建、替换、删除或延长快照保留期的权限；
- 所有下载均按 brand/run 授权，不接受调用方提供任意 storage key；
- 下载与批量导出记录审计事件；
- 过期或缺失快照返回明确状态，不暴露底层路径、provider payload 或内部错误。

回答详情页增加统一“回答快照”入口，展示采集时间、渠道、内容来源、哈希和保留到期日。国内外使用同一组件，不显示 provider 密钥、capture route 或内部 Runner 信息。

## 历史数据

现有 StepFun 豆包与 DeepSeek 生产回答可以从已保存的回答、引用和时间生成 `reconstructed_from_historical_run` 快照。若历史记录缺少原生 HTML，只能生成固定模板 HTML，不能标为 `native_answer_html` 或 `browser_answer_html`。

历史回填必须幂等、按品牌严格授权并验证 run identity；不修改 prompt run、品牌提及、引用或指标字段。回填失败只影响快照状态。

## Kodo 迁移路径

迁移工具按对象执行：读取 LAS 文件、验证现有哈希、上传 Kodo、重新下载或 HEAD 校验大小与哈希、原子更新 `storageBackend/storageKey`，最后在保守延迟后删除本地副本。

迁移可按品牌或月份分批进行，读接口在迁移期间同时支持 `filesystem` 与 `kodo`。任何校验失败保留 LAS 原件并停止该对象迁移。

## 测试与验收

- 快照协议：稳定序列化、UTF-8、哈希、source kind 和模板 revision。
- Bright Data：保留回答 HTML；没有 HTML 时正确生成并标记回退快照。
- Browser Runner：只从当前回答容器提取，不混入旧会话或页面外内容。
- 安全：脚本、事件属性、iframe、远程资源、路径穿越和 symlink 全部 fail closed。
- 文件存储：权限、原子写、并发幂等、孤儿清理、到期删除和磁盘门禁。
- 权限：跨品牌读取 404/403，客户只读，平台管理员诊断路径保留。
- 指标回归：有无快照、快照 pending/failed/expired 均不改变同一批 prompt runs 的 Elmo M/S。
- 历史回填：只生成 artifact，不修改既有 StepFun 指标。
- 部署：快照目录在 release/container 外持久化，升级与回滚不会删除文件。
- 备份恢复：数据库元数据与文件快照能一起恢复并通过哈希校验。

## 分阶段交付

1. 建立统一协议、元数据、文件系统存储和安全读取接口。
2. 接入海外 Bright Data 与国内 Browser Runner，保持现有指标公式不变。
3. 在客户回答详情中提供统一只读快照查看与单条下载。
4. 为既有 StepFun 回答做明确标记的历史回填。
5. 增加批量导出、容量仪表盘、90 天清理和备份恢复演练。
6. 根据真实压缩体积与客户数量迁移 Kodo。

每一阶段都必须默认安全且可独立发布；在快照能力稳定前不启用原站截图付费能力。

## 非目标

- 不保存或承诺原平台完整页面、像素级截图或登录状态证据；
- 不把海外标准采集切换为 Browser API 或海外 Browser Runner；
- 不改变任何 Elmo 指标公式；
- 不把快照数据暴露给其他品牌或匿名用户；
- 不把 HTML/JSON 长期塞入 PostgreSQL；
- 不在本期实现长期截图存储或原站证据套餐。
