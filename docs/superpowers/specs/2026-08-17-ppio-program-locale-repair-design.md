# PPIO Program Locale Repair Design

## Goal

Correct the existing PPIO `China Market` Program locale from `zn-CN` to `zh-CN` without creating a new Program, copying prompts, or starting execution.

## Safety boundary

The production operation targets one exact brand and one exact scope. Before writing, it must verify:

- brand name `PPIO` and website `https://ppio.com/` identify exactly one brand;
- `ppio@admin.com` is the sole matching customer identity in that organization and has role `owner`;
- scope name `China Market` is enabled, manual-only, scored, `CN`, `Asia/Shanghai`, and currently `zn-CN` or already `zh-CN`;
- the scope contains exactly the ten enabled domestic prompts frozen in the approved workbook;
- the scope has no delivery batches, observation attempts, prompt runs, or evidence-bearing execution history.

Any mismatch fails before mutation. The update and all postconditions run in one serializable transaction under an advisory lock. A second execution against `zh-CN` is a no-op.

## Delivery

A checked-in, fixed request manifest drives a worker CLI with `status-only`, `dry-run`, and `apply` modes. The production workflow runs only after the immutable release deploy succeeds and only when exactly one approved request exists. Receipts expose counts and lifecycle state but no credentials or prompt bodies.

## Verification

Automated policy tests cover strict request parsing, exact identity checks, history refusal, mutation planning, and idempotency. After production execution, the Portal must show the same ten prompts and make the Program eligible for the `Run now` card. No batch is created.
