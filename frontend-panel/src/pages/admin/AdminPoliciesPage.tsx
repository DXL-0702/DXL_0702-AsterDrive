import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import {
	ADMIN_CONTROL_HEIGHT_CLASS,
	ADMIN_ICON_BUTTON_CLASS,
	ADMIN_TABLE_ACTIONS_WIDTH_CLASS,
} from "@/lib/constants";
import {
	isPublicR2DevUrl,
	normalizeS3ConnectionFields,
} from "@/lib/s3Endpoint";
import { adminPolicyService } from "@/services/adminService";
import type { DriverType, StoragePolicy } from "@/types/api";

type S3UploadStrategy = "proxy_tempfile" | "relay_stream" | "presigned";
const POLICY_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

interface PolicyFormData {
	name: string;
	driver_type: DriverType;
	endpoint: string;
	bucket: string;
	access_key: string;
	secret_key: string;
	base_path: string;
	max_file_size: string;
	chunk_size: string;
	is_default: boolean;
	s3_upload_strategy: S3UploadStrategy;
}

interface PolicyOptions {
	presigned_upload?: boolean;
	s3_upload_strategy?: S3UploadStrategy;
}

function isS3UploadStrategy(value: unknown): value is S3UploadStrategy {
	return (
		value === "proxy_tempfile" ||
		value === "relay_stream" ||
		value === "presigned"
	);
}

function parsePolicyOptions(options: string): PolicyOptions {
	try {
		const parsed = JSON.parse(options) as {
			presigned_upload?: unknown;
			s3_upload_strategy?: unknown;
		};
		return {
			presigned_upload:
				typeof parsed.presigned_upload === "boolean"
					? parsed.presigned_upload
					: undefined,
			s3_upload_strategy: isS3UploadStrategy(parsed.s3_upload_strategy)
				? parsed.s3_upload_strategy
				: undefined,
		};
	} catch {
		return {};
	}
}

function getEffectiveS3UploadStrategy(
	options: PolicyOptions,
): S3UploadStrategy {
	if (options.s3_upload_strategy) {
		return options.s3_upload_strategy;
	}
	return options.presigned_upload ? "presigned" : "proxy_tempfile";
}

function buildPolicyOptions(form: PolicyFormData): string {
	if (form.driver_type !== "s3") {
		return JSON.stringify({});
	}

	return JSON.stringify({
		s3_upload_strategy: form.s3_upload_strategy,
	});
}

function normalizePolicyForm(form: PolicyFormData): PolicyFormData {
	if (form.driver_type !== "s3") {
		return form;
	}

	const normalized = normalizeS3ConnectionFields(form.endpoint, form.bucket);
	if (
		normalized.endpoint === form.endpoint &&
		normalized.bucket === form.bucket
	) {
		return form;
	}

	return {
		...form,
		endpoint: normalized.endpoint,
		bucket: normalized.bucket,
	};
}

function buildPolicyTestPayload(form: PolicyFormData) {
	const normalizedForm = normalizePolicyForm(form);

	return {
		driver_type: normalizedForm.driver_type,
		endpoint: normalizedForm.endpoint || undefined,
		bucket: normalizedForm.bucket || undefined,
		access_key: normalizedForm.access_key || undefined,
		secret_key: normalizedForm.secret_key || undefined,
		base_path: normalizedForm.base_path || undefined,
	};
}

function hasConnectionFieldChanges(
	form: PolicyFormData,
	editingPolicy: StoragePolicy | null,
) {
	const normalizedForm = normalizePolicyForm(form);

	if (!editingPolicy) {
		return true;
	}

	if (normalizedForm.driver_type === "s3") {
		return (
			normalizedForm.endpoint !== editingPolicy.endpoint ||
			normalizedForm.bucket !== editingPolicy.bucket ||
			normalizedForm.base_path !== editingPolicy.base_path ||
			normalizedForm.access_key !== "" ||
			normalizedForm.secret_key !== ""
		);
	}

	return normalizedForm.base_path !== editingPolicy.base_path;
}

