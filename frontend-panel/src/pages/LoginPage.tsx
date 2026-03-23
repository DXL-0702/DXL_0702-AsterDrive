import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleApiError } from "@/hooks/useApiError";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";

// ── Zod schemas ─────────────────────────────────────────────

const identifierSchema = z.string().min(1, "required");
const usernameSchema = z.string().min(2, "min_2_chars").max(32, "max_32_chars");
const emailSchema = z.string().email("invalid_email");
const passwordSchema = z.string().min(6, "min_6_chars");

// ── Types ───────────────────────────────────────────────────

type AuthMode = "idle" | "login" | "register" | "setup";

interface FieldError {
	identifier?: string;
	username?: string;
	email?: string;
	password?: string;
}

// ── Component ───────────────────────────────────────────────

export default function LoginPage() {
	const { t } = useTranslation("auth");
	const navigate = useNavigate();
	const login = useAuthStore((s) => s.login);

	// Form state
	const [identifier, setIdentifier] = useState("");
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);

	// Auth mode (determined by check)
	const [mode, setMode] = useState<AuthMode>("idle");
	const [checking, setChecking] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [errors, setErrors] = useState<FieldError>({});

	// Debounce timer for auto-check
	const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastChecked = useRef("");

	// ── Auto check on identifier change (debounced) ──

	const runCheck = useCallback(async (value: string) => {
		const trimmed = value.trim();
		if (trimmed.length < 2 || trimmed === lastChecked.current) return;

		lastChecked.current = trimmed;
		setChecking(true);
		try {
			const result = await authService.check(trimmed);
			if (!result.has_users) {
				// First-time setup
				if (trimmed.includes("@")) {
					setEmail(trimmed);
					setUsername("");
				} else {
					setUsername(trimmed);
					setEmail("");
				}
				setMode("setup");
			} else if (result.exists) {
				setMode("login");
			} else {
				// New user registration
				if (trimmed.includes("@")) {
					setEmail(trimmed);
					setUsername("");
				} else {
					setUsername(trimmed);
					setEmail("");
				}
				setMode("register");
			}
		} catch {
			// Silently fail — user can still type
		} finally {
			setChecking(false);
		}
	}, []);

	useEffect(() => {
		if (checkTimer.current) clearTimeout(checkTimer.current);
		if (identifier.trim().length >= 2) {
			checkTimer.current = setTimeout(() => runCheck(identifier), 500);
		} else {
			setMode("idle");
			lastChecked.current = "";
		}
		return () => {
			if (checkTimer.current) clearTimeout(checkTimer.current);
		};
	}, [identifier, runCheck]);

	// ── Validation ──

	const validate = (): boolean => {
		const errs: FieldError = {};

		const idResult = identifierSchema.safeParse(identifier.trim());
		if (!idResult.success) errs.identifier = idResult.error.issues[0]?.message;

		if (mode === "register" || mode === "setup") {
			if (!username && !identifier.includes("@")) {
				// username was auto-filled from identifier
			} else if (mode === "register" && !identifier.includes("@")) {
				// username is identifier, check email
				const emailResult = emailSchema.safeParse(email);
				if (!emailResult.success) errs.email = emailResult.error.issues[0]?.message;
			} else if (mode === "register" && identifier.includes("@")) {
				const unResult = usernameSchema.safeParse(username);
				if (!unResult.success) errs.username = unResult.error.issues[0]?.message;
			}

			if (mode === "setup") {
				const unResult = usernameSchema.safeParse(username || identifier);
				if (!unResult.success && !username) errs.username = unResult.error.issues[0]?.message;
				const emResult = emailSchema.safeParse(email || (identifier.includes("@") ? identifier : ""));
				if (!emResult.success && !email) errs.email = emResult.error.issues[0]?.message;
			}
		}

		const pwResult = passwordSchema.safeParse(password);
		if (!pwResult.success) errs.password = pwResult.error.issues[0]?.message;

		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	// ── Submit ──

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		if (mode === "idle") {
			// Force check if not yet checked
			await runCheck(identifier);
			return;
		}

		setSubmitting(true);
		try {
			if (mode === "login") {
				await login(identifier.trim(), password);
				navigate("/", { replace: true });
			} else if (mode === "register") {
				const un = identifier.includes("@") ? username : identifier.trim();
				const em = identifier.includes("@") ? identifier.trim() : email;
				await authService.register(un, em, password);
				toast.success(t("register_success"));
				await login(identifier.trim(), password);
				navigate("/", { replace: true });
			} else if (mode === "setup") {
				const un = username || identifier.trim();
				const em = email || identifier.trim();
				await authService.setup(un, em, password);
				toast.success(t("setup_complete"));
				await login(em.includes("@") ? em : un, password);
				navigate("/", { replace: true });
			}
		} catch (error) {
			handleApiError(error);
		} finally {
			setSubmitting(false);
		}
	};

	// ── Derived state ──

	const isEmail = identifier.includes("@");

	const submitLabel = () => {
		if (submitting) {
			if (mode === "login") return t("signing_in");
			return t("creating_account");
		}
		if (mode === "setup") return t("create_admin");
		if (mode === "register") return t("sign_up");
		if (mode === "login") return t("sign_in");
		return t("continue");
	};

	const description = () => {
		if (mode === "setup") return t("setup_desc");
		if (mode === "register") return t("create_new_account");
		if (mode === "login") return t("enter_password");
		return t("sign_in_to_account");
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-2xl text-center">
						{mode === "setup" ? t("welcome_setup") : t("common:app_name")}
					</CardTitle>
					<CardDescription className="text-center">
						{description()}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-3">
						{/* Identifier — always visible */}
						<div className="space-y-1">
							<div className="relative">
								<Input
									placeholder={t("email_or_username")}
									value={identifier}
									onChange={(e) => setIdentifier(e.target.value)}
									required
									autoFocus
									className={errors.identifier ? "border-destructive" : ""}
								/>
								{checking && (
									<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
								)}
							</div>
							{errors.identifier && (
								<p className="text-xs text-destructive">{errors.identifier}</p>
							)}
						</div>

						{/* Username — shown when registering with email, or setup */}
						{(mode === "setup" || (mode === "register" && isEmail)) && (
							<div className="space-y-1">
								<Label className="text-xs">{t("username")}</Label>
								<Input
									placeholder={t("choose_username")}
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									required
									className={errors.username ? "border-destructive" : ""}
								/>
								{errors.username && (
									<p className="text-xs text-destructive">{errors.username}</p>
								)}
							</div>
						)}

						{/* Email — shown when registering with username, or setup */}
						{(mode === "setup" && !isEmail) || (mode === "register" && !isEmail) ? (
							<div className="space-y-1">
								<Label className="text-xs">{t("email")}</Label>
								<Input
									type="email"
									placeholder={t("email")}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									className={errors.email ? "border-destructive" : ""}
								/>
								{errors.email && (
									<p className="text-xs text-destructive">{errors.email}</p>
								)}
							</div>
						) : null}

						{/* Password — always visible */}
						<div className="space-y-1">
							<div className="relative">
								<Input
									type={showPassword ? "text" : "password"}
									placeholder={t("password")}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
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
							{errors.password && (
								<p className="text-xs text-destructive">{errors.password}</p>
							)}
						</div>

						{/* Submit */}
						<Button
							type="submit"
							className="w-full"
							disabled={submitting || checking}
						>
							{submitting ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : null}
							{submitLabel()}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
