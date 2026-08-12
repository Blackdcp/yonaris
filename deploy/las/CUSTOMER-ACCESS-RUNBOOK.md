# Customer and platform access

Yonaris uses two separate identity classes. Do not use one browser identity for both.

## Platform identities

- `user.role=admin`: platform owner/operator.
- `has_report_generator_access=true`: report operator when the deployment feature is enabled.
- Platform identities use `/admin` or `/reports`.
- Sampling, browser automation, provider configuration, workflows, tools, report generation, and paid execution stay platform-side.
- A platform identity is rejected from `/app/**`, even if an old organization membership still exists.

## Customer identities

- Global role is always `user` and report access is always false.
- The identity belongs to exactly one customer organization, which owns exactly one brand.
- Customer identities use `/app/<brand-id>` and cannot access `/admin`, `/reports`, provider settings, Sampling, evidence APIs, or paid generation endpoints.
- Organization roles are:
  - `owner`: customer account ownership and full customer configuration.
  - `admin`: customer administration and full customer configuration.
  - `analyst`: configure manual Programs, prompts, competitors, and inspect delivered results.
  - `viewer`: read-only delivery access.

## Provisioning a customer

1. Sign in with the platform administrator and open **Customer access**.
2. Create the customer workspace. This creates one organization and one brand without adding the platform operator as a customer member.
3. Select the workspace and create an ordinary customer account with the required role.
4. Copy the one-time password from the HTTPS response and deliver it through an approved secret channel. It is never recoverable from the database or logs.
5. Test the customer experience in a separate browser profile using that ordinary identity.

Password reset revokes all database sessions immediately. Better Auth cookie caching is disabled so a revoked or downgraded identity cannot continue using a cached signed session.

## Internal CLI

For emergency local-mode operations, use the worker image's `account:customer` command. It defaults to dry-run, accepts password material only over stdin, and fails closed for global admins, report operators, external identities, multiple memberships, or ambiguous credentials. Never pass passwords in argv, environment variables, deployment manifests, or CI logs.

## QA contract

CI creates two isolated customer workspaces, provisions a real ordinary StepFun analyst through the Admin UI, signs in with the one-time password, and verifies:

- the customer shell has fixed customer navigation only;
- platform routes, provider settings, Sampling, and evidence writes are denied;
- StepFun cannot read the MemTensor workspace;
- merely opening customer Opportunities causes no provider call or database write.
