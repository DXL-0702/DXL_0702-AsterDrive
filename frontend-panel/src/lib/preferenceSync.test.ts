import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
	updatePreferences: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("@/services/authService", () => ({
	authService: {
		updatePreferences: mockState.updatePreferences,
	},
}));

vi.mock("@/lib/logger", () => ({
	logger: {
		warn: mockState.warn,
	},
}));

async function loadPreferenceSync() {
	vi.resetModules();
	return await import("@/lib/preferenceSync");
}

describe("preferenceSync", () => {
	beforeEach(() => {
		mockState.updatePreferences.mockReset();
		mockState.warn.mockReset();
		vi.useFakeTimers();
	});

	it("debounces updates and merges pending patches", async () => {
		const { queuePreferenceSync } = await loadPreferenceSync();

		queuePreferenceSync({ theme_mode: "dark" });
		queuePreferenceSync({ language: "zh" });
		queuePreferenceSync({ sort_order: "desc" });

		await vi.advanceTimersByTimeAsync(499);
		expect(mockState.updatePreferences).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);

		expect(mockState.updatePreferences).toHaveBeenCalledTimes(1);
		expect(mockState.updatePreferences).toHaveBeenCalledWith({
			theme_mode: "dark",
			language: "zh",
			sort_order: "desc",
		});
	});

	it("cancels the pending sync when requested", async () => {
		const { cancelPreferenceSync, queuePreferenceSync } =
			await loadPreferenceSync();

		queuePreferenceSync({ theme_mode: "dark" });
		cancelPreferenceSync();

		await vi.advanceTimersByTimeAsync(500);

		expect(mockState.updatePreferences).not.toHaveBeenCalled();
	});

	it("logs a warning when the preference sync fails", async () => {
		mockState.updatePreferences.mockRejectedValueOnce(new Error("boom"));
		const { queuePreferenceSync } = await loadPreferenceSync();

		queuePreferenceSync({ language: "zh" });

		await vi.advanceTimersByTimeAsync(500);

		expect(mockState.warn).toHaveBeenCalledWith(
			"preference sync failed, localStorage as fallback",
			expect.any(Error),
		);
	});
});
