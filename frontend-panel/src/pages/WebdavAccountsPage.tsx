import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonTable } from "@/components/common/SkeletonTable";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { handleApiError } from "@/hooks/useApiError";
import { cn } from "@/lib/utils";
import { fileService } from "@/services/fileService";
import { webdavAccountService } from "@/services/webdavAccountService";
import type { FolderInfo, WebdavAccountInfo } from "@/types/api";

function formatDateOnly(value: string) {
	return new Date(value).toLocaleDateString();
}

function MetricCard({
	icon,
	label,
	value,
	tone = "default",
}: {
	icon: "Globe" | "Power" | "FolderOpen";
	label: string;
	value: string;
	tone?: "default" | "success" | "accent";
}) {
	return (
		<div
			className={cn(
				"rounded-xl border px-3 py-2.5 shadow-sm md:rounded-2xl md:px-4 md:py-3",
				tone === "success" && "border-emerald-500/20 bg-emerald-500/5",
				tone === "accent" && "border-primary/20 bg-primary/5",
				tone === "default" && "bg-card",
			)}
		>
			<div className="flex items-center gap-2.5 md:gap-3">
				<div
					className={cn(
						"flex h-8 w-8 items-center justify-center rounded-lg border md:h-9 md:w-9 md:rounded-xl",
						tone === "success" &&
							"border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
						tone === "accent" && "border-primary/20 bg-primary/10 text-primary",
						tone === "default" &&
							"border-border bg-muted text-muted-foreground",
					)}
				>
					<Icon name={icon} className="h-3.5 w-3.5 md:h-4 md:w-4" />
				</div>
				<div className="min-w-0">
					<p className="text-[10px] leading-4 uppercase tracking-[0.1em] text-muted-foreground md:text-xs md:tracking-[0.12em]">
						{label}
					</p>
					<p className="text-base font-semibold tracking-tight md:text-lg">
						{value}
					</p>
				</div>
			</div>
		</div>
	);
}

