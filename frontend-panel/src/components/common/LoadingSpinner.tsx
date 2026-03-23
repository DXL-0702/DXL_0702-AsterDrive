import { Icon } from "@/components/ui/icon";

interface LoadingSpinnerProps {
	text?: string;
	className?: string;
}

export function LoadingSpinner({ text, className }: LoadingSpinnerProps) {
	return (
		<div
			className={`flex flex-col items-center justify-center py-16 ${className ?? ""}`}
		>
			<Icon
				name="Spinner"
				className="h-6 w-6 animate-spin text-muted-foreground"
			/>
			{text && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
		</div>
	);
}
