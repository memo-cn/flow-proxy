import { Operation } from './operation';

export type Channel = {
    onmessage?: ((ev: any) => any) | null;
    postMessage: (message: any) => void;
};

import { name } from '../package.json';

const NameSpace = `__ns__${name}` as const;

export function message2Data<D extends { type: string } = never>(msg: any, type: D['type']): D | null {
    const data = msg?.[NameSpace] || msg?.data?.[NameSpace];
    if (Object(data) !== data || data.type !== type) return null;
    return data;
}

export function data2Message<T = never>(data: T) {
    return {
        [NameSpace]: data,
    };
}

export type CommitData = {
    type: 'commit';
    commitId: string;
    operations: Operation[];
};

export interface ResultData {
    type: 'result';
    commitId: string;
    // 执行结果
    result: 'success' | 'failure';
    // 成功时的返回值
    return: any;
    // 失败时抛出的错误
    throw: any;
}
