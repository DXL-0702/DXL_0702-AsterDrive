import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineBootFallback } from "@/components/layout/OfflineBootFallback";

const mockLocation = {
	assign: vi.fn(),
	reload: vi.fn(),
};

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
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
	Icon: ({ name }: { name: string }) => (
		<span data-testid="icon" data-name={name} />
	),
}));

describe("OfflineBootFallback", () => {
	beforeEach(() => {
		mockLocation.assign.mockReset();
		mockLocation.reload.mockReset();
		Object.defineProperty(window, "location", {
			configurable: true,
			value: mockLocation,
		});
	});

	it("renders translated offline copy and both actions", () => {
		render(<OfflineBootFallback />);

		expect(
			screen.getByText("translated:offline_boot_title"),
		).toBeInTheDocument();
		expect(
			screen.getByText("translated:offline_boot_description"),
		).toBeInTheDocument();
		expect(
			screen.getByText("translated:offline_boot_hint"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /translated:offline_boot_retry/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /translated:offline_boot_login/i }),
		).toBeInTheDocument();
	});

	it("retries reloads and redirects to login", () => {
		render(<OfflineBootFallback />);

		fireEvent.click(
			screen.getByRole("button", { name: /translated:offline_boot_retry/i }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: /translated:offline_boot_login/i }),
		);

		expect(mockLocation.reload).toHaveBeenCalledTimes(1);
		expect(mockLocation.assign).toHaveBeenCalledWith("/login");
	});
});
