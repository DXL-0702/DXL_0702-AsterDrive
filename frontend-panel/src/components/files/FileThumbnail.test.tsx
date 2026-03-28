import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileThumbnail } from "@/components/files/FileThumbnail";

const mockState = vi.hoisted(() => ({
	useBlobUrl: vi.fn(),
	thumbnailPath: vi.fn((id: number) => `/thumb/${id}`),
}));

vi.mock("@/hooks/useBlobUrl", () => ({
	useBlobUrl: (path: string | null) => mockState.useBlobUrl(path),
}));

vi.mock("@/services/fileService", () => ({
	fileService: {
		thumbnailPath: mockState.thumbnailPath,
	},
}));

vi.mock("@/components/files/FileTypeIcon", () => ({
	FileTypeIcon: ({
		mimeType,
		fileName,
		className,
	}: {
		mimeType: string;
		fileName?: string;
		className?: string;
	}) => (
		<span
			data-testid="file-type-icon"
			data-mime-type={mimeType}
			data-file-name={fileName}
			className={className}
		/>
	),
}));

const imageFile = {
	id: 7,
	name: "photo.png",
	mime_type: "image/png",
};

describe("FileThumbnail", () => {
	beforeEach(() => {
		mockState.useBlobUrl.mockReset();
		mockState.thumbnailPath.mockClear();
		mockState.useBlobUrl.mockReturnValue({ blobUrl: null, error: false });
	});

	it("uses the generated thumbnail path for image files", () => {
		mockState.useBlobUrl.mockReturnValue({ blobUrl: "blob:1", error: false });

		const { container } = render(<FileThumbnail file={imageFile} />);

		expect(mockState.thumbnailPath).toHaveBeenCalledWith(7);
		expect(mockState.useBlobUrl).toHaveBeenCalledWith("/thumb/7");
		expect(container.querySelector("img")).toHaveAttribute("src", "blob:1");
	});

	it("uses the provided thumbnail path override", () => {
		render(<FileThumbnail file={imageFile} thumbnailPath="/custom-thumb" />);

		expect(mockState.useBlobUrl).toHaveBeenCalledWith("/custom-thumb");
	});

	it("falls back to the file type icon for non-image files", () => {
		render(
			<FileThumbnail
				file={{ id: 9, name: "report.pdf", mime_type: "application/pdf" }}
			/>,
		);

		expect(mockState.useBlobUrl).toHaveBeenCalledWith(null);
		expect(screen.getByTestId("file-type-icon")).toHaveAttribute(
			"data-mime-type",
			"application/pdf",
		);
	});

	it("falls back to the icon when blob loading fails or is absent", () => {
		mockState.useBlobUrl.mockReturnValue({ blobUrl: null, error: true });

		const { rerender } = render(<FileThumbnail file={imageFile} size="lg" />);
		expect(screen.getByTestId("file-type-icon")).toHaveClass("h-12", "w-12");

		mockState.useBlobUrl.mockReturnValue({ blobUrl: null, error: false });
		rerender(<FileThumbnail file={imageFile} />);

		expect(screen.getByTestId("file-type-icon")).toHaveClass("h-4", "w-4");
	});

	it("renders a large image preview when a blob URL is available", () => {
		mockState.useBlobUrl.mockReturnValue({ blobUrl: "blob:2", error: false });

		const { container } = render(<FileThumbnail file={imageFile} size="lg" />);

		expect(container.querySelector("img")).toHaveAttribute("src", "blob:2");
		expect(container.querySelector("img")).toHaveClass(
			"h-full",
			"w-auto",
			"shrink-0",
			"max-w-none",
		);
	});
});
