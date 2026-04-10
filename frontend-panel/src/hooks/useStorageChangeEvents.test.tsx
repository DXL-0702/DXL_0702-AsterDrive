import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
	auth: {
		isAuthenticated: true,
		user: {
			preferences: {
				storage_event_stream_enabled: true,
			},
		},
	},
	workspace: { kind: "personal" } as
		| { kind: "personal" }
		| { kind: "team"; teamId: number },
	fileStore: {
		currentFolderId: 7,
		breadcrumb: [
			{ id: null, name: "Root" },
			{ id: 7, name: "Docs" },
		],
		searchQuery: null as string | null,
		navigateTo: vi.fn(),
	},
	invalidateBlobUrl: vi.fn(),
	invalidateTextContent: vi.fn(),
	storageRefreshGate: {
		deferStorageRefresh: vi.fn(),
		isStorageRefreshGateActive: vi.fn(() => false),
	},
}));

class MockEventSource {
	static instances: MockEventSource[] = [];

	onerror: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent<string>) => void) | null = null;
	close = vi.fn();
	url: string;
	withCredentials: boolean;

	constructor(url: string, init?: EventSourceInit) {
		this.url = url;
		this.withCredentials = init?.withCredentials ?? false;
		MockEventSource.instances.push(this);
	}

	emit(data: unknown) {
		this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
	}

	static reset() {
		MockEventSource.instances = [];
	}
}

vi.mock("@/config/app", () => ({
	config: {
		apiBaseUrl: "http://api.test/api/v1",
	},
}));

vi.mock("@/hooks/useBlobUrl", () => ({
	invalidateBlobUrl: (...args: unknown[]) =>
		mockState.invalidateBlobUrl(...args),
}));

vi.mock("@/hooks/useTextContent", () => ({
	invalidateTextContent: (...args: unknown[]) =>
		mockState.invalidateTextContent(...args),
}));

vi.mock("@/lib/storageRefreshGate", () => ({
	deferStorageRefresh: (...args: unknown[]) =>
		mockState.storageRefreshGate.deferStorageRefresh(...args),
	isStorageRefreshGateActive: (...args: unknown[]) =>
		mockState.storageRefreshGate.isStorageRefreshGateActive(...args),
}));

vi.mock("@/services/fileService", () => ({
	fileService: {
		downloadPath: (id: number) => `/files/${id}/download`,
		thumbnailPath: (id: number) => `/files/${id}/thumbnail`,
	},
}));

vi.mock("@/stores/authStore", () => ({
	useAuthStore: <T,>(selector: (state: typeof mockState.auth) => T) =>
		selector(mockState.auth),
}));

vi.mock("@/stores/workspaceStore", () => {
	const useWorkspaceStore = Object.assign(
		<T,>(selector: (state: { workspace: typeof mockState.workspace }) => T) =>
			selector({ workspace: mockState.workspace }),
		{
			getState: () => ({ workspace: mockState.workspace }),
		},
	);

	return { useWorkspaceStore };
});

vi.mock("@/stores/fileStore", () => {
	const useFileStore = Object.assign(
		<T,>(
			selector: (state: {
				breadcrumb: typeof mockState.fileStore.breadcrumb;
				currentFolderId: number | null;
				navigateTo: typeof mockState.fileStore.navigateTo;
				searchQuery: string | null;
			}) => T,
		) => selector(mockState.fileStore),
		{
			getState: () => mockState.fileStore,
		},
	);

	return { useFileStore };
});

