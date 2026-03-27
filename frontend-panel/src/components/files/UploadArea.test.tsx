import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appendCompletedPart = vi.fn();
const cancelUpload = vi.fn();
const completeUpload = vi.fn();
const getProgress = vi.fn();
const initUpload = vi.fn();
const loadSessions = vi.fn(() => []);
const presignedUpload = vi.fn();
const presignParts = vi.fn();
const refresh = vi.fn().mockResolvedValue(undefined);
const refreshUser = vi.fn().mockResolvedValue(undefined);
const removeSession = vi.fn();
const saveSession = vi.fn();
const uploadChunk = vi.fn();
const uploadPanelSpy = vi.fn();
const apiClientPost = vi.fn();

interface MockFileStoreState {
	breadcrumb: Array<{ id: number | null; name: string }>;
	currentFolderId: number | null;
	refresh: () => Promise<void>;
}

interface MockAuthStoreState {
	refreshUser: () => Promise<void>;
}

class MockApiError extends Error {
	code: number;

	constructor(code: number, message: string) {
		super(message);
		this.code = code;
	}
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("@/components/files/UploadPanel", () => ({
	UploadPanel: (props: {
		tasks: Array<{ id: string; mode: string; status: string; title: string }>;
	}) => {
		uploadPanelSpy(props);
		return (
			<div data-testid="upload-panel">
				{props.tasks.map((task) => (
					<div key={task.id}>{`${task.title}:${task.mode}:${task.status}`}</div>
				))}
			</div>
		);
	},
}));

vi.mock("@/stores/fileStore", () => ({
	useFileStore: <T,>(selector: (state: MockFileStoreState) => T) =>
		selector({
			breadcrumb: [
				{ id: null, name: "Root" },
				{ id: 42, name: "Projects" },
			],
			currentFolderId: 42,
			refresh,
		}),
}));

vi.mock("@/stores/authStore", () => ({
	useAuthStore: <T,>(selector: (state: MockAuthStoreState) => T) =>
		selector({
			refreshUser,
		}),
}));

vi.mock("@/lib/uploadPersistence", () => ({
	appendCompletedPart,
	loadSessions,
	removeSession,
	saveSession,
}));

vi.mock("@/services/uploadService", () => ({
	uploadService: {
		cancelUpload,
		completeUpload,
		getProgress,
		initUpload,
		presignParts,
		presignedUpload,
		uploadChunk,
	},
}));

vi.mock("@/services/http", () => ({
	ApiError: MockApiError,
	api: {
		client: {
			post: apiClientPost,
		},
	},
}));

async function uploadOneFile() {
	const { UploadArea } = await import("@/components/files/UploadArea");
	const file = new File(["hello"], "hello.txt", { type: "text/plain" });

	const view = render(
		<UploadArea>
			<div>content</div>
		</UploadArea>,
	);

	const fileInput = view.container.querySelectorAll('input[type="file"]')[0] as
		| HTMLInputElement
		| undefined;

	if (!fileInput) {
		throw new Error("file input not found");
	}

	fireEvent.change(fileInput, {
		target: { files: [file] },
	});

	await waitFor(() => {
		expect(initUpload).toHaveBeenCalledWith({
			filename: "hello.txt",
			total_size: file.size,
			folder_id: 42,
			relative_path: undefined,
		});
	});

	return file;
}

describe("UploadArea", () => {
	beforeEach(() => {
		appendCompletedPart.mockReset();
		apiClientPost.mockReset();
		cancelUpload.mockReset();
		completeUpload.mockReset();
		getProgress.mockReset();
		initUpload.mockReset();
		loadSessions.mockReset();
		loadSessions.mockReturnValue([]);
		presignedUpload.mockReset();
		presignParts.mockReset();
		refresh.mockReset();
		refresh.mockResolvedValue(undefined);
		refreshUser.mockReset();
		refreshUser.mockResolvedValue(undefined);
		removeSession.mockReset();
		saveSession.mockReset();
		uploadChunk.mockReset();
		uploadPanelSpy.mockReset();
	});

	it("handles direct uploads through the form-data endpoint", async () => {
		initUpload.mockResolvedValue({ mode: "direct" });
		apiClientPost.mockResolvedValue({});

		await uploadOneFile();

		await screen.findByText("hello.txt:Direct:files:upload_success");

		expect(apiClientPost).toHaveBeenCalledTimes(1);
		expect(apiClientPost.mock.calls[0]?.[0]).toBe("/files/upload?folder_id=42");
		expect(apiClientPost.mock.calls[0]?.[1]).toBeInstanceOf(FormData);
		expect(completeUpload).not.toHaveBeenCalled();
		expect(saveSession).not.toHaveBeenCalled();
	});

	it("handles chunked uploads and persists resumable sessions", async () => {
		initUpload.mockResolvedValue({
			mode: "chunked",
			upload_id: "upload-chunked",
			chunk_size: 5,
			total_chunks: 1,
		});
		uploadChunk.mockResolvedValue({});
		completeUpload.mockResolvedValue({ id: 9001 });

		await uploadOneFile();

		await screen.findByText("hello.txt:Chunked:files:upload_success");

		expect(saveSession).toHaveBeenCalledWith(
			expect.objectContaining({
				uploadId: "upload-chunked",
				mode: "chunked",
				baseFolderId: 42,
				baseFolderName: "Projects",
			}),
		);
		expect(uploadChunk).toHaveBeenCalledWith(
			"upload-chunked",
			0,
			expect.any(Blob),
		);
		expect(completeUpload).toHaveBeenCalledWith("upload-chunked", undefined);
		expect(removeSession).toHaveBeenCalledWith("upload-chunked");
	});

	it("handles single-request presigned uploads", async () => {
		initUpload.mockResolvedValue({
			mode: "presigned",
			upload_id: "upload-presigned",
			presigned_url: "https://s3.example/upload",
		});
		presignedUpload.mockResolvedValue('"etag-123"');
		completeUpload.mockResolvedValue({ id: 9002 });

		await uploadOneFile();

		await screen.findByText("hello.txt:S3:files:upload_success");

		expect(presignedUpload).toHaveBeenCalledWith(
			"https://s3.example/upload",
			expect.any(File),
			expect.any(Function),
			expect.any(Function),
		);
		expect(completeUpload).toHaveBeenCalledWith("upload-presigned", undefined);
		expect(saveSession).not.toHaveBeenCalled();
	});

	it("handles multipart presigned uploads and completes with uploaded parts", async () => {
		initUpload.mockResolvedValue({
			mode: "presigned_multipart",
			upload_id: "upload-multipart",
			chunk_size: 5,
			total_chunks: 1,
		});
		presignParts.mockResolvedValue({
			1: "https://s3.example/upload/part-1",
		});
		presignedUpload.mockResolvedValue('"etag-001"');
		completeUpload.mockResolvedValue({ id: 9003 });

		await uploadOneFile();

		await screen.findByText("hello.txt:S3 Chunked:files:upload_success");

		expect(saveSession).toHaveBeenCalledWith(
			expect.objectContaining({
				uploadId: "upload-multipart",
				mode: "presigned_multipart",
			}),
		);
		expect(presignParts).toHaveBeenCalledWith("upload-multipart", [1]);
		expect(appendCompletedPart).toHaveBeenCalledWith("upload-multipart", {
			part_number: 1,
			etag: "etag-001",
		});
		expect(completeUpload).toHaveBeenCalledWith("upload-multipart", [
			{
				part_number: 1,
				etag: "etag-001",
			},
		]);
		expect(removeSession).toHaveBeenCalledWith("upload-multipart");
	});
});
