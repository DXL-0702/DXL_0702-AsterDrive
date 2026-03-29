import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminSurface } from "@/components/layout/AdminSurface";

describe("AdminSurface", () => {
	it("renders children with the base admin surface classes", () => {
		const { container } = render(<AdminSurface>Content</AdminSurface>);

		expect(screen.getByText("Content")).toBeInTheDocument();
		expect(container.firstChild).toHaveClass(
			"flex",
			"min-h-0",
			"rounded-xl",
			"border",
			"bg-background",
		);
	});

	it("merges custom class names", () => {
		const { container } = render(
			<AdminSurface className="shadow-lg">Content</AdminSurface>,
		);

		expect(container.firstChild).toHaveClass("shadow-lg");
	});

	it("can disable the default section padding", () => {
		const { container } = render(
			<AdminSurface padded={false}>Content</AdminSurface>,
		);

		expect(container.firstChild).not.toHaveClass("px-4", "md:px-6");
	});
});
