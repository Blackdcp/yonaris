import contract from "../selector-contracts/wenxin-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";

export const wenxinSelectorContract = contract as SelectorContract;

export function createWenxinAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, wenxinSelectorContract);
}
