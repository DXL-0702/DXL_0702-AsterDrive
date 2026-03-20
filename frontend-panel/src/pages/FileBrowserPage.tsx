import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FileList } from "@/components/files/FileList";
import { UploadArea } from "@/components/files/UploadArea";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FolderPlus, LogOut, Shield } from "lucide-react";
import { useFileStore } from "@/stores/fileStore";
import { useAuthStore } from "@/stores/authStore";
import { handleApiError } from "@/hooks/useApiError";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

function StorageIndicator({
	user,
}: {
	user: { storage_used: number; storage_quota: number };
}) {
	const used = user.storage_used ?? 0;
	const quota = user.storage_quota ?? 0;
	const pct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;

	return (
		<div className="flex items-center gap-2 text-xs text-muted-foreground">
			<span>
				{formatBytes(used)}
				{quota > 0 ? ` / ${formatBytes(quota)}` : ""}
			</span>
			{quota > 0 && <Progress value={pct} className="h-1.5 w-16" />}
		</div>
	);
}

export default function FileBrowserPage() {
	const navigateTo = useFileStore((s) => s.navigateTo);
	const createFolder = useFileStore((s) => s.createFolder);
	const logout = useAuthStore((s) => s.logout);
	const user = useAuthStore((s) => s.user);
	const [folderName, setFolderName] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);

	useEffect(() => {
		navigateTo(null).catch(handleApiError);
	}, [navigateTo]);

	const handleCreateFolder = async (e: FormEvent) => {
		e.preventDefault();
		if (!folderName.trim()) return;
		try {
			await createFolder(folderName.trim());
			toast.success("Folder created");
			setFolderName("");
			setDialogOpen(false);
		} catch (error) {
			handleApiError(error);
		}
	};

	return (
		<AppLayout>
			<PageHeader
				actions={
					<>
						{user && <StorageIndicator user={user} />}
						<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
							<DialogTrigger render={<Button variant="outline" size="sm" />}>
								<FolderPlus className="h-4 w-4 mr-1" />
								New Folder
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Create Folder</DialogTitle>
								</DialogHeader>
								<form onSubmit={handleCreateFolder} className="space-y-4">
									<Input
										placeholder="Folder name"
										value={folderName}
										onChange={(e) => setFolderName(e.target.value)}
										autoFocus
									/>
									<Button type="submit" className="w-full">
										Create
									</Button>
								</form>
							</DialogContent>
						</Dialog>
						{user?.role === "admin" && (
							<Link to="/admin">
								<Button variant="ghost" size="sm">
									<Shield className="h-4 w-4" />
								</Button>
							</Link>
						)}
						<Button variant="ghost" size="sm" onClick={logout}>
							<LogOut className="h-4 w-4" />
						</Button>
					</>
				}
			/>
			<UploadArea>
				<ScrollArea className="flex-1">
					<FileList />
				</ScrollArea>
			</UploadArea>
		</AppLayout>
	);
}
