import { removeSession } from "@/lib/uploadPersistence";
import { isRetryableUploadError } from "@/services/uploadService";
import {
	CHUNK_CONCURRENT,
	CHUNK_MAX_RETRIES,
	MULTIPART_DRAIN_POLL_MS,
	MULTIPART_DRAIN_TIMEOUT_MS,
	type UploadTask,
} from "./uploadAreaManagerShared";
import type { UploadModeRunnerContext } from "./uploadAreaUploadRunnerShared";

type ResumableUploadSharedContext = Pick<
	UploadModeRunnerContext,
	| "abortFlagsRef"
	| "flushProgress"
	| "markFolderForRefresh"
	| "markTaskFailed"
	| "multipartInFlightRef"
	| "patchTask"
	| "patchTaskThrottled"
	| "t"
>;

interface RunResumableTransferOptions<TItem> {
	completeUpload: () => Promise<unknown>;
	initialCompleted: number;
	items: TItem[];
	processingProgress: number;
	progressScale: number;
	task: UploadTask;
	totalItems: number;
	uploadItem: (item: TItem) => Promise<void>;
	uploadId: string;
	uploadingPatch: Partial<UploadTask>;
}

function calculateProgress(
	completed: number,
	totalItems: number,
	progressScale: number,
) {
	if (totalItems <= 0) return 0;
	return Math.round((completed / totalItems) * progressScale);
}

export function createResumableUploadShared({
	abortFlagsRef,
	flushProgress,
	markFolderForRefresh,
	markTaskFailed,
	multipartInFlightRef,
	patchTask,
	patchTaskThrottled,
	t,
}: ResumableUploadSharedContext) {
	const adjustMultipartInFlight = (taskId: string, delta: number) => {
		const current = multipartInFlightRef.current.get(taskId) ?? 0;
		const next = current + delta;
		if (next <= 0) {
			multipartInFlightRef.current.delete(taskId);
			return;
		}
		multipartInFlightRef.current.set(taskId, next);
	};

	const withTrackedMultipartRequest = async <T>(
		taskId: string,
		run: () => Promise<T>,
	): Promise<T> => {
		adjustMultipartInFlight(taskId, 1);
		try {
			return await run();
		} finally {
			adjustMultipartInFlight(taskId, -1);
		}
	};

	const waitForMultipartDrain = async (taskId: string) => {
		const startedAt = Date.now();
		while ((multipartInFlightRef.current.get(taskId) ?? 0) > 0) {
			if (Date.now() - startedAt >= MULTIPART_DRAIN_TIMEOUT_MS) {
				return;
			}
			await new Promise((resolve) =>
				setTimeout(resolve, MULTIPART_DRAIN_POLL_MS),
			);
		}
	};

	const runRetryableUploadOperation = async <T>({
		onRetryableError,
		run,
	}: {
		onRetryableError?: (error: Error, attempt: number) => void;
		run: () => Promise<T>;
	}): Promise<T> => {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < CHUNK_MAX_RETRIES; attempt++) {
			try {
				return await run();
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				onRetryableError?.(lastError, attempt);
				if (!isRetryableUploadError(lastError)) {
					break;
				}
				if (attempt < CHUNK_MAX_RETRIES - 1) {
					await new Promise((resolve) =>
						setTimeout(resolve, 1000 * 2 ** attempt),
					);
				}
			}
		}

		throw lastError ?? new Error("upload failed");
	};

	const runResumableTransfer = async <TItem>({
		completeUpload,
		initialCompleted,
		items,
		processingProgress,
		progressScale,
		task,
		totalItems,
		uploadId,
		uploadItem,
		uploadingPatch,
	}: RunResumableTransferOptions<TItem>) => {
		abortFlagsRef.current.set(task.id, false);
		patchTask(task.id, {
			...uploadingPatch,
			progress: calculateProgress(initialCompleted, totalItems, progressScale),
		});

		let completed = initialCompleted;
		const queue = [...items];

		const uploadOneItem = async () => {
			while (queue.length > 0) {
				if (abortFlagsRef.current.get(task.id)) return;
				const item = queue.shift();
				if (item === undefined) return;

				await uploadItem(item);
				completed += 1;
				patchTaskThrottled(task.id, {
					completedChunks: completed,
					progress: calculateProgress(completed, totalItems, progressScale),
				});
			}
		};

		try {
			const workers = Array.from(
				{ length: Math.min(CHUNK_CONCURRENT, queue.length || 1) },
				() => uploadOneItem(),
			);
			await Promise.all(workers);

			if (abortFlagsRef.current.get(task.id)) {
				patchTask(task.id, { status: "cancelled", error: null });
				return;
			}

			flushProgress();
			patchTask(task.id, {
				status: "processing",
				progress: processingProgress,
			});
			await completeUpload();
			removeSession(uploadId);
			patchTask(task.id, {
				status: "completed",
				progress: 100,
				error: null,
			});
			markFolderForRefresh(task);
		} catch (error) {
			if (abortFlagsRef.current.get(task.id)) {
				patchTask(task.id, { status: "cancelled", error: null });
				return;
			}
			const message =
				error instanceof Error ? error.message : t("errors:unexpected_error");
			markTaskFailed(task.id, message);
		} finally {
			abortFlagsRef.current.delete(task.id);
		}
	};

	return {
		runResumableTransfer,
		runRetryableUploadOperation,
		waitForMultipartDrain,
		withTrackedMultipartRequest,
	};
}
