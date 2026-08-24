/**
 * E2E Test Database Seeder
 *
 * Seeds the LOCAL test database with realistic fixture data for E2E testing.
 *
 * SAFETY: the database host, credentials, and name (see fixtures.ts) are
 * hardcoded to localhost to prevent accidentally running this against a
 * production database. Only its local port can be overridden (it DELETEs all
 * data).
 *
 * Usage: tsx seed.ts
 */
import { mkdir, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { prepareResponseSnapshotBundle, type ResponseSnapshotDraft } from "@workspace/lib/response-snapshots/contract";
import { FilesystemResponseSnapshotStorage } from "@workspace/lib/response-snapshots/filesystem-storage";
import pg from "pg";
import {
  COMPETITOR_IDS,
  CUSTOMER_TEST_USER,
  DATABASE_URL,
  MEMTENSOR_BRAND_ID,
  MEMTENSOR_BRAND_NAME,
  MEMTENSOR_ORG_ID,
  MEMTENSOR_PROMPT_ID,
  MEMTENSOR_RUN_ID,
  MEMTENSOR_SCOPE_ID,
  MEMTENSOR_SNAPSHOT_ID,
  NIKE_BRAND_ID,
  NIKE_COMPETITOR_IDS,
  NIKE_ORG_ID,
  NIKE_PROMPT_IDS,
  NIKE_SCOPE_ID,
  PROMPT_IDS,
  REPORT_IDS,
  STEPFUN_BRAND_ID,
  STEPFUN_BRAND_NAME,
  STEPFUN_ORG_ID,
  STEPFUN_PROMPT_ID,
  STEPFUN_SCOPE_ID,
  STEPFUN_SNAPSHOT_EXPORT_DAYS_AGO,
  STEPFUN_SNAPSHOT_IDS,
  STEPFUN_SNAPSHOT_RUN_IDS,
  TEST_BRAND_ID,
  TEST_BRAND_NAME,
  TEST_BRAND_WEBSITE,
  TEST_SCOPE_ID,
} from "./fixtures";

// Prompt run IDs (for prompt detail page testing)
const RUN_IDS = [
  "00000000-0000-0000-0000-200000000001",
  "00000000-0000-0000-0000-200000000002",
  "00000000-0000-0000-0000-200000000003",
  "00000000-0000-0000-0000-200000000004",
  "00000000-0000-0000-0000-200000000005",
  "00000000-0000-0000-0000-200000000006",
  "00000000-0000-0000-0000-200000000007",
  "00000000-0000-0000-0000-200000000008",
];

async function seed() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    console.log("Seeding E2E test database...");

    // This database host is hardcoded to localhost in fixtures.ts. TRUNCATE
    // is intentional here: delivery manifests retain audit rows and reject
    // the ordinary DELETE sequence used before scoped observations existed.
    await client.query(`
      TRUNCATE TABLE
        browser_runner_pairings,
        browser_runner_device_brands,
        browser_runner_devices,
        response_snapshot_access_events,
        response_snapshot_outbox,
        response_snapshots,
        evidence_artifacts,
        citations,
        prompt_runs,
        delivery_tasks,
        delivery_batches,
        observation_attempts,
        prompts,
        measurement_scopes,
        competitors,
        reports,
        brands
      RESTART IDENTITY CASCADE
    `);

    // The customer boundary suite provisions this identity through the real
    // platform-admin UI on every run. Removing only its hardcoded localhost
    // fixture account keeps that flow deterministic without disturbing the
    // bootstrap platform administrator used by the rest of the suite.
    await client.query(`DELETE FROM "user" WHERE lower(email) = lower($1)`, [
      CUSTOMER_TEST_USER.email,
    ]);

    // -----------------------------------------------------------------------
    // Dedicated customer workspaces used by the real-identity boundary E2E.
    // StepFun has one manual scored program. MemTensor deliberately belongs to
    // another organization so changed-URL tenant access can be proven closed.
    // -----------------------------------------------------------------------
    for (const workspace of [
      {
        organizationId: STEPFUN_ORG_ID,
        brandId: STEPFUN_BRAND_ID,
        name: STEPFUN_BRAND_NAME,
        website: "https://stepfun.com",
        scopeId: STEPFUN_SCOPE_ID,
        scopeKey: "cn-zh-scored",
        scopeName: "China - Simplified Chinese - Scored",
      },
      {
        organizationId: MEMTENSOR_ORG_ID,
        brandId: MEMTENSOR_BRAND_ID,
        name: MEMTENSOR_BRAND_NAME,
        website: "https://mentensor.com",
        scopeId: MEMTENSOR_SCOPE_ID,
        scopeKey: "cn-zh-scored",
        scopeName: "China - Simplified Chinese - Scored",
      },
    ]) {
      await client.query(
        `INSERT INTO organization (id, name, slug, created_at)
         VALUES ($1, $2, $1, NOW())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [workspace.organizationId, workspace.name],
      );
      await client.query(
        `INSERT INTO brands
           (id, organization_id, name, website, enabled, onboarded, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, true, NOW(), NOW())`,
        [workspace.brandId, workspace.organizationId, workspace.name, workspace.website],
      );
      await client.query(
        `INSERT INTO measurement_scopes
           (id, brand_id, key, name, market, locale, timezone, automatic_target_keys,
            sampling_evaluation_role, enabled, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'CN', 'zh-CN', 'Asia/Shanghai', '{}',
                 'scored', true, false, NOW(), NOW())`,
        [workspace.scopeId, workspace.brandId, workspace.scopeKey, workspace.scopeName],
      );
    }
    await client.query(
      `INSERT INTO prompts
         (id, brand_id, scope_id, value, enabled, tags, system_tags, created_at, updated_at)
       VALUES
         ($1, $2, $3, '国内有哪些主流大模型公司？', true,
          ARRAY['结果监测'], ARRAY['unbranded'], NOW(), NOW()),
         ($4, $5, $6, 'MemTensor 是什么？', true,
          ARRAY['结果监测'], ARRAY['branded'], NOW(), NOW())`,
      [
        STEPFUN_PROMPT_ID,
        STEPFUN_BRAND_ID,
        STEPFUN_SCOPE_ID,
        MEMTENSOR_PROMPT_ID,
        MEMTENSOR_BRAND_ID,
        MEMTENSOR_SCOPE_ID,
      ],
    );
    await seedResponseSnapshotFixtures(client);

    // -----------------------------------------------------------------------
    // 1. Brand (scoped to an organization that shares its id)
    // -----------------------------------------------------------------------
    // Signup provisions the "default" org as well, but the seed re-creates the
    // brand independently — ensure the org exists for the NOT NULL FK.
    await client.query(
      `INSERT INTO organization (id, name, slug, created_at)
       VALUES ($1, $2, $1, NOW()) ON CONFLICT (id) DO NOTHING`,
      [TEST_BRAND_ID, TEST_BRAND_NAME]
    );
    await client.query(
      `INSERT INTO brands (id, organization_id, name, website, enabled, onboarded, created_at, updated_at)
       VALUES ($1, $1, $2, $3, true, true, NOW(), NOW())`,
      [TEST_BRAND_ID, TEST_BRAND_NAME, TEST_BRAND_WEBSITE]
    );
    console.log("  Created brand:", TEST_BRAND_ID);

    await client.query(
      `INSERT INTO measurement_scopes
         (id, brand_id, key, name, market, locale, timezone, automatic_target_keys, enabled, is_default, created_at, updated_at)
       VALUES ($1, $2, 'legacy-unspecified', 'Legacy / Unspecified', 'ZZ', 'und', 'UTC', NULL, true, true, NOW(), NOW())`,
      [TEST_SCOPE_ID, TEST_BRAND_ID],
    );

    // -----------------------------------------------------------------------
    // 2. Prompts
    // -----------------------------------------------------------------------
    const promptData = [
      {
        id: PROMPT_IDS.branded1,
        value: "What is the best AI monitoring tool for tracking brand visibility?",
        tags: ["monitoring"],
        systemTags: ["branded"],
      },
      {
        id: PROMPT_IDS.branded2,
        value: "Compare AI answer presence platforms and their features",
        tags: ["comparison"],
        systemTags: ["branded"],
      },
      {
        id: PROMPT_IDS.unbranded1,
        value: "How do I optimize content for LLM citations?",
        tags: ["optimization"],
        systemTags: ["unbranded"],
      },
      {
        id: PROMPT_IDS.branded3,
        value: "What tools can track AI search results and brand mentions?",
        tags: ["monitoring", "tools"],
        systemTags: ["branded"],
      },
      {
        id: PROMPT_IDS.unbranded2,
        value: "Best practices for generative AI SEO and content strategy",
        tags: ["seo"],
        systemTags: ["unbranded"],
      },
    ];

    for (const p of promptData) {
      await client.query(
        `INSERT INTO prompts (id, brand_id, scope_id, value, enabled, tags, system_tags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, $5, $6, NOW(), NOW())`,
        [p.id, TEST_BRAND_ID, TEST_SCOPE_ID, p.value, p.tags, p.systemTags]
      );
    }
    console.log(`  Created ${promptData.length} prompts`);

    // -----------------------------------------------------------------------
    // 3. Competitors
    // -----------------------------------------------------------------------
    const competitorData = [
      { id: COMPETITOR_IDS.competitorA, name: "Competitor Alpha", domains: ["competitor-alpha.com"] },
      { id: COMPETITOR_IDS.competitorB, name: "Competitor Beta", domains: ["competitor-beta.com"] },
    ];

    for (const c of competitorData) {
      await client.query(
        `INSERT INTO competitors (id, brand_id, name, domains, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [c.id, TEST_BRAND_ID, c.name, c.domains]
      );
    }
    console.log(`  Created ${competitorData.length} competitors`);

    // -----------------------------------------------------------------------
    // 4. Prompt Runs (realistic data for prompt detail pages)
    //    Includes citation URLs for some runs to test citation analytics.
    // -----------------------------------------------------------------------
    const now = new Date();
    const promptRuns = [
      {
        id: RUN_IDS[0],
        promptId: PROMPT_IDS.branded1,
        model: "chatgpt",
        version: "gpt-4o",
        webSearchEnabled: false,
        rawOutput: {
          response:
            "Based on my analysis, Test Organization offers a comprehensive AI monitoring platform that tracks brand visibility across major LLMs. Their tool provides real-time insights into how AI models reference and cite your brand.",
        },
        textContent:
          "Based on my analysis, Test Organization offers a comprehensive AI monitoring platform that tracks brand visibility across major LLMs. Their tool provides real-time insights into how AI models reference and cite your brand.",
        webQueries: [] as string[],
        brandMentioned: true,
        competitorsMentioned: [] as string[],
        citations: [
          { url: "https://example.com/blog/ai-monitoring", domain: "example.com", title: "AI Monitoring Guide" },
          { url: "https://docs.example.com/api", domain: "docs.example.com", title: "API Documentation" },
        ],
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: RUN_IDS[1],
        promptId: PROMPT_IDS.branded1,
        model: "claude",
        version: "claude-sonnet-4-6",
        webSearchEnabled: false,
        rawOutput: {
          response:
            "There are several AI monitoring tools available. Competitor Alpha provides basic tracking, while Test Organization offers more advanced visibility metrics and citation analysis.",
        },
        textContent:
          "There are several AI monitoring tools available. Competitor Alpha provides basic tracking, while Test Organization offers more advanced visibility metrics and citation analysis.",
        webQueries: [] as string[],
        brandMentioned: true,
        competitorsMentioned: ["Competitor Alpha"],
        citations: [
          { url: "https://competitor-alpha.com/features", domain: "competitor-alpha.com", title: "Competitor Alpha Features" },
          { url: "https://example.com/comparison", domain: "example.com", title: "Tool Comparison" },
        ],
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: RUN_IDS[2],
        promptId: PROMPT_IDS.branded1,
        model: "google-ai-mode",
        version: "gemini-2.5-pro",
        webSearchEnabled: true,
        rawOutput: {
          response:
            "For AI monitoring, you might consider tools like Competitor Beta or Test Organization. Both offer features for tracking brand mentions in AI-generated content.",
        },
        textContent:
          "For AI monitoring, you might consider tools like Competitor Beta or Test Organization. Both offer features for tracking brand mentions in AI-generated content.",
        webQueries: ["best AI monitoring tools 2025", "brand visibility AI tracking"],
        brandMentioned: true,
        competitorsMentioned: ["Competitor Beta"],
        citations: [
          { url: "https://competitor-beta.com/pricing", domain: "competitor-beta.com", title: "Competitor Beta Pricing" },
          { url: "https://example.com/blog/ai-monitoring", domain: "example.com", title: "AI Monitoring Guide" },
          { url: "https://techblog.io/ai-tools-2025", domain: "techblog.io", title: "Best AI Tools 2025" },
        ],
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: RUN_IDS[3],
        promptId: PROMPT_IDS.branded1,
        model: "chatgpt",
        version: "gpt-4o",
        webSearchEnabled: true,
        rawOutput: {
          response:
            "I'd recommend looking into various AI monitoring platforms. Some popular options include dedicated brand tracking tools that monitor how LLMs reference your brand.",
        },
        textContent:
          "I'd recommend looking into various AI monitoring platforms. Some popular options include dedicated brand tracking tools that monitor how LLMs reference your brand.",
        webQueries: ["AI brand monitoring platforms"],
        brandMentioned: false,
        competitorsMentioned: [] as string[],
        citations: [] as { url: string; domain: string; title: string }[],
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: RUN_IDS[4],
        promptId: PROMPT_IDS.branded2,
        model: "chatgpt",
        version: "gpt-4o",
        webSearchEnabled: false,
        rawOutput: {
          response:
            "When comparing AI answer presence platforms, Test Organization stands out with its comprehensive prompt tracking and multi-model analysis capabilities.",
        },
        textContent:
          "When comparing AI answer presence platforms, Test Organization stands out with its comprehensive prompt tracking and multi-model analysis capabilities.",
        webQueries: [] as string[],
        brandMentioned: true,
        competitorsMentioned: [] as string[],
        citations: [
          { url: "https://example.com/features", domain: "example.com", title: "Test Organization Features" },
        ],
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: RUN_IDS[5],
        promptId: PROMPT_IDS.branded2,
        model: "claude",
        version: "claude-sonnet-4-6",
        webSearchEnabled: false,
        rawOutput: {
          response:
            "Several platforms offer AI answer presence tracking. Competitor Alpha and Competitor Beta are well-known options, each with different strengths in citation tracking.",
        },
        textContent:
          "Several platforms offer AI answer presence tracking. Competitor Alpha and Competitor Beta are well-known options, each with different strengths in citation tracking.",
        webQueries: [] as string[],
        brandMentioned: false,
        competitorsMentioned: ["Competitor Alpha", "Competitor Beta"],
        citations: [
          { url: "https://competitor-alpha.com/about", domain: "competitor-alpha.com", title: "About Competitor Alpha" },
          { url: "https://competitor-beta.com/features", domain: "competitor-beta.com", title: "Competitor Beta Features" },
        ],
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: RUN_IDS[6],
        promptId: PROMPT_IDS.unbranded1,
        model: "chatgpt",
        version: "gpt-4o-mini",
        webSearchEnabled: false,
        rawOutput: {
          response:
            "To optimize content for LLM citations, focus on creating authoritative, well-structured content with clear data points and references.",
        },
        textContent:
          "To optimize content for LLM citations, focus on creating authoritative, well-structured content with clear data points and references.",
        webQueries: [] as string[],
        brandMentioned: false,
        competitorsMentioned: [] as string[],
        citations: [
          { url: "https://searchenginejournal.com/llm-seo", domain: "searchenginejournal.com", title: "LLM SEO Guide" },
        ],
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: RUN_IDS[7],
        promptId: PROMPT_IDS.unbranded1,
        model: "claude",
        version: "claude-sonnet-4-6",
        webSearchEnabled: true,
        rawOutput: {
          response:
            "Optimizing for LLM citations involves several strategies including structured data markup, authoritative backlinks, and consistent brand messaging across your digital presence.",
        },
        textContent:
          "Optimizing for LLM citations involves several strategies including structured data markup, authoritative backlinks, and consistent brand messaging across your digital presence.",
        webQueries: ["how to get cited by AI models", "LLM citation optimization"],
        brandMentioned: false,
        competitorsMentioned: [] as string[],
        citations: [
          { url: "https://searchenginejournal.com/llm-seo", domain: "searchenginejournal.com", title: "LLM SEO Guide" },
          { url: "https://moz.com/blog/ai-citations", domain: "moz.com", title: "AI Citation Strategies" },
        ],
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const run of promptRuns) {
      await client.query(
        `INSERT INTO prompt_runs (id, prompt_id, brand_id, scope_id, model, version, web_search_enabled, raw_output, answer_text, web_queries, brand_mentioned, competitors_mentioned, observed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
        [
          run.id,
          run.promptId,
          TEST_BRAND_ID,
          TEST_SCOPE_ID,
          run.model,
          run.version,
          run.webSearchEnabled,
          JSON.stringify(run.rawOutput),
          run.textContent,
          run.webQueries,
          run.brandMentioned,
          run.competitorsMentioned,
          run.createdAt,
        ]
      );
    }
    console.log(`  Created ${promptRuns.length} prompt runs (Postgres)`);

    // -----------------------------------------------------------------------
    // 5. Insert citations into Postgres
    // -----------------------------------------------------------------------
    let citationCount = 0;
    for (const run of promptRuns) {
      for (let i = 0; i < run.citations.length; i++) {
        const c = run.citations[i];
        await client.query(
          `INSERT INTO citations (prompt_run_id, prompt_id, brand_id, model, url, domain, title, citation_index, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            run.id,
            run.promptId,
            TEST_BRAND_ID,
            run.model,
            c.url,
            c.domain,
            c.title,
            i,
            run.createdAt,
          ]
        );
        citationCount++;
      }
    }
    console.log(`  Created ${citationCount} citations (Postgres)`);

    // -----------------------------------------------------------------------
    // 6. Reports (mocked worker output — the worker itself is never invoked)
    // -----------------------------------------------------------------------
    const completedReportRawOutput = {
      competitors: [
        { name: "Competitor Alpha", domain: "competitor-alpha.com" },
        { name: "Competitor Beta", domain: "competitor-beta.com" },
      ],
      prompts: [
        { brandId: REPORT_IDS.completed, value: "What is the best AI monitoring tool for tracking brand visibility?", enabled: true, tags: [], systemTags: ["branded"] },
        { brandId: REPORT_IDS.completed, value: "Compare AI answer presence platforms and their features", enabled: true, tags: [], systemTags: ["unbranded"] },
      ],
      promptRuns: [
        {
          promptValue: "What is the best AI monitoring tool for tracking brand visibility?",
          runs: [
            { model: "chatgpt", version: "gpt-4o", webSearchEnabled: true, rawOutput: {}, webQueries: [], textContent: "Test Organization leads for AI brand monitoring.", brandMentioned: true, competitorsMentioned: ["Competitor Alpha"] },
            { model: "claude", version: "claude-sonnet-4-6", webSearchEnabled: false, rawOutput: {}, webQueries: [], textContent: "Test Organization is a strong option.", brandMentioned: true, competitorsMentioned: [] },
            { model: "google-ai-mode", version: "gemini-2.5-pro", webSearchEnabled: true, rawOutput: {}, webQueries: [], textContent: "Options include Competitor Alpha and Competitor Beta.", brandMentioned: false, competitorsMentioned: ["Competitor Alpha", "Competitor Beta"] },
          ],
        },
        {
          promptValue: "Compare AI answer presence platforms and their features",
          runs: [
            { model: "chatgpt", version: "gpt-4o", webSearchEnabled: false, rawOutput: {}, webQueries: [], textContent: "Test Organization stands out.", brandMentioned: true, competitorsMentioned: [] },
          ],
        },
      ],
    };

    await client.query(
      `INSERT INTO reports (id, brand_name, brand_website, status, progress, raw_output, created_at, completed_at, updated_at)
       VALUES ($1, $2, $3, 'completed', 100, $4, NOW(), NOW(), NOW())`,
      [REPORT_IDS.completed, TEST_BRAND_NAME, TEST_BRAND_WEBSITE, JSON.stringify(completedReportRawOutput)],
    );

    // Non-completed rows: exercise the status-only branch and list pagination.
    for (const [id, status, progress] of [
      [REPORT_IDS.pending, "pending", 0],
      [REPORT_IDS.processing, "processing", 45],
      [REPORT_IDS.failed, "failed", 20],
    ] as const) {
      await client.query(
        `INSERT INTO reports (id, brand_name, brand_website, status, progress, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [id, TEST_BRAND_NAME, TEST_BRAND_WEBSITE, status, progress],
      );
    }
    console.log("  Created 4 reports (1 completed, 1 pending, 1 processing, 1 failed)");

    // -----------------------------------------------------------------------
    // 7. Second tenant (Nike) — a brand in an org the E2E user is NOT a
    //    member of. Invisible to the org-scoped dashboard; still visible to
    //    the admin API key (Plan 004 uses this for access-control tests).
    // -----------------------------------------------------------------------
    await client.query(
      `INSERT INTO organization (id, name, slug, created_at)
       VALUES ($1, 'Nike', $1, NOW()) ON CONFLICT (id) DO NOTHING`,
      [NIKE_ORG_ID],
    );
    await client.query(
      `INSERT INTO brands (id, organization_id, name, website, additional_domains, aliases, enabled, onboarded, created_at, updated_at)
       VALUES ($1, $2, 'Nike', 'https://nike.com', $3, $4, true, true, NOW(), NOW())`,
      [NIKE_BRAND_ID, NIKE_ORG_ID, ["jordan.com", "converse.com"], ["Just Do It", "Swoosh", "Air Jordan"]],
    );
    await client.query(
      `INSERT INTO measurement_scopes
         (id, brand_id, key, name, market, locale, timezone, automatic_target_keys, enabled, is_default, created_at, updated_at)
       VALUES ($1, $2, 'legacy-unspecified', 'Legacy / Unspecified', 'ZZ', 'und', 'UTC', NULL, true, true, NOW(), NOW())`,
      [NIKE_SCOPE_ID, NIKE_BRAND_ID],
    );

    const nikePrompts = [
      { id: NIKE_PROMPT_IDS.training, value: "Best weightlifting shoes for squats and deadlifts", tags: ["training"] },
      { id: NIKE_PROMPT_IDS.lifestyle, value: "Best white leather sneakers for everyday wear", tags: ["lifestyle"] },
    ];
    for (const p of nikePrompts) {
      await client.query(
        `INSERT INTO prompts (id, brand_id, scope_id, value, enabled, tags, system_tags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, $5, '{}', NOW(), NOW())`,
        [p.id, NIKE_BRAND_ID, NIKE_SCOPE_ID, p.value, p.tags],
      );
    }

    const nikeCompetitors = [
      { id: NIKE_COMPETITOR_IDS.adidas, name: "Adidas", domains: ["adidas.com"], aliases: ["Three Stripes"] },
      { id: NIKE_COMPETITOR_IDS.puma, name: "Puma", domains: ["puma.com"], aliases: ["Puma SE"] },
    ];
    for (const c of nikeCompetitors) {
      await client.query(
        `INSERT INTO competitors (id, brand_id, name, domains, aliases, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [c.id, NIKE_BRAND_ID, c.name, c.domains, c.aliases],
      );
    }

    // A couple of realistic prompt runs + citations for the training prompt.
    const nikeRunId = "00000000-0000-0000-0000-420000000001";
    await client.query(
      `INSERT INTO prompt_runs (id, prompt_id, brand_id, scope_id, model, provider, version, web_search_enabled, raw_output, answer_text, web_queries, brand_mentioned, competitors_mentioned, observed_at, created_at)
       VALUES ($1, $2, $3, $4, 'chatgpt', 'brightdata', 'gpt-5-5', true, $5, $6, $7, true, $8, NOW(), NOW())`,
      [
        nikeRunId,
        NIKE_PROMPT_IDS.training,
        NIKE_BRAND_ID,
        NIKE_SCOPE_ID,
        JSON.stringify({ response: "Nike Metcon and Romaleos are top picks; Adidas Powerlift is an alternative." }),
        "Nike Metcon and Romaleos are top picks; Adidas Powerlift is an alternative.",
        ["best weightlifting shoes"],
        ["Adidas"],
      ],
    );
    for (const [i, cite] of [
      { url: "https://runrepeat.com/best-weightlifting-shoes", domain: "runrepeat.com", title: "Best Weightlifting Shoes" },
      { url: "https://www.nike.com/training", domain: "nike.com", title: "Nike Training" },
    ].entries()) {
      await client.query(
        `INSERT INTO citations (prompt_run_id, prompt_id, brand_id, model, url, domain, title, citation_index, created_at)
         VALUES ($1, $2, $3, 'chatgpt', $4, $5, $6, $7, NOW())`,
        [nikeRunId, NIKE_PROMPT_IDS.training, NIKE_BRAND_ID, cite.url, cite.domain, cite.title, i],
      );
    }
    console.log("  Created second tenant: Nike (brand, 2 prompts, 2 competitors, 1 run, 2 citations)");

    console.log("\nE2E database seeding complete!");
    console.log(`  Brand: ${TEST_BRAND_ID} (${TEST_BRAND_NAME})`);
    console.log(`  Prompts: ${promptData.length}`);
    console.log(`  Competitors: ${competitorData.length}`);
    console.log(`  Prompt Runs: ${promptRuns.length}`);
  } finally {
    await client.end();
  }
}

async function seedResponseSnapshotFixtures(client: pg.Client): Promise<void> {
  const now = new Date();
  const hour = 60 * 60 * 1_000;
  const day = 24 * hour;
  const retention = 90 * day;
  const snapshotExportDay = beijingNoonDaysAgo(now, STEPFUN_SNAPSHOT_EXPORT_DAYS_AGO);
  const stepfunRuns = [
    {
      id: STEPFUN_SNAPSHOT_RUN_IDS.nativeHtml,
      model: "chatgpt",
      provider: "brightdata",
      version: "gpt-5",
      answerText: "StepFun appears in this overseas native HTML answer.",
      observedAt: snapshotExportDay,
      brandMentioned: true,
      webQueries: ["StepFun AI company"],
    },
    {
      id: STEPFUN_SNAPSHOT_RUN_IDS.renderedFallback,
      model: "perplexity",
      provider: "brightdata",
      version: "sonar",
      answerText: "This overseas structured response is archived with deterministic fallback HTML.",
      observedAt: new Date(snapshotExportDay.getTime() + hour),
      brandMentioned: false,
      webQueries: ["Chinese foundation model companies"],
    },
    {
      id: STEPFUN_SNAPSHOT_RUN_IDS.domesticBrowser,
      model: "doubao",
      provider: "browser-runner",
      version: "consumer-web",
      answerText: "豆包回答：阶跃星辰（StepFun）是一家人工智能公司。",
      observedAt: new Date(snapshotExportDay.getTime() + 2 * hour),
      brandMentioned: true,
      webQueries: [],
    },
    {
      id: STEPFUN_SNAPSHOT_RUN_IDS.pending,
      model: "deepseek",
      provider: "browser-runner",
      version: "consumer-web",
      answerText: "The metric run succeeded while its archive is still pending.",
      observedAt: new Date(now.getTime() - 3 * hour),
      brandMentioned: false,
      webQueries: [],
    },
    {
      id: STEPFUN_SNAPSHOT_RUN_IDS.failed,
      model: "deepseek",
      provider: "browser-runner",
      version: "consumer-web",
      answerText: "StepFun remains a valid metric observation even though snapshot storage failed.",
      observedAt: new Date(now.getTime() - 2 * hour),
      brandMentioned: true,
      webQueries: [],
    },
    {
      id: STEPFUN_SNAPSHOT_RUN_IDS.expired,
      model: "deepseek",
      provider: "browser-runner",
      version: "consumer-web",
      answerText: "This archived response is represented as expired.",
      observedAt: new Date(now.getTime() - 2 * day),
      brandMentioned: false,
      webQueries: [],
    },
  ] as const;

  for (const run of stepfunRuns) {
    await client.query(
      `INSERT INTO prompt_runs
         (id, prompt_id, brand_id, scope_id, model, provider, version,
          surface_target_key, capture_route_key, web_search_enabled,
          raw_output, answer_text, web_queries, brand_mentioned,
          competitors_mentioned, observed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true,
               $10, $11, $12, $13, '{}', $14, $14)`,
      [
        run.id,
        STEPFUN_PROMPT_ID,
        STEPFUN_BRAND_ID,
        STEPFUN_SCOPE_ID,
        run.model,
        run.provider,
        run.version,
        `${run.model}.consumer_web`,
        run.provider === "brightdata" ? "brightdata.dataset" : "browser_runner.consumer_web",
        JSON.stringify({ response: run.answerText }),
        run.answerText,
        run.webQueries,
        run.brandMentioned,
        run.observedAt,
      ],
    );
  }

  const memtensorObservedAt = new Date(now.getTime() - hour);
  await client.query(
    `INSERT INTO prompt_runs
       (id, prompt_id, brand_id, scope_id, model, provider, version,
        surface_target_key, capture_route_key, web_search_enabled,
        raw_output, answer_text, web_queries, brand_mentioned,
        competitors_mentioned, observed_at, created_at)
     VALUES ($1, $2, $3, $4, 'chatgpt', 'brightdata', 'gpt-5',
             'chatgpt.consumer_web', 'brightdata.dataset', true,
             $5, $6, '{}', true, '{}', $7, $7)`,
    [
      MEMTENSOR_RUN_ID,
      MEMTENSOR_PROMPT_ID,
      MEMTENSOR_BRAND_ID,
      MEMTENSOR_SCOPE_ID,
      JSON.stringify({ response: "MemTensor belongs to another tenant." }),
      "MemTensor belongs to another tenant.",
      memtensorObservedAt,
    ],
  );

  const storageRoot = resolve(process.cwd(), ".snapshot-fixtures");
  await mkdir(storageRoot, { recursive: true });
  for (const brandId of [STEPFUN_BRAND_ID, MEMTENSOR_BRAND_ID]) {
    const brandRoot = resolve(storageRoot, brandId);
    const pathFromRoot = relative(storageRoot, brandRoot);
    if (!pathFromRoot || pathFromRoot.startsWith("..")) {
      throw new Error("Unsafe E2E response snapshot fixture path");
    }
    await rm(brandRoot, { recursive: true, force: true });
  }
  const storage = new FilesystemResponseSnapshotStorage(storageRoot);

  await seedReadyResponseSnapshot(client, storage, {
    snapshotId: STEPFUN_SNAPSHOT_IDS.nativeHtml,
    runId: STEPFUN_SNAPSHOT_RUN_IDS.nativeHtml,
    brandId: STEPFUN_BRAND_ID,
    scopeId: STEPFUN_SCOPE_ID,
    promptId: STEPFUN_PROMPT_ID,
    promptText: "国内有哪些主流大模型公司？",
    answerText: stepfunRuns[0].answerText,
    answerHtml:
      '<article onclick="fetch(\'https://attacker.invalid/click\')"><h2>StepFun archive</h2><script>fetch("https://attacker.invalid/script")</script><img src="https://attacker.invalid/pixel"><p>Sanitized native answer.</p></article>',
    citations: [
      { url: "https://www.stepfun.com/", title: "StepFun", domain: "stepfun.com", citationIndex: 0 },
    ],
    webQueries: [...stepfunRuns[0].webQueries],
    queryAvailability: "available",
    brandMentioned: true,
    competitorsMentioned: [],
    channel: "chatgpt",
    modelVersion: "gpt-5",
    market: "US",
    locale: "en-US",
    timezone: "America/New_York",
    observedAt: stepfunRuns[0].observedAt.toISOString(),
    captureMethod: "brightdata_dataset",
    contentSource: "native_answer_html",
  });
  await seedReadyResponseSnapshot(client, storage, {
    snapshotId: STEPFUN_SNAPSHOT_IDS.renderedFallback,
    runId: STEPFUN_SNAPSHOT_RUN_IDS.renderedFallback,
    brandId: STEPFUN_BRAND_ID,
    scopeId: STEPFUN_SCOPE_ID,
    promptId: STEPFUN_PROMPT_ID,
    promptText: "国内有哪些主流大模型公司？",
    answerText: stepfunRuns[1].answerText,
    citations: [
      { url: "https://example.com/fallback", title: "Structured source", domain: "example.com", citationIndex: 0 },
    ],
    webQueries: [...stepfunRuns[1].webQueries],
    queryAvailability: "available",
    brandMentioned: false,
    competitorsMentioned: [],
    channel: "perplexity",
    modelVersion: "sonar",
    market: "US",
    locale: "en-US",
    timezone: "America/New_York",
    observedAt: stepfunRuns[1].observedAt.toISOString(),
    captureMethod: "brightdata_dataset",
    contentSource: "rendered_from_structured_response",
  });
  await seedReadyResponseSnapshot(client, storage, {
    snapshotId: STEPFUN_SNAPSHOT_IDS.domesticBrowser,
    runId: STEPFUN_SNAPSHOT_RUN_IDS.domesticBrowser,
    brandId: STEPFUN_BRAND_ID,
    scopeId: STEPFUN_SCOPE_ID,
    promptId: STEPFUN_PROMPT_ID,
    promptText: "国内有哪些主流大模型公司？",
    answerText: stepfunRuns[2].answerText,
    answerHtml: "<section><h2>豆包回答</h2><p>阶跃星辰（StepFun）是一家人工智能公司。</p></section>",
    citations: [],
    webQueries: [],
    queryAvailability: "unavailable",
    brandMentioned: true,
    competitorsMentioned: [],
    channel: "doubao",
    modelVersion: "consumer-web",
    market: "CN",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    observedAt: stepfunRuns[2].observedAt.toISOString(),
    captureMethod: "consumer_web_browser",
    contentSource: "browser_answer_html",
  });
  await seedReadyResponseSnapshot(client, storage, {
    snapshotId: STEPFUN_SNAPSHOT_IDS.expired,
    runId: STEPFUN_SNAPSHOT_RUN_IDS.expired,
    brandId: STEPFUN_BRAND_ID,
    scopeId: STEPFUN_SCOPE_ID,
    promptId: STEPFUN_PROMPT_ID,
    promptText: "国内有哪些主流大模型公司？",
    answerText: stepfunRuns[5].answerText,
    citations: [],
    webQueries: [],
    queryAvailability: "unavailable",
    brandMentioned: false,
    competitorsMentioned: [],
    channel: "deepseek",
    modelVersion: "consumer-web",
    market: "CN",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    observedAt: stepfunRuns[5].observedAt.toISOString(),
    captureMethod: "consumer_web_browser",
    contentSource: "rendered_from_structured_response",
  }, "expired", new Date(now.getTime() - day));
  await seedReadyResponseSnapshot(client, storage, {
    snapshotId: MEMTENSOR_SNAPSHOT_ID,
    runId: MEMTENSOR_RUN_ID,
    brandId: MEMTENSOR_BRAND_ID,
    scopeId: MEMTENSOR_SCOPE_ID,
    promptId: MEMTENSOR_PROMPT_ID,
    promptText: "MemTensor 是什么？",
    answerText: "MemTensor belongs to another tenant.",
    citations: [],
    webQueries: [],
    queryAvailability: "unavailable",
    brandMentioned: true,
    competitorsMentioned: [],
    channel: "chatgpt",
    modelVersion: "gpt-5",
    market: "CN",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    observedAt: memtensorObservedAt.toISOString(),
    captureMethod: "brightdata_dataset",
    contentSource: "rendered_from_structured_response",
  });

  await client.query(
    `INSERT INTO response_snapshots
       (id, prompt_run_id, brand_id, scope_id, prompt_id, status,
        observed_at, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $6, $7)`,
    [
      STEPFUN_SNAPSHOT_IDS.pending,
      STEPFUN_SNAPSHOT_RUN_IDS.pending,
      STEPFUN_BRAND_ID,
      STEPFUN_SCOPE_ID,
      STEPFUN_PROMPT_ID,
      stepfunRuns[3].observedAt,
      new Date(stepfunRuns[3].observedAt.getTime() + retention),
    ],
  );
  await client.query(
    `INSERT INTO response_snapshots
       (id, prompt_run_id, brand_id, scope_id, prompt_id, status,
        failure_code, observed_at, created_at, failed_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'failed', 'fixture_storage_failure',
             $6, $6, $7, $8)`,
    [
      STEPFUN_SNAPSHOT_IDS.failed,
      STEPFUN_SNAPSHOT_RUN_IDS.failed,
      STEPFUN_BRAND_ID,
      STEPFUN_SCOPE_ID,
      STEPFUN_PROMPT_ID,
      stepfunRuns[4].observedAt,
      now,
      new Date(stepfunRuns[4].observedAt.getTime() + retention),
    ],
  );
  console.log("  Created response snapshot fixtures: 4 ready, 1 pending, 1 failed, 1 expired");
}

function beijingNoonDaysAgo(now: Date, daysAgo: number): Date {
  const beijingDate = new Date(now.getTime() + 8 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const result = new Date(`${beijingDate}T04:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() - daysAgo);
  return result;
}

async function seedReadyResponseSnapshot(
  client: pg.Client,
  storage: FilesystemResponseSnapshotStorage,
  draft: ResponseSnapshotDraft & { snapshotId: string },
  status: "ready" | "expired" = "ready",
  expiresAt = new Date(new Date(draft.observedAt).getTime() + 90 * 24 * 60 * 60 * 1_000),
): Promise<void> {
  const { snapshotId, ...snapshotDraft } = draft;
  const bundle = prepareResponseSnapshotBundle(snapshotDraft);
  const stored = await storage.put(bundle, 1);
  const readyAt = new Date();
  await client.query(
    `INSERT INTO response_snapshots
       (id, prompt_run_id, brand_id, scope_id, prompt_id, revision, is_current,
        status, storage_backend, storage_key, content_source, capture_method,
        schema_version, template_version, html_sha256, json_sha256,
        manifest_sha256, source_payload_sha256, html_bytes, json_bytes,
        manifest_bytes, html_gzip_bytes, json_gzip_bytes, observed_at,
        created_at, ready_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, 1, true, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
             $22, $22, $23, $24)`,
    [
      snapshotId,
      snapshotDraft.runId,
      snapshotDraft.brandId,
      snapshotDraft.scopeId,
      snapshotDraft.promptId,
      status,
      stored.storageBackend,
      stored.storageKey,
      bundle.contentSource,
      bundle.captureMethod,
      bundle.schemaVersion,
      bundle.templateVersion,
      stored.htmlSha256,
      stored.jsonSha256,
      stored.manifestSha256,
      bundle.sourcePayloadSha256,
      stored.htmlBytes,
      stored.jsonBytes,
      stored.manifestBytes,
      stored.htmlGzipBytes,
      stored.jsonGzipBytes,
      new Date(bundle.observedAt),
      readyAt,
      expiresAt,
    ],
  );
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
