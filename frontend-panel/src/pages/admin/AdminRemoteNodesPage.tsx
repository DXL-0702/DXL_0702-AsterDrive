import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AdminOffsetPagination } from "@/components/admin/AdminOffsetPagination";
import {
	buildCreateRemoteNodePayload,
	buildUpdateRemoteNodePayload,
	emptyRemoteNodeForm,
	getRemoteNodeForm,
	hasRemoteConnectionFieldChanges,
	type RemoteNodeFormData,
} from "@/components/admin/remoteNodeDialogShared";
import { AdminTableList } from "@/components/common/AdminTableList";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { handleApiError } from "@/hooks/useApiError";
import { useApiList } from "@/hooks/useApiList";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
	ADMIN_CONTROL_HEIGHT_CLASS,
	ADMIN_ICON_BUTTON_CLASS,
	ADMIN_TABLE_ACTIONS_WIDTH_CLASS,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import {
	buildOffsetPaginationSearchParams,
	parseOffsetSearchParam,
	parsePageSizeOption,
	parsePageSizeSearchParam,
} from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { adminRemoteNodeService } from "@/services/adminService";
import type { RemoteEnrollmentCommandInfo, RemoteNodeInfo } from "@/types/api";

const REMOTE_NODE_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_REMOTE_NODE_PAGE_SIZE = 20 as const;
const REMOTE_NODE_CREATE_LAST_STEP = 2 as const;
const INTERACTIVE_TABLE_ROW_CLASS =
	"cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50";
const REMOTE_NODE_TEXT_CELL_CONTENT_CLASS =
	"flex min-w-0 items-center rounded-lg bg-muted/10 px-3 py-3 text-left transition-colors duration-200";
const REMOTE_NODE_BADGE_CELL_CONTENT_CLASS =
	"flex items-center rounded-lg bg-muted/20 px-3 py-3 text-left transition-colors duration-200";

function TestConnectionButton({
	disabled = false,
	onTest,
}: {
	disabled?: boolean;
	onTest: () => Promise<boolean>;
}) {
	const { t } = useTranslation("admin");
	const [testing, setTesting] = useState(false);
	const [result, setResult] = useState<boolean | null>(null);

	const handleTest = async () => {
		setTesting(true);
		setResult(null);
		const passed = await onTest();
		setResult(passed);
		setTesting(false);
	};

	return (
		<Button
			type="button"
			variant="outline"
			className={ADMIN_CONTROL_HEIGHT_CLASS}
			disabled={disabled || testing}
			onClick={handleTest}
		>
			{testing ? (
				<Icon name="Spinner" className="mr-1 h-4 w-4 animate-spin" />
			) : result === true ? (
				<Icon name="Check" className="mr-1 h-4 w-4 text-green-600" />
			) : (
				<Icon name="WifiHigh" className="mr-1 h-4 w-4" />
			)}
			{t("test_connection")}
		</Button>
	);
}

function getRemoteNodeStatusTone(node: RemoteNodeInfo) {
	if (!node.is_enabled) {
		return "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300";
	}

	if (!node.last_checked_at) {
		return "border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-300";
	}

	if (node.last_error) {
		return "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-300";
	}

	return "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
}

function getRemoteNodeStatusLabel(
	t: ReturnType<typeof useTranslation>["t"],
	node: RemoteNodeInfo,
) {
	if (!node.is_enabled) {
		return t("remote_node_status_disabled");
	}

	if (!node.last_checked_at) {
		return t("remote_node_status_pending");
	}

	if (node.last_error) {
		return t("remote_node_status_degraded");
	}

	return t("remote_node_status_enabled");
}

function formatLastChecked(
	t: ReturnType<typeof useTranslation>["t"],
	lastCheckedAt: string | null | undefined,
) {
	return lastCheckedAt || t("remote_node_never_checked");
}

