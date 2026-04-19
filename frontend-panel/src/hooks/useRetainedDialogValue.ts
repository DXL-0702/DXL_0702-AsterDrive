import { useCallback, useEffect, useState } from "react";

interface UseRetainedDialogValueResult<T> {
	handleOpenChangeComplete: (open: boolean) => void;
	retainedValue: T | null;
}

export function useRetainedDialogValue<T>(
	value: T | null,
	open: boolean,
): UseRetainedDialogValueResult<T> {
	const [retainedValue, setRetainedValue] = useState<T | null>(value);
	const visibleValue = value ?? (open ? null : retainedValue);

	useEffect(() => {
		if (value !== null) {
			setRetainedValue(value);
			return;
		}

		if (open) {
			setRetainedValue(null);
		}
	}, [open, value]);

	const handleOpenChangeComplete = useCallback((nextOpen: boolean) => {
		if (!nextOpen) {
			setRetainedValue(null);
		}
	}, []);

	return { retainedValue: visibleValue, handleOpenChangeComplete };
}
