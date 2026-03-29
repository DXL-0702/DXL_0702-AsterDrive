export interface NormalizedS3ConnectionFields {
	endpoint: string;
	bucket: string;
}

export function isPublicR2DevUrl(endpoint: string): boolean {
	const trimmedEndpoint = endpoint.trim();
	if (!trimmedEndpoint) {
		return false;
	}

	try {
		const url = new URL(trimmedEndpoint);
		return url.hostname === "r2.dev" || url.hostname.endsWith(".r2.dev");
	} catch {
		return false;
	}
}

export function normalizeS3ConnectionFields(
	endpoint: string,
	bucket: string,
): NormalizedS3ConnectionFields {
	const trimmedEndpoint = endpoint.trim();
	const trimmedBucket = bucket.trim();

	if (!trimmedEndpoint) {
		return {
			endpoint: trimmedEndpoint,
			bucket: trimmedBucket,
		};
	}

	let url: URL;
	try {
		url = new URL(trimmedEndpoint);
	} catch {
		return {
			endpoint: trimmedEndpoint,
			bucket: trimmedBucket,
		};
	}

	if (!isR2ApiHost(url.hostname) || url.search || url.hash) {
		return {
			endpoint: trimmedEndpoint,
			bucket: trimmedBucket,
		};
	}

	const path = url.pathname.replace(/^\/+|\/+$/g, "");
	if (!path || path.includes("/")) {
		return {
			endpoint: trimmedEndpoint,
			bucket: trimmedBucket,
		};
	}

	if (trimmedBucket && trimmedBucket !== path) {
		return {
			endpoint: trimmedEndpoint,
			bucket: trimmedBucket,
		};
	}

	return {
		endpoint: `${url.protocol}//${url.host}`,
		bucket: path,
	};
}

function isR2ApiHost(hostname: string): boolean {
	return (
		hostname === "r2.cloudflarestorage.com" ||
		hostname.endsWith(".r2.cloudflarestorage.com")
	);
}
