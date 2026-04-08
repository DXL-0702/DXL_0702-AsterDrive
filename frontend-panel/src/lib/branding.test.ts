import { beforeEach, describe, expect, it } from "vitest";
import {
	applyBranding,
	DEFAULT_BRANDING,
	formatDocumentTitle,
	resolveBranding,
} from "@/lib/branding";

describe("branding helpers", () => {
	beforeEach(() => {
		document.title = "";
		for (const selector of [
			'meta[name="description"]',
			'link[rel="icon"]',
			'link[rel="apple-touch-icon"]',
		]) {
			document.head.querySelector(selector)?.remove();
		}
	});

	it("falls back to defaults for blank fields and invalid favicon URLs", () => {
		expect(
			resolveBranding({
				title: "   ",
				description: "",
				favicon_url: "javascript:alert(1)",
			}),
		).toEqual(DEFAULT_BRANDING);
	});

	it("normalizes safe favicon URLs against the current origin", () => {
		expect(
			resolveBranding({
				title: "My Drive",
				description: "Team storage",
				favicon_url: "/assets/brand/icon.png?v=1",
			}),
		).toEqual({
			title: "My Drive",
			description: "Team storage",
			faviconUrl: "/assets/brand/icon.png?v=1",
		});
	});

	it("rejects non-root relative favicon paths", () => {
		expect(
			resolveBranding({
				title: "My Drive",
				description: "Team storage",
				favicon_url: "assets/brand/icon.png",
			}),
		).toEqual({
			title: "My Drive",
			description: "Team storage",
			faviconUrl: "/favicon.svg",
		});
	});

	it("updates description and both icon links", () => {
		applyBranding({
			title: "Nebula Drive",
			description: "Private cloud for the squad",
			faviconUrl: "https://cdn.example.com/brand/favicon.png",
		});

		expect(
			document.head.querySelector('meta[name="description"]'),
		).toHaveAttribute("content", "Private cloud for the squad");
		expect(document.head.querySelector('link[rel="icon"]')).toHaveAttribute(
			"href",
			"https://cdn.example.com/brand/favicon.png",
		);
		expect(
			document.head.querySelector('link[rel="apple-touch-icon"]'),
		).toHaveAttribute("href", "https://cdn.example.com/brand/favicon.png");
		expect(document.head.querySelector('link[rel="icon"]')).not.toHaveAttribute(
			"type",
		);
	});

	it("formats page titles against the current branding title", () => {
		expect(formatDocumentTitle("Nebula Drive", "Trash")).toBe(
			"Trash · Nebula Drive",
		);
		expect(formatDocumentTitle("Nebula Drive", "  Nebula Drive  ")).toBe(
			"Nebula Drive",
		);
		expect(formatDocumentTitle("  ", "Trash")).toBe("Trash · AsterDrive");
		expect(formatDocumentTitle("猫猫云盘", "团队设置")).toBe(
			"团队设置 · 猫猫云盘",
		);
	});
});
