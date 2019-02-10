import * as CodeMirror from "codemirror";

declare module "CodeMirror" {
    export interface Selection {
        // anchor: CodeMirror.Position;
        // head: CodeMirror.Position;
        start: CodeMirror.Position;
        end: CodeMirror.Position;
        primary?: boolean;
        reversed?: boolean;
    }

    export type Selections = Array<Selection>;
}
