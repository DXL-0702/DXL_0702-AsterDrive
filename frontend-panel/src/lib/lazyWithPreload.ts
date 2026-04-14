import { type ComponentType, type LazyExoticComponent, lazy } from "react";

type LazyModule<T extends ComponentType<any>> = {
	default: T;
};

export type PreloadableLazyComponent<T extends ComponentType<any>> =
	LazyExoticComponent<T> & {
		preload: () => Promise<LazyModule<T>>;
	};

export function lazyWithPreload<T extends ComponentType<any>>(
	load: () => Promise<LazyModule<T>>,
): PreloadableLazyComponent<T> {
	let cachedPromise: Promise<LazyModule<T>> | null = null;

	const preload = () => {
		cachedPromise ??= load();
		return cachedPromise;
	};

	const LazyComponent = lazy(preload) as PreloadableLazyComponent<T>;
	LazyComponent.preload = preload;
	return LazyComponent;
}
