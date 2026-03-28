import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileTypeIcon } from "@/components/files/FileTypeIcon";

vi.mock("@/components/files/preview/file-capabilities", () => ({
	getFileTypeInfo: vi.fn(() => ({
		icon: "FileText",
		color: "text-blue-500",
	})),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name, className }: { name: string; className?: string }) => (
		<span data-testid="icon" data-name={name} className={className} />
	),
}));

describe("FileTypeIcon", () => {
	it("renders the icon and color returned by file type detection", () => {
		render(
			<FileTypeIcon
				mimeType="application/pdf"
				fileName="manual.pdf"
				className="h-4 w-4"
			/>,
		);

		expect(screen.getByTestId("icon")).toHaveAttribute("data-name", "FileText");
		expect(screen.getByTestId("icon")).toHaveClass(
			"text-blue-500",
			"h-4",
			"w-4",
		);
	});
});
