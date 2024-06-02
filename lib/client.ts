import { name as pkgName } from '../package.json';

import { Operation, toOperation } from './operation';
import { type Channel, type CommitData, data2Message, message2Data, type ResultData } from './message';
import { uuid } from './uuid';
import { deserializeError } from './error-serializer';

const proxy2Operation = new WeakMap<any, Operation[]>();

// 记录 proxy 的 channel
const proxy2Options = new WeakMap<any, BeginOptions>();

function getOperationsAndOptions(proxy: any) {
    const operations = proxy2Operation.get(proxy);
    if (!operations) {
        throw new Error(`[${pkgName}] unrecognized proxy: ${proxy}`);
    }
    const options = proxy2Options.get(proxy)!;
    return { operations, options };
}

export function getOwnPropertyDescriptor<T>(proxy: T, property: string): boolean {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            toOperation({
                type: 'GetOwnPropertyDescriptor',
                property,
            }),
        ),
        options,
    );
}

export function has<T>(proxy: T, property: string): boolean {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            toOperation({
                type: 'Has',
                property,
            }),
        ),
        options,
    );
}

export function isExtensible<T>(proxy: T): boolean {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            toOperation({
                type: 'IsExtensible',
            }),
        ),
        options,
    );
}

export function ownKeys<T>(proxy: T): ArrayLike<string> {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            toOperation({
                type: 'OwnKeys',
            }),
        ),
        options,
    );
}

export function preventExtensions<T>(proxy: T): ArrayLike<string> {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            toOperation({
                type: 'PreventExtensions',
            }),
        ),
        options,
    );
}

function createProxy(preOperations: Operation[], options: BeginOptions): any {
    const operations: Operation[] = [...preOperations];
    const proxy = new Proxy(function () {}, {
        apply(target, thisArg: any, argArray: any[]): any {
            return createProxy(
                operations.concat(
                    toOperation({
                        type: 'Apply',
                        argArray,
                    }),
                ),
                options,
            );
        },
        construct(target, argArray: any[], newTarget: Function): object {
            return createProxy(
                operations.concat(
                    toOperation({
                        type: 'Construct',
                        argArray,
                    }),
                ),
                options,
            );
        },
        defineProperty(target, property: string, attributes: PropertyDescriptor): boolean {
            operations.push(
                toOperation({
                    type: 'DefineProperty',
                    property,
                    attributes,
                }),
            );
            return true;
        },
        deleteProperty(target, property: string): boolean {
            operations.push(
                toOperation({
                    type: 'DeleteProperty',
                    property,
                }),
            );
            return true;
        },
        get(target: {}, property: string, receiver: any): any {
            return createProxy(
                operations.concat(
                    toOperation({
                        type: 'Get',
                        property,
                    }),
                ),
                options,
            );
        },
        getOwnPropertyDescriptor(target, property: string): PropertyDescriptor | undefined {
            throw new Error(
                `[${pkgName}] please use the independent method of exporting as 'getOwnPropertyDescriptor'`,
            );
        },
        getPrototypeOf(target): object | null {
            return createProxy(
                operations.concat(
                    toOperation({
                        type: 'GetPrototypeOf',
                    }),
                ),
                options,
            );
        },
        has(target, property: string): boolean {
            throw new Error(`[${pkgName}] please use the independent method of exporting as 'has'`);
        },
        isExtensible(target): boolean {
            throw new Error(`[${pkgName}] please use the independent method of exporting as 'isExtensible'`);
        },
        ownKeys(target): ArrayLike<string | symbol> {
            throw new Error(`[${pkgName}] please use the independent method of exporting as 'ownKeys'`);
        },
        preventExtensions(target): boolean {
            throw new Error(`[${pkgName}] please use the independent method of exporting as 'preventExtensions'`);
        },
        set(target, property: string, newValue: any, receiver: any): boolean {
            operations.push(
                toOperation({
                    type: 'Set',
                    property,
                    newValue,
                }),
            );
            return true;
        },
        setPrototypeOf(target, prototype: object | null): boolean {
            operations.push(
                toOperation({
                    type: 'SetPrototypeOf',
                    prototype,
                }),
            );
            return true;
        },
    });
    proxy2Operation.set(proxy, operations);
    proxy2Options.set(proxy, options);
    return proxy;
}

/**
 * @desc
 *   Import a module from the channel
 *   从信道导入模块
 *
 * @param channel
 *   The channel used internally for transmitting call messages
 *   内部用于传输调用消息的信道
 *
 * @returns
 *   The imported module, which is actually a Proxy
 *   导入的模块, 实际上是一个 Proxy
 */
export function Import<T>(channel: Channel): T {
    return createProxy([], { channel });
}

type BeginOptions = {
    channel: Channel;
};

/**
 * @desc
 *   Commit the recorded operations.
 *   提交记录的操作
 *
 * @param proxy
 *   The proxy object containing recorded operations.
 *   代理对象，包含了记录的操作
 *
 * @returns
 *   The result of replaying the operations.
 *   操作回放的结果
 */
export function commit<T>(proxy: T): Promise<Awaited<T>> {
    const { options } = getOperationsAndOptions(proxy);
    const { channel } = options;
    const commit = getCommit(channel);
    return commit(proxy);
}

const channel2Committer = new WeakMap<Channel, Committer>();
const commitId2Callback = new Map<string, { resolve: any; reject: any }>();

type Committer = <T>(proxy: T) => Promise<Awaited<T>>;

/**
 * @desc
 *   Create a submitter committer
 *   创建一个提交器
 *
 * @param channel
 *   The channel used internally for transmitting call messages
 *   内部用于传输调用消息的信道
 */
function getCommit(channel: Channel): Committer {
    {
        const commit = channel2Committer.get(channel);
        if (commit) return commit;
    }

    const originalOnMessage = typeof channel.onmessage === 'function' ? channel.onmessage : null;
    channel.onmessage = async function (msg: any) {
        // 如果原来存在监听器, 对其进行调用。
        if (originalOnMessage) {
            setTimeout(() => {
                Reflect.apply(originalOnMessage, channel, arguments);
            });
        }

        const resultData = message2Data<ResultData>(msg, 'result');
        if (resultData) {
            const callback = commitId2Callback.get(resultData.commitId);
            if (callback) {
                commitId2Callback.delete(resultData.commitId);
                if (resultData.result === 'success') {
                    callback.resolve(resultData.return);
                } else {
                    callback.reject(deserializeError(resultData.throw));
                }
            }
        }
    };

    function commit<T>(proxy: T): Promise<Awaited<T>> {
        const { operations, options } = getOperationsAndOptions(proxy);
        return new Promise<Awaited<T>>((resolve, reject) => {
            const commitId = uuid();
            commitId2Callback.set(commitId, { resolve, reject });
            channel.postMessage(
                data2Message<CommitData>({
                    type: 'commit',
                    commitId,
                    operations,
                }),
            );
        });
    }

    channel2Committer.set(channel, commit);
    return commit;
}
