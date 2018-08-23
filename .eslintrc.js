module.exports = {
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 6,
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-console": "warn",
    },
    "overrides": [
        {
            "files": ["**/*.ts"],
            "excludedFiles": "**/*.js",
            "parser": "typescript-eslint-parser",
            "parserOptions": {
                "sourceType": "module"
            },
            "plugins": [
                "typescript"
            ],
            "rules": {
                "no-undef": "off",
                "no-inner-declarations": "off",
                "typescript/no-unused-vars": "error",
            }
        },
        {
            "files": ["karma.conf.js"],
            "env": {
                "node": true,
            },
        },
        {
            "files": ["test/**/*.ts"],
            "env": {
                "jasmine": true
            },
            "globals": {
                "document": false
            }
        }
    ]
};
