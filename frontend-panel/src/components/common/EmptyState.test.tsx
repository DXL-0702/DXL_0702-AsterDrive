import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/common/EmptyState";

describe("EmptyState", () => {
	it("renders the required title only", () => {
		render(<EmptyState title="Nothing here" />);

		expect(screen.getByText("Nothing here")).toBeInTheDocument();
	});

	it("renders optional icon, description, and action content", () => {
		render(
			<EmptyState
				icon={<span>icon</span>}
				title="Nothing here"
				description="Try again later."
				action={<button type="button">Retry</button>}
			/>,
		);

		expect(screen.getByText("icon")).toBeInTheDocument();
		expect(screen.getByText("Try again later.")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
	});
});
