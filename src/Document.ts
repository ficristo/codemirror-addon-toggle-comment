/*
 * Copyright (c) 2018 - present The codemirror-addon-toggle-comment authors.
 * Copyright (c) 2012 - 2017 Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

import * as CodeMirror from "codemirror";
import * as _ from "lodash";
import { Editor } from "./Editor";

export namespace Document {
    function adjustPosForChange(pos, textLines, start, end) {
        // Same as CodeMirror.adjustForChange(), but that's a private function
        // and Marijn would rather not expose it publicly.
        var change = { text: textLines, from: start, to: end };

        if ((<any>CodeMirror).cmpPos(pos, start) < 0) {
            return pos;
        }
        if ((<any>CodeMirror).cmpPos(pos, end) <= 0) {
            return (<any>CodeMirror).changeEnd(change);
        }

        var line = pos.line + change.text.length - (change.to.line - change.from.line) - 1,
            ch = pos.ch;
        if (pos.line === change.to.line) {
            ch += (<any>CodeMirror).changeEnd(change).ch - change.to.ch;
        }
        return {line: line, ch: ch};
    }

    function oneOrEach(itemOrArr, cb) {
        if (Array.isArray(itemOrArr)) {
            _.each(itemOrArr, cb);
        } else {
            cb(itemOrArr, 0);
        }
    }

    export function doMultipleEdits(editor: Editor, edits, origin?) {
        // Sort the edits backwards, so we don't have to adjust the edit positions as we go along
        // (though we do have to adjust the selection positions).
        edits.sort(function (editDesc1, editDesc2) {
            var edit1 = (Array.isArray(editDesc1.edit) ? editDesc1.edit[0] : editDesc1.edit),
                edit2 = (Array.isArray(editDesc2.edit) ? editDesc2.edit[0] : editDesc2.edit);
            // Treat all no-op edits as if they should happen before all other edits (the order
            // doesn't really matter, as long as they sort out of the way of the real edits).
            if (!edit1) {
                return -1;
            } else if (!edit2) {
                return 1;
            } else {
                return (<any>CodeMirror).cmpPos(edit2.start, edit1.start);
            }
        });

        // Pull out the selections, in the same order as the edits.
        var result = _.cloneDeep(_.map(edits, "selection"));

        // Preflight the edits to specify "end" if unspecified and make sure they don't overlap.
        // (We don't want to do it during the actual edits, since we don't want to apply some of
        // the edits before we find out.)
        _.each(edits, function (editDesc, index: number) {
            oneOrEach(editDesc.edit, function (edit) {
                if (edit) {
                    if (!edit.end) {
                        edit.end = edit.start;
                    }
                    if (index > 0) {
                        var prevEditGroup = edits[index - 1].edit;
                        // The edits are in reverse order, so we want to make sure this edit ends
                        // before any of the previous ones start.
                        oneOrEach(prevEditGroup, function (prevEdit) {
                            if ((<any>CodeMirror).cmpPos(edit.end, prevEdit.start) > 0) {
                                throw new Error("doMultipleEdits(): Overlapping edits specified");
                            }
                        });
                    }
                }
            });
        });

        // Perform the edits.
        editor._codeMirror.operation(function () {
            _.each(edits, function (editDesc, index: number) {
                // Perform this group of edits. The edit positions are guaranteed to be okay
                // since all the previous edits we've done have been later in the document. However,
                // we have to fix up any selections that overlap or come after the edit.
                oneOrEach(editDesc.edit, function (edit) {
                    if (edit) {
                        editor._codeMirror.replaceRange(edit.text, edit.start, edit.end, origin);

                        // Fix up all the selections *except* the one(s) related to this edit list that
                        // are not "before-edit" selections.
                        var textLines = edit.text.split("\n");
                        _.each(result, function (selections, selIndex) {
                            if (selections) {
                                oneOrEach(selections, function (sel) {
                                    if (sel.isBeforeEdit || selIndex !== index) {
                                        sel.start = adjustPosForChange(sel.start, textLines, edit.start, edit.end);
                                        sel.end = adjustPosForChange(sel.end, textLines, edit.start, edit.end);
                                    }
                                });
                            }
                        });
                    }
                });
            });
        });

        result = result.filter(function (item) {
            return item !== undefined;
        });
        result = _.flatten(result);
        result = result.sort(function (sel1, sel2) {
            return (<any>CodeMirror).cmpPos(sel1.start, sel2.start);
        });
        _.each(result, function (item) {
            delete item.isBeforeEdit;
        });
        return result;
    }
}
