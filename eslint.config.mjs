import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const hardcodedColorSelector =
  "Literal[value=/#[0-9A-Fa-f]{3,8}/], TemplateElement[value.raw=/#[0-9A-Fa-f]{3,8}/]";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".local/**",
      ".pythonlibs/**",
      ".cache/**",
      "attached_assets/**",
      "docs/**",
      "coverage/**",
    ],
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    files: [
      "client/src/modules/employee/home/employee-home-page.tsx",
      "client/src/modules/system/watchdog/page.tsx",
      "client/src/modules/supervisor/people/page.tsx",
      "client/src/modules/system/cms-monitoring/page.tsx",
      "client/src/modules/system/helper-status/page.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: hardcodedColorSelector,
          message: "Use design-system tokens or semantic Tailwind colors instead of hardcoded hex.",
        },
      ],
    },
  },
);
