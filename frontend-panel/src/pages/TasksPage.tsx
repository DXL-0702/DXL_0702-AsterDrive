import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { handleApiError } from "@/hooks/useApiError";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateAbsolute } from "@/lib/format";
import { workspaceFolderPath } from "@/lib/workspace";
import { taskService } from "@/services/taskService";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type {
	BackgroundTaskKind,
	BackgroundTaskStatus,
	TaskInfo,
	TaskStepInfo,
	TaskStepStatus,
} from "@/types/api";

const PAGE_SIZE = 20;
const TASK_POLL_INTERVAL_MS = 3000;
const ACTIVE_TASK_STATUSES = new Set<BackgroundTaskStatus>([
	"pending",
	"processing",
	"retry",
]);

function statusBadgeVariant(status: BackgroundTaskStatus) {
	switch (status) {
		case "pending":
		case "processing":
		case "retry":
			return "secondary";
		case "succeeded":
			return "default";
		case "failed":
			return "destructive";
		case "canceled":
			return "outline";
	}
}

function stepStatusTextClass(status: TaskStepStatus) {
	switch (status) {
		case "active":
			return "text-primary";
		case "succeeded":
			return "text-foreground";
		case "failed":
			return "text-destructive";
		case "canceled":
		case "pending":
			return "text-muted-foreground";
	}
}

function stepProgressPercent(step: TaskStepInfo) {
	if (step.progress_total <= 0) {
		return step.status === "succeeded" ? 100 : 0;
	}
	return Math.max(
		0,
		Math.min(
			100,
			Math.floor((step.progress_current * 100) / step.progress_total),
		),
	);
}

function stepConnectorClass(status: TaskStepStatus) {
	switch (status) {
		case "succeeded":
			return "bg-primary/70";
		case "active":
			return "bg-primary/35";
		case "failed":
			return "bg-destructive/35";
		case "canceled":
			return "bg-border/60";
		case "pending":
			return "bg-border/40";
	}
}

function stepCircleClass(status: TaskStepStatus) {
	switch (status) {
		case "active":
			return "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(249,115,22,0.16)]";
		case "succeeded":
			return "border-primary/40 bg-primary/12 text-foreground";
		case "failed":
			return "border-destructive/50 bg-destructive/10 text-destructive";
		case "canceled":
			return "border-border/70 bg-muted/35 text-muted-foreground";
		case "pending":
			return "border-border/60 bg-background/90 text-muted-foreground";
	}
}

function stepCircleLabel(index: number, status: TaskStepStatus) {
	switch (status) {
		case "failed":
			return "!";
		case "canceled":
			return "X";
		default:
			return String(index + 1);
	}
}

function currentTaskStep(task: TaskInfo) {
	return (
		task.steps.find((step) => step.status === "active") ??
		task.steps.find((step) => step.status === "failed") ??
		task.steps[task.steps.length - 1] ??
		null
	);
}

