import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { SelectOption } from "./StoragePolicyFieldTypes";

export function StrategySelectField<TValue extends string>({
	description,
	id,
	label,
	onChange,
	options,
	value,
}: {
	description: string;
	id: string;
	label: string;
	onChange: (value: TValue) => void;
	options: ReadonlyArray<SelectOption<TValue>>;
	value: TValue;
}) {
	return (
		<div className="space-y-2 pt-1">
			<Label htmlFor={id}>{label}</Label>
			<Select
				items={options}
				value={value}
				onValueChange={(nextValue) => onChange(nextValue as TValue)}
			>
				<SelectTrigger id={id}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<p className="text-xs text-muted-foreground">{description}</p>
		</div>
	);
}
