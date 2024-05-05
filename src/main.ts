import { begin, createCommit, listen, ownKeys } from '../lib';
import { parse, stringify } from 'json-serialization';
import { createFunctionSerDes } from '@json-serialization/function';

csDemo();
async function csDemo() {
    const channel: Parameters<typeof createCommit>['0'] = {
        async postMessage(msg) {
            import.meta.hot!.send('flow-proxy', await stringify(msg, [functionSerDes.serializer]));
        },
    };

    import.meta.hot!.on('flow-proxy', async (msg) => {
        if (channel.onmessage) {
            channel.onmessage(await parse(msg, [functionSerDes.deserializer]));
        }
    });

    const functionSerDes = createFunctionSerDes(channel);

    const commit = createCommit(channel);

    const fs = begin<typeof import('fs')>('fs');
    const buffer = fs.readFileSync('LICENSE').subarray(0, 11);
    const text = buffer.toString();

    console.log(await commit(text));

    // const sh = begin<typeof import('child_process').exec>('shell');
    const sh = begin<any>('import')('child_process').exec as typeof import('child_process').exec;

    commit(
        sh('node -v', (error, stdout, stderr) => {
            // console output: v21.7.3
            console.log(stdout);
        }),
    );
}

// arrayDemo();
async function arrayDemo() {
    const commit = createCommit(window);

    listen(window, (name) => {
        if (!name) return globalThis;
    });

    const remoteWindow = begin<typeof window>();

    const array = remoteWindow.Array.of('hello', 'world', '!');

    array.push('no');

    delete array[1];

    array[2] = 'memo';

    console.log(await commit(array));

    const keys = ownKeys(array);

    console.log(await commit(keys));
}
