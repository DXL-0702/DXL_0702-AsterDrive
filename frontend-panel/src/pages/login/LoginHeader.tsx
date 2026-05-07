import { AnimateText } from "./authAnimations";

export function LoginHeader({
	description,
	title,
}: {
	description: string;
	title: string;
}) {
	return (
		<div className="mb-6 overflow-hidden">
			<h2 className="text-xl font-semibold tracking-tight">
				<AnimateText text={title} />
			</h2>
			<p className="mt-1 text-sm text-muted-foreground">
				<AnimateText text={description} />
			</p>
		</div>
	);
}
