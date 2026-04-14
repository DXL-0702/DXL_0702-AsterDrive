import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileBrowserItemContextMenu } from "@/components/files/FileBrowserItemContextMenu";

const mockState = vi.hoisted(() => ({
	browserContext: {
		onArchiveDownload: vi.fn(),
		onCopy: vi.fn(),
		onDelete: vi.fn(),
		onDownload: vi.fn(),
		onFileChooseOpenMethod: vi.fn(),
		onFileClick: vi.fn(),
		onFileOpen: vi.fn(),
		onFolderOpen: vi.fn(),
		onInfo: vi.fn(),
		onMove: vi.fn(),
		onRename: vi.fn(),
		onShare: vi.fn(),
		onToggleLock: vi.fn(),
		onVersions: vi.fn(),
	},
}));

vi.mock("@/components/files/FileBrowserContext", () => ({
	useFileBrowserContext: () => mockState.browserContext,
}));

vi.mock("@/components/files/FileContextMenu", () => ({
	FileContextMenu: ({
		children,
		onArchiveDownload,
		onChooseOpenMethod,
		onCopy,
		onDelete,
		onDirectShare,
		onDownload,
		onInfo,
		onMove,
		onOpen,
		onPageShare,
		onRename,
		onToggleLock,
		onVersions,
	}: {
		children: React.ReactNode;
		onArchiveDownload?: () => void;
		onChooseOpenMethod?: () => void;
		onCopy?: () => void;
		onDelete?: () => void;
		onDirectShare?: () => void;
		onDownload?: () => void;
		onInfo?: () => void;
		onMove?: () => void;
		onOpen?: () => void;
		onPageShare?: () => void;
		onRename?: () => void;
		onToggleLock?: () => void;
		onVersions?: () => void;
	}) => (
		<div>
			{children}
			{onOpen && (
				<button type="button" onClick={onOpen}>
					open
				</button>
			)}
			{onChooseOpenMethod && (
				<button type="button" onClick={onChooseOpenMethod}>
					open-method
				</button>
			)}
			{onDownload && (
				<button type="button" onClick={onDownload}>
					download
				</button>
			)}
			{onArchiveDownload && (
				<button type="button" onClick={onArchiveDownload}>
					archive
				</button>
			)}
			{onPageShare && (
				<button type="button" onClick={onPageShare}>
					share-page
				</button>
			)}
			{onDirectShare && (
				<button type="button" onClick={onDirectShare}>
					share-direct
				</button>
			)}
			{onCopy && (
				<button type="button" onClick={onCopy}>
					copy
				</button>
			)}
			{onMove && (
				<button type="button" onClick={onMove}>
					move
				</button>
			)}
			{onRename && (
				<button type="button" onClick={onRename}>
					rename
				</button>
			)}
			{onToggleLock && (
				<button type="button" onClick={onToggleLock}>
					lock
				</button>
			)}
			{onDelete && (
				<button type="button" onClick={onDelete}>
					delete
				</button>
			)}
			{onVersions && (
				<button type="button" onClick={onVersions}>
					versions
				</button>
			)}
			{onInfo && (
				<button type="button" onClick={onInfo}>
					info
				</button>
			)}
		</div>
	),
}));

