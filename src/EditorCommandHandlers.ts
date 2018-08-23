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
import { Document } from "./Document";
import { Editor } from "./Editor";
import { TokenUtils } from "./TokenUtils";

interface CommentDelimiters {
    lineComment?: string | string[];
    blockCommentStart?: string;
    blockCommentEnd?: string;
}

export interface CommentOptions {
    indent?: boolean;
    lineComment?: string | string[]
    blockCommentStart?: string;
    blockCommentEnd?: string;

    getMode?: (mode, pos: CodeMirror.Position) => CommentDelimiters;
}

function getMode<T>(cm: CodeMirror.Doc, pos: CodeMirror.Position): CodeMirror.Mode<T> {
    var mode = cm.getMode();
    return mode.useInnerComments === false || !mode.innerMode ? mode : (<any>cm).getModeAt(pos);
}


/**
 * @private
 * Creates special regular expressions that matches the line prefix but not the block prefix or suffix
 * @param {!string} lineSyntax  a line comment prefix
 * @param {!string} blockSyntax  a block comment prefix or suffix
 * @return {RegExp}
 */
function _createSpecialLineExp(lineSyntax: string, blockSyntax: string) {
    var i, character, escapedCharacter,
        subExps   = [],
        prevChars = "";

    for (i = lineSyntax.length; i < blockSyntax.length; i++) {
        character = blockSyntax.charAt(i);
        escapedCharacter = _.escapeRegExp(character);
        subExps.push(prevChars + "[^" + escapedCharacter + "]");
        if (prevChars) {
            subExps.push(prevChars + "$");
        }
        prevChars += escapedCharacter;
    }
    return new RegExp("^\\s*" + _.escapeRegExp(lineSyntax) + "($|" + subExps.join("|") + ")");
}

/**
 * @private
 * Creates regular expressions for multiple line comment prefixes
 * @param {!Array.<string>} prefixes  the line comment prefixes
 * @param {string=} blockPrefix  the block comment prefix
 * @param {string=} blockSuffix  the block comment suffix
 * @return {Array.<RegExp>}
 */
function _createLineExpressions(prefixes: Array<string>, blockPrefix: string, blockSuffix: string) {
    var lineExp = [], escapedPrefix, nothingPushed;

    prefixes.forEach(function (prefix) {
        escapedPrefix = _.escapeRegExp(prefix);
        nothingPushed = true;

        if (blockPrefix && blockPrefix.indexOf(prefix) === 0) {
            lineExp.push(_createSpecialLineExp(prefix, blockPrefix));
            nothingPushed = false;
        }
        if (blockSuffix && blockPrefix !== blockSuffix && blockSuffix.indexOf(prefix) === 0) {
            lineExp.push(_createSpecialLineExp(prefix, blockSuffix));
            nothingPushed = false;
        }
        if (nothingPushed) {
            lineExp.push(new RegExp("^\\s*" + escapedPrefix));
        }
    });
    return lineExp;
}

/**
 * @private
 * Returns true if any regular expression matches the given string
 * @param {!string} string  where to look
 * @param {!Array.<RegExp>} expressions  what to look
 * @return {boolean}
 */
function _matchExpressions(string: string, expressions): boolean {
    return expressions.some(function (exp) {
        return string.match(exp);
    });
}

/**
 * @private
 * Returns the line comment prefix that best matches the string. Since there might be line comment prefixes
 * that are prefixes of other line comment prefixes, it searches through all and returns the longest line
 * comment prefix that matches the string.
 * @param {!string} string  where to look
 * @param {!Array.<RegExp>} expressions  the line comment regular expressions
 * @param {!Array.<string>} prefixes  the line comment prefixes
 * @return {string}
 */
function _getLinePrefix(string: string, expressions, prefixes: Array<string>) {
    var result = null;
    expressions.forEach(function (exp, index) {
        if (string.match(exp) && ((result && result.length < prefixes[index].length) || !result)) {
            result = prefixes[index];
        }
    });
    return result;
}

/**
 * @private
 * Searches between startLine and endLine to check if there is at least one line commented with a line comment, and
 * skips all the block comments.
 * @param {!Editor} editor
 * @param {!number} startLine  valid line inside the document
 * @param {!number} endLine  valid line inside the document
 * @param {!Array.<RegExp>} lineExp  an array of line comment prefixes regular expressions
 * @return {boolean} true if there is at least one uncommented line
 */
