import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadOnlyFileGrid } from "@/components/files/ReadOnlyFileGrid";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
	}),
}));

vi.mock("@/components/files/FileCard", () => ({
	FileCard: ({
		item,
		onClick,
		thumbnailPath,
		isFolder,
	}: {
		item: { name: string };
		onClick?: () => void;
		thumbnailPath?: string;
		isFolder: boolean;
	}) => (
		<button
			type="button"
			onClick={onClick}
			data-testid={isFolder ? "folder-card" : "file-card"}
			data-thumbnail-path={thumbnailPath ?? ""}
		>
			{item.name}
		</button>
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: () => <span data-testid="icon" />,
}));

describe("ReadOnlyFileGrid", () => {
	it("renders section headers when both folders and files are present", () => {
		render(
			<ReadOnlyFileGrid
				folders={[{ id: 1, name: "Docs" } as never]}
				files={[{ id: 2, name: "report.pdf" } as never]}
				getThumbnailPath={(file) => `/thumb/${file.id}`}
			/>,
		);

		expect(screen.getByText("translated:folders_section")).toBeInTheDocument();
		expect(screen.getByText("translated:files_section")).toBeInTheDocument();
		expect(screen.getByTestId("file-card")).toHaveAttribute(
			"data-thumbnail-path",
			"/thumb/2",
		);
	});

	it("invokes folder, file, and download callbacks", () => {
		const onFolderClick = vi.fn();
		const onFileClick = vi.fn();
		const onFileDownload = vi.fn();

		render(
			<ReadOnlyFileGrid
				folders={[{ id: 1, name: "Docs" } as never]}
				files={[{ id: 2, name: "report.pdf" } as never]}
				onFolderClick={onFolderClick}
				onFileClick={onFileClick}
				onFileDownload={onFileDownload}
			/>,
		);

		fireEvent.click(screen.getByTestId("folder-card"));
		fireEvent.click(screen.getByTestId("file-card"));
		fireEvent.click(
			screen.getByRole("button", { name: "translated:download" }),
		);

		expect(onFolderClick).toHaveBeenCalledWith(
			expect.objectContaining({ id: 1 }),
		);
		expect(onFileClick).toHaveBeenCalledWith(
			expect.objectContaining({ id: 2 }),
		);
		expect(onFileDownload).toHaveBeenCalledWith(
			expect.objectContaining({ id: 2 }),
		);
	});

	it("omits section headers when only one item type is present", () => {
		render(
			<ReadOnlyFileGrid
				folders={[]}
				files={[{ id: 2, name: "report.pdf" } as never]}
			/>,
		);

		expect(
			screen.queryByText("translated:folders_section"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("translated:files_section"),
		).not.toBeInTheDocument();
	});
});
