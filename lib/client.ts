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

const commitId2Callback = new Map<string, { resolve: any; reject: any }>();

/**
 * @desc
 *   Start recording
 *   开始记录
 *
 * @param name
 *   The name of the starting object
 *   起始对象的名称
 */
export function begin<T>(name?: string): T {
    return createProxy([], { name });
}

type BeginOptions = {
    name?: string;
};

type Commit = <T>(proxy: T) => Promise<T>;

/**
 * @desc
 *   Create a submitter committer
 *   创建一个提交器
 *
 * @param channel
 *   The channel used internally for transmitting call messages
 *   内部用于传输调用消息的信道
 */
export function createCommit(channel: Channel): Commit {
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

    function commit<T>(proxy: T): Promise<T> {
        const { operations, options } = getOperationsAndOptions(proxy);
        const { name } = options;
        return new Promise<T>((resolve, reject) => {
            const commitId = uuid();
            commitId2Callback.set(commitId, { resolve, reject });
            channel.postMessage(
                data2Message<CommitData>({
                    type: 'commit',
                    commitId,
                    name,
                    operations,
                }),
            );
        });
    }

    return commit;
}
