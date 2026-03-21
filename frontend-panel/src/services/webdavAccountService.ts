import { api } from "./http";
import type { WebdavAccountInfo, WebdavAccountCreated } from "@/types/api";

export const webdavAccountService = {
	list: () => api.get<WebdavAccountInfo[]>("/webdav-accounts"),

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
