import { useCallback, useEffect, useState } from "react";

interface UseEnteredViewportOptions {
	enabled?: boolean;
	rootMargin?: string;
	threshold?: number | number[];
}

function findObserverRoot(node: Element) {
	const scrollAreaViewport = node.closest("[data-slot='scroll-area-viewport']");
	if (scrollAreaViewport instanceof Element) {
		return scrollAreaViewport;
	}

	let current = node.parentElement;
	while (current) {
		const style = window.getComputedStyle(current);
		const overflowY = style.overflowY;
		const overflowX = style.overflowX;
		const canScrollY =
			/(auto|scroll|overlay)/.test(overflowY) &&
			current.scrollHeight > current.clientHeight;
		const canScrollX =
			/(auto|scroll|overlay)/.test(overflowX) &&
			current.scrollWidth > current.clientWidth;

		if (canScrollY || canScrollX) {
			return current;
		}

		current = current.parentElement;
	}

	return null;
}

export function useEnteredViewport<T extends Element = HTMLDivElement>({
	enabled = true,
	rootMargin = "0px",
	threshold = 0,
}: UseEnteredViewportOptions = {}) {
	const [node, setNode] = useState<T | null>(null);
	const [hasEnteredViewport, setHasEnteredViewport] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setHasEnteredViewport(false);
			return;
		}

		if (hasEnteredViewport || !node) {
			return;
		}

		if (
			typeof window === "undefined" ||
			typeof window.IntersectionObserver === "undefined"
		) {
			setHasEnteredViewport(true);
			return;
		}

		const observer = new window.IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) {
					return;
				}

				setHasEnteredViewport(true);
				observer.disconnect();
			},
			{
				root: findObserverRoot(node),
				rootMargin,
				threshold,
			},
		);

		observer.observe(node);

		return () => observer.disconnect();
	}, [enabled, hasEnteredViewport, node, rootMargin, threshold]);

	const ref = useCallback((nextNode: T | null) => {
		setNode(nextNode);
	}, []);

	return {
		ref,
		hasEnteredViewport,
	};
}
