import { describe, expect, it, vi } from "vitest";
import { authService } from "@/services/authService";

const mockState = vi.hoisted(() => ({
	clientPost: vi.fn(),
	get: vi.fn(),
	patch: vi.fn(),
	post: vi.fn(),
	put: vi.fn(),
}));

vi.mock("@/services/http", () => ({
	api: {
		client: {
			post: mockState.clientPost,
		},
		get: mockState.get,
		patch: mockState.patch,
		post: mockState.post,
		put: mockState.put,
	},
	ApiError: class ApiError extends Error {
		code: number;
		constructor(code: number, message: string) {
			super(message);
			this.code = code;
		}
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
		authService.changePassword({
			current_password: "secret",
			new_password: "newsecret",
		});
		authService.updateProfile({ display_name: "Alice" });
		authService.setAvatarSource("gravatar");

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
		expect(mockState.patch).toHaveBeenNthCalledWith(
			1,
			"/auth/preferences",
			prefs,
		);
		expect(mockState.put).toHaveBeenNthCalledWith(1, "/auth/password", {
			current_password: "secret",
			new_password: "newsecret",
		});
		expect(mockState.patch).toHaveBeenNthCalledWith(2, "/auth/profile", {
			display_name: "Alice",
		});
		expect(mockState.put).toHaveBeenNthCalledWith(
			2,
			"/auth/profile/avatar/source",
			{
				source: "gravatar",
			},
		);
	});
});