function _containsNotLineComment(editor: Editor, startLine: number, endLine: number, lineExp): boolean {
    var i, line,
        containsNotLineComment = false;

    for (i = startLine; i <= endLine; i++) {
        line = editor._codeMirror.getLine(i);
        // A line is commented out if it starts with 0-N whitespace chars, then a line comment prefix
        if (line.match(/\S/) && !_matchExpressions(line, lineExp)) {
            containsNotLineComment = true;
            break;
        }
    }
    return containsNotLineComment;
}

/**
 * @private
 * Generates an edit that adds or removes line-comment tokens to all the lines in the selected range,
 * preserving selection and cursor position. Applies to currently focused Editor. The given selection
 * must already be a line selection in the form returned by `Editor.convertToLineSelections()`.
 *
 * If all non-whitespace lines are already commented out, then we uncomment; otherwise we comment
 * out. Commenting out adds the prefix at column 0 of every line. Uncommenting removes the first prefix
 * on each line (if any - empty lines might not have one).
 *
 * @param {!Editor} editor
 * @param {!Array.<string>} prefixes, e.g. ["//"]
 * @param {string=} blockPrefix, e.g. "<!--"
 * @param {string=} blockSuffix, e.g. "-->"
 * @param {!Editor} editor The editor to edit within.
 * @param {!{selectionForEdit: {start:{line:number, ch:number}, end:{line:number, ch:number}, reversed:boolean, primary:boolean},
 *           selectionsToTrack: Array.<{start:{line:number, ch:number}, end:{line:number, ch:number}, reversed:boolean, primary:boolean}>}}
 *      lineSel A line selection as returned from `Editor.convertToLineSelections()`. `selectionForEdit` is the selection to perform
 *      the line comment operation on, and `selectionsToTrack` are a set of selections associated with this line that need to be
 *      tracked through the edit.
 * @return {{edit: {text: string, start:{line: number, ch: number}, end:?{line: number, ch: number}}|Array.<{text: string, start:{line: number, ch: number}, end:?{line: number, ch: number}}>,
 *                  selection: {start:{line:number, ch:number}, end:{line:number, ch:number}, primary:boolean, reversed: boolean, isBeforeEdit: boolean}>}|
 *                  Array.<{start:{line:number, ch:number}, end:{line:number, ch:number}, primary:boolean, reversed: boolean, isBeforeEdit: boolean}>}}
 *      An edit description suitable for including in the edits array passed to `Document.doMultipleEdits()`.
 */
