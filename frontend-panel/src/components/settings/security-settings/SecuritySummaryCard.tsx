import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import type { MeResponse } from "@/types/api";

interface SecuritySummaryCardProps {
	user: MeResponse | null;
}

export function SecuritySummaryCard({ user }: SecuritySummaryCardProps) {
	const { t } = useTranslation(["auth", "core", "settings"]);

	return (
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
							{t("settings:settings_email_summary")}
						</p>
						<p className="text-sm text-muted-foreground">
							{user?.pending_email
								? t("settings:settings_email_pending_desc", {
										email: user.pending_email,
									})
								: user?.email_verified
									? t("settings:settings_email_summary_verified", {
											email: user.email,
										})
									: t("settings:settings_email_summary_unverified", {
											email: user?.email ?? "",
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
	);
}
