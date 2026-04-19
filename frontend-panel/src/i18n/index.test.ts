import type { ReportNamespaces } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
	idleCallbacks: [] as Array<() => void>,
	runWhenIdle: vi.fn((task: () => void) => {
		mockState.idleCallbacks.push(task);
		return () => undefined;
	}),
}));

vi.mock("@/lib/idleTask", () => ({
	runWhenIdle: mockState.runWhenIdle,
}));

async function loadModule() {
	vi.resetModules();
	mockState.idleCallbacks.length = 0;
	return (await import("@/i18n")).default;
}

describe("i18n", () => {
	beforeEach(() => {
		localStorage.clear();
		mockState.idleCallbacks.length = 0;
		mockState.runWhenIdle.mockClear();
	});

	it("binds resource store additions so async bundles can refresh current pages", async () => {
		const i18n = await loadModule();

		expect(i18n.options.react?.bindI18nStore).toBe("added");
	});

	it("preloads deferred namespaces for the alternate language during idle time", async () => {
		localStorage.setItem("aster-language", "zh");
		const i18n = await loadModule();

		i18n.removeResourceBundle("en", "admin");
		i18n.removeResourceBundle("en", "settings");
		expect(i18n.hasResourceBundle("en", "admin")).toBe(false);
		expect(i18n.hasResourceBundle("en", "settings")).toBe(false);
		expect(mockState.runWhenIdle).toHaveBeenCalled();

		for (const callback of mockState.idleCallbacks) {
			await callback();
		}

		await vi.waitFor(() => {
			expect(i18n.hasResourceBundle("en", "admin")).toBe(true);
			expect(i18n.hasResourceBundle("en", "settings")).toBe(true);
		});
	});

	it("loads already used namespaces before resolving a language switch", async () => {
		localStorage.setItem("aster-language", "zh");
		const i18n = await loadModule();

		i18n.reportNamespaces = {
			addUsedNamespaces: () => undefined,
			getUsedNamespaces: () => ["settings"],
		} satisfies ReportNamespaces;
		i18n.removeResourceBundle("en", "settings");

		await i18n.changeLanguage("en");

		expect(i18n.language).toBe("en");
		expect(i18n.hasResourceBundle("en", "settings")).toBe(true);
	});
});
