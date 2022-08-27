import { StackLine } from './type';

export abstract class StackParser {
    abstract parse(): StackLine[];
}
