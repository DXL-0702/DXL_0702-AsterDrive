import { useEffect, useState, useCallback, useMemo } from "react";
import type { FormEvent } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
	adminConfigService,
	type ConfigSchemaItem,
} from "@/services/adminService";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
	webdav: "WebDAV",
	storage: "Storage",
	custom: "Custom",
};

export default function AdminSettingsPage() {
	const [configs, setConfigs] = useState<SystemConfig[]>([]);
	const [schemas, setSchemas] = useState<ConfigSchemaItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [formKey, setFormKey] = useState("");
	const [formValue, setFormValue] = useState("");

	const load = useCallback(async () => {
		try {
			setLoading(true);
			const [cfgs, schemaList] = await Promise.all([
				adminConfigService.list(),
				adminConfigService.schema(),
			]);
			setConfigs(cfgs);
			setSchemas(schemaList);
		} catch (e) {
			handleApiError(e);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const schemaMap = useMemo(() => {
		const m = new Map<string, ConfigSchemaItem>();
		for (const s of schemas) m.set(s.key, s);
		return m;
	}, [schemas]);

	// 按 category 分组：系统配置按 category，自定义配置归 "custom"
	const grouped = useMemo(() => {
		const groups: Record<string, SystemConfig[]> = {};
		for (const c of configs) {
			const cat = c.source === "system" ? c.category || "other" : "custom";
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(c);
		}
		return groups;
	}, [configs]);

	const categories = useMemo(() => {
		// 系统分类排前面，custom 放最后
		const cats = Object.keys(grouped);
		const system = cats.filter((c) => c !== "custom").sort();
		const custom = cats.filter((c) => c === "custom");
		return [...system, ...custom];
	}, [grouped]);

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

	const handleToggle = async (c: SystemConfig, checked: boolean) => {
		try {
			const updated = await adminConfigService.set(
				c.key,
				checked ? "true" : "false",
			);
			setConfigs((prev) =>
				prev.map((item) => (item.key === c.key ? updated : item)),
			);
		} catch (e) {
			handleApiError(e);
		}
	};

	const handleReset = async (c: SystemConfig) => {
		const schema = schemaMap.get(c.key);
		if (!schema) return;
		try {
			const updated = await adminConfigService.set(c.key, schema.default_value);
			setConfigs((prev) =>
				prev.map((item) => (item.key === c.key ? updated : item)),
			);
			toast.success(`Reset to default: ${schema.default_value}`);
		} catch (e) {
			handleApiError(e);
		}
	};

	const renderValue = (c: SystemConfig) => {
		const schema = schemaMap.get(c.key);

		// boolean → Switch
		if (c.value_type === "boolean") {
			return (
				<Switch
					checked={c.value === "true"}
					onCheckedChange={(checked) => handleToggle(c, checked)}
				/>
			);
		}

		// sensitive → 脱敏
		if (c.is_sensitive) {
			return <span className="text-muted-foreground">{"•".repeat(8)}</span>;
		}

		// number 或 string → 显示值 + 默认值比对
		const isDefault = schema && c.value === schema.default_value;
		return (
			<span className="font-mono text-sm">
				{c.value}
				{isDefault && (
					<span className="text-muted-foreground ml-1">(default)</span>
				)}
			</span>
		);
	};

	const renderConfigRow = (c: SystemConfig) => {
		const schema = schemaMap.get(c.key);
		const isSystem = c.source === "system";
		const isModified = schema && c.value !== schema.default_value;

		return (
			<TableRow
				key={c.key}
				className={
					c.requires_restart ? "bg-yellow-50/50 dark:bg-yellow-950/10" : ""
				}
			>
				<TableCell>
					<div className="flex items-center gap-2">
						<span className="font-mono text-sm">{c.key}</span>
						{c.requires_restart && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger>
										<AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
									</TooltipTrigger>
									<TooltipContent>Requires restart</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</div>
					{c.description && (
						<p className="text-xs text-muted-foreground mt-0.5">
							{c.description}
						</p>
					)}
				</TableCell>
				<TableCell>{renderValue(c)}</TableCell>
				<TableCell>
					<Badge variant={isSystem ? "secondary" : "outline"}>
						{c.value_type}
					</Badge>
				</TableCell>
				<TableCell>
					<div className="flex items-center gap-1">
						{c.value_type !== "boolean" && (
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={() => openEdit(c)}
							>
								<Pencil className="h-3.5 w-3.5" />
							</Button>
						)}
						{isSystem && isModified && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-yellow-600"
												onClick={() => handleReset(c)}
											/>
										}
									>
										<RotateCcw className="h-3.5 w-3.5" />
									</TooltipTrigger>
									<TooltipContent>
										Reset to default ({schema?.default_value})
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
						{!isSystem && (
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
										<AlertDialogTitle>Delete "{c.key}"?</AlertDialogTitle>
										<AlertDialogDescription>
											This config entry will be permanently removed.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction onClick={() => handleDelete(c.key)}>
											Delete
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						)}
					</div>
				</TableCell>
			</TableRow>
		);
	};

	const renderCategory = (cat: string) => {
		const items = grouped[cat] || [];
		return (
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[40%]">Key</TableHead>
						<TableHead>Value</TableHead>
						<TableHead className="w-24">Type</TableHead>
						<TableHead className="w-28">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>{items.map(renderConfigRow)}</TableBody>
			</Table>
		);
	};

	return (
		<AdminLayout>
			<div className="p-6 space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">System Settings</h2>
					<Button size="sm" onClick={openCreate}>
						<Plus className="h-4 w-4 mr-1" />
						Add Custom Config
					</Button>
				</div>

				{loading ? (
					<p className="text-muted-foreground text-center py-8">Loading...</p>
				) : categories.length === 0 ? (
					<p className="text-muted-foreground text-center py-8">
						No config entries
					</p>
				) : categories.length === 1 ? (
					renderCategory(categories[0])
				) : (
					<Tabs defaultValue={categories[0]}>
						<TabsList>
							{categories.map((cat) => (
								<TabsTrigger key={cat} value={cat}>
									{CATEGORY_LABELS[cat] || cat}
									<Badge variant="secondary" className="ml-1.5 text-xs">
										{grouped[cat]?.length || 0}
									</Badge>
								</TabsTrigger>
							))}
						</TabsList>
						{categories.map((cat) => (
							<TabsContent key={cat} value={cat}>
								{renderCategory(cat)}
							</TabsContent>
						))}
					</Tabs>
				)}

				{/* Create / Edit Dialog */}
				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>
								{editingKey ? "Edit Config" : "Add Custom Config"}
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
									placeholder="e.g. my-frontend.theme"
								/>
								{!editingKey && (
									<p className="text-xs text-muted-foreground">
										Use namespace.name format (e.g. my-frontend.theme)
									</p>
								)}
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
