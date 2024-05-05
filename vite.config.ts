import { defineConfig } from 'vite';
import { resolve } from 'path';
import { name } from './package.json';
import { parse, stringify } from 'json-serialization';
import { createFunctionSerDes } from '@json-serialization/function';

import * as fs from 'fs';
import { exec } from 'child_process';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { createCommit, listen } from './lib/index';

export default defineConfig({
    plugins: [
        {
            name: 'flow-proxy-server',
            apply: 'serve',
            configureServer(viteDevServer) {
                const channel: Parameters<typeof createCommit>['0'] = {
                    async postMessage(msg) {
                        viteDevServer.hot.send('flow-proxy', await stringify(msg, [functionSerDes.serializer]));
                    },
                };

                viteDevServer.hot.on('flow-proxy', async (msg) => {
                    if (channel.onmessage) {
                        channel.onmessage(await parse(msg, [functionSerDes.deserializer]));
                    }
                });

                const functionSerDes = createFunctionSerDes(channel);

                listen(channel, function (name) {
                    if (name === 'fs') return fs;
                    if (name === 'shell') return exec;
                    if (name === 'import') return (n: string) => import(n);
                    if (name === 'require') return require;
                    throw new Error(`invalid name: ${name}`);
                });
            },
        },
        {
            name: 'inject-title',
            apply: 'serve',
            transformIndexHtml(html, ctx) {
                return {
                    html,
                    tags: [
                        {
                            tag: 'title',
                            injectTo: 'head-prepend',
                            children: name,
                        },
                    ],
                };
            },
        },
    ],
    build: {
        lib: {
            entry: resolve('./lib/index.ts'),
            formats: ['es', 'cjs'],
            fileName(format, name) {
                return `${name}.${format === 'es' ? 'mjs' : 'cjs'}`;
            },
        },
    },
});
