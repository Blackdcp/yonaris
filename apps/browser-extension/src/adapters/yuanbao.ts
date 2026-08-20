import contract from "../selector-contracts/yuanbao-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";

export const yuanbaoSelectorContract = contract as SelectorContract;

export function createYuanbaoAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, yuanbaoSelectorContract);
}
