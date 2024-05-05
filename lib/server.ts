import { Channel, type CommitData, data2Message, message2Data, type ResultData } from './message';
import { Operation } from './operation';
import { serializeError } from './error-serializer';

/**
 *
 * @desc
 *   Start proxy listening on the channel
 *   在信道上启动代理监听
 *
 * @param channel
 *   The channel used internally for transmitting call messages.
 *   内部用于传输调用消息的信道。
 *
 * @param nameResolver
 *   解析名称对应的起始对象
 *   Parse the starting object corresponding to the name
 */
export function listen(channel: Channel, nameResolver: (name: string | undefined) => any | Promise<any>) {
    const originalOnMessage = typeof channel.onmessage === 'function' ? channel.onmessage : null;
    channel.onmessage = async function (msg: any) {
        // 如果原来存在监听器, 对其进行调用。
        if (originalOnMessage) {
            setTimeout(() => {
                Reflect.apply(originalOnMessage, channel, arguments);
            });
        }

        const commitData = message2Data<CommitData>(msg, 'commit');
        if (commitData) {
            let result: ResultData['result'] = 'success';
            let throw_, return_;
            try {
                return_ = await execute(commitData.operations, commitData.name);
            } catch (e) {
                throw_ = e;
                result = 'failure';
            }

            channel.postMessage(
                data2Message<ResultData>({
                    type: 'result',
                    commitId: commitData.commitId,
                    result,
                    return: return_,
                    throw: serializeError(throw_),
                }),
            );
        }
    };

    async function execute(operations: Operation[], name: string | undefined) {
        // 当前的计算结果
        let res = await nameResolver(name);
        // 最近几次 get 的结果
        const recentRes: any[] = [res];
        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];
            // console.log(op.type, op);
            switch (op.type) {
                case 'Apply': {
                    const thisArgument = recentRes.length >= 2 ? recentRes[recentRes.length - 2] : null;
                    res = Reflect.apply(res, thisArgument, op.argArray);
                    break;
                }
                case 'Construct': {
                    res = Reflect.construct(res, op.argArray);
                    break;
                }
                case 'DefineProperty': {
                    Object.defineProperty(res, op.property, op.attributes);
                    continue;
                }
                case 'DeleteProperty': {
                    delete res[op.property];
                    continue;
                }
                case 'Get': {
                    res = res[op.property];
                    break;
                }
                case 'GetOwnPropertyDescriptor': {
                    res = Object.getOwnPropertyDescriptor(res, op.property);
                    break;
                }
                case 'GetPrototypeOf': {
                    res = Object.getPrototypeOf(res);
                    break;
                }
                case 'Has': {
                    res = op.property in res;
                    break;
                }
                case 'IsExtensible': {
                    res = Object.isExtensible(res);
                    break;
                }
                case 'OwnKeys': {
                    res = Reflect.ownKeys(res);
                    break;
                }
                case 'PreventExtensions': {
                    res = Object.preventExtensions(res);
                    break;
                }
                case 'Set': {
                    res[op.property] = op.newValue;
                    continue;
                }
                case 'SetPrototypeOf': {
                    res = Object.setPrototypeOf(res, op.prototype);
                    break;
                }
            }
            res = await res;
            recentRes.push(res);
            if (recentRes.length > 2) {
                recentRes.shift();
            }
        }
        return res;
    }
}
