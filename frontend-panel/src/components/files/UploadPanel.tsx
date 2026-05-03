import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { UploadTaskItem } from "@/components/files/UploadTaskItem";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface UploadTaskView {
	id: string;
	title: string;
	status: string;
	mode: string;
	progress: number;
	group?: string;
	targetLabel?: string;
	batchStatus?: "active" | "done" | "partial_failed";
	detail?: string;
	completed?: boolean;
	actions?: {
		label: string;
		icon: "X" | "ArrowsClockwise" | "Upload";
		onClick: () => void;
		variant?: "outline" | "ghost";
	}[];
}

interface UploadPanelProps {
	open: boolean;
	onToggle: () => void;
	title: string;
	summary: string;
	tasks: UploadTaskView[];
	emptyText: string;
	totalCount?: number;
	successCount?: number;
	failedCount?: number;
	activeCount?: number;
	overallProgress?: number;
	onRetryFailed?: () => void;
	retryFailedLabel?: string;
	onClearCompleted?: () => void;
	clearCompletedLabel?: string;
}

type FlatRow =
	| {
			type: "group-header";
			key: string;
			group: string;
			batchStatus: string;
			total: number;
			success: number;
			failed: number;
			active: number;
	  }
	| { type: "task"; key: string; task: UploadTaskView };

const ROW_HEIGHT_TASK_COMPACT = 56;
const ROW_HEIGHT_TASK_PROGRESS = 74;
const ROW_HEIGHT_GROUP = 38;
const PANEL_EXPANDED_BODY_CLASS = "h-[min(28rem,calc(100vh-11rem))]";

function taskShowsProgress(task: UploadTaskView) {
	const failed = task.actions?.some(
		(action) => action.icon === "ArrowsClockwise",
	);
	const waitingForFile = task.actions?.some(
		(action) => action.icon === "Upload",
	);
	return !task.completed && !failed && !waitingForFile && task.progress < 100;
}

