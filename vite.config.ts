import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import easythreadPlugin from "./easythread-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), easythreadPlugin()],
});
