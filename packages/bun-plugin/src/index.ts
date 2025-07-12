import type { BunPlugin } from "bun";
import { 
  EasythreadTransformer, 
  BunWorkerStrategy,
  type PluginOptions 
} from "@easythread/core";

export interface BunPluginOptions extends Omit<PluginOptions, 'environment'> {
  // Bun-specific options can be added here
  filter?: RegExp;
  namespace?: string;
}

export default function easythreadPlugin(options: BunPluginOptions = {}): BunPlugin {
  const transformer = new EasythreadTransformer(new BunWorkerStrategy());
  
  // Default filter for JS/TS files
  const filter = options.filter ?? /\.(js|jsx|ts|tsx)$/;
  const namespace = options.namespace ?? 'file';

  return {
    name: "bun-plugin-easythread",
    setup(build) {
      // Intercept file loading for transformation
      build.onLoad({ filter, namespace }, async (args): Promise<any> => {
        try {
          // Read the file content using Bun's file API
          const file = Bun.file(args.path);
          const source = await file.text();
          
          // Transform the code
          const transformedCode = transformer.transform(source, {
            environment: 'bun',
            filePath: args.path,
            resolveId: async (_id: string, _importer?: string) => {
              // Use Bun's resolution if available through build context
              // For now, return null to use default resolution
              return null;
            },
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

        // If no transformation needed, let Bun handle it normally
        return undefined;
      });
    },
  };
}

// Export the plugin as both default and named export for better compatibility
export { easythreadPlugin };