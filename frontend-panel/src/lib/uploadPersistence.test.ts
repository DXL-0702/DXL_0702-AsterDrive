import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	appendCompletedPart,
	clearAllSessions,
	loadSessions,
	type ResumableSession,
	removeSession,
	saveSession,
} from "@/lib/uploadPersistence";
import type { Workspace } from "@/lib/workspace";

function createSession(
	overrides: Partial<ResumableSession> = {},
): ResumableSession {
	return {
		uploadId: "upload-1",
		filename: "hello.txt",
		totalSize: 12,
		totalChunks: 3,
		chunkSize: 4,
		baseFolderId: 42,
		baseFolderName: "Projects",
		relativePath: null,
		savedAt: Date.now(),
		mode: "chunked",
		...overrides,
	};
}

const TEAM_WORKSPACE: Workspace = { kind: "team", teamId: 9 };

describe("uploadPersistence", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it("saves, replaces, and removes sessions by upload id", () => {
		saveSession(createSession());
		saveSession(
			createSession({
				uploadId: "upload-2",
				filename: "world.txt",
			}),
		);
		saveSession(
			createSession({
				uploadId: "upload-1",
				filename: "hello-v2.txt",
			}),
		);

		expect(loadSessions()).toEqual([
			expect.objectContaining({
				uploadId: "upload-2",
				filename: "world.txt",
			}),
			expect.objectContaining({
				uploadId: "upload-1",
				filename: "hello-v2.txt",
			}),
		]);

		removeSession("upload-2");

		expect(loadSessions()).toEqual([
			expect.objectContaining({
				uploadId: "upload-1",
				filename: "hello-v2.txt",
			}),
		]);
	});

	it("tracks completed parts without duplicating the same part number", () => {
		saveSession(
			createSession({
				mode: "presigned_multipart",
				completedParts: [{ part_number: 1, etag: "etag-1" }],
			}),
		);

		appendCompletedPart("upload-1", {
			part_number: 2,
			etag: "etag-2",
		});
		appendCompletedPart("upload-1", {
			part_number: 2,
			etag: "etag-2-duplicate",
		});

		expect(loadSessions()).toEqual([
			expect.objectContaining({
				completedParts: [
					{ part_number: 1, etag: "etag-1" },
					{ part_number: 2, etag: "etag-2" },
				],
			}),
		]);
	});

	it("drops expired sessions when loading", () => {
		const now = 10_000_000;
		vi.spyOn(Date, "now").mockReturnValue(now);

		saveSession(
			createSession({
				uploadId: "fresh",
				savedAt: now - (23 * 60 * 60 * 1000 - 1),
			}),
		);
		saveSession(
			createSession({
				uploadId: "expired",
				savedAt: now - (23 * 60 * 60 * 1000 + 1),
			}),
		);

		expect(loadSessions()).toEqual([
			expect.objectContaining({
				uploadId: "fresh",
			}),
		]);
		expect(loadSessions()).toEqual([
			expect.objectContaining({
				uploadId: "fresh",
			}),
		]);
	});

	it("clears all persisted sessions", () => {
		saveSession(createSession());

		clearAllSessions();

		expect(loadSessions()).toEqual([]);
	});

	it("filters sessions by workspace when requested", () => {
		saveSession(createSession({ uploadId: "personal-1" }));
		saveSession(
			createSession({
				uploadId: "team-1",
				workspace: TEAM_WORKSPACE,
			}),
		);

		expect(loadSessions()).toHaveLength(2);
		expect(loadSessions(TEAM_WORKSPACE)).toEqual([
			expect.objectContaining({
				uploadId: "team-1",
			}),
		]);
	});

	it("trims older sessions when localStorage quota is exceeded", () => {
		// 先正常存 4 个 session（按 savedAt 0/1/2/3 升序）
		for (let i = 0; i < 4; i += 1) {
			saveSession(
				createSession({
					uploadId: `upload-${i}`,
					savedAt: i,
				}),
			);
		}

		// mock setItem：第 1 次抛 QuotaExceededError，第 2 次成功
		let attempt = 0;
		const setItemSpy = vi
			.spyOn(Storage.prototype, "setItem")
			.mockImplementation(function (this: Storage, key: string, value: string) {
				attempt += 1;
				if (attempt === 1) {
					throw new DOMException("quota", "QuotaExceededError");
				}
				// 第 2 次走原始实现（vi 的 spy 默认替换，需要手动落盘）
				const storage = this as unknown as {
					__store?: Record<string, string>;
				};
				if (storage.__store == null) {
					storage.__store = {};
				}
				const obj = storage.__store;
				obj[key] = value;
			});

		// 触发第 5 次 save → 命中 quota → trim 后重试
		saveSession(
			createSession({
				uploadId: "upload-new",
				savedAt: 100,
			}),
		);

		expect(setItemSpy).toHaveBeenCalledTimes(2);
		// 第 2 次写入的 payload 应该已经裁掉一半旧 session
		const secondCallPayload = setItemSpy.mock.calls[1]?.[1] as string;
		const persisted = JSON.parse(secondCallPayload) as ResumableSession[];
		// 5 条 → floor(5/2) = 2 条；按 savedAt desc 保留最新的 upload-new (100) + upload-3 (3)
		expect(persisted).toHaveLength(2);
		expect(persisted.map((s) => s.uploadId)).toEqual([
			"upload-new",
			"upload-3",
		]);
	});

	it("clears storage when quota persists even after trimming", () => {
		saveSession(createSession({ uploadId: "u1", savedAt: 1 }));

		const setItemSpy = vi
			.spyOn(Storage.prototype, "setItem")
			.mockImplementation(() => {
				throw new DOMException("quota", "QuotaExceededError");
			});
		const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");

		// 不应抛出，整页不能因为一次写入失败而 crash
		expect(() => {
			saveSession(createSession({ uploadId: "u2", savedAt: 2 }));
		}).not.toThrow();

		// 第 1 次直接写、第 2 次 trim 后重写都失败 → 走 removeItem 兜底
		expect(setItemSpy).toHaveBeenCalledTimes(2);
		expect(removeItemSpy).toHaveBeenCalledWith("aster_resumable_uploads");
	});

	it("ignores non-quota DOMExceptions without crashing", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new DOMException("nope", "InvalidStateError");
		});

		expect(() => {
			saveSession(createSession({ uploadId: "u-ignored" }));
		}).not.toThrow();
	});
});
