import { type ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ColorPresetPicker } from "@/components/common/ColorPresetPicker";
import {
	SettingsChoiceGroup,
	SettingsPageIntro,
	SettingsRow,
	SettingsSection,
} from "@/components/common/SettingsScaffold";
import { UserAvatarImage } from "@/components/common/UserAvatarImage";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import type { IconName } from "@/components/ui/icon";
import { handleApiError } from "@/hooks/useApiError";
import { queuePreferenceSync } from "@/lib/preferenceSync";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";
import { useFileStore } from "@/stores/fileStore";
import { useThemeStore } from "@/stores/themeStore";

type ThemeMode = "light" | "dark" | "system";
type ViewMode = "list" | "grid";

export default function SettingsPage() {
	const { t, i18n } = useTranslation(["core", "files", "settings"]);
	const { mode, setMode } = useThemeStore();
	const viewMode = useFileStore((s) => s.viewMode);
	const setViewMode = useFileStore((s) => s.setViewMode);
	const user = useAuthStore((s) => s.user);
	const refreshUser = useAuthStore((s) => s.refreshUser);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [avatarBusy, setAvatarBusy] = useState(false);

	const themeOptions: Array<{
		value: ThemeMode;
		label: string;
		icon: IconName;
	}> = [
		{ value: "light", label: t("theme_light"), icon: "Sun" },
		{ value: "dark", label: t("theme_dark"), icon: "Moon" },
		{ value: "system", label: t("theme_system"), icon: "Monitor" },
	];

	const languageOptions: Array<{
		value: "en" | "zh";
		label: string;
		icon: IconName;
	}> = [
		{ value: "en", label: t("language_en"), icon: "Globe" },
		{ value: "zh", label: t("language_zh"), icon: "Globe" },
	];

	const browserOptions: Array<{
		value: ViewMode;
		label: string;
		icon: IconName;
	}> = [
		{ value: "list", label: t("files:list_view"), icon: "ListBullets" },
		{ value: "grid", label: t("files:grid_view"), icon: "Grid" },
	];
	const currentLanguage = i18n.language?.startsWith("zh") ? "zh" : "en";
	const themeDescriptions: Record<ThemeMode, string> = {
		light: t("settings:settings_theme_light_desc"),
		dark: t("settings:settings_theme_dark_desc"),
		system: t("settings:settings_theme_system_desc"),
	};
	const languageDescriptions = {
		en: t("settings:settings_language_en_desc"),
		zh: t("settings:settings_language_zh_desc"),
	};
	const browserDescriptions: Record<ViewMode, string> = {
		list: t("settings:settings_browser_list_desc"),
		grid: t("settings:settings_browser_grid_desc"),
	};
	const avatarSource = user?.profile.avatar.source ?? "none";
	const avatarDescription =
		avatarSource === "gravatar"
			? t("settings:settings_avatar_gravatar_desc")
			: avatarSource === "upload"
				? t("settings:settings_avatar_upload_desc")
				: t("settings:settings_avatar_none_desc");

	const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		try {
			setAvatarBusy(true);
			await authService.uploadAvatar(file);
			await refreshUser();
			toast.success(t("settings:settings_avatar_updated"));
		} catch (error) {
			handleApiError(error);
		} finally {
			setAvatarBusy(false);
		}
	};

	const updateAvatarSource = async (source: "none" | "gravatar") => {
		try {
			setAvatarBusy(true);
			await authService.setAvatarSource(source);
			await refreshUser();
			toast.success(t("settings:settings_avatar_source_updated"));
		} catch (error) {
			handleApiError(error);
		} finally {
			setAvatarBusy(false);
		}
	};

	return (
		<AppLayout>
			<div className="min-h-0 flex-1 overflow-auto">
				<div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
					<SettingsPageIntro
						title={t("settings")}
						description={t("settings:settings_page_desc")}
					/>

					<div className="space-y-4">
						<SettingsSection
							title={t("settings:settings_profile")}
							description={t("settings:settings_profile_desc")}
						>
							<SettingsRow
								label={t("settings:settings_avatar")}
								description={avatarDescription}
							>
								<div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4 md:flex-row md:items-center">
									<UserAvatarImage
										avatar={user?.profile.avatar ?? null}
										name={user?.username ?? "user"}
										size="lg"
									/>
									<div className="flex flex-wrap gap-2">
										<input
											ref={fileInputRef}
											type="file"
											accept="image/*"
											className="hidden"
											onChange={handleAvatarUpload}
										/>
										<Button
											type="button"
											variant="outline"
											disabled={avatarBusy}
											onClick={() => fileInputRef.current?.click()}
										>
											{t("files:upload")}
										</Button>
										<Button
											type="button"
											variant="outline"
											disabled={avatarBusy}
											onClick={() => void updateAvatarSource("gravatar")}
										>
											{t("settings:settings_use_gravatar")}
										</Button>
										<Button
											type="button"
											variant="ghost"
											disabled={avatarBusy}
											onClick={() => void updateAvatarSource("none")}
										>
											{t("settings:settings_remove_avatar")}
										</Button>
									</div>
								</div>
							</SettingsRow>
						</SettingsSection>

						<SettingsSection
							title={t("theme")}
							description={t("appearance_desc")}
						>
							<SettingsRow
								label={t("mode")}
								description={themeDescriptions[mode]}
							>
								<SettingsChoiceGroup
									options={themeOptions}
									value={mode}
									onChange={setMode}
								/>
							</SettingsRow>
							<SettingsRow
								label={t("color")}
								description={t("settings:settings_color_desc")}
							>
								<div className="rounded-xl border bg-muted/20 p-3">
									<ColorPresetPicker />
								</div>
							</SettingsRow>
							<SettingsRow
								label={t("language")}
								description={languageDescriptions[currentLanguage]}
							>
								<SettingsChoiceGroup
									options={languageOptions}
									value={currentLanguage}
									onChange={(value) => {
										void i18n.changeLanguage(value);
										queuePreferenceSync({ language: value });
									}}
								/>
							</SettingsRow>
						</SettingsSection>

						<SettingsSection
							title={t("file_browser")}
							description={t("file_browser_desc")}
						>
							<SettingsRow
								label={t("mode")}
								description={browserDescriptions[viewMode]}
							>
								<SettingsChoiceGroup
									options={browserOptions}
									value={viewMode}
									onChange={setViewMode}
								/>
							</SettingsRow>
						</SettingsSection>
					</div>
				</div>
			</div>
		</AppLayout>
	);
}
