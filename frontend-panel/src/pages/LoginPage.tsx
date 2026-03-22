import { Eye, EyeOff } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { handleApiError } from "@/hooks/useApiError";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";

export default function LoginPage() {
	const { t } = useTranslation("auth");
	const [mode, setMode] = useState<"login" | "register">("login");
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const login = useAuthStore((s) => s.login);
	const navigate = useNavigate();

	const resetForm = () => {
		setUsername("");
		setEmail("");
		setPassword("");
	};

	const handleLogin = async (e: FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			await login(username, password);
			navigate("/", { replace: true });
		} catch (error) {
			handleApiError(error);
		} finally {
			setLoading(false);
		}
	};

	const handleRegister = async (e: FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			await authService.register(username, email, password);
			toast.success(t("register_success"));
			// Auto-login after registration
			await login(username, password);
			navigate("/", { replace: true });
		} catch (error) {
			handleApiError(error);
		} finally {
			setLoading(false);
		}
	};

	const switchMode = () => {
		resetForm();
		setMode(mode === "login" ? "register" : "login");
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-2xl text-center">
						{t("common:app_name")}
					</CardTitle>
					<CardDescription className="text-center">
						{mode === "login"
							? t("sign_in_to_account")
							: t("create_new_account")}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={mode === "login" ? handleLogin : handleRegister}
						className="space-y-4"
					>
						<Input
							placeholder={t("username")}
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							required
							autoFocus
						/>
						{mode === "register" && (
							<Input
								type="email"
								placeholder={t("email")}
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						)}
						<div className="relative">
							<Input
								type={showPassword ? "text" : "password"}
								placeholder={t("password")}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								className="pr-10"
							/>
							<button
								type="button"
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								onClick={() => setShowPassword(!showPassword)}
								tabIndex={-1}
								aria-label={
									showPassword
										? t("common:hide_password")
										: t("common:show_password")
								}
							>
								{showPassword ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
							</button>
						</div>
						<Button type="submit" className="w-full" disabled={loading}>
							{loading
								? mode === "login"
									? t("signing_in")
									: t("creating_account")
								: mode === "login"
									? t("sign_in")
									: t("sign_up")}
						</Button>
					</form>
					<div className="mt-4 text-center text-sm text-muted-foreground">
						{mode === "login"
							? t("dont_have_account")
							: t("already_have_account")}{" "}
						<button
							type="button"
							className="text-primary underline-offset-4 hover:underline"
							onClick={switchMode}
						>
							{mode === "login" ? t("sign_up") : t("sign_in")}
						</button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
