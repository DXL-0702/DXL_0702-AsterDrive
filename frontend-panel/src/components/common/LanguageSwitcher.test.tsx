import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";

const mockState = vi.hoisted(() => ({
	changeLanguage: vi.fn(),
	queuePreferenceSync: vi.fn(),
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
		i18n: {
			changeLanguage: mockState.changeLanguage,
		},
	}),
}));

vi.mock("@/lib/preferenceSync", () => ({
	queuePreferenceSync: mockState.queuePreferenceSync,
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
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
}));

describe("LanguageSwitcher", () => {
	beforeEach(() => {
		mockState.changeLanguage.mockReset();
		mockState.queuePreferenceSync.mockReset();
	});

	it("renders the globe icon and both language options", () => {
		render(<LanguageSwitcher />);

		expect(screen.getByTestId("icon")).toHaveAttribute("data-name", "Globe");
		expect(
			screen.getByRole("button", { name: "translated:language_en" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "translated:language_zh" }),
		).toBeInTheDocument();
	});

	it("switches language and queues preference sync", () => {
		render(<LanguageSwitcher />);

		fireEvent.click(
			screen.getByRole("button", { name: "translated:language_en" }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "translated:language_zh" }),
		);

		expect(mockState.changeLanguage).toHaveBeenNthCalledWith(1, "en");
		expect(mockState.changeLanguage).toHaveBeenNthCalledWith(2, "zh");
		expect(mockState.queuePreferenceSync).toHaveBeenNthCalledWith(1, {
			language: "en",
		});
		expect(mockState.queuePreferenceSync).toHaveBeenNthCalledWith(2, {
			language: "zh",
		});
	});
});
