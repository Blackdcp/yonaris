import contract from "../selector-contracts/deepseek-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";

export const deepSeekSelectorContract = contract as SelectorContract;

export function createDeepSeekAdapter(
	port: ConsumerDomPort,
	selectorContract: SelectorContract = deepSeekSelectorContract,
): ConsumerWebAdapter {
	return createConsumerAdapter(port, selectorContract);
}
