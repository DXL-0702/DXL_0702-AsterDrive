import { useEffect } from "react";
import { config } from "@/config/app";
import { invalidateBlobUrl } from "@/hooks/useBlobUrl";
import { invalidateTextContent } from "@/hooks/useTextContent";
import { joinApiUrl } from "@/lib/apiUrl";
import { logger } from "@/lib/logger";
import {
	deferStorageRefresh,
	isStorageRefreshGateActive,
} from "@/lib/storageRefreshGate";
import type { Workspace } from "@/lib/workspace";
import { fileService } from "@/services/fileService";
import { useAuthStore } from "@/stores/authStore";
import { useFileStore } from "@/stores/fileStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

type StorageChangeWorkspace =
	| { kind: "personal" }
	| { kind: "team"; team_id: number };

type StorageChangeKind =
	| "file.created"
	| "file.updated"
	| "file.deleted"
	| "file.restored"
	| "folder.created"
	| "folder.updated"
	| "folder.deleted"
	| "folder.restored"
	| "sync.required";

interface StorageChangeEventPayload {
	kind: StorageChangeKind;
	workspace?: StorageChangeWorkspace | null;
	file_ids: number[];
	folder_ids: number[];
	affected_parent_ids: number[];
	root_affected: boolean;
	at: string;
}

function eventMatchesWorkspace(
	eventWorkspace: StorageChangeWorkspace | null | undefined,
	workspace: Workspace,
) {
	if (!eventWorkspace) {
		return true;
	}
	if (workspace.kind === "personal") {
		return eventWorkspace.kind === "personal";
	}
	return (
		eventWorkspace.kind === "team" &&
		eventWorkspace.team_id === workspace.teamId
	);
}

function shouldRefreshCurrentFolder(event: StorageChangeEventPayload) {
	const { currentFolderId, breadcrumb, searchQuery } = useFileStore.getState();
	if (searchQuery) {
		return false;
	}
	if (event.root_affected && currentFolderId === null) {
		return true;
	}
	if (
		currentFolderId !== null &&
		(event.affected_parent_ids.includes(currentFolderId) ||
			event.folder_ids.includes(currentFolderId))
	) {
		return true;
	}
	return breadcrumb.some(
		(item) => item.id !== null && event.folder_ids.includes(item.id),
	);
}

async function refreshCurrentFolder() {
	const { currentFolderId, navigateTo } = useFileStore.getState();
	try {
		await navigateTo(currentFolderId);
	} catch {
		await navigateTo(null);
	}
}

function invalidatePreviewCaches(fileIds: number[]) {
	for (const fileId of fileIds) {
		invalidateTextContent(fileService.downloadPath(fileId));
		invalidateBlobUrl(fileService.downloadPath(fileId));
		invalidateBlobUrl(fileService.thumbnailPath(fileId));
	}
}

export function useStorageChangeEvents() {
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const storageEventStreamEnabled = useAuthStore(
		(state) => state.user?.preferences?.storage_event_stream_enabled !== false,
	);

	useEffect(() => {
		if (
			!isAuthenticated ||
			!storageEventStreamEnabled ||
			typeof EventSource === "undefined"
		) {
			return;
		}

		const source = new EventSource(
			joinApiUrl(config.apiBaseUrl, "/auth/events/storage"),
			{
				withCredentials: true,
			},
		);

		source.onmessage = (message) => {
			let event: StorageChangeEventPayload;
			try {
				event = JSON.parse(message.data) as StorageChangeEventPayload;
			} catch (error) {
				logger.warn("failed to parse storage change event", error);
				return;
			}

			const workspace = useWorkspaceStore.getState().workspace;
			if (!eventMatchesWorkspace(event.workspace, workspace)) {
				return;
			}

			if (event.kind === "sync.required") {
				invalidateBlobUrl();
				invalidateTextContent();
				if (!useFileStore.getState().searchQuery) {
					if (isStorageRefreshGateActive()) {
						deferStorageRefresh();
						return;
					}
					void refreshCurrentFolder();
				}
				return;
			}

			invalidatePreviewCaches(event.file_ids);
			if (shouldRefreshCurrentFolder(event)) {
				if (isStorageRefreshGateActive()) {
					deferStorageRefresh();
					return;
				}
				void refreshCurrentFolder();
			}
		};

		source.onerror = (error) => {
			logger.debug("storage change event stream error", error);
		};

		return () => {
			source.close();
		};
	}, [isAuthenticated, storageEventStreamEnabled]);
}
