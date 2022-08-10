
function awaitResult<T>(result: Result<T | Promise<T>>): Promise<Result<T>> {
    if (result.isError) return Promise.resolve(Err(result.error));

    if (result.value instanceof Promise) {
        return result.value.then(
            x => Ok(x),
            why => Err(why),
        );
    }
    return Promise.resolve(Ok(result.value));
}

export class Result<T> {

    private constructor(private _value: T | Error, private _error: boolean) {}

    public get isError() {
        return this._error;
    }

    public get isOk() {
        return !this._error;
    }

    public get value(): T {
        if (this._error) throw Error("Unwrapping of an errorred result");
        return this._value as T;
    }

    public get error(): Error {
        if (!this._error) throw Error("Attempt to get an error from a OK result");
        return this._value as Error;
    }



    public map<Y>(mapper: (a: T) => Result<Y>): Result<Y>;
    public map<Y>(mapper: (a: T) => Result<Promise<Y>>): Result<Promise<Y>>;
    public map<Y>(mapper: (a: T) => Promise<Result<Y>>): Result<Promise<Y>>;
    public map<Y>(mapper: (a: T) => Result<Y | Promise<Y>> | Promise<Result<Y>>): Result<Y | Promise<Y>> {
        if (this._error) return Err(this._value as Error);
        try {
            if (this._value instanceof Promise) {
                return Ok(this._value.then(
                    x => mapper(x)
                ).then(res => {
                    if (res.isError) throw res.error;
                    return res.value;
                }));
            }
            const mapped = mapper(this._value as T);
            if (mapped instanceof Promise) {
                return Ok(mapped.then(res => {
                    if (res.isError) throw res.error;
                    return res.value;
                }));
            }
            if (mapped.isOk) return Ok(mapped.value);
            return Err(mapped.error);
        } catch (err) {
            return Err(err as Error);
        }
    }

    public await<Y>() {
        return awaitResult<Y>(this);
    }



    public static Ok<T>(value: T) {
        return new this(value, false);
    }

    public static Err(why: Error) {
        return new this<any>(why, true);
    }
}

export function Ok<T>(value: T) {
    return Result.Ok(value);
}
export function Err(why: Error) {
    return Result.Err(why);
}



class NoneMarker {}
async function awaitOption<T>(
    option: Promise<Option<T | NoneMarker>> | Option<Promise<T | NoneMarker> | T | NoneMarker>
): Promise<Option<T>> {
    if (option instanceof Promise) return await option.then(option => {
        if (option.empty) return Option.None;
        if (option.value instanceof NoneMarker) return Option.None;
        return Some(option.value as T);
    });
    if (option.empty) return Option.None;
    return await Promise.resolve(option.value).then(
        x => x instanceof NoneMarker ? Option.None : Some(x),
        _ => Option.None,
    );
}
export class Option<T> {

    private constructor(private _value: T | undefined, private _present: boolean) {}

    public get present() {
        return this._present;
    }

    public get empty() {
        return !this._present;
    }

    public get value(): T {
        if (this.empty) throw Error("Attempt to unwrap missing value");
        return this._value!;
    }



    public map<Y>(mapper: (a: T) => Option<Y>): Option<Y>;
    public map<Y>(mapper: (a: T) => Option<Promise<Y>>): Option<Promise<Y | NoneMarker>>;
    public map<Y>(mapper: (a: T) => Promise<Option<Y>>): Option<Promise<Y | NoneMarker>>;
    public map<Y>(mapper: (a: T) => Option<Y | Promise<Y>> | Promise<Option<Y>>): Option<Y | Promise<Y | NoneMarker>> {
        if (this.empty) return Option.None;
        if (this._value instanceof Promise) {
            return Some(this._value.then(
                x => mapper(x)
            ).then(a => a.present ? a.value : new NoneMarker()));
        }
        const mapped = mapper(this._value as T);
        if (mapped instanceof Promise) {
            return Some(mapped);
        }
        if (mapped.present) return Some(mapped.value);
        return Option.None;
    }

    public await<Y>() {
        return awaitOption<Y>(this);
    }



    public put(x: T) {
        this._value = x;
        this._present = true;
    }

    public take() {
        this._value = void 0;
        this._present = false;
    }



    public static Some<T>(x: T) {
        return new this(x, true);
    }

    public static get None() {
        return new this<any>(void 0, false);
    }



    public toString(): string {
        if (this.empty) return "None";
        return `Some(${require("util").inspect(this.value)})`;
    }
}

export function Some<T>(x: T) {
    return Option.Some(x);
}

export const None = Option.None;
Object.defineProperty(module.exports, "None", {
    get() {
        return Option.None;
    },
    set(_: any) {
        throw Error("Cannot be overridden");
    },
});
