import {
	type FormEvent,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	AdminTeamDetailAuditSection,
	AdminTeamDetailDangerSection,
	AdminTeamDetailMembersSection,
	AdminTeamDetailOverviewSection,
	type PolicyGroupOption,
} from "@/components/admin/admin-team-detail/AdminTeamDetailSections";
import { AdminTeamDetailShell } from "@/components/admin/admin-team-detail/AdminTeamDetailShell";
import type { AdminTeamDetailTab } from "@/components/admin/admin-team-detail/types";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { handleApiError } from "@/hooks/useApiError";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { adminTeamService } from "@/services/adminService";
import type {
	AdminTeamInfo,
	StoragePolicyGroup,
	TeamAuditEntryInfo,
	TeamMemberInfo,
	TeamMemberRole,
	UserStatus,
} from "@/types/api";

export type { AdminTeamDetailTab } from "@/components/admin/admin-team-detail/types";

interface AdminTeamDetailDialogProps {
	layout?: "dialog" | "page";
	open: boolean;
	teamId: number | null;
	policyGroups: StoragePolicyGroup[];
	policyGroupsLoading: boolean;
	onListChange: () => Promise<void>;
	onOpenChange: (open: boolean) => void;
	onPageTabChange?: (
		tab: AdminTeamDetailTab,
		options?: { replace?: boolean },
	) => void;
	onRefreshPolicyGroups: () => Promise<void>;
	pageTab?: AdminTeamDetailTab;
}

const MEMBER_PAGE_SIZE = 10;
const AUDIT_PAGE_SIZE = 10;
const ADMIN_TEAM_DETAIL_TAB_INDEX: Record<AdminTeamDetailTab, number> = {
	overview: 0,
	members: 1,
	audit: 2,
	danger: 3,
};
const adminTeamDetailContentScrollPositions = new Map<number, number>();
const adminTeamDetailSidebarScrollPositions = new Map<number, number>();

function buildPolicyGroupOptions(
	policyGroups: StoragePolicyGroup[],
	selectedPolicyGroupId: number | null,
): PolicyGroupOption[] {
	const options: PolicyGroupOption[] = policyGroups
		.filter((group) => group.is_enabled && group.items.length > 0)
		.map((group) => ({
			label: group.name,
			value: String(group.id),
		}));

	if (
		selectedPolicyGroupId != null &&
		!options.some((option) => option.value === String(selectedPolicyGroupId))
	) {
		const selectedGroup = policyGroups.find(
			(group) => group.id === selectedPolicyGroupId,
		);
		options.unshift({
			label: selectedGroup?.name ?? `#${selectedPolicyGroupId}`,
			value: String(selectedPolicyGroupId),
			disabled: true,
		});
	}

	return options;
}

