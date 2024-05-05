import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import ts from 'rollup-plugin-typescript2';
import { defineConfig, RollupOptions } from 'rollup';
import pkg from './package.json' assert { type: 'json' };

export default defineConfig(function (commandLineArguments) {
    if (commandLineArguments.watch) {
    }
    return rollupOptions;
});

const plugins = {
    babel: babel({
        minified: true,
        comments: false,
        sourceMaps: true,
        presets: [
            [
                '@babel/preset-env',
                {
                    shippedProposals: true,
                },
            ],
        ],
    }),
    commonjs: commonjs(),
    dts: dts(),
    json: json(),
    nodeResolve: nodeResolve(),
    replace: replace({
        preventAssignment: true,
        values: {},
    }),
    terser: terser({
        sourceMap: true,
    }),
    ts: ts(),
};

const sourcemap = false;
const input = './lib/index.ts';

const rollupOptions: RollupOptions[] = [
    /** 声明文件 */
    {
        input,
        output: [
            {
                file: pkg.types,
            },
        ],
        plugins: [plugins.dts, plugins.nodeResolve, plugins.json, plugins.commonjs],
    } as RollupOptions,
    {
        plugins: [ts(), plugins.replace, plugins.nodeResolve, plugins.json, plugins.commonjs],
        input,
        output: [
            {
                format: 'es',
                file: pkg.module,
                sourcemap,
                plugins: [plugins.terser, plugins.babel],
            },
            {
                format: 'commonjs',
                file: pkg.main,
                sourcemap,
                plugins: [plugins.terser, plugins.babel],
            },
        ],
    } as RollupOptions,
].filter((e) => e);
