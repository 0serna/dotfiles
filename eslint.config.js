// @ts-check
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "dist",
      "node_modules",
      ".git",
      "dotfiles/pi/agent/settings.json",
      "dotfiles/pi/agent/extensions/orca-*.ts",
      ".agents/skills/**",
      "dotfiles/agents/skills/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
];
