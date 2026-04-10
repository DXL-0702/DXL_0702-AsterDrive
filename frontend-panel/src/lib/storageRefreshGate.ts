let activeGateCount = 0;
let pendingRefresh = false;

export function enterStorageRefreshGate() {
	activeGateCount += 1;
}

export function leaveStorageRefreshGate() {
	activeGateCount = Math.max(0, activeGateCount - 1);
}

export function isStorageRefreshGateActive() {
	return activeGateCount > 0;
}

export function deferStorageRefresh() {
	pendingRefresh = true;
}

export function consumeDeferredStorageRefresh() {
	const next = pendingRefresh;
	pendingRefresh = false;
	return next;
}

export function clearDeferredStorageRefresh() {
	pendingRefresh = false;
}
