import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

const presets = [
	{ id: "blue", color: "bg-blue-500" },
	{ id: "green", color: "bg-green-500" },
	{ id: "purple", color: "bg-purple-500" },
	{ id: "orange", color: "bg-orange-500" },
] as const;

export function ColorPresetPicker() {
	const { colorPreset, setColorPreset } = useThemeStore();
	return (
		<div className="flex gap-2">
			{presets.map((p) => (
				<button
					key={p.id}
					type="button"
					onClick={() => setColorPreset(p.id)}
					className={cn(
						"h-6 w-6 rounded-full flex items-center justify-center transition-transform",
						p.color,
						colorPreset === p.id &&
							"ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110",
					)}
				>
					{colorPreset === p.id && <Check className="h-3 w-3 text-white" />}
				</button>
			))}
		</div>
	);
}
