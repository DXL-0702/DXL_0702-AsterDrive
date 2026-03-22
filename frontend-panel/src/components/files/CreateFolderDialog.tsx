import { FolderPlus } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { handleApiError } from "@/hooks/useApiError";
import { useFileStore } from "@/stores/fileStore";

export function CreateFolderDialog() {
	const { t } = useTranslation("files");
	const createFolder = useFileStore((s) => s.createFolder);
	const [name, setName] = useState("");
	const [open, setOpen] = useState(false);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		try {
			await createFolder(name.trim());
			toast.success(t("create_folder"));
			setName("");
			setOpen(false);
		} catch (error) {
			handleApiError(error);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button variant="outline" size="sm" />}>
				<FolderPlus className="h-4 w-4 mr-1" />
				{t("new_folder")}
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("create_folder")}</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<Input
						placeholder={t("folder_name")}
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoFocus
					/>
					<Button type="submit" className="w-full">
						{t("create_folder")}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
