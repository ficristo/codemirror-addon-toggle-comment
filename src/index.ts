import * as CodeMirror from "codemirror";
import { Editor } from "./Editor";
import * as EditorCommandHandlers from "./EditorCommandHandlers";

CodeMirror.defineExtension("toggleComment", function (/* options */) {
});

// CodeMirror.defineExtension("lineComment", function (fromOrOptions: CodeMirror.Position | CommentOptions, to: CodeMirror.Position, options: CommentOptions) {
CodeMirror.defineExtension("lineComment", function (options: EditorCommandHandlers.CommentOptions = {}) {
    const editor = new Editor(this);
    EditorCommandHandlers.lineComment(editor, options);
});

// CodeMirror.defineExtension("blockComment", function (fromOrOptions: CodeMirror.Position | CommentOptions, to: CodeMirror.Position, options: CommentOptions) {
CodeMirror.defineExtension("blockComment", function (options: EditorCommandHandlers.CommentOptions = {}) {
    const editor = new Editor(this);
    EditorCommandHandlers.blockComment(editor, options);
});

CodeMirror.defineExtension("uncomment", function (/* from, to, options */) {
});
