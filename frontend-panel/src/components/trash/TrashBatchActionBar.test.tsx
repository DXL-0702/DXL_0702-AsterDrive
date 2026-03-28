import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrashBatchActionBar } from "@/components/trash/TrashBatchActionBar";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "selected_count") return `selected:${options?.count}`;
			return key;
		},
	}),
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
	Icon: ({ name }: { name: string }) => <span>{`icon:${name}`}</span>,
}));

describe("TrashBatchActionBar", () => {
	it("does not render when nothing is selected", () => {
		const { container } = render(
			<TrashBatchActionBar
				count={0}
				onRestore={vi.fn()}
				onPurge={vi.fn()}
				onClearSelection={vi.fn()}
			/>,
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("renders the selected count and triggers all batch actions", () => {
		const onRestore = vi.fn();
		const onPurge = vi.fn();
		const onClearSelection = vi.fn();

		render(
			<TrashBatchActionBar
				count={3}
				onRestore={onRestore}
				onPurge={onPurge}
				onClearSelection={onClearSelection}
			/>,
		);

		expect(screen.getByText("selected:3")).toBeInTheDocument();

		fireEvent.click(screen.getByText("files:trash_restore_selected"));
		fireEvent.click(screen.getByText("files:trash_delete_selected"));
		fireEvent.click(screen.getByRole("button", { name: "icon:X" }));

		expect(onRestore).toHaveBeenCalledTimes(1);
		expect(onPurge).toHaveBeenCalledTimes(1);
		expect(onClearSelection).toHaveBeenCalledTimes(1);
	});
});
