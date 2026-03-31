import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingsSection } from "@/components/common/SettingsScaffold";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleApiError } from "@/hooks/useApiError";
import { passwordSchema } from "@/lib/validation";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";

type FormErrors = Partial<
	Record<"confirmPassword" | "currentPassword" | "newPassword", string>
>;

export function SecuritySettingsView() {
	const { t } = useTranslation(["core", "settings"]);
	const user = useAuthStore((s) => s.user);
	const syncSession = useAuthStore((s) => s.syncSession);
	const [busy, setBusy] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [errors, setErrors] = useState<FormErrors>({});

	const canSubmit =
		!busy &&
		currentPassword.length > 0 &&
		newPassword.length > 0 &&
		confirmPassword.length > 0;

	const validate = () => {
		const nextErrors: FormErrors = {};
		const currentResult = passwordSchema.safeParse(currentPassword);
		if (!currentResult.success) {
			nextErrors.currentPassword = currentResult.error.issues[0]?.message ?? "";
		}

		const newResult = passwordSchema.safeParse(newPassword);
		if (!newResult.success) {
			nextErrors.newPassword = newResult.error.issues[0]?.message ?? "";
		}

		const confirmResult = passwordSchema.safeParse(confirmPassword);
		if (!confirmResult.success) {
			nextErrors.confirmPassword = confirmResult.error.issues[0]?.message ?? "";
		} else if (confirmPassword !== newPassword) {
			nextErrors.confirmPassword = t(
				"settings:settings_password_confirm_mismatch",
			);
		}

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!validate()) return;

		try {
			setBusy(true);
			const session = await authService.changePassword({
				current_password: currentPassword,
				new_password: newPassword,
			});
			syncSession(session.expiresIn);
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setErrors({});
			toast.success(t("settings:settings_password_updated"));
		} catch (error) {
			handleApiError(error);
		} finally {
			setBusy(false);
		}
	};

	return (
		<SettingsSection
			title={t("settings:settings_security")}
			description={t("settings:settings_security_desc")}
			contentClassName="pt-4"
		>
			<form
				className="grid gap-5 rounded-xl border bg-muted/20 p-4 lg:grid-cols-[minmax(0,1fr)_280px]"
				onSubmit={(event) => void handleSubmit(event)}
			>
				<div className="space-y-4 rounded-xl border bg-background p-4">
					<div className="space-y-1">
						<h3 className="text-sm font-semibold">
							{t("settings:settings_password_section")}
						</h3>
						<p className="text-sm text-muted-foreground">
							{t("settings:settings_password_section_desc")}
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="current-password">
							{t("settings:settings_password_current")}
						</Label>
						<Input
							id="current-password"
							type="password"
							value={currentPassword}
							disabled={busy}
							aria-invalid={errors.currentPassword ? true : undefined}
							aria-label={t("settings:settings_password_current")}
							autoComplete="current-password"
							onChange={(event) => {
								setCurrentPassword(event.target.value);
								setErrors((prev) => ({ ...prev, currentPassword: undefined }));
							}}
						/>
						{errors.currentPassword ? (
							<p className="text-xs text-destructive">
								{errors.currentPassword}
							</p>
						) : null}
					</div>

					<div className="space-y-2">
						<Label htmlFor="new-password">
							{t("settings:settings_password_new")}
						</Label>
						<Input
							id="new-password"
							type="password"
							value={newPassword}
							disabled={busy}
							aria-invalid={errors.newPassword ? true : undefined}
							aria-label={t("settings:settings_password_new")}
							autoComplete="new-password"
							onChange={(event) => {
								setNewPassword(event.target.value);
								setErrors((prev) => ({ ...prev, newPassword: undefined }));
							}}
						/>
						<p className="text-xs text-muted-foreground">
							{t("settings:settings_password_hint")}
						</p>
						{errors.newPassword ? (
							<p className="text-xs text-destructive">{errors.newPassword}</p>
						) : null}
					</div>

					<div className="space-y-2">
						<Label htmlFor="confirm-password">
							{t("settings:settings_password_confirm")}
						</Label>
						<Input
							id="confirm-password"
							type="password"
							value={confirmPassword}
							disabled={busy}
							aria-invalid={errors.confirmPassword ? true : undefined}
							aria-label={t("settings:settings_password_confirm")}
							autoComplete="new-password"
							onChange={(event) => {
								setConfirmPassword(event.target.value);
								setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
							}}
						/>
						{errors.confirmPassword ? (
							<p className="text-xs text-destructive">
								{errors.confirmPassword}
							</p>
						) : null}
					</div>

					<div className="flex justify-end border-t pt-4">
						<Button type="submit" className="min-w-28" disabled={!canSubmit}>
							{t("save")}
						</Button>
					</div>
				</div>

				<div className="rounded-xl border bg-background p-4">
					<div className="flex items-start gap-3">
						<div className="rounded-lg bg-primary/10 p-2 text-primary">
							<Icon name="Shield" className="h-4 w-4" />
						</div>
						<div className="space-y-3">
							<div className="space-y-1">
								<p className="text-sm font-semibold">
									{t("settings:settings_security_account")}
								</p>
								<p className="text-sm text-muted-foreground">
									{t("settings:settings_security_account_desc", {
										username: user?.username ?? "",
									})}
								</p>
							</div>
							<div className="space-y-1 border-t pt-3">
								<p className="text-sm font-semibold">
									{t("settings:settings_security_session")}
								</p>
								<p className="text-sm text-muted-foreground">
									{t("settings:settings_security_session_desc")}
								</p>
							</div>
						</div>
					</div>
				</div>
			</form>
		</SettingsSection>
	);
}
