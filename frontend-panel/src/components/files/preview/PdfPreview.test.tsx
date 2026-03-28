import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfPreview } from "@/components/files/preview/PdfPreview";

const mockState = vi.hoisted(() => ({
	documentProps: null as Record<string, unknown> | null,
	retry: vi.fn(),
	useBlobUrlResult: {
		blobUrl: "blob:pdf-preview",
		error: false,
		loading: false,
		retry: vi.fn(),
	},
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("react-pdf", () => {
	const pdfjs = {
		GlobalWorkerOptions: {},
		version: "5.4.296",
	};

	return {
		Document: (props: Record<string, unknown>) => {
			mockState.documentProps = props;
			return <div data-testid="pdf-document" />;
		},
		Page: () => <div />,
		pdfjs,
	};
});

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		...props
	}: {
		children?: React.ReactNode;
		[key: string]: unknown;
	}) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: () => <span />,
}));

vi.mock("@/components/ui/input", () => ({
	Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock("@/hooks/useBlobUrl", () => ({
	useBlobUrl: () => mockState.useBlobUrlResult,
}));

vi.mock("@/components/files/preview/PreviewError", () => ({
	PreviewError: () => <div>preview-error</div>,
}));

describe("PdfPreview", () => {
	beforeEach(() => {
		mockState.documentProps = null;
		mockState.useBlobUrlResult = {
			blobUrl: "blob:pdf-preview",
			error: false,
			loading: false,
			retry: mockState.retry,
		};
	});

	it("passes bundled pdf.js CMap options to the document loader", () => {
		render(<PdfPreview path="/api/files/1/download" fileName="manual.pdf" />);

		expect(screen.getByTestId("pdf-document")).toBeInTheDocument();
		expect(mockState.documentProps).toMatchObject({
			file: "blob:pdf-preview",
			options: {
				cMapPacked: true,
				cMapUrl: "/pdfjs/5.4.296/cmaps/",
			},
		});
	});
});
