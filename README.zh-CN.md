# 流代理（Flow Proxy）<a href="https://github.com/memo-cn/flow-proxy/blob/main/README.zh-CN.md"><img src="https://img.shields.io/npm/v/flow-proxy.svg" /></a> <a href="https://github.com/memo-cn/flow-proxy/blob/main/README.zh-CN.md"><img src="https://packagephobia.now.sh/badge?p=flow-proxy" /></a>

[English](https://github.com/memo-cn/flow-proxy/blob/main/README.md) | [简体中文](https://github.com/memo-cn/flow-proxy/blob/main/README.zh-CN.md)

## 介绍

`flow-proxy` 提供了一种记录并转发基本操作（如属性读取、赋值、函数调用等）到另一个 JavaScript 上下文中回放执行的代理机制。

## 起步

### 示例一

假设你现在需要在客户端读取服务器上的文件，常见且传统的方式是在服务端提供一系列的 RESTful API，具体实现上可能是给系统 API 套上一层壳。

现在，我们来探讨如何通过 `flow-proxy` 来提高效率，包括省去接口定义的时间。

`flow-proxy` 提供了 `listen` 方法，用于在信道上启动代理监听。

| 参数         | 作用                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| channel      | 第一个参数为传输调用消息的信道，在示例代码中为 WebSocket 实例                    |
| nameResolver | 第二个参数为名称解析器，用于告诉 `flow-proxy` 一个字符串名称对应的起始对象是什么 |

服务端启动代理监听的示例代码如下:

```ts
import * as fs from 'fs';
import { listen } from 'flow-proxy';

listen(serverWebScoket, (name: string) => {
    if (name === 'fs') return fs;
    throw `invalid name: ${name}`;
});
```

客户端的示例代码如下:

```ts
import { begin } from 'flow-proxy';

const fs = begin<typeof import('fs')>('fs'); // or: begin('fs') as typeof import('fs')
const buffer = fs.readFileSync('./license.txt');
const text = buffer.toString();
```

调用 `flow-proxy` 提供的 `begin` 方法来开始记录。

通过指定泛型参数，可以让 TypeScript 类型系统将变量 `fs` 视为 `fs` 模块，从而在编码时获得类型高亮提示，这也是 `flow-proxy` 的一大优势。

> 提示: 你可能需要在客户端项目里安装 `@types/node`，以确保你的编辑器有完整的类型提示。

`begin` 方法返回一个 ES6 `Proxy` 对象，该对象用于记录客户端对起始对象进行的基本操作，比如示例中 `text` 代理记录的信息为:

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

之后，你可以通过 `commit` 方法进行提交:

```ts
import { createCommit } from 'flow-proxy';
const commit = createCommit(clientWebSocket);

// client console output the File content: "MIT License..."
console.log(await commit(text));
```

`commit` 方法会取出 `text` 这个代理记录的所有操作，以及一开始调用 `begin` 时指定的 `name` 参数，并通过信道将调用信息发送到服务端。

服务端的 `flow-proxy` 通过一开始设定的 `nameResolver` 确定起始对象为 `fs` 模块，之后回放操作记录，并通过信道返回执行结果。

### 示例二

如果客户端是完全可信的，那么我们可以直接暴露服务端的全局对象和所有模块。

服务端的示例代码如下：

```ts
import { listen } from 'flow-proxy';

listen(serverWebScoket, (name: string) => {
    if(name === 'import') return (n) => import(n);
    if(name === 'global') return global;
});
```

客户端的示例代码如下:

```ts
const import_ = begin<NodeRequire>('import');
const exec = import_('child_process').exec;

commit(exec('node -v', (error, stdout, stderr) => {
    // console output: v21.7.3
    console.log(stdout);
}));
```

在这个示例中，我们调用了服务端加载的 `child_process` 模块提供的 `exec` 方法来运行 `node -v` 命令，以获取 Node.js 进程的版本号。

## 注意事项

### 自动解包

为了便于开发，当回放的操作结果为 `Promise` 时，`flow-proxy` 将自动进行解包。

### 参数序列化

请注意，你需要确保在两个上下文之间传递的参数都能被序列化。

在示例二中，我给 `child_process.exec` 方法传递的 `callback` 参数是一个回调函数。

然而，在正常情况下，函数是不能被序列化的。实际上，我使用了一个函数虚拟序列化库 `@json-serialization/function`，最终发送的消息是函数的标识（字符串）。你可以通过阅读[这篇文档](https://github.com/memo-cn/json-serialization/blob/main/packages/function/README.zh-CN.md)了解更多的细节。

以下是将 `WebSocket` 实例包装为支持序列化函数的信道的参考代码:

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

## 许可

[MIT](https://github.com/memo-cn/flow-proxy/blob/main/LICENSE)
