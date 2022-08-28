import { SourceStackManagerWithCache, StackParser } from './stack';
import { StackLine } from './stack/type';

export abstract class StackAdapter<
    Parser extends new (...arg: any) => StackParser = new (...arg: any) => StackParser,
    Manager extends new (...arg: any) => SourceStackManagerWithCache = new (...arg: any) => SourceStackManagerWithCache
> {
    abstract StackParser: Parser;
    abstract SourceStackManager: Manager;

    managerMapCache = new Map<string, InstanceType<Manager>>();

    abstract fetchStack(stack: string, offset: number): Promise<StackLine[]>;

    format(stackLines: StackLine[]): string | undefined {
        return;
    }
}

interface GDBOptions {
    baseURL: string;
    traceStack: boolean;
    stackAdapter: StackAdapter;
    format: (stackLines: StackLine[]) => string;
    offset: number;
}

const defaultOptions: Partial<GDBOptions> = {
    traceStack: false,
    offset: 0,
};

const Gdb = (function wrapper() {
    let offset = -1;

    // 自动寻找编译前后 错误栈 包裹层次，并在解析中去掉

    class Gdb {
        options = defaultOptions;

        stackAdapter!: StackAdapter;

        constructor(options: Partial<GDBOptions>) {
            Object.assign(this.options, options);

            if (this.options.stackAdapter) this.stackAdapter = this.options.stackAdapter;
        }

        log(...msgs: any[]) {
            const error = new Error().stack!;

            if (offset === -1) {
                offset = error.split('\n').findIndex((item) => item.indexOf(wrapper.name) !== -1) - 1;
                if (offset === -1) offset = 0;
                return;
            }

            if (this.stackAdapter) {
                this.stackAdapter.fetchStack(error, offset + this.options.offset!).then((res) => {
                    console.log(...msgs);
                    if (this.options.format) {
                        console.log(this.options.format(res));
                    } else {
                        console.log(this.stackAdapter.format(res));
                    }
                    console.log();
                });
            } else {
                console.log(...msgs);
            }
        }

        extend(options: Partial<GDBOptions>): Gdb {
            return new Gdb({ ...this.options, ...options });
        }
    }

    new Gdb({}).log();

    return Gdb;
})();

// const gdb = new Gdb({});

// export { Gdb };

export default Gdb;
