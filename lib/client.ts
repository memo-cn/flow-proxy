import { name as pkgName } from '../package.json';

import { Operation, defineOperation, OperationType } from './operation';
import { type Channel, type CommitData, data2Message, message2Data, type ResultData } from './message';
import { uuid } from './uuid';
import { deserializeError } from './error-serializer';

const proxy2Operation = new WeakMap<any, Operation[]>();
const proxy2Options = new WeakMap<any, BeginOptions>();

function getOperationsAndOptions(proxy: any) {
    const operations = proxy2Operation.get(proxy);
    if (!operations) {
        throw new Error(`[${pkgName}] unrecognized proxy: ${proxy}`);
    }
    const options = proxy2Options.get(proxy)!;
    return { operations, options };
}

export function defineProperty<T>(
    proxy: T,
    property: string | number,
    attributes: PropertyDescriptor & ThisType<any>,
): T {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            defineOperation({
                type: OperationType.defineProperty,
                property,
                attributes,
            }),
        ),
        options,
    );
}

export function deleteProperty<T>(proxy: T, property: string | number): T {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            defineOperation({
                type: OperationType.deleteProperty,
                property,
            }),
        ),
        options,
    );
}

export function getOwnPropertyDescriptor<T>(proxy: T, property: string): boolean {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            defineOperation({
                type: OperationType.getOwnPropertyDescriptor,
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
            defineOperation({
                type: OperationType.has,
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
            defineOperation({
                type: OperationType.isExtensible,
            }),
        ),
        options,
    );
}

export function ownKeys<T>(proxy: T): ArrayLike<string> {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            defineOperation({
                type: OperationType.ownKeys,
            }),
        ),
        options,
    );
}

export function preventExtensions<T>(proxy: T): ArrayLike<string> {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            defineOperation({
                type: OperationType.preventExtensions,
            }),
        ),
        options,
    );
}

export function set<T, V>(proxy: T, property: string | number, newValue: V): T {
    const { operations, options } = getOperationsAndOptions(proxy);
    return createProxy(
        operations.concat(
            defineOperation({
                type: OperationType.set,
                property,
                newValue,
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
                    defineOperation({
                        type: OperationType.apply,
                        argArray,
                    }),
                ),
                options,
            );
        },
        construct(target, argArray: any[], newTarget: Function): object {
            return createProxy(
                operations.concat(
                    defineOperation({
                        type: OperationType.construct,
                        argArray,
                    }),
                ),
                options,
            );
        },
        defineProperty(target, property: string, attributes: PropertyDescriptor): boolean {
            throw new Error(`[${pkgName}] please use the independent method of exporting as 'defineProperty'`);
        },
        deleteProperty(target, property: string): boolean {
            throw new Error(`[${pkgName}] please use the independent method of exporting as 'deleteProperty'`);
        },
        get(target: {}, property: string, receiver: any): any {
            return createProxy(
                operations.concat(
                    defineOperation({
                        type: OperationType.get,
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
                    defineOperation({
                        type: OperationType.getPrototypeOf,
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
            throw new Error(`[${pkgName}] please use the independent method of exporting as 'set'`);
        },
        setPrototypeOf(target, prototype: object | null): boolean {
            operations.push(
                defineOperation({
                    type: OperationType.setPrototypeOf,
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
 * Commit options 提交选项
 */
export type CommitOptions = {
    /**
     * Omit the return value, default is false
     * 忽略返回值，默认为 false
     */
    omitReturn: boolean;
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
 * @param commitOptions {CommitOptions}
 *   Commit options
 *   提交选项
 *
 * @returns
 *   The result of replaying the operations.
 *   操作回放的结果
 */
export function commit<T, O extends CommitOptions>(
    proxy: T,
    commitOptions?: O,
): Promise<O['omitReturn'] extends true ? void : Awaited<T>> {
    const { options } = getOperationsAndOptions(proxy);
    const { channel } = options;
    const commit = getCommit(channel);
    return commit(proxy, commitOptions) as any;
}

const channel2Committer = new WeakMap<Channel, ReturnType<typeof getCommit>>();
const commitId2Callback = new Map<string, { resolve: any; reject: any }>();

/**
 * @desc
 *   Create a submitter committer
 *   创建一个提交器
 *
 * @param channel
 *   The channel used internally for transmitting call messages
 *   内部用于传输调用消息的信道
 */
function getCommit(channel: Channel) {
    {
        const commit: any = channel2Committer.get(channel);
        if (commit) return commit as never;
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

    function commit<T>(proxy: T, commitOptions?: CommitOptions): Promise<Awaited<T>> {
        const { operations, options } = getOperationsAndOptions(proxy);
        return new Promise<Awaited<T>>((resolve, reject) => {
            const commitId = uuid();
            commitId2Callback.set(commitId, { resolve, reject });
            channel.postMessage(
                data2Message<CommitData>({
                    type: 'commit',
                    commitId,
                    operations,
                    omitReturn: (commitOptions?.omitReturn && true) || void 0,
                }),
            );
        });
    }

    channel2Committer.set(channel, commit);
    return commit;
}
