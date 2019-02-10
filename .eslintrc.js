module.exports = {
    "extends": "moody-tsx",
    "rules": {
        "comma-dangle": "error",
        "max-len": ["error", 200],
        "new-cap": ["error", {
            "capIsNewExceptions": [
                "CodeMirror.Pos",
                "Pos"
            ]
        }],
        // See https://github.com/typescript-eslint/typescript-eslint/issues/239
        "no-inner-declarations": "off"
    },
    "overrides": [
        // TypeScript
        {
            "files": [
                "**/*.ts"
            ],
            "rules": {
                "comma-dangle": ["error", "always-multiline"]
            }
        },
        // Build files
        {
            "files": [
                "rollup.config.ts"
            ],
            "env": {
                "node": true,
            }
        },
        // Test runner
        {
            "files": [
                "karma.conf.js"
            ],
            "env": {
                "node": true,
            },
            "parserOptions": {
                "ecmaVersion": 6,
            },
            "rules": {
                // http://eslint.org/docs/rules/#stylistic-issues
                "one-var": ["error", { let: "never", const: "never" }],
                "one-var-declaration-per-line": ["error", "always"],
                // https://eslint.org/docs/rules/#ecmascript-6
                "no-var": "error",
                "prefer-const": "error",
            }
        },
        // Tests
        {
            "files": [
                "test/**/*.ts"
            ],
            "env": {
                "jasmine": true
            },
            "globals": {
                "document": false
            },
            "rules": {
                "max-len": "off",
            }
        }
    ]
};
