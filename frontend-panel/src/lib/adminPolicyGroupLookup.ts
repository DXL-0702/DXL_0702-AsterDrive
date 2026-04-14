import { adminPolicyGroupService } from "@/services/adminService";
import type { StoragePolicyGroup } from "@/types/api";

export const ADMIN_POLICY_GROUP_LOOKUP_LIMIT = 100;

let cachedPolicyGroups: StoragePolicyGroup[] | null = null;
let pendingPolicyGroupRequest: Promise<StoragePolicyGroup[]> | null = null;

export function readAdminPolicyGroupLookup() {
	return cachedPolicyGroups;
}

export function primeAdminPolicyGroupLookup(
	policyGroups: StoragePolicyGroup[],
) {
	cachedPolicyGroups = policyGroups;
}

export function invalidateAdminPolicyGroupLookup() {
	cachedPolicyGroups = null;
	pendingPolicyGroupRequest = null;
}

export async function loadAdminPolicyGroupLookup(options?: {
	force?: boolean;
	limit?: number;
}) {
	const force = options?.force ?? false;
	const limit = options?.limit ?? ADMIN_POLICY_GROUP_LOOKUP_LIMIT;

	if (!force && cachedPolicyGroups != null) {
		return cachedPolicyGroups;
	}

	if (!force && pendingPolicyGroupRequest != null) {
		return pendingPolicyGroupRequest;
	}

	pendingPolicyGroupRequest = adminPolicyGroupService
		.listAll(limit)
		.then((policyGroups) => {
			cachedPolicyGroups = policyGroups;
			return policyGroups;
		})
		.finally(() => {
			pendingPolicyGroupRequest = null;
		});

	return pendingPolicyGroupRequest;
}
