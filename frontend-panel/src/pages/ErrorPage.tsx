import {
	isRouteErrorResponse,
	useNavigate,
	useRouteError,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export default function ErrorPage() {
	const error = useRouteError();
	const navigate = useNavigate();

	let status: number | null = null;
	let message = "An unexpected error occurred.";

	if (isRouteErrorResponse(error)) {
		status = error.status;
		message = error.statusText || message;
	} else if (error instanceof Error) {
		message = error.message;
	}

	return (
		<div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center">
			<Icon name="CircleAlert" className="h-12 w-12 text-muted-foreground" />
			{status && <p className="text-5xl font-bold">{status}</p>}
			<p className="text-muted-foreground">{message}</p>
			<Button variant="outline" onClick={() => navigate("/")}>
				<Icon name="House" className="mr-2 h-4 w-4" />
				Go Home
			</Button>
		</div>
	);
}
