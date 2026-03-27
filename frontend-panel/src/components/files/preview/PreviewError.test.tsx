import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreviewError } from "@/components/files/preview/PreviewError";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

describe("PreviewError", () => {
	it("renders the translated error message and retry button", () => {
		const onRetry = vi.fn();

		render(<PreviewError onRetry={onRetry} />);

		expect(screen.getByText("preview_load_failed")).toBeInTheDocument();
		const retryButton = screen.getByRole("button", { name: "preview_retry" });
		fireEvent.click(retryButton);

		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("omits the retry button when no retry handler is provided", () => {
		render(<PreviewError />);

		expect(screen.getByText("preview_load_failed")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "preview_retry" }),
		).not.toBeInTheDocument();
	});
});
