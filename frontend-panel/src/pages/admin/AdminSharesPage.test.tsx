import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminSharesPage from "@/pages/admin/AdminSharesPage";

const mockState = vi.hoisted(() => ({
	deleteShare: vi.fn(),
	handleApiError: vi.fn(),
	setItems: vi.fn(),
	toastSuccess: vi.fn(),
	useApiList: vi.fn(),
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: (...args: unknown[]) => mockState.toastSuccess(...args),
	},
}));

vi.mock("@/components/common/AdminTableList", () => ({
	AdminTableList: ({
		items,
		loading,
		emptyTitle,
		emptyDescription,
		headerRow,
		renderRow,
	}: {
		items: unknown[];
		loading: boolean;
		emptyTitle: string;
		emptyDescription: string;
		headerRow: React.ReactNode;
		renderRow: (item: never) => React.ReactNode;
	}) =>
		loading ? (
			<div>loading</div>
		) : items.length === 0 ? (
			<div>{`${emptyTitle}:${emptyDescription}`}</div>
		) : (
			<div>
				{headerRow}
				{items.map((item) => (
					<div key={String((item as { id: number }).id)}>
						{renderRow(item as never)}
					</div>
				))}
			</div>
		),
}));

vi.mock("@/components/common/ConfirmDialog", () => ({
	ConfirmDialog: ({
		open,
		title,
		description,
		confirmLabel,
		onConfirm,
	}: {
		open: boolean;
		title: string;
		description: string;
		confirmLabel: string;
		onConfirm: () => void;
	}) =>
		open ? (
			<div>
				<div>{title}</div>
				<div>{description}</div>
				<button type="button" onClick={onConfirm}>
					{confirmLabel}
				</button>
			</div>
		) : null,
}));

vi.mock("@/components/layout/AdminLayout", () => ({
	AdminLayout: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/layout/AdminPageHeader", () => ({
	AdminPageHeader: ({
		title,
		description,
	}: {
		title: string;
		description: string;
	}) => (
		<div>
			<h1>{title}</h1>
			<p>{description}</p>
		</div>
	),
}));

vi.mock("@/components/layout/AdminPageShell", () => ({
	AdminPageShell: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		className,
		onClick,
	}: {
		children: React.ReactNode;
		className?: string;
		onClick?: () => void;
	}) => (
		<button type="button" className={className} onClick={onClick}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/ui/table", () => ({
	TableCell: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TableHead: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TableHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TableRow: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/hooks/useApiError", () => ({
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

vi.mock("@/lib/format", () => ({
	formatDateShort: (value: string) => `date:${value}`,
}));

vi.mock("@/services/adminService", () => ({
	adminShareService: {
		delete: (...args: unknown[]) => mockState.deleteShare(...args),
		list: vi.fn(),
	},
}));

function createShare(overrides: Record<string, unknown> = {}) {
	return {
		created_at: "2026-03-28T00:00:00Z",
		download_count: 1,
		id: 11,
		max_downloads: 0,
		target: { type: "file", id: 5 },
		token: "share-token",
		user_id: 9,
		expires_at: null,
		...overrides,
	};
}

describe("AdminSharesPage", () => {
	beforeEach(() => {
		mockState.deleteShare.mockReset();
		mockState.handleApiError.mockReset();
		mockState.setItems.mockReset();
		mockState.toastSuccess.mockReset();
		mockState.useApiList.mockReset();
		mockState.deleteShare.mockResolvedValue(undefined);
		mockState.useApiList.mockReturnValue({
			items: [
				createShare(),
				createShare({
					id: 12,
					token: "expired-token",
					expires_at: "2020-01-01T00:00:00Z",
				}),
				createShare({
					id: 13,
					token: "limited-token",
					max_downloads: 1,
				}),
			],
			loading: false,
			setItems: mockState.setItems,
		});
	});

	it("renders share rows with active, expired, and limit-reached states", () => {
		render(<AdminSharesPage />);

		expect(screen.getByText("shares")).toBeInTheDocument();
		expect(screen.getByText("shares_intro")).toBeInTheDocument();
		expect(screen.getByText("share-token")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /share-token/ })).toHaveAttribute(
			"href",
			"/s/share-token",
		);
		expect(screen.getAllByText("core:active")).toHaveLength(1);
		expect(screen.getByText("core:expired")).toBeInTheDocument();
		expect(screen.getByText("limit_reached")).toBeInTheDocument();
		expect(screen.getByText("1 / 1")).toBeInTheDocument();
		expect(screen.getAllByText("date:2026-03-28T00:00:00Z")).toHaveLength(3);
	});

	it("deletes a share after confirmation and updates the list", async () => {
		render(<AdminSharesPage />);

		fireEvent.click(screen.getAllByRole("button", { name: "Trash" })[0]);

		expect(screen.getByText('core:delete "share-token"?')).toBeInTheDocument();
		expect(screen.getByText("delete_share_desc")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "core:delete" }));

		await waitFor(() => {
			expect(mockState.deleteShare).toHaveBeenCalledWith(11);
		});
		expect(mockState.setItems).toHaveBeenCalledWith(expect.any(Function));
		expect(mockState.toastSuccess).toHaveBeenCalledWith("share_deleted");
	});

	it("routes delete failures through handleApiError", async () => {
		const error = new Error("delete failed");
		mockState.deleteShare.mockRejectedValueOnce(error);

		render(<AdminSharesPage />);

		fireEvent.click(screen.getAllByRole("button", { name: "Trash" })[0]);
		fireEvent.click(screen.getByRole("button", { name: "core:delete" }));

		await waitFor(() => {
			expect(mockState.handleApiError).toHaveBeenCalledWith(error);
		});
	});
});
