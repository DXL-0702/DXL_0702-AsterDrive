import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilePreview } from "@/components/files/FilePreview";

vi.mock("@/components/files/preview/FilePreviewDialog", () => ({
	FilePreviewDialog: ({
		file,
		downloadPath,
		editable,
	}: {
		file: { name: string };
		downloadPath?: string;
		editable?: boolean;
	}) => (
		<div
			data-testid="preview-dialog"
			data-file-name={file.name}
			data-download-path={downloadPath ?? ""}
			data-editable={String(Boolean(editable))}
		/>
	),
}));

describe("FilePreview", () => {
	it("forwards all props to the preview dialog", () => {
		render(
			<FilePreview
				file={{ id: 7, name: "report.pdf" } as never}
				onClose={vi.fn()}
				onFileUpdated={vi.fn()}
				downloadPath="/files/7/download"
				editable
			/>,
		);

		expect(screen.getByTestId("preview-dialog")).toHaveAttribute(
			"data-file-name",
			"report.pdf",
		);
		expect(screen.getByTestId("preview-dialog")).toHaveAttribute(
			"data-download-path",
			"/files/7/download",
		);
		expect(screen.getByTestId("preview-dialog")).toHaveAttribute(
			"data-editable",
			"true",
		);
	});
});
