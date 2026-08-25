# Task 4 Report — Native China ToB Narrative and Operational Interaction Design

## RED evidence

Command:

```text
pnpm --filter @workspace/www test -- src/components/experience/china/china-experience.test.tsx src/content/experience/copy-contract.test.ts src/components/experience/shared/lead-form.test.tsx
```

Exit code: `1`

Exact summary:

```text
Test Files  2 failed | 1 passed (3)
     Tests  5 failed | 13 passed (18)
```

Expected failures:

```text
copy-contract.test.ts
× keeps customer claims inside the product's observable capability boundary

china-experience.test.tsx
× 让客户从四种真实处境进入，而不是按职位选择
× 按中国 ToB 决策顺序呈现首页风险、证据与摸底输出
× 把产品、服务、市场与公司写成可执行的本土业务判断
× 四个中国诊断场景都使用完整键盘标签关系并同步结果与优先级
```

Failure evidence matched the intended missing behavior: the approved headline/risk/stage copy was absent, and the first scene exposed one tab panel where four linked panels were required. The shared lead-form test file passed in the same run.

## GREEN evidence

Focused command:

```text
pnpm --filter @workspace/www test -- src/components/experience/china/china-experience.test.tsx src/content/experience/copy-contract.test.ts src/components/experience/shared/lead-form.test.tsx src/components/experience/shared/use-roving-tabs.test.tsx
```

Exit code: `0`

Exact summary:

```text
Test Files  4 passed (4)
     Tests  30 passed (30)
```

The same copy and scene-contract tests that failed RED passed after implementation. The shared lead-form and roving-tab suites passed in the same run.

## Page-by-page copy, design, and interaction evidence

- **Home:** Opens with “客户开始问 AI，品牌的第一解释权还在你手里吗？”. The early journey exposes the four business risks “没进候选池 / 核心卖点被说偏 / 竞品占了答案位 / 出海后定位漂移”, then the four review outputs “问题范围 / 答案快照 / 竞品差距 / 优先级清单”. The market chapter states “出海不是翻译官网，而是重做一遍当地品类心智。” and the final conversion repeats “预约一次 AI 品牌摸底”.
- **Product:** Leads with “品牌为什么没进客户的候选池？”. One meeting-ready artefact moves through “圈定问题 / 拆答案 / 找掉点 / 做复盘”; every state keeps its scope, observed answer, gap, and next priority visible. The page explicitly describes “一份能带进会议的品牌摸底记录” rather than an unexplained score.
- **Approach:** Leads with “先做品牌体检，再定 GEO 打法。” and immediately defines GEO as “生成式搜索和 AI 答案中的品牌表现”. The route chooser starts from four business problems rather than roles and shows the scoped answer, business gap, evidence checklist, and priority for each route.
- **Geo:** Starts with the China-market baseline, then adds only a defined target country, target language, local buying role, and comparison brand. The exact localization proposition appears in both the lead and the operational contrast chapter. The bridge changes the observed answer and priority between the China baseline and target-market view.
- **Company:** “不卖玄学排名，先把 AI 怎么说你查清楚” is followed immediately by the precise market/language/question/comparison scope and a no-extrapolation limit. The next chapter makes scope, retained answer evidence, and third-party-answer limits inspectable.
- **Diagnostic:** “第一次沟通只确认摸底范围” limits the first conversation to brand, market, language, buying questions, and comparison objects. The rendered form exposes exactly three visible fields—姓名, 电话, 公司—with a telephone input and no email field.
- **Privacy:** Uses plain information-purpose language: what the form collects, why it is needed, how it is used, and that consultation content is not public. No growth or marketing slang is used.

Interaction and visual evidence:

- `AiAnswerFlow`, `BrandGapConsole`, `ServiceRoute`, and `GlobalMarketBridge` all consume the shared `useRovingTabs` hook. Their state counts are 4 / 4 / 4 / 2, with unique linked tab/panel IDs, one roving `tabIndex=0`, and ArrowLeft/ArrowRight/Home/End behavior supplied by the already tested shared hook.
- Every state renders stable `data-output-field="scope|answer|gap|priority"` markers. Focused tests require distinct answer and priority values for every state, so a state change cannot update only the decorative shell.
- Rounded command surfaces, status chips, dense readouts, and dashboard output lists remain the dominant China visual language. Signal Orange is used for selected decisions, priority cards, and conversion chapters rather than general decoration.
- State entry uses shared `--motion-state` (`220ms`) and `--motion-ease`; reduced-motion produces an immediately legible static state.
- Chinese headline tracking is restrained to `-0.018em` (`-0.012em` at the narrowest breakpoint). Intentional wrapping comes from bounded headline measures and balanced Chinese wrapping.
- At mobile widths, functional text is raised to `0.75rem`, body/readout text to `0.875rem` with `1.5` line height, and controls use the shared `44px` target. Product tabs become a two-column grid rather than an intended horizontal scroller; all active outputs sit below their controls.

## Files changed

- `apps/www/src/content/experience/china-copy.ts`
- `apps/www/src/components/experience/china/china-scenes.tsx`
- `apps/www/src/components/experience/china/china-pages.tsx`
- `apps/www/src/styles/experience/china.css`
- `apps/www/src/components/experience/china/china-experience.test.tsx`
- `apps/www/src/content/experience/copy-contract.test.ts`
- `.superpowers/sdd/2026-08-25-experience-90-agent-readable/task-4-report.md`

No dependency, bitmap, route, or shared-hook implementation was added or changed.

## Full validation

Final validation was run after the last CSS source adjustment:

```text
pnpm --filter @workspace/www test -- src/components/experience/china/china-experience.test.tsx src/content/experience/copy-contract.test.ts src/components/experience/shared/lead-form.test.tsx src/components/experience/shared/use-roving-tabs.test.tsx
PASS — 4 files, 30 tests

pnpm --filter @workspace/www check-types
PASS — tsc --noEmit, exit 0

pnpm --filter @workspace/www build
PASS — client, SSR, and Nitro production output built, exit 0

pnpm --filter @workspace/www test
PASS — 27 files, 139 tests

pnpm audit:public-output
PASS — exit 0, output []

git diff --check
PASS — no whitespace errors (Git emitted only working-tree LF/CRLF notices)
```

Additional production-source scans returned no matches for prohibited internal/research, ancestry/licensing/build, invented proof, response-time, or unsupported-outcome language. A tracking scan returned no declarations more aggressive than `-0.018em`.

## Self-review

- Changed-file scope matches Task 4: China content, China scenes/pages/styles, the two specified contract test files, and this report.
- Seven China page exports and the existing China route shell remain intact. Same-topic Human/Agent and locale links remain covered for every route.
- The real navy/white Yonaris wordmarks remain in the shell and scene; Signal Orange continues to resolve to the shared `#ff6a00` brand token.
- Mutation check: removing any required narrative anchor, restoring role-based entry, adding an email field, introducing a prohibited promise, collapsing a scene to one panel, unlinking tab/panel IDs, or reusing one result/priority across states fails a focused test.
- Scope/answer/gap/priority content is operational and bounded to selected market, language, buying questions, and comparison objects. No customer, logo, metric, coverage, award, certification, result, guarantee, or case was added.
- CSS uses existing motion/text/target tokens, has a reduced-motion fallback, and removes the prior intended mobile horizontal tab rail.
- `git diff --check`, focused tests, typecheck, production build, full package tests, and public-output audit are all clean on the final tree.

## Concerns

The production build emits Vite's non-fatal warning that an existing minified index chunk is larger than 500 kB. Build exit status is `0`; Task 4 adds no dependency or bitmap asset. No Task 4 blocker remains.
