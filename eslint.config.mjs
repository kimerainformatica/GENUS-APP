import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated/packaged artifacts — not source, never lint them:
    "generated/**",
    "electron/resources/**",
    ".DIST/**",
  ]),
  {
    rules: {
      // Convention already used in this codebase (ex.: scripts/stress-tests) to
      // discard a destructured/unused value on purpose, e.g. `{ x: _x, ...rest }`.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
