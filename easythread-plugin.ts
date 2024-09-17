import type { Plugin } from "vite";
import transformEasyThreadFunctions from "./transformer.js";

export default function easythreadPlugin(): Plugin {
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
        return {
          code: transformEasyThreadFunctions(code),
          map: null,
        };
      }
    },
  };
}
