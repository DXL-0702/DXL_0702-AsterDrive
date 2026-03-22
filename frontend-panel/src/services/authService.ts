import type { UserInfo } from "@/types/api";
import { api } from "./http";

export const authService = {
	login: (username: string, password: string) =>
		api.post<null>("/auth/login", { username, password }),

	register: (username: string, email: string, password: string) =>
		api.post<UserInfo>("/auth/register", { username, email, password }),

	logout: () => api.post<null>("/auth/logout"),

	me: () => api.get<UserInfo>("/auth/me"),
};
