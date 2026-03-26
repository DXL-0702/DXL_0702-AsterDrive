import type { DragEvent } from "react";
import { DRAG_MIME } from "@/lib/constants";

export interface InternalDragData {
	fileIds: number[];
	folderIds: number[];
}

interface DragPreviewOptions {
	itemCount?: number;
	variant?: "default" | "grid-card";
}

function themeColor(token: string, alpha: number) {
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue(token)
		.trim();
	if (!value) {
		return `rgba(255, 255, 255, ${alpha})`;
	}
	return `hsl(${value} / ${alpha})`;
}

function createDragPreview(source: HTMLElement, options: DragPreviewOptions) {
	const preview = source.cloneNode(true);
	if (!(preview instanceof HTMLElement)) return null;

	const rect = source.getBoundingClientRect();
	const host = document.createElement("div");
	host.style.position = "fixed";
	host.style.top = "-9999px";
	host.style.left = "-9999px";
	host.style.width = `${rect.width + 24}px`;
	host.style.padding = "12px";
	host.style.pointerEvents = "none";
	host.style.margin = "0";
	host.style.background = "transparent";
	host.style.overflow = "visible";
	host.style.zIndex = "2147483647";

	preview.style.width = `${rect.width}px`;
	preview.style.maxWidth = `${rect.width}px`;
	preview.style.pointerEvents = "none";
	preview.style.margin = "0";
	preview.style.transform = "scale(0.98)";
	preview.style.transformOrigin = "top left";
	preview.style.opacity = "0.96";
	preview.style.boxShadow = "none";

	if (options.variant === "grid-card") {
		preview.style.background = themeColor("--card", 0.86);
		preview.style.backdropFilter = "blur(20px) saturate(1.12)";
		preview.style.setProperty(
			"-webkit-backdrop-filter",
			"blur(20px) saturate(1.12)",
		);
		preview.style.border = `1px solid ${themeColor("--foreground", 0.16)}`;
		preview.style.borderRadius = "0.9rem";
		preview.style.padding = "0.75rem";
		preview.style.display = "flex";
		preview.style.flexDirection = "column";
		preview.style.alignItems = "center";
		preview.style.justifyContent = "flex-start";
		preview.style.gap = "0.625rem";
		preview.style.minHeight = "9.5rem";
		preview.style.overflow = "hidden";

		const hiddenNodes = preview.querySelectorAll("[data-drag-preview-hidden]");
		for (const node of hiddenNodes) {
			if (node instanceof HTMLElement) {
				node.style.display = "none";
			}
		}

		const media = preview.querySelector("[data-drag-preview-media]");
		if (media instanceof HTMLElement) {
			media.style.width = "100%";
			media.style.height = "5rem";
			media.style.margin = "0";
			media.style.flexShrink = "0";
			media.style.borderRadius = "0.75rem";
			media.style.overflow = "hidden";
			media.style.background = themeColor("--muted", 0.72);
			media.style.border = `1px solid ${themeColor("--foreground", 0.06)}`;
		}

		const name = preview.querySelector("[data-drag-preview-name]");
		if (name instanceof HTMLElement) {
			name.style.width = "100%";
			name.style.margin = "0";
			name.style.display = "block";
			name.style.textAlign = "center";
			name.style.whiteSpace = "nowrap";
			name.style.overflow = "hidden";
			name.style.textOverflow = "ellipsis";
			name.style.lineHeight = "1.25rem";
			name.style.fontSize = "0.875rem";
			name.style.fontWeight = "500";
		}

		if ((options.itemCount ?? 1) > 1) {
			const badge = document.createElement("div");
			badge.textContent = `${options.itemCount} 项`;
			badge.style.position = "absolute";
			badge.style.top = "0.5rem";
			badge.style.right = "0.5rem";
			badge.style.padding = "0.125rem 0.5rem";
			badge.style.borderRadius = "9999px";
			badge.style.background = themeColor("--card", 0.94);
			badge.style.border = `1px solid ${themeColor("--foreground", 0.12)}`;
			badge.style.color = themeColor("--foreground", 0.88);
			badge.style.fontSize = "0.75rem";
			badge.style.fontWeight = "600";
			badge.style.lineHeight = "1.2";
			preview.append(badge);
		}
	}

	host.append(preview);
	document.body.append(host);
	return host;
}

function sanitizeIds(value: unknown): number[] {
	if (!Array.isArray(value)) return [];
	return value.filter((id): id is number => Number.isInteger(id) && id > 0);
}

export function hasInternalDragData(
	dataTransfer: DataTransfer | null,
): boolean {
	return dataTransfer?.types.includes(DRAG_MIME) ?? false;
}

export function readInternalDragData(
	dataTransfer: DataTransfer | null,
): InternalDragData | null {
	if (!dataTransfer || !hasInternalDragData(dataTransfer)) return null;

	const raw = dataTransfer.getData(DRAG_MIME);
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as Partial<InternalDragData>;
		const data = {
			fileIds: sanitizeIds(parsed.fileIds),
			folderIds: sanitizeIds(parsed.folderIds),
		};

		if (data.fileIds.length === 0 && data.folderIds.length === 0) return null;
		return data;
	} catch {
		return null;
	}
}

export function writeInternalDragData(
	dataTransfer: DataTransfer,
	data: InternalDragData,
) {
	dataTransfer.setData(DRAG_MIME, JSON.stringify(data));
	dataTransfer.effectAllowed = "move";
}

export function setInternalDragPreview(
	event: DragEvent<Element>,
	options: DragPreviewOptions = {},
	offset = { x: 24, y: 20 },
) {
	const source = event.currentTarget;
	if (!(source instanceof HTMLElement)) return;

	const previewHost = createDragPreview(source, options);
	if (!previewHost) return;

	event.dataTransfer.setDragImage(previewHost, offset.x + 12, offset.y + 12);
	requestAnimationFrame(() => previewHost.remove());
}
