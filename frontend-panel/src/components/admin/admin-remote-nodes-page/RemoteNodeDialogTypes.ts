import type { RemoteNodeFormData } from "../remoteNodeDialogShared";

export interface RemoteNodeDialogStep {
	description: string;
	title: string;
}

export interface RemoteNodeSummaryItem {
	label: string;
	value: string;
}

export type RemoteNodeFieldChangeHandler = <K extends keyof RemoteNodeFormData>(
	key: K,
	value: RemoteNodeFormData[K],
) => void;