function getS3ConnectionTestKey(form: PolicyFormData) {
	const normalizedForm = normalizePolicyForm(form);

	return JSON.stringify({
		driver_type: normalizedForm.driver_type,
		endpoint: normalizedForm.endpoint,
		bucket: normalizedForm.bucket,
		access_key: normalizedForm.access_key,
		secret_key: normalizedForm.secret_key,
		base_path: normalizedForm.base_path,
	});
}

const emptyForm: PolicyFormData = {
	name: "",
	driver_type: "local",
	endpoint: "",
	bucket: "",
	access_key: "",
	secret_key: "",
	base_path: "",
	max_file_size: "",
	chunk_size: "5",
	is_default: false,
	s3_upload_strategy: "proxy_tempfile",
};

function TestConnectionButton({
	onTest,
	disabled = false,
}: {
	onTest: () => Promise<boolean>;
	disabled?: boolean;
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
			disabled={testing || disabled}
			onClick={handleTest}
		>
			{testing ? (
				<Icon name="Spinner" className="h-4 w-4 mr-1 animate-spin" />
			) : result === true ? (
				<Icon
					name="Check"
					className="h-4 w-4 mr-1 text-green-600 dark:text-green-400"
				/>
			) : (
				<Icon name="WifiHigh" className="h-4 w-4 mr-1" />
			)}
			{t("test_connection")}
		</Button>
	);
}