export default function WebdavAccountsPage() {
	const { t } = useTranslation(["common", "admin", "auth"]);
	const [accounts, setAccounts] = useState<WebdavAccountInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [newUsername, setNewUsername] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [selectedFolderId, setSelectedFolderId] = useState<number | undefined>(
		undefined,
	);
	const [folders, setFolders] = useState<FolderInfo[]>([]);
	const [showPassword, setShowPassword] = useState<{
		username: string;
		password: string;
	} | null>(null);
	const [createPanelOpen, setCreatePanelOpen] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<boolean | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);

	const fetchAccounts = useCallback(async (showLoader = true) => {
		if (showLoader) setLoading(true);
		try {
			const data = await webdavAccountService.list();
			setAccounts(data);
		} catch (err) {
			handleApiError(err);
		} finally {
			if (showLoader) setLoading(false);
		}
	}, []);

	const fetchFolders = useCallback(async () => {
		try {
			const data = await fileService.listRoot();
			setFolders(data.folders);
		} catch (err) {
			handleApiError(err);
		}
	}, []);

	useEffect(() => {
		void fetchAccounts();
		void fetchFolders();
	}, [fetchAccounts, fetchFolders]);

	const endpointUrl =
		typeof window === "undefined"
			? "/webdav/"
			: `${window.location.origin}/webdav/`;
	const sortedAccounts = useMemo(
		() =>
			[...accounts].sort(
				(a, b) =>
					new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
			),
		[accounts],
	);
	const activeCount = accounts.filter((account) => account.is_active).length;
	const scopedCount = accounts.filter(
		(account) =>
			account.root_folder_id !== null && account.root_folder_id !== undefined,
	).length;
	const selectedFolder = folders.find(
		(folder) => folder.id === selectedFolderId,
	);

	const copyToClipboard = useCallback(
		async (value: string) => {
			try {
				await navigator.clipboard.writeText(value);
				toast.success(t("common:copied_to_clipboard"));
			} catch {
				toast.error(t("common:unexpected_error"));
			}
		},
		[t],
	);

	const handleCreate = async () => {
		if (!newUsername.trim()) {
			toast.error(t("common:username_required"));
			return;
		}

		setCreating(true);
		try {
			const result = await webdavAccountService.create(
				newUsername.trim(),
				newPassword.trim() || undefined,
				selectedFolderId,
			);
			setShowPassword({
				username: result.username,
				password: result.password,
			});
			setTestResult(null);
			setNewUsername("");
			setNewPassword("");
			setSelectedFolderId(undefined);
			toast.success(t("admin:webdav_account_created"));
			await fetchAccounts(false);
		} catch (err) {
			handleApiError(err);
		} finally {
			setCreating(false);
		}
	};

	const handleDelete = async (id: number) => {
		try {
			await webdavAccountService.delete(id);
			toast.success(t("admin:webdav_account_deleted"));
			await fetchAccounts(false);
		} catch (err) {
			handleApiError(err);
		}
	};

	const handleToggle = async (id: number) => {
		try {
			await webdavAccountService.toggle(id);
			await fetchAccounts(false);
		} catch (err) {
			handleApiError(err);
		}
	};

	const handleTest = async () => {
		if (!showPassword) return;
		setTesting(true);
		setTestResult(null);
		try {
			await webdavAccountService.test(
				showPassword.username,
				showPassword.password,
			);
			setTestResult(true);
			toast.success(t("admin:connection_success"));
		} catch {
			setTestResult(false);
			toast.error(t("admin:connection_test_failed"));
		} finally {
			setTesting(false);
		}
	};

	return (
		<AppLayout>
			<div className="min-h-0 flex-1 overflow-auto">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-5">
					<section className="rounded-2xl border bg-gradient-to-r from-primary/8 via-background to-muted/40 p-4 shadow-sm">
						<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
							<div className="max-w-2xl">
								<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
									<Icon name="Globe" className="h-5 w-5" />
								</div>
								<h1 className="text-xl font-semibold tracking-tight">
									{t("common:webdav")}
								</h1>
								<p className="mt-1 text-sm leading-6 text-muted-foreground">
									{t("common:webdav_page_desc")}
								</p>
							</div>
							<div className="flex items-center gap-2 self-start rounded-xl border bg-background/80 px-3 py-2 xl:self-auto">
								<div className="min-w-0">
									<div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
										{t("common:webdav_endpoint")}
									</div>
									<code className="mt-1 block max-w-[260px] truncate text-sm font-medium text-foreground md:max-w-[340px]">
										{endpointUrl}
									</code>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => void copyToClipboard(endpointUrl)}
								>
									<Icon name="Copy" className="h-3.5 w-3.5" />
									{t("common:webdav_copy_endpoint")}
								</Button>
							</div>
						</div>
					</section>

					<div className="grid grid-cols-3 gap-2 md:gap-3">
						<MetricCard
							icon="Globe"
							label={t("common:webdav_accounts_total")}
							value={String(accounts.length)}
							tone="default"
						/>
						<MetricCard
							icon="Power"
							label={t("common:webdav_accounts_active")}
							value={String(activeCount)}
							tone="success"
						/>
						<MetricCard
							icon="FolderOpen"
							label={t("common:webdav_accounts_scoped")}
							value={String(scopedCount)}
							tone="accent"
						/>
					</div>

					<div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
						<div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
							<Card className="border-primary/10 bg-gradient-to-b from-primary/5 to-background">
								<CardHeader className="border-b">
									<div className="flex items-start justify-between gap-3">
										<div>
											<CardTitle>{t("common:create_webdav_account")}</CardTitle>
											<CardDescription>
												{t("common:webdav_accounts_list_desc")}
											</CardDescription>
										</div>
										<Button
											variant="outline"
											size="sm"
											className="xl:hidden"
											onClick={() => setCreatePanelOpen((prev) => !prev)}
										>
											<Icon
												name={createPanelOpen ? "CaretUp" : "CaretDown"}
												className="h-3.5 w-3.5"
											/>
											{createPanelOpen ? t("common:close") : t("common:create")}
										</Button>
									</div>
								</CardHeader>
								<CardContent
									className={cn(
										"space-y-4 pt-4",
										!createPanelOpen && "hidden xl:block",
									)}
								>
									<div className="space-y-2">
										<Label htmlFor="username">{t("admin:username")}</Label>
										<Input
											id="username"
											value={newUsername}
											onChange={(e) => setNewUsername(e.target.value)}
											placeholder={t("common:webdav_username_placeholder")}
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="password">{t("auth:password")}</Label>
										<Input
											id="password"
											type="password"
											value={newPassword}
											onChange={(e) => setNewPassword(e.target.value)}
											placeholder={t("common:auto_generate_password")}
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="rootFolder">
											{t("common:access_scope")}
										</Label>
										<Select
											value={
												selectedFolderId != null
													? String(selectedFolderId)
													: "__all__"
											}
											onValueChange={(value) =>
												setSelectedFolderId(
													value === "__all__" ? undefined : Number(value),
												)
											}
										>
											<SelectTrigger id="rootFolder" className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="__all__">
													{t("common:all_files_full_access")}
												</SelectItem>
												{folders.map((folder) => (
													<SelectItem key={folder.id} value={String(folder.id)}>
														/{folder.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<p className="text-xs leading-5 text-muted-foreground">
											{selectedFolder
												? t("common:webdav_scope_folder_desc")
												: t("common:webdav_scope_all_desc")}
										</p>
										{folders.length === 0 ? (
											<p className="text-xs text-muted-foreground">
												{t("common:webdav_no_root_folders")}
											</p>
										) : null}
									</div>

									<Button
										className="w-full"
										onClick={handleCreate}
										disabled={creating || !newUsername.trim()}
									>
										<Icon name="Plus" className="h-4 w-4" />
										{creating ? t("common:loading") : t("common:create")}
									</Button>
								</CardContent>
							</Card>

							{showPassword ? (
								<Card size="sm" className="border-amber-500/25 bg-amber-500/10">
									<CardHeader className="border-b">
										<div className="flex items-start justify-between gap-3">
											<div>
												<CardTitle>
													{t("common:webdav_recent_credentials")}
												</CardTitle>
												<CardDescription>
													{t("common:webdav_created_for", {
														username: showPassword.username,
													})}
												</CardDescription>
											</div>
											{testResult !== null ? (
												<Badge
													variant={testResult ? "secondary" : "destructive"}
													className={
														testResult
															? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
															: undefined
													}
												>
													{testResult
														? t("admin:connection_success")
														: t("admin:connection_test_failed")}
												</Badge>
											) : null}
										</div>
									</CardHeader>
									<CardContent className="grid gap-3 pt-3 md:grid-cols-2 xl:grid-cols-1">
										<div className="rounded-xl border bg-background/80 p-3">
											<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
												{t("admin:username")}
											</div>
											<div className="flex items-center gap-2">
												<code className="min-w-0 flex-1 truncate font-mono text-sm">
													{showPassword.username}
												</code>
												<Button
													variant="outline"
													size="icon-sm"
													onClick={() =>
														void copyToClipboard(showPassword.username)
													}
												>
													<Icon name="Copy" className="h-3.5 w-3.5" />
												</Button>
											</div>
										</div>
										<div className="rounded-xl border bg-background/80 p-3">
											<div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
												{t("auth:password")}
											</div>
											<div className="flex items-center gap-2">
												<code className="min-w-0 flex-1 truncate font-mono text-sm">
													{showPassword.password}
												</code>
												<Button
													variant="outline"
													size="icon-sm"
													onClick={() =>
														void copyToClipboard(showPassword.password)
													}
												>
													<Icon name="Copy" className="h-3.5 w-3.5" />
												</Button>
											</div>
										</div>
									</CardContent>
									<div className="flex flex-wrap items-center gap-2 border-t bg-background/40 p-3">
										<Button
											variant="outline"
											size="sm"
											onClick={() => void handleTest()}
											disabled={testing}
										>
											{testing ? (
												<Icon name="Spinner" className="h-4 w-4 animate-spin" />
											) : (
												<Icon name="WifiHigh" className="h-4 w-4" />
											)}
											{t("admin:test_connection")}
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setShowPassword(null);
												setTestResult(null);
											}}
										>
											{t("common:dismiss")}
										</Button>
									</div>
								</Card>
							) : null}
						</div>

						<Card className="min-h-[440px]">
							<CardHeader className="border-b">
								<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
									<div>
										<CardTitle>{t("common:webdav_accounts_list")}</CardTitle>
										<CardDescription>
											{t("common:webdav_accounts_list_desc")}
										</CardDescription>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="outline">
											{t("common:items_count", { count: accounts.length })}
										</Badge>
										<Badge
											variant="secondary"
											className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
										>
											{t("common:webdav_accounts_active")}: {activeCount}
										</Badge>
										<Badge variant="outline">
											{t("common:webdav_accounts_scoped")}: {scopedCount}
										</Badge>
										<Button
											variant="outline"
											size="sm"
											onClick={() => void fetchAccounts(true)}
										>
											<Icon
												name="ArrowCounterClockwise"
												className="h-3.5 w-3.5"
											/>
											{t("common:webdav_refresh")}
										</Button>
									</div>
								</div>
							</CardHeader>

							{loading ? (
								<div className="px-4 pb-4">
									<SkeletonTable columns={4} rows={5} />
								</div>
							) : sortedAccounts.length === 0 ? (
								<CardContent className="flex flex-1 items-center pb-6">
									<div className="w-full rounded-2xl border border-dashed bg-muted/20">
										<EmptyState
											icon={<Icon name="Globe" className="h-10 w-10" />}
											title={t("common:no_webdav_accounts")}
											description={t("common:no_webdav_accounts_desc")}
										/>
									</div>
								</CardContent>
							) : (
								<CardContent className="px-0 pb-0">
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead className="pl-3">
														{t("admin:username")}
													</TableHead>
													<TableHead>{t("common:access_scope")}</TableHead>
													<TableHead>{t("common:status")}</TableHead>
													<TableHead>{t("common:created_at")}</TableHead>
													<TableHead className="w-[96px] pr-3 text-right">
														{t("common:actions")}
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{sortedAccounts.map((account) => (
													<TableRow key={account.id}>
														<TableCell className="pl-3">
															<div className="flex min-w-[140px] items-center gap-2.5">
																<div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
																	<Icon
																		name="HardDrive"
																		className="h-3.5 w-3.5"
																	/>
																</div>
																<div className="min-w-0">
																	<div className="truncate font-mono text-sm font-medium">
																		{account.username}
																	</div>
																</div>
															</div>
														</TableCell>
														<TableCell>
															<div className="min-w-[180px]">
																<div className="flex items-center gap-2 text-sm">
																	<Icon
																		name={
																			account.root_folder_path
																				? "FolderOpen"
																				: "Globe"
																		}
																		className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
																	/>
																	<span className="truncate">
																		{account.root_folder_path ??
																			t("common:all_files")}
																	</span>
																</div>
															</div>
														</TableCell>
														<TableCell>
															<Badge
																variant={
																	account.is_active ? "secondary" : "outline"
																}
																className={
																	account.is_active
																		? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
																		: undefined
																}
															>
																{account.is_active
																	? t("common:active")
																	: t("common:disabled_status")}
															</Badge>
														</TableCell>
														<TableCell className="text-sm text-muted-foreground">
															{formatDateOnly(account.created_at)}
														</TableCell>
														<TableCell className="pr-3">
															<div className="flex justify-end gap-2">
																<Button
																	variant="outline"
																	size="icon-sm"
																	onClick={() => void handleToggle(account.id)}
																	title={
																		account.is_active
																			? t("common:disabled_status")
																			: t("common:active")
																	}
																>
																	<Icon name="Power" className="h-3.5 w-3.5" />
																</Button>
																<Button
																	variant="destructive"
																	size="icon-sm"
																	onClick={() => setDeleteId(account.id)}
																	title={t("common:delete")}
																>
																	<Icon name="Trash" className="h-3.5 w-3.5" />
																</Button>
															</div>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</CardContent>
							)}
						</Card>
					</div>
				</div>
			</div>

			<ConfirmDialog
				open={deleteId !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteId(null);
				}}
				title={t("common:are_you_sure")}
				description={t("common:cannot_undo")}
				confirmLabel={t("common:delete")}
				onConfirm={() => {
					const id = deleteId;
					setDeleteId(null);
					if (id !== null) void handleDelete(id);
				}}
				variant="destructive"
			/>
		</AppLayout>
	);
}
