import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePwaUpdate } from "@/hooks/usePwaUpdate";

const mockState = vi.hoisted(() => ({
	needRefresh: false,
	offlineReady: false,
	updateServiceWorker: vi.fn(),
	toastInfo: vi.fn(),
	translate: vi.fn((key: string) => `translated:${key}`),
	registration: {
		scope: "/",
		active: { scriptURL: "/sw.js" },
		waiting: { scriptURL: "/sw-waiting.js" },
		installing: null,
		update: vi.fn(),
	},
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: mockState.translate,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		info: mockState.toastInfo,
	},
}));

vi.mock("virtual:pwa-register/react", () => ({
	useRegisterSW: (options: {
		onRegistered?: (registration: typeof mockState.registration) => void;
		onRegisterError?: (error: unknown) => void;
	}) => {
		options.onRegistered?.(mockState.registration);
		return {
			needRefresh: [mockState.needRefresh, vi.fn()],
			offlineReady: [mockState.offlineReady, vi.fn()],
			updateServiceWorker: mockState.updateServiceWorker,
		};
	},
}));

describe("usePwaUpdate", () => {
	beforeEach(() => {
		mockState.needRefresh = false;
		mockState.offlineReady = false;
		mockState.updateServiceWorker.mockReset();
		mockState.toastInfo.mockReset();
		mockState.translate.mockClear();
		mockState.registration.update.mockReset();
	});

	it("does not show an update toast when no refresh is pending", () => {
		renderHook(() => usePwaUpdate());

		expect(mockState.toastInfo).not.toHaveBeenCalled();
	});

	it("shows an update toast and refreshes the service worker from the action", async () => {
		mockState.needRefresh = true;

		renderHook(() => usePwaUpdate());

		await waitFor(() => {
			expect(mockState.toastInfo).toHaveBeenCalledWith(
				"translated:offline:pwa_update_available",
				expect.objectContaining({
					action: expect.objectContaining({
						label: "translated:offline:pwa_refresh",
					}),
					duration: Number.POSITIVE_INFINITY,
				}),
			);
		});

		const toastOptions = mockState.toastInfo.mock.calls[0]?.[1] as {
			action: { onClick: () => void };
		};
		toastOptions.action.onClick();

		expect(mockState.updateServiceWorker).toHaveBeenCalledWith(true);
	});

	it("starts an hourly registration update poll", () => {
		const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

		renderHook(() => usePwaUpdate());

		expect(setIntervalSpy).toHaveBeenCalledWith(
			expect.any(Function),
			3_600_000,
		);

		const intervalCallback = setIntervalSpy.mock.calls[0]?.[0] as () => void;
		intervalCallback();

		expect(mockState.registration.update).toHaveBeenCalledTimes(1);
		setIntervalSpy.mockRestore();
	});
});
