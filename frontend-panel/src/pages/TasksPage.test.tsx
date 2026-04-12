import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TasksPage from "@/pages/TasksPage";
import type { TaskInfo } from "@/types/api";

const mockState = vi.hoisted(() => ({
	handleApiError: vi.fn(),
	listInWorkspace: vi.fn(),
	retryTask: vi.fn(),
	toastSuccess: vi.fn(),
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (
				key === "tasks:pagination_desc" ||
				key === "tasks:progress_ratio" ||
				key === "tasks:task_id_label" ||
				key === "tasks:created_at" ||
				key === "tasks:started_at" ||
				key === "tasks:finished_at"
			) {
				return `${key}:${JSON.stringify(options ?? {})}`;
			}
			return key;
		},
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: (...args: unknown[]) => mockState.toastSuccess(...args),
	},
}));

vi.mock("@/components/common/EmptyState", () => ({
	EmptyState: (props: { description: string; title: string }) => (
		<div>{`${props.title}:${props.description}`}</div>
	),
}));

vi.mock("@/components/layout/AppLayout", () => ({
	AppLayout: (props: { children: React.ReactNode }) => (
		<div>{props.children}</div>
	),
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: (props: { children: React.ReactNode }) => (
		<span>{props.children}</span>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: (props: {
		"aria-label"?: string;
		children: React.ReactNode;
		disabled?: boolean;
		onClick?: () => void;
		title?: string;
	}) => (
		<button
			type="button"
			aria-label={props["aria-label"]}
			disabled={props.disabled}
			onClick={props.onClick}
			title={props.title}
		>
			{props.children}
		</button>
	),
}));

vi.mock("@/components/ui/card", () => ({
	Card: (props: { children?: React.ReactNode; className?: string }) => (
		<div className={props.className}>{props.children}</div>
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: (props: { name: string }) => <span>{`icon:${props.name}`}</span>,
}));

vi.mock("@/components/ui/progress", () => ({
	Progress: (props: { value: number }) => (
		<div data-testid="progress" data-value={String(props.value)} />
	),
}));

vi.mock("@/hooks/useApiError", () => ({
	handleApiError: (...args: unknown[]) => mockState.handleApiError(...args),
}));

vi.mock("@/hooks/usePageTitle", () => ({
	usePageTitle: () => undefined,
}));

vi.mock("@/lib/format", () => ({
	formatBytes: (value: number) => `bytes:${value}`,
	formatDateAbsolute: (value: string) => `date:${value}`,
}));

vi.mock("@/services/taskService", () => ({
	taskService: {
		listInWorkspace: (...args: unknown[]) => mockState.listInWorkspace(...args),
		retryTask: (...args: unknown[]) => mockState.retryTask(...args),
	},
}));

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		attempt_count: 0,
		can_retry: false,
		created_at: "2026-04-10T00:00:00Z",
		creator_user_id: 1,
		display_name: "Extract archive",
		expires_at: "2026-04-11T00:00:00Z",
		finished_at: null,
		id: 1,
		kind: "archive_extract",
		last_error: null,
		max_attempts: 3,
		payload_json: "{}",
		progress_current: 20,
		progress_percent: 40,
		progress_total: 50,
		result_json: null,
		share_id: null,
		started_at: "2026-04-10T00:01:00Z",
		status: "processing",
		status_text: "building archive",
		team_id: null,
		updated_at: "2026-04-10T00:02:00Z",
		...overrides,
	};
}

describe("TasksPage", () => {
	beforeEach(() => {
		mockState.handleApiError.mockReset();
		mockState.listInWorkspace.mockReset();
		mockState.retryTask.mockReset();
		mockState.retryTask.mockResolvedValue(undefined);
		mockState.toastSuccess.mockReset();
	});

	it("polls while active tasks are present", async () => {
		mockState.listInWorkspace.mockResolvedValue({
			items: [createTask()],
			total: 1,
		});

		render(<TasksPage />);

		await waitFor(() => {
			expect(mockState.listInWorkspace).toHaveBeenCalledWith({
				limit: 20,
				offset: 0,
			});
		});

		await waitFor(
			() => {
				expect(mockState.listInWorkspace).toHaveBeenCalledTimes(2);
			},
			{ timeout: 4000 },
		);
	});

	it("retries failed tasks", async () => {
		mockState.listInWorkspace
			.mockResolvedValueOnce({
				items: [
					createTask({
						can_retry: true,
						last_error: "failed once",
						status: "failed",
					}),
				],
				total: 1,
			})
			.mockResolvedValueOnce({
				items: [
					createTask({
						can_retry: false,
						status: "retry",
					}),
				],
				total: 1,
			});

		render(<TasksPage />);

		expect(await screen.findByText("Extract archive")).toBeInTheDocument();

		fireEvent.click(screen.getByText("tasks:retry_task"));

		await waitFor(() => {
			expect(mockState.retryTask).toHaveBeenCalledWith(1);
		});
		expect(mockState.toastSuccess).toHaveBeenCalledWith("tasks:retry_success");
		await waitFor(() => {
			expect(mockState.listInWorkspace).toHaveBeenCalledTimes(2);
		});
	});
});
