type ValueOf<T> = T[keyof T];

type KeyOf<T> = keyof T & string;

type Split<T extends string, Separator extends string> = string extends T
    ? string[]
    : T extends `${infer Head}${Separator}${infer Tail}`
      ? [Head, ...Split<Tail, Separator>]
      : [T];

export type { ValueOf, KeyOf, Split };
