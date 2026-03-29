import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShareTopBar } from "@/components/layout/ShareTopBar";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
	}),
}));

vi.mock("@/components/layout/TopBarShell", () => ({
	TopBarShell: ({
		left,
		right,
	}: {
		left: React.ReactNode;
		right: React.ReactNode;
	}) => (
		<div>
			<div>{left}</div>
			<div>{right}</div>
		</div>
	),
}));

describe("ShareTopBar", () => {
	it("renders the translated app logo alt text and share label", () => {
		render(<ShareTopBar />);

		expect(screen.getByAltText("translated:app_name")).toBeInTheDocument();
		expect(screen.getByText("translated:files:share")).toBeInTheDocument();
	});
});
