import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, type, ...props }, ref) => {
		return (
			<InputPrimitive
				ref={ref}
				type={type}
				data-slot="input"
				data-theme-surface="control"
				className={cn(
					"h-8 w-full min-w-0 rounded-lg border border-input/80 bg-card/70 px-2.5 py-1 text-base shadow-xs transition-[background-color,border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/25 dark:shadow-none dark:focus-visible:bg-input/35 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
					className,
				)}
				{...props}
			/>
		);
	},
);
Input.displayName = "Input";

export { Input };
