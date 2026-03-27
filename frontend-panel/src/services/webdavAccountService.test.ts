import { beforeEach, describe, expect, it, vi } from "vitest";
import { webdavAccountService } from "@/services/webdavAccountService";

const mockState = vi.hoisted(() => ({
	delete: vi.fn(),
	get: vi.fn(),
	post: vi.fn(),
}));

vi.mock("@/services/http", () => ({
	api: {
		delete: mockState.delete,
		get: mockState.get,
		post: mockState.post,
	},
}));

describe("webdavAccountService", () => {
	beforeEach(() => {
		mockState.delete.mockReset();
		mockState.get.mockReset();
		mockState.post.mockReset();
	});

	it("builds list queries and account management endpoints", () => {
		webdavAccountService.list({ limit: 20, offset: 40 });
		webdavAccountService.create("alice", "secret", 7);
		webdavAccountService.delete(7);
		webdavAccountService.toggle(7);
		webdavAccountService.test("alice", "secret");

		expect(mockState.get).toHaveBeenCalledWith(
			"/webdav-accounts?limit=20&offset=40",
		);
		expect(mockState.post).toHaveBeenNthCalledWith(1, "/webdav-accounts", {
			username: "alice",
			password: "secret",
			root_folder_id: 7,
		});
		expect(mockState.delete).toHaveBeenCalledWith("/webdav-accounts/7");
		expect(mockState.post).toHaveBeenNthCalledWith(
			2,
			"/webdav-accounts/7/toggle",
		);
		expect(mockState.post).toHaveBeenNthCalledWith(3, "/webdav-accounts/test", {
			username: "alice",
			password: "secret",
		});
	});

	it("uses null as the default root folder id and omits query params when absent", () => {
		webdavAccountService.list();
		webdavAccountService.create("bob");

		expect(mockState.get).toHaveBeenCalledWith("/webdav-accounts");
		expect(mockState.post).toHaveBeenCalledWith("/webdav-accounts", {
			username: "bob",
			password: undefined,
			root_folder_id: null,
		});
	});
});
