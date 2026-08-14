export type LocalDemoImportScopePromotion = {
	brandId: string;
	scopeId: string;
};

export function buildLocalDemoDefaultScopePromotion(input: {
	brandId: string;
	scopeId: string;
	importId: string;
	source: string;
}): LocalDemoImportScopePromotion {
	if (input.importId !== "stepfun-local-pc-doubao-demo-20260814" || input.source !== "local_pc_demo") {
		throw new Error("unsupported_local_demo_default_scope_promotion");
	}
	return { brandId: input.brandId, scopeId: input.scopeId };
}
