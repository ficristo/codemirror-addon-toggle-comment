# CodeMirror Addon Toggle Comment

[![Build Status](https://github.com/ficristo/codemirror-addon-toggle-comment/actions/workflows/ci.yml/badge.svg)](https://github.com/ficristo/codemirror-addon-toggle-comment/actions)

[CodeMirror 5](https://codemirror.net) does come with a [comment addon](https://codemirror.net/doc/manual.html#addon_comment), but I wanted to use the same algorithm used in [Brackets](http://brackets.io/)

This addon is that: I ported the code related to commenting code from Brackets and experimented a bit, integrating features of the original one.

Used in [Quadre](https://github.com/quadre-code/quadre) editor.

## How to install

The addon is released on npm so just run

```sh
npm install codeMirror-addon-toggle-comment
```

## How to use

It defines two extensions: `cm.toggleLineComment(options?)` and `cm.toggleBlockComment(options?)`.

### Options

`indent?: boolean`

If false the comment will start at the start of the line, otherwise will try to match the indentation of the selected code.

`padding?: string`

A string that will be inserted after opening and before closing comment marker.

`commentBlankLines?: boolean`

Whether, when adding line comments, to also comment lines that contain only whitespace.

`lineComment?: string | string[]`

The strings used for commenting the code in case of line comment.

`blockCommentStart?: string`

The string used for commenting the code at the start of a block comment.

`blockCommentEnd?: string`

The string used for commenting the code at the end of a block comment.

`getMode?: (mode, pos)`

It returns an object with these properties: `lineComment`, `blockCommentStart` and `blockCommentEnd`.
When this options is used the `lineComment`, `blockCommentStart` and `blockCommentEnd` options will be ignored.

### Example:

```js
codeMirror.toggleLineComment({
    indent: true,
    padding: " "
});
```

## Differences in distributed files

- `toggle-comment-simple.js`: this relies on CodeMirror but also on [lodash 4](https://lodash.com/), so you should install yourself

- `toggle-comment.js`: this relies on CodeMirror, lodash code is already incorporated.

- `toggle-comment-simple.mjs`: this relies on CodeMirror, lodash code is already incorporated. It is experimental for direct use in a ES6 code base.
