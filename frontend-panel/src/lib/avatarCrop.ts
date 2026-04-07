import type { PixelCrop } from "react-image-crop";

const DEFAULT_OUTPUT_MIME_TYPE = "image/webp";
const DEFAULT_OUTPUT_QUALITY = 0.92;
const DEFAULT_MAX_OUTPUT_SIZE = 1024;

function buildOutputFileName(fileName: string, mimeType: string) {
	const baseName = fileName.replace(/\.[^.]+$/, "") || "avatar";
	if (mimeType === "image/png") {
		return `${baseName}-avatar.png`;
	}
	if (mimeType === "image/jpeg") {
		return `${baseName}-avatar.jpg`;
	}
	return `${baseName}-avatar.webp`;
}

function canvasToBlob(
	canvas: HTMLCanvasElement,
	mimeType: string,
	quality: number,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
					return;
				}
				reject(new Error("failed to export cropped avatar"));
			},
			mimeType,
			quality,
		);
	});
}

function getSourceCrop(image: HTMLImageElement, crop: PixelCrop) {
	if (image.width <= 0 || image.height <= 0) {
		throw new Error("failed to measure the selected image");
	}

	const scaleX = image.naturalWidth / image.width;
	const scaleY = image.naturalHeight / image.height;
	const sourceX = Math.max(0, Math.round(crop.x * scaleX));
	const sourceY = Math.max(0, Math.round(crop.y * scaleY));
	const sourceWidth = Math.max(1, Math.round(crop.width * scaleX));
	const sourceHeight = Math.max(1, Math.round(crop.height * scaleY));

	return {
		sourceHeight,
		sourceWidth,
		sourceX,
		sourceY,
	};
}

function drawCropToCanvas(
	image: HTMLImageElement,
	canvas: HTMLCanvasElement,
	crop: PixelCrop,
	outputSize: number,
) {
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("failed to prepare the avatar editor");
	}

	const { sourceHeight, sourceWidth, sourceX, sourceY } = getSourceCrop(
		image,
		crop,
	);

	context.clearRect(0, 0, outputSize, outputSize);
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	context.drawImage(
		image,
		sourceX,
		sourceY,
		sourceWidth,
		sourceHeight,
		0,
		0,
		outputSize,
		outputSize,
	);
}

export async function cropAvatarImage(
	image: HTMLImageElement,
	file: File,
	crop: PixelCrop,
	options?: {
		maxOutputSize?: number;
		outputMimeType?: string;
		outputQuality?: number;
	},
): Promise<File> {
	const { sourceHeight, sourceWidth } = getSourceCrop(image, crop);
	const sourceSize = Math.max(1, Math.max(sourceWidth, sourceHeight));
	const outputSize = Math.min(
		options?.maxOutputSize ?? DEFAULT_MAX_OUTPUT_SIZE,
		sourceSize,
	);
	const outputMimeType = options?.outputMimeType ?? DEFAULT_OUTPUT_MIME_TYPE;
	const outputQuality = options?.outputQuality ?? DEFAULT_OUTPUT_QUALITY;
	const canvas = document.createElement("canvas");
	canvas.width = outputSize;
	canvas.height = outputSize;

	drawCropToCanvas(image, canvas, crop, outputSize);

	const blob = await canvasToBlob(canvas, outputMimeType, outputQuality);
	return new File([blob], buildOutputFileName(file.name, outputMimeType), {
		type: outputMimeType,
		lastModified: Date.now(),
	});
}

export function renderAvatarCropPreview(
	image: HTMLImageElement,
	canvas: HTMLCanvasElement,
	crop: PixelCrop,
	outputSize: number,
) {
	const pixelRatio = window.devicePixelRatio || 1;
	canvas.width = Math.max(1, Math.floor(outputSize * pixelRatio));
	canvas.height = Math.max(1, Math.floor(outputSize * pixelRatio));
	canvas.style.width = `${outputSize}px`;
	canvas.style.height = `${outputSize}px`;

	const context = canvas.getContext("2d");
	if (!context) {
		return;
	}

	context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	drawCropToCanvas(image, canvas, crop, outputSize);
}
