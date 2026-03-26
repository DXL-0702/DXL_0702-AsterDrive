import { api } from "@/services/http";
import type { AuditLogPage } from "@/types/api";

interface AuditLogQuery {
	user_id?: number;
	action?: string;
	entity_type?: string;
	after?: string;
	before?: string;
	limit?: number;
	offset?: number;
}

export const auditService = {
	list: (params: AuditLogQuery = {}) => {
		const query = new URLSearchParams();
		if (params.limit !== undefined && params.limit !== null) {
			query.set("limit", String(params.limit));
		}
		if (params.offset !== undefined && params.offset !== null) {
			query.set("offset", String(params.offset));
		}
		for (const [key, value] of Object.entries(params)) {
			if (key === "limit" || key === "offset") continue;
			if (value !== undefined && value !== null && value !== "") {
				query.set(key, String(value));
			}
		}
		const suffix = query.toString();
		return api.get<AuditLogPage>(
			suffix ? `/admin/audit-logs?${suffix}` : "/admin/audit-logs",
		);
	},
};
