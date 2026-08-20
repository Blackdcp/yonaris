import contract from "../selector-contracts/doubao-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./contracts";

export const doubaoSelectorContract = contract as SelectorContract;

export function createDoubaoAdapter(port: ConsumerDomPort): ConsumerWebAdapter {
	return createConsumerAdapter(port, doubaoSelectorContract);
}
