import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { apiResponse, createMeResponse } from "@/test/fixtures";
import { server } from "@/test/server";

const changeLanguage = vi.fn(async () => undefined);

vi.mock("@/i18n", () => ({
	default: {
		changeLanguage,
		language: "en",
	},
}));

async function loadStores() {
	vi.resetModules();
	const [{ useAuthStore }, { useFileStore }, { useThemeStore }] =
		await Promise.all([
			import("@/stores/authStore"),
			import("@/stores/fileStore"),
			import("@/stores/themeStore"),
		]);

	return { useAuthStore, useFileStore, useThemeStore };
}

describe("useAuthStore", () => {
	it("logs in, caches the user, and applies server preferences", async () => {
		changeLanguage.mockClear();

		let loginPayload: unknown;
		const user = createMeResponse();

		server.use(
			http.post("*/api/v1/auth/login", async ({ request }) => {
				loginPayload = await request.json();
				return HttpResponse.json(apiResponse(null));
			}),
			http.get("*/api/v1/auth/me", () => HttpResponse.json(apiResponse(user))),
		);

		const { useAuthStore, useFileStore, useThemeStore } = await loadStores();

		await useAuthStore.getState().login("alice@example.com", "secret");

		expect(loginPayload).toEqual({
			identifier: "alice@example.com",
			password: "secret",
		});
		expect(useAuthStore.getState()).toMatchObject({
			isAuthenticated: true,
			isChecking: false,
			isAuthStale: false,
			bootOffline: false,
			user,
		});
		expect(localStorage.getItem("aster-cached-user")).not.toBeNull();
		expect(useThemeStore.getState()).toMatchObject({
			mode: "dark",
			colorPreset: "orange",
		});
		expect(useFileStore.getState()).toMatchObject({
			viewMode: "grid",
			sortBy: "updated_at",
			sortOrder: "desc",
		});
		expect(changeLanguage).toHaveBeenCalledWith("zh");
	});

	it("keeps the cached user when auth check fails offline", async () => {
		const cachedUser = createMeResponse({
			username: "offline-user",
			email: "offline@example.com",
		});
		localStorage.setItem("aster-cached-user", JSON.stringify(cachedUser));

		server.use(http.get("*/api/v1/auth/me", () => HttpResponse.error()));

		const { useAuthStore } = await loadStores();

		await useAuthStore.getState().checkAuth();

		expect(useAuthStore.getState()).toMatchObject({
			isAuthenticated: true,
			isChecking: false,
			isAuthStale: true,
			bootOffline: false,
			user: cachedUser,
		});
	});
});
