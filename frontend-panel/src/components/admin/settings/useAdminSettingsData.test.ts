import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	PREVIEW_APP_PROTECTED_BUILTIN_KEYS,
	PREVIEW_APPS_CONFIG_KEY,
} from "@/components/admin/previewAppsConfigEditorShared";
import { useAdminSettingsData } from "@/components/admin/settings/useAdminSettingsData";
import type { SystemConfig } from "@/types/api";

const mockState = vi.hoisted(() => ({
	actionConfig: vi.fn(),
	deleteConfig: vi.fn(),
	handleApiError: vi.fn(),
	listConfigs: vi.fn(),
	previewInvalidate: vi.fn(),
	previewLoad: vi.fn(),
	schema: vi.fn(),
	sendTestEmail: vi.fn(),
	setConfig: vi.fn(),
	templateVariables: vi.fn(),
	toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: {
		success: (...args: unknown[]) => mockState.toastSuccess(...args),
	},
}));

vi.mock("@/hooks/useApiError", () => ({
	handleApiError: (...args: unknown[]) => mockState.handleApiError(...args),
}));

vi.mock("@/services/adminService", () => ({
	adminConfigService: {
		action: (...args: unknown[]) => mockState.actionConfig(...args),
		delete: (...args: unknown[]) => mockState.deleteConfig(...args),
		list: (...args: unknown[]) => mockState.listConfigs(...args),
		sendTestEmail: (...args: unknown[]) => mockState.sendTestEmail(...args),
		schema: (...args: unknown[]) => mockState.schema(...args),
		set: (...args: unknown[]) => mockState.setConfig(...args),
		templateVariables: (...args: unknown[]) =>
			mockState.templateVariables(...args),
	},
}));

vi.mock("@/stores/previewAppStore", () => {
	const usePreviewAppStore = Object.assign(vi.fn(), {
		getState: () => ({
			invalidate: mockState.previewInvalidate,
			load: mockState.previewLoad,
		}),
	});

	return { usePreviewAppStore };
});

const translationMap: Record<string, string> = {
	custom_config_key_duplicate: "custom_config_key_duplicate",
	custom_config_key_required: "custom_config_key_required",
	settings_saved: "settings_saved",
};

function t(key: string) {
	return translationMap[key] ?? key;
}

function createConfig(overrides: Partial<SystemConfig> = {}): SystemConfig {
	return {
		category: "general",
		description: "",
		is_sensitive: false,
		key: "public_site_url",
		requires_restart: false,
		source: "system",
		value: "https://old.example.com",
		value_type: "string",
		...overrides,
	} as SystemConfig;
}

function createValidPreviewAppsConfig(
	extraApps: Record<string, unknown>[] = [],
) {
	return JSON.stringify(
		{
			version: 2,
			apps: [
				...PREVIEW_APP_PROTECTED_BUILTIN_KEYS.map((key) => ({
					enabled: true,
					key,
					labels: {
						en: key,
					},
					provider: "builtin",
				})),
				...extraApps,
			],
		},
		null,
		2,
	);
}

function createBaseConfigs() {
	return [
		createConfig(),
		createConfig({
			category: "custom",
			key: "custom.theme",
			source: "custom",
			value: "ocean",
		}),
		createConfig({
			category: "general.preview",
			key: PREVIEW_APPS_CONFIG_KEY,
			value: createValidPreviewAppsConfig(),
			value_type: "multiline",
		}),
	];
}

function getConfigCategory(key: string) {
	if (key.startsWith("custom")) return "custom";
	if (key === PREVIEW_APPS_CONFIG_KEY) return "general.preview";
	return "general";
}

function renderUseAdminSettingsData() {
	const onPublicSiteUrlChanged = vi.fn();
	const hook = renderHook(() =>
		useAdminSettingsData({
			currentUserEmail: "admin@example.com",
			onPublicSiteUrlChanged,
			t,
		}),
	);

	return {
		...hook,
		onPublicSiteUrlChanged,
	};
}

