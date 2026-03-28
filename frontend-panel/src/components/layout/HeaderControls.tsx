import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { UserAvatarImage } from "@/components/common/UserAvatarImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { MENU_SECTION_PADDING_CLASS } from "@/lib/constants";
import { queuePreferenceSync } from "@/lib/preferenceSync";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";

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
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const user = useAuthStore((s) => s.user);
	const isAuthStale = useAuthStore((s) => s.isAuthStale);
	const logout = useAuthStore((s) => s.logout);
	const mode = useThemeStore((s) => s.mode);
	const setMode = useThemeStore((s) => s.setMode);
	const [loggingOut, setLoggingOut] = useState(false);
	const userName = user?.username ?? "user";
	const currentLanguage = i18n.language?.startsWith("zh") ? "zh" : "en";
	const menuLabelClass = `${MENU_SECTION_PADDING_CLASS} pt-2 pb-1 text-[11px] uppercase tracking-wide`;
	const menuItemClass = `${MENU_SECTION_PADDING_CLASS} min-h-10 rounded-lg py-2`;

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
						<span>{t("offline:offline_status_short")}</span>
					</TooltipTrigger>
					<TooltipContent className="max-w-64 text-left leading-relaxed">
						<div>{t("offline:offline_mode")}</div>
						<div className="text-background/80">
							{t("offline:auth_stale_detail")}
						</div>
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
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="sm"
							className="h-10 gap-2 rounded-full px-1.5 sm:h-9 sm:px-2"
							aria-label={userName}
						/>
					}
				>
					<UserAvatarImage
						avatar={user?.profile.avatar ?? null}
						name={userName}
						size="sm"
						className="border border-border/60"
					/>
					<span className="sr-only">{userName}</span>
					<div className="hidden min-w-0 items-center gap-2 md:flex">
						<span className="max-w-24 truncate text-sm">{user?.username}</span>
						{user?.role === "admin" ? (
							<Badge variant="secondary" className="px-1.5 py-0 text-xs">
								admin
							</Badge>
						) : null}
					</div>
					<Icon
						name="CaretDown"
						className="hidden h-3.5 w-3.5 text-muted-foreground md:block"
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-72 min-w-72 p-2">
					<div
						className={`${MENU_SECTION_PADDING_CLASS} mb-1 flex items-center gap-3 rounded-xl bg-muted/20 py-3`}
					>
						<UserAvatarImage
							avatar={user?.profile.avatar ?? null}
							name={userName}
							size="lg"
						/>
						<div className="min-w-0 flex-1 space-y-1">
							<div className="flex items-center gap-2">
								<p className="min-w-0 truncate text-sm font-medium text-foreground">
									{user?.username}
								</p>
								{user?.role === "admin" ? (
									<Badge variant="secondary" className="px-1.5 py-0 text-xs">
										admin
									</Badge>
								) : null}
							</div>
							{user?.email ? (
								<p className="truncate text-xs text-muted-foreground">
									{user.email}
								</p>
							) : null}
						</div>
					</div>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={() => navigate("/settings")}
						className={menuItemClass}
					>
						<Icon name="Gear" className="mr-2 h-4 w-4" />
						{t("settings")}
					</DropdownMenuItem>
					{showAdminEntry && user?.role === "admin" ? (
						<>
							<DropdownMenuItem
								onClick={() => navigate("/admin")}
								className={menuItemClass}
							>
								<Icon name="Shield" className="mr-2 h-4 w-4" />
								{t("admin_panel")}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
						</>
					) : null}
					{showHomeButton ? (
						<>
							<DropdownMenuItem
								onClick={() => navigate("/")}
								className={menuItemClass}
							>
								<Icon name="House" className="mr-2 h-4 w-4" />
								{homeLabel ?? t("back")}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
						</>
					) : null}
					<DropdownMenuGroup>
						<DropdownMenuLabel className={menuLabelClass}>
							{t("theme")}
						</DropdownMenuLabel>
						<DropdownMenuItem
							onClick={() => setMode("light")}
							className={menuItemClass}
						>
							<Icon name="Sun" className="mr-2 h-4 w-4" />
							<span className="flex-1">{t("theme_light")}</span>
							{mode === "light" ? (
								<Icon name="Check" className="h-4 w-4" />
							) : null}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => setMode("dark")}
							className={menuItemClass}
						>
							<Icon name="Moon" className="mr-2 h-4 w-4" />
							<span className="flex-1">{t("theme_dark")}</span>
							{mode === "dark" ? (
								<Icon name="Check" className="h-4 w-4" />
							) : null}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => setMode("system")}
							className={menuItemClass}
						>
							<Icon name="Monitor" className="mr-2 h-4 w-4" />
							<span className="flex-1">{t("theme_system")}</span>
							{mode === "system" ? (
								<Icon name="Check" className="h-4 w-4" />
							) : null}
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel className={menuLabelClass}>
							{t("language")}
						</DropdownMenuLabel>
						<DropdownMenuItem
							onClick={() => {
								void i18n.changeLanguage("en");
								queuePreferenceSync({ language: "en" });
							}}
							className={menuItemClass}
						>
							<Icon name="Globe" className="mr-2 h-4 w-4" />
							<span className="flex-1">{t("language_en")}</span>
							{currentLanguage === "en" ? (
								<Icon name="Check" className="h-4 w-4" />
							) : null}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => {
								void i18n.changeLanguage("zh");
								queuePreferenceSync({ language: "zh" });
							}}
							className={menuItemClass}
						>
							<Icon name="Globe" className="mr-2 h-4 w-4" />
							<span className="flex-1">{t("language_zh")}</span>
							{currentLanguage === "zh" ? (
								<Icon name="Check" className="h-4 w-4" />
							) : null}
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={() => void handleLogout()}
						variant="destructive"
						className={menuItemClass}
					>
						<Icon name="SignOut" className="mr-2 h-4 w-4" />
						{loggingOut ? t("loading") : t("logout")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
