import { describe, expect, it } from "vitest";
import { checkHasIcon, resolveIcon } from "@/components/ui/language-icons-map";

describe("language-icons-map", () => {
	it("resolves icons for supported extensions", () => {
		expect(resolveIcon("main.ts")).toEqual(expect.any(Function));
		expect(resolveIcon("component.VUE")).toEqual(expect.any(Function));
		expect(resolveIcon("schema.graphql")).toEqual(expect.any(Function));
		expect(resolveIcon("infra.tf")).toEqual(expect.any(Function));
	});

	it("resolves icons for special filenames", () => {
		expect(resolveIcon("Dockerfile")).toEqual(expect.any(Function));
		expect(resolveIcon(".dockerignore")).toEqual(expect.any(Function));
		expect(resolveIcon("Jenkinsfile")).toEqual(expect.any(Function));
	});

	it("reports icon availability accurately", () => {
		expect(checkHasIcon("main.ts")).toBe(true);
		expect(checkHasIcon("Gemfile")).toBe(true);
		expect(checkHasIcon("README.unknown")).toBe(false);
		expect(resolveIcon("README.unknown")).toBeNull();
	});
});
