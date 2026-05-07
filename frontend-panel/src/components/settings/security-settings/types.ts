export type SecurityFormErrors = Partial<
	Record<
		"confirmPassword" | "currentPassword" | "email" | "newPassword",
		string
	>
>;
