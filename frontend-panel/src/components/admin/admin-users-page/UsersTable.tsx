import { useTranslation } from "react-i18next";
import { UserAvatarImage } from "@/components/common/UserAvatarImage";
import {
	getRoleBadgeClass,
	getStatusBadgeClass,
} from "@/components/common/UserStatusBadge";
import { AdminSurface } from "@/components/layout/AdminSurface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ADMIN_ICON_BUTTON_CLASS } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { getNormalizedDisplayName, getUserDisplayName } from "@/lib/user";
import type { UserInfo } from "@/types/api";

const INTERACTIVE_TABLE_ROW_CLASS =
	"cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50";
const USER_TEXT_CELL_CONTENT_CLASS =
	"flex min-w-0 items-center rounded-lg bg-card/55 px-3 py-3 text-left ring-1 ring-border/35 transition-colors duration-200 dark:bg-background/20";
const USER_BADGE_CELL_CONTENT_CLASS =
	"flex items-center rounded-lg bg-muted/30 px-3 py-3 text-left ring-1 ring-border/35 transition-colors duration-200 dark:bg-muted/20";

interface UsersTableProps {
	users: UserInfo[];
	onDeleteUser: (userId: number) => void;
	onOpenUserDetail: (userId: number) => void;
}

function QuotaCell({ user }: { user: UserInfo }) {
	const { t } = useTranslation("admin");
	const quota = user.storage_quota ?? 0;
	const used = user.storage_used ?? 0;
	const pct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;

	return (
		<div className="flex w-full flex-col gap-2 rounded-lg bg-muted/30 px-3 py-2 text-left ring-1 ring-border/35 dark:bg-muted/20">
			<div className="flex items-center justify-between gap-3 text-xs">
				<span className="font-medium text-foreground">
					{formatBytes(used)}
					{quota > 0 ? ` / ${formatBytes(quota)}` : ` / ${t("core:unlimited")}`}
				</span>
			</div>
			{quota > 0 ? <Progress value={pct} className="h-1.5" /> : null}
		</div>
	);
}

export function UsersTable({
	onDeleteUser,
	onOpenUserDetail,
	users,
}: UsersTableProps) {
	const { t } = useTranslation("admin");

	return (
		<AdminSurface padded={false}>
			<ScrollArea className="min-h-0 flex-1">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-16">{t("id")}</TableHead>
							<TableHead>{t("core:username")}</TableHead>
							<TableHead>{t("core:email")}</TableHead>
							<TableHead className="w-32">{t("role")}</TableHead>
							<TableHead className="w-32">{t("core:status")}</TableHead>
							<TableHead className="w-[220px]">{t("storage")}</TableHead>
							<TableHead className="w-20">{t("core:actions")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.map((user) => (
							<TableRow
								key={user.id}
								className={INTERACTIVE_TABLE_ROW_CLASS}
								onClick={() => onOpenUserDetail(user.id)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										onOpenUserDetail(user.id);
									}
								}}
								tabIndex={0}
							>
								<TableCell className="font-mono text-xs text-muted-foreground">
									{user.id}
								</TableCell>
								<TableCell>
									<div className={USER_TEXT_CELL_CONTENT_CLASS}>
										<UserAvatarImage
											avatar={user.profile.avatar}
											name={getUserDisplayName(user)}
											alt=""
											size="sm"
											className="mr-3 h-7 w-7 rounded-lg text-[11px]"
										/>
										<div className="min-w-0">
											<div className="truncate font-medium text-foreground">
												{getUserDisplayName(user)}
											</div>
											{getNormalizedDisplayName(user.profile.display_name) &&
											getUserDisplayName(user) !== user.username ? (
												<div className="truncate text-xs text-muted-foreground">
													@{user.username}
												</div>
											) : null}
										</div>
									</div>
								</TableCell>
								<TableCell>
									<div className={USER_TEXT_CELL_CONTENT_CLASS}>
										<div className="truncate text-sm text-muted-foreground">
											{user.email}
										</div>
									</div>
								</TableCell>
								<TableCell>
									<div className={USER_BADGE_CELL_CONTENT_CLASS}>
										<Badge
											variant="outline"
											className={getRoleBadgeClass(user.role)}
										>
											{user.role === "admin" ? "Admin" : "User"}
										</Badge>
									</div>
								</TableCell>
								<TableCell>
									<div className={USER_BADGE_CELL_CONTENT_CLASS}>
										<Badge
											variant="outline"
											className={getStatusBadgeClass(user.status)}
										>
											{user.status === "active"
												? t("core:active")
												: t("core:disabled_status")}
										</Badge>
									</div>
								</TableCell>
								<TableCell>
									<div className="w-full text-left">
										<QuotaCell user={user} />
									</div>
								</TableCell>
								<TableCell
									onClick={(event) => event.stopPropagation()}
									onKeyDown={(event) => event.stopPropagation()}
								>
									<div className="flex justify-end">
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger>
													<div>
														<Button
															variant="ghost"
															size="icon"
															className={`${ADMIN_ICON_BUTTON_CLASS} text-destructive`}
															onClick={() => onDeleteUser(user.id)}
															aria-label={t("delete_user")}
															title={t("delete_user")}
															disabled={user.id === 1}
														>
															<Icon name="Trash" className="h-3.5 w-3.5" />
														</Button>
													</div>
												</TooltipTrigger>
												{user.id === 1 ? (
													<TooltipContent>
														{t("initial_admin_delete_blocked")}
													</TooltipContent>
												) : null}
											</Tooltip>
										</TooltipProvider>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</ScrollArea>
		</AdminSurface>
	);
}
