import { LineSource, Position, StackLineMatch } from './type';

export abstract class SourceStackManager {
    constructor(public stackLine: StackLineMatch) {}

    // 获取 source map
    abstract sourceMap(): Promise<string | undefined>;

    // 根据 source map 和 stackLine 获取到真实的路径
    abstract translate(position: Position): Promise<LineSource>;
}

export abstract class SourceStackManagerWithCache extends SourceStackManager {
    cache: Map<string, any> = new Map();
}
