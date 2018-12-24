import * as CodeMirror from "codemirror";
import * as _ from "lodash";
import { TokenUtils } from "./TokenUtils";

export class Editor {
    public _codeMirror: CodeMirror.Doc & CodeMirror.Editor;

    constructor(codeMirror) {
        this._codeMirror = codeMirror;
    }

    focus() {
        this._codeMirror.focus();
    }

    getModeForRange(start, end, knownMixed?) {
        var outerMode = this._codeMirror.getMode(),
            startMode = TokenUtils.getModeAt(this._codeMirror, start),
            endMode = TokenUtils.getModeAt(this._codeMirror, end);
        if (!knownMixed && outerMode.name === startMode.name) {
            // Mode does not vary: just use the editor-wide mode name
            return this._codeMirror.getOption("mode");
        } else if (!startMode || !endMode || startMode.name !== endMode.name) {
            return null;
        } else {
            return startMode;
        }
    }

    setCursorPos(line, ch) {
        this._codeMirror.setCursor(CodeMirror.Pos(line, ch));
    }

    indexFromPos(coords) {
        return this._codeMirror.indexFromPos(coords);
    }

    setSelection(start: CodeMirror.Position, end: CodeMirror.Position) {
        this.setSelections([{start: start, end: end || start}]);
    }

    setSelections(selections) {
        var primIndex = selections.length - 1, options;
        this._codeMirror.setSelections(selections.map(function (sel, index) {
            if (sel.primary) {
                primIndex = index;
            }
            return { anchor: sel.reversed ? sel.end : sel.start, head: sel.reversed ? sel.start : sel.end };
        }), primIndex, options);
    }

    convertToLineSelections(selections, options) {
        var self = this;
        options = options || {};
        _.defaults(options, { expandEndAtStartOfLine: false, mergeAdjacent: true });

        // Combine adjacent lines with selections so they don't collide with each other, as they would
        // if we did them individually.
        var combinedSelections = [], prevSel;
        _.each(selections, function (sel) {
            var newSel = _.cloneDeep(sel);

            // Adjust selection to encompass whole lines.
            newSel.start.ch = 0;
            // The end of the selection becomes the start of the next line, if it isn't already
            // or if expandEndAtStartOfLine is set.
            var hasSelection = (newSel.start.line !== newSel.end.line) || (newSel.start.ch !== newSel.end.ch);
            if (options.expandEndAtStartOfLine || !hasSelection || newSel.end.ch !== 0) {
                newSel.end = {line: newSel.end.line + 1, ch: 0};
            }

            // If the start of the new selection is within the range of the previous (expanded) selection, merge
            // the two selections together, but keep track of all the original selections that were related to this
            // selection, so they can be properly adjusted. (We only have to check for the start being inside the previous
            // range - it can't be before it because the selections started out sorted.)
            if (prevSel && self.posWithinRange(newSel.start, prevSel.selectionForEdit.start, prevSel.selectionForEdit.end, options.mergeAdjacent)) {
                prevSel.selectionForEdit.end.line = newSel.end.line;
                prevSel.selectionsToTrack.push(sel);
            } else {
                prevSel = {selectionForEdit: newSel, selectionsToTrack: [sel]};
                combinedSelections.push(prevSel);
            }
        });
        return combinedSelections;
    }

    getSelectedText(allSelections) {
        if (allSelections) {
            return this._codeMirror.getSelection();
        } else {
            var sel = this.getSelection();
            return this._codeMirror.getRange(sel.start, sel.end);
        }
    }

    private _copyPos(pos) {
        return new CodeMirror.Pos(pos.line, pos.ch);
    }

    posWithinRange(pos, start, end, endInclusive) {
        if (start.line <= pos.line && end.line >= pos.line) {
            if (endInclusive) {
                return (start.line < pos.line || start.ch <= pos.ch) &&  // inclusive
                    (end.line > pos.line   || end.ch >= pos.ch);      // inclusive
            } else {
                return (start.line < pos.line || start.ch <= pos.ch) &&  // inclusive
                    (end.line > pos.line   || end.ch > pos.ch);       // exclusive
            }

        }
        return false;
    }

    hasSelection() {
        return this._codeMirror.somethingSelected();
    }

    private _normalizeRange(anchorPos, headPos) {
        if (headPos.line < anchorPos.line || (headPos.line === anchorPos.line && headPos.ch < anchorPos.ch)) {
            return {start: this._copyPos(headPos), end: this._copyPos(anchorPos), reversed: true};
        } else {
            return {start: this._copyPos(anchorPos), end: this._copyPos(headPos), reversed: false};
        }
    }

    getSelection() {
        return this._normalizeRange(this.getCursorPos(false, "anchor"), this.getCursorPos(false, "head"));
    }

    getSelections() {
        var primarySel = this.getSelection();
        var self = this;
        return _.map(this._codeMirror.listSelections(), function (sel) {
            var result = self._normalizeRange(sel.anchor, sel.head);
            if (result.start.line === primarySel.start.line && result.start.ch === primarySel.start.ch &&
                    result.end.line === primarySel.end.line && result.end.ch === primarySel.end.ch) {
                (<any>result).primary = true;
            } else {
                (<any>result).primary = false;
            }
            return result;
        });
    }

    getCursorPos(expandTabs, which) {
        // Translate "start" and "end" to the official CM names (it actually
        // supports them as-is, but that isn't documented and we don't want to
        // rely on it).
        if (which === "start") {
            which = "from";
        } else if (which === "end") {
            which = "to";
        }
        var cursor = this._copyPos(this._codeMirror.getCursor(which));

        if (expandTabs) {
            cursor.ch = this.getColOffset(cursor);
        }
        return cursor;
    }

    getColOffset(pos) {
        var line    = this._codeMirror.getRange({line: pos.line, ch: 0}, pos),
            tabSize = null,
            column  = 0,
            i;

        for (i = 0; i < line.length; i++) {
            if (line[i] === "\t") {
                if (tabSize === null) {
                    tabSize = Editor.getTabSize();
                }
                if (tabSize > 0) {
                    column += (tabSize - (column % tabSize));
                }
            } else {
                column++;
            }
        }
        return column;
    }

    static getTabSize(): number {
        // TODO
        return 4;
    }

    // Document
    getText(): string {
        return this._codeMirror.getValue();
    }

    setText(text: string): void {
        this._codeMirror.setValue(text);
    }
}
