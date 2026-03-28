import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolbarBar } from "@/components/common/ToolbarBar";

describe("ToolbarBar", () => {
	it("renders the left content and omits the right slot by default", () => {
		render(<ToolbarBar left={<span>Filters</span>} />);

		expect(screen.getByText("Filters")).toBeInTheDocument();
		expect(screen.queryByText("Actions")).not.toBeInTheDocument();
	});

	it("renders both left and right toolbar sections", () => {
		render(
			<ToolbarBar
				left={<span>Filters</span>}
				right={<button type="button">Actions</button>}
			/>,
		);

		expect(screen.getByText("Filters")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Actions" })).toBeInTheDocument();
	});
});
