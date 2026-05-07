import { formatDateShort } from "@/lib/format";
import type { SharePublicInfo } from "@/types/api";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function getDownloadSummary(info: SharePublicInfo, t: Translate) {
	const downloadCount = info.download_count ?? 0;
	const maxDownloads = info.max_downloads ?? 0;
	return maxDownloads > 0
		? t("share:n_of_m_downloads", {
				count: downloadCount,
				max: maxDownloads,
			})
		: t("share:n_downloads", { count: downloadCount });
}

export function getExpirySummary(info: SharePublicInfo, t: Translate) {
	return info.expires_at
		? t("share:expires_date", { date: formatDateShort(info.expires_at) })
		: t("share:never_expires");
}

export function getAccessSummary(info: SharePublicInfo, t: Translate) {
	return info.has_password
		? t("share:password_required")
		: t("share:public_access");
}
