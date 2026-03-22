import { LogOut, Menu, Shield } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/common/ThemeSwitcher";
import { Badge } from "@/components/ui/badge";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";
import { useFileStore } from "@/stores/fileStore";

interface TopBarProps {
	onSidebarToggle: () => void;
	title?: string;
	actions?: ReactNode;
}

export function TopBar({ onSidebarToggle, title, actions }: TopBarProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const breadcrumb = useFileStore((s) => s.breadcrumb);
	const navigateTo = useFileStore((s) => s.navigateTo);
	const user = useAuthStore((s) => s.user);
	const logout = useAuthStore((s) => s.logout);

	return (
		<div className="h-14 border-b flex items-center justify-between px-4 gap-4 shrink-0">
			{/* Left: hamburger + breadcrumb/title */}
			<div className="flex items-center gap-3 min-w-0">
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 md:hidden shrink-0"
					onClick={onSidebarToggle}
				>
					<Menu className="h-4 w-4" />
				</Button>

				{title ? (
					<span className="font-medium truncate">{title}</span>
				) : (
					<Breadcrumb>
						<BreadcrumbList>
							{breadcrumb.map((item, i) => (
								<Fragment key={item.id ?? "root"}>
									{i > 0 && <BreadcrumbSeparator />}
									<BreadcrumbItem>
										{i < breadcrumb.length - 1 ? (
											<BreadcrumbLink
												className="cursor-pointer"
												onClick={() => navigateTo(item.id, item.name)}
											>
												{item.name}
											</BreadcrumbLink>
										) : (
											<span className="font-medium">{item.name}</span>
										)}
									</BreadcrumbItem>
								</Fragment>
							))}
						</BreadcrumbList>
					</Breadcrumb>
				)}
			</div>

			{/* Right: page actions + theme + lang + user */}
			<div className="flex items-center gap-1 shrink-0">
				{actions}
				<ThemeSwitcher />
				<LanguageSwitcher />

				{/* User dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button variant="ghost" size="sm" className="gap-1.5" />}
					>
						<span className="text-sm truncate max-w-24">{user?.username}</span>
						{user?.role === "admin" && (
							<Badge
								variant="secondary"
								className="text-xs px-1.5 py-0 hidden sm:inline-flex"
							>
								admin
							</Badge>
						)}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{user?.role === "admin" && (
							<>
								<DropdownMenuItem onClick={() => navigate("/admin")}>
									<Shield className="h-4 w-4 mr-2" />
									{t("admin_panel")}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
							</>
						)}
						<DropdownMenuItem onClick={logout}>
							<LogOut className="h-4 w-4 mr-2" />
							{t("logout")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
