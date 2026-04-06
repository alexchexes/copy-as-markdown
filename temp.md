You are right to challenge the wording. “Mixed content” here means: one `<pre>` contains both plain text nodes and `<code>` nodes as siblings.

And no, this:

```html
<pre>
  Python
  <code>line 1
line 2</code>
  Something
  <code>line 3
line 4</code>
</pre>
```

would not become:

```md
Python
```
line 1
line 2
```
Something
```
line 3
line 4
```
```

under current Turndown behavior.

Why:
- Turndown only emits a fenced code block when the `PRE` itself has `firstChild.nodeName === 'CODE'` in [turndown.mjs:177](/d:/repos/copy-as-markdown/src/vendor/turndown.mjs#L177).
- If a `<code>` node has siblings, Turndown treats it as inline code, not a block, in [turndown.mjs:302](/d:/repos/copy-as-markdown/src/vendor/turndown.mjs#L302).
- That inline-code rule also flattens newlines to spaces in [turndown.mjs:310](/d:/repos/copy-as-markdown/src/vendor/turndown.mjs#L310).

So the effective output is closer to:

```md
Python
`line 1 line 2`
Something
`line 3 line 4`
```

That is what I meant by “stays mixed content”: prose plus inline-code fragments, not fenced code blocks.

So your proposed policy:

- “behave as if the detected multiline descendant were a real `<code>` inside the `<pre>`”
- “behave as if surrounding text like `Python` were outside the real `<code>`”

is actually two different policies.

The first one alone does not fix the original problem, because Turndown would still not make a fenced block when sibling text exists.

The second one requires a new rewrite rule:
- split one `<pre>` into prose siblings plus one or more canonical `<pre><code>` blocks

That is a valid approach, but it is more semantic invention than “just treat that descendant as `<code>`”.

So the real options are:

1. Strict/minimal:
- only normalize when the `<pre>` can cleanly become one canonical code block
- bail if there is extra meaningful non-interactive text like `Python`

2. Split/hoist:
- preserve `Python` as prose
- emit the detected multiline code as a separate fenced block
- more powerful, but definitely a new rule

3. Current aggressive rewrite:
- replace the whole `<pre>` with the recovered code block
- simplest way to get a fenced block, but drops adjacent text

I should have discussed that choice before implementing option 3.