import type { i18n as I18n } from "i18next";
import { getActiveDisplayTimeZone } from "@/stores/displayTimeZoneStore";

const INTEGER_FORMATTER = new Intl.NumberFormat();

type DateFormatI18n = Pick<I18n, "language" | "resolvedLanguage" | "t">;

function getDateLocale(i18n?: DateFormatI18n): string | undefined {
	return i18n?.resolvedLanguage ?? (i18n?.language || undefined);
}

function getTimeZoneFormatOptions(
	options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatOptions {
	return {
		...options,
		timeZone: getActiveDisplayTimeZone(),
	};
}

function translateRelativeDate(
	i18n: DateFormatI18n | undefined,
	key: string,
	fallback: string,
	count?: number,
): string {
	if (!i18n) {
		return fallback;
	}

	if (count === undefined) {
		return i18n.t(key);
	}

	return i18n.t(key, { count });
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

export function formatNumber(value: number): string {
	if (!Number.isFinite(value)) {
		return String(value);
	}
	return INTEGER_FORMATTER.format(value);
}

export function formatDate(dateStr: string, i18n?: DateFormatI18n): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) {
		return translateRelativeDate(
			i18n,
			"core:date_relative_just_now",
			"just now",
		);
	}
	if (minutes < 60) {
		return translateRelativeDate(
			i18n,
			"core:date_relative_minutes_ago",
			`${minutes}m ago`,
			minutes,
		);
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return translateRelativeDate(
			i18n,
			"core:date_relative_hours_ago",
			`${hours}h ago`,
			hours,
		);
	}
	const days = Math.floor(hours / 24);
	if (days < 30) {
		return translateRelativeDate(
			i18n,
			"core:date_relative_days_ago",
			`${days}d ago`,
			days,
		);
	}
	return date.toLocaleDateString(
		getDateLocale(i18n),
		getTimeZoneFormatOptions(),
	);
}

export function formatDateAbsolute(dateStr: string): string {
	return new Date(dateStr).toLocaleString(
		undefined,
		getTimeZoneFormatOptions(),
	);
}

export function formatDateShort(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString(
		undefined,
		getTimeZoneFormatOptions(),
	);
}

export function formatDateTime(dateStr: string): string {
	return new Date(dateStr).toLocaleString(
		undefined,
		getTimeZoneFormatOptions(),
	);
}
