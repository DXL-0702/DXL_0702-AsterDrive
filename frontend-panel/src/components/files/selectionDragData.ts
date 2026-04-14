import { useFileStore } from "@/stores/fileStore";

export function getCurrentSelectionDragData(itemId: number, isFolder: boolean) {
	const { selectedFileIds, selectedFolderIds } = useFileStore.getState();
	const isSelected = isFolder
		? selectedFolderIds.has(itemId)
		: selectedFileIds.has(itemId);

	if (isSelected && selectedFileIds.size + selectedFolderIds.size > 1) {
		return {
			fileIds: [...selectedFileIds],
			folderIds: [...selectedFolderIds],
		};
	}

	return isFolder
		? { fileIds: [], folderIds: [itemId] }
		: { fileIds: [itemId], folderIds: [] };
}
