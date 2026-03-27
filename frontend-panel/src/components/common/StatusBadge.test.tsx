import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusBadge } from "@/components/common/StatusBadge";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
	}),
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
	}) => (
		<span data-testid="badge" className={className}>
			{children}
		</span>
	),
}));

describe("StatusBadge", () => {
	it("renders translated labels for each status variant", () => {
		const { rerender } = render(<StatusBadge status="active" />);
		expect(screen.getByText("translated:active")).toBeInTheDocument();
		expect(screen.getByTestId("badge")).toHaveClass("text-emerald-700");

		rerender(<StatusBadge status="expired" />);
		expect(screen.getByText("translated:expired")).toBeInTheDocument();
		expect(screen.getByTestId("badge")).toHaveClass("text-red-700");

		rerender(<StatusBadge status="disabled" />);
		expect(screen.getByText("translated:disabled")).toBeInTheDocument();
		expect(screen.getByTestId("badge")).toHaveClass("text-gray-700");
	});
});
