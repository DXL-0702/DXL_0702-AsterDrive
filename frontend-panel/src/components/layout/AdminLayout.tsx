import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { AdminTopBar } from "@/components/layout/AdminTopBar";
import { Icon, type IconName } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function AdminLayout({ children }: { children: ReactNode }) {
	const { t } = useTranslation("admin");
	const [mobileOpen, setMobileOpen] = useState(false);

	const handleMobileToggle = useCallback(() => {
		setMobileOpen((prev) => !prev);
	}, []);

	const handleMobileClose = useCallback(() => {
		setMobileOpen(false);
	}, []);

	const navItems: { to: string; label: string; icon: IconName }[] = [
		{ to: "/admin/users", label: t("users"), icon: "Shield" },
		{ to: "/admin/policies", label: t("policies"), icon: "HardDrive" },
		{ to: "/admin/shares", label: t("shares"), icon: "Link" },
		{ to: "/admin/locks", label: t("locks"), icon: "Lock" },
		{ to: "/admin/settings", label: t("system_settings"), icon: "Gear" },
		{
			to: "/admin/audit",
			label: t("audit_log"),
			icon: "ClipboardText",
		},
	];

	const sidebarContent = (
		<div className="flex h-full flex-col bg-background">
			<ScrollArea className="flex-1 pt-2">
				<nav className="space-y-1 p-2">
					{navItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							onClick={handleMobileClose}
							className={({ isActive }) =>
								cn(
									"flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
									isActive
										? "bg-accent text-accent-foreground font-medium"
										: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
								)
							}
						>
							<Icon name={item.icon} className="h-4 w-4 shrink-0" />
							{item.label}
						</NavLink>
					))}
				</nav>
			</ScrollArea>
		</div>
	);

	return (
		<div className="flex h-screen flex-col bg-muted/20">
			<AdminTopBar onSidebarToggle={handleMobileToggle} />
			<div className="flex min-h-0 flex-1 overflow-hidden">
				{mobileOpen && (
					<button
						type="button"
						className="fixed inset-0 z-40 bg-black/50 md:hidden"
						onClick={handleMobileClose}
						aria-label="Close admin sidebar"
					/>
				)}
				<aside
					className={cn(
						"border-r bg-background transition-all duration-200",
						"hidden w-64 shrink-0 md:flex md:flex-col",
						mobileOpen &&
							"fixed inset-y-16 left-0 z-50 flex w-64 flex-col shadow-lg md:relative md:inset-y-0 md:left-auto md:z-auto",
					)}
				>
					{sidebarContent}
				</aside>
				<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					{children}
				</main>
			</div>
		</div>
	);
}
