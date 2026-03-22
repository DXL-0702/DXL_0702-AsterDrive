import { useEffect } from "react";
import { useFileStore } from "@/stores/fileStore";

export function useKeyboardShortcuts() {
	const selectAll = useFileStore((s) => s.selectAll);
	const clearSelection = useFileStore((s) => s.clearSelection);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			// Don't trigger in input/textarea/contenteditable
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			) {
				return;
			}

			const mod = e.metaKey || e.ctrlKey;

			// Ctrl/Cmd + A: Select all
			if (mod && e.key === "a") {
				e.preventDefault();
				selectAll();
			}

			// Escape: Clear selection
			if (e.key === "Escape") {
				clearSelection();
			}

			// / or Ctrl+K: Focus search input
			if (e.key === "/" || (mod && e.key === "k")) {
				e.preventDefault();
				const searchInput = document.querySelector<HTMLInputElement>(
					"[data-search-input]",
				);
				if (searchInput) {
					searchInput.focus();
				}
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [selectAll, clearSelection]);
}
