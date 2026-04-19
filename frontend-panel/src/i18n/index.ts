import i18n, { type ResourceKey } from "i18next";
import { initReactI18next } from "react-i18next";
import { runWhenIdle } from "@/lib/idleTask";

type SupportedLanguage = "en" | "zh";

function normalizeLanguage(language?: string | null): SupportedLanguage {
	return language?.startsWith("zh") ? "zh" : "en";
}

function detectLanguage(): SupportedLanguage {
	try {
		const stored = localStorage.getItem("aster-language");
		if (stored === "en" || stored === "zh") return stored;
	} catch {
		// ignore
	}
	return normalizeLanguage(navigator.language);
}

const ALL_NAMESPACES = [
	"core",
	"files",
	"auth",
	"validation",
	"admin",
	"webdav",
	"settings",
	"share",
	"errors",
	"offline",
	"search",
	"tasks",
] as const;
const INITIAL_NAMESPACES = [
	"core",
	"files",
	"auth",
	"validation",
	"errors",
	"offline",
	"share",
	"tasks",
] as const;
const DEFERRED_NAMESPACES = ["admin", "webdav", "settings", "search"] as const;

type LocaleNamespace = (typeof ALL_NAMESPACES)[number];

function isLocaleNamespace(namespace: string): namespace is LocaleNamespace {
	return (ALL_NAMESPACES as readonly string[]).includes(namespace);
}

function getLanguageSwitchNamespaces(): LocaleNamespace[] {
	const usedNamespaces = i18n.reportNamespaces?.getUsedNamespaces?.() ?? [];
	return [
		...new Set([
			...INITIAL_NAMESPACES,
			...usedNamespaces.filter(isLocaleNamespace),
		]),
	];
}

async function loadLocale(
	lang: string,
	namespaces: readonly LocaleNamespace[] = ALL_NAMESPACES,
) {
	const entries = await Promise.all(
		namespaces.map(async (namespace) => {
			const module = await import(`./locales/${lang}/${namespace}.json`);
			return [namespace, module.default] as const;
		}),
	);
	return Object.fromEntries(entries) as Partial<
		Record<LocaleNamespace, ResourceKey>
	>;
}

async function ensureNamespaces(
	lang: string,
	namespaces: readonly LocaleNamespace[],
) {
	const missing = namespaces.filter(
		(namespace) => !i18n.hasResourceBundle(lang, namespace),
	);
	if (missing.length === 0) return;
	const resources = await loadLocale(lang, missing);
	for (const [namespace, data] of Object.entries(resources)) {
		i18n.addResourceBundle(lang, namespace, data);
	}
}

export async function ensureI18nNamespaces(
	namespaces: readonly LocaleNamespace[],
	language: string = i18n.language,
) {
	await ensureNamespaces(normalizeLanguage(language), namespaces);
}

const pendingDeferredWarmups = new Set<SupportedLanguage>();

function getAlternateLanguage(lang: SupportedLanguage): SupportedLanguage {
	return lang === "zh" ? "en" : "zh";
}

function scheduleDeferredWarmup(lang: SupportedLanguage) {
	if (
		pendingDeferredWarmups.has(lang) ||
		DEFERRED_NAMESPACES.every((namespace) =>
			i18n.hasResourceBundle(lang, namespace),
		)
	) {
		return;
	}

	pendingDeferredWarmups.add(lang);
	runWhenIdle(() => {
		void ensureNamespaces(lang, DEFERRED_NAMESPACES).finally(() => {
			pendingDeferredWarmups.delete(lang);
		});
	});
}

const lang = detectLanguage();
const resources = await loadLocale(lang, INITIAL_NAMESPACES);

i18n.use(initReactI18next).init({
	resources: { [lang]: resources },
	lng: lang,
	fallbackLng: "en",
	defaultNS: "core",
	interpolation: { escapeValue: false },
	react: {
		bindI18nStore: "added",
	},
});

void ensureNamespaces(lang, DEFERRED_NAMESPACES);
scheduleDeferredWarmup(getAlternateLanguage(lang));

// 切换语言时按需加载目标语言包
const _changeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (newLang?: string, ...args) => {
	if (newLang) {
		const targetLang = normalizeLanguage(newLang);
		try {
			localStorage.setItem("aster-language", targetLang);
		} catch {
			// ignore storage errors (private browsing, quota)
		}
		await ensureNamespaces(targetLang, getLanguageSwitchNamespaces());
		void ensureNamespaces(targetLang, DEFERRED_NAMESPACES);
		scheduleDeferredWarmup(getAlternateLanguage(targetLang));
		return _changeLanguage(targetLang, ...args);
	}
	return _changeLanguage(newLang, ...args);
};

export default i18n;
