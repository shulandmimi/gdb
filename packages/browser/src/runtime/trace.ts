interface Error {
    __prev: Error | undefined;
}

let global_error: Error | undefined;

const website_origin = location.origin;

function register_call(object: { [key: string]: any }, key: string, idx: number) {
    const target: Function = object[key];

    object[key] = function (...arg: any[]) {
        const origin_handle = arg[idx];
        const error = new Error();

        error.stack = error_to_string(trim_prev_error(split_error(error.stack), 2));

        error.__prev = global_error;

        arg[idx] = function (...arg: any[]) {
            global_error = error;
            try {
                origin_handle.call(this, ...arg);
            } catch (error) {
                // console.log(error);
            } finally {
                global_error = undefined;
            }
        };

        target.call(this, ...arg);
    };

    return object[key];
}

function registerConstructor(object: new (...arg: any) => any, keys: string[]) {
    const target = function (...arg: any) {
        const instance = new object(...arg);

        for (const key in keys) {
            // @ts-ignore
            register_call(instance, key, 0);
        }

        return instance;
    };

    return target;
}

function split_error(error?: string): string[] {
    if (!error) return [];
    return error.trim().split('\n');
}

function trim_error_stack(error: string[]) {
    const index = match_error_in_origin_path(error);
    return error.slice(0, index).join('\n');
}

function match_error_in_origin_path(error: string[]) {
    const index = error.findIndex((line) => new RegExp(`^\\s*at\\s${location.origin}`).test(line));
    return index === -1 ? error.length : index;
}

function trim_prev_error(error: string[], start: number = 1) {
    while (start-- > 0) {
        error.shift();
    }
    return error;
}

function trim_last_error(error: string[], end: number = 1) {
    while (end-- > 0) {
        error.pop();
    }

    return error;
    // return error.join('\n');
}

function error_to_string(error: string[]) {
    return error.join('\n');
}

Error.prepareStackTrace = function (err, stack) {
    if (!err.__prev) {
        let e: Error | undefined = global_error;
        while (e) {
            err.stack = `${trim_error_stack(split_error(err.stack))}\n${e.stack?.trim()}`;
            e = e.__prev;
        }
    }

    return err.stack;
};

register_call(window, 'setTimeout', 0);
register_call(window, 'setInterval', 0);
register_call(window, 'addEventListener', 1);

const then = Promise.prototype.then;

function mock_promise() {
    const P = Promise;

    let offset = -1;
    class MockPromise {
        P = P;
        p!: Promise<any>;
        error!: Error;

        constructor(callback: (resolve: (result?: any) => void, reject: (err?: any) => void) => void) {
            this.p = new P((resolve, reject) => {
                if (offset === -1) {
                    const stack = new Error().stack!;
                    offset = stack.split('\n').findIndex((line) => line.indexOf(MockPromise.name) !== -1);
                    if (offset === -1) offset = 0;
                    else offset += 1;
                    return;
                }
                callback(
                    (...arg) => {
                        this.error = new Error();
                        this.error.stack = error_to_string(trim_prev_error(split_error(this.error.stack), 2 + offset));
                        this.error.__prev = global_error;
                        resolve(...arg);
                    },
                    (...arg) => {
                        this.error = new Error();
                        this.error.stack = error_to_string(trim_prev_error(split_error(this.error.stack), 2 + offset));
                        this.error.__prev = global_error;
                        reject(...arg);
                    }
                );
            });
        }

        then(resolve: (...arg: any) => void, reject: (...arg: any[]) => void) {
            const error = new Error();
            error.__prev = this.error;
            const stack = trim_prev_error(split_error(error.stack), 2);
            error.stack = error_to_string(trim_last_error(stack, stack.length - 1));

            // const self = this;
            const result = this.p.then(function (...arg) {
                global_error = error;
                try {
                    resolve(...arg);
                } finally {
                    global_error = undefined;
                }
            }, reject);
            return result;
        }

        catch(...arg: any[]) {
            return this.p.catch(...arg);
        }

        finally(...arg: any[]) {
            return this.p.finally(...arg);
        }
    }

    Object.assign(MockPromise, {
        all: Promise.all.bind(Promise),
        resolve: Promise.resolve.bind(Promise),
        reject: Promise.reject.bind(Promise),
    });

    // @ts-ignore
    window.Promise = MockPromise;

    new Promise((resolve) => {
        resolve(undefined);
    });
}

mock_promise();
// @ts-ignore
// window.Promise = MockPromise;
// registerEvent(Promise.prototype, 'then', 1);
// registerEvent(window)
