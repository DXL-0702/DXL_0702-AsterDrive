import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { adminConfigService } from "@/services/adminService";
import { handleApiError } from "@/hooks/useApiError";
import type { SystemConfig } from "@/types/api";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettingsPage() {
	const [configs, setConfigs] = useState<SystemConfig[]>([]);
	const [loading, setLoading] = useState(true);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [formKey, setFormKey] = useState("");
	const [formValue, setFormValue] = useState("");

	const load = useCallback(async () => {
		try {
			setLoading(true);
			const data = await adminConfigService.list();
			setConfigs(data);
		} catch (e) {
			handleApiError(e);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const openCreate = () => {
		setEditingKey(null);
		setFormKey("");
		setFormValue("");
		setDialogOpen(true);
	};

	const openEdit = (c: SystemConfig) => {
		setEditingKey(c.key);
		setFormKey(c.key);
		setFormValue(c.value);
		setDialogOpen(true);
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		const key = formKey.trim();
		if (!key) return;
		try {
			const updated = await adminConfigService.set(key, formValue);
			setConfigs((prev) => {
				const idx = prev.findIndex((c) => c.key === key);
				if (idx >= 0) {
					const next = [...prev];
					next[idx] = updated;
					return next;
				}
				return [...prev, updated];
			});
			toast.success(editingKey ? "Config updated" : "Config created");
			setDialogOpen(false);
		} catch (e) {
			handleApiError(e);
		}
	};

	const handleDelete = async (key: string) => {
		try {
			await adminConfigService.delete(key);
			setConfigs((prev) => prev.filter((c) => c.key !== key));
			toast.success("Config deleted");
		} catch (e) {
			handleApiError(e);
		}
	};

	return (
		<AdminLayout>
			<div className="p-6 space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">System Settings</h2>
					<Button size="sm" onClick={openCreate}>
						<Plus className="h-4 w-4 mr-1" />
						Add Config
					</Button>
				</div>

				<ScrollArea className="flex-1">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Key</TableHead>
								<TableHead>Value</TableHead>
								<TableHead>Updated</TableHead>
								<TableHead className="w-24">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : configs.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={4}
										className="text-center text-muted-foreground"
									>
										No config entries
									</TableCell>
								</TableRow>
							) : (
								configs.map((c) => (
									<TableRow key={c.key}>
										<TableCell className="font-mono text-sm">{c.key}</TableCell>
										<TableCell className="font-mono text-sm text-muted-foreground max-w-md truncate">
											{c.value}
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{new Date(c.updated_at).toLocaleString()}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8"
													onClick={() => openEdit(c)}
												>
													<Pencil className="h-3.5 w-3.5" />
												</Button>
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
																Delete "{c.key}"?
															</AlertDialogTitle>
															<AlertDialogDescription>
																This config entry will be permanently removed.
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																onClick={() => handleDelete(c.key)}
															>
																Delete
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</div>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</ScrollArea>

				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>
								{editingKey ? "Edit Config" : "Add Config"}
							</DialogTitle>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="config-key">Key</Label>
								<Input
									id="config-key"
									value={formKey}
									onChange={(e) => setFormKey(e.target.value)}
									disabled={!!editingKey}
									required
									placeholder="e.g. site_name"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="config-value">Value</Label>
								<Input
									id="config-value"
									value={formValue}
									onChange={(e) => setFormValue(e.target.value)}
									placeholder="Value"
								/>
							</div>
							<Button type="submit" className="w-full">
								{editingKey ? "Save" : "Create"}
							</Button>
						</form>
					</DialogContent>
				</Dialog>
			</div>
		</AdminLayout>
	);
}
