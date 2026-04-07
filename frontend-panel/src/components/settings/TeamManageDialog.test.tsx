import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamManageDialog } from "@/components/settings/TeamManageDialog";

const mockState = vi.hoisted(() => ({
	handleApiError: vi.fn(),
	navigate: vi.fn(),
}));

const teamServiceMocks = vi.hoisted(() => ({
	addMember: vi.fn(),
	delete: vi.fn(),
	get: vi.fn(),
	listAuditLogs: vi.fn(),
	listMembers: vi.fn(),
	removeMember: vi.fn(),
	update: vi.fn(),
	updateMember: vi.fn(),
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("react-router-dom", () => ({
	useNavigate: () => mockState.navigate,
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("@/hooks/useApiError", () => ({
	handleApiError: (...args: unknown[]) => mockState.handleApiError(...args),
}));

vi.mock("@/services/teamService", () => ({
	teamService: teamServiceMocks,
}));

describe("TeamManageDialog", () => {
	beforeEach(() => {
		mockState.handleApiError.mockReset();
		mockState.navigate.mockReset();
		teamServiceMocks.addMember.mockReset();
		teamServiceMocks.delete.mockReset();
		teamServiceMocks.get.mockReset();
		teamServiceMocks.listAuditLogs.mockReset();
		teamServiceMocks.listMembers.mockReset();
		teamServiceMocks.removeMember.mockReset();
		teamServiceMocks.update.mockReset();
		teamServiceMocks.updateMember.mockReset();

		teamServiceMocks.get.mockResolvedValue({
			created_at: "2026-04-01T00:00:00Z",
			created_by: 1,
			created_by_username: "owner",
			description: "Team description",
			id: 11,
			member_count: 8,
			my_role: "owner",
			name: "Product",
			storage_quota: 1024,
			storage_used: 512,
		});
		teamServiceMocks.listMembers.mockResolvedValue({
			items: [],
			manager_count: 1,
			owner_count: 1,
			total: 0,
		});
		teamServiceMocks.listAuditLogs.mockResolvedValue({
			items: [],
			total: 0,
		});
	});

	it("uses a fixed shell and a native scrollable detail column in page layout", async () => {
		const { container } = render(
			<TeamManageDialog
				layout="page"
				currentUserId={1}
				onArchivedReload={async () => undefined}
				onOpenChange={vi.fn()}
				onPageTabChange={vi.fn()}
				onTeamsReload={async () => undefined}
				open
				pageTab="overview"
				teamId={11}
				teamSummary={{
					created_at: "2026-04-01T00:00:00Z",
					created_by: 1,
					created_by_username: "owner",
					description: "Team description",
					id: 11,
					member_count: 8,
					my_role: "owner",
					name: "Product",
					storage_quota: 1024,
					storage_used: 512,
				}}
			/>,
		);

		await waitFor(() => {
			expect(teamServiceMocks.get).toHaveBeenCalledWith(11);
			expect(teamServiceMocks.listMembers).toHaveBeenCalled();
			expect(teamServiceMocks.listAuditLogs).toHaveBeenCalled();
		});

		expect(
			container.querySelector(
				".flex.min-h-0.flex-1.flex-col.overflow-y-auto.lg\\:overflow-hidden",
			),
		).not.toBeNull();
		expect(
			container.querySelector(
				".flex.min-h-full.flex-col.lg\\:h-full.lg\\:min-h-0.lg\\:flex-1.lg\\:flex-row",
			),
		).not.toBeNull();
		expect(
			container.querySelector(
				".border-b.bg-muted\\/20.lg\\:min-h-0.lg\\:w-80.lg\\:flex-none.lg\\:overflow-y-auto",
			),
		).not.toBeNull();
		expect(
			container.querySelector(
				".min-h-0.min-w-0.lg\\:flex-1.flex.h-full.flex-col.overflow-hidden",
			),
		).not.toBeNull();
		expect(
			container.querySelector(".flex.min-h-0.flex-1.flex-col.overflow-hidden"),
		).not.toBeNull();
		expect(
			container.querySelector(".min-h-0.flex-1.overflow-y-auto.px-6.pt-4.pb-6"),
		).not.toBeNull();
		expect(container.querySelector('[data-slot="scroll-area"]')).toBeNull();
	});

	it("restores the sidebar scroll position after switching tabs", async () => {
		const initialRender = render(
			<TeamManageDialog
				layout="page"
				currentUserId={1}
				onArchivedReload={async () => undefined}
				onOpenChange={vi.fn()}
				onPageTabChange={vi.fn()}
				onTeamsReload={async () => undefined}
				open
				pageTab="overview"
				teamId={11}
				teamSummary={{
					created_at: "2026-04-01T00:00:00Z",
					created_by: 1,
					created_by_username: "owner",
					description: "Team description",
					id: 11,
					member_count: 8,
					my_role: "owner",
					name: "Product",
					storage_quota: 1024,
					storage_used: 512,
				}}
			/>,
		);

		await waitFor(() => {
			expect(teamServiceMocks.get).toHaveBeenCalledWith(11);
		});

		const sidebar = initialRender.container.querySelector("aside");
		if (!(sidebar instanceof HTMLElement)) {
			throw new Error("Expected sidebar element");
		}

		sidebar.scrollTop = 144;
		fireEvent.scroll(sidebar);
		initialRender.unmount();

		const nextRender = render(
			<TeamManageDialog
				layout="page"
				currentUserId={1}
				onArchivedReload={async () => undefined}
				onOpenChange={vi.fn()}
				onPageTabChange={vi.fn()}
				onTeamsReload={async () => undefined}
				open
				pageTab="members"
				teamId={11}
				teamSummary={{
					created_at: "2026-04-01T00:00:00Z",
					created_by: 1,
					created_by_username: "owner",
					description: "Team description",
					id: 11,
					member_count: 8,
					my_role: "owner",
					name: "Product",
					storage_quota: 1024,
					storage_used: 512,
				}}
			/>,
		);

		const restoredSidebar = nextRender.container.querySelector("aside");
		if (!(restoredSidebar instanceof HTMLElement)) {
			throw new Error("Expected restored sidebar element");
		}

		await waitFor(() => {
			expect(restoredSidebar.scrollTop).toBe(144);
		});
	});
});
