import type { Plugin } from "rollup";
import { 
  EasythreadTransformer, 
  NodeWorkerStrategy,
  type PluginOptions 
} from "@easythread/core";

export interface RollupPluginOptions extends Omit<PluginOptions, 'environment'> {
  // Rollup-specific options can be added here
  include?: string | RegExp | (string | RegExp)[];
  exclude?: string | RegExp | (string | RegExp)[];
}

export default function easythreadPlugin(options: RollupPluginOptions = {}): Plugin {
  const transformer = new EasythreadTransformer(new NodeWorkerStrategy());
  
  // Default file patterns
  const defaultInclude = /\.(js|jsx|ts|tsx)$/;
  const include = options.include ?? defaultInclude;
  const exclude = options.exclude;

  function shouldTransform(id: string): boolean {
    if (exclude) {
      const excludePatterns = Array.isArray(exclude) ? exclude : [exclude];
      for (const pattern of excludePatterns) {
        if (pattern instanceof RegExp ? pattern.test(id) : id.includes(pattern)) {
          return false;
        }
      }
    }
    
    if (include) {
      const includePatterns = Array.isArray(include) ? include : [include];
      return includePatterns.some(pattern => 
        pattern instanceof RegExp ? pattern.test(id) : id.includes(pattern)
      );
    }
    
    return true;
  }

  return {
    name: "rollup-plugin-easythread",
    transform(code: string, id: string) {
      if (!shouldTransform(id)) {
        return null;
      }

      try {
        const transformedCode = transformer.transform(code, {
          environment: 'node',
          filePath: id,
          ...options,
        });

        // Only return if the code was actually transformed
        if (transformedCode !== code) {
          return {
            code: transformedCode,
            map: null,
          };
        }
      } catch (error) {
        this.error(`Failed to transform ${id}: ${error}`);
      }

      return null;
    },
  };
}

// Export the plugin as both default and named export for better compatibility
export { easythreadPlugin };