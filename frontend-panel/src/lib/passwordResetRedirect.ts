export type PasswordResetRedirectStatus = "success";

const STATUSES = new Set<PasswordResetRedirectStatus>(["success"]);

export interface PasswordResetRedirectState {
	status: PasswordResetRedirectStatus;
}

export function getPasswordResetRedirectState(
	search: string,
): PasswordResetRedirectState | null {
	const params = new URLSearchParams(search);
	const status = params.get("password_reset")?.trim();
	if (!status || !STATUSES.has(status as PasswordResetRedirectStatus)) {
		return null;
	}

	return {
		status: status as PasswordResetRedirectStatus,
	};
}

export function clearPasswordResetRedirectSearch(search: string) {
	const params = new URLSearchParams(search);
	params.delete("password_reset");
	const next = params.toString();
	return next ? `?${next}` : "";
}
