let blob: Blob;
export function uuid() {
    try {
        if ('function' === typeof globalThis.crypto?.randomUUID) {
            return crypto.randomUUID();
        }
        if ('function' === typeof globalThis.URL?.createObjectURL && globalThis.Blob) {
            if (!blob) {
                blob = new Blob();
            }
            const url = URL.createObjectURL(blob);
            const uuid = url.slice(-36);
            URL.revokeObjectURL(url);
            return uuid;
        }
    } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
