import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderControls } from "@/components/layout/HeaderControls";

const mockState = vi.hoisted(() => ({
	navigate: vi.fn(),
	auth: {
		user: { username: "alice", role: "admin" },
		isAuthStale: false,
		logout: vi.fn(),
	},
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
	}),
}));

vi.mock("react-router-dom", () => ({
	useNavigate: () => mockState.navigate,
}));

vi.mock("@/stores/authStore", () => ({
	useAuthStore: (selector: (state: typeof mockState.auth) => unknown) =>
		selector(mockState.auth),
}));

vi.mock("@/components/common/LanguageSwitcher", () => ({
	LanguageSwitcher: () => <div>LanguageSwitcher</div>,
}));

vi.mock("@/components/common/ThemeSwitcher", () => ({
	ThemeSwitcher: () => <div>ThemeSwitcher</div>,
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({
		children,
		className,
	}: {
		children?: React.ReactNode;
		className?: string;
	}) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		className,
		onClick,
	}: {
		children?: React.ReactNode;
		className?: string;
		onClick?: () => void;
	}) => (
		<button type="button" className={className} onClick={onClick}>
			{children}
		</button>
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
	DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/components/ui/tooltip", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TooltipTrigger: ({
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
	TooltipContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

function deferredPromise() {
	let resolve!: () => void;
	const promise = new Promise<void>((nextResolve) => {
		resolve = nextResolve;
	});
	return { promise, resolve };
}

describe("HeaderControls", () => {
	beforeEach(() => {
		mockState.navigate.mockReset();
		mockState.auth.user = { username: "alice", role: "admin" };
		mockState.auth.isAuthStale = false;
		mockState.auth.logout.mockReset();
		mockState.auth.logout.mockResolvedValue(undefined);
	});

	it("renders actions, stale auth messaging, and admin controls", () => {
		mockState.auth.isAuthStale = true;

		render(
			<HeaderControls
				actions={<button type="button">Refresh</button>}
				showHomeButton
				homeLabel="Home"
				showAdminEntry
			/>,
		);

		expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
		expect(screen.getByText("ThemeSwitcher")).toBeInTheDocument();
		expect(screen.getByText("LanguageSwitcher")).toBeInTheDocument();
		expect(
			screen.getByText("translated:offline:offline_status_short"),
		).toBeInTheDocument();
		expect(
			screen.getByText("translated:offline:offline_mode"),
		).toBeInTheDocument();
		expect(
			screen.getByText("translated:offline:auth_stale_detail"),
		).toBeInTheDocument();
		expect(screen.getByText("alice")).toBeInTheDocument();
		expect(screen.getByText("admin")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /translated:admin_panel/i }),
		).toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: /Home/i })).toHaveLength(2);
	});

	it("hides the admin menu entry for non-admin users", () => {
		mockState.auth.user = { username: "bob", role: "user" };

		render(<HeaderControls showAdminEntry />);

		expect(screen.getByText("bob")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /translated:admin_panel/i }),
		).not.toBeInTheDocument();
		expect(screen.queryByText("admin")).not.toBeInTheDocument();
	});

	it("navigates from the home and admin entries", () => {
		render(<HeaderControls showHomeButton homeLabel="Home" showAdminEntry />);

		fireEvent.click(screen.getAllByRole("button", { name: /Home/i })[0]);
		fireEvent.click(
			screen.getByRole("button", { name: /translated:admin_panel/i }),
		);

		expect(mockState.navigate).toHaveBeenNthCalledWith(1, "/");
		expect(mockState.navigate).toHaveBeenNthCalledWith(2, "/admin");
	});

	it("shows loading during logout and redirects to login on success", async () => {
		const deferred = deferredPromise();
		mockState.auth.logout.mockReturnValueOnce(deferred.promise);

		render(<HeaderControls />);

		fireEvent.click(screen.getByRole("button", { name: /translated:logout/i }));

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /translated:loading/i }),
			).toBeInTheDocument();
		});

		await act(async () => {
			deferred.resolve();
			await deferred.promise;
		});

		expect(mockState.auth.logout).toHaveBeenCalledTimes(1);
		expect(mockState.navigate).toHaveBeenCalledWith("/login", {
			replace: true,
		});
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /translated:logout/i }),
			).toBeInTheDocument();
		});
	});
});
