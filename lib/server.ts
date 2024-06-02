import { Channel, type CommitData, data2Message, message2Data, type ResultData } from './message';
import { Operation } from './operation';
import { serializeError } from './error-serializer';

/**
 * @desc
 *   Export a module to the channel
 *   将模块导出到信道
 *
 * @param channel
 *   The channel used internally for transmitting call messages
 *   内部用于传输调用消息的信道
 *
 * @param module
 *   The module to be exported
 *   导出的模块
 *
 * @returns module
 *   The module parameter passed in
 *   传入的 module 参数
 */
export function Export<T>(channel: Channel, module: T): T {
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
                return_ = await parseOperations(commitData.operations);
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

    return module;

    async function parseOperations(operations: Operation[]) {
        // 当前的计算结果
        let res: any = module;
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
                    res = Object.getOwnPropertyNames(res);
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