export function AdminTeamDetailDialog({
	layout = "dialog",
	open,
	teamId,
	policyGroups,
	policyGroupsLoading,
	onListChange,
	onOpenChange,
	onPageTabChange,
	onRefreshPolicyGroups,
	pageTab,
}: AdminTeamDetailDialogProps) {
	const { t } = useTranslation(["admin", "core", "settings"]);
	const isPageLayout = layout === "page";
	const [dialogTab, setDialogTab] = useState<AdminTeamDetailTab>("overview");
	const [pageLayoutTab, setPageLayoutTab] = useState<AdminTeamDetailTab>(
		pageTab ?? "overview",
	);
	const [tabDirection, setTabDirection] = useState<"forward" | "backward">(
		"forward",
	);
	const [archiveConfirmValue, setArchiveConfirmValue] = useState("");
	const [archiving, setArchiving] = useState(false);
	const [auditEntries, setAuditEntries] = useState<TeamAuditEntryInfo[]>([]);
	const [auditLoading, setAuditLoading] = useState(false);
	const [auditOffset, setAuditOffset] = useState(0);
	const [auditTotal, setAuditTotal] = useState(0);
	const [detailLoading, setDetailLoading] = useState(false);
	const [memberIdentifier, setMemberIdentifier] = useState("");
	const [memberLoading, setMemberLoading] = useState(false);
	const [memberMutating, setMemberMutating] = useState(false);
	const [memberOffset, setMemberOffset] = useState(0);
	const [memberTotal, setMemberTotal] = useState(0);
	const [members, setMembers] = useState<TeamMemberInfo[]>([]);
	const [managerCount, setManagerCount] = useState(0);
	const [memberQuery, setMemberQuery] = useState("");
	const [memberRole, setMemberRole] = useState<TeamMemberRole>("member");
	const [memberRoleFilter, setMemberRoleFilter] = useState<
		"__all__" | TeamMemberRole
	>("__all__");
	const [memberStatusFilter, setMemberStatusFilter] = useState<
		"__all__" | UserStatus
	>("__all__");
	const [name, setName] = useState("");
	const [ownerCount, setOwnerCount] = useState(0);
	const [description, setDescription] = useState("");
	const [policyGroupId, setPolicyGroupId] = useState("");
	const [restoring, setRestoring] = useState(false);
	const [saving, setSaving] = useState(false);
	const [team, setTeam] = useState<AdminTeamInfo | null>(null);
	const auditRequestIdRef = useRef(0);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const detailRequestIdRef = useRef(0);
	const memberRequestIdRef = useRef(0);
	const overviewSyncAllowedRef = useRef(true);
	const sidebarRef = useRef<HTMLElement | null>(null);
	const roleOptions: TeamMemberRole[] = ["owner", "admin", "member"];
	const statusFilterOptions = [
		{ label: t("member_status_filter_all"), value: "__all__" },
		{ label: t("core:active"), value: "active" },
		{ label: t("core:disabled_status"), value: "disabled" },
	] satisfies ReadonlyArray<{
		label: string;
		value: "__all__" | UserStatus;
	}>;
	const roleFilterOptions = [
		{ label: t("member_role_filter_all"), value: "__all__" },
		...roleOptions.map((role) => ({
			label: t(`settings:settings_team_role_${role}`),
			value: role,
		})),
	] satisfies ReadonlyArray<{
		label: string;
		value: "__all__" | TeamMemberRole;
	}>;

	const roleLabel = (role: TeamMemberRole) =>
		t(`settings:settings_team_role_${role}`);
	const memberKeyword = memberQuery.trim();
	const memberRoleValue =
		memberRoleFilter === "__all__" ? undefined : memberRoleFilter;
	const memberStatusValue =
		memberStatusFilter === "__all__" ? undefined : memberStatusFilter;

	const loadTeamDetail = useEffectEvent(async (nextTeamId: number) => {
		const requestId = ++detailRequestIdRef.current;
		setDetailLoading(true);
		try {
			const detail = await adminTeamService.get(nextTeamId);
			if (requestId !== detailRequestIdRef.current) {
				return;
			}
			setTeam(detail);
		} catch (error) {
			if (requestId !== detailRequestIdRef.current) {
				return;
			}
			setTeam(null);
			handleApiError(error);
		} finally {
			if (requestId === detailRequestIdRef.current) {
				setDetailLoading(false);
			}
		}
	});

	const loadMembers = useEffectEvent(
		async (
			nextTeamId: number,
			nextOffset = memberOffset,
			nextFilters: {
				keyword?: string;
				role?: TeamMemberRole;
				status?: UserStatus;
			} = {
				keyword: memberKeyword || undefined,
				role: memberRoleValue,
				status: memberStatusValue,
			},
		) => {
			const requestId = ++memberRequestIdRef.current;
			setMemberLoading(true);
			try {
				const page = await adminTeamService.listMembers(nextTeamId, {
					keyword: nextFilters.keyword,
					role: nextFilters.role,
					status: nextFilters.status,
					limit: MEMBER_PAGE_SIZE,
					offset: nextOffset,
				});
				if (requestId !== memberRequestIdRef.current) {
					return;
				}
				setMembers(page.items);
				setMemberTotal(page.total);
				setOwnerCount(page.owner_count);
				setManagerCount(page.manager_count);
			} catch (error) {
				if (requestId !== memberRequestIdRef.current) {
					return;
				}
				setMembers([]);
				setMemberTotal(0);
				setOwnerCount(0);
				setManagerCount(0);
				handleApiError(error);
			} finally {
				if (requestId === memberRequestIdRef.current) {
					setMemberLoading(false);
				}
			}
		},
	);

	const loadAuditEntries = useEffectEvent(
		async (nextTeamId: number, nextOffset = auditOffset) => {
			const requestId = ++auditRequestIdRef.current;
			setAuditLoading(true);
			try {
				const page = await adminTeamService.listAuditLogs(nextTeamId, {
					limit: AUDIT_PAGE_SIZE,
					offset: nextOffset,
				});
				if (requestId !== auditRequestIdRef.current) {
					return;
				}
				setAuditEntries(page.items);
				setAuditTotal(page.total);
			} catch (error) {
				if (requestId !== auditRequestIdRef.current) {
					return;
				}
				setAuditEntries([]);
				setAuditTotal(0);
				handleApiError(error);
			} finally {
				if (requestId === auditRequestIdRef.current) {
					setAuditLoading(false);
				}
			}
		},
	);

	useEffect(() => {
		if (!open || teamId == null) {
			auditRequestIdRef.current += 1;
			detailRequestIdRef.current += 1;
			memberRequestIdRef.current += 1;
			overviewSyncAllowedRef.current = true;
			setArchiveConfirmValue("");
			archiveDialogProps.onOpenChange(false);
			setArchiving(false);
			setAuditEntries([]);
			setAuditLoading(false);
			setAuditOffset(0);
			setAuditTotal(0);
			setDescription("");
			setDetailLoading(false);
			setMemberIdentifier("");
			setMemberLoading(false);
			setMemberMutating(false);
			setMemberOffset(0);
			setMemberTotal(0);
			setMembers([]);
			setManagerCount(0);
			setMemberQuery("");
			setMemberRole("member");
			setMemberRoleFilter("__all__");
			setMemberStatusFilter("__all__");
			setName("");
			setOwnerCount(0);
			setPolicyGroupId("");
			setRestoring(false);
			setSaving(false);
			setTeam(null);
			setDialogTab("overview");
			return;
		}

		overviewSyncAllowedRef.current = true;
		setAuditOffset(0);
		setMemberOffset(0);
		setDialogTab("overview");
		void loadTeamDetail(teamId);
	}, [open, teamId]);

	useLayoutEffect(() => {
		if (!isPageLayout || teamId == null || pageTab == null) {
			return;
		}

		const content = contentRef.current;
		if (content != null) {
			content.scrollTop =
				adminTeamDetailContentScrollPositions.get(teamId) ?? 0;
		}

		const sidebar = sidebarRef.current;
		if (sidebar == null) {
			return () => {
				if (contentRef.current == null) {
					return;
				}

				adminTeamDetailContentScrollPositions.set(
					teamId,
					contentRef.current.scrollTop,
				);
			};
		}

		sidebar.scrollTop = adminTeamDetailSidebarScrollPositions.get(teamId) ?? 0;

		return () => {
			if (contentRef.current != null) {
				adminTeamDetailContentScrollPositions.set(
					teamId,
					contentRef.current.scrollTop,
				);
			}

			if (sidebarRef.current == null) {
				return;
			}

			adminTeamDetailSidebarScrollPositions.set(
				teamId,
				sidebarRef.current.scrollTop,
			);
		};
	}, [isPageLayout, pageTab, teamId]);

	useEffect(() => {
		if (!open || teamId == null) {
			auditRequestIdRef.current += 1;
			setAuditLoading(false);
			return;
		}

		void loadAuditEntries(teamId, auditOffset);
	}, [auditOffset, open, teamId]);

	useEffect(() => {
		if (!open || teamId == null) {
			memberRequestIdRef.current += 1;
			setMemberLoading(false);
			return;
		}

		void loadMembers(teamId, memberOffset, {
			keyword: memberKeyword || undefined,
			role: memberRoleValue,
			status: memberStatusValue,
		});
	}, [
		memberKeyword,
		memberOffset,
		memberRoleValue,
		memberStatusValue,
		open,
		teamId,
	]);

	useEffect(() => {
		setArchiveConfirmValue("");
		if (!overviewSyncAllowedRef.current) {
			return;
		}

		setName(team?.name ?? "");
		setDescription(team?.description ?? "");
		setPolicyGroupId(
			team?.policy_group_id != null ? String(team.policy_group_id) : "",
		);
	}, [team]);

	const handleNameChange = (value: string) => {
		overviewSyncAllowedRef.current = false;
		setName(value);
	};

	const handleDescriptionChange = (value: string) => {
		overviewSyncAllowedRef.current = false;
		setDescription(value);
	};

	const handlePolicyGroupChange = (value: string) => {
		overviewSyncAllowedRef.current = false;
		setPolicyGroupId(value);
	};

	const quota = team?.storage_quota ?? 0;
	const used = team?.storage_used ?? 0;
	const usagePercentage = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;
	const selectedPolicyGroupId = policyGroupId ? Number(policyGroupId) : null;
	const policyGroupOptions = buildPolicyGroupOptions(
		policyGroups,
		selectedPolicyGroupId ?? team?.policy_group_id ?? null,
	);
	const currentPolicyGroup =
		team?.policy_group_id != null
			? (policyGroups.find((group) => group.id === team.policy_group_id) ??
				null)
			: null;
	const selectedPolicyGroup =
		selectedPolicyGroupId != null
			? (policyGroups.find((group) => group.id === selectedPolicyGroupId) ??
				null)
			: null;
	const policyGroupUnavailable =
		!policyGroupsLoading && policyGroupOptions.length === 0;
	const assignedPolicyGroupIsInvalid =
		!policyGroupsLoading &&
		team?.policy_group_id != null &&
		(currentPolicyGroup === null ||
			!currentPolicyGroup.is_enabled ||
			currentPolicyGroup.items.length === 0);
	const canMutateTeam = team != null && team.archived_at == null;
	const hasChanges =
		canMutateTeam &&
		(name.trim() !== team.name ||
			(description.trim() || "") !== team.description ||
			selectedPolicyGroupId !== (team.policy_group_id ?? null));
	const hasMemberFilters =
		memberKeyword.length > 0 ||
		memberRoleFilter !== "__all__" ||
		memberStatusFilter !== "__all__";
	const memberTotalPages = Math.max(
		1,
		Math.ceil(memberTotal / MEMBER_PAGE_SIZE),
	);
	const memberCurrentPage = Math.floor(memberOffset / MEMBER_PAGE_SIZE) + 1;
	const prevMemberPageDisabled = memberOffset === 0;
	const nextMemberPageDisabled = memberOffset + MEMBER_PAGE_SIZE >= memberTotal;
	const auditTotalPages = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE));
	const auditCurrentPage = Math.floor(auditOffset / AUDIT_PAGE_SIZE) + 1;
	const prevAuditPageDisabled = auditOffset === 0;
	const nextAuditPageDisabled = auditOffset + AUDIT_PAGE_SIZE >= auditTotal;

	useEffect(() => {
		if (memberOffset < memberTotal || memberTotal === 0) {
			return;
		}

		setMemberOffset(Math.max(0, (memberTotalPages - 1) * MEMBER_PAGE_SIZE));
	}, [memberOffset, memberTotal, memberTotalPages]);

	useEffect(() => {
		if (!isPageLayout || pageTab == null || pageLayoutTab === pageTab) {
			return;
		}

		setTabDirection(
			ADMIN_TEAM_DETAIL_TAB_INDEX[pageTab] >=
				ADMIN_TEAM_DETAIL_TAB_INDEX[pageLayoutTab]
				? "forward"
				: "backward",
		);
		setPageLayoutTab(pageTab);
	}, [isPageLayout, pageLayoutTab, pageTab]);

	const handleSave = async () => {
		if (!team || !canMutateTeam) {
			return;
		}

		const nextName = name.trim();
		const nextPolicyGroupId = Number(policyGroupId);
		if (!nextName || !Number.isFinite(nextPolicyGroupId)) {
			return;
		}

		try {
			setSaving(true);
			overviewSyncAllowedRef.current = true;
			await adminTeamService.update(team.id, {
				name: nextName,
				description: description.trim() || undefined,
				policy_group_id: nextPolicyGroupId,
			});
			await Promise.all([
				loadTeamDetail(team.id),
				loadAuditEntries(team.id),
				onListChange(),
			]);
			toast.success(t("team_updated"));
		} catch (error) {
			handleApiError(error);
		} finally {
			setSaving(false);
		}
	};

	const handleArchive = async () => {
		if (!team || !canMutateTeam) {
			return;
		}

		try {
			setArchiving(true);
			overviewSyncAllowedRef.current = true;
			await adminTeamService.delete(team.id);
			await Promise.all([
				loadTeamDetail(team.id),
				loadAuditEntries(team.id),
				onListChange(),
			]);
			archiveDialogProps.onOpenChange(false);
			toast.success(t("team_deleted"));
		} catch (error) {
			handleApiError(error);
		} finally {
			setArchiving(false);
		}
	};

	const handleRestore = async () => {
		if (!team || team.archived_at == null) {
			return;
		}

		try {
			setRestoring(true);
			overviewSyncAllowedRef.current = true;
			await adminTeamService.restore(team.id);
			await Promise.all([
				loadTeamDetail(team.id),
				loadAuditEntries(team.id),
				onListChange(),
			]);
			toast.success(t("team_restored"));
		} catch (error) {
			handleApiError(error);
		} finally {
			setRestoring(false);
		}
	};

	const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (teamId == null || !canMutateTeam) {
			return;
		}

		const identifier = memberIdentifier.trim();
		if (!identifier) {
			return;
		}

		try {
			setMemberMutating(true);
			await adminTeamService.addMember(teamId, {
				identifier,
				role: memberRole,
			});
			setMemberIdentifier("");
			setMemberRole("member");
			setMemberOffset(0);
			await Promise.all([
				loadTeamDetail(teamId),
				loadMembers(teamId, 0),
				loadAuditEntries(teamId),
				onListChange(),
			]);
			toast.success(t("settings:settings_team_member_added"));
		} catch (error) {
			handleApiError(error);
		} finally {
			setMemberMutating(false);
		}
	};

	const handleUpdateMemberRole = async (
		memberUserId: number,
		role: TeamMemberRole,
	) => {
		if (teamId == null || !canMutateTeam) {
			return;
		}

		try {
			setMemberMutating(true);
			await adminTeamService.updateMember(teamId, memberUserId, { role });
			await Promise.all([
				loadTeamDetail(teamId),
				loadMembers(teamId, memberOffset),
				loadAuditEntries(teamId),
				onListChange(),
			]);
			toast.success(t("settings:settings_team_member_role_updated"));
		} catch (error) {
			handleApiError(error);
		} finally {
			setMemberMutating(false);
		}
	};

	const handleRemoveMember = async (memberUserId: number) => {
		if (teamId == null || !canMutateTeam) {
			return;
		}

		try {
			setMemberMutating(true);
			await adminTeamService.removeMember(teamId, memberUserId);
			await Promise.all([
				loadTeamDetail(teamId),
				loadMembers(teamId, memberOffset),
				loadAuditEntries(teamId),
				onListChange(),
			]);
			toast.success(t("settings:settings_team_member_removed"));
		} catch (error) {
			handleApiError(error);
		} finally {
			setMemberMutating(false);
		}
	};

	const {
		confirmId: removeMemberId,
		requestConfirm: requestRemoveConfirm,
		dialogProps: removeDialogProps,
	} = useConfirmDialog(handleRemoveMember);
	const {
		requestConfirm: requestArchiveConfirm,
		dialogProps: archiveDialogProps,
	} = useConfirmDialog<true>(handleArchive);
	const removeMember =
		members.find((member) => member.user_id === removeMemberId) ?? null;

	if (teamId == null) {
		return null;
	}

	const currentTab = isPageLayout ? pageLayoutTab : dialogTab;
	const panelAnimationClass =
		tabDirection === "forward"
			? "animate-in fade-in duration-300 slide-in-from-right-4 motion-reduce:animate-none"
			: "animate-in fade-in duration-300 slide-in-from-left-4 motion-reduce:animate-none";

	const handleTabChange = (value: string) => {
		if (
			value === "overview" ||
			value === "members" ||
			value === "audit" ||
			value === "danger"
		) {
			if (isPageLayout) {
				if (value === currentTab) {
					return;
				}

				setTabDirection(
					ADMIN_TEAM_DETAIL_TAB_INDEX[value] >=
						ADMIN_TEAM_DETAIL_TAB_INDEX[currentTab]
						? "forward"
						: "backward",
				);
				setPageLayoutTab(value);
				onPageTabChange?.(value);
			} else {
				setDialogTab(value);
			}
		}
	};

	const handleDialogOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			archiveDialogProps.onOpenChange(false);
		}
		onOpenChange(nextOpen);
	};
	const handleArchiveDialogOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			requestArchiveConfirm(true);
			return;
		}
		archiveDialogProps.onOpenChange(false);
	};

	const handleContentScroll = () => {
		if (teamId == null || contentRef.current == null) {
			return;
		}

		adminTeamDetailContentScrollPositions.set(
			teamId,
			contentRef.current.scrollTop,
		);
	};

	const handleSidebarScroll = () => {
		if (teamId == null || sidebarRef.current == null) {
			return;
		}

		adminTeamDetailSidebarScrollPositions.set(
			teamId,
			sidebarRef.current.scrollTop,
		);
	};

	const overviewSection = (
		<AdminTeamDetailOverviewSection
			archiving={archiving}
			assignedPolicyGroupIsInvalid={assignedPolicyGroupIsInvalid}
			canMutateTeam={canMutateTeam}
			description={description}
			detailLoading={detailLoading}
			hasChanges={hasChanges}
			name={name}
			onDescriptionChange={handleDescriptionChange}
			onNameChange={handleNameChange}
			onPolicyGroupChange={handlePolicyGroupChange}
			onRefreshPolicyGroups={onRefreshPolicyGroups}
			onSave={handleSave}
			policyGroupId={policyGroupId}
			policyGroupOptions={policyGroupOptions}
			policyGroupUnavailable={policyGroupUnavailable}
			policyGroupsLoading={policyGroupsLoading}
			restoring={restoring}
			saving={saving}
			team={team}
		/>
	);

	const membersSection = (
		<AdminTeamDetailMembersSection
			canMutateTeam={canMutateTeam}
			hasMemberFilters={hasMemberFilters}
			managerCount={managerCount}
			memberCurrentPage={memberCurrentPage}
			memberIdentifier={memberIdentifier}
			memberLoading={memberLoading}
			memberMutating={memberMutating}
			memberOffset={memberOffset}
			memberQuery={memberQuery}
			memberRole={memberRole}
			memberRoleFilter={memberRoleFilter}
			memberStatusFilter={memberStatusFilter}
			memberTotal={memberTotal}
			memberTotalPages={memberTotalPages}
			members={members}
			nextMemberPageDisabled={nextMemberPageDisabled}
			ownerCount={ownerCount}
			prevMemberPageDisabled={prevMemberPageDisabled}
			requestRemoveConfirm={requestRemoveConfirm}
			roleFilterOptions={roleFilterOptions}
			roleLabel={roleLabel}
			roleOptions={roleOptions}
			setMemberIdentifier={setMemberIdentifier}
			setMemberOffset={setMemberOffset}
			setMemberQuery={setMemberQuery}
			setMemberRole={setMemberRole}
			setMemberRoleFilter={setMemberRoleFilter}
			setMemberStatusFilter={setMemberStatusFilter}
			statusFilterOptions={statusFilterOptions}
			team={team}
			onAddMember={handleAddMember}
			onUpdateMemberRole={handleUpdateMemberRole}
		/>
	);

	const auditSection = (
		<AdminTeamDetailAuditSection
			auditCurrentPage={auditCurrentPage}
			auditEntries={auditEntries}
			auditLoading={auditLoading}
			auditOffset={auditOffset}
			auditTotal={auditTotal}
			auditTotalPages={auditTotalPages}
			nextAuditPageDisabled={nextAuditPageDisabled}
			prevAuditPageDisabled={prevAuditPageDisabled}
			roleLabel={roleLabel}
			setAuditOffset={setAuditOffset}
		/>
	);

	const dangerSection = (
		<AdminTeamDetailDangerSection
			archiveConfirmValue={archiveConfirmValue}
			archiving={archiving}
			detailLoading={detailLoading}
			managerCount={managerCount}
			ownerCount={ownerCount}
			restoring={restoring}
			setArchiveConfirmValue={setArchiveConfirmValue}
			setArchiveDialogOpen={handleArchiveDialogOpenChange}
			team={team}
			onRestore={handleRestore}
		/>
	);

	return (
		<>
			<AdminTeamDetailShell
				auditSection={auditSection}
				contentRef={contentRef}
				currentPolicyGroupName={currentPolicyGroup?.name ?? null}
				currentTab={currentTab}
				dangerSection={dangerSection}
				isPageLayout={isPageLayout}
				membersSection={membersSection}
				onContentScroll={handleContentScroll}
				onOpenChange={handleDialogOpenChange}
				onPageBack={() => onOpenChange(false)}
				onSidebarScroll={handleSidebarScroll}
				onTabChange={handleTabChange}
				open={open}
				overviewSection={overviewSection}
				ownerCount={ownerCount}
				managerCount={managerCount}
				panelAnimationClass={panelAnimationClass}
				quota={quota}
				selectedPolicyGroupName={selectedPolicyGroup?.name ?? null}
				sidebarRef={sidebarRef}
				team={team}
				usagePercentage={usagePercentage}
				used={used}
			/>

			<ConfirmDialog
				{...removeDialogProps}
				title={t("settings:settings_team_remove_member")}
				description={
					removeMember
						? `${t("settings:settings_team_remove_member_desc")} @${removeMember.username}`
						: t("settings:settings_team_remove_member_desc")
				}
				confirmLabel={t("settings:settings_team_remove_member")}
				variant="destructive"
			/>

			<ConfirmDialog
				{...archiveDialogProps}
				title={team ? `${t("delete_team")} "${team.name}"?` : t("delete_team")}
				description={t("archive_team_desc")}
				confirmLabel={t("core:delete")}
				variant="destructive"
			/>
		</>
	);
}
