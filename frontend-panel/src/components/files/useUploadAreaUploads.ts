import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useMemo } from "react";
import type { Workspace } from "@/lib/workspace";
import type {
	UploadAreaManagerTranslationFn,
	UploadTask,
} from "./uploadAreaManagerShared";
import { createUploadModeRunners } from "./uploadAreaUploadModeRunners";
import {
	cancelUploadTask,
	retryUploadTask,
	runQueuedUploadTask,
} from "./uploadAreaUploadTaskActions";

interface UseUploadAreaUploadsOptions {
	abortFlagsRef: MutableRefObject<Map<string, boolean>>;
	directAbortRef: MutableRefObject<Map<string, AbortController>>;
	flushProgress: () => void;
	markFolderForRefresh: (task: UploadTask) => void;
	markTaskFailed: (taskId: string, message: string) => void;
	multipartInFlightRef: MutableRefObject<Map<string, number>>;
	patchTask: (taskId: string, patch: Partial<UploadTask>) => void;
	patchTaskThrottled: (taskId: string, patch: Partial<UploadTask>) => void;
	presignedXhrRef: MutableRefObject<Map<string, XMLHttpRequest>>;
	setTasks: Dispatch<SetStateAction<UploadTask[]>>;
	setUploadPanelOpen: Dispatch<SetStateAction<boolean>>;
	t: UploadAreaManagerTranslationFn;
	tasksRef: MutableRefObject<UploadTask[]>;
	workspace: Workspace;
}

export function useUploadAreaUploads({
	abortFlagsRef,
	directAbortRef,
	flushProgress,
	markFolderForRefresh,
	markTaskFailed,
	multipartInFlightRef,
	patchTask,
	patchTaskThrottled,
	presignedXhrRef,
	setTasks,
	setUploadPanelOpen,
	t,
	tasksRef,
	workspace,
}: UseUploadAreaUploadsOptions) {
	const modeRunners = useMemo(
		() =>
			createUploadModeRunners({
				abortFlagsRef,
				directAbortRef,
				flushProgress,
				markFolderForRefresh,
				markTaskFailed,
				multipartInFlightRef,
				patchTask,
				patchTaskThrottled,
				presignedXhrRef,
				t,
				workspace,
			}),
		[
			abortFlagsRef,
			directAbortRef,
			flushProgress,
			markFolderForRefresh,
			markTaskFailed,
			multipartInFlightRef,
			patchTask,
			patchTaskThrottled,
			presignedXhrRef,
			t,
			workspace,
		],
	);

	const runTask = useCallback(
		async (taskId: string) => {
			await runQueuedUploadTask(taskId, {
				...modeRunners,
				abortFlagsRef,
				directAbortRef,
				markTaskFailed,
				patchTask,
				presignedXhrRef,
				setTasks,
				setUploadPanelOpen,
				t,
				tasksRef,
				workspace,
			});
		},
		[
			modeRunners,
			abortFlagsRef,
			directAbortRef,
			markTaskFailed,
			patchTask,
			presignedXhrRef,
			setTasks,
			setUploadPanelOpen,
			t,
			tasksRef,
			workspace,
		],
	);

	const cancelTask = useCallback(
		async (taskId: string) => {
			await cancelUploadTask(taskId, {
				...modeRunners,
				abortFlagsRef,
				directAbortRef,
				markTaskFailed,
				patchTask,
				presignedXhrRef,
				setTasks,
				setUploadPanelOpen,
				t,
				tasksRef,
				workspace,
			});
		},
		[
			modeRunners,
			abortFlagsRef,
			directAbortRef,
			markTaskFailed,
			patchTask,
			presignedXhrRef,
			setTasks,
			setUploadPanelOpen,
			t,
			tasksRef,
			workspace,
		],
	);

	const retryTask = useCallback(
		async (taskId: string) => {
			await retryUploadTask(taskId, {
				...modeRunners,
				abortFlagsRef,
				directAbortRef,
				markTaskFailed,
				patchTask,
				presignedXhrRef,
				setTasks,
				setUploadPanelOpen,
				t,
				tasksRef,
				workspace,
			});
		},
		[
			modeRunners,
			abortFlagsRef,
			directAbortRef,
			markTaskFailed,
			patchTask,
			presignedXhrRef,
			setTasks,
			setUploadPanelOpen,
			t,
			tasksRef,
			workspace,
		],
	);

	return {
		cancelTask,
		resumeCompletionTask: modeRunners.resumeCompletionTask,
		retryTask,
		runTask,
	};
}
