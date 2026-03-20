import { api } from "./http";
import type { FileInfo, FolderInfo, FolderContents } from "@/types/api";
import { config } from "@/config/app";

export const fileService = {
	listRoot: () => api.get<FolderContents>("/folders"),

	listFolder: (id: number) => api.get<FolderContents>(`/folders/${id}`),

	createFolder: (name: string, parentId?: number | null) =>
		api.post<FolderInfo>("/folders", { name, parent_id: parentId ?? null }),

	deleteFolder: (id: number) => api.delete<void>(`/folders/${id}`),

	renameFolder: (id: number, name: string) =>
		api.patch<FolderInfo>(`/folders/${id}`, { name }),

	getFile: (id: number) => api.get<FileInfo>(`/files/${id}`),

	deleteFile: (id: number) => api.delete<void>(`/files/${id}`),

	renameFile: (id: number, name: string) =>
		api.patch<FileInfo>(`/files/${id}`, { name }),

	downloadUrl: (id: number) => `${config.apiBaseUrl}/files/${id}/download`,
};
