import { describe, expect, it } from "vitest";
import { pickLocalizedLabel } from "@/lib/localizedLabel";

describe("pickLocalizedLabel", () => {
	it("prefers exact and base locale matches", () => {
		expect(
			pickLocalizedLabel(
				{
					en: "Viewer",
					"zh-hans": "查看器简体",
					zh: "查看器",
				},
				"zh-Hans-CN",
			),
		).toBe("查看器简体");
		expect(
			pickLocalizedLabel(
				{
					en: "Viewer",
					zh: "查看器",
				},
				"zh-CN",
			),
		).toBe("查看器");
	});

	it("falls back to the first available label", () => {
		expect(
			pickLocalizedLabel(
				{
					en: "Viewer",
					zh: "查看器",
				},
				"fr-FR",
			),
		).toBe("Viewer");
	});

	it("returns an empty string when labels are missing", () => {
		expect(pickLocalizedLabel(undefined, "zh-CN")).toBe("");
		expect(pickLocalizedLabel({}, "zh-CN")).toBe("");
	});
});
