import type { Decorator } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../src/styles.css";

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

const withQueryClient: Decorator = (Story) => (
	<QueryClientProvider client={queryClient}>
		<Story />
	</QueryClientProvider>
);

const withBrandTheme: Decorator = (Story, context) => {
	const brandProfile = context.id.includes("whitelabel") ? "custom" : "yonaris";

	return (
		<div data-brand={brandProfile} className="min-h-svh bg-background text-foreground">
			<Story />
		</div>
	);
};

export const decorators: Decorator[] = [withBrandTheme, withQueryClient];