function _getLineCommentPrefixEdit(editor: Editor, prefixes: Array<string>, blockPrefix: string, blockSuffix: string, lineSel, options: CommentOptions) {
    var sel         = lineSel.selectionForEdit,
        trackedSels = lineSel.selectionsToTrack,
        lineExp     = _createLineExpressions(prefixes, blockPrefix, blockSuffix),
        startLine   = sel.start.line,
        endLine     = sel.end.line,
        editGroup   = [];

    // In full-line selection, cursor pos is start of next line - but don't want to modify that line
    if (sel.end.ch === 0) {
        endLine--;
    }

    // Decide if we're commenting vs. un-commenting
    // Are there any non-blank lines that aren't commented out? (We ignore blank lines because
    // some editors like Sublime don't comment them out)
    var i, line, prefix, commentI,
        containsNotLineComment = _containsNotLineComment(editor, startLine, endLine, lineExp);

    if (containsNotLineComment) {
        // Comment out - prepend the first prefix to each line
        line = editor._codeMirror.getLine(startLine);
        var originalCursorPosition = line.search(/\S|$/);

        var firstCharPosition, cursorPosition = originalCursorPosition;

        for (i = startLine; i <= endLine; i++) {
            //check if preference for indent line comment is available otherwise go back to default indentation
            if (options.indent) {
                //ignore the first line and recalculate cursor position for first non white space char of every line
                if (i !== startLine) {
                    line = editor._codeMirror.getLine(i);
                    firstCharPosition = line.search(/\S|$/);
                }
                //if the non space first character position is before original start position , put comment at the new position otherwise older pos
                if (firstCharPosition < originalCursorPosition) {
                    cursorPosition = firstCharPosition;
                } else {
                    cursorPosition = originalCursorPosition;
                }

                editGroup.push({text: prefixes[0], start: {line: i, ch: cursorPosition}});
            } else {
                editGroup.push({text: prefixes[0], start: {line: i, ch: 0}});
            }
        }

        // Make sure tracked selections include the prefix that was added at start of range
        _.each(trackedSels, function (trackedSel) {
            if (trackedSel.start.ch === 0 && (<any>CodeMirror).cmpPos(trackedSel.start, trackedSel.end) !== 0) {
                trackedSel.start = {line: trackedSel.start.line, ch: 0};
                trackedSel.end = {line: trackedSel.end.line, ch: (trackedSel.end.line === endLine ? trackedSel.end.ch + prefixes[0].length : 0)};
            } else {
                trackedSel.isBeforeEdit = true;
            }
        });
    } else {
        // Uncomment - remove the prefix on each line (if any)
        for (i = startLine; i <= endLine; i++) {
            line   = editor._codeMirror.getLine(i);
            prefix = _getLinePrefix(line, lineExp, prefixes);

            if (prefix) {
                commentI = line.indexOf(prefix);
                editGroup.push({text: "", start: {line: i, ch: commentI}, end: {line: i, ch: commentI + prefix.length}});
            }
        }
        _.each(trackedSels, function (trackedSel) {
            trackedSel.isBeforeEdit = true;
        });
    }
    return {edit: editGroup, selection: trackedSels};
}

/**
 * @private
 * Given a token context it will search backwards to determine if the given token is part of a block comment
 * that doesn't start at the initial token. This is used to know if a line comment is part of a block comment
 * or if a block delimiter is the prefix or suffix, by passing a token context at that position. Since the
 * token context will be moved backwards a lot, it is better to pass a new context.
 *
 * @param {!{editor:{CodeMirror}, pos:{ch:{number}, line:{number}}, token:{object}}} ctx  token context
 * @param {!string} prefix  the block comment prefix
 * @param {!string} suffix  the block comment suffix
 * @param {!RegExp} prefixExp  a block comment prefix regular expression
 * @param {!RegExp} suffixExp  a block comment suffix regular expression
 * @param {!Array.<RegExp>} lineExp  an array of line comment prefixes regular expressions
 * @return {boolean}
 */
function _isPrevTokenABlockComment(ctx, prefix: string, suffix: string, prefixExp: RegExp, suffixExp: RegExp, lineExp) {
    // Start searching from the previous token
    var result = TokenUtils.moveSkippingWhitespace(TokenUtils.movePrevToken, ctx);

    // Look backwards until we find a none line comment token
    while (result && _matchExpressions(ctx.token.string, lineExp)) {
        result = TokenUtils.moveSkippingWhitespace(TokenUtils.movePrevToken, ctx);
    }

    // If we are now in a block comment token
    if (result && ctx.token.type === "comment") {
        // If it doesnt matches either prefix or suffix, we know is a block comment
        if (!ctx.token.string.match(prefixExp) && !ctx.token.string.match(suffixExp)) {
            return true;
        // We found a line with just a block comment delimiter, but we can't tell which one it is, so we will
        // keep searching recursively and return the opposite value
        } else if (prefix === suffix && ctx.token.string.length === prefix.length) {
            return !_isPrevTokenABlockComment(ctx, prefix, suffix, prefixExp, suffixExp, lineExp);
        // We can just now the result by checking if the string matches the prefix
        } else {
            return ctx.token.string.match(prefixExp);
        }
    }
    return false;
}

/**
 * Return the column of the first non whitespace char in the given line.
 *
 * @private
 * @param {!Document} doc
 * @param {number} lineNum
 * @returns {number} the column index or null
 */
function _firstNotWs(cm: CodeMirror.Doc, lineNum: number) {
    var text = cm.getLine(lineNum);
    if (text === null || text === undefined) {
        return 0;
    }

    return text.search(/\S|$/);
}

