import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect } from "react";
import {
	getProcessingProgress,
	getResumePlan,
	type UploadMode,
} from "@/components/files/uploadResume";
import { logger } from "@/lib/logger";
import {
	loadSessions,
	type ResumableSession,
	removeSession,
} from "@/lib/uploadPersistence";
import type { Workspace } from "@/lib/workspace";
import { workspaceKey } from "@/lib/workspace";
import type { CompletedPart } from "@/services/uploadService";
import { uploadService } from "@/services/uploadService";
import {
	createTaskId,
	mapAllSettledWithConcurrency,
	RESTORE_PROGRESS_CONCURRENCY,
	shouldRemovePersistedSession,
	type UploadAreaManagerTranslationFn,
	type UploadTask,
} from "./uploadAreaManagerShared";

interface UseUploadAreaRestoreOptions {
	restoredWorkspaceKeysRef: MutableRefObject<Set<string>>;
	resumeCompletionTask: (
		task: UploadTask,
		parts?: CompletedPart[],
	) => Promise<void>;
	setTasks: Dispatch<SetStateAction<UploadTask[]>>;
	setUploadPanelOpen: Dispatch<SetStateAction<boolean>>;
	t: UploadAreaManagerTranslationFn;
	workspace: Workspace;
}

export function useUploadAreaRestore({
	restoredWorkspaceKeysRef,
	resumeCompletionTask,
	setTasks,
	setUploadPanelOpen,
	t,
	workspace,
}: UseUploadAreaRestoreOptions) {
	const restorePendingSessions = useCallback(async () => {
		const currentWorkspaceKey = workspaceKey(workspace);
		if (restoredWorkspaceKeysRef.current.has(currentWorkspaceKey)) {
			return;
		}
		restoredWorkspaceKeysRef.current.add(currentWorkspaceKey);

		const sessions = loadSessions(workspace);
		if (sessions.length === 0) return;

		const ghostTasks: UploadTask[] = [];
		const completionTasks: Array<{
			task: UploadTask;
			parts?: CompletedPart[];
		}> = [];

		const progressResults = await mapAllSettledWithConcurrency(
			sessions,
			RESTORE_PROGRESS_CONCURRENCY,
			async (session) => {
				try {
					const progress = await uploadService.getProgress(session.uploadId);
					return { session, progress };
				} catch (error) {
					throw { session, error };
				}
			},
		);

		for (const result of progressResults) {
			if (result.status === "rejected") {
				const { error, session } = result.reason as {
					error: unknown;
					session: ResumableSession;
				};
				if (shouldRemovePersistedSession(error)) {
					removeSession(session.uploadId);
				}
				continue;
			}

			const { progress, session } = result.value;
			if (!progress?.status) {
				if (process.env.NODE_ENV === "development") {
					logger.warn(
						"skipping restored upload session because progress is missing a status",
						{
							progress,
							uploadId: session.uploadId,
						},
					);
				}
				continue;
			}

			const mode = (session.mode ?? "chunked") as UploadMode;
			const plan = getResumePlan(mode, progress.status);
			if (plan === "restart") {
				removeSession(session.uploadId);
				if (progress.status === "failed") {
					ghostTasks.push({
						id: createTaskId(),
						file: null,
						filename: session.filename,
						relativePath: session.relativePath,
						baseFolderId: session.baseFolderId,
						baseFolderName: session.baseFolderName,
						mode,
						status: "pending_file",
						progress: 0,
						error: t("files:upload_failed"),
						uploadId: null,
						totalChunks: session.totalChunks,
						completedChunks: progress.received_count,
					});
				}
				continue;
			}

			const task: UploadTask = {
				id: createTaskId(),
				file: null,
				filename: session.filename,
				relativePath: session.relativePath,
				baseFolderId: session.baseFolderId,
				baseFolderName: session.baseFolderName,
				mode,
				status: plan === "upload" ? "pending_file" : "processing",
				progress: plan === "upload" ? 0 : getProcessingProgress(mode),
				error: null,
				uploadId: session.uploadId,
				totalChunks: session.totalChunks,
				completedChunks:
					plan === "upload" ? progress.received_count : session.totalChunks,
			};
			ghostTasks.push(task);
			if (plan === "complete") {
				completionTasks.push({
					task,
					parts:
						mode === "presigned_multipart"
							? (session.completedParts ?? [])
							: undefined,
				});
			}
		}

		if (ghostTasks.length > 0) {
			setTasks((prev) => [...ghostTasks, ...prev]);
			setUploadPanelOpen(true);
			for (const completionTask of completionTasks) {
				void resumeCompletionTask(completionTask.task, completionTask.parts);
			}
		}
	}, [
		resumeCompletionTask,
		restoredWorkspaceKeysRef,
		setTasks,
		setUploadPanelOpen,
		t,
		workspace,
	]);

	useEffect(() => {
		void restorePendingSessions();
	}, [restorePendingSessions]);
}
