import { withQuery } from "@/lib/queryParams";
import {
	buildWorkspacePath,
	PERSONAL_WORKSPACE,
	type Workspace,
} from "@/lib/workspace";
import { type ApiRequestConfig, api } from "@/services/http";
import { bindWorkspaceService } from "@/stores/workspaceStore";
import type { SearchParams, SearchResults } from "@/types/api";

type SearchRequestOptions = Pick<ApiRequestConfig, "signal">;

export function createSearchService(workspace: Workspace = PERSONAL_WORKSPACE) {
	return {
		search: (params: SearchParams, options?: SearchRequestOptions) =>
			api.get<SearchResults>(
				withQuery(buildWorkspacePath(workspace, "/search"), params),
				options,
			),
	};
}

export const searchService = bindWorkspaceService(createSearchService);
