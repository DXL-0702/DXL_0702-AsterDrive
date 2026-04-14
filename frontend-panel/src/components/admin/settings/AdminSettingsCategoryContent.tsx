import type { AdminSettingsCategoryContentProps } from "@/components/admin/settings/AdminSettingsCategoryContentContext";
import { AdminSettingsCategoryContentProvider } from "@/components/admin/settings/AdminSettingsCategoryContentContext";
import { AdminSettingsCustomCategorySection } from "@/components/admin/settings/AdminSettingsCustomCategorySection";
import { AdminSettingsSystemCategorySection } from "@/components/admin/settings/AdminSettingsSystemCategorySection";

export function AdminSettingsCategoryContent(
	props: AdminSettingsCategoryContentProps,
) {
	const panelAnimationClass =
		props.tabDirection === "forward"
			? "animate-in fade-in duration-300 slide-in-from-right-4 motion-reduce:animate-none"
			: "animate-in fade-in duration-300 slide-in-from-left-4 motion-reduce:animate-none";
	const showCategoryHeader = !props.isMobileNavigation;

	return (
		<AdminSettingsCategoryContentProvider value={props}>
			{props.category === "custom" ? (
				<AdminSettingsCustomCategorySection
					category={props.category}
					panelAnimationClass={panelAnimationClass}
					showCategoryHeader={showCategoryHeader}
				/>
			) : (
				<AdminSettingsSystemCategorySection
					category={props.category}
					panelAnimationClass={panelAnimationClass}
					showCategoryHeader={showCategoryHeader}
				/>
			)}
		</AdminSettingsCategoryContentProvider>
	);
}