describe("useStorageChangeEvents", () => {
	beforeEach(() => {
		MockEventSource.reset();
		mockState.auth.isAuthenticated = true;
		mockState.auth.user.preferences.storage_event_stream_enabled = true;
		mockState.workspace = { kind: "personal" };
		mockState.fileStore.currentFolderId = 7;
		mockState.fileStore.breadcrumb = [
			{ id: null, name: "Root" },
			{ id: 7, name: "Docs" },
		];
		mockState.fileStore.searchQuery = null;
		mockState.fileStore.navigateTo.mockReset();
		mockState.fileStore.navigateTo.mockResolvedValue(undefined);
		mockState.invalidateBlobUrl.mockReset();
		mockState.invalidateTextContent.mockReset();
		mockState.storageRefreshGate.deferStorageRefresh.mockReset();
		mockState.storageRefreshGate.isStorageRefreshGateActive.mockReset();
		mockState.storageRefreshGate.isStorageRefreshGateActive.mockReturnValue(
			false,
		);
		vi.stubGlobal("EventSource", MockEventSource);
	});

	it("invalidates matching file previews and refreshes the current folder", async () => {
		const { useStorageChangeEvents } = await import(
			"@/hooks/useStorageChangeEvents"
		);

		const hook = renderHook(() => useStorageChangeEvents());

		await waitFor(() => {
			expect(MockEventSource.instances).toHaveLength(1);
		});

		MockEventSource.instances[0]?.emit({
			kind: "file.updated",
			workspace: { kind: "personal" },
			file_ids: [11],
			folder_ids: [],
			affected_parent_ids: [7],
			root_affected: false,
			at: "2026-04-08T00:00:00Z",
		});

		await waitFor(() => {
			expect(mockState.invalidateTextContent).toHaveBeenCalledWith(
				"/files/11/download",
			);
		});
		expect(mockState.invalidateBlobUrl).toHaveBeenNthCalledWith(
			1,
			"/files/11/download",
		);
		expect(mockState.invalidateBlobUrl).toHaveBeenNthCalledWith(
			2,
			"/files/11/thumbnail",
		);
		await waitFor(() => {
			expect(mockState.fileStore.navigateTo).toHaveBeenCalledWith(7);
		});

		hook.unmount();
		expect(MockEventSource.instances[0]?.close).toHaveBeenCalledTimes(1);
	});

	it("handles sync.required without refreshing during search", async () => {
		mockState.fileStore.searchQuery = "report";
		const { useStorageChangeEvents } = await import(
			"@/hooks/useStorageChangeEvents"
		);

		renderHook(() => useStorageChangeEvents());

		await waitFor(() => {
			expect(MockEventSource.instances).toHaveLength(1);
		});

		MockEventSource.instances[0]?.emit({
			kind: "sync.required",
			workspace: null,
			file_ids: [],
			folder_ids: [],
			affected_parent_ids: [],
			root_affected: false,
			at: "2026-04-08T00:00:00Z",
		});

		await waitFor(() => {
			expect(mockState.invalidateBlobUrl).toHaveBeenCalledWith();
		});
		expect(mockState.invalidateTextContent).toHaveBeenCalledWith();
		expect(mockState.fileStore.navigateTo).not.toHaveBeenCalled();
	});

	it("ignores events from other workspaces", async () => {
		mockState.workspace = { kind: "team", teamId: 9 };
		const { useStorageChangeEvents } = await import(
			"@/hooks/useStorageChangeEvents"
		);

		renderHook(() => useStorageChangeEvents());

		await waitFor(() => {
			expect(MockEventSource.instances).toHaveLength(1);
		});

		MockEventSource.instances[0]?.emit({
			kind: "file.deleted",
			workspace: { kind: "team", team_id: 42 },
			file_ids: [5],
			folder_ids: [],
			affected_parent_ids: [7],
			root_affected: false,
			at: "2026-04-08T00:00:00Z",
		});

		await waitFor(() => {
			expect(mockState.invalidateBlobUrl).not.toHaveBeenCalled();
		});
		expect(mockState.invalidateTextContent).not.toHaveBeenCalled();
		expect(mockState.fileStore.navigateTo).not.toHaveBeenCalled();
	});

	it("defers folder refresh while the upload queue gate is active", async () => {
		mockState.storageRefreshGate.isStorageRefreshGateActive.mockReturnValue(
			true,
		);
		const { useStorageChangeEvents } = await import(
			"@/hooks/useStorageChangeEvents"
		);

		renderHook(() => useStorageChangeEvents());

		await waitFor(() => {
			expect(MockEventSource.instances).toHaveLength(1);
		});

		MockEventSource.instances[0]?.emit({
			kind: "file.updated",
			workspace: { kind: "personal" },
			file_ids: [12],
			folder_ids: [],
			affected_parent_ids: [7],
			root_affected: false,
			at: "2026-04-08T00:00:00Z",
		});

		await waitFor(() => {
			expect(mockState.invalidateTextContent).toHaveBeenCalledWith(
				"/files/12/download",
			);
		});
		expect(mockState.storageRefreshGate.deferStorageRefresh).toHaveBeenCalled();
		expect(mockState.fileStore.navigateTo).not.toHaveBeenCalled();
	});

	it("does not open the event stream when the user disables realtime sync", async () => {
		mockState.auth.user.preferences.storage_event_stream_enabled = false;
		const { useStorageChangeEvents } = await import(
			"@/hooks/useStorageChangeEvents"
		);

		renderHook(() => useStorageChangeEvents());

		await waitFor(() => {
			expect(MockEventSource.instances).toHaveLength(0);
		});
	});
});
