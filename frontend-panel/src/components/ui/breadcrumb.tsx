import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
	const { t } = useTranslation();

	return (
		<nav
			aria-label={t("breadcrumb")}
			data-slot="breadcrumb"
			className={cn(className)}
			{...props}
		/>
	);
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			data-slot="breadcrumb-list"
			className={cn(
				"flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden text-sm text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="breadcrumb-item"
			className={cn("inline-flex min-w-0 items-center gap-1", className)}
			{...props}
		/>
	);
}

function BreadcrumbLink({
	className,
	render,
	...props
}: useRender.ComponentProps<"a">) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn(
					"inline-block max-w-full truncate transition-colors hover:text-foreground",
					className,
				),
			},
			props,
		),
		render,
		state: {
			slot: "breadcrumb-link",
		},
	});
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="breadcrumb-page"
			aria-current="page"
			className={cn(
				"block min-w-0 truncate font-normal text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function BreadcrumbSeparator({
	children,
	className,
	...props
}: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="breadcrumb-separator"
			role="presentation"
			aria-hidden="true"
			className={cn("shrink-0 [&>svg]:size-3.5", className)}
			{...props}
		>
			{children ?? <Icon name="CaretRight" />}
		</li>
	);
}

function BreadcrumbEllipsis({
	className,
	...props
}: React.ComponentProps<"span">) {
	const { t } = useTranslation();

	return (
		<span
			data-slot="breadcrumb-ellipsis"
			role="presentation"
			aria-hidden="true"
			className={cn(
				"flex size-5 items-center justify-center [&>svg]:size-4",
				className,
			)}
			{...props}
		>
			<Icon name="DotsThree" />
			<span className="sr-only">{t("more")}</span>
		</span>
	);
}

export {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
};
