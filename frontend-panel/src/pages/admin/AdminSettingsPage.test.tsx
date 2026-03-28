import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";

const mockState = vi.hoisted(() => ({
	deleteConfig: vi.fn(),
	handleApiError: vi.fn(),
	listConfigs: vi.fn(),
	schema: vi.fn(),
	setConfig: vi.fn(),
	toastSuccess: vi.fn(),
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "config_reset") return `config_reset:${options?.value}`;
			return key;
		},
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: (...args: unknown[]) => mockState.toastSuccess(...args),
	},
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

vi.mock("@/components/common/EmptyState", () => ({
	EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/components/common/SkeletonTable", () => ({
	SkeletonTable: ({ columns, rows }: { columns: number; rows: number }) => (
		<div>{`skeleton:${columns}:${rows}`}</div>
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
		actions,
	}: {
		title: string;
		description: string;
		actions?: React.ReactNode;
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

vi.mock("@/components/layout/AdminSurface", () => ({
	AdminSurface: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
	}) => <div className={className}>{children}</div>,
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
		className,
		disabled,
		onClick,
		type,
	}: {
		children: React.ReactNode;
		className?: string;
		disabled?: boolean;
		onClick?: () => void;
		type?: "button" | "submit";
	}) => (
		<button
			type={type ?? "button"}
			className={className}
			disabled={disabled}
			onClick={onClick}
		>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
		open ? <div>{children}</div> : null,
	DialogContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogTitle: ({ children }: { children: React.ReactNode }) => (
		<h2>{children}</h2>
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/ui/input", () => ({
	Input: ({
		disabled,
		id,
		onChange,
		placeholder,
		required,
		value,
	}: {
		disabled?: boolean;
		id?: string;
		onChange?: (event: { target: { value: string } }) => void;
		placeholder?: string;
		required?: boolean;
		value?: string;
	}) => (
		<input
			disabled={disabled}
			id={id}
			onChange={(event) =>
				onChange?.({ target: { value: event.target.value } })
			}
			placeholder={placeholder}
			required={required}
			value={value}
		/>
	),
}));

vi.mock("@/components/ui/label", () => ({
	Label: ({
		children,
		htmlFor,
	}: {
		children: React.ReactNode;
		htmlFor?: string;
	}) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/switch", () => ({
	Switch: ({
		checked,
		id,
		onCheckedChange,
	}: {
		checked: boolean;
		id?: string;
		onCheckedChange?: (checked: boolean) => void;
	}) => (
		<button
			type="button"
			id={id}
			aria-label={`switch:${id ?? "config"}:${checked}`}
			onClick={() => onCheckedChange?.(!checked)}
		/>
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

vi.mock("@/components/ui/tabs", () => ({
	Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	TabsContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TabsList: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TabsTrigger: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

vi.mock("@/components/ui/tooltip", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TooltipContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TooltipProvider: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TooltipTrigger: ({
		children,
		render,
	}: {
		children?: React.ReactNode;
		render?: React.ReactNode;
	}) => render ?? children,
}));

vi.mock("@/hooks/useApiError", () => ({
	handleApiError: (...args: unknown[]) => mockState.handleApiError(...args),
}));

vi.mock("@/services/adminService", () => ({
	adminConfigService: {
		delete: (...args: unknown[]) => mockState.deleteConfig(...args),
		list: (...args: unknown[]) => mockState.listConfigs(...args),
		schema: (...args: unknown[]) => mockState.schema(...args),
		set: (...args: unknown[]) => mockState.setConfig(...args),
	},
}));

function createConfig(overrides: Record<string, unknown> = {}) {
	return {
		category: "storage",
		description: "desc",
		is_sensitive: false,
		key: "storage.enabled",
		requires_restart: false,
		source: "system",
		value: "true",
		value_type: "boolean",
		...overrides,
	};
}

function createSchemaItem(overrides: Record<string, unknown> = {}) {
	return {
		default_value: "false",
		key: "storage.enabled",
		...overrides,
	};
}

describe("AdminSettingsPage", () => {
	beforeEach(() => {
		mockState.deleteConfig.mockReset();
		mockState.handleApiError.mockReset();
		mockState.listConfigs.mockReset();
		mockState.schema.mockReset();
		mockState.setConfig.mockReset();
		mockState.toastSuccess.mockReset();

		mockState.listConfigs.mockResolvedValue({
			items: [
				createConfig(),
				createConfig({
					category: "custom",
					key: "custom.theme",
					source: "custom",
					value: "ocean",
					value_type: "string",
				}),
			],
		});
		mockState.schema.mockResolvedValue([
			createSchemaItem(),
			createSchemaItem({
				key: "custom.theme",
				default_value: "",
			}),
		]);
		mockState.setConfig.mockImplementation(async (key: string, value: string) =>
			createConfig({
				category: key.startsWith("custom.") ? "custom" : "storage",
				key,
				source: key.startsWith("custom.") ? "custom" : "system",
				value,
				value_type:
					value === "true" || value === "false" ? "boolean" : "string",
			}),
		);
		mockState.deleteConfig.mockResolvedValue(undefined);
	});

	it("shows a loading state and then an empty state when there are no configs", async () => {
		mockState.listConfigs.mockResolvedValueOnce({ items: [] });
		mockState.schema.mockResolvedValueOnce([]);

		render(<AdminSettingsPage />);

		expect(screen.getByText("skeleton:4:8")).toBeInTheDocument();
		expect(await screen.findByText("no_config")).toBeInTheDocument();
	});

	it("renders config rows and updates boolean values", async () => {
		render(<AdminSettingsPage />);

		await screen.findByText("storage.enabled");

		fireEvent.click(screen.getByLabelText("switch:config:true"));

		await waitFor(() => {
			expect(mockState.setConfig).toHaveBeenCalledWith(
				"storage.enabled",
				"false",
			);
		});
	});

	it("creates and deletes custom configs", async () => {
		render(<AdminSettingsPage />);

		await screen.findByText("custom.theme");

		fireEvent.click(screen.getByRole("button", { name: /add_custom_config/i }));
		fireEvent.change(screen.getByLabelText("config_key"), {
			target: { value: "custom.accent" },
		});
		fireEvent.change(screen.getByLabelText("config_value"), {
			target: { value: "sunset" },
		});
		fireEvent.click(screen.getByRole("button", { name: "core:create" }));

		await waitFor(() => {
			expect(mockState.setConfig).toHaveBeenCalledWith(
				"custom.accent",
				"sunset",
			);
		});
		expect(mockState.toastSuccess).toHaveBeenCalledWith("config_created");

		fireEvent.click(screen.getAllByRole("button", { name: "Trash" })[0]);

		expect(screen.getByText('core:delete "custom.theme"?')).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "core:delete" }));

		await waitFor(() => {
			expect(mockState.deleteConfig).toHaveBeenCalledWith("custom.theme");
		});
		expect(mockState.toastSuccess).toHaveBeenCalledWith("config_deleted");
	});
});
