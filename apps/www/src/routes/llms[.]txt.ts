import { createFileRoute } from "@tanstack/react-router";

const llmsTxt = `# Yonaris

> Yonaris is a self-hosted AI visibility platform for measuring how answer engines mention brands, cite sources, and compare competitors.

Yonaris supports repeatable Generative Engine Optimization (GEO) and Answer Engine Optimization (AEO) baselines. It runs a controlled prompt set across configured AI providers, records responses and citations, and turns those observations into auditable visibility trends.

## Product

- [Yonaris](/): AI visibility monitoring, citations, competitor benchmarking, and query fan-out analysis.
- [Features](/features): Product capabilities and supported workflows.
- [Provider Status](/status): Current status of configured AI provider integrations.
- [Documentation](/docs): Setup and operating guides.
- [API Reference](/docs/api): Administrative API reference.

## Resources

- [AI Visibility Tool Directory](/ai-visibility-tools): Research and comparisons across AI visibility tools.
- [Glossary](/glossary): GEO, AEO, and AI search terminology.
- [AI Search Guides](/ai-search): Guides for major AI answer engines.
- [llms-full.txt](/llms-full.txt): Full documentation text for language-model clients.

## Open-source attribution

- [Upstream source: Elmo](https://github.com/elmohq/elmo): Yonaris is based on the open-source Elmo project.
`;

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET() {
				return new Response(llmsTxt, {
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			},
		},
	},
});
