import { describe, expect, it, vi } from "vitest";
import { authService } from "@/services/authService";

const mockState = vi.hoisted(() => ({
	get: vi.fn(),
	patch: vi.fn(),
	post: vi.fn(),
}));

vi.mock("@/services/http", () => ({
	api: {
		get: mockState.get,
		patch: mockState.patch,
		post: mockState.post,
	},
}));

describe("authService", () => {
	it("uses the expected auth endpoints and payloads", () => {
		const prefs = {
			language: "zh",
			sort_by: "updated_at",
		};

		authService.check("alice@example.com");
		authService.login("alice@example.com", "secret");
		authService.register("alice", "alice@example.com", "secret");
		authService.setup("owner", "owner@example.com", "secret");
		authService.logout();
		authService.me();
		authService.updatePreferences(prefs);

		expect(mockState.post).toHaveBeenNthCalledWith(1, "/auth/check", {
			identifier: "alice@example.com",
		});
		expect(mockState.post).toHaveBeenNthCalledWith(2, "/auth/login", {
			identifier: "alice@example.com",
			password: "secret",
		});
		expect(mockState.post).toHaveBeenNthCalledWith(3, "/auth/register", {
			username: "alice",
			email: "alice@example.com",
			password: "secret",
		});
		expect(mockState.post).toHaveBeenNthCalledWith(4, "/auth/setup", {
			username: "owner",
			email: "owner@example.com",
			password: "secret",
		});
		expect(mockState.post).toHaveBeenNthCalledWith(5, "/auth/logout");
		expect(mockState.get).toHaveBeenCalledWith("/auth/me");
		expect(mockState.patch).toHaveBeenCalledWith("/auth/preferences", prefs);
	});
});
