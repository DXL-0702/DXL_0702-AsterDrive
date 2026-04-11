import { create } from "zustand";
import { logger } from "@/lib/logger";
import { previewAppsService } from "@/services/previewAppsService";
import type { PublicPreviewAppsConfig } from "@/types/api";

let inFlightLoad: Promise<void> | null = null;

interface PreviewAppState {
	config: PublicPreviewAppsConfig | null;
	isLoaded: boolean;
	load: () => Promise<void>;
}

export const usePreviewAppStore = create<PreviewAppState>((set, get) => ({
	config: null,
	isLoaded: false,

	load: async () => {
		if (get().isLoaded) return;
		if (inFlightLoad) return inFlightLoad;

		inFlightLoad = (async () => {
			try {
				const config = await previewAppsService.get();
				set({
					config,
					isLoaded: true,
				});
			} catch (error) {
				logger.warn(
					"preview apps bootstrap failed, using local fallback",
					error,
				);
				set({
					config: null,
					isLoaded: true,
				});
			} finally {
				inFlightLoad = null;
			}
		})();

		return inFlightLoad;
	},
}));
