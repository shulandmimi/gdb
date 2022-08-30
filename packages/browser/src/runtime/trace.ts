interface Error {
    __prev: Error | undefined;
}

let global_error: Error | undefined;

const website_origin = location.origin;

function registerEvent(object: { [key: string]: any }, key: string, idx: number) {
    const target: Function = object[key];

    object[key] = function (...arg: any[]) {
        const origin_handle = arg[idx];
        const error = new Error();
        error.stack = trim_prev_error(split_error(error.stack), 2);

        error.__prev = global_error;

        arg[idx] = function (...arg: any[]) {
            global_error = error;
            try {
                origin_handle(...arg);
            } catch (error) {
                // console.log(error);
            } finally {
                global_error = undefined;
            }
        };

        target(...arg);
    };
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
    while (start--) {
        error.shift();
    }
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

registerEvent(window, 'setTimeout', 0);
registerEvent(window, 'setInterval', 0);
