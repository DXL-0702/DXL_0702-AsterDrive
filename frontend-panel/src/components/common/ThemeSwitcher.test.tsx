import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeSwitcher } from "@/components/common/ThemeSwitcher";

const mockState = vi.hoisted(() => ({
	resolvedTheme: "light",
	setMode: vi.fn(),
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
	}),
}));

vi.mock("@/stores/themeStore", () => ({
	useThemeStore: () => ({
		resolvedTheme: mockState.resolvedTheme,
		setMode: mockState.setMode,
	}),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ className }: { className?: string }) => (
		<button className={className} type="button" />
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name }: { name: string }) => (
		<span data-testid="icon" data-name={name} />
	),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuTrigger: ({
		render,
		children,
	}: {
		render: React.ReactNode;
		children: React.ReactNode;
	}) => (
		<div>
			{render}
			{children}
		</div>
	),
	DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuItem: ({
		children,
		onClick,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
	}) => (
		<button onClick={onClick} type="button">
			{children}
		</button>
	),
}));

describe("ThemeSwitcher", () => {
	beforeEach(() => {
		mockState.resolvedTheme = "light";
		mockState.setMode.mockReset();
	});

	it("renders the sun icon when the resolved theme is light", () => {
		render(<ThemeSwitcher />);

		expect(screen.getAllByTestId("icon")[0]).toHaveAttribute(
			"data-name",
			"Sun",
		);
	});

	it("renders the moon icon in dark mode and switches to all theme options", () => {
		mockState.resolvedTheme = "dark";

		render(<ThemeSwitcher />);

		expect(screen.getAllByTestId("icon")[0]).toHaveAttribute(
			"data-name",
			"Moon",
		);

		fireEvent.click(
			screen.getByRole("button", { name: /translated:theme_light/i }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: /translated:theme_dark/i }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: /translated:theme_system/i }),
		);

		expect(mockState.setMode).toHaveBeenNthCalledWith(1, "light");
		expect(mockState.setMode).toHaveBeenNthCalledWith(2, "dark");
		expect(mockState.setMode).toHaveBeenNthCalledWith(3, "system");
	});
});
