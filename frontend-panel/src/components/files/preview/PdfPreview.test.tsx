import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfPreview } from "@/components/files/preview/PdfPreview";

const mockState = vi.hoisted(() => ({
	documentProps: null as Record<string, unknown> | null,
	pageProps: [] as Record<string, unknown>[],
	retry: vi.fn(),
	blob: new Blob(["pdf"]),
	useBlobUrlResult: {
		blob: new Blob(["pdf"]),
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
		Document: ({
			children,
			...props
		}: Record<string, unknown> & { children?: React.ReactNode }) => {
			mockState.documentProps = props;
			return <div data-testid="pdf-document">{children}</div>;
		},
		Page: (props: Record<string, unknown>) => {
			mockState.pageProps.push(props);
			return <div data-testid={`pdf-page-${props.pageNumber}`} />;
		},
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
		mockState.pageProps = [];
		mockState.blob = new Blob(["pdf"]);
		mockState.useBlobUrlResult = {
			blob: mockState.blob,
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
			file: mockState.blob,
			options: {
				cMapPacked: true,
				cMapUrl: "/pdfjs/5.4.296/cmaps/",
			},
		});
	});

	it("keeps enlarged pages in the horizontal scroll range", () => {
		render(<PdfPreview path="/api/files/1/download" fileName="manual.pdf" />);

		const onDocumentLoadSuccess = mockState.documentProps?.onLoadSuccess;
		if (typeof onDocumentLoadSuccess !== "function") {
			throw new Error("document load handler was not registered");
		}
		act(() => {
			onDocumentLoadSuccess({ numPages: 1 });
		});

		expect(screen.getByTestId("pdf-page-1")).toBeInTheDocument();
		expect(mockState.pageProps[0]).toMatchObject({
			pageNumber: 1,
			width: 800,
		});
		expect(
			screen.getByTestId("pdf-page-1").parentElement?.parentElement,
		).toHaveStyle({
			minWidth: "800px",
		});
	});
});
