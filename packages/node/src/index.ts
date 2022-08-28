import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import Gdb, {
    Position,
    RealSource,
    SourceStackManagerWithCache,
    StackLine,
    StackParser,
    StackNullLine,
    StackLineMatch,
    StackMatchWithPosition,
    StackAdapter,
} from 'gdb';
import path from 'path';
import { BasicSourceMapConsumer, IndexedSourceMapConsumer, SourceMapConsumer } from 'source-map';

/**
 * 根据 stackParser 获取到真实的 filename 和 position
 */
class NodeSourceStackManager extends SourceStackManagerWithCache {
    constructor(public stackLine: StackLineMatch) {
        super(stackLine);
    }

    async sourceMap() {
        if (this.cache.has('sourceMap')) return this.cache.get('sourceMap');

        if (!existsSync(this.stackLine.filename + '.map')) {
            return Promise.resolve(undefined);
        }

        const sourceMap = (await readFile(this.stackLine.filename + '.map')).toString('utf-8');
        this.cache.set('sourceMap', sourceMap);
        return Promise.resolve(sourceMap);
    }

    async translate(position: Position): Promise<RealSource> {
        const sourcemap = await this.sourceMap();

        if (!sourcemap) return { type: 'real', position, filename: this.stackLine.filename };

        const consumer: BasicSourceMapConsumer | IndexedSourceMapConsumer = this.cache.has('sourceMapConsumer')
            ? this.cache.get('sourceMapConsumer')
            : await new Promise(async (resolve) => {
                  SourceMapConsumer.with(sourcemap, null, (consumer) => {
                      this.cache.set('sourceMapConsumer', consumer);
                      resolve(consumer);
                  });
              });

        const { source, line, column } = consumer.originalPositionFor({
            line: position.line,
            column: position.col,
        });

        return {
            type: 'real',
            position: {
                line: line!,
                col: column!,
            },
            filename: path.resolve(process.cwd(), source || ''),
        };
    }
}

/**
 * 对 node 发出的错误进行解析
 */
class NodeStackParser extends StackParser {
    rawStack: string;

    constructor(stack: string, public offset = 1) {
        super();
        this.rawStack = stack;
    }

    private extractStack() {
        const items = this.splitStack(new Error().stack!);
    }

    private splitStack(stack_str: string) {
        const items = stack_str.split('\n');

        items.shift();

        return items;
    }

    parse(): StackLine[] {
        const rawStack = this.rawStack;
        let stackLines = rawStack.split('\n');

        stackLines.shift();
        stackLines = stackLines.slice(this.offset);

        const datas = stackLines.map((lineItem) => {
            lineItem = lineItem.slice(lineItem.indexOf('at') + 2).trim();
            const nullMatch: StackNullLine = {
                type: 'null',
                from: lineItem,
            };
            // 在某个作用域中执行时
            if (/\(.*\)/.test(lineItem)) {
                const matchs = lineItem.match(/^([a-zA-Z$_][\.\<\>a-zA-Z$_]*)\s\((.+):([0-9]+):([0-9]+)\)$/);

                if (!matchs) return nullMatch;

                const [, scope_name, filename, line, col] = matchs;

                return {
                    type: 'match',
                    scope: scope_name,
                    filename,
                    position: {
                        line: Number(line),
                        col: Number(col),
                    },
                } as StackMatchWithPosition;
            } else {
                const matchs = lineItem.match(/^(<[a-zA-Z]+>):([0-9]+):([0-9]+)$/);

                if (!matchs) return nullMatch;

                const [filename, line, col] = matchs;
                return {
                    type: 'match',
                    scope: '',
                    filename,
                    position: {
                        line: Number(line),
                        col: Number(col),
                    },
                } as StackMatchWithPosition;
            }
        });

        return datas;
    }

    // format(): StackLineWithPosition[] {
    //     throw new Error('Method not implemented.');
    // }
}

class NodeStackAdapter extends StackAdapter<typeof NodeStackParser, typeof NodeSourceStackManager> {
    StackParser = NodeStackParser;
    SourceStackManager = NodeSourceStackManager;

    async fetchStack(stack: string, offset = 1) {
        const stackParser = new this.StackParser(stack, offset);

        const stacks = stackParser.parse();

        const realStackLines = await Promise.all(
            stacks.map((stack) => {
                if (stack.type === 'null') return stack;
                if (!this.managerMapCache.has(stack.filename)) {
                    this.managerMapCache.set(stack.filename, new NodeSourceStackManager(stack));
                }

                const manager = this.managerMapCache.get(stack.filename)!;

                return manager.translate(stack.position);
            })
        );

        const targetStacks: StackLine[] = stacks.map((item, index) => {
            if (item.type === 'null') {
                return item;
            }
            return { ...item, filename: (<RealSource>realStackLines[index]).filename, position: (<RealSource>realStackLines[index]).position };
        });

        return targetStacks;
    }

    format(lines: StackLine[]): string {
        return lines
            .map((item) => {
                switch (item.type) {
                    case 'null':
                        return item.from;
                    case 'match':
                        return `${item.scope} (${item.filename}:${item.position.line}:${item.position.col})`;
                }
            })
            .join('\n');
    }
}

const gdb = new Gdb({
    stackAdapter: new NodeStackAdapter(),
}).extend({
    format(stackLines) {
        const firstLine = stackLines[0];
        switch (firstLine.type) {
            case 'match':
                return `at ${firstLine.filename}:${firstLine.position.line}:${firstLine.position.col}`;
            case 'null':
            default:
                return '';
        }
    },
});

const log = gdb.log.bind(gdb);

export const extend = gdb.extend.bind(gdb);

export default log;
