import { pickLocalizedLabel } from "@/lib/localizedLabel";
import {
	formatPreviewAppsDelimitedInput,
	getPreviewAppDefaultIcon,
	isExternalPreviewAppKey,
	type PreviewAppProviderValue,
	type PreviewAppsEditorApp,
} from "../previewAppsConfigEditorShared";

type Translate = (
	key: string,
	values?: Record<string, number | string>,
) => string;

export function getProviderDefaultIcon(
	key: string,
	provider?: PreviewAppProviderValue | null,
) {
	return getPreviewAppDefaultIcon(key, provider);
}

export function getLocalizedAppLabel(
	app: PreviewAppsEditorApp,
	language: string | undefined,
) {
	return pickLocalizedLabel(app.labels, language) || app.key.trim();
}

export function getAppHeading(
	app: PreviewAppsEditorApp,
	index: number,
	language: string | undefined,
	t: Translate,
) {
	return (
		getLocalizedAppLabel(app, language) ||
		t("preview_apps_app_title", { index: index + 1 })
	);
}

export function isInternalPreviewApp(app: PreviewAppsEditorApp) {
	return !isExternalPreviewAppKey(app.key);
}

export function getExtensionSummary(app: PreviewAppsEditorApp, t: Translate) {
	if (app.extensions.length === 0) {
		return t("preview_apps_extensions_any");
	}

	return formatPreviewAppsDelimitedInput(app.extensions);
}

export function getAppSummary(app: PreviewAppsEditorApp, t: Translate) {
	return getExtensionSummary(app, t);
}

export function moveActiveAppIndex(
	current: number | null,
	index: number,
	direction: -1 | 1,
	itemCount: number,
) {
	if (current === null) {
		return null;
	}

	const targetIndex = index + direction;
	if (targetIndex < 0 || targetIndex >= itemCount) {
		return current;
	}

	if (current === index) {
		return targetIndex;
	}

	if (current === targetIndex) {
		return index;
	}

	return current;
}