describe("useAdminSettingsData", () => {
	beforeEach(() => {
		mockState.actionConfig.mockReset();
		mockState.deleteConfig.mockReset();
		mockState.handleApiError.mockReset();
		mockState.listConfigs.mockReset();
		mockState.previewInvalidate.mockReset();
		mockState.previewLoad.mockReset();
		mockState.schema.mockReset();
		mockState.sendTestEmail.mockReset();
		mockState.setConfig.mockReset();
		mockState.templateVariables.mockReset();
		mockState.toastSuccess.mockReset();

		mockState.listConfigs.mockResolvedValue({
			items: createBaseConfigs(),
		});
		mockState.schema.mockResolvedValue([]);
		mockState.templateVariables.mockResolvedValue([]);
		mockState.previewLoad.mockResolvedValue(undefined);
		mockState.deleteConfig.mockResolvedValue(undefined);
		mockState.setConfig.mockImplementation((key: string, value: string) =>
			Promise.resolve(
				createConfig({
					category: getConfigCategory(key),
					key,
					source: key.startsWith("custom") ? "custom" : "system",
					value,
					value_type: key === PREVIEW_APPS_CONFIG_KEY ? "multiline" : "string",
				}),
			),
		);
	});

	it("validates staged custom rows for required and duplicate keys", async () => {
		const { result } = renderUseAdminSettingsData();

		await waitFor(() => expect(result.current.loading).toBe(false));

		act(() => {
			result.current.appendCustomDraftRow();
		});

		const [firstRow] = result.current.newCustomRows;
		expect(firstRow).toBeDefined();

		act(() => {
			result.current.updateNewCustomRow(firstRow.id, "value", "hello");
		});

		expect(result.current.newCustomRowErrors.get(firstRow.id)).toBe(
			"custom_config_key_required",
		);

		act(() => {
			result.current.appendCustomDraftRow();
		});

		const [, secondRow] = result.current.newCustomRows;
		expect(secondRow).toBeDefined();

		act(() => {
			result.current.updateNewCustomRow(secondRow.id, "key", "custom.theme");
			result.current.updateNewCustomRow(secondRow.id, "value", "sunset");
		});

		expect(result.current.changedCount).toBe(2);
		expect(result.current.hasValidationError).toBe(true);
		expect(result.current.newCustomRowErrors.get(secondRow.id)).toBe(
			"custom_config_key_duplicate",
		);

		await act(async () => {
			await result.current.handleSaveAll();
		});

		expect(mockState.setConfig).not.toHaveBeenCalled();
		expect(mockState.deleteConfig).not.toHaveBeenCalled();
	});

	it("surfaces preview app parse issues for invalid drafts", async () => {
		const { result } = renderUseAdminSettingsData();

		await waitFor(() => expect(result.current.loading).toBe(false));

		act(() => {
			result.current.updateDraftValue(PREVIEW_APPS_CONFIG_KEY, "{");
		});

		expect(result.current.changedCount).toBe(1);
		expect(result.current.hasValidationError).toBe(true);
		expect(result.current.previewAppsValidationIssues).toEqual([
			{ key: "preview_apps_error_parse" },
		]);
	});

	it("saves changes, syncs public site url, and invalidates preview apps when preview config changes", async () => {
		const { onPublicSiteUrlChanged, result } = renderUseAdminSettingsData();

		await waitFor(() => expect(result.current.loading).toBe(false));

		const nextPreviewValue = createValidPreviewAppsConfig([
			{
				config: {
					allowed_origins: ["https://viewer.example.com"],
					mode: "iframe",
					url_template:
						"https://viewer.example.com/embed?src={{file_preview_url}}",
				},
				enabled: true,
				extensions: ["md"],
				icon: "https://viewer.example.com/icon.svg",
				key: "custom.viewer",
				labels: {
					en: "Viewer",
				},
				provider: "url_template",
			},
		]);

		act(() => {
			result.current.updateDraftValue(
				"public_site_url",
				"https://next.example.com",
			);
			result.current.updateDraftValue(
				PREVIEW_APPS_CONFIG_KEY,
				nextPreviewValue,
			);
			result.current.markCustomDeleted("custom.theme");
			result.current.appendCustomDraftRow();
		});

		const [newRow] = result.current.newCustomRows;
		expect(newRow).toBeDefined();

		act(() => {
			result.current.updateNewCustomRow(newRow.id, "key", "custom.accent");
			result.current.updateNewCustomRow(newRow.id, "value", "sunset");
		});

		await act(async () => {
			await result.current.handleSaveAll();
		});

		expect(mockState.deleteConfig).toHaveBeenCalledWith("custom.theme");
		expect(mockState.setConfig).toHaveBeenCalledWith(
			"public_site_url",
			"https://next.example.com",
		);
		expect(mockState.setConfig).toHaveBeenCalledWith(
			PREVIEW_APPS_CONFIG_KEY,
			nextPreviewValue,
		);
		expect(mockState.setConfig).toHaveBeenCalledWith("custom.accent", "sunset");
		expect(onPublicSiteUrlChanged).toHaveBeenCalledWith(
			"https://next.example.com",
		);
		expect(mockState.previewInvalidate).toHaveBeenCalledTimes(1);
		expect(mockState.previewLoad).toHaveBeenCalledWith({ force: true });
		expect(mockState.toastSuccess).toHaveBeenCalledWith("settings_saved");

		await waitFor(() => {
			expect(result.current.hasUnsavedChanges).toBe(false);
		});

		expect(
			result.current.visibleCustomConfigs.map((config) => config.key),
		).toEqual(["custom.accent"]);
	});

	it("reloads configs after save failure and reports the error", async () => {
		const error = new Error("save failed");
		mockState.setConfig.mockRejectedValueOnce(error);

		const { onPublicSiteUrlChanged, result } = renderUseAdminSettingsData();

		await waitFor(() => expect(result.current.loading).toBe(false));

		act(() => {
			result.current.updateDraftValue(
				"public_site_url",
				"https://broken.example.com",
			);
		});

		await act(async () => {
			await result.current.handleSaveAll();
		});

		expect(mockState.handleApiError).toHaveBeenCalledWith(error);
		await waitFor(() => {
			expect(mockState.listConfigs).toHaveBeenCalledTimes(2);
		});
		expect(mockState.schema).toHaveBeenCalledTimes(2);
		expect(mockState.templateVariables).toHaveBeenCalledTimes(2);
		expect(onPublicSiteUrlChanged).not.toHaveBeenCalled();
		expect(mockState.toastSuccess).not.toHaveBeenCalled();
		expect(result.current.saving).toBe(false);
	});
});
