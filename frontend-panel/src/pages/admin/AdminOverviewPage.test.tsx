import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminOverviewPage from "@/pages/admin/AdminOverviewPage";

const mockState = vi.hoisted(() => ({
	get: vi.fn(),
	handleApiError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "overview_generated_at") {
				return `generated:${options?.date}`;
			}
			if (key === "overview_range_badge") {
				return `range:${options?.days}`;
			}
			if (key === "overview_today_new_users_badge") {
				return `new-users:${options?.count}`;
			}
			if (key === "overview_today_uploads_badge") {
				return `uploads:${options?.count}`;
			}
			if (key === "overview_today_shares_badge") {
				return `shares:${options?.count}`;
			}
			if (key === "overview_browser_timezone_option") {
				return `browser-tz:${options?.timezone}`;
			}
			if (key === "overview_days_option") {
				return `days:${options?.count}`;
			}
			return key;
		},
	}),
}));

vi.mock("@/components/common/EmptyState", () => ({
	EmptyState: ({
		title,
		description,
		action,
	}: {
		title: string;
		description?: string;
		action?: React.ReactNode;
	}) => (
		<div>
			<div>{title}</div>
			<div>{description}</div>
			<div>{action}</div>
		</div>
	),
}));

vi.mock("@/components/common/SkeletonTable", () => ({
	SkeletonTable: ({ columns, rows }: { columns: number; rows: number }) => (
		<div>{`skeleton-table:${columns}:${rows}`}</div>
	),
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
		toolbar,
		actions,
	}: {
		title: string;
		description?: string;
		toolbar?: React.ReactNode;
		actions?: React.ReactNode;
	}) => (
		<div>
			<h1>{title}</h1>
			<p>{description}</p>
			<div>{toolbar}</div>
			<div>{actions}</div>
		</div>
	),
}));

vi.mock("@/components/layout/AdminPageShell", () => ({
	AdminPageShell: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/layout/AdminSurface", () => ({
	AdminSurface: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
	}) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		disabled,
		onClick,
	}: {
		children: React.ReactNode;
		disabled?: boolean;
		onClick?: () => void;
	}) => (
		<button type="button" disabled={disabled} onClick={onClick}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/card", () => ({
	Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	CardContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CardDescription: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CardHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CardTitle: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("recharts", () => ({
	CartesianGrid: () => <div>recharts-grid</div>,
	Line: () => <div>recharts-line</div>,
	LineChart: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	Tooltip: () => <div>recharts-tooltip</div>,
	XAxis: () => <div>recharts-x-axis</div>,
	YAxis: () => <div>recharts-y-axis</div>,
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/ui/select", () => ({
	Select: ({
		children,
		onValueChange,
		value,
	}: {
		children: React.ReactNode;
		onValueChange?: (value: string) => void;
		value?: string;
	}) => (
		<div>
			<div>{`select:${value}`}</div>
			<button type="button" onClick={() => onValueChange?.("30")}>
				{`set:${value}:30`}
			</button>
			<button type="button" onClick={() => onValueChange?.("Asia/Shanghai")}>
				{`set:${value}:Asia/Shanghai`}
			</button>
			{children}
		</div>
	),
	SelectContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectItem: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectValue: () => <span>select-value</span>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
	ScrollArea: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/skeleton", () => ({
	Skeleton: ({ className }: { className?: string }) => (
		<div>{`skeleton:${className ?? ""}`}</div>
	),
}));

vi.mock("@/components/ui/table", () => ({
	Table: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	TableBody: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
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

vi.mock("@/lib/format", () => ({
	formatBytes: (value: number) => `bytes:${value}`,
	formatDateAbsolute: (value: string) => `date:${value}`,
}));

vi.mock("@/services/adminService", () => ({
	adminOverviewService: {
		get: (...args: unknown[]) => mockState.get(...args),
	},
}));

function createOverview() {
	return {
		days: 7,
		daily_reports: [
			{
				date: "2026-03-29",
				deletions: 1,
				new_users: 2,
				share_creations: 3,
				sign_ins: 4,
				total_events: 10,
				uploads: 5,
			},
		],
		generated_at: "2026-03-29T10:00:00Z",
		recent_events: [
			{
				action: "share_create",
				created_at: "2026-03-29T09:30:00Z",
				entity_id: 7,
				entity_name: "report.pdf",
				entity_type: "file",
				id: 1,
				ip_address: "127.0.0.1",
				user_agent: "Vitest",
				user_id: 9,
			},
		],
		stats: {
			active_users: 11,
			audit_events_today: 12,
			disabled_users: 1,
			new_users_today: 2,
			total_blobs: 99,
			total_blob_bytes: 2048,
			total_files: 120,
			total_file_bytes: 4096,
			total_shares: 6,
			total_users: 12,
			shares_today: 3,
			uploads_today: 5,
		},
		timezone: "UTC",
	};
}

describe("AdminOverviewPage", () => {
	beforeEach(() => {
		mockState.get.mockReset();
		mockState.handleApiError.mockReset();
		mockState.get.mockResolvedValue(createOverview());
	});

	it("shows loading placeholders while the overview request is pending", () => {
		mockState.get.mockImplementationOnce(() => new Promise(() => undefined));

		render(<AdminOverviewPage />);

		expect(screen.getAllByText(/skeleton:/i).length).toBeGreaterThan(0);
		expect(screen.getByText("skeleton-table:7:7")).toBeInTheDocument();
		expect(screen.getByText("skeleton-table:4:8")).toBeInTheDocument();
	});

	it("renders overview stats and refreshes on demand", async () => {
		render(<AdminOverviewPage />);

		await waitFor(() => {
			expect(mockState.get).toHaveBeenCalledTimes(1);
		});

		expect(screen.getByText("overview")).toBeInTheDocument();
		expect(screen.getByText("overview_daily_trend")).toBeInTheDocument();
		expect(screen.getByText("overview_summary")).toBeInTheDocument();
		expect(screen.getByText("overview_total_users")).toBeInTheDocument();
		expect(screen.getByText("120")).toBeInTheDocument();
		expect(screen.getByText("99")).toBeInTheDocument();
		expect(screen.getByText("bytes:4096")).toBeInTheDocument();
		expect(screen.getByText("bytes:2048")).toBeInTheDocument();
		expect(screen.getByText("report.pdf")).toBeInTheDocument();
		expect(screen.getByText("range:7")).toBeInTheDocument();
		expect(screen.getByText("new-users:2")).toBeInTheDocument();
		expect(screen.getByText("uploads:5")).toBeInTheDocument();
		expect(screen.getByText("shares:3")).toBeInTheDocument();
		expect(
			screen.getByText("generated:date:2026-03-29T10:00:00Z"),
		).toBeInTheDocument();
		expect(screen.getByText("recharts-line")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /set:.*:30/i }));

		await waitFor(() => {
			expect(mockState.get).toHaveBeenCalledTimes(2);
		});

		fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

		await waitFor(() => {
			expect(mockState.get).toHaveBeenCalledTimes(3);
		});
	});
});