/**
 * Generates an edit that adds or removes block-comment tokens to the selection, preserving selection
 * and cursor position. Applies to the currently focused Editor.
 *
 * If the selection is inside a block-comment or one block-comment is inside or partially inside the selection
 * it will uncomment, otherwise it will comment out, unless if there are multiple block comments inside the selection,
 * where it does nothing.
 * Commenting out adds the prefix before the selection and the suffix after.
 * Uncommenting removes them.
 *
 * If all the lines inside the selection are line-comment and if the selection is not inside a block-comment, it will
 * line uncomment all the lines, otherwise it will block comment/uncomment. In the first case, we return null to
 * indicate to the caller that it needs to handle this selection as a line comment.
 *
 * @param {!Editor} editor
 * @param {!string} prefix, e.g. "<!--"
 * @param {!string} suffix, e.g. "-->"
 * @param {!Array.<string>} linePrefixes, e.g. ["//"]
 * @param {!{start:{line:number, ch:number}, end:{line:number, ch:number}, reversed:boolean, primary:boolean}} sel
 *      The selection to block comment/uncomment.
 * @param {?Array.<{!{start:{line:number, ch:number}, end:{line:number, ch:number}, reversed:boolean, primary:boolean}}>} selectionsToTrack
 *      An array of selections that should be tracked through this edit.
 * @param {String} command The command callee. It cans be "line" or "block".
 * @return {{edit: {text: string, start:{line: number, ch: number}, end:?{line: number, ch: number}}|Array.<{text: string, start:{line: number, ch: number}, end:?{line: number, ch: number}}>,
 *                  selection: {start:{line:number, ch:number}, end:{line:number, ch:number}, primary:boolean, reversed: boolean, isBeforeEdit: boolean}>}|
 *                  Array.<{start:{line:number, ch:number}, end:{line:number, ch:number}, primary:boolean, reversed: boolean, isBeforeEdit: boolean}>}}
 *      An edit description suitable for including in the edits array passed to `Document.doMultipleEdits()`.
 */
