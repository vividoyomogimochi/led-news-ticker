import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["functions/**/*.js"],
    languageOptions: {
      globals: {
        URL: "readonly",
        Response: "readonly",
        Request: "readonly",
        fetch: "readonly",
      },
    },
  },
  prettier,
];
