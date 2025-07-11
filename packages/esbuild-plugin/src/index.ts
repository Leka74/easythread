import type { Plugin } from "esbuild";
import { readFile } from "fs/promises";
import { 
  EasythreadTransformer, 
  NodeWorkerStrategy,
  type PluginOptions 
} from "@easythread/core";

export interface ESBuildPluginOptions extends Omit<PluginOptions, 'environment'> {
  // ESBuild-specific options can be added here
  filter?: RegExp;
  namespace?: string;
}

export default function easythreadPlugin(options: ESBuildPluginOptions = {}): Plugin {
  const transformer = new EasythreadTransformer(new NodeWorkerStrategy());
  
  // Default filter for JS/TS files
  const filter = options.filter ?? /\.(js|jsx|ts|tsx)$/;
  const namespace = options.namespace ?? '';

  return {
    name: "esbuild-plugin-easythread",
    setup(build) {
      // Intercept file loading for transformation
      build.onLoad({ filter, namespace }, async (args) => {
        try {
          // Read the file content
          const source = await readFile(args.path, 'utf8');
          
          // Transform the code
          const transformedCode = transformer.transform(source, {
            environment: 'node',
            filePath: args.path,
            ...options,
          });

          // Only return transformed result if code actually changed
          if (transformedCode !== source) {
            // Determine the loader based on file extension
            let loader: 'js' | 'jsx' | 'ts' | 'tsx' = 'js';
            if (args.path.endsWith('.tsx')) {
              loader = 'tsx';
            } else if (args.path.endsWith('.ts')) {
              loader = 'ts';
            } else if (args.path.endsWith('.jsx')) {
              loader = 'jsx';
            }

            return {
              contents: transformedCode,
              loader,
            };
          }
        } catch (error) {
          return {
            errors: [{
              text: `Failed to transform ${args.path}: ${error}`,
              location: null,
            }],
          };
        }

        // If no transformation needed, let esbuild handle it normally
        return null;
      });
    },
  };
}

// Export the plugin as both default and named export for better compatibility
export { easythreadPlugin };