import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce explicit return types for better readability
      "@typescript-eslint/explicit-function-return-type": "warn",
      // Disallow floating promises — always await or void
      "@typescript-eslint/no-floating-promises": "error",
      // Prefer type-only imports to avoid runtime cost
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      // No non-null assertions — handle null/undefined explicitly
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/cdk.out/**",
      "*.config.mjs",
      "*.config.js",
    ],
  },
)
