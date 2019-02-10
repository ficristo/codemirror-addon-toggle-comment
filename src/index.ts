import * as CodeMirror from "codemirror";
import { Editor } from "./Editor";
import * as EditorCommandHandlers from "./EditorCommandHandlers";

CodeMirror.defineExtension("toggleLineComment", function (options: EditorCommandHandlers.CommentOptions = {}) {
    // eslint-disable-next-line no-invalid-this
    const editor = new Editor(this);
    EditorCommandHandlers.toggleLineComment(editor, options);
});

CodeMirror.defineExtension("toggleBlockComment", function (options: EditorCommandHandlers.CommentOptions = {}) {
    // eslint-disable-next-line no-invalid-this
    const editor = new Editor(this);
    EditorCommandHandlers.toggleBlockComment(editor, options);
});