export default function AdminPoliciesPage() {
	const { t } = useTranslation("admin");
	const [searchParams, setSearchParams] = useSearchParams();
	const initialOffset = Number(searchParams.get("offset") ?? "0");
	const initialPageSize = Number(searchParams.get("pageSize") ?? "20");
	const [offset, setOffset] = useState(
		Number.isNaN(initialOffset) ? 0 : initialOffset,
	);
	const [pageSize, setPageSize] = useState<
		(typeof POLICY_PAGE_SIZE_OPTIONS)[number]
	>(
		POLICY_PAGE_SIZE_OPTIONS.includes(
			initialPageSize as (typeof POLICY_PAGE_SIZE_OPTIONS)[number],
		)
			? (initialPageSize as (typeof POLICY_PAGE_SIZE_OPTIONS)[number])
			: 20,
	);
	const {
		items: policies,
		setItems: setPolicies,
		total,
		loading,
		reload,
	} = useApiList(
		() => adminPolicyService.list({ limit: pageSize, offset }),
		[offset, pageSize],
	);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editingPolicy, setEditingPolicy] = useState<StoragePolicy | null>(
		null,
	);
	const [form, setForm] = useState<PolicyFormData>(emptyForm);
	const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [validatedS3Key, setValidatedS3Key] = useState<string | null>(null);
	const endpointValidationMessage =
		form.driver_type === "s3" && isPublicR2DevUrl(form.endpoint)
			? t("s3_endpoint_public_r2_dev_error")
			: null;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const currentPage = Math.floor(offset / pageSize) + 1;
	const prevPageDisabled = offset === 0;
	const nextPageDisabled = offset + pageSize >= total;

	useEffect(() => {
		const params = new URLSearchParams();
		if (offset > 0) params.set("offset", String(offset));
		if (pageSize !== 20) params.set("pageSize", String(pageSize));
		setSearchParams(params, { replace: true });
	}, [offset, pageSize, setSearchParams]);

	const handlePageSizeChange = (value: string | null) => {
		if (!value) return;
		const next = Number(value) as (typeof POLICY_PAGE_SIZE_OPTIONS)[number];
		setPageSize(next);
		setOffset(0);
	};

	const handleDelete = async (id: number) => {
		try {
			await adminPolicyService.delete(id);
			if (policies.length === 1 && offset > 0) {
				setOffset(Math.max(0, offset - pageSize));
			} else {
				await reload();
			}
			toast.success(t("policy_deleted"));
		} catch (e) {
			handleApiError(e);
		}
	};

	const {
		confirmId: deleteId,
		requestConfirm,
		dialogProps,
	} = useConfirmDialog(handleDelete);

	const openCreate = () => {
		setEditingId(null);
		setEditingPolicy(null);
		setValidatedS3Key(null);
		setSaveConfirmOpen(false);
		setForm(emptyForm);
		setDialogOpen(true);
	};

	const openEdit = (p: StoragePolicy) => {
		setEditingId(p.id);
		setEditingPolicy(p);
		setValidatedS3Key(null);
		setSaveConfirmOpen(false);
		const opts = parsePolicyOptions(p.options);
		setForm({
			name: p.name,
			driver_type: p.driver_type,
			endpoint: p.endpoint,
			bucket: p.bucket,
			access_key: "",
			secret_key: "",
			base_path: p.base_path,
			max_file_size: p.max_file_size != null ? String(p.max_file_size) : "",
			chunk_size:
				p.chunk_size != null
					? String(Math.round(p.chunk_size / 1024 / 1024))
					: "5",
			is_default: p.is_default,
			s3_upload_strategy: getEffectiveS3UploadStrategy(opts),
		});
		setDialogOpen(true);
	};

	const handleDialogOpenChange = (open: boolean) => {
		setDialogOpen(open);
		if (!open) {
			setSaveConfirmOpen(false);
			setValidatedS3Key(null);
		}
	};

	const runConnectionTest = async ({
		showSuccessToast = true,
		showFailureError = true,
	}: {
		showSuccessToast?: boolean;
		showFailureError?: boolean;
	} = {}) => {
		const currentForm = syncNormalizedS3Form();
		const shouldUseParamTest =
			editingId === null ||
			hasConnectionFieldChanges(currentForm, editingPolicy);

		try {
			if (shouldUseParamTest) {
				await adminPolicyService.testParams(
					buildPolicyTestPayload(currentForm),
				);
			} else {
				await adminPolicyService.testConnection(editingId);
			}

			if (currentForm.driver_type === "s3") {
				setValidatedS3Key(getS3ConnectionTestKey(currentForm));
			}
			if (showSuccessToast) {
				toast.success(t("connection_success"));
			}
			return true;
		} catch (e) {
			setValidatedS3Key(null);
			if (showFailureError) {
				handleApiError(e);
			}
			return false;
		}
	};

	const persistPolicy = async () => {
		try {
			const currentForm = syncNormalizedS3Form();
			const options = buildPolicyOptions(currentForm);
			if (editingId) {
				const payload: Record<string, unknown> = {
					name: currentForm.name,
					endpoint: currentForm.endpoint,
					bucket: currentForm.bucket,
					base_path: currentForm.base_path,
					max_file_size: currentForm.max_file_size
						? Number(currentForm.max_file_size)
						: undefined,
					chunk_size: currentForm.chunk_size
						? Number(currentForm.chunk_size) * 1024 * 1024
						: 0,
					is_default: currentForm.is_default,
					options,
				};
				// Only send credentials if user typed new values
				if (currentForm.access_key) payload.access_key = currentForm.access_key;
				if (currentForm.secret_key) payload.secret_key = currentForm.secret_key;
				const updated = await adminPolicyService.update(editingId, payload);
				setPolicies((prev) =>
					prev.map((p) => (p.id === editingId ? updated : p)),
				);
				toast.success(t("policy_updated"));
			} else {
				const payload = {
					name: currentForm.name,
					driver_type: currentForm.driver_type,
					endpoint: currentForm.endpoint,
					bucket: currentForm.bucket,
					access_key: currentForm.access_key,
					secret_key: currentForm.secret_key,
					base_path: currentForm.base_path,
					max_file_size: currentForm.max_file_size
						? Number(currentForm.max_file_size)
						: undefined,
					chunk_size: currentForm.chunk_size
						? Number(currentForm.chunk_size) * 1024 * 1024
						: 0,
					is_default: currentForm.is_default,
					options,
				};
				await adminPolicyService.create(payload);
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
				toast.success(t("policy_created"));
			}
			handleDialogOpenChange(false);
		} catch (e) {
			handleApiError(e);
		}
	};

	const shouldRunS3SaveTest = () => {
		if (form.driver_type !== "s3") {
			return false;
		}

		if (editingId !== null && !hasConnectionFieldChanges(form, editingPolicy)) {
			return false;
		}

		return validatedS3Key !== getS3ConnectionTestKey(form);
	};

	const submitPolicy = async (forceSave = false) => {
		if (submitting) {
			return;
		}

		setSubmitting(true);
		try {
			if (!forceSave && shouldRunS3SaveTest()) {
				const testPassed = await runConnectionTest({
					showSuccessToast: false,
					showFailureError: false,
				});
				if (!testPassed) {
					setSaveConfirmOpen(true);
					return;
				}
			}

			await persistPolicy();
		} finally {
			setSubmitting(false);
		}
	};

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		void submitPolicy();
	};

	const setField = <K extends keyof PolicyFormData>(
		key: K,
		value: PolicyFormData[K],
	) => setForm((prev) => ({ ...prev, [key]: value }));

	const syncNormalizedS3Form = () => {
		const normalizedForm = normalizePolicyForm(form);
		if (normalizedForm !== form) {
			setForm(normalizedForm);
		}
		return normalizedForm;
	};

	const deletePolicyName =
		deleteId !== null
			? (policies.find((p) => p.id === deleteId)?.name ?? "")
			: "";

	return (
		<AdminLayout>
			<AdminPageShell>
				<AdminPageHeader
					title={t("policies")}
					description={t("policies_intro")}
					actions={
						<>
							<Button
								size="sm"
								className={ADMIN_CONTROL_HEIGHT_CLASS}
								onClick={openCreate}
							>
								<Icon name="Plus" className="mr-1 h-4 w-4" />
								{t("new_policy")}
							</Button>
							<Button
								variant="outline"
								size="sm"
								className={ADMIN_CONTROL_HEIGHT_CLASS}
								onClick={() => void reload()}
								disabled={loading}
							>
								<Icon
									name={loading ? "Spinner" : "ArrowsClockwise"}
									className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
								/>
								{t("refresh")}
							</Button>
						</>
					}
				/>

				<AdminTableList
					loading={loading}
					items={policies}
					columns={7}
					rows={6}
					emptyTitle={t("no_policies")}
					emptyDescription={t("no_policies_desc")}
					headerRow={
						<TableHeader>
							<TableRow>
								<TableHead className="w-16">{t("id")}</TableHead>
								<TableHead>{t("core:name")}</TableHead>
								<TableHead>{t("driver_type")}</TableHead>
								<TableHead>{t("endpoint_path")}</TableHead>
								<TableHead>{t("bucket")}</TableHead>
								<TableHead className="w-20">{t("is_default")}</TableHead>
								<TableHead className={ADMIN_TABLE_ACTIONS_WIDTH_CLASS}>
									{t("core:actions")}
								</TableHead>
							</TableRow>
						</TableHeader>
					}
					renderRow={(p) => (
						<TableRow key={p.id}>
							<TableCell className="font-mono text-xs">{p.id}</TableCell>
							<TableCell className="font-medium">{p.name}</TableCell>
							<TableCell>
								<Badge variant="outline">
									{p.driver_type === "local" ? "Local" : "S3"}
								</Badge>
							</TableCell>
							<TableCell className="text-muted-foreground text-xs font-mono">
								{p.driver_type === "local"
									? p.base_path || "./data"
									: p.endpoint}
							</TableCell>
							<TableCell className="text-muted-foreground text-xs">
								{p.bucket || "-"}
							</TableCell>
							<TableCell>
								{p.is_default && (
									<Badge className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
										{t("is_default")}
									</Badge>
								)}
							</TableCell>
							<TableCell>
								<div className="flex items-center gap-1">
									<Button
										variant="ghost"
										size="icon"
										className={ADMIN_ICON_BUTTON_CLASS}
										onClick={() => openEdit(p)}
									>
										<Icon name="PencilSimple" className="h-3.5 w-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className={`${ADMIN_ICON_BUTTON_CLASS} text-destructive`}
										onClick={() => requestConfirm(p.id)}
									>
										<Icon name="Trash" className="h-3.5 w-3.5" />
									</Button>
								</div>
							</TableCell>
						</TableRow>
					)}
				/>

				{total > 0 ? (
					<div className="flex items-center justify-between gap-3 px-4 pb-4 text-sm text-muted-foreground md:px-6">
						<div className="flex items-center gap-3">
							<span>
								{t("entries_page", {
									total,
									current: currentPage,
									pages: totalPages,
								})}
							</span>
							<Select
								value={String(pageSize)}
								onValueChange={handlePageSizeChange}
							>
								<SelectTrigger
									className={`${ADMIN_CONTROL_HEIGHT_CLASS} w-[120px]`}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{POLICY_PAGE_SIZE_OPTIONS.map((size) => (
										<SelectItem key={size} value={String(size)}>
											{t("page_size_option", { count: size })}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<TooltipProvider>
							<div className="flex items-center gap-2">
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												variant="outline"
												size="sm"
												disabled={prevPageDisabled}
												onClick={() =>
													setOffset(Math.max(0, offset - pageSize))
												}
											/>
										}
									>
										<Icon name="CaretLeft" className="h-4 w-4" />
									</TooltipTrigger>
									{prevPageDisabled ? (
										<TooltipContent>
											{t("pagination_prev_disabled")}
										</TooltipContent>
									) : null}
								</Tooltip>
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												variant="outline"
												size="sm"
												disabled={nextPageDisabled}
												onClick={() => setOffset(offset + pageSize)}
											/>
										}
									>
										<Icon name="CaretRight" className="h-4 w-4" />
									</TooltipTrigger>
									{nextPageDisabled ? (
										<TooltipContent>
											{t("pagination_next_disabled")}
										</TooltipContent>
									) : null}
								</Tooltip>
							</div>
						</TooltipProvider>
					</div>
				) : null}

				<ConfirmDialog
					{...dialogProps}
					title={`${t("delete_policy")} "${deletePolicyName}"?`}
					description={t("delete_policy_desc")}
					confirmLabel={t("core:delete")}
					variant="destructive"
				/>

				<ConfirmDialog
					open={saveConfirmOpen}
					onOpenChange={setSaveConfirmOpen}
					title={t("connection_test_failed")}
					description={t("policy_test_failed_confirm_desc")}
					confirmLabel={t("save_anyway")}
					onConfirm={() => {
						setSaveConfirmOpen(false);
						void submitPolicy(true);
					}}
				/>

				<Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
					<DialogContent className="sm:max-w-lg">
						<DialogHeader>
							<DialogTitle>
								{editingId ? t("edit_policy") : t("create_policy")}
							</DialogTitle>
							<DialogDescription>{t("policies_intro")}</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">{t("core:name")}</Label>
								<Input
									id="name"
									value={form.name}
									onChange={(e) => setField("name", e.target.value)}
									className={ADMIN_CONTROL_HEIGHT_CLASS}
									required
								/>
							</div>

							{!editingId && (
								<div className="space-y-2">
									<Label>{t("driver_type")}</Label>
									<Select
										value={form.driver_type}
										onValueChange={(v) =>
											setField("driver_type", v as DriverType)
										}
									>
										<SelectTrigger className={ADMIN_CONTROL_HEIGHT_CLASS}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="local">
												{t("driver_type_local")}
											</SelectItem>
											<SelectItem value="s3">{t("driver_type_s3")}</SelectItem>
										</SelectContent>
									</Select>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="base_path">{t("base_path")}</Label>
								<Input
									id="base_path"
									value={form.base_path}
									onChange={(e) => setField("base_path", e.target.value)}
									className={ADMIN_CONTROL_HEIGHT_CLASS}
									placeholder={
										form.driver_type === "local" ? "./data" : "prefix/path"
									}
								/>
							</div>

							{form.driver_type === "s3" && (
								<>
									<div className="space-y-2">
										<Label htmlFor="endpoint">{t("endpoint")}</Label>
										<Input
											id="endpoint"
											value={form.endpoint}
											onChange={(e) => setField("endpoint", e.target.value)}
											onBlur={syncNormalizedS3Form}
											aria-invalid={
												endpointValidationMessage ? true : undefined
											}
											className={ADMIN_CONTROL_HEIGHT_CLASS}
											placeholder="https://s3.amazonaws.com"
										/>
										{endpointValidationMessage && (
											<p className="text-xs text-destructive">
												{endpointValidationMessage}
											</p>
										)}
										<p className="text-xs text-muted-foreground">
											{t("s3_endpoint_hint")}
										</p>
									</div>
									<div className="space-y-2">
										<Label htmlFor="bucket">{t("bucket")}</Label>
										<Input
											id="bucket"
											value={form.bucket}
											onChange={(e) => setField("bucket", e.target.value)}
											className={ADMIN_CONTROL_HEIGHT_CLASS}
											required
										/>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label htmlFor="access_key">{t("access_key")}</Label>
											<Input
												id="access_key"
												value={form.access_key}
												onChange={(e) => setField("access_key", e.target.value)}
												className={ADMIN_CONTROL_HEIGHT_CLASS}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="secret_key">{t("secret_key")}</Label>
											<Input
												id="secret_key"
												type="password"
												value={form.secret_key}
												onChange={(e) => setField("secret_key", e.target.value)}
												className={ADMIN_CONTROL_HEIGHT_CLASS}
											/>
										</div>
									</div>
									<div className="space-y-2 pt-1">
										<Label htmlFor="s3_upload_strategy">
											{t("s3_upload_strategy")}
										</Label>
										<Select
											value={form.s3_upload_strategy}
											onValueChange={(value) =>
												setField(
													"s3_upload_strategy",
													value as S3UploadStrategy,
												)
											}
										>
											<SelectTrigger
												id="s3_upload_strategy"
												className={ADMIN_CONTROL_HEIGHT_CLASS}
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="proxy_tempfile">
													{t("s3_upload_strategy_proxy_tempfile")}
												</SelectItem>
												<SelectItem value="relay_stream">
													{t("s3_upload_strategy_relay_stream")}
												</SelectItem>
												<SelectItem value="presigned">
													{t("s3_upload_strategy_presigned")}
												</SelectItem>
											</SelectContent>
										</Select>
										<p className="text-xs text-muted-foreground">
											{t(
												`${
													form.s3_upload_strategy === "proxy_tempfile"
														? "s3_upload_strategy_proxy_tempfile_desc"
														: form.s3_upload_strategy === "relay_stream"
															? "s3_upload_strategy_relay_stream_desc"
															: "s3_upload_strategy_presigned_desc"
												}`,
											)}
										</p>
									</div>
								</>
							)}

							<div className="space-y-2">
								<Label htmlFor="max_file_size">
									{t("max_file_size")} (bytes)
								</Label>
								<Input
									id="max_file_size"
									type="number"
									value={form.max_file_size}
									onChange={(e) => setField("max_file_size", e.target.value)}
									className={ADMIN_CONTROL_HEIGHT_CLASS}
									placeholder={`0 = ${t("core:unlimited").toLowerCase()}`}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="chunk_size">{t("chunk_size")}</Label>
								<Input
									id="chunk_size"
									type="number"
									value={form.chunk_size}
									onChange={(e) => setField("chunk_size", e.target.value)}
									className={ADMIN_CONTROL_HEIGHT_CLASS}
									placeholder="5 = 5MB, 0 = single upload only"
								/>
								<p className="text-xs text-muted-foreground">
									{t("chunk_size_desc")}
								</p>
							</div>

							<div className="flex items-center gap-2">
								<Switch
									id="is_default"
									checked={form.is_default}
									onCheckedChange={(v) => setField("is_default", v)}
								/>
								<Label htmlFor="is_default">{t("set_as_default")}</Label>
							</div>

							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									className={ADMIN_CONTROL_HEIGHT_CLASS}
									onClick={() => handleDialogOpenChange(false)}
									disabled={submitting}
								>
									{t("core:cancel")}
								</Button>
								<TestConnectionButton
									onTest={() => runConnectionTest()}
									disabled={submitting}
								/>
								<Button
									type="submit"
									className={ADMIN_CONTROL_HEIGHT_CLASS}
									disabled={submitting}
								>
									{editingId ? t("save_changes") : t("core:create")}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</AdminPageShell>
		</AdminLayout>
	);
}
