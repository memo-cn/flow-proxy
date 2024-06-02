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

type Apply = { type: 'Apply'; argArray: any[] };
type Construct = { type: 'Construct'; argArray: any[] };
type DefineProperty = {
    type: 'DefineProperty';
    property: string | number;
    attributes: PropertyDescriptor;
};
type DeleteProperty = {
    type: 'DeleteProperty';
    property: string | number;
};
type Get = { type: 'Get'; property: string };
type GetOwnPropertyDescriptor = {
    type: 'GetOwnPropertyDescriptor';
    property: string | number;
};
type GetPrototypeOf = {
    type: 'GetPrototypeOf';
};
type Has = {
    type: 'Has';
    property: string;
};
type IsExtensible = {
    type: 'IsExtensible';
};
type OwnKeys = {
    type: 'OwnKeys';
};
type PreventExtensions = {
    type: 'PreventExtensions';
};
type Set = {
    type: 'Set';
    property: string | number;
    newValue: any;
};
type SetPrototypeOf = {
    type: 'SetPrototypeOf';
    prototype: any;
};
