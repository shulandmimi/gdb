export interface Position {
    col: number;
    line: number;
}

export interface StackLineMatch {
    type: 'match';
    scope: string;
    filename: string;
    meta?: Record<string, any>;
}

export interface StackMatchWithPosition extends StackLineMatch {
    position: Position;
}

export interface StackNullLine {
    type: 'null';
    from: string;
}

export type StackLine = StackMatchWithPosition | StackNullLine;

export interface RealSource {
    type: 'real';
    filename: string;
    position: Position;
}

export type LineSource = RealSource | StackNullLine;
