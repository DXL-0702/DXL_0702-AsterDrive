import type { IconName } from "@/components/ui/icon";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface FileTypeInfo {
	icon: IconName;
	color: string;
}

const EXACT_MATCH: Record<string, FileTypeInfo> = {
	"application/pdf": { icon: "FileText", color: "text-red-500" },
	"application/json": { icon: "BracketsCurly", color: "text-amber-500" },
	"application/msword": { icon: "FileText", color: "text-blue-500" },
	"application/vnd.ms-excel": { icon: "Table", color: "text-green-600" },
	"application/vnd.ms-powerpoint": {
		icon: "Presentation",
		color: "text-orange-500",
	},
};

const PREFIX_MATCH: Array<[string, FileTypeInfo]> = [
	[
		"application/vnd.openxmlformats-officedocument.wordprocessingml",
		{ icon: "FileText", color: "text-blue-500" },
	],
	[
		"application/vnd.openxmlformats-officedocument.spreadsheetml",
		{ icon: "Table", color: "text-green-600" },
	],
	[
		"application/vnd.openxmlformats-officedocument.presentationml",
		{ icon: "Presentation", color: "text-orange-500" },
	],
	["video/", { icon: "FileVideo", color: "text-purple-500" }],
	["audio/", { icon: "FileAudio", color: "text-pink-500" }],
	["text/", { icon: "FileCode", color: "text-slate-500" }],
	["application/zip", { icon: "FileZip", color: "text-yellow-600" }],
	["application/x-tar", { icon: "FileZip", color: "text-yellow-600" }],
	["application/gzip", { icon: "FileZip", color: "text-yellow-600" }],
	["application/x-rar", { icon: "FileZip", color: "text-yellow-600" }],
	["application/x-7z", { icon: "FileZip", color: "text-yellow-600" }],
];

const DEFAULT_INFO: FileTypeInfo = {
	icon: "File",
	color: "text-muted-foreground",
};

function getFileTypeInfo(mimeType: string): FileTypeInfo {
	const exact = EXACT_MATCH[mimeType];
	if (exact) return exact;
	for (const [prefix, info] of PREFIX_MATCH) {
		if (mimeType.startsWith(prefix)) return info;
	}
	return DEFAULT_INFO;
}

interface FileTypeIconProps {
	mimeType: string;
	className?: string;
}

export function FileTypeIcon({ mimeType, className }: FileTypeIconProps) {
	const { icon, color } = getFileTypeInfo(mimeType);
	return <Icon name={icon} className={cn(color, className)} />;
}
