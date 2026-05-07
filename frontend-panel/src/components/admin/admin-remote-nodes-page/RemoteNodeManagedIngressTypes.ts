import type { ManagedIngressProfileFormData } from "@/components/admin/managedIngressProfileDialogShared";

export type RemoteNodeManagedIngressDraftMode = "create" | "edit";

export type RemoteNodeManagedIngressFieldChangeHandler = <
	K extends keyof ManagedIngressProfileFormData,
>(
	key: K,
	value: ManagedIngressProfileFormData[K],
) => void;
