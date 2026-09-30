import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    // Flat config replaces .eslintignore, which ESLint 9 no longer reads.
    ignores: [
      "build/**",
      "public/build/**",
      "node_modules/**",
      ".shopify/**",
      "extensions/*/dist/**",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        // Injected by App Bridge on embedded admin pages.
        shopify: "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // The app uses the automatic JSX runtime, so React need not be in scope.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // Fires on four auto-dismissing banners that set state in an effect body
      // before starting their timers. The pattern is real technical debt, but
      // rewriting it changes the fade-in/out behaviour, so it is tracked as a
      // warning rather than silenced or rushed.
      "react-hooks/set-state-in-effect": "warn",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    // Storefront bundle: plain browser script, no modules or Node globals.
    files: ["extensions/**/assets/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: globals.browser,
    },
  },

  prettier,
];
