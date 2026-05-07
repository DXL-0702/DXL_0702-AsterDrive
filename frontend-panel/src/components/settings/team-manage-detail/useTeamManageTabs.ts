import { useCallback, useEffect, useState } from "react";
import {
	getTeamManagePanelAnimationClass,
	getTeamManageTabDirection,
	isTeamManageTab,
	isTeamManageTabAllowed,
} from "./teamManageDialogState";
import type { TeamManageTab } from "./types";

interface UseTeamManageTabsArgs {
	canArchiveTeam: boolean;
	canManageTeam: boolean;
	detailLoading: boolean;
	detailRequestStarted: boolean;
	isPageLayout: boolean;
	onPageTabChange?: (
		tab: TeamManageTab,
		options?: { replace?: boolean },
	) => void;
	pageTab?: TeamManageTab;
}

export function useTeamManageTabs({
	canArchiveTeam,
	canManageTeam,
	detailLoading,
	detailRequestStarted,
	isPageLayout,
	onPageTabChange,
	pageTab,
}: UseTeamManageTabsArgs) {
	const [dialogTab, setDialogTab] = useState<TeamManageTab>("overview");
	const [pageLayoutTab, setPageLayoutTab] = useState<TeamManageTab>(
		pageTab ?? "overview",
	);
	const [tabDirection, setTabDirection] = useState<"forward" | "backward">(
		"forward",
	);
	const currentTab = isPageLayout ? pageLayoutTab : dialogTab;
	const panelAnimationClass = getTeamManagePanelAnimationClass(tabDirection);

	useEffect(() => {
		if (!isPageLayout || pageTab == null || pageLayoutTab === pageTab) {
			return;
		}

		setTabDirection(getTeamManageTabDirection(pageTab, pageLayoutTab));
		setPageLayoutTab(pageTab);
	}, [isPageLayout, pageLayoutTab, pageTab]);

	useEffect(() => {
		if (isTeamManageTabAllowed(dialogTab, canManageTeam, canArchiveTeam)) {
			return;
		}

		setDialogTab("overview");
	}, [canArchiveTeam, canManageTeam, dialogTab]);

	useEffect(() => {
		if (
			!isPageLayout ||
			pageTab == null ||
			onPageTabChange == null ||
			detailLoading ||
			!detailRequestStarted ||
			isTeamManageTabAllowed(pageTab, canManageTeam, canArchiveTeam)
		) {
			return;
		}

		onPageTabChange("overview", { replace: true });
	}, [
		canArchiveTeam,
		canManageTeam,
		detailLoading,
		detailRequestStarted,
		isPageLayout,
		onPageTabChange,
		pageTab,
	]);

	const resetDialogTab = useCallback(() => {
		setDialogTab("overview");
	}, []);

	const handleTabChange = (value: string) => {
		if (
			!isTeamManageTab(value) ||
			!isTeamManageTabAllowed(value, canManageTeam, canArchiveTeam)
		) {
			return;
		}

		if (isPageLayout) {
			if (value === currentTab) {
				return;
			}

			setTabDirection(getTeamManageTabDirection(value, currentTab));
			setPageLayoutTab(value);
			onPageTabChange?.(value);
			return;
		}

		setDialogTab(value);
	};

	return {
		currentTab,
		handleTabChange,
		panelAnimationClass,
		resetDialogTab,
	};
}
