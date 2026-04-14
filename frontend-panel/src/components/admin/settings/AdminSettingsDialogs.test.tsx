import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	MailTemplateVariablesDialog,
	TestEmailDialog,
} from "@/components/admin/settings/AdminSettingsDialogs";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (
				key === "mail_template_variables_dialog_title" &&
				typeof options?.name === "string"
			) {
				return `mail_template_variables_dialog_title:${options.name}`;
			}
			return key;
		},
	}),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		disabled,
		onClick,
		type,
		...props
	}: {
		children: React.ReactNode;
		disabled?: boolean;
		onClick?: () => void;
		type?: "button" | "submit";
		[key: string]: unknown;
	}) => (
		<button
			type={type ?? "button"}
			disabled={disabled}
			onClick={onClick}
			{...props}
		>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
		open ? <div>{children}</div> : null,
	DialogContent: ({ children }: { children: React.ReactNode }) => (
		<div role="dialog">{children}</div>
	),
	DialogDescription: ({ children }: { children: React.ReactNode }) => (
		<p>{children}</p>
	),
	DialogFooter: ({
		children,
		showCloseButton,
	}: {
		children?: React.ReactNode;
		showCloseButton?: boolean;
	}) => (
		<div>
			{children}
			{showCloseButton ? <button type="button">close</button> : null}
		</div>
	),
	DialogHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogTitle: ({ children }: { children: React.ReactNode }) => (
		<h2>{children}</h2>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: ({
		onChange,
		value,
		...props
	}: {
		onChange?: (event: { target: { value: string } }) => void;
		value?: string;
		[key: string]: unknown;
	}) => (
		<input
			{...props}
			value={value}
			onChange={(event) =>
				onChange?.({ target: { value: event.target.value } })
			}
		/>
	),
}));

const activeGroup = {
	category: "mail.template",
	label_i18n_key: "group.label",
	template_code: "password_reset",
	variables: [
		{
			description_i18n_key: "variable.username.desc",
			label_i18n_key: "variable.username.label",
			token: "{{username}}",
		},
		{
			description_i18n_key: undefined,
			label_i18n_key: "variable.reset_link.label",
			token: "{{reset_link}}",
		},
	],
};

describe("AdminSettingsDialogs", () => {
	it("renders the template variable list only when a group is active", () => {
		const getVariableDescription = vi.fn((variable) =>
			variable.token === "{{username}}" ? "Current account name" : undefined,
		);
		const getVariableGroupLabel = vi.fn(() => "Password Reset");
		const getVariableLabel = vi.fn((variable) =>
			variable.token === "{{username}}" ? "Username" : "Reset Link",
		);

		const { rerender } = render(
			<MailTemplateVariablesDialog
				activeGroup={activeGroup}
				activeGroupCode="password_reset"
				getVariableDescription={getVariableDescription}
				getVariableGroupLabel={getVariableGroupLabel}
				getVariableLabel={getVariableLabel}
				onOpenChange={vi.fn()}
			/>,
		);

		expect(
			screen.getByText("mail_template_variables_dialog_title:Password Reset"),
		).toBeInTheDocument();
		expect(screen.getByText("{{username}}")).toBeInTheDocument();
		expect(screen.getByText("Username")).toBeInTheDocument();
		expect(screen.getByText("Current account name")).toBeInTheDocument();
		expect(screen.getByText("{{reset_link}}")).toBeInTheDocument();
		expect(screen.getByText("Reset Link")).toBeInTheDocument();

		rerender(
			<MailTemplateVariablesDialog
				activeGroup={null}
				activeGroupCode={null}
				getVariableDescription={getVariableDescription}
				getVariableGroupLabel={getVariableGroupLabel}
				getVariableLabel={getVariableLabel}
				onOpenChange={vi.fn()}
			/>,
		);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("updates the test email recipient and wires cancel/send actions", () => {
		const onOpenChange = vi.fn();
		const onSend = vi.fn();
		const onTargetChange = vi.fn();

		render(
			<TestEmailDialog
				open
				sending={false}
				target="admin@example.com"
				onOpenChange={onOpenChange}
				onSend={onSend}
				onTargetChange={onTargetChange}
			/>,
		);

		fireEvent.change(
			screen.getByPlaceholderText("mail_test_email_recipient_placeholder"),
			{
				target: { value: "ops@example.com" },
			},
		);
		fireEvent.click(
			screen.getByRole("button", { name: "mail_send_test_email" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "core:cancel" }));

		expect(onTargetChange).toHaveBeenCalledWith("ops@example.com");
		expect(onSend).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
