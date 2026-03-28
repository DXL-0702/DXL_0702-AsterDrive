import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name, className }: { name: string; className?: string }) => (
		<span data-testid="icon" data-name={name} className={className} />
	),
}));

describe("LoadingSpinner", () => {
	it("renders the spinner icon with the default layout", () => {
		render(<LoadingSpinner />);

		expect(screen.getByTestId("icon")).toHaveAttribute("data-name", "Spinner");
		expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
	});

	it("renders optional text and merges extra classes", () => {
		const { container } = render(
			<LoadingSpinner text="Loading data" className="min-h-40" />,
		);

		expect(screen.getByText("Loading data")).toBeInTheDocument();
		expect(container.firstChild).toHaveClass("py-16", "min-h-40");
	});
});
