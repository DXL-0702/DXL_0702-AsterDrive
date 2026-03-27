import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchService } from "@/services/searchService";
import type { SearchParams } from "@/types/api";

const { apiGet } = vi.hoisted(() => ({
	apiGet: vi.fn(),
}));

vi.mock("@/services/http", () => ({
	api: {
		get: apiGet,
	},
}));

describe("searchService", () => {
	beforeEach(() => {
		apiGet.mockReset();
	});

	it("serializes non-empty search params into the query string", () => {
		const params = {
			q: "report",
			folder_id: 7,
			mime_type: "",
			limit: 50,
			type: null,
			offset: 0,
		} satisfies SearchParams;

		searchService.search(params);

		expect(apiGet).toHaveBeenCalledWith(
			"/search?q=report&folder_id=7&limit=50&offset=0",
		);
	});
});
