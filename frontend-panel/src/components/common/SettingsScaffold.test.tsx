import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	SettingsChoiceGroup,
	SettingsPageIntro,
	SettingsRow,
	SettingsSection,
} from "@/components/common/SettingsScaffold";

vi.mock("@/components/ui/card", () => ({
	Card: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
	}) => (
		<section data-testid="card" className={className}>
			{children}
		</section>
	),
	CardHeader: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
	}) => <div className={className}>{children}</div>,
	CardTitle: ({ children }: { children: React.ReactNode }) => (
		<h2>{children}</h2>
	),
	CardDescription: ({ children }: { children: React.ReactNode }) => (
		<p>{children}</p>
	),
	CardContent: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
	}) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name }: { name: string }) => (
		<span data-testid="icon" data-name={name} />
	),
}));

describe("SettingsScaffold", () => {
	it("renders the page intro with an optional description", () => {
		const { rerender } = render(
			<SettingsPageIntro title="Preferences" description="Manage settings" />,
		);

		expect(screen.getByText("Preferences")).toBeInTheDocument();
		expect(screen.getByText("Manage settings")).toBeInTheDocument();

		rerender(<SettingsPageIntro title="Preferences" />);
		expect(screen.queryByText("Manage settings")).not.toBeInTheDocument();
	});

	it("renders a settings section with action and custom content class", () => {
		render(
			<SettingsSection
				title="Appearance"
				description="Change how the app looks"
				action={<button type="button">Reset</button>}
				contentClassName="space-y-4"
			>
				<div>Body</div>
			</SettingsSection>,
		);

		expect(screen.getByText("Appearance")).toBeInTheDocument();
		expect(screen.getByText("Change how the app looks")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
		expect(screen.getByText("Body").parentElement).toHaveClass("space-y-4");
	});

	it("renders a settings row with optional description and control class", () => {
		render(
			<SettingsRow
				label="Theme"
				description="Choose a theme"
				controlClassName="max-w-xs"
			>
				<select aria-label="Theme">
					<option>Light</option>
				</select>
			</SettingsRow>,
		);

		expect(screen.getByText("Theme")).toBeInTheDocument();
		expect(screen.getByText("Choose a theme")).toBeInTheDocument();
		expect(screen.getByLabelText("Theme").parentElement).toHaveClass(
			"max-w-xs",
		);
	});

	it("renders choice options and reports selection changes", () => {
		const onChange = vi.fn();

		render(
			<SettingsChoiceGroup
				value="system"
				onChange={onChange}
				options={[
					{ value: "light", label: "Light", icon: "Sun" },
					{ value: "system", label: "System", icon: "Monitor" },
				]}
			/>,
		);

		const systemButton = screen.getByRole("button", { name: /System/i });
		const lightButton = screen.getByRole("button", { name: /Light/i });

		expect(systemButton).toHaveAttribute("aria-pressed", "true");
		expect(lightButton).toHaveAttribute("aria-pressed", "false");
		expect(screen.getAllByTestId("icon")).toHaveLength(2);

		fireEvent.click(lightButton);

		expect(onChange).toHaveBeenCalledWith("light");
	});
});
