import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";

const TASK_DETAILS_EXPAND_DURATION_MS = 280;
const TASK_DETAILS_COLLAPSE_DURATION_MS = 240;
const TASK_DETAILS_EXPAND_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const TASK_DETAILS_COLLAPSE_EASING = "cubic-bezier(0.32, 0, 0.67, 0.96)";

export function AnimatedTaskDetails({
	children,
	className,
	open,
}: {
	children: ReactNode;
	className?: string;
	open: boolean;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const [mounted, setMounted] = useState(open);

	useEffect(() => {
		if (typeof window === "undefined") {
			setMounted(open);
			return;
		}

		if (open) {
			setMounted(true);
		}
	}, [open]);

	useLayoutEffect(() => {
		if (typeof window === "undefined" || !mounted) {
			return;
		}

		const container = containerRef.current;
		const content = contentRef.current;
		if (!container || !content) {
			return;
		}

		const prefersReducedMotion =
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const duration = prefersReducedMotion
			? 0
			: open
				? TASK_DETAILS_EXPAND_DURATION_MS
				: TASK_DETAILS_COLLAPSE_DURATION_MS;
		let frameA: number | null = null;
		let frameB: number | null = null;
		let timer: number | null = null;
		const fullHeight = `${content.scrollHeight}px`;

		container.style.overflow = "hidden";
		container.style.transitionProperty = "max-height, opacity, transform";
		container.style.transitionDuration = `${duration}ms`;
		container.style.transitionTimingFunction = open
			? TASK_DETAILS_EXPAND_EASING
			: TASK_DETAILS_COLLAPSE_EASING;

		if (open) {
			container.style.maxHeight = "0px";
			container.style.opacity = "0";
			container.style.transform = "translateY(-6px)";
			frameA = window.requestAnimationFrame(() => {
				frameB = window.requestAnimationFrame(() => {
					container.style.maxHeight = fullHeight;
					container.style.opacity = "1";
					container.style.transform = "translateY(0)";
				});
			});
			timer = window.setTimeout(() => {
				container.style.maxHeight = "none";
				container.style.opacity = "1";
				container.style.transform = "translateY(0)";
			}, duration);
		} else {
			container.style.maxHeight = fullHeight;
			container.style.opacity = "1";
			container.style.transform = "translateY(0)";
			frameA = window.requestAnimationFrame(() => {
				container.style.maxHeight = "0px";
				container.style.opacity = "0";
				container.style.transform = "translateY(-6px)";
			});
			timer = window.setTimeout(() => {
				setMounted(false);
			}, duration);
		}

		return () => {
			if (frameA !== null) {
				window.cancelAnimationFrame(frameA);
			}
			if (frameB !== null) {
				window.cancelAnimationFrame(frameB);
			}
			if (timer !== null) {
				window.clearTimeout(timer);
			}
		};
	}, [mounted, open]);

	if (!mounted) {
		return null;
	}

	return (
		<div
			ref={containerRef}
			aria-hidden={!open}
			className={cn("overflow-hidden", className)}
		>
			<div ref={contentRef} className="min-h-0">
				{children}
			</div>
		</div>
	);
}
