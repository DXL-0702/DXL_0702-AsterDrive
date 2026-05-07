import type { SearchResults } from "@/types/api";

export function getSearchOffset(results: SearchResults) {
	return Math.max(results.files.length, results.folders.length);
}

export function hasMoreSearchResults(results: SearchResults) {
	return (
		results.files.length < results.total_files ||
		results.folders.length < results.total_folders
	);
}
