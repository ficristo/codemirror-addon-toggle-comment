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

    var defaultContent = "function foo() {\n" +
                         "    function bar() {\n" +
                         "        \n" +
                         "        a();\n" +
                         "        \n" +
                         "    }\n" +
                         "\n" +
                         "}";

    let myEditor;
    const noOptions = undefined;
    let options = noOptions;

    function setupFullEditor(content?, languageId?) {
        content = content || defaultContent;
        languageId = languageId || "javascript";

        const container = document.createElement("div");
        const codeMirror = CodeMirror(container);

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
        var selection = myEditor.getSelection();
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
        var command = (type === "block" ? "blockComment" : "lineComment");

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
            options = { indent: true };
        });

        afterEach(function () {
            options = noOptions;
        });


        it("should comment/uncomment a single line, cursor at start", function () {

            myEditor.setCursorPos(3, 0);

            var lines = defaultContent.split("\n");
            lines[3] = "        //a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(3, 0));
            testToggleLine(defaultContent, Pos(3, 0));
        });

        it("should comment/uncomment a single line, cursor at end", function () {

            myEditor.setCursorPos(3, 12);

            var lines = defaultContent.split("\n");
            lines[3] = "        //a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(3, 14));
            testToggleLine(defaultContent, Pos(3, 12));
        });

        it("should comment/uncomment first line in file", function () {

            myEditor.setCursorPos(0, 0);

            var lines = defaultContent.split("\n");
            lines[0] = "//function foo() {";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(0, 2));
            testToggleLine(defaultContent, Pos(0, 0));
        });

        it("should comment/uncomment a single partly-selected line", function () {

            // select "function" on line 1
            myEditor.setSelection(Pos(1, 4), Pos(1, 12));

            var lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 6), end: Pos(1, 14)});
            testToggleLine(defaultContent, {start: Pos(1, 4), end: Pos(1, 12)});
        });

        it("should comment/uncomment a single selected line", function () {

            // selection covers all of line's text, but not \n at end
            myEditor.setSelection(Pos(1, 0), Pos(1, 20));

            var lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(1, 22)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(1, 20)});
        });

        it("should comment/uncomment a single fully-selected line (including LF)", function () {


            // selection including \n at end of line
            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            var lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(2, 0)});
        });

        it("should comment/uncomment multiple selected lines", function () {
            // selection including \n at end of line
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            var lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            lines[2] = "    //    ";
            lines[3] = "    //    a();";
            lines[4] = "    //    ";
            lines[5] = "    //}";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should comment/uncomment ragged multi-line selection", function () {

            myEditor.setSelection(Pos(1, 6), Pos(3, 9));

            var lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            lines[2] = "    //    ";
            lines[3] = "    //    a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 8), end: Pos(3, 11)}, "nction bar() {\n    //    \n    //    a");
            testToggleLine(defaultContent, {start: Pos(1, 6), end: Pos(3, 9)});
        });

        it("should comment/uncomment when selection starts & ends on whitespace lines", function () {

            myEditor.setSelection(Pos(2, 0), Pos(4, 8));

            var lines = defaultContent.split("\n");
            lines[2] = "        //";
            lines[3] = "        //a();";
            lines[4] = "        //";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(2, 0), end: Pos(4, 10)});
            testToggleLine(defaultContent, {start: Pos(2, 0), end: Pos(4, 8)});
        });

        it("should do nothing on whitespace line", function () {
            myEditor.setCursorPos(2, 8);

            testToggleLine(defaultContent, Pos(2, 8));
            testToggleLine(defaultContent, Pos(2, 8));
        });

        it("should do nothing when only whitespace lines selected", function () {
            // Start with line 2 duplicated twice (3 copies total)
            var lines = defaultContent.split("\n");
            lines.splice(2, 0, lines[2], lines[2]);
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            myEditor.setSelection(Pos(2, 4), Pos(4, 4));

            testToggleLine(startingContent, {start: Pos(2, 4), end: Pos(4, 4)});
        });

        it("should comment/uncomment after select all", function () {

            myEditor.setSelection(Pos(0, 0), Pos(7, 1));

            var expectedText = "//function foo() {\n" +
                "//    function bar() {\n" +
                "//        \n" +
                "//        a();\n" +
                "//        \n" +
                "//    }\n" +
                "//\n" +
                "//}";

            testToggleLine(expectedText, {start: Pos(0, 0), end: Pos(7, 3)});
            testToggleLine(defaultContent, {start: Pos(0, 0), end: Pos(7, 1)});
        });

        it("should comment/uncomment lines that were partially commented out already, our style", function () {

            // Start with line 3 commented out, with "//" at column 0
            var lines = defaultContent.split("\n");
            lines[3] = "//        a();";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select lines 1-3
            myEditor.setSelection(Pos(1, 0), Pos(4, 0));

            lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            lines[2] = "    //    ";
            lines[3] = "////        a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
            testToggleLine(startingContent, {start: Pos(1, 0), end: Pos(4, 0)});
        });

        it("should comment/uncomment lines that were partially commented out already, comment closer to code", function () {

            // Start with line 3 commented out, with "//" snug against the code
            var lines = defaultContent.split("\n");
            lines[3] = "        //a();";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select lines 1-3
            myEditor.setSelection(Pos(1, 0), Pos(4, 0));

            lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            lines[2] = "    //    ";
            lines[3] = "    //    //a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
            testToggleLine(startingContent, {start: Pos(1, 0), end: Pos(4, 0)});
        });

        it("should uncomment indented, aligned comments", function () {
            // Start with lines 1-5 commented out, with "//" all aligned at column 4
            var lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            lines[2] = "    //    ";
            lines[3] = "    //    a();";
            lines[4] = "    //    ";
            lines[5] = "    //}";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select lines 1-5
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});
            testToggleLine(startingContent, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should uncomment ragged partial comments with empty lines in-between", function () {
            // Start with lines 1-5 commented out, with "//" snug up against each non-blank line's code
            var lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            lines[2] = "";
            lines[3] = "        //a();";
            lines[4] = "";
            lines[5] = "    //}";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select lines 1-5
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            lines = defaultContent.split("\n");
            lines[2] = "";
            lines[4] = "";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});

            lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            lines[2] = "    //";
            lines[3] = "    //    a();";
            lines[4] = "    //";
            lines[5] = "    //}";
            expectedText = lines.join("\n");
            // FIXME
            // testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should uncomment ragged partial comments", function () {
            // Start with lines 1-5 commented out, with "//" snug up against each non-blank line's code
            var lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            lines[2] = "        ";
            lines[3] = "        //a();";
            lines[4] = "        ";
            lines[5] = "    //}";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select lines 1-5
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});

            lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            lines[2] = "    //    ";
            lines[3] = "    //    a();";
            lines[4] = "    //    ";
            lines[5] = "    //}";
            var expectedText = lines.join("\n");
            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        describe("with multiple selections", function () {
            it("should toggle comments on separate lines with cursor selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)}
                ]);

                var lines = defaultContent.split("\n");
                lines[1] = "    //function bar() {";
                lines[3] = "        //a();";
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(1, 6), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), reversed: false, primary: true}
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), reversed: false, primary: true}
                ]);
            });

            it("should toggle comments on separate lines with range selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 6)},
                    {start: Pos(3, 4), end: Pos(3, 6)}
                ]);

                var lines = defaultContent.split("\n");
                lines[1] = "    //function bar() {";
                lines[3] = "        //a();";
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    { start: Pos(1, 6), end: Pos(1, 8), reversed: false, primary: false },
                    { start: Pos(3, 4), end: Pos(3, 6), reversed: false, primary: true }
                ]);
                testToggleLine(defaultContent, [
                    { start: Pos(1, 4), end: Pos(1, 6), reversed: false, primary: false },
                    { start: Pos(3, 4), end: Pos(3, 6), reversed: false, primary: true }
                ]);
            });

            it("should toggle comments on separate lines with multiline selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(2, 6)},
                    {start: Pos(3, 4), end: Pos(4, 6)}
                ]);

                var lines = defaultContent.split("\n");
                lines[1] = "    //function bar() {";
                lines[2] = "    //    ";
                lines[3] = "        //a();";
                lines[4] = "        //";
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(2, 8), reversed: false, primary: false},
                    {start: Pos(3, 4), end: Pos(4, 6), reversed: false, primary: true}
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(2, 6), reversed: false, primary: false},
                    {start: Pos(3, 4), end: Pos(4, 6), reversed: false, primary: true}
                ]);
            });

            it("should adjust selections appropriately at start of line", function () {
                myEditor.setSelections([
                    {start: Pos(1, 0), end: Pos(1, 0)},
                    {start: Pos(3, 0), end: Pos(3, 6)}
                ]);

                var lines = defaultContent.split("\n");
                lines[1] = "    //function bar() {";
                lines[3] = "        //a();";

                // FIXME
                // var expectedText = lines.join("\n");
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
                    {start: Pos(3, 6), end: Pos(3, 8), reversed: true}
                ]);

                var lines = defaultContent.split("\n");
                lines[1] = "    //function bar() {";
                lines[2] = "    //    ";
                lines[3] = "        //a();";


                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(1, 6), reversed: false, primary: false},
                    {start: Pos(1, 8), end: Pos(2, 6), reversed: false, primary: true},
                    {start: Pos(3, 4), end: Pos(3, 4), reversed: false, primary: false},
                    {start: Pos(3, 6), end: Pos(3, 10), reversed: true, primary: false}
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), reversed: false, primary: false},
                    {start: Pos(1, 6), end: Pos(2, 4), reversed: false, primary: true},
                    {start: Pos(3, 4), end: Pos(3, 4), reversed: false, primary: false},
                    {start: Pos(3, 6), end: Pos(3, 8), reversed: true, primary: false}
                ]);
            });

            it("should properly toggle when some selections are already commented but others aren't", function () {
                var lines = defaultContent.split("\n");
                lines[1] = "    //function bar() {";
                lines[3] = "    a();";
                lines[5] = "    //}";
                var startingContent = lines.join("\n");
                myEditor.setText(startingContent);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                    {start: Pos(5, 4), end: Pos(5, 4)}
                ]);

                lines[1] = "    function bar() {";
                lines[3] = "    //a();";
                lines[5] = "    }";
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    { start : Pos(1, 4), end : Pos(1, 4), reversed : false, primary : false },
                    { start : Pos(3, 6), end : Pos(3, 6), reversed : false, primary : false },
                    { start : Pos(5, 4), end : Pos(5, 4), reversed : false, primary : true }
                ]);
                testToggleLine(startingContent, [
                    { start : Pos(1, 6), end : Pos(1, 6), reversed : false, primary : false },
                    { start : Pos(3, 4), end : Pos(3, 4), reversed : false, primary : false },
                    { start : Pos(5, 6), end : Pos(5, 6), reversed : false, primary : true }
                ]);
            });

            it("should properly toggle adjacent lines (not coalescing them) if there are cursors on each line", function () {
                var lines = defaultContent.split("\n");
                lines[1] = "//" + lines[1];
                lines[2] = "    foo();"; // make this line non-blank so it will get commented
                lines[3] = "//" + lines[3];
                var startingContent = lines.join("\n");
                myEditor.setText(startingContent);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(2, 4), end: Pos(2, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)}
                ]);

                lines[1] = lines[1].slice(2);
                lines[2] = "    //foo();";
                lines[3] = lines[3].slice(2);
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: false, reversed: false},
                    {start: Pos(2, 6), end: Pos(2, 6), primary: false, reversed: false},
                    {start: Pos(3, 2), end: Pos(3, 2), primary: true, reversed: false}
                ]);

                lines = startingContent.split("\n");
                lines[1] = "    //function bar() {";
                lines[3] = "        //a();";
                expectedText = lines.join("\n");
                testToggleLine(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: false, reversed: false},
                    {start: Pos(2, 4), end: Pos(2, 4), primary: false, reversed: false},
                    {start: Pos(3, 2), end: Pos(3, 2), primary: true, reversed: false}
                ]);
            });
        });
    });

    describe("Line comment/uncomment with `indent` option disabled", function () {
        beforeEach(function () {
            setupFullEditor();
        });

        afterEach(function () {
        });

        it("should comment/uncomment a single line, cursor at start", function () {
            myEditor.setCursorPos(3, 0);

            var lines = defaultContent.split("\n");
            lines[3] = "//        a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(3, 2));
            testToggleLine(defaultContent, Pos(3, 0));
        });

        it("should comment/uncomment a single line, cursor at end", function () {
            myEditor.setCursorPos(3, 12);

            var lines = defaultContent.split("\n");
            lines[3] = "//        a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(3, 14));
            testToggleLine(defaultContent, Pos(3, 12));
        });

        it("should comment/uncomment first line in file", function () {
            myEditor.setCursorPos(0, 0);

            var lines = defaultContent.split("\n");
            lines[0] = "//function foo() {";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(0, 2));
            testToggleLine(defaultContent, Pos(0, 0));
        });

        it("should comment/uncomment a single partly-selected line", function () {
            // select "function" on line 1
            myEditor.setSelection(Pos(1, 4), Pos(1, 12));

            var lines = defaultContent.split("\n");
            lines[1] = "//    function bar() {";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 6), end: Pos(1, 14)});
            testToggleLine(defaultContent, {start: Pos(1, 4), end: Pos(1, 12)});
        });

        it("should comment/uncomment a single selected line", function () {
            // selection covers all of line's text, but not \n at end
            myEditor.setSelection(Pos(1, 0), Pos(1, 20));

            var lines = defaultContent.split("\n");
            lines[1] = "//    function bar() {";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(1, 22)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(1, 20)});
        });

        it("should comment/uncomment a single fully-selected line (including LF)", function () {
            // selection including \n at end of line
            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            var lines = defaultContent.split("\n");
            lines[1] = "//    function bar() {";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(2, 0)});
        });

        it("should comment/uncomment multiple selected lines", function () {
            // selection including \n at end of line
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            var lines = defaultContent.split("\n");
            lines[1] = "//    function bar() {";
            lines[2] = "//        ";
            lines[3] = "//        a();";
            lines[4] = "//        ";
            lines[5] = "//    }";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});
            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should comment/uncomment ragged multi-line selection", function () {
            myEditor.setSelection(Pos(1, 6), Pos(3, 9));

            var lines = defaultContent.split("\n");
            lines[1] = "//    function bar() {";
            lines[2] = "//        ";
            lines[3] = "//        a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 8), end: Pos(3, 11)}, "nction bar() {\n//        \n//        a");
            testToggleLine(defaultContent, {start: Pos(1, 6), end: Pos(3, 9)}, "nction bar() {\n        \n        a");
        });

        it("should comment/uncomment when selection starts & ends on whitespace lines", function () {
            myEditor.setSelection(Pos(2, 0), Pos(4, 8));

            var lines = defaultContent.split("\n");
            lines[2] = "//        ";
            lines[3] = "//        a();";
            lines[4] = "//        ";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(2, 0), end: Pos(4, 10)});
            testToggleLine(defaultContent, {start: Pos(2, 0), end: Pos(4, 8)});
        });

        it("should comment/uncomment lines that were partially commented out already, our style", function () {
            // Start with line 3 commented out, with "//" at column 0
            var lines = defaultContent.split("\n");
            lines[3] = "//        a();";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select lines 1-3
            myEditor.setSelection(Pos(1, 0), Pos(4, 0));

            lines = defaultContent.split("\n");
            lines[1] = "//    function bar() {";
            lines[2] = "//        ";
            lines[3] = "////        a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
            testToggleLine(startingContent, {start: Pos(1, 0), end: Pos(4, 0)});
        });

        it("should comment/uncomment lines that were partially commented out already, comment closer to code", function () {
            // Start with line 3 commented out, with "//" snug against the code
            var lines = defaultContent.split("\n");
            lines[3] = "        //a();";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select lines 1-3
            myEditor.setSelection(Pos(1, 0), Pos(4, 0));

            lines = defaultContent.split("\n");
            lines[1] = "//    function bar() {";
            lines[2] = "//        ";
            lines[3] = "//        //a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
            testToggleLine(startingContent, {start: Pos(1, 0), end: Pos(4, 0)});
        });

        describe("with multiple selections", function () {

            it("should toggle comments on separate lines with cursor selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)}
                ]);

                var lines = defaultContent.split("\n");
                lines[1] = "//    function bar() {";
                lines[3] = "//        a();";
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(1, 6), primary: false, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 6), primary: true, reversed: false}
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), primary: true, reversed: false}
                ]);
            });

            it("should toggle comments on separate lines with range selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 6)},
                    {start: Pos(3, 4), end: Pos(3, 6)}
                ]);

                var lines = defaultContent.split("\n");
                lines[1] = "//    function bar() {";
                lines[3] = "//        a();";
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(1, 8), primary: false, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 8), primary: true, reversed: false}
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 6), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 6), primary: true, reversed: false}
                ]);
            });

            it("should toggle comments on separate lines with multiline selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(2, 6)},
                    {start: Pos(3, 4), end: Pos(4, 6)}
                ]);

                var lines = defaultContent.split("\n"), i;
                for (i = 1; i <= 4; i++) {
                    lines[i] = "//" + lines[i];
                }
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(2, 8), primary: false, reversed: false},
                    {start: Pos(3, 6), end: Pos(4, 8), primary: true, reversed: false}
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(2, 6), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(4, 6), primary: true, reversed: false}
                ]);
            });

            it("should adjust selections appropriately at start of line", function () {
                myEditor.setSelections([
                    {start: Pos(1, 0), end: Pos(1, 0)},
                    {start: Pos(3, 0), end: Pos(3, 6)}
                ]);

                var lines = defaultContent.split("\n");
                lines[1] = "//    function bar() {";
                lines[3] = "//        a();";
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: false, reversed: false},
                    {start: Pos(3, 0), end: Pos(3, 8), primary: true, reversed: false}
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 0), end: Pos(1, 0), primary: false, reversed: false},
                    {start: Pos(3, 0), end: Pos(3, 6), primary: true, reversed: false}
                ]);
            });

            it("should only handle each line once, but preserve primary/reversed flags on ignored selections", function () {
                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(1, 6), end: Pos(2, 4), primary: true},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                    {start: Pos(3, 6), end: Pos(3, 8), reversed: true}
                ]);

                var lines = defaultContent.split("\n"), i;
                for (i = 1; i <= 3; i++) {
                    lines[i] = "//" + lines[i];
                }
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 6), end: Pos(1, 6), primary: false, reversed: false},
                    {start: Pos(1, 8), end: Pos(2, 6), primary: true, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 6), primary: false, reversed: false},
                    {start: Pos(3, 8), end: Pos(3, 10), primary: false, reversed: true}
                ]);
                testToggleLine(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                    {start: Pos(1, 6), end: Pos(2, 4), primary: true, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), primary: false, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 8), primary: false, reversed: true}
                ]);
            });

            it("should properly toggle when some selections are already commented but others aren't", function () {
                var lines = defaultContent.split("\n");
                lines[1] = "//" + lines[1];
                lines[5] = "//" + lines[5];
                var startingContent = lines.join("\n");
                myEditor.setText(startingContent);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)},
                    {start: Pos(5, 4), end: Pos(5, 4)}
                ]);

                lines[1] = lines[1].slice(2);
                lines[3] = "//" + lines[3];
                lines[5] = lines[5].slice(2);
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: false, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 6), primary: false, reversed: false},
                    {start: Pos(5, 2), end: Pos(5, 2), primary: true, reversed: false}
                ]);
                testToggleLine(startingContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), primary: false, reversed: false},
                    {start: Pos(5, 4), end: Pos(5, 4), primary: true, reversed: false}
                ]);
            });

            it("should properly toggle adjacent lines (not coalescing them) if there are cursors on each line", function () {
                var lines = defaultContent.split("\n");
                lines[1] = "//" + lines[1];
                lines[2] = "    foo();"; // make this line non-blank so it will get commented
                lines[3] = "//" + lines[3];
                var startingContent = lines.join("\n");
                myEditor.setText(startingContent);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4)},
                    {start: Pos(2, 4), end: Pos(2, 4)},
                    {start: Pos(3, 4), end: Pos(3, 4)}
                ]);

                lines[1] = lines[1].slice(2);
                lines[2] = "//" + lines[2];
                lines[3] = lines[3].slice(2);
                var expectedText = lines.join("\n");

                testToggleLine(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: false, reversed: false},
                    {start: Pos(2, 6), end: Pos(2, 6), primary: false, reversed: false},
                    {start: Pos(3, 2), end: Pos(3, 2), primary: true, reversed: false}
                ]);
                testToggleLine(startingContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false},
                    {start: Pos(2, 4), end: Pos(2, 4), primary: false, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 4), primary: true, reversed: false}
                ]);
            });
        });
    });

    describe("Line comment/uncomment in languages with only block comments and with `indent` option enabled", function () {
        var htmlContent = "<html>\n" +
                          "    <body>\n" +
                          "        <p>Hello</p>\n" +
                          "    </body>\n" +
                          "</html>";

        beforeEach(function () {
            setupFullEditor(htmlContent, "htmlmixed");
            options = { indent: true };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should comment/uncomment a single line, cursor at start", function () {
            myEditor.setCursorPos(2, 0);

            var lines = htmlContent.split("\n");
            lines[2] = "        <!--<p>Hello</p>-->";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(2, 0));
            testToggleLine(htmlContent, Pos(2, 0));
        });

        it("should comment/uncomment a block", function () {
            myEditor.setSelection(Pos(1, 7), Pos(3, 7));

            var expectedText = "<html>\n" +
                "    <!--\n" +
                "    <body>\n" +
                "        <p>Hello</p>\n" +
                "    </body>\n" +
                "    -->\n" +
                "</html>";

            testToggleLine(expectedText, {start: Pos(2, 7), end: Pos(4, 7)});
            testToggleLine(htmlContent, {start: Pos(1, 7), end: Pos(3, 7)});
        });

        it("should comment/uncomment a block with not closing tag ", function () {
            myEditor.setSelection(Pos(1, 7), Pos(2, 7));

            var expectedText = "<html>\n" +
                "    <!--\n" +
                "    <body>\n" +
                "        <p>Hello</p>\n" +
                "        -->\n" +
                "    </body>\n" +
                "</html>";

            testToggleLine(expectedText, {start: Pos(2, 7), end: Pos(3, 7)});
            testToggleLine(htmlContent, {start: Pos(1, 7), end: Pos(2, 7)});
        });

        it("should comment/uncomment a block with not closing tag at end of file", function () {
            myEditor.setSelection(Pos(3, 9), Pos(4, 5));

            var expectedText = "<html>\n" +
                "    <body>\n" +
                "        <p>Hello</p>\n" +
                "    <!--\n" +
                "    </body>\n" +
                "</html>-->\n";

            testToggleLine(expectedText, {start: Pos(4, 9), end: Pos(5, 5)});
            testToggleLine(htmlContent + "\n", {start: Pos(3, 9), end: Pos(4, 5)});
        });
    });

    describe("Line comment/uncomment in languages with only block comments and with `indent` option enabled and use of Tabs", function () {
        var htmlContent = "<html>\n" +
                          "\t<body>\n" +
                          "\t\t<p>Hello</p>\n" +
                          "\t</body>\n" +
                          "</html>";

        beforeEach(function () {
            setupFullEditor(htmlContent, "htmlmixed");
            options = { indent: true};
            myEditor._codeMirror.setOption("indentWithTabs", true);
        });

        afterEach(function () {
            options = noOptions;
            myEditor._codeMirror.setOption("indentWithTabs", false);
        });

        it("should comment/uncomment a single line, cursor at start", function () {
            myEditor.setCursorPos(2, 0);

            var lines = htmlContent.split("\n");
            lines[2] = "\t\t<!--<p>Hello</p>-->";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(2, 0));
            testToggleLine(htmlContent, Pos(2, 0));
        });

        it("should comment/uncomment a block", function () {
            myEditor.setSelection(Pos(1, 4), Pos(3, 4));

            var expectedText = "<html>\n" +
                "\t<!--\n" +
                "\t<body>\n" +
                "\t\t<p>Hello</p>\n" +
                "\t</body>\n" +
                "\t-->\n" +
                "</html>";

            testToggleLine(expectedText, {start: Pos(2, 4), end: Pos(4, 4)});
            testToggleLine(htmlContent, {start: Pos(1, 4), end: Pos(3, 4)});
        });

        it("should comment/uncomment a block with not closing tag ", function () {
            myEditor.setSelection(Pos(1, 4), Pos(2, 7));

            var expectedText = "<html>\n" +
                "\t<!--\n" +
                "\t<body>\n" +
                "\t\t<p>Hello</p>\n" +
                "\t\t-->\n" +
                "\t</body>\n" +
                "</html>";

            testToggleLine(expectedText, {start: Pos(2, 4), end: Pos(3, 7)});
            testToggleLine(htmlContent, {start: Pos(1, 4), end: Pos(2, 7)});
        });

        it("should comment/uncomment a block with not closing tag at end of file", function () {
            myEditor.setSelection(Pos(3, 6), Pos(4, 2));

            var expectedText = "<html>\n" +
                "\t<body>\n" +
                "\t\t<p>Hello</p>\n" +
                "\t<!--\n" +
                "\t</body>\n" +
                "</html>-->\n";

            testToggleLine(expectedText, {start: Pos(4, 6), end: Pos(5, 2)});
            testToggleLine(htmlContent + "\n", {start: Pos(3, 6), end: Pos(4, 2)});
        });
    });

    // The "block comment" command should be unaffected by `indent` option.
    describe("Block comment/uncomment in languages with only block comments and with `indent` option enabled", function () {
        var htmlContent = "<html>\n" +
                          "    <body>\n" +
                          "        <p>Hello</p>\n" +
                          "    </body>\n" +
                          "</html>";

        beforeEach(function () {
            setupFullEditor(htmlContent, "htmlmixed");
            options = { indent: true };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should comment/uncomment a single line, cursor at start", function () {
            myEditor.setCursorPos(2, 0);

            var lines = htmlContent.split("\n");
            lines[2] = "<!---->        <p>Hello</p>";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, Pos(2, 4));
            testToggleBlock(htmlContent, Pos(2, 0));
        });

        it("should comment/uncomment a single line, cursor at end", function () {
            myEditor.setCursorPos(2, 20);

            var lines = htmlContent.split("\n");
            lines[2] = "        <p>Hello</p><!---->";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, Pos(2, 24));
            testToggleBlock(htmlContent, Pos(2, 20));
        });

        it("should comment/uncomment a block", function () {
            myEditor.setSelection(Pos(1, 4), Pos(3, 11));

            var expectedText = "<html>\n" +
                "    <!--<body>\n" +
                "        <p>Hello</p>\n" +
                "    </body>-->\n" +
                "</html>";

            testToggleBlock(expectedText, {start: Pos(1, 8), end: Pos(3, 11)});
            testToggleBlock(htmlContent, {start: Pos(1, 4), end: Pos(3, 11)});
        });
    });

    describe("Line comment in languages with mutiple line comment prefixes", function () {
        beforeAll(function () {
            // Define a special version of JavaScript for testing purposes
            CodeMirror.extendMode("javascript", {
                "lineComment": <any>["//", "////", "#"]
            });
        });

        afterAll(function () {
            // Restore the JavaScript mode
            CodeMirror.extendMode("javascript", {
                "lineComment": "//"
            });
        });

        beforeEach(function () {
            setupFullEditor(null, "javascript");
        });

        it("should comment using the first prefix", function () {
            // select first 2 lines
            myEditor.setSelection(Pos(0, 4), Pos(1, 12));

            var lines = defaultContent.split("\n");
            lines[0] = "//function foo() {";
            lines[1] = "//    function bar() {";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(0, 6), end: Pos(1, 14)});
            testToggleLine(defaultContent, {start: Pos(0, 4), end: Pos(1, 12)});
        });

        it("should uncomment every prefix", function () {
            // Start with lines 1-5 commented out, with multiple line comment variations
            var lines = defaultContent.split("\n");
            lines[1] = "//    function bar() {";
            lines[2] = "    //    ";
            lines[3] = "    ////    a();";
            lines[4] = "        ";
            lines[5] = "#    }";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select lines 1-5
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            lines = defaultContent.split("\n");
            lines[1] = "//    function bar() {";
            lines[2] = "//        ";
            lines[3] = "//        a();";
            lines[4] = "//        ";
            lines[5] = "//    }";
            var expectedText = lines.join("\n");

            testToggleLine(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});
            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should only uncomment the first prefix", function () {
            // Start with lines 1-3 commented out, with multiple line comment variations
            var lines = defaultContent.split("\n");
            lines[1] = "//#    function bar() {";
            lines[2] = "//        ";
            lines[3] = "//////        a();";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            lines = defaultContent.split("\n");
            lines[1] = "#    function bar() {";
            lines[2] = "        ";
            lines[3] = "////        a();";
            // var expectedContent = lines.join("\n");

            // select lines 1-3
            myEditor.setSelection(Pos(1, 0), Pos(4, 0));

            // FIXME
            // testToggleLine(expectedContent, {start: Pos(1, 0), end: Pos(4, 0)});
            
            // FIXME
            // TODO: verify if the empty line should be commented
            // lines = defaultContent.split("\n");
            // lines[2] = "//        ";
            // var expectedContent = lines.join("\n");
            // testToggleLine(expectedContent, {start: Pos(1, 0), end: Pos(4, 0)});
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
                {start: Pos(3, 4), end: Pos(3, 4)}
            ]);

            testToggleLine(defaultContent, [
                {start: Pos(1, 4), end: Pos(1, 4), reversed: false, primary: false},
                {start: Pos(3, 4), end: Pos(3, 4), reversed: false, primary: true}
            ]);
        });

        it("should properly restore the range selections", function () {
            myEditor.setSelections([
                {start: Pos(1, 4), end: Pos(1, 6)},
                {start: Pos(3, 4), end: Pos(3, 6)}
            ]);

            testToggleLine(defaultContent, [
                {start: Pos(1, 4), end: Pos(1, 6), reversed: false, primary: false},
                {start: Pos(3, 4), end: Pos(3, 6), reversed: false, primary: true}
            ]);
        });

        it("should properly restore primary/reversed range selections", function () {
            myEditor.setSelections([
                {start: Pos(1, 4), end: Pos(1, 4), primary: true},
                {start: Pos(3, 4), end: Pos(3, 12), reversed: true}
            ]);

            testToggleLine(defaultContent, [
                {start: Pos(1, 4), end: Pos(1, 4), reversed: false, primary: true},
                {start: Pos(3, 4), end: Pos(3, 12), reversed: true, primary: false}
            ]);
        });
    });

    describe("Block comment/uncomment", function () {
        beforeEach(function () {
            setupFullEditor();
        });

        it("should block comment/uncomment, cursor at start of line", function () {
            myEditor.setCursorPos(0, 0);

            var lines = defaultContent.split("\n");
            lines[0] = "/**/function foo() {";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, Pos(0, 2));
            testToggleBlock(defaultContent, Pos(0, 0));
        });

        it("should block comment/uncomment, cursor to left of existing block comment", function () {
            // Start with part of line 3 wrapped in a block comment
            var lines = defaultContent.split("\n");
            lines[3] = "        /*a();*/";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // put cursor to left of block
            myEditor.setCursorPos(3, 4);

            lines[3] = "    /**/    /*a();*/";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, Pos(3, 6));
            testToggleBlock(startingContent, Pos(3, 4));
        });

        it("should block comment/uncomment, subset of line selected", function () {
            myEditor.setSelection(Pos(1, 13), Pos(1, 18)); // select "bar()"

            var lines = defaultContent.split("\n");
            lines[1] = "    function /*bar()*/ {";
            var expectedText = lines.join("\n");

            // Selects just text within block
            testToggleBlock(expectedText, {start: Pos(1, 15), end: Pos(1, 20)});
            testToggleBlock(defaultContent, {start: Pos(1, 13), end: Pos(1, 18)});
        });

        it("should block uncomment, cursor within existing sub-line block comment", function () {
            // Start with part of line 1 wrapped in a block comment
            var lines = defaultContent.split("\n");
            lines[1] = "    function /*bar()*/ {";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // put cursor within block
            myEditor.setCursorPos(1, 18);

            testToggleBlock(defaultContent, Pos(1, 16));

            lines = defaultContent.split("\n");
            lines[1] = "    function bar/**/() {";
            var expectedText = lines.join("\n");
            testToggleBlock(expectedText, Pos(1, 18));
        });

        it("should block uncomment, cursor within existing block comment suffix", function () {
            // Start with part of line 1 wrapped in a block comment
            var lines = defaultContent.split("\n");
            lines[1] = "    function /*bar()*/ {";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // put cursor within block
            myEditor.setCursorPos(1, 21);

            testToggleBlock(defaultContent, Pos(1, 18));
            
            lines = defaultContent.split("\n");
            lines[1] = "    function bar()/**/ {";
            var expectedText = lines.join("\n");
            testToggleBlock(expectedText, Pos(1, 20));
        });

        it("should block uncomment, selection covering whole sub-line block comment", function () {
            // Start with part of line 1 wrapped in a block comment
            var lines = defaultContent.split("\n");
            lines[1] = "    function /*bar()*/ {";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select whole comment
            myEditor.setSelection(Pos(1, 13), Pos(1, 22));

            testToggleBlock(defaultContent, {start: Pos(1, 13), end: Pos(1, 18)}); // just text that was uncommented
            testToggleBlock(startingContent, {start: Pos(1, 15), end: Pos(1, 20)});
        });

        it("should block comment/uncomment, selection from mid-line end of line", function () {
            myEditor.setSelection(Pos(3, 8), Pos(3, 12));

            var lines = defaultContent.split("\n");
            lines[3] = "        /*a();*/";
            var expectedText = lines.join("\n");

            // Selects just text within block
            testToggleBlock(expectedText, {start: Pos(3, 10), end: Pos(3, 14)});
            testToggleBlock(defaultContent, {start: Pos(3, 8), end: Pos(3, 12)});
        });

        it("should block comment/uncomment, all of line selected but not newline", function () {
            myEditor.setSelection(Pos(3, 0), Pos(3, 12));

            var lines = defaultContent.split("\n");
            lines[3] = "/*        a();*/";
            var expectedText = lines.join("\n");

            // Selects just text within block
            testToggleBlock(expectedText, {start: Pos(3, 2), end: Pos(3, 14)});
            testToggleBlock(defaultContent, {start: Pos(3, 0), end: Pos(3, 12)});
        });


        it("should block comment/uncomment, all of line selected including newline", function () {
            myEditor.setSelection(Pos(3, 0), Pos(4, 0));

            var lines = defaultContent.split("\n");
            lines.splice(3, 1, "/*", lines[3], "*/");   // inserts new delimiter lines
            var expectedText = lines.join("\n");

            // Selects original line, but not block-delimiter lines
            testToggleBlock(expectedText, {start: Pos(4, 0), end: Pos(5, 0)});
            testToggleBlock(defaultContent, {start: Pos(3, 0), end: Pos(4, 0)});
        });

        it("should block comment/uncomment, multiple lines selected", function () {
            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            var lines = defaultContent.split("\n");
            lines.splice(6, 0, "*/");   // inserts new delimiter lines
            lines.splice(1, 0, "/*");
            var expectedText = lines.join("\n");

            // Selects original lines, but not block-delimiter lines
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(7, 0)});
            testToggleBlock(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});
        });

        it("should block comment/uncomment, multiple partial lines selected", function () {
            myEditor.setSelection(Pos(1, 13), Pos(3, 9));

            var lines = defaultContent.split("\n");
            lines[1] = "    function /*bar() {";
            lines[3] = "        a*/();";
            var expectedText = lines.join("\n");

            // Selects just text within block
            testToggleBlock(expectedText, {start: Pos(1, 15), end: Pos(3, 9)});
            testToggleBlock(defaultContent, {start: Pos(1, 13), end: Pos(3, 9)});
        });

        // Whitespace within block comments

        var BLOCK_CONTAINING_WS = "function foo()\n" +
                                  "/*\n" +
                                  "    a();\n" +
                                  "    \n" +
                                  "    b();\n" +
                                  "*/\n" +
                                  "}";

        it("should block uncomment, cursor in whitespace within block comment", function () {
            myEditor.setText(BLOCK_CONTAINING_WS);

            myEditor.setCursorPos(3, 2); // middle of blank line

            var lines = BLOCK_CONTAINING_WS.split("\n");
            lines.splice(5, 1);  // removes delimiter lines
            lines.splice(1, 1);
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, Pos(2, 2));

            lines = BLOCK_CONTAINING_WS.split("\n");
            lines.splice(5, 1);  // removes delimiter lines
            lines.splice(1, 1);
            lines[2] = "  /**/  ";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, Pos(2, 4));
        });

        it("should block uncomment, selection in whitespace within block comment", function () {
            myEditor.setText(BLOCK_CONTAINING_WS);

            myEditor.setSelection(Pos(3, 0), Pos(3, 4));

            var lines = BLOCK_CONTAINING_WS.split("\n");
            lines.splice(5, 1);  // removes delimiter lines
            lines.splice(1, 1);
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(2, 4)});

            lines = BLOCK_CONTAINING_WS.split("\n");
            lines.splice(5, 1);  // removes delimiter lines
            lines.splice(1, 1);
            lines[2] = "/*    */";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 2), end: Pos(2, 6)});
        });

        // Selections mixing whitespace and existing block comments

        var WS_SURROUNDING_BLOCK = "function foo()\n" +
                                   "    \n" +
                                   "    /*a();\n" +
                                   "    \n" +
                                   "    b();*/\n" +
                                   "    \n" +
                                   "}";

        it("should block uncomment, selection covers block comment plus whitespace before", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);

            myEditor.setSelection(Pos(1, 0), Pos(4, 10));  // start of blank line to end of block comment

            var lines = WS_SURROUNDING_BLOCK.split("\n");
            lines[2] = "    a();";
            lines[4] = "    b();";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(4, 8)});

            lines = WS_SURROUNDING_BLOCK.split("\n");
            lines[1] = "/*    ";
            lines[2] = "    a();";
            lines[4] = "    b();*/";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 2), end: Pos(4, 8)});
        });

        it("should block uncomment, selection covers block comment plus whitespace after", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);

            myEditor.setSelection(Pos(2, 4), Pos(5, 4));  // start of block comment to end of blank line

            var lines = WS_SURROUNDING_BLOCK.split("\n");
            lines[2] = "    a();";
            lines[4] = "    b();";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(2, 4), end: Pos(5, 4)});

            lines = WS_SURROUNDING_BLOCK.split("\n");
            lines[2] = "    /*a();";
            lines[4] = "    b();";
            lines[5] = "    */";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 6), end: Pos(5, 4)});
        });

        it("should block uncomment, selection covers part of block comment plus whitespace before", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);

            myEditor.setSelection(Pos(1, 0), Pos(3, 4));  // start of blank line to middle of block comment

            var lines = WS_SURROUNDING_BLOCK.split("\n");
            lines[2] = "    a();";
            lines[4] = "    b();";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(3, 4)});

            lines = WS_SURROUNDING_BLOCK.split("\n");
            lines[1] = "/*    ";
            lines[2] = "    a();";
            lines[3] = "    */";
            lines[4] = "    b();";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 2), end: Pos(3, 4)});
        });

        it("should block uncomment, selection covers part of block comment plus whitespace after", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);

            myEditor.setSelection(Pos(3, 4), Pos(5, 4));  // middle of block comment to end of blank line

            var lines = WS_SURROUNDING_BLOCK.split("\n");
            lines[2] = "    a();";
            lines[4] = "    b();";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(3, 4), end: Pos(5, 4)});
            
            lines = WS_SURROUNDING_BLOCK.split("\n");
            lines[2] = "    a();";
            lines[3] = "    /*";
            lines[4] = "    b();";
            lines[5] = "    */";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(3, 6), end: Pos(5, 4)});
        });

        it("should block uncomment, selection covers block comment plus whitespace on both sides", function () {
            myEditor.setText(WS_SURROUNDING_BLOCK);

            myEditor.setSelection(Pos(1, 0), Pos(5, 4));  // start of first blank line to end of last blank line

            var lines = WS_SURROUNDING_BLOCK.split("\n");
            lines[2] = "    a();";
            lines[4] = "    b();";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(5, 4)});
            
            lines = WS_SURROUNDING_BLOCK.split("\n");
            lines[1] = "/*    ";
            lines[2] = "    a();";
            lines[4] = "    b();";
            lines[5] = "    */";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 2), end: Pos(5, 4)});
        });

        // Selections mixing uncommented text and existing block comments

        it("should block uncomment, selection covers block comment plus other text", function () {
            // Start with part of line 1 wrapped in a block comment
            var lines = defaultContent.split("\n");
            lines[1] = "    function /*bar()*/ {";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select more of line 1
            myEditor.setSelection(Pos(1, 4), Pos(1, 24));

            testToggleBlock(defaultContent, {start: Pos(1, 4), end: Pos(1, 20)}); // range endpoints still align with same text
            
            lines = defaultContent.split("\n");
            lines[1] = "    /*function bar() {*/";
            var expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 6), end: Pos(1, 22)});
        });

        it("should block uncomment, selection covers multi-line block comment plus other text", function () {
            var content = "function foo()\n" +
                          "    \n" +
                          "    /*a();\n" +
                          "    \n" +
                          "    b();*/\n" +
                          "    c();\n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(0, 5), Pos(5, 5));  // middle of first line of code to middle of line following comment

            var lines = content.split("\n");
            lines[2] = "    a();";
            lines[4] = "    b();";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(0, 5), end: Pos(5, 5)});
            
            lines = content.split("\n");
            lines[0] = "funct/*ion foo()";
            lines[2] = "    a();";
            lines[4] = "    b();";
            lines[5] = "    c*/();";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(0, 7), end: Pos(5, 5)});
        });

        // Selections including multiple separate block comments
        // We no-op in these cases since it's ambiguous - can't nest block comments, but was multiple independent uncomments intended?

        it("should do nothing, selection covers parts of multiple block comments", function () {
            // Start with part of line 1 wrapped in a block comment
            var lines = defaultContent.split("\n");
            lines[1] = "    /*function*/ /*bar()*/ {";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select end of 1st comment, start of 2nd comment, and the space between them
            myEditor.setSelection(Pos(1, 9), Pos(1, 22));

            testToggleBlock(startingContent, {start: Pos(1, 9), end: Pos(1, 22)}); // no change
        });

        it("should do nothing, selection covers all of multiple block comments", function () {
            // Start with part of line 1 wrapped in a block comment
            var lines = defaultContent.split("\n");
            lines[1] = "    /*function*/ /*bar()*/ {";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select both block comments and the space between them, but nothing else
            myEditor.setSelection(Pos(1, 4), Pos(1, 26));

            testToggleBlock(startingContent, {start: Pos(1, 4), end: Pos(1, 26)}); // no change
        });

        it("should do nothing, selection covers multiple block comments & nothing else", function () {
            // Start with part of line 1 wrapped in a block comment
            var lines = defaultContent.split("\n");
            lines[1] = "    /*function*//*bar()*/ {";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select both block comments, but nothing else
            myEditor.setSelection(Pos(1, 4), Pos(1, 25));

            testToggleBlock(startingContent, {start: Pos(1, 4), end: Pos(1, 25)}); // no change
        });

        it("should do nothing, selection covers multiple block comments plus other text", function () {
            // Start with part of line 1 wrapped in a block comment
            var lines = defaultContent.split("\n");
            lines[1] = "    /*function*/ /*bar()*/ {";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            // select all of line 1 (but not newline)
            myEditor.setSelection(Pos(1, 0), Pos(1, 28));

            testToggleBlock(startingContent, {start: Pos(1, 0), end: Pos(1, 28)}); // no change
        });

        describe("with multiple selections", function () {
            it("should comment out multiple selections/cursors, preserving primary/reversed selections", function () {
                var lines = defaultContent.split("\n");
                lines[1] = lines[1].substr(0, 4) + "/**/" + lines[1].substr(4);
                lines[3] = lines[3].substr(0, 4) + "/*" + lines[3].substr(4, 8) + "*/" + lines[3].substr(12);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4), primary: true},
                    {start: Pos(3, 4), end: Pos(3, 12), reversed: true}
                ]);
                testToggleBlock(lines.join("\n"), [
                    {start: Pos(1, 6), end: Pos(1, 6), primary: true, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 14), primary: false, reversed: true}
                ]);
                testToggleBlock(defaultContent, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: true, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 12), primary: false, reversed: true}
                ]);
            });

            it("should skip the case where a selection covers multiple block comments, but still track it and handle other selections", function () {
                var lines = defaultContent.split("\n");
                lines[4] = "    /*a*/ /*()*/ {";
                var startingContent = lines.join("\n");
                myEditor.setText(startingContent);

                myEditor.setSelections([
                    {start: Pos(0, 0), end: Pos(1, 0)},
                    {start: Pos(4, 0), end: Pos(4, 18), reversed: true}
                ]);

                lines.splice(1, 0, "*/");
                lines.splice(0, 0, "/*");

                testToggleBlock(lines.join("\n"), [
                    {start: Pos(1, 0), end: Pos(2, 0), primary: false, reversed: false},
                    {start: Pos(6, 0), end: Pos(6, 18), primary: true, reversed: true}
                ]);
                testToggleBlock(startingContent, [
                    {start: Pos(0, 0), end: Pos(1, 0), primary: false, reversed: false},
                    {start: Pos(4, 0), end: Pos(4, 18), primary: true, reversed: true}
                ]);
            });
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
            var lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            myEditor.setCursorPos(1, 18);

            testToggleBlock(defaultContent, Pos(1, 16));

            lines = defaultContent.split("\n");
            lines[1] = "    function bar/**/() {";
            var expectedText = lines.join("\n");
            testToggleBlock(expectedText, Pos(1, 18));
        });

        it("should switch to line uncomment, cursor in whitespace to left of line comment", function () { // #2342
            // Start with part of line 1 line-commented
            var lines = defaultContent.split("\n");
            lines[1] = "    //function bar() {";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            myEditor.setCursorPos(1, 0);

            testToggleBlock(defaultContent, Pos(1, 0));
            
            lines = defaultContent.split("\n");
            lines[1] = "/**/    function bar() {";
            var expectedText = lines.join("\n");
            testToggleBlock(expectedText, Pos(1, 2));
        });

        it("should switch to line uncomment, some of line-comment selected (only whitespace to left)", function () {
            var content = "function foo()\n" +
                          "    // Comment\n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 6), Pos(1, 13)); // just " Commen"

            var lines = content.split("\n");
            lines[1] = "     Comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 4), end: Pos(1, 11)});

            lines = content.split("\n");
            lines[1] = "    /* Commen*/t";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 6), end: Pos(1, 13)});
        });

        it("should switch to line uncomment, some of line-comment selected including last char (only whitespace to left)", function () { // #2337
            var content = "function foo()\n" +
                          "    // Comment\n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 6), Pos(1, 14)); // everything but leading "//"

            var lines = content.split("\n");
            lines[1] = "     Comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 4), end: Pos(1, 12)});

            lines = content.split("\n");
            lines[1] = "    /* Comment*/";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 6), end: Pos(1, 14)});
        });

        it("should switch to line uncomment, all of line-comment selected (only whitespace to left)", function () { // #2342
            var content = "function foo()\n" +
                          "    // Comment\n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 4), Pos(1, 14)); // include "//"

            var lines = content.split("\n");
            lines[1] = "     Comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 4), end: Pos(1, 12)});
            
            lines = content.split("\n");
            lines[1] = "    /* Comment*/";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 6), end: Pos(1, 14)});
        });

        // Selections that don't mix code & line-comment, but are on a line that does contain both

        it("should insert block comment, cursor inside line comment (with code to left)", function () {
            // Start with comment ending line 1
            var lines = defaultContent.split("\n");
            lines[1] = "    function bar() { // comment";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            myEditor.setCursorPos(1, 24); // between space and "c"

            lines = defaultContent.split("\n");
            lines[1] = "    function bar() { // /**/comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, Pos(1, 26));
            // FIXME
            // testToggleBlock(startingContent, Pos(1, 24));
        });

        it("should insert block comment, cursor in code to left of line comment", function () {
            // Start with comment ending line 1
            var lines = defaultContent.split("\n");
            lines[1] = "    function bar() { // comment";
            var startingContent = lines.join("\n");
            myEditor.setText(startingContent);

            myEditor.setCursorPos(1, 12);

            lines[1] = "    function/**/ bar() { // comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, Pos(1, 14));
            testToggleBlock(startingContent, Pos(1, 12));
        });

        it("should block comment, some of line-comment selected (with code to left)", function () {
            var content = "function foo()\n" +
                          "    f(); // Comment\n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 11), Pos(1, 18)); // just " Commen"

            var lines = content.split("\n");
            lines[1] = "    f(); ///* Commen*/t";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 13), end: Pos(1, 20)});

            // FIXME
            // testToggleBlock(content, {start: Pos(1, 11), end: Pos(1, 18)});
        });

        it("should block comment, some of line-comment selected including last char (with code to left)", function () { // #2337
            var content = "function foo()\n" +
                          "    f(); // Comment\n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 11), Pos(1, 19)); // everything but leading "//"

            var lines = content.split("\n");
            lines[1] = "    f(); ///* Comment*/";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 13), end: Pos(1, 21)});

            // FIXME
            // testToggleBlock(content, {start: Pos(1, 11), end: Pos(1, 19)});
        });

        it("should block comment, all of line-comment selected (with code to left)", function () { // #2342
            var content = "function foo()\n" +
                          "    f(); // Comment\n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 9), Pos(1, 19)); // include "//"

            var lines = content.split("\n");
            lines[1] = "    f(); /*// Comment*/";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 11), end: Pos(1, 21)});
            testToggleBlock(content, {start: Pos(1, 9), end: Pos(1, 19)});
        });

        // Full-line/multiline selections containing only line comments and whitespace

        it("should switch to line uncomment, all of line-comment line selected (following line is code)", function () {
            var content = "function foo()\n" +
                          "    // Comment\n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            var lines = content.split("\n");
            lines[1] = "     Comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});

            expectedText = "function foo()\n" +
                           "/*\n" +
                           "     Comment\n" +
                           "*/\n" +
                           "}";
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should switch to line uncomment, all of line-comment line selected (following line is whitespace)", function () {
            var content = "function foo()\n" +
                          "    // Comment\n" +
                          "    \n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            var lines = content.split("\n");
            lines[1] = "     Comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});

            expectedText = "function foo()\n" +
                           "/*\n" +
                           "     Comment\n" +
                           "*/\n" +
                           "    \n" +
                           "}";
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should switch to line uncomment, all of line-comment line selected (following line is line comment)", function () {
            var content = "function foo()\n" +
                          "    // Comment\n" +
                          "    // Comment 2\n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            var lines = content.split("\n");
            lines[1] = "     Comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});
            
            expectedText = "function foo()\n" +
                           "/*\n" +
                           "     Comment\n" +
                           "*/\n" +
                           "    // Comment 2\n" +
                           "}";
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should switch to line uncomment, all of line-comment line selected (following line is block comment)", function () {
            var content = "function foo()\n" +
                          "    // Comment\n" +
                          "    /* Comment 2 */\n" +
                          "}";
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            var lines = content.split("\n");
            lines[1] = "     Comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});

            expectedText = "function foo()\n" +
                           "/*\n" +
                           "     Comment\n" +
                           "*/\n" +
                           "    /* Comment 2 */\n" +
                           "}";
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should line uncomment, multiple line comments selected", function () {
            // Start with all of lines 1-5 line-commented
            var lines = defaultContent.split("\n");
            lines[1] = "//    function bar() {";
            lines[2] = "//        ";
            lines[3] = "//        a();";
            lines[4] = "//        ";
            lines[5] = "//    }";
            var content = lines.join("\n");
            myEditor.setText(content);

            myEditor.setSelection(Pos(1, 0), Pos(6, 0));

            testToggleBlock(defaultContent, {start: Pos(1, 0), end: Pos(6, 0)});

            var expectedText = "function foo() {\n" +
                               "/*\n" +
                               "    function bar() {\n" +
                               "        \n" +
                               "        a();\n" +
                               "        \n" +
                               "    }\n" +
                               "*/\n" +
                               "\n" +
                               "}";
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(7, 0)});
        });

        // Selections mixing uncommented code & line comments

        var lineCommentCode = "function foo() {\n" +
                              "    \n" +
                              "    // Floating comment\n" +
                              "    \n" +
                              "    // Attached comment\n" +
                              "    function bar() {\n" +
                              "        a();\n" +
                              "        b(); // post comment\n" +
                              "    }\n" +
                              "    \n" +
                              "    bar();\n" +
                              "    // Attached above\n" +
                              "    \n" +
                              "    // Final floating comment\n" +
                              "    \n" +
                              "}";

        it("should line uncomment, multiline selection covers line comment plus whitespace", function () {
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(1, 0), Pos(3, 4));

            var lines = lineCommentCode.split("\n");
            lines[2] = "     Floating comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(3, 4)});

            lines = lineCommentCode.split("\n");
            lines[1] = "/*    ";
            lines[2] = "     Floating comment";
            lines[3] = "    */";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 2), end: Pos(3, 4)});
        });

        it("should switch to line uncomment mode, selection starts in whitespace & ends in middle of line comment", function () { // #2342
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(2, 2), Pos(2, 10)); // stops with "Flo"

            var lines = lineCommentCode.split("\n");
            lines[2] = "     Floating comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(2, 2), end: Pos(2, 8)});
            
            lines = lineCommentCode.split("\n");
            lines[2] = "  /*   Flo*/ating comment";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 4), end: Pos(2, 10)});
        });

        it("should switch to line uncomment mode, selection starts in whitespace & ends at end of line comment", function () { // #2337, #2342
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(2, 2), Pos(2, 23));

            var lines = lineCommentCode.split("\n");
            lines[2] = "     Floating comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(2, 2), end: Pos(2, 21)});

            lines = lineCommentCode.split("\n");
            lines[2] = "  /*   Floating comment*/";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 4), end: Pos(2, 23)});
        });

        it("should block comment, selection starts in code & ends in middle of line comment", function () { // #2342
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(7, 8), Pos(7, 20)); // stops at end of "post"

            var lines = lineCommentCode.split("\n");
            lines[7] = "        /*b(); // post*/ comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(7, 10), end: Pos(7, 22)});
            testToggleBlock(lineCommentCode, {start: Pos(7, 8), end: Pos(7, 20)});
        });

        it("should block comment, selection starts in middle of code & ends at end of line comment", function () { // #2342
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(7, 9), Pos(7, 28));

            var lines = lineCommentCode.split("\n");
            lines[7] = "        b/*(); // post comment*/";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(7, 11), end: Pos(7, 30)});
            testToggleBlock(lineCommentCode, {start: Pos(7, 9), end: Pos(7, 28)});
        });

        it("should block comment, selection starts in code & ends at end of line comment", function () { // #2337
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(7, 8), Pos(7, 28));

            var lines = lineCommentCode.split("\n");
            lines[7] = "        /*b(); // post comment*/";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(7, 10), end: Pos(7, 30)});
            testToggleBlock(lineCommentCode, {start: Pos(7, 8), end: Pos(7, 28)});
        });

        it("should block comment, selection starts at col 0 of code & ends at end of line comment", function () {
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(7, 0), Pos(7, 28));

            var lines = lineCommentCode.split("\n");
            lines[7] = "/*        b(); // post comment*/";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(7, 2), end: Pos(7, 30)});
            testToggleBlock(lineCommentCode, {start: Pos(7, 0), end: Pos(7, 28)});
        });

        it("should block comment, selection starts on line with line comment", function () {
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(4, 0), Pos(9, 0));

            var lines = lineCommentCode.split("\n");
            lines.splice(9, 0, "*/");
            lines.splice(4, 0, "/*");
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(5, 0), end: Pos(10, 0)});
            testToggleBlock(lineCommentCode, {start: Pos(4, 0), end: Pos(9, 0)});
        });

        it("should block comment, selection ends on line with line comment", function () {
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(10, 0), Pos(12, 0));

            var lines = lineCommentCode.split("\n");
            lines.splice(12, 0, "*/");
            lines.splice(10, 0, "/*");
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(11, 0), end: Pos(13, 0)});
            testToggleBlock(lineCommentCode, {start: Pos(10, 0), end: Pos(12, 0)});
        });

        it("should line uncomment, selection covers several line comments separated by whitespace", function () {
            myEditor.setText(lineCommentCode);
            myEditor.setSelection(Pos(11, 0), Pos(14, 0));

            var lines = lineCommentCode.split("\n");
            lines[11] = "     Attached above";
            lines[13] = "     Final floating comment";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(11, 0), end: Pos(14, 0)});

            lines = lineCommentCode.split("\n");
            lines.splice(11, 0, "/*");
            lines[12] = "     Attached above";
            lines[14] = "     Final floating comment";
            lines.splice(15, 0, "*/");
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(12, 0), end: Pos(15, 0)});
        });

        describe("with multiple selections", function () {
            it("should handle multiple selections where one of them is in a line comment", function () {
                // Add a line comment to line 1
                var lines = defaultContent.split("\n");
                lines[1] = "//" + lines[1];
                var content = lines.join("\n");
                myEditor.setText(content);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4), primary: true},
                    {start: Pos(3, 4), end: Pos(3, 12)}
                ]);

                // Line 1 should no longer have a line comment, and line 3 should have a block comment.
                lines[1] = lines[1].substr(2);
                lines[3] = lines[3].substr(0, 4) + "/*" + lines[3].substr(4, 8) + "*/" + lines[3].substr(12);
                var expectedText = lines.join("\n");
                testToggleBlock(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: true, reversed: false},
                    {start: Pos(3, 6), end: Pos(3, 14), primary: false, reversed: false}
                ]);

                lines = content.split("\n");
                lines[1] = "  /**/  function bar() {";
                expectedText = lines.join("\n");
                testToggleBlock(expectedText, [
                    {start: Pos(1, 4), end: Pos(1, 4), primary: true, reversed: false},
                    {start: Pos(3, 4), end: Pos(3, 12), primary: false, reversed: false}
                ]);
            });

            it("should handle multiple selections where several of them are in the same line comment, preserving the ignored selections", function () {
                // Add a line comment to line 1
                var lines = defaultContent.split("\n");
                lines[1] = "//" + lines[1];
                var content = lines.join("\n");
                myEditor.setText(content);

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 4), primary: true},
                    {start: Pos(1, 6), end: Pos(1, 6)}
                ]);

                // Line 1 should no longer have a line comment
                lines[1] = lines[1].substr(2);
                var expectedText = lines.join("\n");
                testToggleBlock(expectedText, [
                    {start: Pos(1, 2), end: Pos(1, 2), primary: true, reversed: false},
                    {start: Pos(1, 4), end: Pos(1, 4), primary: false, reversed: false}
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
        var cssContent = "div {\n" +
                         "    color: red;\n" +
                         "}\n" +
                         "\n" +
                         "/*span {\n" +
                         "    color: blue;\n" +
                         "}*/\n";

        beforeEach(function () {
            setupFullEditor(cssContent, "css");
        });

        it("should block-comment entire line that cursor is in", function () {
            myEditor.setCursorPos(1, 4);

            var lines = cssContent.split("\n");
            lines[1] = "/*    color: red;*/";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(1, 6));
            testToggleLine(cssContent, Pos(1, 4));
        });

        it("should block-comment entire line that sub-line selection is in", function () {
            myEditor.setSelection(Pos(1, 4), Pos(1, 9));

            var lines = cssContent.split("\n");
            lines[1] = "/*    color: red;*/";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 6), end: Pos(1, 11)});
            testToggleLine(cssContent, {start: Pos(1, 4), end: Pos(1, 9)});
        });

        it("should block-comment full multi-line selection", function () {
            myEditor.setSelection(Pos(0, 0), Pos(3, 0));

            var lines = cssContent.split("\n");
            lines.splice(3, 0, "*/");
            lines.splice(0, 0, "/*");
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 0), end: Pos(4, 0)});
            testToggleLine(cssContent, {start: Pos(0, 0), end: Pos(3, 0)});
        });

        it("should block-comment partial multi-line selection as if it were full", function () {
            myEditor.setSelection(Pos(0, 3), Pos(1, 10));

            var lines = cssContent.split("\n");
            lines.splice(2, 0, "*/");
            lines.splice(0, 0, "/*");
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(1, 3), end: Pos(2, 10)});  // range endpoints still align with same text
            testToggleLine(cssContent, {start: Pos(0, 3), end: Pos(1, 10)});
        });

        it("should uncomment multi-line block comment selection, selected exactly", function () {
            myEditor.setSelection(Pos(4, 0), Pos(6, 3));

            var lines = cssContent.split("\n");
            lines[4] = "span {";
            lines[6] = "}";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(4, 0), end: Pos(6, 1)});

            lines = cssContent.split("\n");
            lines.splice(4, 0, "/*");
            lines[5] = "span {";
            lines[7] = "}";
            lines.splice(8, 0, "*/");
            expectedText = lines.join("\n");
            testToggleLine(expectedText, {start: Pos(5, 0), end: Pos(7, 1)});
        });

        it("should uncomment multi-line block comment selection, selected including trailing newline", function () { // #2339
            myEditor.setSelection(Pos(4, 0), Pos(7, 0));

            var lines = cssContent.split("\n");
            lines[4] = "span {";
            lines[6] = "}";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(4, 0), end: Pos(7, 0)});
            
            lines = cssContent.split("\n");
            lines.splice(4, 0, "/*");
            lines[5] = "span {";
            lines[7] = "}";
            lines.splice(8, 0, "*/");
            expectedText = lines.join("\n");
            testToggleLine(expectedText, {start: Pos(5, 0), end: Pos(8, 0)});
        });

        it("should uncomment multi-line block comment selection, only start selected", function () {
            myEditor.setSelection(Pos(4, 0), Pos(5, 8));

            var lines = cssContent.split("\n");
            lines[4] = "span {";
            lines[6] = "}";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(4, 0), end: Pos(5, 8)});

            lines = cssContent.split("\n");
            lines.splice(4, 0, "/*");
            lines[5] = "span {";
            lines.splice(7, 0, "*/");
            lines[8] = "}";
            expectedText = lines.join("\n");
            testToggleLine(expectedText, {start: Pos(5, 0), end: Pos(6, 8)});
        });

        it("should uncomment multi-line block comment selection, only middle selected", function () {
            myEditor.setSelection(Pos(5, 0), Pos(5, 8));

            var lines = cssContent.split("\n");
            lines[4] = "span {";
            lines[6] = "}";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(5, 0), end: Pos(5, 8)});
            
            lines = cssContent.split("\n");
            lines[4] = "span {";
            lines[5] = "/*    color: blue;*/";
            lines[6] = "}";
            expectedText = lines.join("\n");
            testToggleLine(expectedText, {start: Pos(5, 2), end: Pos(5, 10)});
        });

        it("should uncomment multi-line block comment selection, only end selected", function () { // #2339
            myEditor.setSelection(Pos(5, 8), Pos(6, 3));

            var lines = cssContent.split("\n");
            lines[4] = "span {";
            lines[6] = "}";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(5, 8), end: Pos(6, 1)});

            lines = cssContent.split("\n");
            lines[4] = "span {";
            lines.splice(5, 0, "/*");
            lines[7] = "}";
            lines.splice(8, 0, "*/");
            expectedText = lines.join("\n");
            testToggleLine(expectedText, {start: Pos(6, 8), end: Pos(7, 1)});
        });

        it("should uncomment multi-line block comment selection, only end selected, ends at EOF", function () {
            // remove trailing blank line, so end of "*/" is EOF (no newline afterward)
            myEditor._codeMirror.replaceRange("", Pos(6, 3), Pos(7, 0));
            var content = myEditor.getText();

            myEditor.setSelection(Pos(5, 8), Pos(6, 3));

            var lines = content.split("\n");
            lines[4] = "span {";
            lines[6] = "}";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(5, 8), end: Pos(6, 1)});

            lines = content.split("\n");
            lines[4] = "span {";
            lines.splice(5, 0, "/*");
            expectedText = lines.join("\n") + "\n";
            testToggleLine(expectedText, {start: Pos(6, 8), end: Pos(7, 1)});
        });

        it("should uncomment multi-line block comment that cursor is in", function () {
            myEditor.setCursorPos(5, 4);

            var lines = cssContent.split("\n");
            lines[4] = "span {";
            lines[6] = "}";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(5, 4));

            lines = cssContent.split("\n");
            lines[4] = "span {";
            lines[5] = "/*    color: blue;*/";
            lines[6] = "}";
            expectedText = lines.join("\n");
            testToggleLine(expectedText, Pos(5, 6));
        });
    });

    describe("Comment/uncomment with mixed syntax modes with `indent` option disabled", function () {

        var htmlContent = "<html>\n" +
                          "    <head>\n" +
                          "        <style type='text/css'>\n" +
                          "            body {\n" +
                          "                font-size: 15px;\n" +
                          "            }\n" +
                          "        </style>\n" +
                          "        <script type='text/javascript'>\n" +
                          "            function foo() {\n" +
                          "                function bar() {\n" +
                          "                    a();\n" +
                          "                }\n" +
                          "            }\n" +
                          "        </script>\n" +
                          "    </head>\n" +
                          "    <body>\n" +
                          "        <p>Hello</p>\n" +
                          "        <p>World</p>\n" +
                          "    </body>\n" +
                          "</html>";

        beforeEach(function () {
            setupFullEditor(htmlContent, "htmlmixed");
        });

        afterEach(function () {
        });

        // Correct behavior for line and block comment commands

        it("should block comment/uncomment generic HTML code", function () {
            myEditor.setSelection(Pos(1, 4), Pos(1, 10));

            var lines = htmlContent.split("\n");
            lines[1] = "    <!--<head>-->";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(1, 8), end: Pos(1, 14)});
            testToggleBlock(htmlContent, {start: Pos(1, 4), end: Pos(1, 10)});
        });

        it("should block comment/uncomment generic CSS code", function () {
            myEditor.setSelection(Pos(4, 16), Pos(4, 32));

            var lines = htmlContent.split("\n");
            lines[4] = "                /*font-size: 15px;*/";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(4, 18), end: Pos(4, 34)});
            testToggleBlock(htmlContent, {start: Pos(4, 16), end: Pos(4, 32)});
        });

        it("should line comment/uncomment generic JS code", function () {
            myEditor.setCursorPos(10, 0);

            var lines = htmlContent.split("\n");
            lines[10] = "//                    a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(10, 2));

            // Uncomment
            testToggleLine(htmlContent, Pos(10, 0));
        });

        it("should block comment/uncomment generic JS code", function () {
            myEditor.setSelection(Pos(8, 0), Pos(13, 0));

            var lines = htmlContent.split("\n");
            lines.splice(13, 0, "*/");
            lines.splice(8, 0, "/*");
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(9, 0), end: Pos(14, 0)});
            testToggleBlock(htmlContent, {start: Pos(8, 0), end: Pos(13, 0)});
        });

        it("should HTML comment/uncomment around outside of <style> block", function () {
            myEditor.setSelection(Pos(2, 0), Pos(7, 0));

            var lines = htmlContent.split("\n");
            lines.splice(7, 0, "-->");
            lines.splice(2, 0, "<!--");
            var expectedText = lines.join("\n");

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
                    {start: Pos(8, 0), end: Pos(13, 0)}
                ]);

                var lines = htmlContent.split("\n");
                lines[1] = "    <!--<head>-->";
                lines[4] = "                /*font-size: 15px;*/";
                lines.splice(13, 0, "*/");
                lines.splice(8, 0, "/*");

                testToggleBlock(lines.join("\n"), [
                    {start: Pos(1, 8), end: Pos(1, 14), primary: false, reversed: false},
                    {start: Pos(4, 18), end: Pos(4, 34), primary: false, reversed: false},
                    {start: Pos(9, 0), end: Pos(14, 0), primary: true, reversed: false}
                ]);
                testToggleBlock(htmlContent, [
                    {start: Pos(1, 4), end: Pos(1, 10), primary: false, reversed: false},
                    {start: Pos(4, 16), end: Pos(4, 32), primary: false, reversed: false},
                    {start: Pos(8, 0), end: Pos(13, 0), primary: true, reversed: false}
                ]);
            });

            it("should handle multiple selections in different regions, toggling line selection (but falling back to block selection in HTML/CSS)", function () {

                myEditor.setSelections([
                    {start: Pos(1, 4), end: Pos(1, 10)},
                    {start: Pos(4, 16), end: Pos(4, 32)},
                    {start: Pos(10, 0), end: Pos(10, 0)}
                ]);

                var lines = htmlContent.split("\n");
                lines[1] = "<!--    <head>-->";
                lines[4] = "/*                font-size: 15px;*/";
                lines[10] = "//                    a();";

                testToggleLine(lines.join("\n"), [
                    {start: Pos(1, 8), end: Pos(1, 14), primary: false, reversed: false},
                    {start: Pos(4, 18), end: Pos(4, 34), primary: false, reversed: false},
                    {start: Pos(10, 2), end: Pos(10, 2), primary: true, reversed: false}
                ]);
                testToggleLine(htmlContent, [
                    {start: Pos(1, 4), end: Pos(1, 10), primary: false, reversed: false},
                    {start: Pos(4, 16), end: Pos(4, 32), primary: false, reversed: false},
                    {start: Pos(10, 0), end: Pos(10, 0), primary: true, reversed: false}
                ]);
            });

            it("shouldn't comment anything in a mixed-mode selection, but should track it properly and comment the other selections", function () {
                // Select the whole HTML tag so it will actually insert a line, causing other selections to get fixed up.
                myEditor.setSelections([
                    {start: Pos(1, 0), end: Pos(2, 0)},
                    {start: Pos(5, 0), end: Pos(7, 0), reversed: true, primary: true},
                    {start: Pos(8, 0), end: Pos(13, 0)}
                ]);

                var lines = htmlContent.split("\n");
                lines.splice(13, 0, "*/");
                lines.splice(8, 0, "/*");
                lines.splice(2, 0, "-->");
                lines.splice(1, 0, "<!--");

                testToggleBlock(lines.join("\n"), [
                    {start: Pos(2, 0), end: Pos(3, 0), primary: false, reversed: false},
                    {start: Pos(7, 0), end: Pos(9, 0), primary: true, reversed: true},
                    {start: Pos(11, 0), end: Pos(16, 0), primary: false, reversed: false}
                ]);
                testToggleBlock(htmlContent, [
                    {start: Pos(1, 0), end: Pos(2, 0), primary: false, reversed: false},
                    {start: Pos(5, 0), end: Pos(7, 0), primary: true, reversed: true},
                    {start: Pos(8, 0), end: Pos(13, 0), primary: false, reversed: false}
                ]);
            });
        });

    });

    describe("Comment/uncomment with mixed syntax modes with `indent` option enabled", function () {

        var htmlContent = "<html>\n" +
                          "    <head>\n" +
                          "        <style type='text/css'>\n" +
                          "            body {\n" +
                          "                font-size: 15px;\n" +
                          "            }\n" +
                          "        </style>\n" +
                          "        <script type='text/javascript'>\n" +
                          "            function foo() {\n" +
                          "                function bar() {\n" +
                          "                    a();\n" +
                          "                }\n" +
                          "            }\n" +
                          "        </script>\n" +
                          "    </head>\n" +
                          "    <body>\n" +
                          "        <p>Hello</p>\n" +
                          "        <p>World</p>\n" +
                          "    </body>\n" +
                          "</html>";

        beforeEach(function () {
            setupFullEditor(htmlContent, "htmlmixed");
            options = { indent: true };
        });

        afterEach(function () {
            options = noOptions;
        });

        it("should line comment/uncomment generic JS code", function () {
            myEditor.setCursorPos(10, 0);

            var lines = htmlContent.split("\n");
            lines[10] = "                    //a();";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, Pos(10, 0));

            // Uncomment
            testToggleLine(htmlContent, Pos(10, 0));
        });

        it("should line comment/uncomment and indent HTML code", function () {
            myEditor.setCursorPos(16, 8);

            var lines = htmlContent.split("\n");
            lines[16] = "        <!--<p>Hello</p>-->";
            var expectedText = lines.join("\n");

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
                    {start: Pos(10, 0), end: Pos(10, 0)}
                ]);

                var lines = htmlContent.split("\n");
                lines[1] = "    <!--<head>-->";
                lines[4] = "                /*font-size: 15px;*/";
                lines[10] = "                    //a();";

                testToggleLine(lines.join("\n"), [
                    {start: Pos(1, 8), end: Pos(1, 14), reversed: false, primary: false},
                    {start: Pos(4, 18), end: Pos(4, 34), reversed: false, primary: false},
                    {start: Pos(10, 0), end: Pos(10, 0), reversed: false, primary: true}
                ]);
                testToggleLine(htmlContent, [
                    {start: Pos(1, 4), end: Pos(1, 10), reversed: false, primary: false},
                    {start: Pos(4, 16), end: Pos(4, 32), reversed: false, primary: false},
                    {start: Pos(10, 0), end: Pos(10, 0), reversed: false, primary: true}
                ]);
            });
        });
    });

    describe("Comment/uncomment on languages with equal prefix and suffix and a line prefix being prefix of a block prefix/suffix", function () {
        // Extend CoffeeScript language for testing purposes
        CodeMirror.extendMode("coffeescript", {
            "blockCommentStart": "###",
            "blockCommentEnd": "###",
            "lineComment": "#"
        });

        var coffeeContent = "foo = 42\n" +
                            "bar = true\n" +
                            "baz = \"hello\"\n" +
                            "number = -42\n" +
                            "if bar square = (x) -> x * x";

        function getContentCommented(startLine, endLine, content?) {
            var lines = (content || coffeeContent).split("\n");
            lines.splice(endLine, 0, "###");
            lines.splice(startLine, 0, "###");
            return lines.join("\n");
        }

        beforeEach(function () {
            setupFullEditor(coffeeContent, "coffeescript");
        });

        it("should block comment/uncomment selecting part of lines", function () {
            myEditor.setSelection(Pos(2, 2), Pos(3, 5));

            var lines = coffeeContent.split("\n");
            lines[2] = "ba###z = \"hello\"";
            lines[3] = "numbe###r = -42";
            var expectedText = lines.join("\n");

            testToggleBlock(expectedText, {start: Pos(2, 5), end: Pos(3, 5)});
            testToggleBlock(coffeeContent, {start: Pos(2, 2), end: Pos(3, 5)});
        });

        it("should block comment/uncomment selecting full lines", function () {
            myEditor.setSelection(Pos(1, 0), Pos(3, 0));
            var expectedText = getContentCommented(1, 3);

            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(4, 0)});
            testToggleBlock(coffeeContent, {start: Pos(1, 0), end: Pos(3, 0)});
        });

        it("should block uncomment when selecting the prefix and suffix", function () {
            var expectedText = getContentCommented(1, 3);
            myEditor.setText(expectedText);
            myEditor.setSelection(Pos(1, 0), Pos(5, 0));

            testToggleBlock(coffeeContent, {start: Pos(1, 0), end: Pos(3, 0)});
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(4, 0)});
        });

        it("should block uncomment when selecting only the prefix", function () {
            var expectedText = getContentCommented(1, 3);
            myEditor.setText(expectedText);
            myEditor.setSelection(Pos(1, 0), Pos(2, 0));

            testToggleBlock(coffeeContent, {start: Pos(1, 0), end: Pos(1, 0)});

            var lines = coffeeContent.split("\n");
            lines[1] = "######bar = true";
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(1, 3), end: Pos(1, 3)});
        });

        it("should block uncomment when selecting only the suffix", function () {
            myEditor.setText(getContentCommented(1, 3));
            myEditor.setSelection(Pos(4, 0), Pos(5, 0));

            testToggleBlock(coffeeContent, {start: Pos(3, 0), end: Pos(3, 0)});

            var lines = coffeeContent.split("\n");
            lines[3] = "######number = -42";
            var expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(3, 3), end: Pos(3, 3)});
        });

        it("should do nothing when selecting from a suffix to a prefix", function () {
            var expectedText = getContentCommented(0, 1, getContentCommented(4, 5));
            myEditor.setText(expectedText);
            myEditor.setSelection(Pos(2, 0), Pos(7, 0));

            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(7, 0)});
        });

        it("should block uncomment with line comments around the block comment", function () {
            var lines = coffeeContent.split("\n");
            lines[0] = "#foo = 42";
            lines[3] = "#number = -42";
            var expectedText = lines.join("\n");
            var content = getContentCommented(1, 3, expectedText);

            myEditor.setText(content);
            myEditor.setSelection(Pos(1, 0), Pos(3, 0));

            testToggleBlock(expectedText, {start: Pos(1, 0), end: Pos(2, 0)});

            lines = content.split("\n");
            lines.splice(3, 0, "###");
            lines.splice(5, 1);
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should block uncomment when the lines inside the block comment are line commented", function () {
            var lines = coffeeContent.split("\n");
            lines[2] = "#baz = \"hello\"";
            var expectedText = lines.join("\n");
            myEditor.setText(getContentCommented(1, 3, expectedText));
            myEditor.setSelection(Pos(3, 0), Pos(4, 0));

            testToggleBlock(expectedText, {start: Pos(2, 0), end: Pos(3, 0)});
            testToggleBlock(coffeeContent, {start: Pos(2, 0), end: Pos(3, 0)});
        });

        it("should block uncomment a second block comment", function () {
            var expectedText = getContentCommented(0, 1);
            var content = getContentCommented(6, 7, expectedText);
            myEditor.setText(content);
            myEditor.setSelection(Pos(7, 0), Pos(8, 0));

            testToggleBlock(expectedText + "\n", {start: Pos(6, 0), end: Pos(7, 0)});
            testToggleBlock(content + "\n", {start: Pos(7, 0), end: Pos(8, 0)});
        });

        it("should block uncomment with line comments in between the block comments", function () {
            var lines = coffeeContent.split("\n");
            lines[1] = "#bar = true";
            lines[2] = "#baz = \"hello\"";
            lines[3] = "#number = -42";
            var expectedText = getContentCommented(0, 1, lines.join("\n"));
            var content = getContentCommented(6, 7, expectedText);

            myEditor.setText(content);
            myEditor.setSelection(Pos(7, 0), Pos(8, 0));

            testToggleBlock(expectedText + "\n", {start: Pos(6, 0), end: Pos(7, 0)});
            testToggleBlock(content + "\n", {start: Pos(7, 0), end: Pos(8, 0)});
        });

        it("should block comment on an empty line around comments", function () {
            var lines = coffeeContent.split("\n");
            lines[2] = "###baz = \"hello\"###";
            lines[3] = "";
            lines[4] = "#number = -42";
            var text = lines.join("\n");

            lines[3] = "######";
            var expectedText = lines.join("\n");

            myEditor.setText(text);
            myEditor.setCursorPos(3, 0);

            testToggleBlock(expectedText, Pos(3, 3));
            testToggleBlock(text, Pos(3, 0));
        });

        it("should block uncomment on an empty line inside a block comment", function () {
            var lines = coffeeContent.split("\n");
            lines[1] = "###bar = true";
            lines[2] = "";
            lines[3] = "number = -42###";
            var text = lines.join("\n");

            lines = coffeeContent.split("\n");
            lines[2] = "";
            var expectedText = lines.join("\n");

            myEditor.setText(text);
            myEditor.setCursorPos(2, 0);

            testToggleBlock(expectedText, Pos(2, 0));
            
            lines = coffeeContent.split("\n");
            lines.splice(2, 0, "######");
            lines.splice(3, 1);
            expectedText = lines.join("\n");
            testToggleBlock(expectedText, Pos(2, 3));
        });

        it("should line uncomment on line comments around a block comment", function () {
            var lines = getContentCommented(1, 3).split("\n");
            lines[5] = "#number = -42";
            var text = lines.join("\n");

            lines = text.split("\n");
            lines[5] = "number = -42";
            var expectedText = lines.join("\n");

            myEditor.setText(text);
            myEditor.setSelection(Pos(5, 0), Pos(6, 0));

            testToggleBlock(expectedText, {start: Pos(5, 0), end: Pos(6, 0)});

            expectedText = getContentCommented(5, 6, expectedText);
            testToggleBlock(expectedText, {start: Pos(6, 0), end: Pos(7, 0)});
        });

        it("should line comment block commented lines", function () {
            var lines = coffeeContent.split("\n");
            lines[2] = "###baz = \"hello\"###";
            var text = lines.join("\n");

            lines = text.split("\n");
            lines[2] = "####baz = \"hello\"###";
            var expectedText = lines.join("\n");

            myEditor.setText(text);
            myEditor.setSelection(Pos(2, 0), Pos(2, 5));

            testToggleLine(expectedText, {start: Pos(2, 0), end: Pos(2, 6)});
            
            lines = text.split("\n");
            lines[2] = "#####baz = \"hello\"###";
            expectedText = lines.join("\n");
            testToggleLine(expectedText, {start: Pos(2, 0), end: Pos(2, 7)});
        });

        it("should line comment in block comment prefix or sufix starting lines (1)", function () {
            var lines = coffeeContent.split("\n");
            lines[0] = "#foo = 42";
            lines[3] = "#number = -42";
            var text = getContentCommented(1, 3, lines.join("\n"));
            myEditor.setText(text);

            lines = text.split("\n");
            lines[0] = "##foo = 42";
            lines[1] = "####";
            var expectedText = lines.join("\n");

            myEditor.setSelection(Pos(0, 0), Pos(2, 0));
            testToggleLine(expectedText, {start: Pos(0, 0), end: Pos(2, 0)});

            lines = expectedText.split("\n");
            lines[0] = "###foo = 42";
            lines[1] = "#####";
            expectedText = lines.join("\n");
            testToggleLine(expectedText, {start: Pos(0, 0), end: Pos(2, 0)});
        });

        it("should line comment in block comment prefix or sufix starting lines (2)", function () {
            var lines = coffeeContent.split("\n");
            lines[0] = "#foo = 42";
            lines[3] = "#number = -42";
            var text = getContentCommented(1, 3, lines.join("\n"));
            
            lines = text.split("\n");
            lines[0] = "##foo = 42";
            lines[1] = "####";
            var content = lines.join("\n");

            myEditor.setText(content);
            myEditor.setSelection(Pos(4, 0), Pos(6, 0));

            lines[4] = "####";
            lines[5] = "##number = -42";
            var expectedText = lines.join("\n");

            testToggleLine(expectedText, {start: Pos(4, 0), end: Pos(6, 0)});

            lines = content.split("\n");
            lines[4] = "#####";
            lines[5] = "###number = -42";
            expectedText = lines.join("\n");
            testToggleLine(expectedText, {start: Pos(4, 0), end: Pos(6, 0)});
        });
    });

});
