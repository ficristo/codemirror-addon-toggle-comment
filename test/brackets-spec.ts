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

/// <reference path="../src/types/codemirror-extension.d.ts" />

import * as CodeMirror from "codemirror";
import "codemirror/mode/xml/xml.js";
import "codemirror/mode/javascript/javascript.js";
import "codemirror/mode/css/css.js";
import "codemirror/mode/htmlmixed/htmlmixed.js";
import "codemirror/mode/coffeescript/coffeescript";

import { Editor } from "../src/Editor";
import "../src/index";

const Pos = CodeMirror.Pos;

describe("EditorCommandHandlers", function () {
    const defaultContent = [
        "function foo() {",
        "    function bar() {",
        "        ",
        "        a();",
        "        ",
        "    }",
        "",
        "}",
    ].join("\n");

    let myEditor;
    const noOptions = undefined;
    let options = noOptions;

    function setupFullEditor(content?, languageId = "javascript") {
        content = content || defaultContent;
        const container = document.createElement("div");
        // Remove when https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31640 is fixed.
        // @ts-ignore
        const codeMirror = new CodeMirror(container);

        myEditor = new Editor(codeMirror);
        myEditor._codeMirror.setOption("mode", languageId);
        myEditor.setText(content);
        myEditor.focus();
    }

    afterEach(function () {
        myEditor = null;
    });

    // Helper functions for testing cursor position / selection range
    function fixPos(pos) {
        if (!("sticky" in pos)) {
            pos.sticky = null;
        }
        return pos;
    }
    function fixSel(sel) {
        fixPos(sel.start);
        fixPos(sel.end);
        if (!("reversed" in sel)) {
            sel.reversed = false;
        }
        return sel;
    }
    function fixSels(sels) {
        sels.forEach(function (sel) {
            fixSel(sel);
        });
        return sels;
    }
    function expectCursorAt(pos: CodeMirror.Position) {
        const selection = myEditor.getSelection();
        expect(selection.start).toEqual(selection.end);
        expect(fixPos(selection.start)).toEqual(fixPos(pos));
    }
    function expectSelection(sel) {
        expect(fixSel(myEditor.getSelection())).toEqual(fixSel(sel));
    }
    function expectSelections(sels) {
        expect(fixSels(myEditor.getSelections())).toEqual(fixSels(sels));
    }

    /**
     * Invokes Toggle Line or Block Comment, expects the given selection/cursor & document text
     * @param {!string} expectedCommentedText
     * @param {!{ch:number,line:number}|{start:{ch:number,line:number},end:{ch:number,line:number}}} expectedCommentedSel
     * @param {?string} expectedSelText If provided, the text that should be selected after the first comment operation.
     * @param {!string} type Either "block" or "line".
     */
    function testToggleComment(expectedCommentedText: string, expectedCommentedSel: CodeMirror.Position | CodeMirror.Selection | CodeMirror.Selections, expectedSelText, type: string) {
        const command = (type === "block" ? "toggleBlockComment" : "toggleLineComment");

        function expectSel(sel) {
            if (Array.isArray(sel)) {
                expectSelections(sel);
            } else if (sel.start) {
                expectSelection(sel);
            } else {
                expectCursorAt(sel);
            }
        }

        // Toggle comment on
        myEditor._codeMirror[command](options);
        expect(myEditor.getText()).toEqual(expectedCommentedText);
        expectSel(expectedCommentedSel);
        if (expectedSelText) {
            expect(myEditor.getSelectedText()).toEqual(expectedSelText);
        }
    }

    function testToggleLine(expectedCommentedText: string, expectedCommentedSel: CodeMirror.Position | CodeMirror.Selection | CodeMirror.Selections, expectedSelText?) {
        testToggleComment(expectedCommentedText, expectedCommentedSel, expectedSelText, "line");
    }

    function testToggleBlock(expectedCommentedText: string, expectedCommentedSel, expectedSelText?) {
        testToggleComment(expectedCommentedText, expectedCommentedSel, expectedSelText, "block");
    }

    describe("Line comment/uncomment with `indent` option enabled", function () {

        beforeEach(function () {
            setupFullEditor();
            options = { indent: true, commentBlankLines: true };
        });

        afterEach(function () {
            options = noOptions;
        });


        it("should comment/uncomment a single line, cursor at start", function () {
            myEditor.setCursorPos(3, 0);

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "        //a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, Pos(3, 0));
            testToggleLine(defaultContent, Pos(3, 0));
        });

        it("should comment/uncomment a single line, cursor at end", function () {
            myEditor.setCursorPos(3, 12);

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "        //a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, Pos(3, 14));
            testToggleLine(defaultContent, Pos(3, 12));
        });

        it("should comment/uncomment first line in file", function () {
            myEditor.setCursorPos(0, 0);

            const expectedText = [
                "//function foo() {",
                "    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, Pos(0, 2));
            testToggleLine(defaultContent, Pos(0, 0));
        });

        it("should comment/uncomment a single partly-selected line", function () {
            // select "function" on line 1
            myEditor.setSelection(Pos(1, 4), Pos(1, 12));

            const expectedText = [
                "function foo() {",
                "    //function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 6), end: Pos(1, 14)});
            testToggleLine(defaultContent, {start: Pos(1, 4), end: Pos(1, 12)});
        });

        it("should comment/uncomment a single selected line", function () {
            // selection covers all of line's text, but not \n at end
            myEditor.setSelection(Pos(1, 0), Pos(1, 20));

            const expectedText = [
                "function foo() {",
                "    //function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(1, 22)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(1, 20)});
        });

        it("should comment/uncomment a single fully-selected line (including LF)", function () {
            // selection including \n at end of line
            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            const expectedText = [
                "function foo() {",
                "    //function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(2, 0)});
        });

        it("should comment/uncomment multiple selected lines", function () {
            // selection including \n at end of line
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            const expectedText = [
                "function foo() {",
                "    //function bar() {",
                "    //    ",
                "    //    a();",
                "    //    ",
                "    //}",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should comment/uncomment ragged multi-line selection", function () {
            myEditor.setSelection(Pos(1, 6), Pos(3, 9));

            const expectedText = [
                "function foo() {",
                "    //function bar() {",
                "    //    ",
                "    //    a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 8), end: Pos(3, 11)}, "nction bar() {\n    //    \n    //    a");
            testToggleLine(defaultContent, {start: Pos(1, 6), end: Pos(3, 9)});
        });

        it("should comment/uncomment when selection starts & ends on whitespace lines", function () {
            myEditor.setSelection(Pos(2, 0), Pos(4, 8));

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "        //",
                "        //a();",
                "        //",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(2, 0), end: Pos(4, 10)});
            testToggleLine(defaultContent, {start: Pos(2, 0), end: Pos(4, 8)});
        });

        it("should comment/uncomment when selection starts on empty lines", function () {
            const startingContent = [
                "function foo() {",
                "    function bar() {",
                "",
                "        a();",
                "",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);
            myEditor.setSelection(Pos(2, 0), Pos(4, 0));

            let expectedText = [
                "function foo() {",
                "    function bar() {",
                "        //",
                "        //a();",
                "",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(2, 0), end: Pos(4, 0)});

            expectedText = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "        a();",
                "",
                "    }",
                "",
                "}",
            ].join("\n");
            testToggleLine(expectedText, {start: Pos(2, 0), end: Pos(4, 0)});
        });

        it("should comment/uncomment when selection ends on empty lines", function () {
            const startingContent = [
                "function foo() {",
                "    function bar() {",
                "",
                "        a();",
                "",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);
            myEditor.setSelection(Pos(3, 0), Pos(5, 0));

            let expectedText = [
                "function foo() {",
                "    function bar() {",
                "",
                "        //a();",
                "        //",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(3, 0), end: Pos(5, 0)});

            expectedText = [
                "function foo() {",
                "    function bar() {",
                "",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            testToggleLine(expectedText, {start: Pos(3, 0), end: Pos(5, 0)});
        });

        it("should do nothing on whitespace line", function () {
            myEditor.setCursorPos(2, 8);

            testToggleLine(defaultContent, Pos(2, 8));
            testToggleLine(defaultContent, Pos(2, 8));
        });

        it("should do nothing when only whitespace lines selected", function () {
            // Start with line 2 duplicated twice (3 copies total)
            const startingContent = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "        ",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            myEditor.setSelection(Pos(2, 4), Pos(4, 4));

            testToggleLine(startingContent, {start: Pos(2, 4), end: Pos(4, 4)});
        });

        it("should comment/uncomment after select all", function () {
            myEditor.setSelection(Pos(0, 0), Pos(7, 1));

            const expectedText = [
                "//function foo() {",
                "//    function bar() {",
                "//        ",
                "//        a();",
                "//        ",
                "//    }",
                "//",
                "//}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(0, 0), end: Pos(7, 3)});
            testToggleLine(defaultContent, {start: Pos(0, 0), end: Pos(7, 1)});
        });

        it("should comment/uncomment lines that were partially commented out already, our style", function () {
            // Start with line 3 commented out, with "//" at column 0
            const startingContent = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "//        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select lines 1-3
            myEditor.setSelection(Pos(1, 0), Pos(4, 0));

            const expectedText = [
                "function foo() {",
                "//    function bar() {",
                "//        ",
                "////        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
            testToggleLine(startingContent, {start: Pos(1, 0), end: Pos(4, 0)});
        });

        it("should comment/uncomment lines that were partially commented out already, comment closer to code", function () {
            // Start with line 3 commented out, with "//" snug against the code
            const startingContent = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "        //a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select lines 1-3
            myEditor.setSelection(Pos(1, 0), Pos(4, 0));

            const expectedText = [
                "function foo() {",
                "    //function bar() {",
                "    //    ",
                "    //    //a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
            testToggleLine(startingContent, {start: Pos(1, 0), end: Pos(4, 0)});
        });

        it("should uncomment indented, aligned comments", function () {
            // Start with lines 1-5 commented out, with "//" all aligned at column 4
            const startingContent = [
                "function foo() {",
                "    //function bar() {",
                "    //    ",
                "    //    a();",
                "    //    ",
                "    //}",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select lines 1-5
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});
            testToggleLine(startingContent, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should uncomment ragged partial comments with empty lines in-between", function () {
            // Start with lines 1-5 commented out, with "//" snug up against each non-blank line's code
            const startingContent = [
                "function foo() {",
                "    //function bar() {",
                "",
                "        //a();",
                "",
                "    //}",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select lines 1-5
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            let expectedText = [
                "function foo() {",
                "    function bar() {",
                "",
                "        a();",
                "",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});

            expectedText = [
                "function foo() {",
                "    //function bar() {",
                "    //",
                "    //    a();",
                "    //",
                "    //}",
                "",
                "}",
            ].join("\n");
            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should uncomment ragged partial comments", function () {
            // Start with lines 1-5 commented out, with "//" snug up against each non-blank line's code
            const startingContent = [
                "function foo() {",
                "    //function bar() {",
                "        ",
                "        //a();",
                "        ",
                "    //}",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select lines 1-5
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});

            const expectedText = [
                "function foo() {",
                "    //function bar() {",
                "    //    ",
                "    //    a();",
                "    //    ",
                "    //}",
                "",
                "}",
            ].join("\n");
            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        describe("with multiple selections", function () {
            it("should toggle comments on separate lines with cursor selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                ]);

                const expectedText = [
                    "function foo() {",
                    "    //function bar() {",
                    "        ",
                    "        //a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(1, 6), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), reversed: false, primary: true},
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), reversed: false, primary: true},
                ]);
            });

            it("should toggle comments on separate lines with range selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 6)},
                    {start: Pos(3, 4), end: Pos(3, 6)},
                ]);

                const expectedText = [
                    "function foo() {",
                    "    //function bar() {",
                    "        ",
                    "        //a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    { start: Pos(1, 6), end: Pos(1, 8), reversed: false, primary: false },
                    { start: Pos(3, 4), end: Pos(3, 6), reversed: false, primary: true },
                ]);
                testToggleLine(defaultContent, [
                    { start: Pos(1, 4), end: Pos(1, 6), reversed: false, primary: false },
                    { start: Pos(3, 4), end: Pos(3, 6), reversed: false, primary: true },
                ]);
            });

            it("should toggle comments on separate lines with multiline selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(2, 6)},
                    {start: Pos(3, 4), end: Pos(4, 6)},
                ]);

                const expectedText = [
                    "function foo() {",
                    "    //function bar() {",
                    "    //    ",
                    "        //a();",
                    "        //",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(2, 8), reversed: false, primary: false},
                    {start: Pos(3, 4), end: Pos(4, 6), reversed: false, primary: true},
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(2, 6), reversed: false, primary: false},
                    {start: Pos(3, 4), end: Pos(4, 6), reversed: false, primary: true},
                ]);
            });

            it("should adjust selections appropriately at start of line", function () {
                myEditor.setSelections([
                    {start: Pos(1, 0), end: Pos(1, 0)},
                    {start: Pos(3, 0), end: Pos(3, 6)},
                ]);

                // FIXME
                // const expectedText = [
                //     "function foo() {",
                //     "    //function bar() {",
                //     "        ",
                //     "        //a();",
                //     "        ",
                //     "    }",
                //     "",
                //     "}"
                // ].join("\n");
                //
                // testToggleLine(expectedText, [
                //     {start: Pos(1, 0), end: Pos(1, 0), reversed: false, primary: false },
                //     {start: Pos(3, 0), end: Pos(3, 6), reversed: false, primary: true }
                // ]);
                // testToggleLine(defaultContent, [
                //     {start: Pos(1, 0), end: Pos(1, 0), reversed: false, primary: false },
                //     {start: Pos(3, 0), end: Pos(3, 6), reversed: false, primary: true }
                // ]);
            });

            it("should only handle each line once, but preserve primary/reversed flags on ignored selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(1, 6), end: Pos(2, 4), primary: true},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                    {start: Pos(3, 6), end: Pos(3, 8), reversed: true},
                ]);

                const expectedText = [
                    "function foo() {",
                    "    //function bar() {",
                    "    //    ",
                    "        //a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(1, 6), reversed: false, primary: false},
                    {start: Pos(1, 8), end: Pos(2, 6), reversed: false, primary: true},
                    {start: Pos(3, 4), end: Pos(3, 4), reversed: false, primary: false},
                    {start: Pos(3, 6), end: Pos(3, 10), reversed: true, primary: false},
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), reversed: false, primary: false},
                    {start: Pos(1, 6), end: Pos(2, 4), reversed: false, primary: true},
                    {start: Pos(3, 4), end: Pos(3, 4), reversed: false, primary: false},
                    {start: Pos(3, 6), end: Pos(3, 8), reversed: true, primary: false},
                ]);
            });

            it("should properly toggle when some selections are already commented but others aren't", function () {
                const startingContent = [
                    "function foo() {",
                    "    //function bar() {",
                    "        ",
                    "    a();",
                    "        ",
                    "    //}",
                    "",
                    "}",
                ].join("\n");
                myEditor.setText(startingContent);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                    {start: Pos(5, 4), end: Pos(5, 4)},
                ]);

                const expectedText = [
                    "function foo() {",
                    "    function bar() {",
                    "        ",
                    "    //a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    { start : Pos(1, 4), end : Pos(1, 4), reversed : false, primary : false },
                    { start : Pos(3, 6), end : Pos(3, 6), reversed : false, primary : false },
                    { start : Pos(5, 4), end : Pos(5, 4), reversed : false, primary : true },
                ]);
                testToggleLine(startingContent, [
                    { start : Pos(1, 6), end : Pos(1, 6), reversed : false, primary : false },
                    { start : Pos(3, 4), end : Pos(3, 4), reversed : false, primary : false },
                    { start : Pos(5, 6), end : Pos(5, 6), reversed : false, primary : true },
                ]);
            });

            it("should properly toggle adjacent lines (not coalescing them) if there are cursors on each line", function () {
                const startingContent = [
                    "function foo() {",
                    "//    function bar() {",
                    "    foo();", // make this line non-blank so it will get commented
                    "//        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");
                myEditor.setText(startingContent);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(2, 4), end: Pos(2, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                ]);

                let expectedText = [
                    "function foo() {",
                    "    function bar() {",
                    "    //foo();",
                    "        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");
                testToggleLine(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: false, reversed: false},
                    {start: Pos(2, 6), end: Pos(2, 6), primary: false, reversed: false},
                    {start: Pos(3, 2), end: Pos(3, 2), primary: true, reversed: false},
                ]);

                expectedText = [
                    "function foo() {",
                    "    //function bar() {",
                    "    foo();",
                    "        //a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");
                testToggleLine(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: false, reversed: false},
                    {start: Pos(2, 4), end: Pos(2, 4), primary: false, reversed: false},
                    {start: Pos(3, 2), end: Pos(3, 2), primary: true, reversed: false},
                ]);
            });
        });
    });

    describe("Line comment/uncomment with `indent` option disabled", function () {
        beforeEach(function () {
            setupFullEditor();
            options = { indent: false, commentBlankLines: true };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should comment/uncomment a single line, cursor at start", function () {
            myEditor.setCursorPos(3, 0);

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "//        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, Pos(3, 2));
            testToggleLine(defaultContent, Pos(3, 0));
        });

        it("should comment/uncomment a single line, cursor at end", function () {
            myEditor.setCursorPos(3, 12);

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "//        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, Pos(3, 14));
            testToggleLine(defaultContent, Pos(3, 12));
        });

        it("should comment/uncomment first line in file", function () {
            myEditor.setCursorPos(0, 0);

            const expectedText = [
                "//function foo() {",
                "    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, Pos(0, 2));
            testToggleLine(defaultContent, Pos(0, 0));
        });

        it("should comment/uncomment a single partly-selected line", function () {
            // select "function" on line 1
            myEditor.setSelection(Pos(1, 4), Pos(1, 12));

            const expectedText = [
                "function foo() {",
                "//    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 6), end: Pos(1, 14)});
            testToggleLine(defaultContent, {start: Pos(1, 4), end: Pos(1, 12)});
        });

        it("should comment/uncomment a single selected line", function () {
            // selection covers all of line's text, but not \n at end
            myEditor.setSelection(Pos(1, 0), Pos(1, 20));

            const expectedText = [
                "function foo() {",
                "//    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(1, 22)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(1, 20)});
        });

        it("should comment/uncomment a single fully-selected line (including LF)", function () {
            // selection including \n at end of line
            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            const expectedText = [
                "function foo() {",
                "//    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(2, 0)});
        });

        it("should comment/uncomment multiple selected lines", function () {
            // selection including \n at end of line
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            const expectedText = [
                "function foo() {",
                "//    function bar() {",
                "//        ",
                "//        a();",
                "//        ",
                "//    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should comment/uncomment ragged multi-line selection", function () {
            myEditor.setSelection(Pos(1, 6), Pos(3, 9));

            const expectedText = [
                "function foo() {",
                "//    function bar() {",
                "//        ",
                "//        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 8), end: Pos(3, 11)}, "nction bar() {\n//        \n//        a");
            testToggleLine(defaultContent, {start: Pos(1, 6), end: Pos(3, 9)}, "nction bar() {\n        \n        a");
        });

        it("should comment/uncomment when selection starts & ends on whitespace lines", function () {
            myEditor.setSelection(Pos(2, 0), Pos(4, 8));

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "//        ",
                "//        a();",
                "//        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(2, 0), end: Pos(4, 10)});
            testToggleLine(defaultContent, {start: Pos(2, 0), end: Pos(4, 8)});
        });

        it("should comment/uncomment lines that were partially commented out already, our style", function () {
            // Start with line 3 commented out, with "//" at column 0
            const startingContent = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "//        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select lines 1-3
            myEditor.setSelection(Pos(1, 0), Pos(4, 0));

            const expectedText = [
                "function foo() {",
                "//    function bar() {",
                "//        ",
                "////        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
            testToggleLine(startingContent, {start: Pos(1, 0), end: Pos(4, 0)});
        });

        it("should comment/uncomment lines that were partially commented out already, comment closer to code", function () {
            // Start with line 3 commented out, with "//" snug against the code
            const startingContent = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "        //a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select lines 1-3
            myEditor.setSelection(Pos(1, 0), Pos(4, 0));

            const expectedText = [
                "function foo() {",
                "//    function bar() {",
                "//        ",
                "//        //a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
            testToggleLine(startingContent, {start: Pos(1, 0), end: Pos(4, 0)});
        });

        describe("with multiple selections", function () {
            it("should toggle comments on separate lines with cursor selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                ]);
                const expectedText = [
                    "function foo() {",
                    "//    function bar() {",
                    "        ",
                    "//        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(1, 6), primary: false, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 6), primary: true, reversed: false},
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), primary: true, reversed: false},
                ]);
            });

            it("should toggle comments on separate lines with range selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 6)},
                    {start: Pos(3, 4), end: Pos(3, 6)},
                ]);

                const expectedText = [
                    "function foo() {",
                    "//    function bar() {",
                    "        ",
                    "//        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(1, 8), primary: false, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 8), primary: true, reversed: false},
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 6), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 6), primary: true, reversed: false},
                ]);
            });

            it("should toggle comments on separate lines with multiline selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(2, 6)},
                    {start: Pos(3, 4), end: Pos(4, 6)},
                ]);

                const expectedText = [
                    "function foo() {",
                    "//    function bar() {",
                    "//        ",
                    "//        a();",
                    "//        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(2, 8), primary: false, reversed: false},
                    {start: Pos(3, 6), end: Pos(4, 8), primary: true, reversed: false},
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(2, 6), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(4, 6), primary: true, reversed: false},
                ]);
            });

            it("should adjust selections appropriately at start of line", function () {
                myEditor.setSelections([
                    {start: Pos(1, 0), end: Pos(1, 0)},
                    {start: Pos(3, 0), end: Pos(3, 6)},
                ]);

                const expectedText = [
                    "function foo() {",
                    "//    function bar() {",
                    "        ",
                    "//        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: false, reversed: false},
                    {start: Pos(3, 0), end: Pos(3, 8), primary: true, reversed: false},
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 0), end: Pos(1, 0), primary: false, reversed: false},
                    {start: Pos(3, 0), end: Pos(3, 6), primary: true, reversed: false},
                ]);
            });

            it("should only handle each line once, but preserve primary/reversed flags on ignored selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(1, 6), end: Pos(2, 4), primary: true},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                    {start: Pos(3, 6), end: Pos(3, 8), reversed: true},
                ]);

                const expectedText = [
                    "function foo() {",
                    "//    function bar() {",
                    "//        ",
                    "//        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(1, 6), primary: false, reversed: false},
                    {start: Pos(1, 8), end: Pos(2, 6), primary: true, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 6), primary: false, reversed: false},
                    {start: Pos(3, 8), end: Pos(3, 10), primary: false, reversed: true},
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                    {start: Pos(1, 6), end: Pos(2, 4), primary: true, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), primary: false, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 8), primary: false, reversed: true},
                ]);
            });

            it("should properly toggle when some selections are already commented but others aren't", function () {
                const startingContent = [
                    "function foo() {",
                    "//    function bar() {",
                    "        ",
                    "        a();",
                    "        ",
                    "//    }",
                    "",
                    "}",
                ].join("\n");
                myEditor.setText(startingContent);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                    {start: Pos(5, 4), end: Pos(5, 4)},
                ]);

                const expectedText = [
                    "function foo() {",
                    "    function bar() {",
                    "        ",
                    "//        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: false, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 6), primary: false, reversed: false},
                    {start: Pos(5, 2), end: Pos(5, 2), primary: true, reversed: false},
                ]);
                testToggleLine(startingContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), primary: false, reversed: false},
                    {start: Pos(5, 4), end: Pos(5, 4), primary: true, reversed: false},
                ]);
            });

            it("should properly toggle adjacent lines (not coalescing them) if there are cursors on each line", function () {
                const startingContent = [
                    "function foo() {",
                    "//    function bar() {",
                    "    foo();", // make this line non-blank so it will get commented
                    "//        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");
                myEditor.setText(startingContent);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(2, 4), end: Pos(2, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                ]);

                const expectedText = [
                    "function foo() {",
                    "    function bar() {",
                    "//    foo();",
                    "        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: false, reversed: false},
                    {start: Pos(2, 6), end: Pos(2, 6), primary: false, reversed: false},
                    {start: Pos(3, 2), end: Pos(3, 2), primary: true, reversed: false},
                ]);
                testToggleLine(startingContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                    {start: Pos(2, 4), end: Pos(2, 4), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), primary: true, reversed: false},
                ]);
            });
        });
    });

    describe("Line comment/uncomment with `padding` option enabled", function () {
        beforeEach(function () {
            setupFullEditor();
            options = { indent: false, padding: " ", commentBlankLines: true };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should comment/uncomment a single line, cursor at start", function () {
            myEditor.setCursorPos(3, 0);

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "//         a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, Pos(3, 3));
            testToggleLine(defaultContent, Pos(3, 0));
        });

        it("should comment/uncomment first line in file", function () {
            myEditor.setCursorPos(0, 0);

            const expectedText = [
                "// function foo() {",
                "    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, Pos(0, 3));
            testToggleLine(defaultContent, Pos(0, 0));
        });

        it("should comment/uncomment first line in file", function () {
            myEditor.setCursorPos(0, 0);

            const expectedText = [
                "// function foo() {",
                "    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, Pos(0, 3));
            testToggleLine(defaultContent, Pos(0, 0));
        });

        it("should uncomment/comment after select all", function () {
            const startingContent = [
                "// function foo() {",
                "//     function bar() {",
                "//         ",
                "//         a();",
                "//         ",
                "//     }",
                "// ",
                "// }",
            ].join("\n");
            myEditor.setText(startingContent);

            myEditor.setSelection(Pos(0, 0), Pos(7, 4));

            testToggleLine(defaultContent, {start: Pos(0, 0), end: Pos(7, 1)});
            testToggleLine(startingContent, {start: Pos(0, 0), end: Pos(7, 4)});
        });


        it("should uncomment/comment after select all but no padding", function () {
            const startingContent = [
                "//function foo() {",
                "//    function bar() {",
                "//        ",
                "//        a();",
                "//        ",
                "//    }",
                "//",
                "//}",
            ].join("\n") + "\n";
            myEditor.setText(startingContent);

            myEditor.setSelection(Pos(0, 0), Pos(8, 0));

            let expectedText = [
                "function foo() {",
                "   function bar() {",
                "       ",
                "       a();",
                "       ",
                "   }",
                "",
                "}",
            ].join("\n") + "\n";

            testToggleLine(expectedText, {start: Pos(0, 0), end: Pos(8, 0)});

            expectedText = [
                "// function foo() {",
                "//    function bar() {",
                "//        ",
                "//        a();",
                "//        ",
                "//    }",
                "// ",
                "// }",
            ].join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(0, 0), end: Pos(8, 0)});
        });
    });

    describe("Line comment/uncomment with `commentBlankLines` option disabled", function () {
        beforeEach(function () {
            setupFullEditor();
            options = { commentBlankLines: false };
        });

        afterEach(function () {
            options = noOptions;
        });

        describe("and `indent` option disabled", function () {
            beforeEach(function () {
                options.indent = false;
            });

            it("should do nothing, when only an empty line is selected", function () {
                myEditor.setCursorPos(2, 0);

                testToggleLine(defaultContent, Pos(2, 0));
            });

            it("should comment/uncomment after select all", function () {
                myEditor.setSelection(Pos(0, 0), Pos(7, 1));

                const expectedText = [
                    "//function foo() {",
                    "//    function bar() {",
                    "        ",
                    "//        a();",
                    "        ",
                    "//    }",
                    "",
                    "//}",
                ].join("\n");

                testToggleLine(expectedText, {start: Pos(0, 0), end: Pos(7, 3)});
                testToggleLine(defaultContent, {start: Pos(0, 0), end: Pos(7, 1)});
            });
        });

        describe("and `indent` option enabled", function () {
            beforeEach(function () {
                options.indent = true;
            });

            it("should comment/uncomment after select all", function () {
                myEditor.setSelection(Pos(1, 0), Pos(7, 0));

                const expectedText = [
                    "function foo() {",
                    "    //function bar() {",
                    "        ",
                    "    //    a();",
                    "        ",
                    "    //}",
                    "",
                    "}",
                ].join("\n");

                testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(7, 0)});
                testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(7, 0)});
            });
        });
    });

    describe("Line comment/uncomment in languages with only block comments and with `indent` option enabled", function () {
        const htmlContent = [
            "<html>",
            "    <body>",
            "        <p>Hello</p>",
            "    </body>",
            "</html>",
        ].join("\n");

        beforeEach(function () {
            setupFullEditor(htmlContent, "htmlmixed");
            options = { indent: true, commentBlankLines: true };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should comment/uncomment a single line, cursor at start", function () {
            myEditor.setCursorPos(2, 0);

            const expectedText = [
                "<html>",
                "    <body>",
                "        <!--<p>Hello</p>-->",
                "    </body>",
                "</html>",
            ].join("\n");

            testToggleLine(expectedText, Pos(2, 0));
            testToggleLine(htmlContent, Pos(2, 0));
        });

        it("should comment/uncomment a block", function () {
            myEditor.setSelection(Pos(1, 7), Pos(3, 7));

            const expectedText = [
                "<html>",
                "    <!--",
                "    <body>",
                "        <p>Hello</p>",
                "    </body>",
                "    -->",
                "</html>",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(2, 7), end: Pos(4, 7)});
            testToggleLine(htmlContent, {start: Pos(1, 7), end: Pos(3, 7)});
        });

        it("should comment/uncomment a block with not closing tag ", function () {
            myEditor.setSelection(Pos(1, 7), Pos(2, 7));

            const expectedText = [
                "<html>",
                "    <!--",
                "    <body>",
                "        <p>Hello</p>",
                "        -->",
                "    </body>",
                "</html>",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(2, 7), end: Pos(3, 7)});
            testToggleLine(htmlContent, {start: Pos(1, 7), end: Pos(2, 7)});
        });

        it("should comment/uncomment a block with not closing tag at end of file", function () {
            myEditor.setSelection(Pos(3, 9), Pos(4, 5));

            const expectedText = [
                "<html>",
                "    <body>",
                "        <p>Hello</p>",
                "    <!--",
                "    </body>",
                "</html>-->\n",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(4, 9), end: Pos(5, 5)});
            testToggleLine(htmlContent + "\n", {start: Pos(3, 9), end: Pos(4, 5)});
        });
    });

    describe("Line comment/uncomment in languages with only block comments and with `indent` option enabled and use of Tabs", function () {
        const htmlContent = [
            "<html>",
            "\t<body>",
            "\t\t<p>Hello</p>",
            "\t</body>",
            "</html>",
        ].join("\n");

        beforeEach(function () {
            setupFullEditor(htmlContent, "htmlmixed");
            options = { indent: true, commentBlankLines: true };
            myEditor._codeMirror.setOption("indentWithTabs", true);
        });

        afterEach(function () {
            myEditor._codeMirror.setOption("indentWithTabs", false);
            options = noOptions;
        });

        it("should comment/uncomment a single line, cursor at start", function () {
            myEditor.setCursorPos(2, 0);

            const expectedText = [
                "<html>",
                "\t<body>",
                "\t\t<!--<p>Hello</p>-->",
                "\t</body>",
                "</html>",
            ].join("\n");

            testToggleLine(expectedText, Pos(2, 0));
            testToggleLine(htmlContent, Pos(2, 0));
        });

        it("should comment/uncomment a block", function () {
            myEditor.setSelection(Pos(1, 4), Pos(3, 4));

            const expectedText = [
                "<html>",
                "\t<!--",
                "\t<body>",
                "\t\t<p>Hello</p>",
                "\t</body>",
                "\t-->",
                "</html>",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(2, 4), end: Pos(4, 4)});
            testToggleLine(htmlContent, {start: Pos(1, 4), end: Pos(3, 4)});
        });

        it("should comment/uncomment a block with not closing tag ", function () {
            myEditor.setSelection(Pos(1, 4), Pos(2, 7));

            const expectedText = [
                "<html>",
                "\t<!--",
                "\t<body>",
                "\t\t<p>Hello</p>",
                "\t\t-->",
                "\t</body>",
                "</html>",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(2, 4), end: Pos(3, 7)});
            testToggleLine(htmlContent, {start: Pos(1, 4), end: Pos(2, 7)});
        });

        it("should comment/uncomment a block with not closing tag at end of file", function () {
            myEditor.setSelection(Pos(3, 6), Pos(4, 2));

            const expectedText = [
                "<html>",
                "\t<body>",
                "\t\t<p>Hello</p>",
                "\t<!--",
                "\t</body>",
                "</html>-->\n",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(4, 6), end: Pos(5, 2)});
            testToggleLine(htmlContent + "\n", {start: Pos(3, 6), end: Pos(4, 2)});
        });
    });

    // The "block comment" command should be unaffected by `indent` option.
    describe("Block comment/uncomment in languages with only block comments and with `indent` option enabled", function () {
        const htmlContent = [
            "<html>",
            "    <body>",
            "        <p>Hello</p>",
            "    </body>",
            "</html>",
        ].join("\n");

        beforeEach(function () {
            setupFullEditor(htmlContent, "htmlmixed");
            options = { indent: true, commentBlankLines: true };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should comment/uncomment a single line, cursor at start", function () {
            myEditor.setCursorPos(2, 0);

            const expectedText = [
                "<html>",
                "    <body>",
                "<!---->        <p>Hello</p>",
                "    </body>",
                "</html>",
            ].join("\n");

            testToggleBlock(expectedText, Pos(2, 4));
            testToggleBlock(htmlContent, Pos(2, 0));
        });

        it("should comment/uncomment a single line, cursor at end", function () {
            myEditor.setCursorPos(2, 20);

            const expectedText = [
                "<html>",
                "    <body>",
                "        <p>Hello</p><!---->",
                "    </body>",
                "</html>",
            ].join("\n");

            testToggleBlock(expectedText, Pos(2, 24));
            testToggleBlock(htmlContent, Pos(2, 20));
        });

        it("should comment/uncomment a block", function () {
            myEditor.setSelection(Pos(1, 4), Pos(3, 11));

            const expectedText = [
                "<html>",
                "    <!--<body>",
                "        <p>Hello</p>",
                "    </body>-->",
                "</html>",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 8), end: Pos(3, 11)});
            testToggleBlock(htmlContent, {start: Pos(1, 4), end: Pos(3, 11)});
        });
    });

    describe("Line comment in languages with mutiple line comment prefixes", function () {
        beforeAll(function () {
            // Define a special version of JavaScript for testing purposes
            CodeMirror.extendMode("javascript", {
                "lineComment": <any>["//", "////", "#"],
            });
        });

        afterAll(function () {
            // Restore the JavaScript mode
            CodeMirror.extendMode("javascript", {
                "lineComment": "//",
            });
        });

        beforeEach(function () {
            setupFullEditor(null, "javascript");
            options = { indent: false, padding: "", commentBlankLines: true };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should comment using the first prefix", function () {
            // select first 2 lines
            myEditor.setSelection(Pos(0, 4), Pos(1, 12));

            const expectedText = [
                "//function foo() {",
                "//    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(expectedText, {start: Pos(0, 6), end: Pos(1, 14)});
            testToggleLine(defaultContent, {start: Pos(0, 4), end: Pos(1, 12)});
        });

        it("should uncomment every prefix", function () {
            // Start with lines 1-5 commented out, with multiple line comment variations
            const startingContent = [
                "function foo() {",
                "//    function bar() {",
                "    //    ",
                "    ////    a();",
                "        ",
                "#    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select lines 1-5
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            const expectedText = [
                "function foo() {",
                "//    function bar() {",
                "//        ",
                "//        a();",
                "//        ",
                "//    }",
                "",
                "}",
            ].join("\n");

            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});
            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should only uncomment the first prefix", function () {
            // Start with lines 1-3 commented out, with multiple line comment variations
            const startingContent = [
                "function foo() {",
                "//#    function bar() {",
                "//        ",
                "//////        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // const expectedText = [
            //     "function foo() {",
            //     "#    function bar() {",
            //     "        ",
            //     "////        a();",
            //     "        ",
            //     "    }",
            //     "",
            //     "}"
            // ].join("\n");

            // select lines 1-3
            myEditor.setSelection(Pos(1, 0), Pos(4, 0));

            // FIXME
            // testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});

            // FIXME
            // TODO: verify if the empty line should be commented
            // lines = defaultContent.split("\n");
            // lines[2] = "//        ";
            // expectedText = lines.join("\n");
            // testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
        });
    });

    describe("Line comment in languages with no given line comment prefix", function () {
        beforeEach(function () {
            setupFullEditor(null, "null");
        });

        it("should properly restore the cursor", function () {
            myEditor.setSelection(Pos(1, 4), Pos(1, 4));

            testToggleLine(defaultContent, {start: Pos(1, 4), end: Pos(1, 4)});
        });

        it("should properly restore the range selection", function () {
            myEditor.setSelection(Pos(1, 4), Pos(1, 6));

            testToggleLine(defaultContent, {start: Pos(1, 4), end: Pos(1, 6)});
        });

        it("should properly restore the cursors", function () {
            myEditor.setSelections([
                {start: Pos(1, 4), end: Pos(1, 4)},
                {start: Pos(3, 4), end: Pos(3, 4)},
            ]);

            testToggleLine(defaultContent, [
                {start: Pos(1, 4), end: Pos(1, 4), reversed: false, primary: false},
                {start: Pos(3, 4), end: Pos(3, 4), reversed: false, primary: true},
            ]);
        });

        it("should properly restore the range selections", function () {
            myEditor.setSelections([
                {start: Pos(1, 4), end: Pos(1, 6)},
                {start: Pos(3, 4), end: Pos(3, 6)},
            ]);

            testToggleLine(defaultContent, [
                {start: Pos(1, 4), end: Pos(1, 6), reversed: false, primary: false},
                {start: Pos(3, 4), end: Pos(3, 6), reversed: false, primary: true},
            ]);
        });

        it("should properly restore primary/reversed range selections", function () {
            myEditor.setSelections([
                {start: Pos(1, 4), end: Pos(1, 4), primary: true},
                {start: Pos(3, 4), end: Pos(3, 12), reversed: true},
            ]);

            testToggleLine(defaultContent, [
                {start: Pos(1, 4), end: Pos(1, 4), reversed: false, primary: true},
                {start: Pos(3, 4), end: Pos(3, 12), reversed: true, primary: false},
            ]);
        });
    });

    describe("Block comment/uncomment", function () {
        beforeEach(function () {
            setupFullEditor();
        });

        it("should block comment/uncomment, cursor at start of line", function () {
            myEditor.setCursorPos(0, 0);

            const expectedText = [
                "/**/function foo() {",
                "    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, Pos(0, 2));
            testToggleBlock(defaultContent, Pos(0, 0));
        });

        it("should block comment/uncomment, cursor to left of existing block comment", function () {
            // Start with part of line 3 wrapped in a block comment
            const startingContent = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "        /*a();*/",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // put cursor to left of block
            myEditor.setCursorPos(3, 4);

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "    /**/    /*a();*/",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, Pos(3, 6));
            testToggleBlock(startingContent, Pos(3, 4));
        });

        it("should block comment/uncomment, subset of line selected", function () {
            myEditor.setSelection(Pos(1, 13), Pos(1, 18)); // select "bar()"

            const expectedText = [
                "function foo() {",
                "    function /*bar()*/ {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            // Selects just text within block
            testToggleBlock(expectedText, {start: Pos(1, 15), end: Pos(1, 20)});
            testToggleBlock(defaultContent, {start: Pos(1, 13), end: Pos(1, 18)});
        });

        it("should block uncomment, cursor within existing sub-line block comment", function () {
            // Start with part of line 1 wrapped in a block comment
            const startingContent = [
                "function foo() {",
                "    function /*bar()*/ {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // put cursor within block
            myEditor.setCursorPos(1, 18);

            testToggleBlock(defaultContent, Pos(1, 16));

            const expectedText = [
                "function foo() {",
                "    function bar/**/() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, Pos(1, 18));
        });

        it("should block uncomment, cursor within existing block comment suffix", function () {
            // Start with part of line 1 wrapped in a block comment
            const startingContent = [
                "function foo() {",
                "    function /*bar()*/ {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // put cursor within block
            myEditor.setCursorPos(1, 21);

            testToggleBlock(defaultContent, Pos(1, 18));

            const expectedText = [
                "function foo() {",
                "    function bar()/**/ {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, Pos(1, 20));
        });

        it("should block uncomment, selection covering whole sub-line block comment", function () {
            // Start with part of line 1 wrapped in a block comment
            const startingContent = [
                "function foo() {",
                "    function /*bar()*/ {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select whole comment
            myEditor.setSelection(Pos(1, 13), Pos(1, 22));

            testToggleBlock(defaultContent, {start: Pos(1, 13), end: Pos(1, 18)}); // just text that was uncommented
            testToggleBlock(startingContent, {start: Pos(1, 15), end: Pos(1, 20)});
        });

        it("should block comment/uncomment, selection from mid-line end of line", function () {
            myEditor.setSelection(Pos(3, 8), Pos(3, 12));

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "        /*a();*/",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            // Selects just text within block
            testToggleBlock(expectedText, {start: Pos(3, 10), end: Pos(3, 14)});
            testToggleBlock(defaultContent, {start: Pos(3, 8), end: Pos(3, 12)});
        });

        it("should block comment/uncomment, all of line selected but not newline", function () {
            myEditor.setSelection(Pos(3, 0), Pos(3, 12));

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "/*        a();*/",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            // Selects just text within block
            testToggleBlock(expectedText, {start: Pos(3, 2), end: Pos(3, 14)});
            testToggleBlock(defaultContent, {start: Pos(3, 0), end: Pos(3, 12)});
        });

        it("should block comment/uncomment, all of line selected including newline", function () {
            myEditor.setSelection(Pos(3, 0), Pos(4, 0));

            const expectedText = [
                "function foo() {",
                "    function bar() {",
                "        ",
                "/*",
                "        a();",
                "*/",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            // Selects original line, but not block-delimiter lines
            testToggleBlock(expectedText, {start: Pos(4, 0), end: Pos(5, 0)});
            testToggleBlock(defaultContent, {start: Pos(3, 0), end: Pos(4, 0)});
        });

        it("should block comment/uncomment, multiple lines selected", function () {
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            const expectedText = [
                "function foo() {",
                "/*",
                "    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "*/",
                "",
                "}",
            ].join("\n");

            // Selects original lines, but not block-delimiter lines
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(7, 0)});
            testToggleBlock(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should block comment/uncomment, multiple partial lines selected", function () {
            myEditor.setSelection(Pos(1, 13), Pos(3, 9));

            const expectedText = [
                "function foo() {",
                "    function /*bar() {",
                "        ",
                "        a*/();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            // Selects just text within block
            testToggleBlock(expectedText, {start: Pos(1, 15), end: Pos(3, 9)});
            testToggleBlock(defaultContent, {start: Pos(1, 13), end: Pos(3, 9)});
        });

        // Whitespace within block comments

        const BLOCK_CONTAINING_WS = [
            "function foo()",
            "/*",
            "    a();",
            "    ",
            "    b();",
            "*/",
            "}",
        ].join("\n");

        it("should block uncomment, cursor in whitespace within block comment", function () {
            myEditor.setText(BLOCK_CONTAINING_WS);

            myEditor.setCursorPos(3, 2); // middle of blank line

            let expectedText = [
                "function foo()",
                "    a();",
                "    ",
                "    b();",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, Pos(2, 2));

            expectedText = [
                "function foo()",
                "    a();",
                "  /**/  ",
                "    b();",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, Pos(2, 4));
        });

        it("should block uncomment, selection in whitespace within block comment", function () {
            myEditor.setText(BLOCK_CONTAINING_WS);

            myEditor.setSelection(Pos(3, 0), Pos(3, 4));

            let expectedText = [
                "function foo()",
                "    a();",
                "    ",
                "    b();",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(2, 4)});

            expectedText = [
                "function foo()",
                "    a();",
                "/*    */",
                "    b();",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 2), end: Pos(2, 6)});
        });

        // Selections mixing whitespace and existing block comments

        const WS_SURROUNDING_BLOCK = [
            "function foo()",
            "    ",
            "    /*a();",
            "    ",
            "    b();*/",
            "    ",
            "}",
        ].join("\n");

        it("should block uncomment, selection covers block comment plus whitespace before", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);

            myEditor.setSelection(Pos(1, 0), Pos(4, 10));  // start of blank line to end of block comment

            let expectedText = [
                "function foo()",
                "    ",
                "    a();",
                "    ",
                "    b();",
                "    ",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(4, 8)});

            expectedText = [
                "function foo()",
                "/*    ",
                "    a();",
                "    ",
                "    b();*/",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 2), end: Pos(4, 8)});
        });

        it("should block uncomment, selection covers block comment plus whitespace after", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);

            myEditor.setSelection(Pos(2, 4), Pos(5, 4));  // start of block comment to end of blank line

            let expectedText = [
                "function foo()",
                "    ",
                "    a();",
                "    ",
                "    b();",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 4), end: Pos(5, 4)});

            expectedText = [
                "function foo()",
                "    ",
                "    /*a();",
                "    ",
                "    b();",
                "    */",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 6), end: Pos(5, 4)});
        });

        it("should block uncomment, selection covers part of block comment plus whitespace before", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);

            myEditor.setSelection(Pos(1, 0), Pos(3, 4));  // start of blank line to middle of block comment

            let expectedText = [
                "function foo()",
                "    ",
                "    a();",
                "    ",
                "    b();",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(3, 4)});

            expectedText = [
                "function foo()",
                "/*    ",
                "    a();",
                "    */",
                "    b();",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 2), end: Pos(3, 4)});
        });

        it("should block uncomment, selection covers part of block comment plus whitespace after", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);

            myEditor.setSelection(Pos(3, 4), Pos(5, 4));  // middle of block comment to end of blank line

            let expectedText = [
                "function foo()",
                "    ",
                "    a();",
                "    ",
                "    b();",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(3, 4), end: Pos(5, 4)});

            expectedText = [
                "function foo()",
                "    ",
                "    a();",
                "    /*",
                "    b();",
                "    */",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(3, 6), end: Pos(5, 4)});
        });

        it("should block uncomment, selection covers block comment plus whitespace on both sides", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);

            myEditor.setSelection(Pos(1, 0), Pos(5, 4));  // start of first blank line to end of last blank line

            let expectedText = [
                "function foo()",
                "    ",
                "    a();",
                "    ",
                "    b();",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(5, 4)});

            expectedText = [
                "function foo()",
                "/*    ",
                "    a();",
                "    ",
                "    b();",
                "    */",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 2), end: Pos(5, 4)});
        });

        // Selections mixing uncommented text and existing block comments

        it("should block uncomment, selection covers block comment plus other text", function () {
            // Start with part of line 1 wrapped in a block comment
            const startingContent = [
                "function foo() {",
                "    function /*bar()*/ {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select more of line 1
            myEditor.setSelection(Pos(1, 4), Pos(1, 24));

            testToggleBlock(defaultContent, {start: Pos(1, 4), end: Pos(1, 20)}); // range endpoints still align with same text

            const expectedText = [
                "function foo() {",
                "    /*function bar() {*/",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 6), end: Pos(1, 22)});
        });

        it("should block uncomment, selection covers multi-line block comment plus other text", function () {
            const content = [
                "function foo()",
                "    ",
                "    /*a();",
                "    ",
                "    b();*/",
                "    c();",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(0, 5), Pos(5, 5));  // middle of first line of code to middle of line following comment

            let expectedText = [
                "function foo()",
                "    ",
                "    a();",
                "    ",
                "    b();",
                "    c();",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(0, 5), end: Pos(5, 5)});

            expectedText = [
                "funct/*ion foo()",
                "    ",
                "    a();",
                "    ",
                "    b();",
                "    c*/();",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(0, 7), end: Pos(5, 5)});
        });

        // Selections including multiple separate block comments
        // We no-op in these cases since it's ambiguous - can't nest block comments, but was multiple independent uncomments intended?

        it("should do nothing, selection covers parts of multiple block comments", function () {
            // Start with part of line 1 wrapped in a block comment
            const startingContent = [
                "function foo() {",
                "    /*function*/ /*bar()*/ {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select end of 1st comment, start of 2nd comment, and the space between them
            myEditor.setSelection(Pos(1, 9), Pos(1, 22));

            testToggleBlock(startingContent, {start: Pos(1, 9), end: Pos(1, 22)}); // no change
        });

        it("should do nothing, selection covers all of multiple block comments", function () {
            // Start with part of line 1 wrapped in a block comment
            const startingContent = [
                "function foo() {",
                "    /*function*/ /*bar()*/ {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select both block comments and the space between them, but nothing else
            myEditor.setSelection(Pos(1, 4), Pos(1, 26));

            testToggleBlock(startingContent, {start: Pos(1, 4), end: Pos(1, 26)}); // no change
        });

        it("should do nothing, selection covers multiple block comments & nothing else", function () {
            // Start with part of line 1 wrapped in a block comment
            const startingContent = [
                "function foo() {",
                "    /*function*//*bar()*/ {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select both block comments, but nothing else
            myEditor.setSelection(Pos(1, 4), Pos(1, 25));

            testToggleBlock(startingContent, {start: Pos(1, 4), end: Pos(1, 25)}); // no change
        });

        it("should do nothing, selection covers multiple block comments plus other text", function () {
            // Start with part of line 1 wrapped in a block comment
            const startingContent = [
                "function foo() {",
                "    /*function*/ /*bar()*/ {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            // select all of line 1 (but not newline)
            myEditor.setSelection(Pos(1, 0), Pos(1, 28));

            testToggleBlock(startingContent, {start: Pos(1, 0), end: Pos(1, 28)}); // no change
        });

        describe("with multiple selections", function () {
            it("should comment out multiple selections/cursors, preserving primary/reversed selections", function () {
                const startingContent = [
                    "function foo() {",
                    "    /**/function bar() {",
                    "        ",
                    "    /*    a();*/",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4), primary: true},
                    {start: Pos(3, 4), end: Pos(3, 12), reversed: true},
                ]);
                testToggleBlock(startingContent, [
                    {start: Pos(1, 6), end: Pos(1, 6), primary: true, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 14), primary: false, reversed: true},
                ]);
                testToggleBlock(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: true, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 12), primary: false, reversed: true},
                ]);
            });

            it("should skip the case where a selection covers multiple block comments, but still track it and handle other selections", function () {
                const startingContent = [
                    "function foo() {",
                    "    function bar() {",
                    "        ",
                    "        a();",
                    "    /*a*/ /*()*/ {",
                    "    }",
                    "",
                    "}",
                ].join("\n");
                myEditor.setText(startingContent);

                myEditor.setSelections([
                    {start: Pos(0, 0), end: Pos(1, 0)},
                    {start: Pos(4, 0), end: Pos(4, 18), reversed: true},
                ]);

                const expectedText = [
                    "/*",
                    "function foo() {",
                    "*/",
                    "    function bar() {",
                    "        ",
                    "        a();",
                    "    /*a*/ /*()*/ {",
                    "    }",
                    "",
                    "}",
                ].join("\n");

                testToggleBlock(expectedText, [
                    {start: Pos(1, 0), end: Pos(2, 0), primary: false, reversed: false},
                    {start: Pos(6, 0), end: Pos(6, 18), primary: true, reversed: true},
                ]);
                testToggleBlock(startingContent, [
                    {start: Pos(0, 0), end: Pos(1, 0), primary: false, reversed: false},
                    {start: Pos(4, 0), end: Pos(4, 18), primary: true, reversed: true},
                ]);
            });
        });
    });

    describe("Block comment/uncomment with `padding` option enabled", function () {
        beforeEach(function () {
            setupFullEditor();
            options = { padding: " " };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should block comment with whitespaces", function () {
            const startingContent = [
                "function foo()",
                "    ",
                "    a();",
                "    ",
                "    b();",
                "    ",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);
            myEditor.setCursorPos(2, 4);

            const expectedText = [
                "function foo()",
                "    ",
                "    /*  */a();",
                "    ",
                "    b();",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, Pos(2, 7));

            testToggleBlock(startingContent, Pos(2, 4));
        });

        it("should block comment, selection will covers block comment plus whitespaces", function () {
            const startingContent = [
                "function foo()",
                "    ",
                "    a();",
                "    ",
                "    b();",
                "    ",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);
            myEditor.setSelection(Pos(2, 4), Pos(4, 8));

            const expectedText = [
                "function foo()",
                "    ",
                "    /* a();",
                "    ",
                "    b(); */",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 7), end: Pos(4, 8)});

            testToggleBlock(startingContent, {start: Pos(2, 4), end: Pos(4, 8)});
        });

        const WS_SURROUNDING_BLOCK = [
            "function foo()",
            "    ",
            "    /*a();",
            "    ",
            "    b();*/",
            "    ",
            "}",
        ].join("\n");

        it("should block uncomment, selection will covers block comment plus whitespaces", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);
            myEditor.setSelection(Pos(2, 6), Pos(4, 8));

            let expectedText = [
                "function foo()",
                "    ",
                "    a();",
                "    ",
                "    b();",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 4), end: Pos(4, 8)});

            expectedText = [
                "function foo()",
                "    ",
                "    /* a();",
                "    ",
                "    b(); */",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 7), end: Pos(4, 8)});
        });
    });

    describe("Block comment/uncomment with `indent` and `padding` options enabled", function () {
        beforeEach(function () {
            setupFullEditor("", "htmlmixed");
            options = { indent: true, padding: " " };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should block uncomment, selection will covers block comment plus whitespaces", function () {
            const startingContent = [
                "<html>",
                "    <body></body>",
                "</html>",
            ].join("\n");
            myEditor.setText(startingContent);
            myEditor.setSelection(Pos(1, 4), Pos(1, 17));

            const expectedText = [
                "<html>",
                "    <!-- <body></body> -->",
                "</html>",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 9), end: Pos(1, 22)});

            testToggleBlock(startingContent, {start: Pos(1, 4), end: Pos(1, 17)});
        });
    });


    // If the cursor's/selection's lines contain nothing but line comments and whitespace, we assume the user
    // meant line-uncomment (i.e. delegate to Toggle Line Comment). In all other cases, we ignore the line comment
    // and create a new block comment.
    describe("Block comment around line comments", function () {
        beforeEach(function () {
            setupFullEditor();
        });

        // Selections including existing line comments (and possibly whitespace)

        it("should switch to line uncomment mode, cursor inside line comment (with only whitespace to left)", function () {
            // Start with part of line 1 line-commented
            const startingContent = [
                "function foo() {",
                "    //function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            myEditor.setCursorPos(1, 18);

            testToggleBlock(defaultContent, Pos(1, 16));

            const expectedText = [
                "function foo() {",
                "    function bar/**/() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, Pos(1, 18));
        });

        it("should switch to line uncomment, cursor in whitespace to left of line comment", function () { // #2342
            // Start with part of line 1 line-commented
            const startingContent = [
                "function foo() {",
                "    //function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            myEditor.setCursorPos(1, 0);

            testToggleBlock(defaultContent, Pos(1, 0));

            const expectedText = [
                "function foo() {",
                "/**/    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, Pos(1, 2));
        });

        it("should switch to line uncomment, some of line-comment selected (only whitespace to left)", function () {
            const content = [
                "function foo()",
                "    // Comment",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 6), Pos(1, 13)); // just " Commen"

            let expectedText = [
                "function foo()",
                "     Comment",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 4), end: Pos(1, 11)});

            expectedText = [
                "function foo()",
                "    /* Commen*/t",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 6), end: Pos(1, 13)});
        });

        it("should switch to line uncomment, some of line-comment selected including last char (only whitespace to left)", function () { // #2337
            const content = [
                "function foo()",
                "    // Comment",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 6), Pos(1, 14)); // everything but leading "//"

            let expectedText = [
                "function foo()",
                "     Comment",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 4), end: Pos(1, 12)});

            expectedText = [
                "function foo()",
                "    /* Comment*/",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 6), end: Pos(1, 14)});
        });

        it("should switch to line uncomment, all of line-comment selected (only whitespace to left)", function () { // #2342
            const content = [
                "function foo()",
                "    // Comment",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 4), Pos(1, 14)); // include "//"

            let expectedText = [
                "function foo()",
                "     Comment",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 4), end: Pos(1, 12)});

            expectedText = [
                "function foo()",
                "    /* Comment*/",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 6), end: Pos(1, 14)});
        });

        // Selections that don't mix code & line-comment, but are on a line that does contain both

        it("should insert block comment, cursor inside line comment (with code to left)", function () {
            // Start with comment ending line 1
            const startingContent = [
                "function foo() {",
                "    function bar() { // comment",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            myEditor.setCursorPos(1, 24); // between space and "c"

            const expectedText = [
                "function foo() {",
                "    function bar() { // /**/comment",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, Pos(1, 26));
            // FIXME
            // testToggleBlock(startingContent, Pos(1, 24));
        });

        it("should insert block comment, cursor in code to left of line comment", function () {
            // Start with comment ending line 1
            const startingContent = [
                "function foo() {",
                "    function bar() { // comment",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(startingContent);

            myEditor.setCursorPos(1, 12);

            const expectedText = [
                "function foo() {",
                "    function/**/ bar() { // comment",
                "        ",
                "        a();",
                "        ",
                "    }",
                "",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, Pos(1, 14));
            testToggleBlock(startingContent, Pos(1, 12));
        });

        it("should block comment, some of line-comment selected (with code to left)", function () {
            const content = [
                "function foo()",
                "    f(); // Comment",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 11), Pos(1, 18)); // just " Commen"

            const expectedText = [
                "function foo()",
                "    f(); ///* Commen*/t",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 13), end: Pos(1, 20)});

            // FIXME
            // testToggleBlock(content, {start: Pos(1, 11), end: Pos(1, 18)});
        });

        it("should block comment, some of line-comment selected including last char (with code to left)", function () { // #2337
            const content = [
                "function foo()",
                "    f(); // Comment",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 11), Pos(1, 19)); // everything but leading "//"

            const expectedText = [
                "function foo()",
                "    f(); ///* Comment*/",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 13), end: Pos(1, 21)});

            // FIXME
            // testToggleBlock(content, {start: Pos(1, 11), end: Pos(1, 19)});
        });

        it("should block comment, all of line-comment selected (with code to left)", function () { // #2342
            const content = [
                "function foo()",
                "    f(); // Comment",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 9), Pos(1, 19)); // include "//"

            const expectedText = [
                "function foo()",
                "    f(); /*// Comment*/",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 11), end: Pos(1, 21)});
            testToggleBlock(content, {start: Pos(1, 9), end: Pos(1, 19)});
        });

        // Full-line/multiline selections containing only line comments and whitespace

        it("should switch to line uncomment, all of line-comment line selected (following line is code)", function () {
            const content = [
                "function foo()",
                "    // Comment",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            let expectedText = [
                "function foo()",
                "     Comment",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});

            expectedText = [
                "function foo()",
                "/*",
                "     Comment",
                "*/",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should switch to line uncomment, all of line-comment line selected (following line is whitespace)", function () {
            const content = [
                "function foo()",
                "    // Comment",
                "    ",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            let expectedText = [
                "function foo()",
                "     Comment",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});

            expectedText = [
                "function foo()",
                "/*",
                "     Comment",
                "*/",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should switch to line uncomment, all of line-comment line selected (following line is line comment)", function () {
            const content = [
                "function foo()",
                "    // Comment",
                "    // Comment 2",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            let expectedText = [
                "function foo()",
                "     Comment",
                "    // Comment 2",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});

            expectedText = [
                "function foo()",
                "/*",
                "     Comment",
                "*/",
                "    // Comment 2",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should switch to line uncomment, all of line-comment line selected (following line is block comment)", function () {
            const content = [
                "function foo()",
                "    // Comment",
                "    /* Comment 2 */",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            let expectedText = [
                "function foo()",
                "     Comment",
                "    /* Comment 2 */",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});

            expectedText = [
                "function foo()",
                "/*",
                "     Comment",
                "*/",
                "    /* Comment 2 */",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should line uncomment, multiple line comments selected", function () {
            // Start with all of lines 1-5 line-commented
            const content = [
                "function foo() {",
                "//    function bar() {",
                "//        ",
                "//        a();",
                "//        ",
                "//    }",
                "",
                "}",
            ].join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            testToggleBlock(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});

            const expectedText = [
                "function foo() {",
                "/*",
                "    function bar() {",
                "        ",
                "        a();",
                "        ",
                "    }",
                "*/",
                "",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(7, 0)});
        });

        // Selections mixing uncommented code & line comments

        const lineCommentCode = [
            "function foo() {",
            "    ",
            "    // Floating comment",
            "    ",
            "    // Attached comment",
            "    function bar() {",
            "        a();",
            "        b(); // post comment",
            "    }",
            "    ",
            "    bar();",
            "    // Attached above",
            "    ",
            "    // Final floating comment",
            "    ",
            "}",
        ].join("\n");

        it("should line uncomment, multiline selection covers line comment plus whitespace", function () {
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(1, 0), Pos(3, 4));

            let expectedText = [
                "function foo() {",
                "    ",
                "     Floating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b(); // post comment",
                "    }",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(3, 4)});

            expectedText = [
                "function foo() {",
                "/*    ",
                "     Floating comment",
                "    */",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b(); // post comment",
                "    }",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 2), end: Pos(3, 4)});
        });

        it("should switch to line uncomment mode, selection starts in whitespace & ends in middle of line comment", function () { // #2342
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(2, 2), Pos(2, 10)); // stops with "Flo"

            let expectedText = [
                "function foo() {",
                "    ",
                "     Floating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b(); // post comment",
                "    }",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(2, 2), end: Pos(2, 8)});

            expectedText = [
                "function foo() {",
                "    ",
                "  /*   Flo*/ating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b(); // post comment",
                "    }",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 4), end: Pos(2, 10)});
        });

        it("should switch to line uncomment mode, selection starts in whitespace & ends at end of line comment", function () { // #2337, #2342
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(2, 2), Pos(2, 23));

            let expectedText = [
                "function foo() {",
                "    ",
                "     Floating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b(); // post comment",
                "    }",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 2), end: Pos(2, 21)});

            expectedText = [
                "function foo() {",
                "    ",
                "  /*   Floating comment*/",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b(); // post comment",
                "    }",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 4), end: Pos(2, 23)});
        });

        it("should block comment, selection starts in code & ends in middle of line comment", function () { // #2342
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(7, 8), Pos(7, 20)); // stops at end of "post"

            const expectedText = [
                "function foo() {",
                "    ",
                "    // Floating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        /*b(); // post*/ comment",
                "    }",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(7, 10), end: Pos(7, 22)});
            testToggleBlock(lineCommentCode, {start: Pos(7, 8), end: Pos(7, 20)});
        });

        it("should block comment, selection starts in middle of code & ends at end of line comment", function () { // #2342
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(7, 9), Pos(7, 28));

            const expectedText = [
                "function foo() {",
                "    ",
                "    // Floating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b/*(); // post comment*/",
                "    }",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(7, 11), end: Pos(7, 30)});
            testToggleBlock(lineCommentCode, {start: Pos(7, 9), end: Pos(7, 28)});
        });

        it("should block comment, selection starts in code & ends at end of line comment", function () { // #2337
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(7, 8), Pos(7, 28));

            const expectedText = [
                "function foo() {",
                "    ",
                "    // Floating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        /*b(); // post comment*/",
                "    }",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(7, 10), end: Pos(7, 30)});
            testToggleBlock(lineCommentCode, {start: Pos(7, 8), end: Pos(7, 28)});
        });

        it("should block comment, selection starts at col 0 of code & ends at end of line comment", function () {
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(7, 0), Pos(7, 28));

            const expectedText = [
                "function foo() {",
                "    ",
                "    // Floating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "/*        b(); // post comment*/",
                "    }",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(7, 2), end: Pos(7, 30)});
            testToggleBlock(lineCommentCode, {start: Pos(7, 0), end: Pos(7, 28)});
        });

        it("should block comment, selection starts on line with line comment", function () {
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(4, 0), Pos(9, 0));

            const expectedText = [
                "function foo() {",
                "    ",
                "    // Floating comment",
                "    ",
                "/*",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b(); // post comment",
                "    }",
                "*/",
                "    ",
                "    bar();",
                "    // Attached above",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(5, 0), end: Pos(10, 0)});
            testToggleBlock(lineCommentCode, {start: Pos(4, 0), end: Pos(9, 0)});
        });

        it("should block comment, selection ends on line with line comment", function () {
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(10, 0), Pos(12, 0));

            const expectedText = [
                "function foo() {",
                "    ",
                "    // Floating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b(); // post comment",
                "    }",
                "    ",
                "/*",
                "    bar();",
                "    // Attached above",
                "*/",
                "    ",
                "    // Final floating comment",
                "    ",
                "}",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(11, 0), end: Pos(13, 0)});
            testToggleBlock(lineCommentCode, {start: Pos(10, 0), end: Pos(12, 0)});
        });

        it("should line uncomment, selection covers several line comments separated by whitespace", function () {
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(11, 0), Pos(14, 0));

            let expectedText = [
                "function foo() {",
                "    ",
                "    // Floating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b(); // post comment",
                "    }",
                "    ",
                "    bar();",
                "     Attached above",
                "    ",
                "     Final floating comment",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(11, 0), end: Pos(14, 0)});

            expectedText = [
                "function foo() {",
                "    ",
                "    // Floating comment",
                "    ",
                "    // Attached comment",
                "    function bar() {",
                "        a();",
                "        b(); // post comment",
                "    }",
                "    ",
                "    bar();",
                "/*",
                "     Attached above",
                "    ",
                "     Final floating comment",
                "*/",
                "    ",
                "}",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(12, 0), end: Pos(15, 0)});
        });

        describe("with multiple selections", function () {
            it("should handle multiple selections where one of them is in a line comment", function () {
                // Add a line comment to line 1
                const content = [
                    "function foo() {",
                    "//    function bar() {",
                    "        ",
                    "        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");
                myEditor.setText(content);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4), primary: true},
                    {start: Pos(3, 4), end: Pos(3, 12)},
                ]);

                // Line 1 should no longer have a line comment, and line 3 should have a block comment.
                let expectedText = [
                    "function foo() {",
                    "    function bar() {",
                    "        ",
                    "    /*    a();*/",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");
                testToggleBlock(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: true, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 14), primary: false, reversed: false},
                ]);

                expectedText = [
                    "function foo() {",
                    "  /**/  function bar() {",
                    "        ",
                    "        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");
                testToggleBlock(expectedText, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: true, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 12), primary: false, reversed: false},
                ]);
            });

            it("should handle multiple selections where several of them are in the same line comment, preserving the ignored selections", function () {
                // Add a line comment to line 1
                const content = [
                    "function foo() {",
                    "//    function bar() {",
                    "        ",
                    "        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");
                myEditor.setText(content);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4), primary: true},
                    {start: Pos(1, 6), end: Pos(1, 6)},
                ]);

                // Line 1 should no longer have a line comment
                const expectedText = [
                    "function foo() {",
                    "    function bar() {",
                    "        ",
                    "        a();",
                    "        ",
                    "    }",
                    "",
                    "}",
                ].join("\n");
                testToggleBlock(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: true, reversed: false},
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                ]);

                // FIXME
                // lines = content.split("\n");
                // lines[1] = "  /**/  /**/function bar() {"
                // expectedText = lines.join("\n");
                // testToggleBlock(expectedText, [
                //     {start: Pos(1, 4), end: Pos(1, 4), primary: true, reversed: false},
                //     {start: Pos(1, 10), end: Pos(1, 10), primary: false, reversed: false}
                // ]);
            });
        });
    });

    // In cases where the language only supports block comments, the line comment/uncomment command may perform block comment/uncomment instead
    describe("Line comment auto-switching to block comment", function () {
        const cssContent = [
            "div {",
            "    color: red;",
            "}",
            "",
            "/*span {",
            "    color: blue;",
            "}*/",
        ].join("\n") + "\n";

        beforeEach(function () {
            setupFullEditor(cssContent, "css");
        });

        it("should block-comment entire line that cursor is in", function () {
            myEditor.setCursorPos(1, 4);

            const expectedText = [
                "div {",
                "/*    color: red;*/",
                "}",
                "",
                "/*span {",
                "    color: blue;",
                "}*/",
            ].join("\n") + "\n";

            testToggleLine(expectedText, Pos(1, 6));
            testToggleLine(cssContent, Pos(1, 4));
        });

        it("should block-comment entire line that sub-line selection is in", function () {
            myEditor.setSelection(Pos(1, 4), Pos(1, 9));

            const expectedText = [
                "div {",
                "/*    color: red;*/",
                "}",
                "",
                "/*span {",
                "    color: blue;",
                "}*/",
            ].join("\n") + "\n";

            testToggleLine(expectedText, {start: Pos(1, 6), end: Pos(1, 11)});
            testToggleLine(cssContent, {start: Pos(1, 4), end: Pos(1, 9)});
        });

        it("should block-comment full multi-line selection", function () {
            myEditor.setSelection(Pos(0, 0), Pos(3, 0));

            const expectedText = [
                "/*",
                "div {",
                "    color: red;",
                "}",
                "*/",
                "",
                "/*span {",
                "    color: blue;",
                "}*/",
            ].join("\n") + "\n";

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
            testToggleLine(cssContent, {start: Pos(0, 0), end: Pos(3, 0)});
        });

        it("should block-comment partial multi-line selection as if it were full", function () {
            myEditor.setSelection(Pos(0, 3), Pos(1, 10));

            const expectedText = [
                "/*",
                "div {",
                "    color: red;",
                "*/",
                "}",
                "",
                "/*span {",
                "    color: blue;",
                "}*/",
            ].join("\n") + "\n";

            testToggleLine(expectedText, {start: Pos(1, 3), end: Pos(2, 10)});  // range endpoints still align with same text
            testToggleLine(cssContent, {start: Pos(0, 3), end: Pos(1, 10)});
        });

        it("should uncomment multi-line block comment selection, selected exactly", function () {
            myEditor.setSelection(Pos(4, 0), Pos(6, 3));

            let expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "    color: blue;",
                "}",
            ].join("\n") + "\n";

            testToggleLine(expectedText, {start: Pos(4, 0), end: Pos(6, 1)});

            expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "/*",
                "span {",
                "    color: blue;",
                "}",
                "*/",
            ].join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(5, 0), end: Pos(7, 1)});
        });

        it("should uncomment multi-line block comment selection, selected including trailing newline", function () { // #2339
            myEditor.setSelection(Pos(4, 0), Pos(7, 0));

            let expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "    color: blue;",
                "}",
            ].join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(4, 0), end: Pos(7, 0)});

            expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "/*",
                "span {",
                "    color: blue;",
                "}",
                "*/",
            ].join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(5, 0), end: Pos(8, 0)});
        });

        it("should uncomment multi-line block comment selection, only start selected", function () {
            myEditor.setSelection(Pos(4, 0), Pos(5, 8));

            let expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "    color: blue;",
                "}",
            ].join("\n") + "\n";

            testToggleLine(expectedText, {start: Pos(4, 0), end: Pos(5, 8)});

            expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "/*",
                "span {",
                "    color: blue;",
                "*/",
                "}",
            ].join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(5, 0), end: Pos(6, 8)});
        });

        it("should uncomment multi-line block comment selection, only middle selected", function () {
            myEditor.setSelection(Pos(5, 0), Pos(5, 8));

            let expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "    color: blue;",
                "}",
            ].join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(5, 0), end: Pos(5, 8)});

            expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "/*    color: blue;*/",
                "}",
            ].join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(5, 2), end: Pos(5, 10)});
        });

        it("should uncomment multi-line block comment selection, only end selected", function () { // #2339
            myEditor.setSelection(Pos(5, 8), Pos(6, 3));

            let expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "    color: blue;",
                "}",
            ].join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(5, 8), end: Pos(6, 1)});

            expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "/*",
                "    color: blue;",
                "}",
                "*/",
            ].join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(6, 8), end: Pos(7, 1)});
        });

        it("should uncomment multi-line block comment selection, only end selected, ends at EOF", function () {
            // remove trailing blank line, so end of "*/" is EOF (no newline afterward)
            myEditor._codeMirror.replaceRange("", Pos(6, 3), Pos(7, 0));
            myEditor.setSelection(Pos(5, 8), Pos(6, 3));

            let expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "    color: blue;",
                "}",
            ].join("\n");
            testToggleLine(expectedText, {start: Pos(5, 8), end: Pos(6, 1)});

            expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "/*",
                "    color: blue;",
                "}*/",
            ].join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(6, 8), end: Pos(7, 1)});
        });

        it("should uncomment multi-line block comment that cursor is in", function () {
            myEditor.setCursorPos(5, 4);

            let expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "    color: blue;",
                "}",
            ].join("\n") + "\n";
            testToggleLine(expectedText, Pos(5, 4));

            expectedText = [
                "div {",
                "    color: red;",
                "}",
                "",
                "span {",
                "/*    color: blue;*/",
                "}",
            ].join("\n") + "\n";
            testToggleLine(expectedText, Pos(5, 6));
        });
    });

    describe("Comment/uncomment with mixed syntax modes with `indent` option disabled", function () {
        const htmlContent = [
            "<html>",
            "    <head>",
            "        <style type='text/css'>",
            "            body {",
            "                font-size: 15px;",
            "            }",
            "        </style>",
            "        <script type='text/javascript'>",
            "            function foo() {",
            "                function bar() {",
            "                    a();",
            "                }",
            "            }",
            "        </script>",
            "    </head>",
            "    <body>",
            "        <p>Hello</p>",
            "        <p>World</p>",
            "    </body>",
            "</html>",
        ].join("\n");

        beforeEach(function () {
            setupFullEditor(htmlContent, "htmlmixed");
        });

        afterEach(function () {
        });

        // Correct behavior for line and block comment commands

        it("should block comment/uncomment generic HTML code", function () {
            myEditor.setSelection(Pos(1, 4), Pos(1, 10));

            const expectedText = [
                "<html>",
                "    <!--<head>-->",
                "        <style type='text/css'>",
                "            body {",
                "                font-size: 15px;",
                "            }",
                "        </style>",
                "        <script type='text/javascript'>",
                "            function foo() {",
                "                function bar() {",
                "                    a();",
                "                }",
                "            }",
                "        </script>",
                "    </head>",
                "    <body>",
                "        <p>Hello</p>",
                "        <p>World</p>",
                "    </body>",
                "</html>",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 8), end: Pos(1, 14)});
            testToggleBlock(htmlContent, {start: Pos(1, 4), end: Pos(1, 10)});
        });

        it("should block comment/uncomment generic CSS code", function () {
            myEditor.setSelection(Pos(4, 16), Pos(4, 32));

            const expectedText = [
                "<html>",
                "    <head>",
                "        <style type='text/css'>",
                "            body {",
                "                /*font-size: 15px;*/",
                "            }",
                "        </style>",
                "        <script type='text/javascript'>",
                "            function foo() {",
                "                function bar() {",
                "                    a();",
                "                }",
                "            }",
                "        </script>",
                "    </head>",
                "    <body>",
                "        <p>Hello</p>",
                "        <p>World</p>",
                "    </body>",
                "</html>",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(4, 18), end: Pos(4, 34)});
            testToggleBlock(htmlContent, {start: Pos(4, 16), end: Pos(4, 32)});
        });

        it("should line comment/uncomment generic JS code", function () {
            myEditor.setCursorPos(10, 0);

            const expectedText = [
                "<html>",
                "    <head>",
                "        <style type='text/css'>",
                "            body {",
                "                font-size: 15px;",
                "            }",
                "        </style>",
                "        <script type='text/javascript'>",
                "            function foo() {",
                "                function bar() {",
                "//                    a();",
                "                }",
                "            }",
                "        </script>",
                "    </head>",
                "    <body>",
                "        <p>Hello</p>",
                "        <p>World</p>",
                "    </body>",
                "</html>",
            ].join("\n");

            testToggleLine(expectedText, Pos(10, 2));

            // Uncomment
            testToggleLine(htmlContent, Pos(10, 0));
        });

        it("should block comment/uncomment generic JS code", function () {
            myEditor.setSelection(Pos(8, 0), Pos(13, 0));

            const expectedText = [
                "<html>",
                "    <head>",
                "        <style type='text/css'>",
                "            body {",
                "                font-size: 15px;",
                "            }",
                "        </style>",
                "        <script type='text/javascript'>",
                "/*",
                "            function foo() {",
                "                function bar() {",
                "                    a();",
                "                }",
                "            }",
                "*/",
                "        </script>",
                "    </head>",
                "    <body>",
                "        <p>Hello</p>",
                "        <p>World</p>",
                "    </body>",
                "</html>",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(9, 0), end: Pos(14, 0)});
            testToggleBlock(htmlContent, {start: Pos(8, 0), end: Pos(13, 0)});
        });

        it("should HTML comment/uncomment around outside of <style> block", function () {
            myEditor.setSelection(Pos(2, 0), Pos(7, 0));

            const expectedText = [
                "<html>",
                "    <head>",
                "<!--",
                "        <style type='text/css'>",
                "            body {",
                "                font-size: 15px;",
                "            }",
                "        </style>",
                "-->",
                "        <script type='text/javascript'>",
                "            function foo() {",
                "                function bar() {",
                "                    a();",
                "                }",
                "            }",
                "        </script>",
                "    </head>",
                "    <body>",
                "        <p>Hello</p>",
                "        <p>World</p>",
                "    </body>",
                "</html>",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(3, 0), end: Pos(8, 0)});
            testToggleBlock(htmlContent, {start: Pos(2, 0), end: Pos(7, 0)});
        });

        it("shouldn't comment anything when selection mixes modes", function () {
            myEditor.setSelection(Pos(3, 0), Pos(11, 0));

            testToggleBlock(htmlContent, {start: Pos(3, 0), end: Pos(11, 0)});
        });

        describe("with multiple selections", function () {

            beforeEach(function () {
            });

            afterEach(function () {
            });

            it("should handle multiple selections in different regions, toggling block selection in each", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 10)},
                    {start: Pos(4, 16), end: Pos(4, 32)},
                    {start: Pos(8, 0), end: Pos(13, 0)},
                ]);

                const expectedText = [
                    "<html>",
                    "    <!--<head>-->",
                    "        <style type='text/css'>",
                    "            body {",
                    "                /*font-size: 15px;*/",
                    "            }",
                    "        </style>",
                    "        <script type='text/javascript'>",
                    "/*",
                    "            function foo() {",
                    "                function bar() {",
                    "                    a();",
                    "                }",
                    "            }",
                    "*/",
                    "        </script>",
                    "    </head>",
                    "    <body>",
                    "        <p>Hello</p>",
                    "        <p>World</p>",
                    "    </body>",
                    "</html>",
                ].join("\n");

                testToggleBlock(expectedText, [
                    {start: Pos(1, 8), end: Pos(1, 14), primary: false, reversed: false},
                    {start: Pos(4, 18), end: Pos(4, 34), primary: false, reversed: false},
                    {start: Pos(9, 0), end: Pos(14, 0), primary: true, reversed: false},
                ]);
                testToggleBlock(htmlContent, [
                    {start: Pos(1, 4), end: Pos(1, 10), primary: false, reversed: false},
                    {start: Pos(4, 16), end: Pos(4, 32), primary: false, reversed: false},
                    {start: Pos(8, 0), end: Pos(13, 0), primary: true, reversed: false},
                ]);
            });

            it("should handle multiple selections in different regions, toggling line selection (but falling back to block selection in HTML/CSS)", function () {

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 10)},
                    {start: Pos(4, 16), end: Pos(4, 32)},
                    {start: Pos(10, 0), end: Pos(10, 0)},
                ]);

                const expectedText = [
                    "<html>",
                    "<!--    <head>-->",
                    "        <style type='text/css'>",
                    "            body {",
                    "/*                font-size: 15px;*/",
                    "            }",
                    "        </style>",
                    "        <script type='text/javascript'>",
                    "            function foo() {",
                    "                function bar() {",
                    "//                    a();",
                    "                }",
                    "            }",
                    "        </script>",
                    "    </head>",
                    "    <body>",
                    "        <p>Hello</p>",
                    "        <p>World</p>",
                    "    </body>",
                    "</html>",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 8), end: Pos(1, 14), primary: false, reversed: false},
                    {start: Pos(4, 18), end: Pos(4, 34), primary: false, reversed: false},
                    {start: Pos(10, 2), end: Pos(10, 2), primary: true, reversed: false},
                ]);
                testToggleLine(htmlContent, [
                    {start: Pos(1, 4), end: Pos(1, 10), primary: false, reversed: false},
                    {start: Pos(4, 16), end: Pos(4, 32), primary: false, reversed: false},
                    {start: Pos(10, 0), end: Pos(10, 0), primary: true, reversed: false},
                ]);
            });

            it("shouldn't comment anything in a mixed-mode selection, but should track it properly and comment the other selections", function () {
                // Select the whole HTML tag so it will actually insert a line, causing other selections to get fixed up.
                myEditor.setSelections([
                    {start: Pos(1, 0), end: Pos(2, 0)},
                    {start: Pos(5, 0), end: Pos(7, 0), reversed: true, primary: true},
                    {start: Pos(8, 0), end: Pos(13, 0)},
                ]);

                const expectedText = [
                    "<html>",
                    "<!--",
                    "    <head>",
                    "-->",
                    "        <style type='text/css'>",
                    "            body {",
                    "                font-size: 15px;",
                    "            }",
                    "        </style>",
                    "        <script type='text/javascript'>",
                    "/*",
                    "            function foo() {",
                    "                function bar() {",
                    "                    a();",
                    "                }",
                    "            }",
                    "*/",
                    "        </script>",
                    "    </head>",
                    "    <body>",
                    "        <p>Hello</p>",
                    "        <p>World</p>",
                    "    </body>",
                    "</html>",
                ].join("\n");

                testToggleBlock(expectedText, [
                    {start: Pos(2, 0), end: Pos(3, 0), primary: false, reversed: false},
                    {start: Pos(7, 0), end: Pos(9, 0), primary: true, reversed: true},
                    {start: Pos(11, 0), end: Pos(16, 0), primary: false, reversed: false},
                ]);
                testToggleBlock(htmlContent, [
                    {start: Pos(1, 0), end: Pos(2, 0), primary: false, reversed: false},
                    {start: Pos(5, 0), end: Pos(7, 0), primary: true, reversed: true},
                    {start: Pos(8, 0), end: Pos(13, 0), primary: false, reversed: false},
                ]);
            });
        });

    });

    describe("Comment/uncomment with mixed syntax modes with `indent` option enabled", function () {
        const htmlContent = [
            "<html>",
            "    <head>",
            "        <style type='text/css'>",
            "            body {",
            "                font-size: 15px;",
            "            }",
            "        </style>",
            "        <script type='text/javascript'>",
            "            function foo() {",
            "                function bar() {",
            "                    a();",
            "                }",
            "            }",
            "        </script>",
            "    </head>",
            "    <body>",
            "        <p>Hello</p>",
            "        <p>World</p>",
            "    </body>",
            "</html>",
        ].join("\n");

        beforeEach(function () {
            setupFullEditor(htmlContent, "htmlmixed");
            options = { indent: true };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should line comment/uncomment generic JS code", function () {
            myEditor.setCursorPos(10, 0);

            const expectedText = [
                "<html>",
                "    <head>",
                "        <style type='text/css'>",
                "            body {",
                "                font-size: 15px;",
                "            }",
                "        </style>",
                "        <script type='text/javascript'>",
                "            function foo() {",
                "                function bar() {",
                "                    //a();",
                "                }",
                "            }",
                "        </script>",
                "    </head>",
                "    <body>",
                "        <p>Hello</p>",
                "        <p>World</p>",
                "    </body>",
                "</html>",
            ].join("\n");
            testToggleLine(expectedText, Pos(10, 0));

            // Uncomment
            testToggleLine(htmlContent, Pos(10, 0));
        });

        it("should line comment/uncomment and indent HTML code", function () {
            myEditor.setCursorPos(16, 8);

            const expectedText = [
                "<html>",
                "    <head>",
                "        <style type='text/css'>",
                "            body {",
                "                font-size: 15px;",
                "            }",
                "        </style>",
                "        <script type='text/javascript'>",
                "            function foo() {",
                "                function bar() {",
                "                    a();",
                "                }",
                "            }",
                "        </script>",
                "    </head>",
                "    <body>",
                "        <!--<p>Hello</p>-->",
                "        <p>World</p>",
                "    </body>",
                "</html>",
            ].join("\n");
            testToggleLine(expectedText, Pos(16, 12));

            // Uncomment
            testToggleLine(htmlContent, Pos(16, 8));
        });

        describe("with multiple selections", function () {
            beforeEach(function () {
                options = { indent: true };
            });

            afterEach(function () {
                options = noOptions;
            });

            it("should handle multiple selections in different regions, toggling line selection (but falling back to block selection in HTML/CSS)", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 10)},
                    {start: Pos(4, 16), end: Pos(4, 32)},
                    {start: Pos(10, 0), end: Pos(10, 0)},
                ]);

                const expectedText = [
                    "<html>",
                    "    <!--<head>-->",
                    "        <style type='text/css'>",
                    "            body {",
                    "                /*font-size: 15px;*/",
                    "            }",
                    "        </style>",
                    "        <script type='text/javascript'>",
                    "            function foo() {",
                    "                function bar() {",
                    "                    //a();",
                    "                }",
                    "            }",
                    "        </script>",
                    "    </head>",
                    "    <body>",
                    "        <p>Hello</p>",
                    "        <p>World</p>",
                    "    </body>",
                    "</html>",
                ].join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 8), end: Pos(1, 14), reversed: false, primary: false},
                    {start: Pos(4, 18), end: Pos(4, 34), reversed: false, primary: false},
                    {start: Pos(10, 0), end: Pos(10, 0), reversed: false, primary: true},
                ]);
                testToggleLine(htmlContent, [
                    {start: Pos(1, 4), end: Pos(1, 10), reversed: false, primary: false},
                    {start: Pos(4, 16), end: Pos(4, 32), reversed: false, primary: false},
                    {start: Pos(10, 0), end: Pos(10, 0), reversed: false, primary: true},
                ]);
            });
        });
    });

    describe("Comment/uncomment on languages with equal prefix and suffix and a line prefix being prefix of a block prefix/suffix", function () {
        // Extend CoffeeScript language for testing purposes
        CodeMirror.extendMode("coffeescript", {
            "blockCommentStart": "###",
            "blockCommentEnd": "###",
            "lineComment": "#",
        });

        const coffeeContent = [
            "foo = 42",
            "bar = true",
            "baz = \"hello\"",
            "number = -42",
            "if bar square = (x) -> x * x",
        ].join("\n");

        beforeEach(function () {
            setupFullEditor(coffeeContent, "coffeescript");
        });

        it("should block comment/uncomment selecting part of lines", function () {
            myEditor.setSelection(Pos(2, 2), Pos(3, 5));

            const expectedText = [
                "foo = 42",
                "bar = true",
                "ba###z = \"hello\"",
                "numbe###r = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(2, 5), end: Pos(3, 5)});
            testToggleBlock(coffeeContent, {start: Pos(2, 2), end: Pos(3, 5)});
        });

        it("should block comment/uncomment selecting full lines", function () {
            myEditor.setSelection(Pos(1, 0), Pos(3, 0));

            const expectedText = [
                "foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");

            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(4, 0)});
            testToggleBlock(coffeeContent, {start: Pos(1, 0), end: Pos(3, 0)});
        });

        it("should block uncomment when selecting the prefix and suffix", function () {
            const expectedText = [
                "foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            myEditor.setText(expectedText);
            myEditor.setSelection(Pos(1, 0), Pos(5, 0));

            testToggleBlock(coffeeContent, {start: Pos(1, 0), end: Pos(3, 0)});
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(4, 0)});
        });

        it("should block uncomment when selecting only the prefix", function () {
            let expectedText = [
                "foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            myEditor.setText(expectedText);
            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            testToggleBlock(coffeeContent, {start: Pos(1, 0), end: Pos(1, 0)});

            expectedText = [
                "foo = 42",
                "######bar = true",
                "baz = \"hello\"",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 3), end: Pos(1, 3)});
        });

        it("should block uncomment when selecting only the suffix", function () {
            let expectedText = [
                "foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            myEditor.setText(expectedText);
            myEditor.setSelection(Pos(4, 0), Pos(5, 0));

            testToggleBlock(coffeeContent, {start: Pos(3, 0), end: Pos(3, 0)});

            expectedText = [
                "foo = 42",
                "bar = true",
                "baz = \"hello\"",
                "######number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(3, 3), end: Pos(3, 3)});
        });

        it("should do nothing when selecting from a suffix to a prefix", function () {
            const expectedText = [
                "###",
                "foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "number = -42",
                "###",
                "if bar square = (x) -> x * x",
                "###",
            ].join("\n");
            myEditor.setText(expectedText);
            myEditor.setSelection(Pos(2, 0), Pos(7, 0));

            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(7, 0)});
        });

        it("should block uncomment with line comments around the block comment", function () {
            const content = [
                "#foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "#number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            myEditor.setText(content);
            myEditor.setSelection(Pos(1, 0), Pos(3, 0));

            let expectedText = [
                "#foo = 42",
                "bar = true",
                "baz = \"hello\"",
                "#number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});

            expectedText = [
                "#foo = 42",
                "###",
                "bar = true",
                "###",
                "baz = \"hello\"",
                "#number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should block uncomment when the lines inside the block comment are line commented", function () {
            const content = [
                "foo = 42",
                "###",
                "bar = true",
                "#baz = \"hello\"",
                "###",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            myEditor.setText(content);
            myEditor.setSelection(Pos(3, 0), Pos(4, 0));

            const expectedText = [
                "foo = 42",
                "bar = true",
                "#baz = \"hello\"",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
            testToggleBlock(coffeeContent, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should block uncomment a second block comment", function () {
            const content = [
                "###",
                "foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "number = -42",
                "###",
                "if bar square = (x) -> x * x",
                "###",
            ].join("\n");
            myEditor.setText(content);
            myEditor.setSelection(Pos(7, 0), Pos(8, 0));

            const expectedText = [
                "###",
                "foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText + "\n", {start: Pos(6, 0), end: Pos(7, 0)});
            testToggleBlock(content + "\n", {start: Pos(7, 0), end: Pos(8, 0)});
        });

        it("should block uncomment with line comments in between the block comments", function () {
            const content = [
                "###",
                "foo = 42",
                "###",
                "#bar = true",
                "#baz = \"hello\"",
                "#number = -42",
                "###",
                "if bar square = (x) -> x * x",
                "###",
            ].join("\n");
            myEditor.setText(content);
            myEditor.setSelection(Pos(7, 0), Pos(8, 0));

            const expectedText = [
                "###",
                "foo = 42",
                "###",
                "#bar = true",
                "#baz = \"hello\"",
                "#number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText + "\n", {start: Pos(6, 0), end: Pos(7, 0)});
            testToggleBlock(content + "\n", {start: Pos(7, 0), end: Pos(8, 0)});
        });

        it("should block comment on an empty line around comments", function () {
            const text = [
                "foo = 42",
                "bar = true",
                "###baz = \"hello\"###",
                "",
                "#number = -42",
            ].join("\n");

            myEditor.setText(text);
            myEditor.setCursorPos(3, 0);

            const expectedText = [
                "foo = 42",
                "bar = true",
                "###baz = \"hello\"###",
                "######",
                "#number = -42",
            ].join("\n");

            testToggleBlock(expectedText, Pos(3, 3));
            testToggleBlock(text, Pos(3, 0));
        });

        it("should block uncomment on an empty line inside a block comment", function () {
            const text = [
                "foo = 42",
                "###bar = true",
                "",
                "number = -42###",
                "if bar square = (x) -> x * x",
            ].join("\n");

            myEditor.setText(text);
            myEditor.setCursorPos(2, 0);

            let expectedText = [
                "foo = 42",
                "bar = true",
                "",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText, Pos(2, 0));

            expectedText = [
                "foo = 42",
                "bar = true",
                "######",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText, Pos(2, 3));
        });

        it("should line uncomment on line comments around a block comment", function () {
            const text = [
                "foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "#number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            myEditor.setText(text);
            myEditor.setSelection(Pos(5, 0), Pos(6, 0));

            let expectedText = [
                "foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(5, 0), end: Pos(6, 0)});

            expectedText = [
                "foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "###",
                "number = -42",
                "###",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleBlock(expectedText, {start: Pos(6, 0), end: Pos(7, 0)});
        });

        it("should line comment block commented lines", function () {
            const text = [
                "foo = 42",
                "bar = true",
                "###baz = \"hello\"###",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            myEditor.setText(text);
            myEditor.setSelection(Pos(2, 0), Pos(2, 5));

            let expectedText = [
                "foo = 42",
                "bar = true",
                "####baz = \"hello\"###",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleLine(expectedText, {start: Pos(2, 0), end: Pos(2, 6)});

            expectedText = [
                "foo = 42",
                "bar = true",
                "#####baz = \"hello\"###",
                "number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleLine(expectedText, {start: Pos(2, 0), end: Pos(2, 7)});
        });

        it("should line comment in block comment prefix or sufix starting lines (1)", function () {
            const text = [
                "#foo = 42",
                "###",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "#number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            myEditor.setText(text);

            let expectedText = [
                "##foo = 42",
                "####",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "#number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            myEditor.setSelection(Pos(0, 0), Pos(2, 0));
            testToggleLine(expectedText, {start: Pos(0, 0), end: Pos(2, 0)});

            expectedText = [
                "###foo = 42",
                "#####",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "#number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleLine(expectedText, {start: Pos(0, 0), end: Pos(2, 0)});
        });

        it("should line comment in block comment prefix or sufix starting lines (2)", function () {
            const content = [
                "##foo = 42",
                "####",
                "bar = true",
                "baz = \"hello\"",
                "###",
                "#number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");

            myEditor.setText(content);
            myEditor.setSelection(Pos(4, 0), Pos(6, 0));

            let expectedText = [
                "##foo = 42",
                "####",
                "bar = true",
                "baz = \"hello\"",
                "####",
                "##number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleLine(expectedText, {start: Pos(4, 0), end: Pos(6, 0)});

            expectedText = [
                "##foo = 42",
                "####",
                "bar = true",
                "baz = \"hello\"",
                "#####",
                "###number = -42",
                "if bar square = (x) -> x * x",
            ].join("\n");
            testToggleLine(expectedText, {start: Pos(4, 0), end: Pos(6, 0)});
        });
    });

});