function _getBlockCommentPrefixSuffixEdit(editor: Editor, prefix: string, suffix: string, linePrefixes, sel, selectionsToTrack, command: string, options: CommentOptions) {
    var ctx            = TokenUtils.getInitialContext(editor._codeMirror, {line: sel.start.line, ch: sel.start.ch}),
        selEndIndex    = editor.indexFromPos(sel.end),
        lineExp        = _createLineExpressions(linePrefixes, prefix, suffix),
        prefixExp      = new RegExp("^" + _.escapeRegExp(prefix), "g"),
        suffixExp      = new RegExp(_.escapeRegExp(suffix) + "$", "g"),
        prefixPos      = null,
        suffixPos      = null,
        commentAtStart = true,
        isBlockComment = false,
        canComment     = false,
        invalidComment = false,
        lineUncomment  = false,
        result         = true,
        editGroup      = [],
        edit;

    var searchCtx, atSuffix, suffixEnd, initialPos, endLine;

    var indentLineComment = options.indent;

    function isIndentLineCommand() {
        return indentLineComment && command === "line";
    }

    if (!selectionsToTrack) {
        // Track the original selection.
        selectionsToTrack = [_.cloneDeep(sel)];
    }

    // First move the context to the first none white-space token
    if (!ctx.token.type && !/\S/.test(ctx.token.string)) {
        result = TokenUtils.moveSkippingWhitespace(TokenUtils.moveNextToken, ctx);
    }

    // Next, move forwards until we find a comment inside the selection
    while (result && ctx.token.type !== "comment") {
        result = TokenUtils.moveSkippingWhitespace(TokenUtils.moveNextToken, ctx) && editor.indexFromPos(ctx.pos) <= selEndIndex;
        commentAtStart = false;
    }

    // We are now in a comment, lets check if it is a block or a line comment
    if (result && ctx.token.type === "comment") {
        // This token might be at a line comment, but we can't be sure yet
        if (_matchExpressions(ctx.token.string, lineExp)) {
            // If the token starts at ch 0 with no starting white spaces, then this might be a block comment or a line
            // comment over the whole line, and if we found this comment at the start of the selection, we need to search
            // backwards until we get can tell if we are in a block or a line comment
            if (ctx.token.start === 0 && !ctx.token.string.match(/^\\s*/) && commentAtStart) {
                searchCtx      = TokenUtils.getInitialContext(editor._codeMirror, {line: ctx.pos.line, ch: ctx.token.start});
                isBlockComment = _isPrevTokenABlockComment(searchCtx, prefix, suffix, prefixExp, suffixExp, lineExp);

            // If not, we already know that is a line comment
            } else {
                isBlockComment = false;
            }

        // If it was not a line comment, it has to be a block comment
        } else {
            isBlockComment = true;

            // If we are in a line that only has a prefix or a suffix and the prefix and suffix are the same string,
            // lets find first if this is a prefix or suffix and move the context position to the inside of the block comment.
            // This means that the token will be anywere inside the block comment, including the lines with the delimiters.
            // This is required so that later we can find the prefix by moving backwards and the suffix by moving forwards.
            if (ctx.token.string === prefix && prefix === suffix) {
                searchCtx = TokenUtils.getInitialContext(editor._codeMirror, {line: ctx.pos.line, ch: ctx.token.start});
                atSuffix  = _isPrevTokenABlockComment(searchCtx, prefix, suffix, prefixExp, suffixExp, lineExp);
                if (atSuffix) {
                    TokenUtils.moveSkippingWhitespace(TokenUtils.movePrevToken, ctx);
                } else {
                    TokenUtils.moveSkippingWhitespace(TokenUtils.moveNextToken, ctx);
                }
            }
        }

        if (isBlockComment) {
            // Save the initial position to start searching for the suffix from here
            initialPos = _.cloneDeep(ctx.pos);

            // Find the position of the start of the prefix
            result = true;
            while (result && !ctx.token.string.match(prefixExp)) {
                result = TokenUtils.moveSkippingWhitespace(TokenUtils.movePrevToken, ctx);
            }
            prefixPos = result && {line: ctx.pos.line, ch: ctx.token.start};

            // Restore the context at the initial position to find the position of the start of the suffix,
            // but only when we found the prefix alone in one line
            if (ctx.token.string === prefix && prefix === suffix) {
                ctx = TokenUtils.getInitialContext(editor._codeMirror, _.cloneDeep(initialPos));
            }

            while (result && !ctx.token.string.match(suffixExp)) {
                result = TokenUtils.moveSkippingWhitespace(TokenUtils.moveNextToken, ctx);
            }
            suffixPos = result && {line: ctx.pos.line, ch: ctx.token.end - suffix.length};

            // Lets check if there are more comments in the selection. We do nothing if there is one
            do {
                result = TokenUtils.moveSkippingWhitespace(TokenUtils.moveNextToken, ctx) &&
                    editor.indexFromPos(ctx.pos) <= selEndIndex;
            } while (result && !ctx.token.string.match(prefixExp));
            invalidComment = result && !!ctx.token.string.match(prefixExp);

            // Make sure we didn't search so far backward or forward that we actually found a block comment
            // that's entirely before or after the selection.
            suffixEnd = suffixPos && { line: suffixPos.line, ch: suffixPos.ch + suffix.length };
            if ((suffixEnd && (<any>CodeMirror).cmpPos(sel.start, suffixEnd) > 0) || (prefixPos && (<any>CodeMirror).cmpPos(sel.end, prefixPos) < 0)) {
                canComment = true;
            }

        } else {
            // In full-line selection, cursor pos is at the start of next line - but don't want to modify that line
            endLine = sel.end.line;
            if (sel.end.ch === 0 && editor.hasSelection()) {
                endLine--;
            }
            // Find if all the lines are line-commented.
            if (!_containsNotLineComment(editor, sel.start.line, endLine, lineExp)) {
                lineUncomment = true;
            } else {
                canComment = true;
            }
        }
    // If not, we can comment
    } else {
        canComment = true;
    }


    // Make the edit
    if (invalidComment) {
        // We don't want to do an edit, but we still want to track selections associated with it.
        edit = {edit: [], selection: selectionsToTrack};

    } else if (lineUncomment) {
        // Return a null edit. This is a signal to the caller that we should delegate to the
        // line commenting code. We don't want to just generate the edit here, because the edit
        // might need to be coalesced with other line-uncomment edits generated by cursors on the
        // same line.
        edit = null;

    } else {
        // Comment out - add the suffix to the start and the prefix to the end.
        if (canComment) {
            var completeLineSel = sel.start.ch === 0 && sel.end.ch === 0 && sel.start.line < sel.end.line;
            var startCh = _firstNotWs(editor._codeMirror, sel.start.line);
            if (completeLineSel) {
                if (isIndentLineCommand()) {
                    var endCh = _firstNotWs(editor._codeMirror, sel.end.line - 1);
                    var useTabChar = editor._codeMirror.getOption("indentWithTabs");
                    var indentChar = useTabChar ? "\t" : " ";
                    editGroup.push({
                        text: _.repeat(indentChar, endCh) + suffix + "\n",
                        start: {line: sel.end.line, ch: 0}
                    });
                    editGroup.push({
                        text: prefix + "\n" + _.repeat(indentChar, startCh),
                        start: {line: sel.start.line, ch: startCh}
                    });
                } else {
                    editGroup.push({text: suffix + "\n", start: sel.end});
                    editGroup.push({text: prefix + "\n", start: sel.start});
                }
            } else {
                editGroup.push({text: suffix, start: sel.end});
                if (isIndentLineCommand()) {
                    editGroup.push({text: prefix, start: { line: sel.start.line, ch: startCh }});
                } else {
                    editGroup.push({text: prefix, start: sel.start});
                }
            }

            // Correct the tracked selections. We can't just use the default selection fixup,
            // because it will push the end of the selection past the inserted content. Also,
            // it's possible that we have to deal with tracked selections that might be outside
            // the bounds of the edit.
            _.each(selectionsToTrack, function (trackedSel) {
                function updatePosForEdit(pos) {
                    // First adjust for the suffix insertion. Don't adjust
                    // positions that are exactly at the suffix insertion point.
                    if ((<any>CodeMirror).cmpPos(pos, sel.end) > 0) {
                        if (completeLineSel) {
                            pos.line++;
                        } else if (pos.line === sel.end.line) {
                            pos.ch += suffix.length;
                        }
                    }
                    // Now adjust for the prefix insertion. In this case, we do
                    // want to adjust positions that are exactly at the insertion
                    // point.
                    if ((<any>CodeMirror).cmpPos(pos, sel.start) >= 0) {
                        if (completeLineSel) {
                            // Just move the line down.
                            pos.line++;
                        } else if (pos.line === sel.start.line && !(isIndentLineCommand() && pos.ch < startCh)) {
                            pos.ch += prefix.length;
                        }
                    }
                }

                updatePosForEdit(trackedSel.start);
                updatePosForEdit(trackedSel.end);
            });

        // Uncomment - remove prefix and suffix.
        } else {
            // Find if the prefix and suffix are at the ch 0 and if they are the only thing in the line.
            // If both are found we assume that a complete line selection comment added new lines, so we remove them.
            var line          = editor._codeMirror.getLine(prefixPos.line).trim(),
                prefixAtStart = prefixPos.ch === 0 && prefix.length === line.length,
                prefixIndented = indentLineComment && prefix.length === line.length,
                suffixAtStart = false,
                suffixIndented = false;

            if (suffixPos) {
                line = editor._codeMirror.getLine(suffixPos.line).trim();
                suffixAtStart = suffixPos.ch === 0 && suffix.length === line.length;
                suffixIndented = indentLineComment && suffix.length === line.length;
            }

            // Remove the suffix if there is one
            if (suffixPos) {
                if (suffixIndented) {
                    editGroup.push({text: "", start: {line: suffixPos.line, ch: 0}, end: {line: suffixPos.line + 1, ch: 0}});
                } else if (prefixAtStart && suffixAtStart) {
                    editGroup.push({text: "", start: suffixPos, end: {line: suffixPos.line + 1, ch: 0}});
                } else {
                    editGroup.push({text: "", start: suffixPos, end: {line: suffixPos.line, ch: suffixPos.ch + suffix.length}});
                }
            }

            // Remove the prefix
            if (prefixIndented) {
                editGroup.push({text: "", start: {line: prefixPos.line, ch: 0}, end: {line: prefixPos.line + 1, ch: 0}});
            } else if (prefixAtStart && suffixAtStart) {
                editGroup.push({text: "", start: prefixPos, end: {line: prefixPos.line + 1, ch: 0}});
            } else {
                editGroup.push({text: "", start: prefixPos, end: {line: prefixPos.line, ch: prefixPos.ch + prefix.length}});
            }

            // Don't fix up the tracked selections here - let the edit fix them up.
            _.each(selectionsToTrack, function (trackedSel) {
                trackedSel.isBeforeEdit = true;
            });
        }

        edit = {edit: editGroup, selection: selectionsToTrack};
    }

    return edit;
}


