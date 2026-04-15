export type TestFile = Readonly<{
	buffer: Buffer;
	mimeType: string;
	name: string;
}>;

export const ADMIN = {
	email: "admin@example.com",
	password: "Playwright123!",
	username: "admin",
} as const;

export const CODE_CONTENT = `const greeting = "Hello from Playwright";
console.log(greeting);
`;

export const IMAGE_FILE: TestFile = {
	buffer: Buffer.from(
		"R0lGODdhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
		"base64",
	),
	mimeType: "image/gif",
	name: "playwright-image.gif",
} as const;

export const PDF_FILE: TestFile = {
	buffer: createMinimalPdf("Playwright PDF"),
	mimeType: "application/pdf",
	name: "playwright-document.pdf",
} as const;

export const CODE_FILE: TestFile = {
	buffer: Buffer.from(CODE_CONTENT, "utf8"),
	mimeType: "text/typescript",
	name: "playwright-code.ts",
} as const;

export const PREVIEW_APPS_CACHE_KEY = "aster-cached-preview-apps";
export const RESUMABLE_UPLOADS_KEY = "aster_resumable_uploads";

export const DEFAULT_STORAGE_STATE = {
	"aster-browser-open-mode": "single_click",
	"aster-language": "en",
	"aster-sort-by": "name",
	"aster-sort-order": "asc",
	"aster-view-mode": "list",
} as const;

const RUN_ID = Date.now().toString(36);

export function uniqueName(prefix: string) {
	return `${prefix}-${RUN_ID}-${Math.random().toString(36).slice(2, 6)}`;
}

export function uniqueAccountName(prefix: string) {
	return `${prefix}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 16);
}

function createMinimalPdf(text: string) {
	const escapedText = text
		.replaceAll("\\", "\\\\")
		.replaceAll("(", "\\(")
		.replaceAll(")", "\\)");
	const contentStream = `BT
/F1 18 Tf
48 96 Td
(${escapedText}) Tj
ET`;
	const objects = [
		"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
		"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
		"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
		`4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
		"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
	];
	let pdf = "%PDF-1.4\n";
	const offsets = [0];

	for (const object of objects) {
		offsets.push(Buffer.byteLength(pdf, "utf8"));
		pdf += object;
	}

	const xrefOffset = Buffer.byteLength(pdf, "utf8");
	pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
`;

	for (let index = 1; index <= objects.length; index += 1) {
		pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n 
`;
	}

	pdf += `trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF
`;

	return Buffer.from(pdf, "utf8");
}
