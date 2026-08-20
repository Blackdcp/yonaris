import contract from "../selector-contracts/kimi-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";

export const kimiSelectorContract = contract as SelectorContract;

export function createKimiAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, kimiSelectorContract);
}
