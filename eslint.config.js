import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Disable some overly strict rules for this project
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_" 
      }],
      "@typescript-eslint/no-require-imports": "off", // We need require for babel
      "no-console": "off", // Allow console for examples
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      // Relax rules for test files
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  {
    files: ["examples/**/*"],
    rules: {
      // Relax rules for examples
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/*.d.ts",
    ],
  },
];