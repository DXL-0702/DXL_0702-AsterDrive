import { buildWorkspacePath, type Workspace } from "@/lib/workspace";
import { bindWorkspaceService } from "@/stores/workspaceStore";
import type { TaskInfo, TaskPage } from "@/types/api";
import { api } from "./http";

function workspaceTasksPrefix(workspace: Workspace) {
	return buildWorkspacePath(workspace, "/tasks");
}

export function createTaskService(workspace: Workspace) {
	return {
		listInWorkspace: (params?: { limit?: number; offset?: number }) =>
			api.get<TaskPage>(workspaceTasksPrefix(workspace), { params }),

		getTask: (id: number) =>
			api.get<TaskInfo>(`${workspaceTasksPrefix(workspace)}/${id}`),

		retryTask: (id: number) =>
			api.post<TaskInfo>(`${workspaceTasksPrefix(workspace)}/${id}/retry`),
	};
}

export const taskService = bindWorkspaceService(createTaskService);