/**
 * Generates an edit that adds or removes block-comment tokens to the selection, preserving selection
 * and cursor position. Applies to the currently focused Editor. The selection must already be a
 * line selection in the form returned by `Editor.convertToLineSelections()`.
 *
 * The implementation uses blockCommentPrefixSuffix, with the exception of the case where
 * there is no selection on a uncommented and not empty line. In this case the whole lines gets
 * commented in a block-comment.
 *
 * @param {!Editor} editor
 * @param {!String} prefix
 * @param {!String} suffix
 * @param {!{selectionForEdit: {start:{line:number, ch:number}, end:{line:number, ch:number}, reversed:boolean, primary:boolean},
 *           selectionsToTrack: Array.<{start:{line:number, ch:number}, end:{line:number, ch:number}, reversed:boolean, primary:boolean}>}}
 *      lineSel A line selection as returned from `Editor.convertToLineSelections()`. `selectionForEdit` is the selection to perform
 *      the line comment operation on, and `selectionsToTrack` are a set of selections associated with this line that need to be
 *      tracked through the edit.
 * @param {String} command The command callee. It cans be "line" or "block".
 * @return {{edit: {text: string, start:{line: number, ch: number}, end:?{line: number, ch: number}}|Array.<{text: string, start:{line: number, ch: number}, end:?{line: number, ch: number}}>,
 *                  selection: {start:{line:number, ch:number}, end:{line:number, ch:number}, primary:boolean, reversed: boolean, isBeforeEdit: boolean}>}|
 *                  Array.<{start:{line:number, ch:number}, end:{line:number, ch:number}, primary:boolean, reversed: boolean, isBeforeEdit: boolean}>}}
 *      An edit description suitable for including in the edits array passed to `Document.doMultipleEdits()`.
 */
