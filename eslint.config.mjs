import { readFile } from "fs/promises";

import { getEslintConfig } from "@ezez/eslint";

const packageJson = JSON.parse(String(await readFile("./package.json")));
const react = Boolean(packageJson.libraryTemplate?.jsx);

const config = getEslintConfig({ react });

export default [
    ...config,
    {
        files: [
            "src/*.spec.*", "src/**/*.spec.*",
        ],
        rules: {
            "func-names": "off",
            "global-require": "off",
            "max-lines": "off",
            "max-lines-per-function": "off",
            "max-statements": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-magic-numbers": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "no-unused-labels": "off",
        },
    },
];
