import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminPageShell } from "@/components/layout/AdminPageShell";

describe("AdminPageShell", () => {
	it("renders children with the default shell classes", () => {
		const { container } = render(<AdminPageShell>Body</AdminPageShell>);

		expect(screen.getByText("Body")).toBeInTheDocument();
		expect(container.firstChild).toHaveClass("flex", "gap-4", "p-4");
	});

	it("merges additional class names", () => {
		const { container } = render(
			<AdminPageShell className="bg-muted">Body</AdminPageShell>,
		);

		expect(container.firstChild).toHaveClass("bg-muted");
	});
});
