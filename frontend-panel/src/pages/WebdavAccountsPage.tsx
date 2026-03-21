import {
	Check,
	Copy,
	FolderOpen,
	Loader2,
	Plus,
	Power,
	Trash2,
	Wifi,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleApiError } from "@/hooks/useApiError";
import { webdavAccountService } from "@/services/webdavAccountService";
import { fileService } from "@/services/fileService";
import type { WebdavAccountInfo, FolderInfo } from "@/types/api";

export default function WebdavAccountsPage() {
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
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<boolean | null>(null);

	const fetchAccounts = useCallback(async () => {
		try {
			const data = await webdavAccountService.list();
			setAccounts(data);
		} catch (err) {
			handleApiError(err);
		} finally {
			setLoading(false);
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
		fetchAccounts();
		fetchFolders();
	}, [fetchAccounts, fetchFolders]);

	const handleCreate = async () => {
		if (!newUsername.trim()) {
			toast.error("Username is required");
			return;
		}
		setCreating(true);
		try {
			const result = await webdavAccountService.create(
				newUsername.trim(),
				newPassword.trim() || undefined,
				selectedFolderId,
			);
			setShowPassword({ username: result.username, password: result.password });
			setTestResult(null);
			setNewUsername("");
			setNewPassword("");
			setSelectedFolderId(undefined);
			toast.success("WebDAV account created");
			fetchAccounts();
		} catch (err) {
			handleApiError(err);
		} finally {
			setCreating(false);
		}
	};

	const handleDelete = async (id: number) => {
		try {
			await webdavAccountService.delete(id);
			toast.success("Account deleted");
			fetchAccounts();
		} catch (err) {
			handleApiError(err);
		}
	};

	const handleToggle = async (id: number) => {
		try {
			await webdavAccountService.toggle(id);
			fetchAccounts();
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
			toast.success("Connection test passed");
		} catch {
			setTestResult(false);
			toast.error("Connection test failed");
		} finally {
			setTesting(false);
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success("Copied to clipboard");
	};

	return (
		<AppLayout>
			<PageHeader title="WebDAV Accounts" />
			<div className="flex-1 overflow-auto p-6 space-y-6">
				{/* Create form */}
				<div className="border rounded-lg p-4 space-y-4 max-w-lg">
					<h3 className="font-medium">Create WebDAV Account</h3>
					<div className="space-y-2">
						<Label htmlFor="username">Username</Label>
						<Input
							id="username"
							value={newUsername}
							onChange={(e) => setNewUsername(e.target.value)}
							placeholder="e.g. my-webdav"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">
							Password{" "}
							<span className="text-muted-foreground font-normal">
								(leave empty to auto-generate)
							</span>
						</Label>
						<Input
							id="password"
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							placeholder="Auto-generate 16 chars"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="rootFolder">
							Access Scope{" "}
							<span className="text-muted-foreground font-normal">
								(optional, limit to a folder)
							</span>
						</Label>
						<select
							id="rootFolder"
							className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors"
							value={selectedFolderId ?? ""}
							onChange={(e) =>
								setSelectedFolderId(
									e.target.value ? Number(e.target.value) : undefined,
								)
							}
						>
							<option value="">All files (full access)</option>
							{folders.map((f) => (
								<option key={f.id} value={f.id}>
									/{f.name}
								</option>
							))}
						</select>
					</div>
					<Button onClick={handleCreate} disabled={creating}>
						<Plus className="h-4 w-4 mr-1" />
						Create
					</Button>
				</div>

				{/* One-time password display */}
				{showPassword && (
					<div className="border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 rounded-lg p-4 max-w-lg">
						<p className="text-sm font-medium mb-2">
							Save this password now — it won't be shown again:
						</p>
						<div className="flex items-center gap-2">
							<code className="flex-1 bg-background px-3 py-2 rounded border font-mono text-sm">
								{showPassword.password}
							</code>
							<Button
								variant="outline"
								size="icon"
								onClick={() => copyToClipboard(showPassword.password)}
							>
								<Copy className="h-4 w-4" />
							</Button>
						</div>
						<div className="flex items-center gap-2 mt-2">
							<Button
								variant="outline"
								size="sm"
								disabled={testing}
								onClick={handleTest}
							>
								{testing ? (
									<Loader2 className="h-4 w-4 mr-1 animate-spin" />
								) : testResult === true ? (
									<Check className="h-4 w-4 mr-1 text-green-600" />
								) : (
									<Wifi className="h-4 w-4 mr-1" />
								)}
								Test Connection
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowPassword(null)}
							>
								Dismiss
							</Button>
						</div>
					</div>
				)}

				{/* Accounts list */}
				{loading ? (
					<div className="text-muted-foreground">Loading...</div>
				) : accounts.length === 0 ? (
					<div className="text-muted-foreground">
						No WebDAV accounts yet. Create one to connect via WebDAV.
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Username</TableHead>
								<TableHead>Scope</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="w-[120px]">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{accounts.map((acc) => (
								<TableRow key={acc.id}>
									<TableCell className="font-mono">{acc.username}</TableCell>
									<TableCell>
										{acc.root_folder_path ? (
											<span className="flex items-center gap-1 text-sm">
												<FolderOpen className="h-3.5 w-3.5 text-blue-500" />
												{acc.root_folder_path}
											</span>
										) : (
											<span className="text-muted-foreground text-sm">
												All files
											</span>
										)}
									</TableCell>
									<TableCell>
										<span
											className={
												acc.is_active ? "text-green-600" : "text-red-500"
											}
										>
											{acc.is_active ? "Active" : "Disabled"}
										</span>
									</TableCell>
									<TableCell className="text-muted-foreground">
										{new Date(acc.created_at).toLocaleDateString()}
									</TableCell>
									<TableCell>
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												onClick={() => handleToggle(acc.id)}
												title={acc.is_active ? "Disable" : "Enable"}
											>
												<Power className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												onClick={() => handleDelete(acc.id)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}

				{/* Connection info */}
				<div className="border rounded-lg p-4 max-w-lg text-sm text-muted-foreground space-y-1">
					<p className="font-medium text-foreground">Connection Info</p>
					<p>
						URL:{" "}
						<code className="bg-muted px-1 rounded">
							{window.location.origin}/webdav/
						</code>
					</p>
					<p>Use your WebDAV username and password to connect.</p>
				</div>
			</div>
		</AppLayout>
	);
}
