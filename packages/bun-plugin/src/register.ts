// Easythread runtime registration file
// Add this to bunfig.toml: preload = ["@easythread/bun-plugin/register"]
import { registerEasythreadRuntime } from "./runtime.js";

// Read options from environment variables
const debug = process.env['EASYTHREAD_DEBUG'] === 'true';
const excludeEnv = process.env['EASYTHREAD_EXCLUDE'];
const exclude = excludeEnv ? excludeEnv.split(',') : undefined;

// Register the runtime plugin
registerEasythreadRuntime({
  debug,
  ...(exclude && { exclude }),
});

if (debug) {
  console.log("✅ Easythread runtime transformation enabled");
}