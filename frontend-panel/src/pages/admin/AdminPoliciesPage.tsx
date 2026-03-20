import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { adminPolicyService } from "@/services/adminService";
import { handleApiError } from "@/hooks/useApiError";
import type { StoragePolicy, DriverType } from "@/types/api";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PolicyFormData {
	name: string;
	driver_type: DriverType;
	endpoint: string;
	bucket: string;
	access_key: string;
	secret_key: string;
	base_path: string;
	max_file_size: string;
	is_default: boolean;
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
	is_default: false,
};

export default function AdminPoliciesPage() {
	const [policies, setPolicies] = useState<StoragePolicy[]>([]);
	const [loading, setLoading] = useState(true);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [form, setForm] = useState<PolicyFormData>(emptyForm);

	const load = useCallback(async () => {
		try {
			setLoading(true);
			const data = await adminPolicyService.list();
			setPolicies(data);
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
		setEditingId(null);
		setForm(emptyForm);
		setDialogOpen(true);
	};

	const openEdit = (p: StoragePolicy) => {
		setEditingId(p.id);
		setForm({
			name: p.name,
			driver_type: p.driver_type,
			endpoint: p.endpoint,
			bucket: p.bucket,
			access_key: "",
			secret_key: "",
			base_path: p.base_path,
			max_file_size: p.max_file_size ? String(p.max_file_size) : "",
			is_default: p.is_default,
		});
		setDialogOpen(true);
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		try {
			if (editingId) {
				const payload: Record<string, unknown> = {
					name: form.name,
					endpoint: form.endpoint,
					bucket: form.bucket,
					base_path: form.base_path,
					max_file_size: form.max_file_size
						? Number(form.max_file_size)
						: undefined,
					is_default: form.is_default,
				};
				// Only send credentials if user typed new values
				if (form.access_key) payload.access_key = form.access_key;
				if (form.secret_key) payload.secret_key = form.secret_key;
				const updated = await adminPolicyService.update(editingId, payload);
				setPolicies((prev) =>
					prev.map((p) => (p.id === editingId ? updated : p)),
				);
				toast.success("Policy updated");
			} else {
				const payload = {
					...form,
					max_file_size: form.max_file_size
						? Number(form.max_file_size)
						: undefined,
				};
				const created = await adminPolicyService.create(payload);
				setPolicies((prev) => [...prev, created]);
				toast.success("Policy created");
			}
			setDialogOpen(false);
		} catch (e) {
			handleApiError(e);
		}
	};

	const handleDelete = async (id: number) => {
		try {
			await adminPolicyService.delete(id);
			setPolicies((prev) => prev.filter((p) => p.id !== id));
			toast.success("Policy deleted");
		} catch (e) {
			handleApiError(e);
		}
	};

	const setField = <K extends keyof PolicyFormData>(
		key: K,
		value: PolicyFormData[K],
	) => setForm((prev) => ({ ...prev, [key]: value }));

	return (
		<AdminLayout>
			<div className="p-6 space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">Storage Policies</h2>
					<Button size="sm" onClick={openCreate}>
						<Plus className="h-4 w-4 mr-1" />
						New Policy
					</Button>
				</div>

				<ScrollArea className="flex-1">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-16">ID</TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Driver</TableHead>
								<TableHead>Endpoint / Path</TableHead>
								<TableHead>Bucket</TableHead>
								<TableHead className="w-20">Default</TableHead>
								<TableHead className="w-24">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : policies.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="text-center text-muted-foreground"
									>
										No policies
									</TableCell>
								</TableRow>
							) : (
								policies.map((p) => (
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
												<Badge className="bg-blue-100 text-blue-700 border-blue-300">
													Default
												</Badge>
											)}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8"
													onClick={() => openEdit(p)}
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
																Delete policy "{p.name}"?
															</AlertDialogTitle>
															<AlertDialogDescription>
																This will not delete stored files, but new
																uploads using this policy will fail.
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																onClick={() => handleDelete(p.id)}
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
					<DialogContent className="max-w-lg">
						<DialogHeader>
							<DialogTitle>
								{editingId ? "Edit Policy" : "Create Policy"}
							</DialogTitle>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									value={form.name}
									onChange={(e) => setField("name", e.target.value)}
									required
								/>
							</div>

							{!editingId && (
								<div className="space-y-2">
									<Label>Driver Type</Label>
									<Select
										value={form.driver_type}
										onValueChange={(v) =>
											setField("driver_type", v as DriverType)
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="local">Local</SelectItem>
											<SelectItem value="s3">S3</SelectItem>
										</SelectContent>
									</Select>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="base_path">Base Path</Label>
								<Input
									id="base_path"
									value={form.base_path}
									onChange={(e) => setField("base_path", e.target.value)}
									placeholder={
										form.driver_type === "local" ? "./data" : "prefix/path"
									}
								/>
							</div>

							{form.driver_type === "s3" && (
								<>
									<div className="space-y-2">
										<Label htmlFor="endpoint">Endpoint</Label>
										<Input
											id="endpoint"
											value={form.endpoint}
											onChange={(e) => setField("endpoint", e.target.value)}
											placeholder="https://s3.amazonaws.com"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="bucket">Bucket</Label>
										<Input
											id="bucket"
											value={form.bucket}
											onChange={(e) => setField("bucket", e.target.value)}
											required
										/>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label htmlFor="access_key">Access Key</Label>
											<Input
												id="access_key"
												value={form.access_key}
												onChange={(e) => setField("access_key", e.target.value)}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="secret_key">Secret Key</Label>
											<Input
												id="secret_key"
												type="password"
												value={form.secret_key}
												onChange={(e) => setField("secret_key", e.target.value)}
											/>
										</div>
									</div>
								</>
							)}

							<div className="space-y-2">
								<Label htmlFor="max_file_size">Max File Size (bytes)</Label>
								<Input
									id="max_file_size"
									type="number"
									value={form.max_file_size}
									onChange={(e) => setField("max_file_size", e.target.value)}
									placeholder="0 = unlimited"
								/>
							</div>

							<div className="flex items-center gap-2">
								<Switch
									id="is_default"
									checked={form.is_default}
									onCheckedChange={(v) => setField("is_default", v)}
								/>
								<Label htmlFor="is_default">Set as default policy</Label>
							</div>

							<Button type="submit" className="w-full">
								{editingId ? "Save Changes" : "Create"}
							</Button>
						</form>
					</DialogContent>
				</Dialog>
			</div>
		</AdminLayout>
	);
}
