import type { UserProfileInfo } from "@/types/api";

type UserLike =
	| {
			username?: string | null;
			profile?: Pick<UserProfileInfo, "display_name"> | null;
	  }
	| null
	| undefined;

export function getNormalizedDisplayName(
	displayName?: string | null,
): string | null {
	const normalized = displayName?.trim();
	return normalized ? normalized : null;
}

export function getUserDisplayName(user: UserLike): string {
	return (
		getNormalizedDisplayName(user?.profile?.display_name) ??
		user?.username ??
		"user"
	);
}
