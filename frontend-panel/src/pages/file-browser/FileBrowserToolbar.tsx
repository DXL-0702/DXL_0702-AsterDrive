import { type DragEvent, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { SortMenu } from "@/components/common/SortMenu";
import { ToolbarBar } from "@/components/common/ToolbarBar";
import { ViewToggle } from "@/components/common/ViewToggle";
import {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import type { SortBy, SortOrder } from "@/stores/fileStore/types";

type VisibleBreadcrumbEntry =
	| {
			type: "item";
			item: {
				id: number | null;
				name: string;
			};
			sourceIndex: number;
	  }
	| {
			type: "ellipsis";
			key: string;
			items: Array<{
				id: number | null;
				name: string;
			}>;
	  };

interface FileBrowserToolbarProps {
	breadcrumb: Array<{
		id: number | null;
		name: string;
	}>;
	dragOverBreadcrumbIndex: number | null;
	isCompactBreadcrumb: boolean;
	isRootFolder: boolean;
	isSearching: boolean;
	searchQuery: string | null;
	sortBy: SortBy;
	sortOrder: SortOrder;
	viewMode: "grid" | "list";
	onBreadcrumbDragLeave: (event: DragEvent) => void;
	onBreadcrumbDragOver: (event: DragEvent, index: number) => void;
	onBreadcrumbDrop: (
		event: DragEvent,
		index: number,
		targetFolderId: number | null,
	) => Promise<void>;
	onNavigateToFolder: (folderId: number | null, folderName: string) => void;
	onRefresh: () => void | Promise<void>;
	onSetSortBy: (value: SortBy) => void;
	onSetSortOrder: (value: SortOrder) => void;
	onSetViewMode: (value: "grid" | "list") => void;
}

export function FileBrowserToolbar({
	breadcrumb,
	dragOverBreadcrumbIndex,
	isCompactBreadcrumb,
	isRootFolder,
	isSearching,
	searchQuery,
	sortBy,
	sortOrder,
	viewMode,
	onBreadcrumbDragLeave,
	onBreadcrumbDragOver,
	onBreadcrumbDrop,
	onNavigateToFolder,
	onRefresh,
	onSetSortBy,
	onSetSortOrder,
	onSetViewMode,
}: FileBrowserToolbarProps) {
	const { t } = useTranslation(["files", "tasks"]);
	const visibleBreadcrumb: VisibleBreadcrumbEntry[] =
		isCompactBreadcrumb && breadcrumb.length > 2
			? [
					{ type: "item", item: breadcrumb[0], sourceIndex: 0 },
					{
						type: "ellipsis",
						key: "ellipsis",
						items: breadcrumb.slice(1, -1),
					},
					{
						type: "item",
						item: breadcrumb[breadcrumb.length - 1],
						sourceIndex: breadcrumb.length - 1,
					},
				]
			: breadcrumb.map((item, index) => ({
					type: "item" as const,
					item,
					sourceIndex: index,
				}));

	return (
		<ToolbarBar
			left={
				<>
					<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background/40 text-muted-foreground/70 sm:h-8 sm:w-8">
						<Icon
							name={isRootFolder ? "House" : "FolderOpen"}
							className="h-4 w-4"
						/>
					</span>
					<div className="min-w-0 flex-1">
						{isSearching ? (
							<span className="block truncate text-xs text-muted-foreground sm:text-sm">
								{t("core:search")}: &quot;{searchQuery}&quot;
							</span>
						) : (
							<Breadcrumb className="min-w-0">
								<BreadcrumbList className="min-w-0 gap-1.5 text-xs sm:gap-2 sm:text-sm">
									{visibleBreadcrumb.map((entry, index) => (
										<Fragment
											key={
												entry.type === "ellipsis"
													? entry.key
													: `${entry.item.id ?? "root"}-${entry.sourceIndex}`
											}
										>
											{index > 0 && (
												<BreadcrumbSeparator className="mx-0.5 text-muted-foreground/45" />
											)}
											{entry.type === "ellipsis" ? (
												<BreadcrumbItem className="shrink-0">
													<DropdownMenu>
														<DropdownMenuTrigger
															render={
																<button
																	type="button"
																	className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
																	aria-label={t("core:more")}
																>
																	<BreadcrumbEllipsis />
																</button>
															}
														/>
														<DropdownMenuContent
															align="start"
															className="w-auto min-w-40"
														>
															{entry.items.map((hiddenItem) => (
																<DropdownMenuItem
																	key={hiddenItem.id ?? "root"}
																	onClick={() =>
																		onNavigateToFolder(
																			hiddenItem.id,
																			hiddenItem.name,
																		)
																	}
																>
																	<Icon
																		name="FolderOpen"
																		className="h-4 w-4 text-muted-foreground"
																	/>
																	<span className="truncate">
																		{hiddenItem.name}
																	</span>
																</DropdownMenuItem>
															))}
														</DropdownMenuContent>
													</DropdownMenu>
												</BreadcrumbItem>
											) : (
												<BreadcrumbItem
													className={
														entry.sourceIndex === breadcrumb.length - 1
															? "min-w-0 flex-1"
															: "shrink-0"
													}
												>
													{entry.sourceIndex < breadcrumb.length - 1 ? (
														<BreadcrumbLink
															className={[
																"cursor-pointer rounded-md px-1 py-0.5 text-[13px] text-muted-foreground sm:px-1.5 sm:text-sm",
																dragOverBreadcrumbIndex === entry.sourceIndex &&
																	"ring-2 ring-primary bg-accent/30 text-foreground",
															]
																.filter(Boolean)
																.join(" ")}
															onDragOver={(event) =>
																onBreadcrumbDragOver(event, entry.sourceIndex)
															}
															onDragLeave={onBreadcrumbDragLeave}
															onDrop={(event) => {
																void onBreadcrumbDrop(
																	event,
																	entry.sourceIndex,
																	entry.item.id,
																);
															}}
															onClick={() =>
																onNavigateToFolder(
																	entry.item.id,
																	entry.item.name,
																)
															}
														>
															{entry.item.name}
														</BreadcrumbLink>
													) : (
														<BreadcrumbPage className="text-sm font-semibold text-foreground sm:text-[0.95rem]">
															{entry.item.name}
														</BreadcrumbPage>
													)}
												</BreadcrumbItem>
											)}
										</Fragment>
									))}
								</BreadcrumbList>
							</Breadcrumb>
						)}
					</div>
					<button
						type="button"
						className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background/40 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground sm:h-8 sm:w-8"
						onClick={() => void onRefresh()}
						aria-label={t("core:refresh")}
						title={t("core:refresh")}
					>
						<Icon name="ArrowsClockwise" className="h-4 w-4" />
					</button>
				</>
			}
			right={
				<>
					<SortMenu
						sortBy={sortBy}
						sortOrder={sortOrder}
						onSortBy={onSetSortBy}
						onSortOrder={onSetSortOrder}
					/>
					<ViewToggle value={viewMode} onChange={onSetViewMode} />
				</>
			}
		/>
	);
}
