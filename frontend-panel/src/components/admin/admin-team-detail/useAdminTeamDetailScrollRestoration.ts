import { type RefObject, useLayoutEffect } from "react";
import {
	adminTeamDetailContentScrollPositions,
	adminTeamDetailSidebarScrollPositions,
} from "./adminTeamDetailDialogState";
import type { AdminTeamDetailTab } from "./types";

interface UseAdminTeamDetailScrollRestorationArgs {
	contentRef: RefObject<HTMLDivElement | null>;
	isPageLayout: boolean;
	pageTab?: AdminTeamDetailTab;
	sidebarRef: RefObject<HTMLElement | null>;
	teamId: number | null;
}

export function useAdminTeamDetailScrollRestoration({
	contentRef,
	isPageLayout,
	pageTab,
	sidebarRef,
	teamId,
}: UseAdminTeamDetailScrollRestorationArgs) {
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
	}, [contentRef, isPageLayout, pageTab, sidebarRef, teamId]);
}
