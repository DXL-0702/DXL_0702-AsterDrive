import type { MutableRefObject } from "react";
import type { Workspace } from "@/lib/workspace";
import type {
	CompletedPart,
	InitUploadResponse,
} from "@/services/uploadService";
import type {
	UploadAreaManagerTranslationFn,
	UploadTask,
} from "./uploadAreaManagerShared";

export interface UploadModeRunnerContext {
	abortFlagsRef: MutableRefObject<Map<string, boolean>>;
	directAbortRef: MutableRefObject<Map<string, AbortController>>;
	flushProgress: () => void;
	markFolderForRefresh: (task: UploadTask) => void;
	markTaskFailed: (taskId: string, message: string) => void;
	multipartInFlightRef: MutableRefObject<Map<string, number>>;
	patchTask: (taskId: string, patch: Partial<UploadTask>) => void;
	patchTaskThrottled: (taskId: string, patch: Partial<UploadTask>) => void;
	presignedXhrRef: MutableRefObject<Map<string, XMLHttpRequest>>;
	t: UploadAreaManagerTranslationFn;
	workspace: Workspace;
}

export interface UploadModeRunners {
	cancelMultipartSession: (task: UploadTask) => Promise<void>;
	resumeCompletionTask: (
		task: UploadTask,
		parts?: CompletedPart[],
	) => Promise<void>;
	runChunkedUpload: (
		task: UploadTask,
		init: InitUploadResponse,
		alreadyReceived?: number[],
	) => Promise<void>;
	runDirectUpload: (task: UploadTask) => Promise<void>;
	runMultipartUpload: (
		task: UploadTask,
		init: InitUploadResponse,
		alreadyCompleted?: CompletedPart[],
	) => Promise<void>;
	runPresignedUpload: (
		task: UploadTask,
		init: InitUploadResponse,
	) => Promise<void>;
}
