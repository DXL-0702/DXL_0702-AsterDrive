import type { KeyboardEvent, Ref } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import type { SearchFilter } from "./types";
import { SEARCH_FILTER_OPTIONS } from "./types";

interface GlobalSearchHeaderProps {
	filter: SearchFilter;
	inputRef: Ref<HTMLInputElement>;
	onClose: () => void;
	onFilterChange: (filter: SearchFilter) => void;
	onInputBlur: () => void;
	onInputCompositionEnd: (value: string) => void;
	onInputCompositionStart: () => void;
	onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
	onQueryChange: (value: string) => void;
	query: string;
}

export function GlobalSearchHeader({
	filter,
	inputRef,
	onClose,
	onFilterChange,
	onInputBlur,
	onInputCompositionEnd,
	onInputCompositionStart,
	onInputKeyDown,
	onQueryChange,
	query,
}: GlobalSearchHeaderProps) {
	const { t } = useTranslation(["search"]);

	return (
		<div className="border-b bg-background/95 px-4 py-3">
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
					<Icon name="MagnifyingGlass" className="h-5 w-5" />
				</div>
				<div className="min-w-0 flex-1">
					<Input
						ref={inputRef}
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
						onCompositionStart={onInputCompositionStart}
						onCompositionEnd={(event) =>
							onInputCompositionEnd(event.currentTarget.value)
						}
						onBlur={onInputBlur}
						onKeyDown={onInputKeyDown}
						placeholder={t("search:placeholder")}
						autoComplete="off"
						spellCheck={false}
						className="h-11 border-none bg-transparent px-0 text-base shadow-none focus-visible:border-none focus-visible:ring-0"
					/>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onClose}
					className="shrink-0"
				>
					<Icon name="X" className="h-4 w-4" />
				</Button>
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				{SEARCH_FILTER_OPTIONS.map((option) => (
					<Button
						key={option.value}
						type="button"
						variant={filter === option.value ? "secondary" : "ghost"}
						size="sm"
						onClick={() => onFilterChange(option.value)}
						className="rounded-full"
					>
						{t(`search:${option.labelKey}`)}
					</Button>
				))}
			</div>
		</div>
	);
}
