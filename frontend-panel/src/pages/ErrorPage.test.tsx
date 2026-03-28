import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "@/pages/ErrorPage";

const mockState = vi.hoisted(() => ({
	error: null as unknown,
	navigate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
	isRouteErrorResponse: (value: unknown) =>
		typeof value === "object" &&
		value !== null &&
		"status" in value &&
		"statusText" in value,
	useNavigate: () => mockState.navigate,
	useRouteError: () => mockState.error,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
	}) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name }: { name: string }) => (
		<span data-testid="icon" data-name={name} />
	),
}));

describe("ErrorPage", () => {
	beforeEach(() => {
		mockState.error = null;
		mockState.navigate.mockReset();
	});

	it("renders route response errors with status and status text", () => {
		mockState.error = { status: 404, statusText: "Not Found" };

		render(<ErrorPage />);

		expect(screen.getByText("404")).toBeInTheDocument();
		expect(screen.getByText("Not Found")).toBeInTheDocument();
		expect(screen.getAllByTestId("icon")[0]).toHaveAttribute(
			"data-name",
			"CircleAlert",
		);
	});

	it("renders generic Error instances and navigates home", () => {
		mockState.error = new Error("Boom");

		render(<ErrorPage />);

		expect(screen.queryByText("404")).not.toBeInTheDocument();
		expect(screen.getByText("Boom")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /Go Home/i }));

		expect(mockState.navigate).toHaveBeenCalledWith("/");
	});

	it("falls back to the default message for unknown errors", () => {
		mockState.error = "unexpected";

		render(<ErrorPage />);

		expect(
			screen.getByText("An unexpected error occurred."),
		).toBeInTheDocument();
	});
});
