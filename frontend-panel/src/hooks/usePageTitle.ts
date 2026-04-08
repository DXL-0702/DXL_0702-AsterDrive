import { useEffect } from "react";
import { formatDocumentTitle } from "@/lib/branding";
import { useBrandingStore } from "@/stores/brandingStore";

export function usePageTitle(pageTitle?: string | null) {
	const appTitle = useBrandingStore((state) => state.branding.title);

	useEffect(() => {
		if (typeof document === "undefined") return;
		document.title = formatDocumentTitle(appTitle, pageTitle);
	}, [appTitle, pageTitle]);
}
