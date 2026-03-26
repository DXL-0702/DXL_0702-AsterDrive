import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/common/ThemeSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";

interface HeaderControlsProps {
	actions?: ReactNode;
	showHomeButton?: boolean;
	homeLabel?: string;
	showAdminEntry?: boolean;
}

export function HeaderControls({
	actions,
	showHomeButton = false,
	homeLabel,
	showAdminEntry = false,
}: HeaderControlsProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const user = useAuthStore((s) => s.user);
	const isAuthStale = useAuthStore((s) => s.isAuthStale);
	const logout = useAuthStore((s) => s.logout);
	const [loggingOut, setLoggingOut] = useState(false);

	const handleLogout = async () => {
		try {
			setLoggingOut(true);
			await logout();
			navigate("/login", { replace: true });
		} finally {
			setLoggingOut(false);
		}
	};

	return (
		<div className="flex items-center gap-2 shrink-0">
			{actions}
			{isAuthStale && (
				<Tooltip>
					<TooltipTrigger
						render={
							<Badge
								variant="outline"
								className="hidden cursor-help items-center gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 md:inline-flex dark:text-amber-300"
							/>
						}
					>
						<Icon name="Warning" className="h-3.5 w-3.5" />
						<span>{t("offline_status_short")}</span>
					</TooltipTrigger>
					<TooltipContent className="max-w-64 text-left leading-relaxed">
						<div>{t("offline_mode")}</div>
						<div className="text-background/80">{t("auth_stale_detail")}</div>
					</TooltipContent>
				</Tooltip>
			)}
			{showHomeButton ? (
				<Button
					variant="ghost"
					size="sm"
					className="hidden md:inline-flex"
					onClick={() => navigate("/")}
				>
					<Icon name="House" className="mr-1.5 h-4 w-4" />
					{homeLabel ?? t("back")}
				</Button>
			) : null}
			<ThemeSwitcher />
			<LanguageSwitcher />
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="ghost" size="sm" className="h-9 gap-2 px-3" />
					}
				>
					<span className="max-w-24 truncate text-sm">{user?.username}</span>
					{user?.role === "admin" ? (
						<Badge
							variant="secondary"
							className="hidden px-1.5 py-0 text-xs sm:inline-flex"
						>
							admin
						</Badge>
					) : null}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{showAdminEntry && user?.role === "admin" ? (
						<>
							<DropdownMenuItem onClick={() => navigate("/admin")}>
								<Icon name="Shield" className="mr-2 h-4 w-4" />
								{t("admin_panel")}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
						</>
					) : null}
					{showHomeButton ? (
						<>
							<DropdownMenuItem onClick={() => navigate("/")}>
								<Icon name="House" className="mr-2 h-4 w-4" />
								{homeLabel ?? t("back")}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
						</>
					) : null}
					<DropdownMenuItem onClick={() => void handleLogout()}>
						<Icon name="SignOut" className="mr-2 h-4 w-4" />
						{loggingOut ? t("loading") : t("logout")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
