import { listUndispatchedOverseasRunCalls, markOverseasRunCallDispatched } from "@workspace/lib/db/overseas-runs";
import { getBoss } from "../lib/boss-client";

export const OVERSEAS_RUN_QUEUE = "process-overseas-run-call";

interface DispatchDependencies {
	listUndispatched(cohortId: string): Promise<readonly { id: string }[]>;
	send(
		name: string,
		data: { cohortId: string; callId: string },
		options: { singletonKey: string; retryLimit: number; expireInSeconds: number },
	): Promise<string | null>;
	markDispatched(callId: string): Promise<boolean>;
}

export async function dispatchOverseasRunCalls(cohortId: string, dependencies?: DispatchDependencies) {
	const deps = dependencies ?? (await productionDependencies());
	const calls = await deps.listUndispatched(cohortId);
	const result = { planned: calls.length, dispatched: 0, alreadyDispatched: 0, failed: 0 };
	for (const call of calls) {
		try {
			const jobId = await deps.send(
				OVERSEAS_RUN_QUEUE,
				{ cohortId, callId: call.id },
				{
					singletonKey: `overseas-run-call-${call.id}`,
					retryLimit: 0,
					expireInSeconds: 60 * 20,
				},
			);
			if (!(await deps.markDispatched(call.id))) {
				result.failed += 1;
				continue;
			}
			if (jobId === null) result.alreadyDispatched += 1;
			else result.dispatched += 1;
		} catch {
			result.failed += 1;
		}
	}
	return result;
}

async function productionDependencies(): Promise<DispatchDependencies> {
	const boss = await getBoss();
	return {
		listUndispatched: listUndispatchedOverseasRunCalls,
		send: (name, data, options) => boss.send(name, data, options),
		markDispatched: (callId) => markOverseasRunCallDispatched({ callId }),
	};
}
