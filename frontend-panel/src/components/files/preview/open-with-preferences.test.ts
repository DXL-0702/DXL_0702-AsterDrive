import { beforeEach, describe, expect, it } from "vitest";
import {
	getStoredOpenWithPreference,
	setStoredOpenWithPreference,
} from "@/components/files/preview/open-with-preferences";

describe("open-with preferences", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("persists supported preview categories", () => {
		setStoredOpenWithPreference("markdown", "code");
		setStoredOpenWithPreference("json", "formatted");

		expect(getStoredOpenWithPreference("markdown")).toBe("code");
		expect(getStoredOpenWithPreference("json")).toBe("formatted");
	});

	it("ignores unsupported categories", () => {
		setStoredOpenWithPreference("pdf", "pdf");

		expect(getStoredOpenWithPreference("pdf")).toBeNull();
		expect(localStorage.getItem("aster-preview-open-with")).toBeNull();
	});

	it("falls back to null on malformed stored data", () => {
		localStorage.setItem("aster-preview-open-with", "{bad json");

		expect(getStoredOpenWithPreference("markdown")).toBeNull();
	});

	it("recovers from malformed storage when saving new preferences", () => {
		localStorage.setItem("aster-preview-open-with", "{bad json");

		setStoredOpenWithPreference("text", "code");

		expect(getStoredOpenWithPreference("text")).toBe("code");
		expect(localStorage.getItem("aster-preview-open-with")).toBe(
			JSON.stringify({ text: "code" }),
		);
	});
});
