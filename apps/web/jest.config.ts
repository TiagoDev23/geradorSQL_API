import nextJest from "next/jest.js";

/**
 * `next/jest` aplica ao Jest as mesmas transformações do build: JSX,
 * TypeScript, CSS e `next/font` funcionam sem configuração adicional.
 */
const createJestConfig = nextJest({ dir: "./" });

export default createJestConfig({
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
});
