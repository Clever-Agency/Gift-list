import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**"] },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["src/**/*.ts"],
  })),
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        // Monorepo: several eslint.config.* register candidates; set the root
        // explicitly so the editor parser does not fail
        // (https://tseslint.com/parser-tsconfigrootdir).
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