export function UploadPanel({
	open,
	onToggle,
	title,
	summary,
	tasks,
	emptyText,
	successCount = 0,
	failedCount = 0,
	activeCount = 0,
	overallProgress = 0,
	onRetryFailed,
	retryFailedLabel,
	onClearCompleted,
	clearCompletedLabel,
}: UploadPanelProps) {
	const { t } = useTranslation("files");
	const scrollRef = useRef<HTMLDivElement>(null);

	// ── 展平分组为虚拟列表行 ──
	const flatRows = useMemo<FlatRow[]>(() => {
		const grouped: Record<string, UploadTaskView[]> = {};
		for (const task of tasks) {
			const key = task.group ?? "";
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(task);
		}

		const rows: FlatRow[] = [];
		for (const [group, groupTasks] of Object.entries(grouped)) {
			let success = 0;
			let failed = 0;
			let active = 0;
			for (const task of groupTasks) {
				if (task.completed) success++;
				else if (task.actions?.some((a) => a.icon === "ArrowsClockwise"))
					failed++;
				else active++;
			}
			const batchStatus =
				active > 0 ? "active" : failed > 0 ? "partial_failed" : "done";

			rows.push({
				type: "group-header",
				key: `gh-${group || "root"}`,
				group,
				batchStatus,
				total: groupTasks.length,
				success,
				failed,
				active,
			});
			for (const task of groupTasks) {
				rows.push({ type: "task", key: task.id, task });
			}
		}
		return rows;
	}, [tasks]);

	const virtualizer = useVirtualizer({
		count: flatRows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: (index) => {
			const row = flatRows[index];
			if (row.type === "group-header") return ROW_HEIGHT_GROUP;
			return taskShowsProgress(row.task)
				? ROW_HEIGHT_TASK_PROGRESS
				: ROW_HEIGHT_TASK_COMPACT;
		},
		overscan: 5,
	});
	const canRetryFailed = Boolean(
		onRetryFailed && retryFailedLabel && failedCount > 0,
	);
	const canClearCompleted = Boolean(
		onClearCompleted && clearCompletedLabel && successCount > 0,
	);
	const showOverallProgress = activeCount > 0;

	return (
		<div className="absolute right-4 bottom-4 z-40 w-[28rem] max-w-[calc(100vw-2rem)]">
			<Card
				size="sm"
				className="gap-0 overflow-hidden bg-card/95 py-0 shadow-none ring-1 ring-border/60 backdrop-blur-sm transition-[border-color,box-shadow] data-[size=sm]:gap-0 data-[size=sm]:py-0 dark:bg-card/80 dark:ring-border/70"
			>
				<CardHeader className="border-b border-border/60 bg-card/80 px-4 py-3 dark:bg-card/65">
					<div className="flex items-start gap-3">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/45 text-muted-foreground dark:bg-muted/25">
							<Icon name="Upload" className="h-4 w-4" />
						</div>
						<div className="min-w-0 flex-1">
							<CardTitle>{title}</CardTitle>
							<div className="truncate text-xs text-muted-foreground">
								{summary}
							</div>
						</div>
						<Button variant="ghost" size="icon-xs" onClick={onToggle}>
							<Icon name={open ? "CaretDown" : "CaretUp"} className="h-3 w-3" />
						</Button>
					</div>
					{showOverallProgress ? (
						<div className="mt-3 flex items-center gap-2">
							<Progress value={overallProgress} className="h-1.5 flex-1" />
							<span className="w-9 text-right text-[11px] text-muted-foreground tabular-nums">
								{overallProgress}%
							</span>
						</div>
					) : null}
				</CardHeader>
				<div
					aria-hidden={!open}
					data-state={open ? "open" : "closed"}
					inert={open ? undefined : true}
					className={cn(
						"min-h-0 overflow-hidden transition-[height,opacity] duration-200 ease-out motion-reduce:transition-none",
						open ? `${PANEL_EXPANDED_BODY_CLASS} opacity-100` : "h-0 opacity-0",
					)}
				>
					<div className="flex h-full min-h-0 flex-col">
						<CardContent className="min-h-0 flex-1 overflow-hidden bg-background/70 px-0 py-0 group-data-[size=sm]/card:px-0 dark:bg-background/20">
							{tasks.length === 0 ? (
								<div className="flex h-full min-h-[10rem] items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground">
									{emptyText}
								</div>
							) : (
								<ScrollArea ref={scrollRef} className="h-full w-full">
									<div
										className="relative w-full"
										style={{
											height: virtualizer.getTotalSize(),
										}}
									>
										{virtualizer.getVirtualItems().map((virtualRow) => {
											const row = flatRows[virtualRow.index];
											return (
												<div
													key={row.key}
													className="absolute inset-x-0 w-full overflow-hidden"
													style={{
														height: virtualRow.size,
														transform: `translateY(${virtualRow.start}px)`,
													}}
												>
													{row.type === "group-header" ? (
														<GroupHeader row={row} t={t} />
													) : (
														<UploadTaskItem {...row.task} />
													)}
												</div>
											);
										})}
									</div>
								</ScrollArea>
							)}
						</CardContent>
						{canRetryFailed || canClearCompleted ? (
							<CardFooter className="shrink-0 justify-end gap-2 border-t border-border/60 bg-card/80 px-4 py-3 dark:bg-card/65">
								{canRetryFailed ? (
									<Button variant="outline" size="sm" onClick={onRetryFailed}>
										<Icon name="ArrowsClockwise" className="h-3.5 w-3.5" />
										{retryFailedLabel}
									</Button>
								) : null}
								{canClearCompleted ? (
									<Button
										variant="outline"
										size="sm"
										onClick={onClearCompleted}
									>
										<Icon name="X" className="h-3.5 w-3.5" />
										{clearCompletedLabel}
									</Button>
								) : null}
							</CardFooter>
						) : null}
					</div>
				</div>
			</Card>
		</div>
	);
}

function GroupHeader({
	row,
	t,
}: {
	row: Extract<FlatRow, { type: "group-header" }>;
	t: (key: string, opts?: Record<string, unknown>) => string;
}) {
	return (
		<div className="flex h-full w-full items-center gap-2 border-b border-border/70 bg-muted/35 px-4 py-2 text-[11px] text-muted-foreground dark:border-border/55 dark:bg-muted/20">
			<div className="min-w-0 flex-1 truncate font-medium text-foreground/75">
				{row.group || t("root")}
			</div>
			<span className="shrink-0 tabular-nums">
				{t("upload_group_item_count", { count: row.total })}
			</span>
			<span
				className={cn(
					"shrink-0 rounded-full px-1.5 py-0.5 font-medium",
					row.batchStatus === "active" &&
						"bg-primary/10 text-primary dark:bg-primary/15",
					row.batchStatus === "partial_failed" &&
						"bg-destructive/10 text-destructive dark:bg-destructive/15",
					row.batchStatus === "done" &&
						"bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
				)}
			>
				{row.batchStatus === "active"
					? t("upload_batch_active")
					: row.batchStatus === "partial_failed"
						? t("upload_batch_partial_failed")
						: t("upload_batch_done")}
			</span>
		</div>
	);
}
