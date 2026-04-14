interface RunWhenIdleOptions {
	fallbackDelayMs?: number;
	timeoutMs?: number;
}

const DEFAULT_FALLBACK_DELAY_MS = 240;
const DEFAULT_TIMEOUT_MS = 1200;

export function runWhenIdle(
	task: () => void,
	{
		fallbackDelayMs = DEFAULT_FALLBACK_DELAY_MS,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	}: RunWhenIdleOptions = {},
) {
	if (typeof window === "undefined") {
		return () => undefined;
	}

	const target = window;

	if (
		typeof target.requestIdleCallback === "function" &&
		typeof target.cancelIdleCallback === "function"
	) {
		const callbackId = target.requestIdleCallback(task, {
			timeout: timeoutMs,
		});
		return () => target.cancelIdleCallback(callbackId);
	}

	const timeoutId = globalThis.setTimeout(task, fallbackDelayMs);
	return () => globalThis.clearTimeout(timeoutId);
}
