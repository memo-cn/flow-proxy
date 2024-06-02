export type Operation =
    | Apply
    | Construct
    | DefineProperty
    | DeleteProperty
    | Get
    | GetOwnPropertyDescriptor
    | GetPrototypeOf
    | Has
    | IsExtensible
    | OwnKeys
    | PreventExtensions
    | Set
    | SetPrototypeOf;

export function defineOperation<T extends Operation>(operation: T): T {
    return operation;
}

export const enum OperationType {
    apply = 'apply',
    construct = 'construct',
    defineProperty = 'defineProperty',
    deleteProperty = 'deleteProperty',
    get = 'get',
    getOwnPropertyDescriptor = 'getOwnPropertyDescriptor',
    getPrototypeOf = 'getPrototypeOf',
    has = 'Has',
    isExtensible = 'isExtensible',
    ownKeys = 'ownKeys',
    preventExtensions = 'preventExtensions',
    set = 'set',
    setPrototypeOf = 'setPrototypeOf',
}

type Apply = { type: OperationType.apply; argArray: any[] };
type Construct = { type: OperationType.construct; argArray: any[] };
type DefineProperty = {
    type: OperationType.defineProperty;
    property: string | number;
    attributes: PropertyDescriptor;
};
type DeleteProperty = {
    type: OperationType.deleteProperty;
    property: string | number;
};
type Get = { type: OperationType.get; property: string };
type GetOwnPropertyDescriptor = {
    type: OperationType.getOwnPropertyDescriptor;
    property: string | number;
};
type GetPrototypeOf = {
    type: OperationType.getPrototypeOf;
};
type Has = {
    type: OperationType.has;
    property: string;
};
type IsExtensible = {
    type: OperationType.isExtensible;
};
type OwnKeys = {
    type: OperationType.ownKeys;
};
type PreventExtensions = {
    type: OperationType.preventExtensions;
};
type Set = {
    type: OperationType.set;
    property: string | number;
    newValue: any;
};
type SetPrototypeOf = {
    type: OperationType.setPrototypeOf;
    prototype: any;
};
