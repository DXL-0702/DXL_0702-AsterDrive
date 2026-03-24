/**
 * 断点续传持久化层
 * 将 chunked upload session 元数据存入 localStorage，刷新后可恢复。
 */

export interface ResumableSession {
	uploadId: string;
	filename: string;
	totalSize: number;
	totalChunks: number;
	chunkSize: number;
	baseFolderId: number | null;
	baseFolderName: string;
	relativePath: string | null;
	savedAt: number;
}

const STORAGE_KEY = "aster_resumable_uploads";
/** 23h — 留 1h 余量，服务器 session 24h 过期 */
const MAX_AGE_MS = 23 * 60 * 60 * 1000;

function readAll(): ResumableSession[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as ResumableSession[];
	} catch {
		return [];
	}
}

function writeAll(sessions: ResumableSession[]): void {
	if (sessions.length === 0) {
		localStorage.removeItem(STORAGE_KEY);
	} else {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
	}
}

/** 保存一个 chunked upload session（init 成功后调用） */
export function saveSession(session: ResumableSession): void {
	const all = readAll().filter((s) => s.uploadId !== session.uploadId);
	all.push(session);
	writeAll(all);
}

/** 移除一个 session（complete/cancel/永久删除时调用） */
export function removeSession(uploadId: string): void {
	writeAll(readAll().filter((s) => s.uploadId !== uploadId));
}

/** 加载所有未过期的 session，自动清理过期的 */
export function loadSessions(): ResumableSession[] {
	const now = Date.now();
	const all = readAll();
	const valid = all.filter((s) => now - s.savedAt < MAX_AGE_MS);
	if (valid.length !== all.length) {
		writeAll(valid);
	}
	return valid;
}

/** 清空所有 session */
export function clearAllSessions(): void {
	localStorage.removeItem(STORAGE_KEY);
}
