declare module "prismjs/components/prism-core.js" {
	import * as Prism from "prismjs";

	const prismInstance: typeof Prism;

	export default prismInstance;
}

declare module "prismjs/components/*.js" {
	const moduleExports: unknown;
	export default moduleExports;
}
