interface Error {
    __prev: Error | undefined;
}

let global_error: Error | undefined;

const website_origin = location.origin;

function modify_scope_stack_line(errors: string[], scope: string) {
    const index = errors[errors.length - 1].indexOf('at');

    const [prefix, suffix] = [errors[errors.length - 1].slice(0, index + 2), errors[errors.length - 1].slice(index + 2)];

    errors[errors.length - 1] = [prefix, scope, `(${suffix})`].join(' ');

    return errors;
}

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
    const index = error.findIndex((line) => /^(at setTimeout)/.test(line));
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

function pad_start_space_to_error(error?: string) {
    if (!error) return '';
    let i = 0;
    for (; i < 4; i++) {
        if (error[i] !== ' ') {
            break;
        }
    }

    return ''.padStart(4 - i, ' ') + error;
}

Error.prepareStackTrace = function (err, stack) {
    if (!err.__prev) {
        let e: Error | undefined = global_error;
        while (e) {
            err.stack = `${error_to_string(trim_last_error(split_error(err.stack), 1))}\n${pad_start_space_to_error(e.stack?.trim())}`;
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
                const error = new Error();
                error.stack = error_to_string(trim_prev_error(split_error(error.stack), offset));
                const self = this;
                callback(
                    (...arg) => {
                        self.error = new Error();
                        self.error.stack = trim_prev_error(split_error(self.error.stack), 2)[0];
                        self.error.stack += '\n' + error.stack;
                        resolve(...arg);
                    },
                    (...arg) => {
                        this.error = new Error();
                        this.error.stack = error_to_string(trim_prev_error(split_error(this.error.stack), 0));
                        this.error.__prev = global_error;
                        reject(...arg);
                    }
                );
            });
        }

        then(resolve: (...arg: any) => void, reject: (...arg: any[]) => void) {
            // const error = new Error();
            // const stack = trim_prev_error(split_error(error.stack), 2);
            // error.stack = error_to_string(trim_last_error(stack, 2));
            // error.__prev = this.error;

            // console.log(error.stack);
            const self = this;

            const result = this.p.then(function (...arg) {
                global_error = self.error;
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
