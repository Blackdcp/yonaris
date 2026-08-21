import contract from "../selector-contracts/qwen-web-v2.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";

export const qwenSelectorContract = contract as SelectorContract;

export function createQwenAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, qwenSelectorContract);
}
