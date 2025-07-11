import type { Plugin } from "vite";
import { 
  EasythreadTransformer, 
  BrowserWorkerStrategy,
  type PluginOptions 
} from "@easythread/core";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface VitePluginOptions extends Omit<PluginOptions, 'environment'> {
  // Vite-specific options can be added here
  // Currently inherits all options from PluginOptions except 'environment'
}

export default function easythreadPlugin(options: VitePluginOptions = {}): Plugin {
  const transformer = new EasythreadTransformer(new BrowserWorkerStrategy());

  return {
    name: "vite-plugin-easythread",
    enforce: "pre",
    transform(code: string, id: string) {
      if (
        id.endsWith(".ts") ||
        id.endsWith(".tsx") ||
        id.endsWith(".js") ||
        id.endsWith(".jsx")
      ) {
        const transformedCode = transformer.transform(code, {
          environment: 'browser',
          filePath: id,
          resolveId: async (id: string, importer?: string) => {
            const result = await this.resolve?.(id, importer);
            return result?.id || null;
          },
          ...options,
        });

        // Only return if the code was actually transformed
        if (transformedCode !== code) {
          return {
            code: transformedCode,
            map: null,
          };
        }
      }
      
      return null;
    },
  };
}

// Export the plugin as both default and named export for better compatibility
export { easythreadPlugin };