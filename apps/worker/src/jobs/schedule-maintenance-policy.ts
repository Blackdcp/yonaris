export interface AutomaticExecutionScope {
	enabled: boolean;
	automaticTargetKeys: string[] | null;
}

/**
 * An empty target list is the durable manual-only contract. A null list is the
 * platform-managed legacy configuration, while a non-empty list is an explicit
 * platform target selection. Prompts without a stored scope fail closed.
 */
export function isAutomaticExecutionActivated(scope: AutomaticExecutionScope | undefined): boolean {
	return scope?.enabled === true && (scope.automaticTargetKeys === null || scope.automaticTargetKeys.length > 0);
}
