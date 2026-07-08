import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["statics/jquery.js"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        ...globals.browser,
        $: "readonly",
        jQuery: "readonly",
      },
    },
  },
];