export default function TasksPage() {
	const { t } = useTranslation(["core", "tasks"]);
	const navigate = useNavigate();
	const workspace = useWorkspaceStore((s) => s.workspace);
	usePageTitle(t("tasks:title"));
	const [page, setPage] = useState(0);
	const [loading, setLoading] = useState(true);
	const [tasks, setTasks] = useState<TaskInfo[]>([]);
	const [total, setTotal] = useState(0);
	const [retryingTaskId, setRetryingTaskId] = useState<number | null>(null);

	const loadPage = useCallback(
		async (targetPage: number, options?: { silent?: boolean }) => {
			const silent = options?.silent ?? false;
			try {
				if (!silent) {
					setLoading(true);
				}
				const data = await taskService.listInWorkspace({
					limit: PAGE_SIZE,
					offset: targetPage * PAGE_SIZE,
				});
				setTasks(data.items);
				setTotal(data.total);
				return data;
			} catch (error) {
				if (!silent) {
					handleApiError(error);
				}
				return null;
			} finally {
				if (!silent) {
					setLoading(false);
				}
			}
		},
		[],
	);

	useEffect(() => {
		void loadPage(page);
	}, [loadPage, page]);

	const hasActiveTasks = useMemo(
		() => tasks.some((task) => ACTIVE_TASK_STATUSES.has(task.status)),
		[tasks],
	);

	useEffect(() => {
		if (!hasActiveTasks) {
			return;
		}

		const timer = window.setInterval(() => {
			void loadPage(page, { silent: true });
		}, TASK_POLL_INTERVAL_MS);

		return () => window.clearInterval(timer);
	}, [hasActiveTasks, loadPage, page]);

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const formatTaskStatus = (status: BackgroundTaskStatus) => {
		switch (status) {
			case "pending":
				return t("tasks:status_pending");
			case "processing":
				return t("tasks:status_processing");
			case "retry":
				return t("tasks:status_retry");
			case "succeeded":
				return t("tasks:status_succeeded");
			case "failed":
				return t("tasks:status_failed");
			case "canceled":
				return t("tasks:status_canceled");
		}
	};

	const formatTaskKind = (kind: BackgroundTaskKind) => {
		switch (kind) {
			case "archive_extract":
				return t("tasks:kind_archive_extract");
			case "archive_compress":
				return t("tasks:kind_archive_compress");
		}
	};

	const formatTaskStepStatus = (status: TaskStepStatus) => {
		switch (status) {
			case "pending":
				return t("tasks:step_status_pending");
			case "active":
				return t("tasks:step_status_active");
			case "succeeded":
				return t("tasks:step_status_succeeded");
			case "failed":
				return t("tasks:step_status_failed");
			case "canceled":
				return t("tasks:step_status_canceled");
		}
	};

	const formatTaskStepTitle = (
		taskKind: BackgroundTaskKind,
		step: TaskStepInfo,
	) => {
		const key = `tasks:step_${taskKind}_${step.key}`;
		const translated = t(key);
		return translated === key ? step.title : translated;
	};

	const handleRetry = useCallback(
		async (taskId: number) => {
			try {
				setRetryingTaskId(taskId);
				await taskService.retryTask(taskId);
				toast.success(t("tasks:retry_success"));
				await loadPage(page, { silent: true });
			} catch (error) {
				handleApiError(error);
			} finally {
				setRetryingTaskId(null);
			}
		},
		[loadPage, page, t],
	);

	const renderTaskMeta = (task: TaskInfo) => {
		const lines = [
			t("tasks:task_id_label", { id: task.id }),
			t("tasks:created_at", { date: formatDateAbsolute(task.created_at) }),
		];

		if (task.started_at) {
			lines.push(
				t("tasks:started_at", { date: formatDateAbsolute(task.started_at) }),
			);
		}

		if (task.finished_at) {
			lines.push(
				t("tasks:finished_at", { date: formatDateAbsolute(task.finished_at) }),
			);
		}

		return lines.join(" · ");
	};

	const parseTaskResult = (task: TaskInfo) => {
		if (!task.result) {
			return null;
		}

		switch (task.result.kind) {
			case "archive_compress":
				return {
					target_folder_id: task.result.target_folder_id ?? null,
					target_path: task.result.target_path,
				};
			case "archive_extract":
				return {
					target_folder_id: task.result.target_folder_id,
					target_path: task.result.target_path,
				};
			default:
				return null;
		}
	};

	const openTaskTargetFolder = useCallback(
		(targetFolderId: number | null) => {
			navigate(workspaceFolderPath(workspace, targetFolderId), {
				viewTransition: true,
			});
		},
		[navigate, workspace],
	);

	return (
		<AppLayout>
			<div className="min-h-0 flex-1 overflow-auto">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="text-2xl font-semibold tracking-tight">
							{t("tasks:title")}
						</h1>
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={() => void loadPage(page)}
							disabled={loading}
							aria-label={t("core:refresh")}
							title={t("core:refresh")}
						>
							<Icon
								name={loading ? "Spinner" : "ArrowsClockwise"}
								className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
							/>
						</Button>
						{hasActiveTasks ? (
							<span className="text-sm text-muted-foreground">
								{t("tasks:active_polling_hint")}
							</span>
						) : null}
					</div>

					{loading ? (
						<div className="space-y-3">
							{["task-s1", "task-s2", "task-s3"].map((key) => (
								<Card key={key} className="h-48 animate-pulse bg-muted/20" />
							))}
						</div>
					) : tasks.length === 0 ? (
						<Card className="bg-muted/15">
							<div className="py-12">
								<EmptyState
									icon={<Icon name="Clock" className="h-10 w-10" />}
									title={t("tasks:empty_title")}
									description={t("tasks:empty_desc")}
								/>
							</div>
						</Card>
					) : (
						<div className="space-y-3">
							{tasks.map((task) => {
								const parsedResult = parseTaskResult(task);
								const activeStep = currentTaskStep(task);
								const progressValue =
									task.status === "succeeded"
										? 100
										: Math.max(0, Math.min(100, task.progress_percent));
								const progressText =
									task.progress_total > 0
										? t("tasks:progress_ratio", {
												current: task.progress_current,
												total: task.progress_total,
											})
										: null;

								return (
									<Card key={task.id} className="p-4 md:p-5">
										<div className="flex flex-col gap-4">
											<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
												<div className="min-w-0 space-y-2">
													<div className="flex flex-wrap items-center gap-2">
														<h2 className="truncate text-lg font-semibold">
															{task.display_name}
														</h2>
														<Badge variant={statusBadgeVariant(task.status)}>
															{formatTaskStatus(task.status)}
														</Badge>
														<Badge variant="outline">
															{formatTaskKind(task.kind)}
														</Badge>
													</div>
													<p className="text-sm text-muted-foreground">
														{renderTaskMeta(task)}
													</p>
												</div>
												<div className="flex shrink-0 items-center gap-2">
													{task.can_retry ? (
														<Button
															variant="outline"
															size="sm"
															onClick={() => void handleRetry(task.id)}
															disabled={retryingTaskId === task.id}
														>
															<Icon
																name={
																	retryingTaskId === task.id
																		? "Spinner"
																		: "ArrowCounterClockwise"
																}
																className={`mr-1 h-4 w-4 ${
																	retryingTaskId === task.id
																		? "animate-spin"
																		: ""
																}`}
															/>
															{t("tasks:retry_task")}
														</Button>
													) : null}
												</div>
											</div>

											<div className="space-y-2">
												<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
													<span className="text-muted-foreground">
														{t("tasks:progress_label")}
													</span>
													<span className="font-medium">
														{progressText
															? `${progressValue}% · ${progressText}`
															: `${progressValue}%`}
													</span>
												</div>
												<Progress value={progressValue} className="h-2" />
												{task.status_text ? (
													<p className="text-sm text-muted-foreground">
														{t("tasks:status_text_label")}: {task.status_text}
													</p>
												) : null}
											</div>

											{task.steps.length > 0 ? (
												<div className="space-y-3 rounded-lg border bg-muted/15 px-3 py-3">
													<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
														<span className="font-medium">
															{t("tasks:steps_label")}
														</span>
														{activeStep ? (
															<span className="text-muted-foreground">
																{t("tasks:current_step_label")}:{" "}
																{formatTaskStepTitle(task.kind, activeStep)}
															</span>
														) : null}
													</div>
													<div className="overflow-x-auto pb-1">
														<div className="flex min-w-max items-start px-1 py-2">
															{task.steps.map((step, index) => (
																<div
																	key={`${task.id}-${step.key}`}
																	className="contents"
																>
																	<div className="w-44 shrink-0">
																		<div className="flex flex-col items-center text-center">
																			<div className="relative flex h-12 w-12 items-center justify-center">
																				{step.status === "active" ? (
																					<span className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
																				) : null}
																				<span
																					className={`relative flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${stepCircleClass(step.status)}`}
																				>
																					{stepCircleLabel(index, step.status)}
																				</span>
																			</div>
																			<div className="mt-3 space-y-1">
																				<p className="text-sm font-semibold leading-snug">
																					{index + 1}.{" "}
																					{formatTaskStepTitle(task.kind, step)}
																				</p>
																				<p
																					className={`text-xs font-medium ${stepStatusTextClass(step.status)}`}
																				>
																					{formatTaskStepStatus(step.status)}
																				</p>
																			</div>
																		</div>
																	</div>
																	{index < task.steps.length - 1 ? (
																		<div className="flex h-12 w-16 shrink-0 items-center px-2">
																			<div
																				className={`h-1 w-full rounded-full ${stepConnectorClass(step.status)}`}
																			/>
																		</div>
																	) : null}
																</div>
															))}
														</div>
													</div>
													{activeStep ? (
														<div className="rounded-lg border bg-background/70 px-3 py-3">
															<div className="flex flex-wrap items-center justify-between gap-2">
																<div className="text-sm font-medium">
																	{task.steps.findIndex(
																		(step) => step.key === activeStep.key,
																	) + 1}
																	. {formatTaskStepTitle(task.kind, activeStep)}
																</div>
																<span
																	className={`text-xs font-medium ${stepStatusTextClass(activeStep.status)}`}
																>
																	{formatTaskStepStatus(activeStep.status)}
																</span>
															</div>
															{activeStep.detail ? (
																<p className="mt-2 text-sm text-muted-foreground">
																	{activeStep.detail}
																</p>
															) : null}
															{activeStep.progress_total > 0 ? (
																<div className="mt-3 space-y-2">
																	<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
																		<span>
																			{t("tasks:step_progress_label")}
																		</span>
																		<span>
																			{stepProgressPercent(activeStep)}% ·{" "}
																			{t("tasks:progress_ratio", {
																				current: activeStep.progress_current,
																				total: activeStep.progress_total,
																			})}
																		</span>
																	</div>
																	<Progress
																		value={stepProgressPercent(activeStep)}
																		className="h-1.5"
																	/>
																</div>
															) : null}
														</div>
													) : null}
												</div>
											) : null}

											{task.last_error ? (
												<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
													<span className="font-medium">
														{t("tasks:error_label")}:
													</span>{" "}
													{task.last_error}
												</div>
											) : null}

											{task.status === "succeeded" && parsedResult ? (
												<div className="flex flex-col gap-3 rounded-lg border bg-muted/20 px-3 py-3 text-sm">
													<div>
														<span className="font-medium">
															{t("tasks:result_path_label")}:
														</span>{" "}
														<span className="text-muted-foreground">
															{parsedResult.target_path}
														</span>
													</div>
													<Button
														variant="outline"
														size="sm"
														onClick={() =>
															openTaskTargetFolder(
																parsedResult.target_folder_id ?? null,
															)
														}
													>
														<Icon name="FolderOpen" className="mr-1 h-4 w-4" />
														{t("tasks:open_target_folder")}
													</Button>
												</div>
											) : null}
										</div>
									</Card>
								);
							})}
						</div>
					)}

					{tasks.length > 0 ? (
						<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
							<span>
								{t("tasks:pagination_desc", {
									current: page + 1,
									total: totalPages,
									count: total,
								})}
							</span>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setPage((current) => Math.max(0, current - 1))}
									disabled={page === 0}
								>
									{t("tasks:prev_page")}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setPage((current) => Math.min(totalPages - 1, current + 1))
									}
									disabled={page >= totalPages - 1}
								>
									{t("tasks:next_page")}
								</Button>
							</div>
						</div>
					) : null}
				</div>
			</div>
		</AppLayout>
	);
}