describe("FileBrowserItemContextMenu", () => {
	beforeEach(() => {
		mockState.browserContext.onArchiveDownload.mockReset();
		mockState.browserContext.onCopy.mockReset();
		mockState.browserContext.onDelete.mockReset();
		mockState.browserContext.onDownload.mockReset();
		mockState.browserContext.onFileChooseOpenMethod.mockReset();
		mockState.browserContext.onFileClick.mockReset();
		mockState.browserContext.onFileOpen.mockReset();
		mockState.browserContext.onFolderOpen.mockReset();
		mockState.browserContext.onInfo.mockReset();
		mockState.browserContext.onMove.mockReset();
		mockState.browserContext.onRename.mockReset();
		mockState.browserContext.onShare.mockReset();
		mockState.browserContext.onToggleLock.mockReset();
		mockState.browserContext.onVersions.mockReset();
	});

	it("maps folder actions to the shared browser callbacks", () => {
		render(
			<FileBrowserItemContextMenu
				item={{ id: 1, name: "Docs", is_locked: false } as never}
				isFolder
			>
				<div>folder</div>
			</FileBrowserItemContextMenu>,
		);

		fireEvent.click(screen.getByRole("button", { name: "open" }));
		fireEvent.click(screen.getByRole("button", { name: "archive" }));
		fireEvent.click(screen.getByRole("button", { name: "share-page" }));
		fireEvent.click(screen.getByRole("button", { name: "copy" }));
		fireEvent.click(screen.getByRole("button", { name: "move" }));
		fireEvent.click(screen.getByRole("button", { name: "rename" }));
		fireEvent.click(screen.getByRole("button", { name: "lock" }));
		fireEvent.click(screen.getByRole("button", { name: "delete" }));
		fireEvent.click(screen.getByRole("button", { name: "info" }));

		expect(mockState.browserContext.onFolderOpen).toHaveBeenCalledWith(
			1,
			"Docs",
		);
		expect(mockState.browserContext.onArchiveDownload).toHaveBeenCalledWith(1);
		expect(mockState.browserContext.onShare).toHaveBeenCalledWith({
			folderId: 1,
			name: "Docs",
			initialMode: "page",
		});
		expect(mockState.browserContext.onCopy).toHaveBeenCalledWith("folder", 1);
		expect(mockState.browserContext.onMove).toHaveBeenCalledWith("folder", 1);
		expect(mockState.browserContext.onRename).toHaveBeenCalledWith(
			"folder",
			1,
			"Docs",
		);
		expect(mockState.browserContext.onToggleLock).toHaveBeenCalledWith(
			"folder",
			1,
			false,
		);
		expect(mockState.browserContext.onDelete).toHaveBeenCalledWith("folder", 1);
		expect(mockState.browserContext.onInfo).toHaveBeenCalledWith("folder", 1);
	});

	it("maps file actions to the shared browser callbacks", () => {
		render(
			<FileBrowserItemContextMenu
				item={{ id: 2, name: "report.pdf", is_locked: true } as never}
				isFolder={false}
			>
				<div>file</div>
			</FileBrowserItemContextMenu>,
		);

		fireEvent.click(screen.getByRole("button", { name: "open" }));
		fireEvent.click(screen.getByRole("button", { name: "open-method" }));
		fireEvent.click(screen.getByRole("button", { name: "download" }));
		fireEvent.click(screen.getByRole("button", { name: "share-page" }));
		fireEvent.click(screen.getByRole("button", { name: "share-direct" }));
		fireEvent.click(screen.getByRole("button", { name: "copy" }));
		fireEvent.click(screen.getByRole("button", { name: "move" }));
		fireEvent.click(screen.getByRole("button", { name: "rename" }));
		fireEvent.click(screen.getByRole("button", { name: "lock" }));
		fireEvent.click(screen.getByRole("button", { name: "delete" }));
		fireEvent.click(screen.getByRole("button", { name: "versions" }));
		fireEvent.click(screen.getByRole("button", { name: "info" }));

		expect(mockState.browserContext.onFileOpen).toHaveBeenCalledWith(
			expect.objectContaining({ id: 2 }),
		);
		expect(
			mockState.browserContext.onFileChooseOpenMethod,
		).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
		expect(mockState.browserContext.onDownload).toHaveBeenCalledWith(
			2,
			"report.pdf",
		);
		expect(mockState.browserContext.onShare).toHaveBeenNthCalledWith(1, {
			fileId: 2,
			name: "report.pdf",
			initialMode: "page",
		});
		expect(mockState.browserContext.onShare).toHaveBeenNthCalledWith(2, {
			fileId: 2,
			name: "report.pdf",
			initialMode: "direct",
		});
		expect(mockState.browserContext.onCopy).toHaveBeenCalledWith("file", 2);
		expect(mockState.browserContext.onMove).toHaveBeenCalledWith("file", 2);
		expect(mockState.browserContext.onRename).toHaveBeenCalledWith(
			"file",
			2,
			"report.pdf",
		);
		expect(mockState.browserContext.onToggleLock).toHaveBeenCalledWith(
			"file",
			2,
			true,
		);
		expect(mockState.browserContext.onDelete).toHaveBeenCalledWith("file", 2);
		expect(mockState.browserContext.onVersions).toHaveBeenCalledWith(2);
		expect(mockState.browserContext.onInfo).toHaveBeenCalledWith("file", 2);
	});
});
