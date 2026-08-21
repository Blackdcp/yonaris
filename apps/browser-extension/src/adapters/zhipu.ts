import contract from "../selector-contracts/zhipu-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";

export const zhipuSelectorContract = contract as SelectorContract;

export function createZhipuAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, zhipuSelectorContract);
}
