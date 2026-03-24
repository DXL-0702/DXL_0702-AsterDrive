import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import enAdmin from "./locales/en/admin.json";
import enAuth from "./locales/en/auth.json";
import enCommon from "./locales/en/common.json";
import enFiles from "./locales/en/files.json";
import enSearch from "./locales/en/search.json";
import zhAdmin from "./locales/zh/admin.json";
import zhAuth from "./locales/zh/auth.json";
import zhCommon from "./locales/zh/common.json";
import zhFiles from "./locales/zh/files.json";
import zhSearch from "./locales/zh/search.json";

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources: {
			en: {
				common: enCommon,
				files: enFiles,
				auth: enAuth,
				admin: enAdmin,
				search: enSearch,
			},
			zh: {
				common: zhCommon,
				files: zhFiles,
				auth: zhAuth,
				admin: zhAdmin,
				search: zhSearch,
			},
		},
		fallbackLng: "en",
		defaultNS: "common",
		detection: {
			order: ["localStorage", "navigator"],
			lookupLocalStorage: "aster-language",
			caches: ["localStorage"],
		},
		interpolation: { escapeValue: false },
		// 关掉 i18next 的广告
		showSupportNotice: false,
	});

export default i18n;
