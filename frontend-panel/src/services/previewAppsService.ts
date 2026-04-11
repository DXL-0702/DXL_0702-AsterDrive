import type { PublicPreviewAppsConfig } from "@/types/api";
import { api } from "./http";

export const previewAppsService = {
	get: () => api.get<PublicPreviewAppsConfig>("/public/preview-apps"),
};
