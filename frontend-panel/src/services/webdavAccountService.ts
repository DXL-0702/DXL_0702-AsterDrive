import type {
	WebdavAccountCreated,
	WebdavAccountInfo,
	WebdavAccountPage,
} from "@/types/api";
import { api } from "./http";

export interface WebdavSettings {
	prefix: string;
}

export const webdavAccountService = {
	settings: () => api.get<WebdavSettings>("/webdav-accounts/settings"),

	list: (params?: { limit?: number; offset?: number }) => {
		const query = new URLSearchParams();
		if (params?.limit != null) query.set("limit", String(params.limit));
		if (params?.offset != null) query.set("offset", String(params.offset));
		const suffix = query.toString();
		return api.get<WebdavAccountPage>(
			suffix ? `/webdav-accounts?${suffix}` : "/webdav-accounts",
		);
	},

	create: (username: string, password?: string, rootFolderId?: number) =>
		api.post<WebdavAccountCreated>("/webdav-accounts", {
			username,
			password,
			root_folder_id: rootFolderId ?? null,
		}),

	delete: (id: number) => api.delete<void>(`/webdav-accounts/${id}`),

	toggle: (id: number) =>
		api.post<WebdavAccountInfo>(`/webdav-accounts/${id}/toggle`),

	test: (username: string, password: string) =>
		api.post<void>("/webdav-accounts/test", { username, password }),
};
