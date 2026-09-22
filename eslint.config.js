import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dist-windows/**",
      "build/**",
      ".vercel/**",
      ".nitro/**",
      ".tanstack/**",
      ".reelos-state/**",
      ".reelos-test-tmp/**",
      ".test-tmp/**",
      ".reelos-audit/**",
      "tmp*/**",
      ".soak/**",
      "node_modules/**",
      "prebuilt/**",
      "public/**",
      "iso/**",
      "autoinstall/**",
      "firstboot/**",
      "daemon/**",
      "install/**",
      "**/*.min.js",
      "scratch/**",
      "test-frontend.*",
      "audit*.txt",
      "patch_*.cjs",
      "patch_*.mjs",
      "fix_*.cjs",
      "audit*.cjs",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-constant-binary-expression": "off",
      "no-empty": "off",
      "prefer-const": "off",
      "no-useless-escape": "off",
      "no-undef": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,mjs}", "*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": "off",
      "no-undef": "off",
    },
  },
  prettier
);
