// Bun runtime plugin for easythread
// This allows using @easythread without explicit building!
import { plugin } from "bun";
import { EasythreadTransformer, BunWorkerStrategy, type PluginOptions } from "@easythread/core";

export interface RuntimePluginOptions extends Omit<PluginOptions, 'environment'> {
  // Files/folders to exclude
  exclude?: string[];
  // Enable debug logging
  debug?: boolean;
}

export function registerEasythreadRuntime(options: RuntimePluginOptions = {}) {
  const transformer = new EasythreadTransformer(new BunWorkerStrategy());
  const { exclude = ["node_modules", "dist", ".git"], debug = false } = options;
  
  plugin({
    name: "easythread-runtime",
    setup(build) {
      if (debug) {
        console.log("🔌 Easythread runtime plugin active");
      }
      
      build.onLoad({ filter: /\.(ts|js|tsx|jsx)$/ }, async (args) => {
        // Check exclusions
        if (exclude.some(pattern => args.path.includes(pattern))) {
          return undefined;
        }
        
        try {
          const file = Bun.file(args.path);
          const contents = await file.text();
          
          // Quick check if transformation is needed
          if (!contents.includes("@easythread")) {
            return undefined;
          }
          
          if (debug) {
            console.log("✨ Transforming:", args.path);
          }
          
          // Transform the code
          const transformed = transformer.transform(contents, {
            environment: 'bun',
            filePath: args.path,
            ...options,
          });
          
          if (transformed !== contents) {
            // Determine loader based on file extension
            let loader: 'js' | 'jsx' | 'ts' | 'tsx' = 'js';
            if (args.path.endsWith('.tsx')) {
              loader = 'tsx';
            } else if (args.path.endsWith('.ts')) {
              loader = 'ts';
            } else if (args.path.endsWith('.jsx')) {
              loader = 'jsx';
            }
            
            return {
              contents: transformed,
              loader,
            };
          }
        } catch (error) {
          console.error(`❌ Easythread transformation error in ${args.path}:`, error);
          // Return original file on error
          return undefined;
        }
        
        return undefined;
      });
    },
  });
}

// Export for direct use
export default registerEasythreadRuntime;