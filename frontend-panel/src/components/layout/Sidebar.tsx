import {
	ChevronLeft,
	ChevronRight,
	HardDrive,
	Search,
	Settings,
	Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { FolderTree } from "@/components/folders/FolderTree";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SidebarProps {
	collapsed: boolean;
	onToggle: () => void;
	mobileOpen: boolean;
	onMobileClose: () => void;
}

export function Sidebar({
	collapsed,
	onToggle,
	mobileOpen,
	onMobileClose,
}: SidebarProps) {
	const { t } = useTranslation();
	const location = useLocation();

	const navLinks = [
		{ to: "/trash", icon: Trash2, label: t("trash") },
		{ to: "/settings/webdav", icon: HardDrive, label: t("webdav") },
		{ to: "/search", icon: Search, label: t("search") },
		{ to: "/settings", icon: Settings, label: t("settings") },
	];

	const sidebarContent = (
		<div className="flex flex-col h-full">
			{/* Header with collapse toggle */}
			<div className="p-3 flex items-center justify-between">
				{!collapsed && (
					<span className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
						{t("app_name")}
					</span>
				)}
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7 hidden md:flex"
					onClick={onToggle}
				>
					{collapsed ? (
						<ChevronRight className="h-4 w-4" />
					) : (
						<ChevronLeft className="h-4 w-4" />
					)}
				</Button>
			</div>
			<Separator />

			{/* Folder tree */}
			<ScrollArea className="flex-1">{!collapsed && <FolderTree />}</ScrollArea>

			<Separator />

			{/* Navigation links */}
			<div className="p-2 space-y-1">
				{navLinks.map((link) => (
					<Link
						key={link.to}
						to={link.to}
						onClick={onMobileClose}
						className={cn(
							"flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
							collapsed && "justify-center px-2",
							location.pathname === link.to
								? "bg-accent text-accent-foreground"
								: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
						)}
					>
						<link.icon className="h-4 w-4 shrink-0" />
						{!collapsed && link.label}
					</Link>
				))}
			</div>
		</div>
	);

	return (
		<>
			{/* Mobile overlay backdrop */}
			{mobileOpen && (
				<button
					type="button"
					className="fixed inset-0 bg-black/50 z-40 md:hidden cursor-default"
					onClick={onMobileClose}
					aria-label="Close sidebar"
				/>
			)}

			{/* Sidebar - desktop inline, mobile overlay */}
			<aside
				className={cn(
					"border-r flex flex-col bg-background transition-all duration-200",
					// Desktop
					"hidden md:flex",
					collapsed ? "w-14" : "w-60",
					// Mobile override when open
					mobileOpen &&
						"fixed inset-y-0 left-0 z-50 flex w-60 md:relative md:z-auto",
				)}
			>
				{sidebarContent}
			</aside>
		</>
	);
}
