# Flow Proxy<a href="https://github.com/memo-cn/flow-proxy/blob/main/README.md"><img src="https://img.shields.io/npm/v/flow-proxy.svg" /></a> <a href="https://github.com/memo-cn/flow-proxy/blob/main/README.md"><img src="https://packagephobia.now.sh/badge?p=flow-proxy" /></a>

[English](https://github.com/memo-cn/flow-proxy/blob/main/README.md) | [简体中文](https://github.com/memo-cn/flow-proxy/blob/main/README.zh-CN.md)

## Introduction

`flow-proxy` provides a proxy mechanism that records and forwards basic operations (such as property reading, setting, function calls, etc.) to another JavaScript context for replay execution.

## Getting Started

### Example One

Suppose you now need to read a file on the server from the client. The common and traditional way is to provide a series of RESTful APIs on the server, which may be a wrapper for system APIs.

Now, let's explore how to improve efficiency through `flow-proxy`, including saving time defining interfaces.

`flow-proxy` provides the `listen` method, which is used to start proxy listening on the channel.

| Parameter    | Function                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| channel      | The first parameter is the channel for transmitting call messages, which is a WebSocket instance in the example code           |
| nameResolver | The second parameter is the name resolver, which tells `flow-proxy` what the starting object corresponding to a string name is |

The example code to start proxy listening on the server is as follows:

```ts
import * as fs from 'fs';
import { listen } from 'flow-proxy';

listen(serverWebScoket, (name: string) => {
    if (name === 'fs') return fs;
    throw `invalid name: ${name}`;
});
```

The example code on the client is as follows:

```ts
import { begin } from 'flow-proxy';

const fs = begin<typeof import('fs')>('fs'); // or: begin('fs') as typeof import('fs')
const buffer = fs.readFileSync('./license.txt');
const text = buffer.toString();
```

Call the `begin` method provided by `flow-proxy` to start recording.

By specifying the generic parameter, the TypeScript type system can treat the variable `fs` as the `fs` module, thereby obtaining type highlighting prompts when coding, which is also a major advantage of `flow-proxy`.

> Tip: You may need to install `@types/node` in your client project to ensure that your editor has complete type prompts.

The `begin` method returns an ES6 `Proxy` object, which is used to record the basic operations performed by the client on the starting object. For example, the information recorded by the `text` proxy in the example is:

```json
[
  {
    "type": "Get", "property": "readFileSync"
  },
  {
    "type": "Apply", "argArray": ["./license.txt"]
  },
  {
    "type": "Get", "property": "toString"
  },
  {
    "type": "Apply", "argArray": []
  }
]
```

Afterward, you can commit through the `commit` method:

```ts
import { createCommit } from 'flow-proxy';
const commit = createCommit(clientWebSocket);

// client console output the File content: "MIT License..."
console.log(await commit(text));
```

The `commit` method will take out all the operations recorded by the `text` proxy, and the `name` parameter specified when calling `begin` at the beginning, and send the call information to the server through the channel.

The server's `flow-proxy` determines the starting object as the `fs` module through the `nameResolver` set at the beginning, then replays the operation record, and returns the execution result through the `channel`.

### Example Two

If the client is fully trusted, we can directly expose the server's global objects and all modules.

The example code for the server is as follows:

```ts
import { listen } from 'flow-proxy';

listen(serverWebScoket, (name: string) => {
    if(name === 'import') return (n) => import(n);
    if(name === 'global') return global;
});
```

The example code for the client is as follows:

```ts
const import_ = begin<NodeRequire>('import');
const exec = import_('child_process').exec;

commit(exec('node -v', (error, stdout, stderr) => {
    // console output: v21.7.3
    console.log(stdout);
}));
```

In this example, we call the `exec` method provided by the `child_process` module loaded by the server to run the `node -v` command, in order to get the version number of the Node.js process.

## Considerations

### Automatic Unpacking

For ease of development, when the result of a replay operation is a `Promise`, `flow-proxy` will automatically unpack it.

### Parameter Serialization

Please note that you need to ensure that the parameters passed between the two contexts can be serialized.

In Example Two, I passed a `callback` parameter, which is a callback function, to the `child_process.exec` method.

However, under normal circumstances, functions cannot be serialized. In fact, I used a function virtual serialization library `@json-serialization/function`, and the final message sent is the identifier of the function (a `string`). You can read [this document](https://github.com/memo-cn/json-serialization/blob/main/packages/function/README.md) to learn more details.

Below is the reference code for wrapping a `WebSocket` instance into a `Channel` that supports function serialization:

```ts
import { parse, stringify } from 'json-serialization';
import { createFunctionSerDes } from '@json-serialization/function';

const channel = {
    async postMessage(msg) {
        webSocket.send(await stringify(msg, [functionSerDes.serializer]));
    },
};

webSocket.onmessage(async (msg) => {
    channel?.onmessage(await parse(msg, [functionSerDes.deserializer]));
});

const functionSerDes = createFunctionSerDes(channel);

listen(channel, ...);
```

## License

[MIT](https://github.com/memo-cn/flow-proxy/blob/main/LICENSE)
