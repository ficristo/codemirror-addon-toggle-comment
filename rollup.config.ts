import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import sourceMaps from "rollup-plugin-sourcemaps";
import typescript from "rollup-plugin-typescript2";
import json from "rollup-plugin-json";
import babel from "rollup-plugin-babel";
import { terser } from "rollup-plugin-terser";

const pkg = require("./package.json");

const libraryName = "registerCommentAddon";
const libraryEntry = "index";

export default [
    {
        input: `src/${libraryEntry}.ts`,
        output: [
            {
                file: pkg.main,
                name: libraryName,
                format: "umd",
                sourcemap: true,
                globals: {
                    codemirror: "CodeMirror"
                },
            },
            {
                file: pkg.module,
                format: "esm",
                sourcemap: true,
                globals: {
                    codemirror: "CodeMirror"
                },
            },
        ],

        // Indicate here external modules you don't wanna include in your bundle (i.e.: "lodash")
        external: ["codemirror"],
        watch: {
            include: "src/**",
        },
        plugins: [
            // Allow json resolution
            json(),
            // Compile TypeScript files
            typescript({ useTsconfigDeclarationDir: true }),

            babel(),

            // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
            commonjs(),
            // Allow node_modules resolution, so you can use "external" to control
            // which external modules to include in the bundle
            // https://github.com/rollup/rollup-plugin-node-resolve#usage
            resolve(),

            // Resolve source maps to the original source
            sourceMaps()
        ],
    },
    {
        input: `src/${libraryEntry}.ts`,
        output: [
            {
                file: pkg.min,
                name: libraryName,
                format: "umd",
                sourcemap: false,
                globals: {
                    codemirror: "CodeMirror"
                },
            },
        ],
        // Indicate here external modules you don't wanna include in your bundle (i.e.: "lodash")
        external: ["codemirror"],
        watch: {
            include: "src/**",
        },
        plugins: [
            // Allow json resolution
            json(),
            // Compile TypeScript files
            typescript({ useTsconfigDeclarationDir: true }),

            babel(),

            // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
            commonjs(),
            // Allow node_modules resolution, so you can use "external" to control
            // which external modules to include in the bundle
            // https://github.com/rollup/rollup-plugin-node-resolve#usage
            resolve(),

            // Resolve source maps to the original source
            sourceMaps(),
            
            terser({
                output: {
                    comments: "all"
                }
            }),
        ],
    },
    {
        input: `src/${libraryEntry}.ts`,
        output: [
            {
                file: pkg.mainSimple,
                name: libraryName,
                format: "umd",
                sourcemap: true,
                globals: {
                    codemirror: "CodeMirror",
                    lodash: "_",
                },
            },
        ],

        // Indicate here external modules you don't wanna include in your bundle (i.e.: "lodash")
        external: ["codemirror", "lodash"],
        watch: {
            include: "src/**",
        },
        plugins: [
            // Allow json resolution
            json(),
            // Compile TypeScript files
            typescript({ useTsconfigDeclarationDir: true }),

            // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
            commonjs(),
            // Allow node_modules resolution, so you can use "external" to control
            // which external modules to include in the bundle
            // https://github.com/rollup/rollup-plugin-node-resolve#usage
            resolve(),

            // Resolve source maps to the original source
            sourceMaps()
        ],
    },
    {
        input: `src/${libraryEntry}.ts`,
        output: [
            {
                file: pkg.minSimple,
                name: libraryName,
                format: "umd",
                sourcemap: false,
                globals: {
                    codemirror: "CodeMirror",
                    lodash: "_",
                },
            },
        ],
        // Indicate here external modules you don't wanna include in your bundle (i.e.: "lodash")
        external: ["codemirror", "lodash"],
        watch: {
            include: "src/**",
        },
        plugins: [
            // Allow json resolution
            json(),
            // Compile TypeScript files
            typescript({ useTsconfigDeclarationDir: true }),

            // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
            commonjs(),
            // Allow node_modules resolution, so you can use "external" to control
            // which external modules to include in the bundle
            // https://github.com/rollup/rollup-plugin-node-resolve#usage
            resolve(),

            // Resolve source maps to the original source
            sourceMaps(),
            
            terser({
                output: {
                    comments: "all"
                }
            }),
        ],
    },
];
