import { name } from '../package.json';

const NameSpace = `__ns__${name}_error` as const;

export function serializeError(err: any) {
    if (Object(err) !== err) return err;
    if (!(err instanceof Error)) return err;
    return {
        [NameSpace]: {
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
        },
        ...err,
    };
}

export function deserializeError(err: any) {
    if (Object(err) !== err) return err;
    const ns = err[NameSpace];
    if (!ns) return err;
    let error;
    if (ns.name && (globalThis as any)[ns.name]) {
        try {
            error = new (globalThis as any)[ns.name](ns.message);
        } catch (e) {}
    }
    if (!error) {
        error = new Error(ns.message);
    }
    return Object.assign(error, err, ns);
}
