import { useCallback, useEffect, useState } from "react";
import {
	getAdminTeamDetailPanelAnimationClass,
	getAdminTeamDetailTabDirection,
	isAdminTeamDetailTab,
} from "./adminTeamDetailDialogState";
import type { AdminTeamDetailTab } from "./types";

interface UseAdminTeamDetailTabsArgs {
	isPageLayout: boolean;
	onPageTabChange?: (
		tab: AdminTeamDetailTab,
		options?: { replace?: boolean },
	) => void;
	pageTab?: AdminTeamDetailTab;
}

export function useAdminTeamDetailTabs({
	isPageLayout,
	onPageTabChange,
	pageTab,
}: UseAdminTeamDetailTabsArgs) {
	const [dialogTab, setDialogTab] = useState<AdminTeamDetailTab>("overview");
	const [pageLayoutTab, setPageLayoutTab] = useState<AdminTeamDetailTab>(
		pageTab ?? "overview",
	);
	const [tabDirection, setTabDirection] = useState<"forward" | "backward">(
		"forward",
	);
	const currentTab = isPageLayout ? pageLayoutTab : dialogTab;
	const panelAnimationClass =
		getAdminTeamDetailPanelAnimationClass(tabDirection);

	useEffect(() => {
		if (!isPageLayout || pageTab == null || pageLayoutTab === pageTab) {
			return;
		}

		setTabDirection(getAdminTeamDetailTabDirection(pageTab, pageLayoutTab));
		setPageLayoutTab(pageTab);
	}, [isPageLayout, pageLayoutTab, pageTab]);

	const resetDialogTab = useCallback(() => {
		setDialogTab("overview");
	}, []);

	const handleTabChange = (value: string) => {
		if (!isAdminTeamDetailTab(value)) {
			return;
		}

		if (isPageLayout) {
			if (value === currentTab) {
				return;
			}

			setTabDirection(getAdminTeamDetailTabDirection(value, currentTab));
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
