import { useTranslation } from "react-i18next";
import { AdminSurface } from "@/components/layout/AdminSurface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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
	ADMIN_ICON_BUTTON_CLASS,
	ADMIN_TABLE_ACTIONS_WIDTH_CLASS,
} from "@/lib/constants";
import { formatBytes, formatDateShort } from "@/lib/format";
import type { AdminTeamInfo } from "@/types/api";

const INTERACTIVE_TABLE_ROW_CLASS =
	"cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50";
const TEAM_TEXT_CELL_CONTENT_CLASS =
	"flex min-w-0 items-center rounded-lg bg-card/55 px-3 py-3 text-left ring-1 ring-border/35 transition-colors duration-200 dark:bg-background/20";
const TEAM_BADGE_CELL_CONTENT_CLASS =
	"flex items-center rounded-lg bg-muted/30 px-3 py-3 text-left ring-1 ring-border/35 transition-colors duration-200 dark:bg-muted/20";

interface AdminTeamsTableProps {
	onOpenTeam: (team: AdminTeamInfo) => void;
	policyGroupNameById: (
		policyGroupId: number | null | undefined,
	) => string | null;
	teams: AdminTeamInfo[];
}

export function AdminTeamsTable({
	onOpenTeam,
	policyGroupNameById,
	teams,
}: AdminTeamsTableProps) {
	const { t } = useTranslation(["admin", "core"]);

	return (
		<AdminSurface padded={false}>
			<ScrollArea className="min-h-0 flex-1">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("core:name")}</TableHead>
							<TableHead>{t("created_by")}</TableHead>
							<TableHead className="w-28">{t("member_count")}</TableHead>
							<TableHead className="w-[220px]">{t("quota")}</TableHead>
							<TableHead className="w-36">{t("core:created_at")}</TableHead>
							<TableHead className={ADMIN_TABLE_ACTIONS_WIDTH_CLASS}>
								{t("core:actions")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{teams.map((team) => (
							<TableRow
								key={team.id}
								className={INTERACTIVE_TABLE_ROW_CLASS}
								onClick={() => onOpenTeam(team)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										onOpenTeam(team);
									}
								}}
								tabIndex={0}
							>
								<TableCell>
									<div className="flex min-w-0 flex-col gap-2 rounded-lg bg-card/55 px-3 py-3 text-left ring-1 ring-border/35 dark:bg-background/20">
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-medium text-foreground">
												{team.name}
											</span>
											<Badge variant="outline">#{team.id}</Badge>
											{team.archived_at ? (
												<Badge variant="outline">{t("archived_badge")}</Badge>
											) : null}
										</div>
										{team.description ? (
											<p className="max-w-md text-xs text-muted-foreground">
												{team.description}
											</p>
										) : null}
									</div>
								</TableCell>
								<TableCell>
									<div className="flex min-w-0 flex-col gap-1 rounded-lg bg-card/55 px-3 py-3 text-left ring-1 ring-border/35 dark:bg-background/20">
										<span className="truncate text-sm text-foreground">
											{team.created_by_username}
										</span>
										<span className="text-xs text-muted-foreground">
											{t("created_by")} #{team.created_by}
										</span>
									</div>
								</TableCell>
								<TableCell>
									<div className={TEAM_BADGE_CELL_CONTENT_CLASS}>
										<span className="text-sm font-medium text-foreground">
											{team.member_count}
										</span>
									</div>
								</TableCell>
								<TableCell>
									<TeamStorageCell
										team={team}
										policyGroupName={policyGroupNameById(team.policy_group_id)}
									/>
								</TableCell>
								<TableCell>
									<div className={TEAM_TEXT_CELL_CONTENT_CLASS}>
										<span className="text-sm text-muted-foreground">
											{formatDateShort(team.archived_at ?? team.created_at)}
										</span>
									</div>
								</TableCell>
								<TableCell
									onClick={(event) => event.stopPropagation()}
									onKeyDown={(event) => event.stopPropagation()}
								>
									<div className="flex justify-end">
										<Button
											variant="ghost"
											size="icon"
											className={ADMIN_ICON_BUTTON_CLASS}
											onClick={() => onOpenTeam(team)}
											title={t("view_details")}
											aria-label={t("view_details")}
										>
											<Icon name="CaretRight" className="h-3.5 w-3.5" />
										</Button>
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

function TeamStorageCell({
	policyGroupName,
	team,
}: {
	policyGroupName: string | null;
	team: AdminTeamInfo;
}) {
	const { t } = useTranslation(["admin", "core"]);

	return (
		<div className="flex min-w-0 flex-col gap-1 rounded-lg bg-card/55 px-3 py-3 text-left ring-1 ring-border/35 dark:bg-background/20">
			<span className="text-sm font-medium text-foreground">
				{formatBytes(team.storage_used)}
				{team.storage_quota > 0
					? ` / ${formatBytes(team.storage_quota)}`
					: ` / ${t("core:unlimited")}`}
			</span>
			<span className="truncate text-xs text-muted-foreground">
				#{team.id}
				{team.policy_group_id != null
					? ` · ${policyGroupName ?? `PG ${team.policy_group_id}`}`
					: ""}
			</span>
		</div>
	);
}
