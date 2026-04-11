import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface PreviewAppIconProps {
	icon?: string | null;
	fallback?: string | null;
	className?: string;
	alt?: string;
}

const ICON_URL_PATTERN =
	/^(https?:\/\/|\/\/|\/(?!\/)|\.\/|\.\.\/|data:image\/|blob:)/i;

function isPreviewAppIconUrl(value: string) {
	return ICON_URL_PATTERN.test(value.trim());
}

export function PreviewAppIcon({
	icon,
	fallback = "",
	className,
	alt = "",
}: PreviewAppIconProps) {
	const value = icon?.trim() ?? "";
	const fallbackValue = fallback?.trim() ?? "";
	const [failedSources, setFailedSources] = useState<Record<string, true>>({});
	const sourceKey = `${value}\u0000${fallbackValue}`;
	const previousSourceKeyRef = useRef(sourceKey);

	useEffect(() => {
		if (previousSourceKeyRef.current === sourceKey) {
			return;
		}
		previousSourceKeyRef.current = sourceKey;
		setFailedSources({});
	}, [sourceKey]);

	const candidates = [value, fallbackValue, "File"].filter(
		(candidate, index, items) =>
			candidate.length > 0 && items.indexOf(candidate) === index,
	);

	for (const candidate of candidates) {
		if (isPreviewAppIconUrl(candidate)) {
			if (failedSources[candidate]) {
				continue;
			}
			return (
				<img
					src={candidate}
					alt={alt}
					loading="lazy"
					decoding="async"
					className={cn("shrink-0 object-contain", className)}
					onError={() =>
						setFailedSources((current) => ({
							...current,
							[candidate]: true,
						}))
					}
				/>
			);
		}
	}

	return (
		<Icon
			name="File"
			className={className}
			aria-hidden={alt ? undefined : true}
		/>
	);
}
