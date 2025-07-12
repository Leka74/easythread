import easythreadPlugin from "@easythread/bun-plugin";

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun",
  splitting: true,
  plugins: [easythreadPlugin()],
});

console.log("✅ Build completed with easythread transformation!");