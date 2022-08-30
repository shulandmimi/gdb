import Gdb from 'gdb';
import * as GDB from 'gdb';
import { BasicSourceMapConsumer, IndexedSourceMapConsumer, SourceMapConsumer } from 'source-map';
import './runtime/trace';

// @ts-ignore
SourceMapConsumer.initialize({
    'lib/mappings.wasm': 'https://unpkg.com/source-map@0.7.3/lib/mappings.wasm',
});

class BrowserStackParser extends GDB.StackParser {
    rawStack: string;

    constructor(stack: string, public offset = 1) {
        super();
        this.rawStack = stack;
    }

    parse(): GDB.StackLine[] {
        const rawStack = this.rawStack;
        let stackLines = rawStack.split('\n');

        stackLines.shift();

        stackLines = stackLines.slice(this.offset);

        const datas = stackLines.map((lineItem) => {
            lineItem = lineItem.slice(lineItem.indexOf('at') + 2).trim();
            const nullMatch: GDB.StackNullLine = {
                type: 'null',
                from: lineItem,
            };

            // 在某个作用域中执行时
            if (/\(.*\)/.test(lineItem)) {
                const matchs = lineItem.match(/^([a-zA-Z$_][\.\<\>a-zA-Z$_]*)\s\((.+):([0-9]+):([0-9]+)\)$/);

                if (!matchs) return nullMatch;

                const [, scope_name, filename, line, col] = matchs;

                const end = filename.indexOf('?');

                return {
                    type: 'match',
                    scope: scope_name,
                    filename: end !== -1 ? filename.slice(0, end) : filename,
                    position: {
                        line: Number(line),
                        col: Number(col),
                    },
                    realFilename: end !== -1 ? filename.slice(0, end) : filename,
                } as GDB.StackMatchWithPosition;
            } else {
                const matchs = lineItem.match(/^([a-zA-Z0-9@/:\.\-]*):([0-9]+):([0-9]+)$/);

                if (!matchs) return nullMatch;

                const [, filename, line, col] = matchs;

                const end = filename.indexOf('?');
                return {
                    type: 'match',
                    scope: '',
                    filename: end !== -1 ? filename.slice(0, end) : filename,
                    position: {
                        line: Number(line),
                        col: Number(col),
                    },
                    realFilename: end !== -1 ? filename.slice(0, end) : filename,
                } as GDB.StackMatchWithPosition;
            }
        });

        return datas;
    }
}

const pageCurrentOrigin = location.origin;

class BrowserSourceStackManager extends GDB.SourceStackManagerWithCache {
    async sourceMap(): Promise<string | undefined> {
        if (this.failed) return;
        if (this.cache.has(this.stackLine.filename)) return this.cache.get(this.stackLine.filename);
        const sourceMap = await fetch(this.stackLine.filename + '.map').then(
            (res) => res.text(),
            () => ((this.failed = true), '')
        );

        if (!sourceMap) {
            this.failed = true;
            return;
        }

        this.cache.set(this.stackLine.filename, sourceMap);

        return sourceMap;
    }

    async translate(position: GDB.Position): Promise<GDB.LineSource> {
        const sourcemap = await this.sourceMap();

        if (!sourcemap) return { type: 'null', from: this.stackLine.filename };

        const consumer: BasicSourceMapConsumer | IndexedSourceMapConsumer = this.cache.has('sourceMapConsumer')
            ? this.cache.get('sourceMapConsumer')
            : await new Promise(async (resolve) => {
                  SourceMapConsumer.with(sourcemap, null, (consumer) => {
                      this.cache.set('sourceMapConsumer', consumer);
                      resolve(consumer);
                  });
              });

        const { source, line, column, name } = consumer.originalPositionFor({
            line: position.line,
            column: position.col,
        });

        return {
            type: 'real',
            position: {
                line: line!,
                col: column!,
            },
            filename: source!,
            scope: name!,
        };
    }
}

if (location.protocol.startsWith('file::')) {
    throw new Error('not supoort file protocol, please change your protocol');
}

function replace_website_origin(filename: string) {
    if (filename.startsWith(origin)) {
        return filename.slice(origin.length);
    }
    return filename;
}

function get_filename_from_path(filename: string) {
    filename = replace_website_origin(filename);
    const names = filename.split('/');
    return names[names.length - 1];
}

function formatPath(origin: string, target: string) {
    if (target.includes(pageCurrentOrigin)) return target;
    const index = origin.indexOf(pageCurrentOrigin);

    if (index === -1) return target;

    const originPaths = origin
        .slice(index + pageCurrentOrigin.length, origin.lastIndexOf('/'))
        .split('/')
        .filter(Boolean);

    const targetPaths = target.split('/').filter(Boolean);

    for (let i = 0; i < targetPaths.length; i++) {
        switch (targetPaths[i]) {
            case '..':
                originPaths.pop();
                break;
            case '.':
                break;
            default:
                originPaths.push(targetPaths[i]);
                break;
        }
    }

    if (!targetPaths.length) return pageCurrentOrigin;

    return `${pageCurrentOrigin}/${originPaths.join('/')}`;
}

class BrowserStackAdapter extends GDB.StackAdapter {
    StackParser = BrowserStackParser;

    SourceStackManager = BrowserSourceStackManager;

    private async tryDeepFindSourceMap(stack: GDB.StackLine) {
        if (stack.type === 'null') return stack;

        const manager = this.getManager(stack);

        const source = await manager.translate(stack.position);

        if (source.type !== 'real') {
            return source;
        }

        Object.assign(stack, {
            realFilename: formatPath(stack.realFilename, source.filename),
        });

        let lastSource = source;
        while (true) {
            const nextManager = this.getManager({ ...lastSource, realFilename: stack.realFilename, type: 'match' });
            const newSource = await nextManager.translate({ ...lastSource.position });
            if (newSource.type !== 'real') {
                break;
            }
            if (!newSource.filename) {
                break;
            }
            Object.assign(stack, {
                realFilename: formatPath(stack.realFilename, newSource.filename),
            });
            lastSource = newSource;
        }

        return lastSource;
    }

    async fetchStack(stack: string, offset: number): Promise<GDB.StackLine[]> {
        const stackParser = new this.StackParser(stack, offset);

        const stacks = stackParser.parse().filter((item) => {
            return (item.type === 'match' ? item.filename : item.from).indexOf('node_modules') === -1;
        });

        const realStackLines = await Promise.all(stacks.map((item) => this.tryDeepFindSourceMap(item)));

        const targetStacks: GDB.StackLine[] = stacks.map((item, index) => {
            if (item.type === 'null') {
                return item;
            }
            return {
                ...item,
                position: (<GDB.RealSource>realStackLines[index]).position,
            };
        });

        return targetStacks;
    }

    format(stackLines: GDB.StackLine[]): string | undefined {
        return stackLines
            .map((item) => {
                switch (item.type) {
                    case 'match':
                        return `at ${item.scope} (${item.realFilename}:${item.position.line}:${item.position.col})`;
                    case 'null':
                        return `at ${item.from}`;
                    default:
                        return '';
                }
            })
            .join('\n');
    }
}

/**
 * @todo
 * 1. sourcemap 深度
 * 2. 路径恢复 `origin: aa/bb/cc/` `target: ../../../abc` ==> `location:xxx/abc`
 */
const gdb = new Gdb({
    stackAdapter: new BrowserStackAdapter(),
});

const log = gdb.log.bind(gdb);

export default log;
