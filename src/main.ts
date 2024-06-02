import { Import, Channel, commit, Export, ownKeys, set, deleteProperty, defineProperty } from '../lib';
import { parse, stringify } from 'json-serialization';
import { createFunctionSerDes } from '@json-serialization/function';

csDemo();
async function csDemo() {
    const channel: Channel = {
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

    const fs = Import<any>(channel).fs as typeof import('fs');
    const buffer = fs.readFileSync('./index.html');
    const text = buffer.toString();

    console.log(await commit(text));

    const sh = Import<any>(channel).import('child_process').exec as typeof import('child_process').exec;

    commit(
        sh('node -v', (error, stdout, stderr) => {
            // console output: v21.7.3
            console.log(stdout);
        }),
    );
}

arrayDemo();
async function arrayDemo() {
    Export(window, globalThis);

    const remoteWindow = Import<typeof window>(window);

    let array = remoteWindow.Array.of('hello', 'world', '!');

    array.push('no');

    array = deleteProperty(array, 1);

    array = set(array, 2, 'memo');

    console.log(await commit(array, { omitReturn: false }));

}