function RemoteNodeDialog({
	open,
	mode,
	form,
	editingNode,
	submitting,
	createStep,
	createStepTouched,
	onFieldChange,
	onOpenChange,
	onRunConnectionTest,
	onSubmit,
	onCreateBack,
	onCreateNext,
	onCreateStepChange,
}: {
	open: boolean;
	mode: "create" | "edit";
	form: RemoteNodeFormData;
	editingNode: RemoteNodeInfo | null;
	submitting: boolean;
	createStep: number;
	createStepTouched: boolean;
	onFieldChange: <K extends keyof RemoteNodeFormData>(
		key: K,
		value: RemoteNodeFormData[K],
	) => void;
	onOpenChange: (open: boolean) => void;
	onRunConnectionTest: () => Promise<boolean>;
	onSubmit: () => void;
	onCreateBack: () => void;
	onCreateNext: () => void;
	onCreateStepChange: (step: number) => void;
}) {
	const { t } = useTranslation("admin");
	const isCreateMode = mode === "create";
	const createSteps = [
		{
			title: t("remote_node_wizard_step_identity_title"),
			description: t("remote_node_wizard_step_identity_desc"),
		},
		{
			title: t("remote_node_wizard_step_connection_title"),
			description: t("remote_node_wizard_step_connection_desc"),
		},
		{
			title: t("remote_node_wizard_step_review_title"),
			description: t("remote_node_wizard_step_review_desc"),
		},
	];
	const createLastStep = createSteps.length - 1;
	const currentCreateStep = createSteps[Math.min(createStep, createLastStep)];
	const previousCreateStepRef = useRef(createStep);
	const stepAnimationRef = useRef<{
		direction: "idle" | "forward" | "backward";
		step: number;
	}>({
		direction: "idle",
		step: createStep,
	});
	if (createStep !== previousCreateStepRef.current) {
		stepAnimationRef.current = {
			direction:
				createStep > previousCreateStepRef.current ? "forward" : "backward",
			step: createStep,
		};
	}
	const createStepDirection = stepAnimationRef.current.direction;
	const modeToneClass = form.base_url.trim()
		? "border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-300"
		: "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-300";
	const enabledToneClass = form.is_enabled
		? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
		: "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300";
	const remoteNodeModeLabel = form.base_url.trim()
		? t("remote_node_endpoint_configured")
		: t("remote_node_endpoint_pending");
	const hasConnectionFieldChanges = hasRemoteConnectionFieldChanges(
		form,
		editingNode,
	);
	const canRunConnectionTest =
		editingNode !== null &&
		!hasConnectionFieldChanges &&
		Boolean(form.base_url.trim());
	const isSubmitDisabled =
		submitting || !form.name.trim() || !form.namespace.trim();
	const createNameError =
		isCreateMode && createStep === 0 && createStepTouched && !form.name.trim()
			? t("remote_node_wizard_name_required")
			: null;
	const createNamespaceError =
		isCreateMode &&
		createStep === 0 &&
		createStepTouched &&
		!form.namespace.trim()
			? t("remote_node_wizard_namespace_required")
			: null;
	const createSummaryItems = [
		{
			label: t("namespace"),
			value: form.namespace || "—",
		},
		{
			label: t("base_url"),
			value: form.base_url || t("remote_node_base_url_empty"),
		},
		{
			label: t("remote_node_wizard_followup_label"),
			value: t("remote_node_wizard_followup_value"),
		},
		{
			label: t("remote_node_status"),
			value: form.is_enabled
				? t("remote_node_status_enabled")
				: t("remote_node_status_disabled"),
		},
	];

	const renderSectionIntro = (title: string, description: string) => (
		<div className="mb-5">
			<h3 className="text-base font-semibold text-foreground">{title}</h3>
			<p className="mt-1 text-sm text-muted-foreground">{description}</p>
		</div>
	);

	const renderCreateSummaryCard = (description: string) => (
		<section className="rounded-3xl border border-border/70 bg-muted/20 p-5">
			<div className="flex items-center gap-3">
				<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
					<Icon
						name="Globe"
						className="h-8 w-8 text-amber-600 dark:text-amber-300"
					/>
				</div>
				<div className="min-w-0">
					<p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
						{t("remote_node_summary_title")}
					</p>
					<h3 className="mt-1 truncate text-base font-semibold">
						{form.name || t("new_remote_node")}
					</h3>
				</div>
			</div>
			<p className="mt-4 text-sm leading-6 text-muted-foreground">
				{description}
			</p>
			<div className="mt-4 flex flex-wrap gap-2">
				<Badge variant="outline" className={modeToneClass}>
					{remoteNodeModeLabel}
				</Badge>
				<Badge variant="outline" className={enabledToneClass}>
					{form.is_enabled
						? t("remote_node_status_enabled")
						: t("remote_node_status_disabled")}
				</Badge>
			</div>
			<dl className="mt-4 space-y-3 text-sm">
				{createSummaryItems.map((item) => (
					<div key={item.label}>
						<dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
							{item.label}
						</dt>
						<dd className="mt-1 break-all font-medium">{item.value}</dd>
					</div>
				))}
			</dl>
		</section>
	);

	const renderCreateFlowDiagram = () => (
		<section className="rounded-2xl border border-border/70 bg-background/70 p-5">
			{renderSectionIntro(
				t("remote_node_wizard_flow_title"),
				t("remote_node_wizard_flow_desc"),
			)}
			<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)_96px_minmax(0,1fr)] md:items-center">
				<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
					<p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
						{t("remote_node_wizard_flow_current_node")}
					</p>
					<p className="mt-2 font-semibold text-foreground">
						{form.name || t("new_remote_node")}
					</p>
					<p className="mt-2 text-xs leading-5 text-muted-foreground">
						{t("remote_node_wizard_followup_value")}
					</p>
				</div>
				<div className="flex justify-center">
					<Badge
						variant="outline"
						className="rounded-full border-foreground/15 px-3 py-1 text-[11px] font-medium"
					>
						{t("remote_node_enrollment_step_arrow_issue")}
					</Badge>
				</div>
				<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
					<p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
						2
					</p>
					<p className="mt-2 font-semibold text-foreground">
						{t("remote_node_enrollment_step_run_title")}
					</p>
					<p className="mt-2 text-xs leading-5 text-muted-foreground">
						{t("remote_node_enrollment_step_run_desc")}
					</p>
				</div>
				<div className="flex justify-center">
					<Badge
						variant="outline"
						className="rounded-full border-foreground/15 px-3 py-1 text-[11px] font-medium"
					>
						{t("remote_node_enrollment_step_arrow_run")}
					</Badge>
				</div>
				<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
					<p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
						3
					</p>
					<p className="mt-2 font-semibold text-foreground">
						{t("remote_node_enrollment_step_restart_title")}
					</p>
					<p className="mt-2 text-xs leading-5 text-muted-foreground">
						{t("remote_node_enrollment_step_restart_desc")}
					</p>
				</div>
			</div>
		</section>
	);

	useEffect(() => {
		if (!open || !isCreateMode) {
			previousCreateStepRef.current = 0;
			stepAnimationRef.current = {
				direction: "idle",
				step: 0,
			};
			return;
		}

		previousCreateStepRef.current = createStep;
	}, [createStep, isCreateMode, open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[min(90vh,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100%-2rem)] lg:max-w-4xl">
				<DialogHeader className="shrink-0 px-6 pt-5 pb-0 pr-14">
					<DialogTitle>
						{isCreateMode ? t("create_remote_node") : t("edit_remote_node")}
					</DialogTitle>
					<DialogDescription>{t("remote_nodes_intro")}</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(event) => event.preventDefault()}
					autoComplete="off"
					className="flex min-h-0 flex-1 flex-col overflow-hidden"
				>
					<div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-5">
						{isCreateMode ? (
							<div className="space-y-6">
								<div className="space-y-3">
									<div className="rounded-2xl border border-border/70 bg-muted/20 p-3 sm:p-4">
										<div className="flex items-start justify-between gap-3">
											<div className="space-y-1">
												<p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
													{t("policy_wizard_progress", {
														current: createStep + 1,
														total: createSteps.length,
													})}
												</p>
												<h3 className="text-sm font-semibold sm:text-base">
													{currentCreateStep.title}
												</h3>
												<p className="hidden text-sm text-muted-foreground sm:block">
													{currentCreateStep.description}
												</p>
											</div>
											<div className="hidden text-3xl leading-none font-semibold text-foreground/15 md:block">
												{String(createStep + 1).padStart(2, "0")}
											</div>
										</div>
										<div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background/80">
											<div
												className="h-full rounded-full bg-primary transition-[width] duration-300"
												style={{
													width: `${((createStep + 1) / createSteps.length) * 100}%`,
												}}
											/>
										</div>
										<div className="mt-4 grid gap-2 md:grid-cols-3">
											{createSteps.map((step, index) => (
												<button
													type="button"
													key={step.title}
													disabled={index > createStep}
													onClick={() => onCreateStepChange(index)}
													className={cn(
														"flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
														index === createStep
															? "border-primary bg-primary/5"
															: index < createStep
																? "border-border/80 bg-background hover:border-primary/40"
																: "border-border/60 bg-background/70 text-muted-foreground",
													)}
												>
													<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
														{index + 1}
													</span>
													<span className="text-sm font-medium leading-5">
														{step.title}
													</span>
												</button>
											))}
										</div>
									</div>

									<div className="rounded-2xl border border-border/70 bg-background/70 p-5">
										<div className="relative overflow-hidden">
											<div
												key={`${stepAnimationRef.current.step}-${stepAnimationRef.current.direction}`}
												data-testid="remote-node-step-panel"
												className={cn(
													createStepDirection === "idle"
														? undefined
														: "animate-in fade-in duration-[360ms] motion-reduce:animate-none",
													createStepDirection === "forward"
														? "slide-in-from-right-6"
														: createStepDirection === "backward"
															? "slide-in-from-left-6"
															: undefined,
												)}
											>
												{createStep === 0 ? (
													<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
														<div className="min-w-0 space-y-4">
															<section className="rounded-2xl border border-border/70 bg-background/70 p-5">
																{renderSectionIntro(
																	t("remote_node_overview_title"),
																	t("remote_node_wizard_step_identity_desc"),
																)}
																<div className="grid gap-4 md:grid-cols-2">
																	<div className="space-y-2">
																		<Label htmlFor="remote-node-name">
																			{t("core:name")}
																		</Label>
																		<Input
																			id="remote-node-name"
																			value={form.name}
																			onChange={(event) =>
																				onFieldChange(
																					"name",
																					event.target.value,
																				)
																			}
																			className={ADMIN_CONTROL_HEIGHT_CLASS}
																			aria-invalid={
																				createNameError ? true : undefined
																			}
																			required
																		/>
																		{createNameError ? (
																			<p className="text-xs text-destructive">
																				{createNameError}
																			</p>
																		) : null}
																	</div>
																	<div className="space-y-2">
																		<Label htmlFor="remote-node-namespace">
																			{t("namespace")}
																		</Label>
																		<Input
																			id="remote-node-namespace"
																			value={form.namespace}
																			onChange={(event) =>
																				onFieldChange(
																					"namespace",
																					event.target.value,
																				)
																			}
																			className={ADMIN_CONTROL_HEIGHT_CLASS}
																			aria-invalid={
																				createNamespaceError ? true : undefined
																			}
																			placeholder="tenant-a"
																			required
																		/>
																		{createNamespaceError ? (
																			<p className="text-xs text-destructive">
																				{createNamespaceError}
																			</p>
																		) : null}
																	</div>
																</div>
															</section>
														</div>
														<div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
															<section className="rounded-3xl border border-border/70 bg-muted/20 p-5">
																<h3 className="text-sm font-semibold">
																	{t(
																		"remote_node_wizard_identity_helper_title",
																	)}
																</h3>
																<p className="mt-1 text-sm leading-6 text-muted-foreground">
																	{t("remote_node_wizard_identity_helper_desc")}
																</p>
															</section>
															{renderCreateSummaryCard(
																currentCreateStep.description,
															)}
														</div>
													</div>
												) : createStep === 1 ? (
													<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
														<div className="min-w-0 space-y-4">
															<section className="rounded-2xl border border-border/70 bg-background/70 p-5">
																{renderSectionIntro(
																	t(
																		"remote_node_wizard_connection_block_title",
																	),
																	t("remote_node_wizard_step_connection_desc"),
																)}
																<div className="space-y-4">
																	<div className="space-y-2">
																		<Label htmlFor="remote-node-base-url">
																			{t("base_url")}
																		</Label>
																		<Input
																			id="remote-node-base-url"
																			value={form.base_url}
																			onChange={(event) =>
																				onFieldChange(
																					"base_url",
																					event.target.value,
																				)
																			}
																			className={ADMIN_CONTROL_HEIGHT_CLASS}
																			placeholder="https://remote.example.com"
																		/>
																		<p className="text-xs text-muted-foreground">
																			{t("remote_node_base_url_hint")}
																		</p>
																	</div>
																	<div className="space-y-2 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4">
																		<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
																			{t(
																				"remote_node_wizard_auto_credentials_title",
																			)}
																		</p>
										<p className="mt-2 text-sm leading-6 text-muted-foreground">
											{t(
												"remote_node_wizard_auto_credentials_desc",
											)}
										</p>
									</div>
									<div className="space-y-2">
																		<div className="flex items-center gap-2">
																			<Switch
																				id="remote-node-enabled"
																				checked={form.is_enabled}
																				onCheckedChange={(value) =>
																					onFieldChange("is_enabled", value)
																				}
																			/>
																			<Label htmlFor="remote-node-enabled">
																				{t("remote_node_enabled")}
																			</Label>
																		</div>
																		<p className="text-xs text-muted-foreground">
																			{t("remote_node_enabled_desc")}
																		</p>
																	</div>
																</div>
															</section>
														</div>
														<div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
															<section className="rounded-3xl border border-border/70 bg-muted/20 p-5">
																<div className="flex items-center justify-between gap-3">
																	<h3 className="text-sm font-semibold">
																		{t(
																			"remote_node_wizard_connection_helper_title",
																		)}
																	</h3>
																	<Badge
																		variant="outline"
																		className={modeToneClass}
																	>
																		{remoteNodeModeLabel}
																	</Badge>
																</div>
																<p className="mt-2 text-sm leading-6 text-muted-foreground">
																	{t(
																		"remote_node_wizard_connection_helper_desc",
																	)}
																</p>
																<p className="mt-3 text-xs leading-5 text-muted-foreground">
																	{t(
																		"remote_node_wizard_connection_helper_hint",
																	)}
																</p>
															</section>
															{renderCreateSummaryCard(
																currentCreateStep.description,
															)}
														</div>
													</div>
												) : (
													<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
														<div className="min-w-0 space-y-4">
															<section className="rounded-2xl border border-border/70 bg-background/70 p-5">
																{renderSectionIntro(
																	t("remote_node_wizard_step_review_title"),
																	t("remote_node_wizard_step_review_desc"),
																)}
																<div className="grid gap-4 md:grid-cols-2">
																	{createSummaryItems.map((item) => (
																		<div
																			key={item.label}
																			className="rounded-2xl border border-border/70 bg-muted/20 p-4"
																		>
																			<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
																				{item.label}
																			</p>
																			<p className="mt-2 break-all text-sm font-medium text-foreground">
																				{item.value}
																			</p>
																		</div>
																	))}
																</div>
															</section>
															{renderCreateFlowDiagram()}
														</div>
														<div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
															{renderCreateSummaryCard(
																currentCreateStep.description,
															)}
															<section className="rounded-3xl border border-border/70 bg-background/85 p-5">
																<h3 className="text-sm font-semibold">
																	{t("remote_node_enrollment_command_title")}
																</h3>
																<p className="mt-1 text-xs leading-5 text-muted-foreground">
																	{t("remote_node_wizard_review_helper_desc")}
																</p>
															</section>
														</div>
													</div>
												)}
											</div>
										</div>
									</div>
								</div>
							</div>
						) : (
							<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
								<div className="min-w-0 space-y-4">
									<section className="rounded-2xl border border-border/70 bg-background/70 p-5">
										{renderSectionIntro(
											t("remote_node_overview_title"),
											t("remote_node_overview_desc"),
										)}
										<div className="grid gap-4 md:grid-cols-2">
											<div className="space-y-2">
												<Label htmlFor="remote-node-name">
													{t("core:name")}
												</Label>
												<Input
													id="remote-node-name"
													value={form.name}
													onChange={(event) =>
														onFieldChange("name", event.target.value)
													}
													className={ADMIN_CONTROL_HEIGHT_CLASS}
													required
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="remote-node-namespace">
													{t("namespace")}
												</Label>
												<Input
													id="remote-node-namespace"
													value={form.namespace}
													onChange={(event) =>
														onFieldChange("namespace", event.target.value)
													}
													className={ADMIN_CONTROL_HEIGHT_CLASS}
													placeholder="tenant-a"
													required
												/>
											</div>
											<div className="space-y-2 md:col-span-2">
												<Label htmlFor="remote-node-base-url">
													{t("base_url")}
												</Label>
												<Input
													id="remote-node-base-url"
													value={form.base_url}
													onChange={(event) =>
														onFieldChange("base_url", event.target.value)
													}
													className={ADMIN_CONTROL_HEIGHT_CLASS}
													placeholder="https://remote.example.com"
												/>
												<p className="text-xs text-muted-foreground">
													{t("remote_node_base_url_hint")}
												</p>
											</div>
										</div>
									</section>

									<section className="rounded-2xl border border-border/70 bg-background/70 p-5">
										{renderSectionIntro(
											t("remote_node_credentials_title"),
											t("remote_node_credentials_desc"),
										)}
										<div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4">
											<p className="text-sm leading-6 text-muted-foreground">
												{t("remote_node_wizard_auto_credentials_desc")}
											</p>
										</div>
									</section>

									<section className="rounded-2xl border border-border/70 bg-background/70 p-5">
										{renderSectionIntro(
											t("remote_node_status_settings_title"),
											t("remote_node_status_settings_desc"),
										)}
										<div className="space-y-4">
											<div className="space-y-2">
												<div className="flex items-center gap-2">
													<Switch
														id="remote-node-enabled"
														checked={form.is_enabled}
														onCheckedChange={(value) =>
															onFieldChange("is_enabled", value)
														}
													/>
													<Label htmlFor="remote-node-enabled">
														{t("remote_node_enabled")}
													</Label>
												</div>
												<p className="text-xs text-muted-foreground">
													{t("remote_node_enabled_desc")}
												</p>
											</div>
										</div>
									</section>
								</div>

								<div className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">
									{renderCreateSummaryCard(t("policy_editor_summary_desc"))}

									{editingNode ? (
										<section className="rounded-3xl border border-border/70 bg-background/85 p-5">
											<h3 className="text-sm font-semibold">
												{t("remote_node_diagnostics_title")}
											</h3>
											<p className="mt-1 text-xs text-muted-foreground">
												{t("remote_node_diagnostics_desc")}
											</p>
											<dl className="mt-4 space-y-3 text-sm">
												<div>
													<dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
														{t("remote_node_last_checked")}
													</dt>
													<dd className="mt-1 break-all font-medium">
														{formatLastChecked(t, editingNode.last_checked_at)}
													</dd>
												</div>
												<div>
													<dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
														{t("remote_node_last_error")}
													</dt>
													<dd className="mt-1 break-all font-medium">
														{editingNode.last_error ||
															t("remote_node_last_error_empty")}
													</dd>
												</div>
												<div>
													<dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
														{t("remote_node_capabilities")}
													</dt>
													<dd className="mt-1 space-y-1 text-xs text-muted-foreground">
														<div>
															{t("remote_node_protocol_version")}:{" "}
															{editingNode.capabilities.protocol_version}
														</div>
														<div>
															{t("remote_node_supports_list")}:{" "}
															{String(editingNode.capabilities.supports_list)}
														</div>
														<div>
															{t("remote_node_supports_range_read")}:{" "}
															{String(
																editingNode.capabilities.supports_range_read,
															)}
														</div>
														<div>
															{t("remote_node_supports_stream_upload")}:{" "}
															{String(
																editingNode.capabilities.supports_stream_upload,
															)}
														</div>
													</dd>
												</div>
											</dl>
										</section>
									) : null}
								</div>
							</div>
						)}
					</div>
					<DialogFooter className="mx-0 mb-0 w-full shrink-0 flex-row items-center gap-2 rounded-b-xl px-6 py-3">
						<div className="mr-auto flex shrink-0 gap-2">
							{isCreateMode && createStep > 0 ? (
								<Button
									type="button"
									variant="outline"
									className={ADMIN_CONTROL_HEIGHT_CLASS}
									onClick={onCreateBack}
									disabled={submitting}
								>
									{t("core:back")}
								</Button>
							) : null}
						</div>

						<div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-2">
							{isCreateMode ? (
								createStep === createLastStep ? (
									<Button
										type="button"
										className={ADMIN_CONTROL_HEIGHT_CLASS}
										disabled={isSubmitDisabled}
										onClick={onSubmit}
									>
										{t("remote_node_save_and_generate_enrollment_command")}
									</Button>
								) : (
									<>
										<Button
											type="button"
											className={ADMIN_CONTROL_HEIGHT_CLASS}
											onClick={onCreateNext}
											disabled={submitting}
										>
											{createStep === createLastStep - 1
												? t("policy_wizard_review")
												: t("policy_wizard_next")}
										</Button>
									</>
								)
							) : (
								<>
									<TestConnectionButton
										onTest={onRunConnectionTest}
										disabled={!canRunConnectionTest || submitting}
									/>
									<Button
										type="button"
										className={ADMIN_CONTROL_HEIGHT_CLASS}
										disabled={isSubmitDisabled}
										onClick={onSubmit}
									>
										{t("save_changes")}
									</Button>
								</>
							)}
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function RemoteNodeEnrollmentDialog({
	open,
	command,
	canTestConnection,
	onCopy,
	onVerifyConnection,
	onOpenChange,
}: {
	open: boolean;
	command: RemoteEnrollmentCommandInfo | null;
	canTestConnection: boolean;
	onCopy: (value: string) => Promise<void>;
	onVerifyConnection: (remoteNodeId: number) => Promise<boolean>;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation("admin");

	if (!command) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[min(90vh,calc(100vh-2rem))] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{t("remote_node_enrollment_dialog_title")}</DialogTitle>
					<DialogDescription>
						{t("remote_node_enrollment_dialog_desc")}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5">
					<section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
						<div className="flex items-start gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-background/80 ring-1 ring-blue-500/10">
								<Icon
									name="ClipboardText"
									className="h-5 w-5 text-blue-600 dark:text-blue-300"
								/>
							</div>
							<div className="min-w-0">
								<h3 className="text-sm font-semibold text-foreground">
									{t("remote_node_enrollment_saved_title")}
								</h3>
								<p className="mt-1 text-sm leading-6 text-muted-foreground">
									{t("remote_node_enrollment_saved_desc")}
								</p>
							</div>
						</div>
					</section>

					<div className="grid gap-3 md:grid-cols-3">
						<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
							<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
								{t("core:name")}
							</p>
							<p className="mt-2 break-all text-sm font-medium text-foreground">
								{command.remote_node_name}
							</p>
						</div>
						<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
							<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
								{t("remote_node_enrollment_master_url")}
							</p>
							<p className="mt-2 break-all text-sm font-medium text-foreground">
								{command.master_url}
							</p>
						</div>
						<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
							<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
								{t("remote_node_enrollment_expires_at")}
							</p>
							<p className="mt-2 text-sm font-medium text-foreground">
								{formatDateTime(command.expires_at)}
							</p>
						</div>
					</div>

					<section className="rounded-2xl border border-border/70 bg-background/70 p-5">
						<div className="mb-4">
							<h3 className="text-base font-semibold text-foreground">
								{t("remote_node_enrollment_flow_title")}
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								{t("remote_node_enrollment_flow_desc")}
							</p>
						</div>
						<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)_96px_minmax(0,1fr)] md:items-center">
							<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
								<p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
									1
								</p>
								<p className="mt-2 font-semibold text-foreground">
									{t("remote_node_enrollment_step_issue_title")}
								</p>
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									{t("remote_node_enrollment_step_issue_desc")}
								</p>
							</div>
							<div className="flex justify-center">
								<Badge
									variant="outline"
									className="rounded-full border-foreground/15 px-3 py-1 text-[11px] font-medium"
								>
									{t("remote_node_enrollment_step_arrow_issue")}
								</Badge>
							</div>
							<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
								<p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
									2
								</p>
								<p className="mt-2 font-semibold text-foreground">
									{t("remote_node_enrollment_step_run_title")}
								</p>
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									{t("remote_node_enrollment_step_run_desc")}
								</p>
							</div>
							<div className="flex justify-center">
								<Badge
									variant="outline"
									className="rounded-full border-foreground/15 px-3 py-1 text-[11px] font-medium"
								>
									{t("remote_node_enrollment_step_arrow_run")}
								</Badge>
							</div>
							<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
								<p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
									3
								</p>
								<p className="mt-2 font-semibold text-foreground">
									{t("remote_node_enrollment_step_restart_title")}
								</p>
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									{t("remote_node_enrollment_step_restart_desc")}
								</p>
							</div>
						</div>
					</section>

					<section className="rounded-2xl border border-border/70 bg-background/70 p-5">
						<div className="flex items-start justify-between gap-3">
							<div>
								<h3 className="text-base font-semibold text-foreground">
									{t("remote_node_enrollment_command_title")}
								</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									{t("remote_node_enrollment_command_desc")}
								</p>
							</div>
							<Button
								type="button"
								variant="outline"
								className={ADMIN_CONTROL_HEIGHT_CLASS}
								onClick={() => void onCopy(command.command)}
							>
								<Icon name="Copy" className="mr-1 h-4 w-4" />
								{t("remote_node_enrollment_copy_command")}
							</Button>
						</div>
						<pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-muted/20 p-4 font-mono text-xs leading-6 text-foreground">
							{command.command}
						</pre>
						<p className="mt-3 text-xs leading-5 text-muted-foreground">
							{t("remote_node_enrollment_command_hint")}
						</p>
					</section>

					<section className="rounded-2xl border border-border/70 bg-background/70 p-5">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="min-w-0">
								<h3 className="text-base font-semibold text-foreground">
									{t("remote_node_enrollment_verify_title")}
								</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									{t("remote_node_enrollment_verify_desc")}
								</p>
							</div>
							<TestConnectionButton
								onTest={() => onVerifyConnection(command.remote_node_id)}
								disabled={!canTestConnection}
							/>
						</div>
						<p className="mt-3 text-xs leading-5 text-muted-foreground">
							{canTestConnection
								? t("remote_node_enrollment_verify_hint")
								: t("remote_node_enrollment_verify_disabled_hint")}
						</p>
					</section>
				</div>
				<DialogFooter className="px-0 pb-0">
					<Button
						type="button"
						variant="outline"
						className={ADMIN_CONTROL_HEIGHT_CLASS}
						onClick={() => onOpenChange(false)}
					>
						{t("core:close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default function AdminRemoteNodesPage() {
	const { t } = useTranslation("admin");
	usePageTitle(t("remote_nodes"));
	const [searchParams, setSearchParams] = useSearchParams();
	const [offset, setOffset] = useState(
		parseOffsetSearchParam(searchParams.get("offset")),
	);
	const [pageSize, setPageSize] = useState<
		(typeof REMOTE_NODE_PAGE_SIZE_OPTIONS)[number]
	>(
		parsePageSizeSearchParam(
			searchParams.get("pageSize"),
			REMOTE_NODE_PAGE_SIZE_OPTIONS,
			DEFAULT_REMOTE_NODE_PAGE_SIZE,
		),
	);
	const {
		items: remoteNodes,
		setItems: setRemoteNodes,
		total,
		setTotal,
		loading,
		reload,
	} = useApiList(
		() => adminRemoteNodeService.list({ limit: pageSize, offset }),
		[offset, pageSize],
	);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editingNode, setEditingNode] = useState<RemoteNodeInfo | null>(null);
	const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
	const [enrollmentCommand, setEnrollmentCommand] =
		useState<RemoteEnrollmentCommandInfo | null>(null);
	const [enrollmentCommandCanTest, setEnrollmentCommandCanTest] =
		useState(false);
	const [generatingEnrollmentId, setGeneratingEnrollmentId] = useState<
		number | null
	>(null);
	const [form, setForm] = useState<RemoteNodeFormData>(emptyRemoteNodeForm);
	const [submitting, setSubmitting] = useState(false);
	const [createStep, setCreateStep] = useState(0);
	const [createStepTouched, setCreateStepTouched] = useState(false);
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const currentPage = Math.floor(offset / pageSize) + 1;
	const prevPageDisabled = offset === 0;
	const nextPageDisabled = offset + pageSize >= total;
	const pageSizeOptions = REMOTE_NODE_PAGE_SIZE_OPTIONS.map((size) => ({
		label: t("page_size_option", { count: size }),
		value: String(size),
	}));

	useEffect(() => {
		setSearchParams(
			buildOffsetPaginationSearchParams({
				offset,
				pageSize,
				defaultPageSize: DEFAULT_REMOTE_NODE_PAGE_SIZE,
			}),
			{ replace: true },
		);
	}, [offset, pageSize, setSearchParams]);

	const handlePageSizeChange = (value: string | null) => {
		const next = parsePageSizeOption(value, REMOTE_NODE_PAGE_SIZE_OPTIONS);
		if (next == null) return;
		setPageSize(next);
		setOffset(0);
	};

	const resetDialogState = () => {
		setCreateStep(0);
		setCreateStepTouched(false);
	};

	const openCreate = () => {
		setEditingId(null);
		setEditingNode(null);
		setForm({ ...emptyRemoteNodeForm });
		setEnrollmentCommandCanTest(false);
		resetDialogState();
		setDialogOpen(true);
	};

	const openEdit = (node: RemoteNodeInfo) => {
		setEditingId(node.id);
		setEditingNode(node);
		setForm(getRemoteNodeForm(node));
		resetDialogState();
		setDialogOpen(true);
	};

	const handleDialogOpenChange = (open: boolean) => {
		setDialogOpen(open);
		if (!open) {
			resetDialogState();
		}
	};

	const setField = <K extends keyof RemoteNodeFormData>(
		key: K,
		value: RemoteNodeFormData[K],
	) => setForm((prev) => ({ ...prev, [key]: value }));

	const copyToClipboard = async (value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(t("core:copied_to_clipboard"));
		} catch {
			toast.error(t("errors:unexpected_error"));
		}
	};

	const runConnectionTest = async ({
		showFailureError = true,
		showSuccessToast = true,
	}: {
		showFailureError?: boolean;
		showSuccessToast?: boolean;
	} = {}) => {
		if (editingId === null) {
			return false;
		}

		try {
			const updated = await adminRemoteNodeService.testConnection(editingId);
			setEditingNode(updated);
			setRemoteNodes((prev) =>
				prev.map((node) => (node.id === editingId ? updated : node)),
			);

			if (showSuccessToast) {
				toast.success(t("connection_success"));
			}
			return true;
		} catch (error) {
			if (showFailureError) {
				handleApiError(error);
			}
			return false;
		}
	};

	const persistRemoteNode = async () => {
		try {
			if (editingId !== null) {
				const updated = await adminRemoteNodeService.update(
					editingId,
					buildUpdateRemoteNodePayload(form),
				);
				setEditingNode(updated);
				setRemoteNodes((prev) =>
					prev.map((node) => (node.id === editingId ? updated : node)),
				);
				toast.success(t("remote_node_updated"));
				handleDialogOpenChange(false);
			} else {
				const created = await adminRemoteNodeService.create(
					buildCreateRemoteNodePayload(form),
				);
				const nextTotal = total + 1;
				const nextLastOffset = Math.max(
					0,
					Math.floor((nextTotal - 1) / pageSize) * pageSize,
				);
				if (nextLastOffset !== offset) {
					setOffset(nextLastOffset);
				} else {
					await reload();
				}
				handleDialogOpenChange(false);
				const command = await adminRemoteNodeService.createEnrollmentCommand(
					created.id,
				);
				setEnrollmentCommand(command);
				setEnrollmentCommandCanTest(Boolean(created.base_url.trim()));
				setEnrollmentDialogOpen(true);
				toast.success(t("remote_node_enrollment_prepared"));
			}
		} catch (error) {
			handleApiError(error);
		}
	};

	const submitRemoteNode = async () => {
		if (submitting) {
			return;
		}

		setSubmitting(true);
		try {
			await persistRemoteNode();
		} finally {
			setSubmitting(false);
		}
	};

	const handleCreateBack = () => {
		setCreateStepTouched(false);
		setCreateStep((prev) => Math.max(0, prev - 1));
	};

	const handleCreateStepChange = (step: number) => {
		setCreateStepTouched(false);
		setCreateStep(Math.max(0, Math.min(REMOTE_NODE_CREATE_LAST_STEP, step)));
	};

	const handleCreateNext = () => {
		if (createStep >= REMOTE_NODE_CREATE_LAST_STEP) {
			return;
		}

		setCreateStepTouched(true);

		if (createStep === 0) {
			if (!form.name.trim() || !form.namespace.trim()) {
				return;
			}
		}

		setCreateStepTouched(false);
		setCreateStep((prev) => Math.min(REMOTE_NODE_CREATE_LAST_STEP, prev + 1));
	};

	const handleSubmit = () => {
		if (editingId === null && createStep < REMOTE_NODE_CREATE_LAST_STEP) {
			handleCreateNext();
			return;
		}

		void submitRemoteNode();
	};

	const handleDelete = async (id: number) => {
		try {
			await adminRemoteNodeService.delete(id);
			if (remoteNodes.length === 1 && offset > 0) {
				setOffset(Math.max(0, offset - pageSize));
			} else {
				await reload();
			}
			toast.success(t("remote_node_deleted"));
		} catch (error) {
			handleApiError(error);
		}
	};

	const {
		confirmId: deleteId,
		requestConfirm,
		dialogProps: deleteDialogProps,
	} = useConfirmDialog(handleDelete);
	const deleteNodeName =
		deleteId !== null
			? (remoteNodes.find((node) => node.id === deleteId)?.name ?? "")
			: "";

	const handleRefresh = async () => {
		try {
			const nodesPage = await adminRemoteNodeService.list({
				limit: pageSize,
				offset,
			});
			setRemoteNodes(nodesPage.items);
			setTotal(nodesPage.total);
		} catch (error) {
			handleApiError(error);
		}
	};

	const handleEnrollmentDialogOpenChange = (open: boolean) => {
		setEnrollmentDialogOpen(open);
		if (!open) {
			setEnrollmentCommand(null);
			setEnrollmentCommandCanTest(false);
		}
	};

	const handleVerifyEnrollmentConnection = async (remoteNodeId: number) => {
		try {
			const updated = await adminRemoteNodeService.testConnection(remoteNodeId);
			setRemoteNodes((prev) =>
				prev.map((node) => (node.id === remoteNodeId ? updated : node)),
			);
			if (editingId === remoteNodeId) {
				setEditingNode(updated);
			}
			toast.success(t("connection_success"));
			return true;
		} catch (error) {
			handleApiError(error);
			return false;
		}
	};

	const handleGenerateEnrollmentCommand = async (node: RemoteNodeInfo) => {
		setGeneratingEnrollmentId(node.id);
		try {
			const command = await adminRemoteNodeService.createEnrollmentCommand(
				node.id,
			);
			setEnrollmentCommand(command);
			setEnrollmentCommandCanTest(Boolean(node.base_url.trim()));
			setEnrollmentDialogOpen(true);
		} catch (error) {
			handleApiError(error);
		} finally {
			setGeneratingEnrollmentId((current) =>
				current === node.id ? null : current,
			);
		}
	};

	return (
		<AdminLayout>
			<AdminPageShell>
				<AdminPageHeader
					title={t("remote_nodes")}
					description={t("remote_nodes_intro")}
					actions={
						<>
							<Button
								size="sm"
								className={ADMIN_CONTROL_HEIGHT_CLASS}
								onClick={openCreate}
							>
								<Icon name="Plus" className="mr-1 h-4 w-4" />
								{t("new_remote_node")}
							</Button>
							<Button
								variant="outline"
								size="sm"
								className={ADMIN_CONTROL_HEIGHT_CLASS}
								onClick={() => void handleRefresh()}
								disabled={loading}
							>
								<Icon
									name={loading ? "Spinner" : "ArrowsClockwise"}
									className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
								/>
								{t("core:refresh")}
							</Button>
						</>
					}
				/>

				<AdminTableList
					loading={loading}
					items={remoteNodes}
					columns={6}
					rows={6}
					emptyTitle={t("no_remote_nodes")}
					emptyDescription={t("no_remote_nodes_desc")}
					headerRow={
						<TableHeader>
							<TableRow>
								<TableHead className="w-16">{t("id")}</TableHead>
								<TableHead>{t("core:name")}</TableHead>
								<TableHead>{t("namespace")}</TableHead>
								<TableHead>{t("base_url")}</TableHead>
								<TableHead>{t("remote_node_status")}</TableHead>
								<TableHead className={ADMIN_TABLE_ACTIONS_WIDTH_CLASS}>
									{t("core:actions")}
								</TableHead>
							</TableRow>
						</TableHeader>
					}
					renderRow={(node) => (
						<TableRow
							key={node.id}
							className={INTERACTIVE_TABLE_ROW_CLASS}
							onClick={() => openEdit(node)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									openEdit(node);
								}
							}}
							tabIndex={0}
						>
							<TableCell>
								<div className={REMOTE_NODE_TEXT_CELL_CONTENT_CLASS}>
									<span className="font-mono text-xs text-muted-foreground">
										{node.id}
									</span>
								</div>
							</TableCell>
							<TableCell>
								<div className={REMOTE_NODE_TEXT_CELL_CONTENT_CLASS}>
									<div className="min-w-0">
										<div className="truncate font-medium text-foreground">
											{node.name}
										</div>
									</div>
								</div>
							</TableCell>
							<TableCell>
								<div className={REMOTE_NODE_TEXT_CELL_CONTENT_CLASS}>
									<span className="truncate text-xs font-mono text-muted-foreground">
										{node.namespace}
									</span>
								</div>
							</TableCell>
							<TableCell>
								<div className={REMOTE_NODE_TEXT_CELL_CONTENT_CLASS}>
									<span className="truncate text-xs font-mono text-muted-foreground">
										{node.base_url || t("remote_node_base_url_empty")}
									</span>
								</div>
							</TableCell>
							<TableCell>
								<div className={REMOTE_NODE_BADGE_CELL_CONTENT_CLASS}>
									<div className="space-y-2">
										<Badge
											variant="outline"
											className={getRemoteNodeStatusTone(node)}
										>
											{getRemoteNodeStatusLabel(t, node)}
										</Badge>
										<div className="text-xs text-muted-foreground">
											{formatLastChecked(t, node.last_checked_at)}
										</div>
									</div>
								</div>
							</TableCell>
							<TableCell
								onClick={(event) => event.stopPropagation()}
								onKeyDown={(event) => event.stopPropagation()}
							>
								<div className="flex justify-end gap-1">
									<Button
										variant="ghost"
										size="icon"
										className={ADMIN_ICON_BUTTON_CLASS}
										onClick={() => void handleGenerateEnrollmentCommand(node)}
										disabled={generatingEnrollmentId === node.id}
										aria-label={t("remote_node_generate_enrollment_command")}
										title={t("remote_node_generate_enrollment_command")}
									>
										<Icon
											name={
												generatingEnrollmentId === node.id
													? "Spinner"
													: "ClipboardText"
											}
											className={cn(
												"h-3.5 w-3.5",
												generatingEnrollmentId === node.id && "animate-spin",
											)}
										/>
									</Button>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger>
												<div>
													<Button
														variant="ghost"
														size="icon"
														className={`${ADMIN_ICON_BUTTON_CLASS} text-destructive`}
														onClick={() => requestConfirm(node.id)}
														aria-label={t("delete_remote_node")}
														title={t("delete_remote_node")}
													>
														<Icon name="Trash" className="h-3.5 w-3.5" />
													</Button>
												</div>
											</TooltipTrigger>
											{node.last_error ? (
												<TooltipContent>{node.last_error}</TooltipContent>
											) : null}
										</Tooltip>
									</TooltipProvider>
								</div>
							</TableCell>
						</TableRow>
					)}
				/>

				<AdminOffsetPagination
					total={total}
					currentPage={currentPage}
					totalPages={totalPages}
					pageSize={String(pageSize)}
					pageSizeOptions={pageSizeOptions}
					onPageSizeChange={handlePageSizeChange}
					prevDisabled={prevPageDisabled}
					nextDisabled={nextPageDisabled}
					onPrevious={() => setOffset(Math.max(0, offset - pageSize))}
					onNext={() => setOffset(offset + pageSize)}
				/>

				<ConfirmDialog
					{...deleteDialogProps}
					title={`${t("delete_remote_node")} "${deleteNodeName}"?`}
					description={t("delete_remote_node_desc")}
					confirmLabel={t("core:delete")}
					variant="destructive"
				/>
				<RemoteNodeDialog
					open={dialogOpen}
					mode={editingId === null ? "create" : "edit"}
					form={form}
					editingNode={editingNode}
					submitting={submitting}
					createStep={createStep}
					createStepTouched={createStepTouched}
					onFieldChange={setField}
					onOpenChange={handleDialogOpenChange}
					onRunConnectionTest={() => runConnectionTest()}
					onSubmit={handleSubmit}
					onCreateBack={handleCreateBack}
					onCreateNext={handleCreateNext}
					onCreateStepChange={handleCreateStepChange}
				/>
				<RemoteNodeEnrollmentDialog
					open={enrollmentDialogOpen}
					command={enrollmentCommand}
					canTestConnection={enrollmentCommandCanTest}
					onCopy={copyToClipboard}
					onVerifyConnection={handleVerifyEnrollmentConnection}
					onOpenChange={handleEnrollmentDialogOpenChange}
				/>
			</AdminPageShell>
		</AdminLayout>
	);
}
