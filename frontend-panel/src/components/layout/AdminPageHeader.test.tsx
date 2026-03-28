import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";

describe("AdminPageHeader", () => {
	it("renders title only when optional props are omitted", () => {
		render(<AdminPageHeader title="Users" />);

		expect(screen.getByText("Users")).toBeInTheDocument();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("renders description, actions, and toolbar when provided", () => {
		render(
			<AdminPageHeader
				title="Users"
				description="Manage user accounts"
				actions={<button type="button">Invite</button>}
				toolbar={<button type="button">Filters</button>}
			/>,
		);

		expect(screen.getByText("Manage user accounts")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Invite" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
	});
});
