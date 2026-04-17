import { createResumableUploadRunners } from "./uploadAreaResumableUploadRunners";
import { createSimpleUploadRunners } from "./uploadAreaSimpleUploadRunners";
import type {
	UploadModeRunnerContext,
	UploadModeRunners,
} from "./uploadAreaUploadRunnerShared";

export type {
	UploadModeRunnerContext,
	UploadModeRunners,
} from "./uploadAreaUploadRunnerShared";

export function createUploadModeRunners(
	context: UploadModeRunnerContext,
): UploadModeRunners {
	return {
		...createSimpleUploadRunners(context),
		...createResumableUploadRunners(context),
	};
}
