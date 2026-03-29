import { describe, expect, it } from "vitest";
import { cn, folderTreeRowClass, sidebarNavItemClass } from "@/lib/utils";

describe("utils", () => {
	it("merges class names with tailwind conflict resolution", () => {
		expect(cn("px-2", false, undefined, "px-4", "text-sm")).toBe(
			"px-4 text-sm",
		);
	});

	it("builds active and inactive sidebar nav item classes", () => {
		expect(sidebarNavItemClass(true, "custom")).toContain("select-none");
		expect(sidebarNavItemClass(true, "custom")).toContain(
			"bg-accent text-accent-foreground font-medium custom",
		);
		expect(sidebarNavItemClass(false)).toContain("select-none");
		expect(sidebarNavItemClass(false)).toContain(
			"text-muted-foreground hover:bg-accent/50 hover:text-foreground",
		);
	});

	it("builds active and inactive folder tree row classes", () => {
		expect(folderTreeRowClass(true, "custom")).toContain(
			"bg-accent text-accent-foreground font-medium custom",
		);
		expect(folderTreeRowClass(false)).toContain("text-foreground");
	});
});
