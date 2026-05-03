import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTextContent } from "@/hooks/useTextContent";
import { PreviewError } from "./PreviewError";
import { PreviewLoadingState } from "./PreviewLoadingState";

interface MarkdownPreviewProps {
	path: string;
}

export function MarkdownPreview({ path }: MarkdownPreviewProps) {
	const { t } = useTranslation("files");
	const { content, loading, error, reload } = useTextContent(path);

	if (loading) {
		return (
			<PreviewLoadingState text={t("loading_preview")} className="h-full" />
		);
	}

	if (error || content === null) {
		return <PreviewError onRetry={() => void reload()} />;
	}

	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs dark:shadow-none">
			<div className="border-b border-border/60 bg-muted/20 px-4 py-2 text-xs text-muted-foreground dark:bg-muted/15">
				Markdown · rendered
			</div>
			<div className="min-h-0 flex-1">
				<ScrollArea className="h-full bg-background/80 dark:bg-background/25">
					<div className="prose prose-sm dark:prose-invert max-w-none px-6 py-5">
						<Markdown
							remarkPlugins={[remarkGfm]}
							rehypePlugins={[rehypeSanitize]}
						>
							{content}
						</Markdown>
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}
