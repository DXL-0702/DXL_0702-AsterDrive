import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminRemoteNodesPage from "@/pages/admin/AdminRemoteNodesPage";

const mockState = vi.hoisted(() => ({
	brandingSiteUrl: null as string | null,
	handleApiError: vi.fn(),
	reload: vi.fn(),
	searchParams: "",
	setItems: vi.fn(),
	setSearchParams: vi.fn(),
	setTotal: vi.fn(),
	toastError: vi.fn(),
	useApiList: vi.fn(),
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "page_size_option") return `page-size:${options?.count}`;
			return key;
		},
	}),
}));

vi.mock("react-router-dom", () => ({
	useSearchParams: () => [
		new URLSearchParams(mockState.searchParams),
		mockState.setSearchParams,
	],
}));

vi.mock("sonner", () => ({
	toast: {
		error: (...args: unknown[]) => mockState.toastError(...args),
		info: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("@/components/admin/AdminOffsetPagination", () => ({
	AdminOffsetPagination: () => null,
}));

vi.mock("@/components/admin/admin-remote-nodes-page/RemoteNodeDialog", () => ({
	RemoteNodeDialog: ({
		mode,
		open,
	}: {
		mode: "create" | "edit";
		open: boolean;
	}) => (open ? <div data-testid="remote-node-dialog">{mode}</div> : null),
}));

vi.mock(
	"@/components/admin/admin-remote-nodes-page/RemoteNodeEnrollmentDialog",
	() => ({
		RemoteNodeEnrollmentDialog: () => null,
	}),
);

vi.mock("@/components/admin/admin-remote-nodes-page/RemoteNodesTable", () => ({
	RemoteNodesTable: () => <div data-testid="remote-nodes-table" />,
}));

vi.mock("@/components/common/ConfirmDialog", () => ({
	ConfirmDialog: () => null,
}));

vi.mock("@/components/layout/AdminLayout", () => ({
	AdminLayout: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/layout/AdminPageHeader", () => ({
	AdminPageHeader: ({
		actions,
		description,
		title,
	}: {
		actions?: React.ReactNode;
		description?: string;
		title: string;
	}) => (
		<div>
			<h1>{title}</h1>
			<p>{description}</p>
			<div>{actions}</div>
		</div>
	),
}));

vi.mock("@/components/layout/AdminPageShell", () => ({
	AdminPageShell: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		className,
		disabled,
		onClick,
		title,
	}: {
		children: React.ReactNode;
		className?: string;
		disabled?: boolean;
		onClick?: () => void;
		title?: string;
	}) => (
		<button
			type="button"
			className={className}
			disabled={disabled}
			onClick={onClick}
			title={title}
		>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: () => <span aria-hidden="true" />,
}));

vi.mock("@/hooks/useApiError", () => ({
	getApiErrorMessage: (error: unknown) => String(error),
	handleApiError: (...args: unknown[]) => mockState.handleApiError(...args),
}));

vi.mock("@/hooks/useApiList", () => ({
	useApiList: (...args: unknown[]) => mockState.useApiList(...args),
}));

vi.mock("@/hooks/useConfirmDialog", () => ({
	useConfirmDialog: (handler: (id: number) => Promise<void>) => {
		const [confirmId, setConfirmId] = useState<number | null>(null);

		return {
			confirmId,
			requestConfirm: (id: number) => setConfirmId(id),
			dialogProps: {
				open: confirmId !== null,
				onConfirm: () => {
					if (confirmId !== null) {
						void handler(confirmId);
					}
				},
				onOpenChange: (open: boolean) => {
					if (!open) setConfirmId(null);
				},
			},
		};
	},
}));

vi.mock("@/hooks/usePageTitle", () => ({
	usePageTitle: vi.fn(),
}));

vi.mock("@/lib/clipboard", () => ({
	writeTextToClipboard: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
	logger: {
		warn: vi.fn(),
	},
}));

vi.mock("@/services/adminService", () => ({
	adminRemoteNodeService: {
		create: vi.fn(),
		createEnrollmentCommand: vi.fn(),
		createIngressProfile: vi.fn(),
		delete: vi.fn(),
		deleteIngressProfile: vi.fn(),
		get: vi.fn(),
		list: vi.fn(),
		listIngressProfiles: vi.fn(),
		testConnection: vi.fn(),
		update: vi.fn(),
		updateIngressProfile: vi.fn(),
	},
}));

vi.mock("@/stores/brandingStore", () => ({
	useBrandingStore: (
		selector: (state: { siteUrl: string | null }) => unknown,
	) =>
		selector({
			siteUrl: mockState.brandingSiteUrl,
		}),
}));

function renderPage() {
	render(<AdminRemoteNodesPage />);
}

describe("AdminRemoteNodesPage", () => {
	beforeEach(() => {
		mockState.brandingSiteUrl = null;
		mockState.handleApiError.mockReset();
		mockState.reload.mockReset();
		mockState.searchParams = "";
		mockState.setItems.mockReset();
		mockState.setSearchParams.mockReset();
		mockState.setTotal.mockReset();
		mockState.toastError.mockReset();
		mockState.useApiList.mockReset();
		mockState.useApiList.mockReturnValue({
			items: [],
			loading: false,
			reload: mockState.reload,
			setItems: mockState.setItems,
			setTotal: mockState.setTotal,
			total: 0,
		});
	});

	it("blocks the create dialog when the primary public site URL is not set", () => {
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "new_remote_node" }));

		expect(mockState.toastError).toHaveBeenCalledWith(
			"remote_node_primary_site_url_required",
		);
		expect(screen.queryByTestId("remote-node-dialog")).not.toBeInTheDocument();
	});

	it("opens the create dialog when the primary public site URL is set", () => {
		mockState.brandingSiteUrl = "https://drive.example.com";

		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "new_remote_node" }));

		expect(mockState.toastError).not.toHaveBeenCalled();
		expect(screen.getByTestId("remote-node-dialog")).toHaveTextContent(
			"create",
		);
	});
});