function _getLineCommentPrefixSuffixEdit(editor: Editor, prefix, suffix, lineSel, command, options: CommentOptions) {
    var sel = lineSel.selectionForEdit;

    // For one-line selections, we shrink the selection to exclude the trailing newline.
    if (sel.end.line === sel.start.line + 1 && sel.end.ch === 0) {
        sel.end = {line: sel.start.line, ch: editor._codeMirror.getLine(sel.start.line).length};
    }

    // Now just run the standard block comment code, but make sure to track any associated selections
    // that were subsumed into this line selection.
    return _getBlockCommentPrefixSuffixEdit(editor, prefix, suffix, [], sel, lineSel.selectionsToTrack, command, options);
}

function _getLineCommentPrefixes(prefixes: string | string[], defaultValue: [] | null): string[] {
    if (!prefixes) {
        return defaultValue;
    }

    if (Array.isArray(prefixes)) {
        return prefixes.length > 0 ? prefixes : defaultValue;
    }
    
    return [prefixes];
}

/**
 * @private
 * Generates an array of edits for toggling line comments on the given selections.
 *
 * @param {!Editor} editor The editor to edit within.
 * @param {Array.<{start:{line:number, ch:number}, end:{line:number, ch:number}, primary:boolean, reversed: boolean, isBeforeEdit: boolean}>}
 *      selections The selections we want to line-comment.
 * @param {String} command The command callee. It cans be "line" or "block".
 * @return {Array.<{edit: {text: string, start:{line: number, ch: number}, end:?{line: number, ch: number}}|Array.<{text: string, start:{line: number, ch: number}, end:?{line: number, ch: number}}>,
 *                  selection: {start:{line:number, ch:number}, end:{line:number, ch:number}, primary:boolean, reversed: boolean, isBeforeEdit: boolean}>}|
 *                  Array.<{start:{line:number, ch:number}, end:{line:number, ch:number}, primary:boolean, reversed: boolean, isBeforeEdit: boolean}>}>}
 *      An array of edit descriptions suitable for including in the edits array passed to `Document.doMultipleEdits()`.
 */
