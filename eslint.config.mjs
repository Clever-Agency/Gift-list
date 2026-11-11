import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * The catalog of the root `.storybook/` folder (Story 1.10, W12.22). It is not a
 * workspace, so the per-package flat configs never see it; this root config is
 * the one `npm run lint:storybook` uses (`eslint .storybook`).
 *
 * The type rules of `packages/ui` apply here too, plus the hooks rules — a mock
 * that calls a hook must obey them just like the app. The component-shape rules
 * (`react/function-component-definition`, `react/display-name`) are deliberately
 * absent: AGENTS.md scopes them to `src/ui` components and `app/` screens, and
 * the decorators of `preview.tsx` are named function expressions, which the
 * catalog keeps as they are (W12.22).
 */
export default tseslint.config(
  { ignores: ["node_modules/**", "storybook-static/**"] },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [".storybook/**/*.{ts,tsx}"],
  })),
  {
    files: [".storybook/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
