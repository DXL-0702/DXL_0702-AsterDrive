import { render } from "@testing-library/react";
import { createElement } from "react";
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

	it("renders imported icons with the app React runtime", () => {
		const Icon = resolveIcon("main.ts");

		expect(Icon).toEqual(expect.any(Function));
		const renderIcon = () =>
			render(Icon ? createElement(Icon, { size: "1.5rem" }) : null);

		expect(renderIcon).not.toThrow();
		expect(renderIcon().container.querySelector("svg")).not.toBeNull();
	});
});
