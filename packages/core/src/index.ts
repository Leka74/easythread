export { EasythreadTransformer } from "./transformer.js";
export { BrowserWorkerStrategy } from "./strategies/browser.js";
export { NodeWorkerStrategy } from "./strategies/node.js";
export { BunWorkerStrategy } from "./strategies/bun.js";
export type {
  ImportInfo,
  PluginOptions,
  TransformResult,
  WorkerStrategy,
} from "./types.js";