function _getLineCommentEdits(editor: Editor, selections, command, options: CommentOptions) {
    // We need to expand line selections in order to coalesce cursors on the same line, but we
    // don't want to merge adjacent line selections.
    var lineSelections = editor.convertToLineSelections(selections, { mergeAdjacent: false }),
        edits = [];
    _.each(lineSelections, function (lineSel) {
        var sel = lineSel.selectionForEdit,
            mode = editor.getModeForRange(sel.start, sel.end),
            edit;
        if (mode) {
            const cmMode: CommentDelimiters = options.getMode
                ? options.getMode(mode, sel.start)
                : getMode(editor._codeMirror, sel.start);
            const lineCommentPrefixes = _getLineCommentPrefixes(options.lineComment || cmMode.lineComment, null);
            const blockCommentPrefix = options.blockCommentStart || cmMode.blockCommentStart;
            const blockCommentSuffix = options.blockCommentEnd || cmMode.blockCommentEnd;

            if (lineCommentPrefixes) {
                edit = _getLineCommentPrefixEdit(editor, lineCommentPrefixes, blockCommentPrefix, blockCommentSuffix, lineSel, options);
            } else if (blockCommentPrefix || blockCommentSuffix) {
                edit = _getLineCommentPrefixSuffixEdit(editor, blockCommentPrefix, blockCommentSuffix, lineSel, command, options);
            }
        }
        if (!edit) {
            // Even if we didn't want to do an edit, we still need to track the selection.
            edit = {selection: lineSel.selectionsToTrack};
        }
        edits.push(edit);
    });
    return edits;
}

/**
 * Invokes a language-specific line-comment/uncomment handler
 * @param {?Editor} editor If unspecified, applies to the currently focused editor
 */
export function lineComment(editor: Editor, options: CommentOptions) {
    editor.setSelections(Document.doMultipleEdits(editor, _getLineCommentEdits(editor, editor.getSelections(), "line", options)));
}

/**
 * Invokes a language-specific block-comment/uncomment handler
 * @param {?Editor} editor If unspecified, applies to the currently focused editor
 */
export function blockComment(editor: Editor, options: CommentOptions) {
    var edits = [],
        lineCommentSels = [];
    _.each(editor.getSelections(), function (sel) {
        var mode = editor.getModeForRange(sel.start, sel.end),
            edit = {edit: [], selection: [sel]}; // default edit in case we don't have a mode for this selection
        if (mode) {
            const cmMode: CommentDelimiters = options.getMode
                ? options.getMode(mode, sel.start)
                : getMode(editor._codeMirror, sel.start);
            const lineCommentPrefixes = _getLineCommentPrefixes(options.lineComment || cmMode.lineComment, []);
            const blockCommentPrefix = options.blockCommentStart || cmMode.blockCommentStart;
            const blockCommentSuffix = options.blockCommentEnd || cmMode.blockCommentEnd;

            if (blockCommentPrefix || blockCommentSuffix) {
                // getLineCommentPrefixes always return an array, and will be empty if no line comment syntax is defined
                edit = _getBlockCommentPrefixSuffixEdit(
                    editor, blockCommentPrefix, blockCommentSuffix,
                    lineCommentPrefixes, sel, null, "block", options);
                if (!edit) {
                    // This is only null if the block comment code found that the selection is within a line-commented line.
                    // Add this to the list of line-comment selections we need to handle. Since edit is null, we'll skip
                    // pushing anything onto the edit list for this selection.
                    lineCommentSels.push(sel);
                }
            }
        }
        if (edit) {
            edits.push(edit);
        }
    });

    // Handle any line-comment edits. It's okay if these are out-of-order with the other edits, since
    // they shouldn't overlap, and `doMultipleEdits()` will take care of sorting the edits so the
    // selections can be tracked appropriately.
    edits.push.apply(edits, _getLineCommentEdits(editor, lineCommentSels, "block", options));

    editor.setSelections(Document.doMultipleEdits(editor, edits));
}
