import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/common/ThemeSwitcher";
import { Icon, type IconName } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function AdminLayout({ children }: { children: ReactNode }) {
	const { t } = useTranslation("admin");

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

	return (
		<div className="h-screen flex flex-col">
			<div className="flex flex-1 overflow-hidden">
				<aside className="w-56 border-r flex flex-col shrink-0">
					<div className="p-3 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<NavLink
								to="/"
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								<Icon name="ArrowLeft" className="h-4 w-4" />
							</NavLink>
							<span className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
								{t("title")}
							</span>
						</div>
						<div className="flex items-center gap-0.5">
							<ThemeSwitcher />
							<LanguageSwitcher />
						</div>
					</div>
					<Separator />
					<ScrollArea className="flex-1">
						<nav className="p-2 space-y-1">
							{navItems.map((item) => (
								<NavLink
									key={item.to}
									to={item.to}
									className={({ isActive }) =>
										`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
											isActive
												? "bg-accent text-accent-foreground font-medium"
												: "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
										}`
									}
								>
									<Icon name={item.icon} className="h-4 w-4" />
									{item.label}
								</NavLink>
							))}
						</nav>
					</ScrollArea>
				</aside>
				<main className="flex-1 flex flex-col overflow-hidden">{children}</main>
			</div>
		</div>
	);
}
