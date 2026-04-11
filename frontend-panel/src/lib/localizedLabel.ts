function normalizeLanguageTag(language?: string | null) {
	if (!language) {
		return "";
	}

	return language.trim().toLowerCase().replaceAll("_", "-");
}

export function pickLocalizedLabel(
	labels: Record<string, string> | null | undefined,
	language?: string | null,
) {
	if (!labels || Object.keys(labels).length === 0) {
		return "";
	}

	const normalizedLanguage = normalizeLanguageTag(language);
	if (normalizedLanguage.length > 0) {
		const localeParts = normalizedLanguage.split("-");
		for (let index = localeParts.length; index > 0; index -= 1) {
			const candidate = localeParts.slice(0, index).join("-");
			const label = labels[candidate];
			if (typeof label === "string" && label.trim().length > 0) {
				return label.trim();
			}
		}
	}

	const firstLabel = Object.values(labels).find(
		(value) => typeof value === "string" && value.trim().length > 0,
	);
	return firstLabel?.trim() ?? "";
}
