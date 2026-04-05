import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
	TeamManageDialog,
	type TeamManageTab,
} from "@/components/settings/TeamManageDialog";
import { useAuthStore } from "@/stores/authStore";
import { useTeamStore } from "@/stores/teamStore";

function isTeamManageTab(value: string | undefined): value is TeamManageTab {
	return (
		value === "overview" ||
		value === "members" ||
		value === "audit" ||
		value === "danger"
	);
}

export default function TeamManagePage() {
	const navigate = useNavigate();
	const { teamId, section } = useParams<{
		teamId?: string;
		section?: string;
	}>();
	const parsedTeamId = Number(teamId);
	const user = useAuthStore((state) => state.user);
	const ensureTeamsLoaded = useTeamStore((state) => state.ensureLoaded);
	const reloadTeams = useTeamStore((state) => state.reload);
	const teams = useTeamStore((state) => state.teams);

	useEffect(() => {
		void ensureTeamsLoaded(user?.id ?? null).catch(() => undefined);
	}, [ensureTeamsLoaded, user?.id]);

	if (!Number.isSafeInteger(parsedTeamId) || parsedTeamId <= 0) {
		return <Navigate to="/settings/teams" replace />;
	}

	if (section == null) {
		return <Navigate to={`/settings/teams/${parsedTeamId}/overview`} replace />;
	}

	if (!isTeamManageTab(section)) {
		return <Navigate to={`/settings/teams/${parsedTeamId}/overview`} replace />;
	}

	const teamSummary = teams.find((team) => team.id === parsedTeamId) ?? null;

	return (
		<AppLayout>
			<div className="min-h-0 flex-1 overflow-auto">
				<div className="mx-auto flex min-h-full w-full max-w-7xl flex-col p-4 md:p-6">
					<TeamManageDialog
						layout="page"
						currentUserId={user?.id ?? null}
						onArchivedReload={async () => undefined}
						onOpenChange={(open) => {
							if (!open) {
								navigate("/settings/teams", { viewTransition: true });
							}
						}}
						onPageTabChange={(tab, options) => {
							navigate(`/settings/teams/${parsedTeamId}/${tab}`, {
								replace: options?.replace,
								viewTransition: !options?.replace,
							});
						}}
						onTeamsReload={() => reloadTeams(user?.id ?? null)}
						open
						pageTab={section}
						teamId={parsedTeamId}
						teamSummary={teamSummary}
					/>
				</div>
			</div>
		</AppLayout>
	);
}
