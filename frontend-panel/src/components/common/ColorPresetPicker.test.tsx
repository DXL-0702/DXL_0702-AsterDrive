import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ColorPresetPicker } from "@/components/common/ColorPresetPicker";

const mockState = vi.hoisted(() => ({
	colorPreset: "green",
	setColorPreset: vi.fn(),
}));

vi.mock("@/stores/themeStore", () => ({
	useThemeStore: () => ({
		colorPreset: mockState.colorPreset,
		setColorPreset: mockState.setColorPreset,
	}),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: () => <span data-testid="check-icon" />,
}));

describe("ColorPresetPicker", () => {
	beforeEach(() => {
		mockState.colorPreset = "green";
		mockState.setColorPreset.mockReset();
	});

	it("highlights the selected preset and shows a check icon", () => {
		const { container } = render(<ColorPresetPicker />);
		const buttons = screen.getAllByRole("button");

		expect(buttons).toHaveLength(4);
		expect(screen.getByTestId("check-icon")).toBeInTheDocument();
		expect(container.querySelector(".ring-2")).toBeInTheDocument();
	});

	it("switches to the clicked preset", () => {
		render(<ColorPresetPicker />);

		fireEvent.click(screen.getAllByRole("button")[3]);

		expect(mockState.setColorPreset).toHaveBeenCalledWith("orange");
	});
});
