import { useCallback, useEffect, useRef, useState } from "react";
import { uploadService } from "@/services/uploadService";

const STORAGE_KEY = "aster_chunked_upload";
const CONCURRENT_CHUNKS = 3;
const MAX_RETRIES = 3;

export interface ChunkedUploadState {
	status: "idle" | "uploading" | "assembling" | "completed" | "failed";
	uploadId: string | null;
	filename: string | null;
	progress: number;
	completedChunks: number;
	totalChunks: number;
	error: string | null;
	canResume: boolean;
}

interface PersistedSession {
	uploadId: string;
	filename: string;
	totalSize: number;
	chunkSize: number;
	totalChunks: number;
	folderId?: number | null;
}

function saveSession(session: PersistedSession) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
	} catch {
		// quota exceeded etc
	}
}

function loadSession(): PersistedSession | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function clearSession() {
	localStorage.removeItem(STORAGE_KEY);
}

const INITIAL_STATE: ChunkedUploadState = {
	status: "idle",
	uploadId: null,
	filename: null,
	progress: 0,
	completedChunks: 0,
	totalChunks: 0,
	error: null,
	canResume: false,
};

export function useChunkedUpload(onComplete?: () => void) {
	const [state, setState] = useState<ChunkedUploadState>(INITIAL_STATE);
	const abortRef = useRef(false);
	const fileRef = useRef<File | null>(null);

	// 启动时检查是否有可恢复的 session
	useEffect(() => {
		const saved = loadSession();
		if (saved) {
			setState((s) => ({
				...s,
				uploadId: saved.uploadId,
				filename: saved.filename,
				totalChunks: saved.totalChunks,
				canResume: true,
			}));
		}
	}, []);

	const reset = useCallback(() => {
		abortRef.current = false;
		fileRef.current = null;
		clearSession();
		setState(INITIAL_STATE);
	}, []);

	const uploadChunks = useCallback(
		async (
			file: File,
			uploadId: string,
			chunkSize: number,
			totalChunks: number,
			alreadyReceived: number[],
		) => {
			const chunkQueue = Array.from(
				{ length: totalChunks },
				(_, i) => i,
			).filter((i) => !alreadyReceived.includes(i));

			let completed = alreadyReceived.length;

			setState((s) => ({
				...s,
				status: "uploading",
				completedChunks: completed,
				progress: Math.round((completed / totalChunks) * 95),
			}));

			const uploadOneChunk = async (): Promise<void> => {
				while (chunkQueue.length > 0) {
					if (abortRef.current) return;

					const chunkNumber = chunkQueue.shift() as number;
					const start = chunkNumber * chunkSize;
					const end = Math.min(start + chunkSize, file.size);
					const blob = file.slice(start, end);

					// retry logic
					let lastErr: Error | null = null;
					for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
						try {
							await uploadService.uploadChunk(uploadId, chunkNumber, blob);
							lastErr = null;
							break;
						} catch (err) {
							lastErr = err instanceof Error ? err : new Error(String(err));
							// wait before retry (exponential backoff)
							if (attempt < MAX_RETRIES - 1) {
								await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
							}
						}
					}
					if (lastErr) throw lastErr;

					completed++;
					setState((s) => ({
						...s,
						completedChunks: completed,
						progress: Math.round((completed / totalChunks) * 95),
					}));
				}
			};

			const workers = Array.from(
				{ length: Math.min(CONCURRENT_CHUNKS, chunkQueue.length || 1) },
				() => uploadOneChunk(),
			);
			await Promise.all(workers);
		},
		[],
	);

	const startUpload = useCallback(
		async (file: File, folderId?: number | null) => {
			abortRef.current = false;
			fileRef.current = file;

			setState((s) => ({
				...s,
				status: "uploading",
				filename: file.name,
				progress: 0,
				error: null,
				canResume: false,
			}));

			try {
				const init = await uploadService.initUpload({
					filename: file.name,
					total_size: file.size,
					folder_id: folderId,
				});

				setState((s) => ({
					...s,
					uploadId: init.upload_id,
					totalChunks: init.total_chunks,
				}));

				// persist for resume
				saveSession({
					uploadId: init.upload_id,
					filename: file.name,
					totalSize: file.size,
					chunkSize: init.chunk_size,
					totalChunks: init.total_chunks,
					folderId,
				});

				await uploadChunks(
					file,
					init.upload_id,
					init.chunk_size,
					init.total_chunks,
					[],
				);

				if (abortRef.current) return;

				setState((s) => ({ ...s, status: "assembling", progress: 95 }));
				await uploadService.completeUpload(init.upload_id);

				clearSession();
				setState((s) => ({
					...s,
					status: "completed",
					progress: 100,
				}));
				onComplete?.();
			} catch (err) {
				const msg = err instanceof Error ? err.message : "upload failed";
				setState((s) => ({
					...s,
					status: "failed",
					error: msg,
					canResume: true,
				}));
			}
		},
		[onComplete, uploadChunks],
	);

	const resumeUpload = useCallback(
		async (file: File) => {
			const saved = loadSession();
			if (!saved) {
				setState((s) => ({
					...s,
					error: "No session to resume",
					canResume: false,
				}));
				return;
			}

			abortRef.current = false;
			fileRef.current = file;

			setState((s) => ({
				...s,
				status: "uploading",
				filename: saved.filename,
				uploadId: saved.uploadId,
				totalChunks: saved.totalChunks,
				error: null,
				canResume: false,
			}));

			try {
				// query server for already-received chunks
				const progress = await uploadService.getProgress(saved.uploadId);

				if (progress.status === "completed") {
					clearSession();
					setState((s) => ({ ...s, status: "completed", progress: 100 }));
					onComplete?.();
					return;
				}

				await uploadChunks(
					file,
					saved.uploadId,
					saved.chunkSize,
					saved.totalChunks,
					progress.chunks_on_disk,
				);

				if (abortRef.current) return;

				setState((s) => ({ ...s, status: "assembling", progress: 95 }));
				await uploadService.completeUpload(saved.uploadId);

				clearSession();
				setState((s) => ({ ...s, status: "completed", progress: 100 }));
				onComplete?.();
			} catch (err) {
				const msg = err instanceof Error ? err.message : "resume failed";
				setState((s) => ({
					...s,
					status: "failed",
					error: msg,
					canResume: true,
				}));
			}
		},
		[onComplete, uploadChunks],
	);

	const cancelUpload = useCallback(async () => {
		abortRef.current = true;
		if (state.uploadId) {
			try {
				await uploadService.cancelUpload(state.uploadId);
			} catch {
				// ignore
			}
		}
		reset();
	}, [state.uploadId, reset]);

	return { state, startUpload, resumeUpload, cancelUpload, reset };
}
