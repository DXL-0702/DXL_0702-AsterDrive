import { ExternalLink, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { handleApiError } from "@/hooks/useApiError";
import { api } from "@/services/http";
import type { ShareInfo } from "@/types/api";

export default function AdminSharesPage() {
	const [shares, setShares] = useState<ShareInfo[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		try {
			setLoading(true);
			const data = await api.get<ShareInfo[]>("/admin/shares");
			setShares(data);
		} catch (e) {
			handleApiError(e);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const handleDelete = async (id: number) => {
		try {
			await api.delete<void>(`/admin/shares/${id}`);
			setShares((prev) => prev.filter((s) => s.id !== id));
			toast.success("Share deleted");
		} catch (e) {
			handleApiError(e);
		}
	};

	const isExpired = (s: ShareInfo) =>
		s.expires_at != null && new Date(s.expires_at) < new Date();

	const isLimitReached = (s: ShareInfo) =>
		s.max_downloads > 0 && s.download_count >= s.max_downloads;

	return (
		<AdminLayout>
			<div className="p-6 space-y-4">
				<h2 className="text-lg font-semibold">Shares</h2>
				<ScrollArea className="flex-1">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-16">ID</TableHead>
								<TableHead>Token</TableHead>
								<TableHead>User</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Downloads</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="w-20">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : shares.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="text-center text-muted-foreground"
									>
										No shares
									</TableCell>
								</TableRow>
							) : (
								shares.map((s) => (
									<TableRow key={s.id}>
										<TableCell className="font-mono text-xs">{s.id}</TableCell>
										<TableCell>
											<a
												href={`/s/${s.token}`}
												target="_blank"
												rel="noreferrer"
												className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
											>
												{s.token}
												<ExternalLink className="h-3 w-3" />
											</a>
										</TableCell>
										<TableCell className="text-xs">#{s.user_id}</TableCell>
										<TableCell>
											<Badge variant="outline">
												{s.file_id != null ? "File" : "Folder"}
											</Badge>
										</TableCell>
										<TableCell>
											{isExpired(s) ? (
												<Badge
													variant="outline"
													className="text-red-600 border-red-600"
												>
													Expired
												</Badge>
											) : isLimitReached(s) ? (
												<Badge
													variant="outline"
													className="text-orange-600 border-orange-600"
												>
													Limit
												</Badge>
											) : (
												<Badge
													variant="outline"
													className="text-green-600 border-green-600"
												>
													Active
												</Badge>
											)}
										</TableCell>
										<TableCell className="text-xs">
											{s.download_count}
											{s.max_downloads > 0 ? ` / ${s.max_downloads}` : ""}
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{new Date(s.created_at).toLocaleDateString()}
										</TableCell>
										<TableCell>
											<AlertDialog>
												<AlertDialogTrigger
													render={
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8 text-destructive"
														/>
													}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>
															Delete share "{s.token}"?
														</AlertDialogTitle>
														<AlertDialogDescription>
															The share link will stop working immediately.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															onClick={() => handleDelete(s.id)}
														>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</ScrollArea>
			</div>
		</AdminLayout>
	);
}
