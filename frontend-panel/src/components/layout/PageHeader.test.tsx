import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/layout/PageHeader";

describe("PageHeader", () => {
	it("renders nothing when both title and actions are missing", () => {
		const { container } = render(<PageHeader />);

		expect(container).toBeEmptyDOMElement();
	});

	it("renders title and optional actions", () => {
		render(
			<PageHeader
				title="Files"
				actions={<button type="button">Refresh</button>}
			/>,
		);

		expect(screen.getByText("Files")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
	});
});
