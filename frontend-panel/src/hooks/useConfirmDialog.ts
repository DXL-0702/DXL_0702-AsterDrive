import { useCallback, useState } from "react";

interface UseConfirmDialogReturn<T> {
	confirmId: T | null;
	requestConfirm: (id: T) => void;
	dialogProps: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onConfirm: () => void;
		confirmId: T | null;
	};
}

export function useConfirmDialog<T = number>(
	onConfirm: (id: T) => void | Promise<void>,
): UseConfirmDialogReturn<T> {
	const [confirmId, setConfirmId] = useState<T | null>(null);

	const requestConfirm = useCallback((id: T) => {
		setConfirmId(id);
	}, []);

	const handleOpenChange = useCallback((open: boolean) => {
		if (!open) setConfirmId(null);
	}, []);

	const handleConfirm = useCallback(() => {
		const id = confirmId;
		setConfirmId(null);
		if (id !== null) void onConfirm(id);
	}, [confirmId, onConfirm]);

	const dialogProps = {
		open: confirmId !== null,
		onOpenChange: handleOpenChange,
		onConfirm: handleConfirm,
		confirmId,
	};

	return { confirmId, requestConfirm, dialogProps };
}
