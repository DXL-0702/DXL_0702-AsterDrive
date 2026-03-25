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
			targetLabel?: string;
			batchStatus: string;
			total: number;
			success: number;
			failed: number;
			active: number;
	  }
	| { type: "task"; key: string; task: UploadTaskView };

const ROW_HEIGHT_TASK = 92;
const ROW_HEIGHT_GROUP = 52;

export function UploadPanel({
	open,
	onToggle,
	title,
	summary,
	tasks,
	emptyText,
	totalCount = 0,
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
				targetLabel: groupTasks[0]?.targetLabel,
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
		estimateSize: (index) =>
			flatRows[index].type === "group-header"
				? ROW_HEIGHT_GROUP
				: ROW_HEIGHT_TASK,
		overscan: 5,
	});

	return (
		<div className="absolute right-4 bottom-4 z-40 w-[28rem] max-w-[calc(100vw-2rem)]">
			<Card
				size="sm"
				className={`flex flex-col overflow-hidden shadow-xl backdrop-blur-sm ${
					open ? "h-[min(42rem,calc(100vh-6rem))]" : ""
				}`}
			>
				<CardHeader className="border-b">
					<div className="flex items-center gap-2">
						<Icon name="Upload" className="h-4 w-4 text-muted-foreground" />
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
				</CardHeader>
				{open && (
					<>
						<div className="space-y-3 border-b px-4 py-3">
							<div className="grid grid-cols-4 gap-2 text-center text-xs">
								<div className="rounded-md bg-muted/50 px-2 py-1">
									<div className="text-[10px] text-muted-foreground">
										{t("upload_stat_total")}
									</div>
									<div className="font-medium">{totalCount}</div>
								</div>
								<div className="rounded-md bg-emerald-500/10 px-2 py-1">
									<div className="text-[10px] text-muted-foreground">
										{t("upload_stat_success")}
									</div>
									<div className="font-medium text-emerald-600">
										{successCount}
									</div>
								</div>
								<div className="rounded-md bg-rose-500/10 px-2 py-1">
									<div className="text-[10px] text-muted-foreground">
										{t("upload_stat_failed")}
									</div>
									<div className="font-medium text-rose-600">{failedCount}</div>
								</div>
								<div className="rounded-md bg-primary/10 px-2 py-1">
									<div className="text-[10px] text-muted-foreground">
										{t("upload_stat_active")}
									</div>
									<div className="font-medium text-primary">{activeCount}</div>
								</div>
							</div>
							<div className="space-y-1">
								<div className="flex items-center justify-between text-[11px] text-muted-foreground">
									<span>{t("upload_overall_progress")}</span>
									<span>{overallProgress}%</span>
								</div>
								<Progress value={overallProgress} className="h-2" />
							</div>
						</div>
						<CardContent className="min-h-0 flex-1 overflow-hidden p-0">
							{tasks.length === 0 ? (
								<div className="py-8 text-center text-sm text-muted-foreground">
									{emptyText}
								</div>
							) : (
								<ScrollArea ref={scrollRef} className="h-full">
									<div
										className="relative px-3"
										style={{
											height: virtualizer.getTotalSize(),
										}}
									>
										{virtualizer.getVirtualItems().map((virtualRow) => {
											const row = flatRows[virtualRow.index];
											return (
												<div
													key={row.key}
													className="absolute left-3 right-3"
													style={{
														height: virtualRow.size,
														transform: `translateY(${virtualRow.start}px)`,
													}}
												>
													{row.type === "group-header" ? (
														<GroupHeader row={row} t={t} />
													) : (
														<div className="pt-2">
															<UploadTaskItem {...row.task} />
														</div>
													)}
												</div>
											);
										})}
									</div>
								</ScrollArea>
							)}
						</CardContent>
						<CardFooter className="shrink-0 justify-end gap-2 border-t">
							{onRetryFailed && retryFailedLabel && failedCount > 0 && (
								<Button variant="outline" size="sm" onClick={onRetryFailed}>
									{retryFailedLabel}
								</Button>
							)}
							{onClearCompleted && clearCompletedLabel && (
								<Button variant="outline" size="sm" onClick={onClearCompleted}>
									{clearCompletedLabel}
								</Button>
							)}
						</CardFooter>
					</>
				)}
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
		<div className="space-y-1 px-1 pt-3 text-[11px] text-muted-foreground">
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0 truncate font-medium">
					{row.group || t("root")}
				</div>
				<div className="shrink-0">
					{row.batchStatus === "active"
						? t("upload_batch_active")
						: row.batchStatus === "partial_failed"
							? t("upload_batch_partial_failed")
							: t("upload_batch_done")}
				</div>
			</div>
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0 truncate">
					{t("upload_target_location")}：
					{row.targetLabel ?? t("upload_target_current")}
				</div>
				<div className="shrink-0">
					{t("upload_group_stats", {
						total: row.total,
						success: row.success,
						failed: row.failed,
						active: row.active,
					})}
				</div>
			</div>
		</div>
	);
}
