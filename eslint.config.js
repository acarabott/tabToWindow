// @ts-check

import eslint from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import comments from "eslint-plugin-eslint-comments";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    plugins: {
      ["@typescript-eslint"]: tseslint.plugin,
      ["eslint-comments"]: comments,
    },
  },

  // extends
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    // config with just ignores is the replacement for `.eslintignore`
    ignores: ["node_modules", "js"],
  },

  {
    ...prettierConfig,
    languageOptions: {
      globals: {},
      parserOptions: {
        project: ["tsconfig.json"],
      },
    },
    rules: {
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      "@typescript-eslint/no-shadow": ["error"],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
      ],
      "@typescript-eslint/no-dynamic-delete": "off",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
          minimumDescriptionLength: 5,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", disallowTypeAnnotations: true },
      ],
      "@typescript-eslint/explicit-function-return-type": ["off", { allowIIFEs: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-constant-condition": "error",
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        { allowConstantLoopConditions: true },
      ],
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/prefer-literal-enum-member": [
        "error",
        {
          allowBitwiseExpressions: true,
        },
      ],
      "@typescript-eslint/unbound-method": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: true,
          allowNullish: true,
          allowRegExp: true,
        },
      ],
      "@typescript-eslint/no-unused-expressions": ["error"],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          caughtErrors: "all",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        {
          ignoreConditionalTests: true,
          ignorePrimitives: true,
        },
      ],

      "object-shorthand": ["error", "always"],

      //
      // eslint-base
      //

      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "logical-assignment-operators": "error",
      "no-else-return": "error",
      // "no-mixed-operators": "error",
      "no-console": "error",
      "no-process-exit": "error",
      "no-fallthrough": ["error", { commentPattern: ".*intentional fallthrough.*" }],
      "one-var": ["error", "never"],
      "no-param-reassign": ["error"],

      //
      // eslint-plugin-eslint-comments
      //

      // require a eslint-enable comment for every eslint-disable comment
      "eslint-comments/disable-enable-pair": [
        "error",
        {
          allowWholeFile: true,
        },
      ],
      // disallow a eslint-enable comment for multiple eslint-disable comments
      "eslint-comments/no-aggregating-enable": "error",
      // disallow duplicate eslint-disable comments
      "eslint-comments/no-duplicate-disable": "error",
      // disallow eslint-disable comments without rule names
      "eslint-comments/no-unlimited-disable": "error",
      // disallow unused eslint-disable comments
      "eslint-comments/no-unused-disable": "error",
      // disallow unused eslint-enable comments
      "eslint-comments/no-unused-enable": "error",
      // disallow ESLint directive-comments
      "eslint-comments/no-use": [
        "error",
        {
          allow: [
            "eslint-disable",
            "eslint-disable-line",
            "eslint-disable-next-line",
            "eslint-enable",
            "global",
          ],
        },
      ],
    },
  },
);
