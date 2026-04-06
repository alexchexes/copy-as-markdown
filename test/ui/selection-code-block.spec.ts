import { describe, expect, it } from 'vitest';
import { selectionToMarkdown } from '../../src/content-scripts/selection-to-markdown.js';
import type { Options as TurndownOptions } from 'turndown';

const baseTurndownOptions: TurndownOptions = {
  headingStyle: 'atx',
  bulletListMarker: '-',
};

const wrappedCodeBlockExpectedCode = [
  'class Example {',
  '  #privateField = 42;',
  '',
  '  #privateMethod() {',
  '    console.log(\'This is private\');',
  '  }',
  '',
  '  publicMethod() {',
  '    console.log(this.#privateField); // ✅ OK',
  '    this.#privateMethod();            // ✅ OK',
  '  }',
  '}',
  '',
  'const e = new Example();',
  'e.publicMethod();',
  '',
  '// ❌ These cause errors:',
  'console.log(e.#privateField); // SyntaxError',
  'e.#privateMethod();           // SyntaxError',
].join('\n');

const wrappedOneLinerExpectedCode = 'class Object; def method_missing(*) = self end end; p "ok".nope.this.is.fine.upcase';

async function convertSelectionToMarkdown(
  html: string,
  options?: Partial<TurndownOptions>,
  selectionSelector = 'body',
): Promise<string> {
  document.body.innerHTML = html;
  const selection = window.getSelection();
  const range = document.createRange();
  const target = document.querySelector(selectionSelector);
  if (!target) {
    throw new Error(`selection target not found: ${selectionSelector}`);
  }
  range.selectNodeContents(target);
  selection?.removeAllRanges();
  selection?.addRange(range);
  try {
    return await selectionToMarkdown(
      '/src/vendor/turndown.mjs',
      '/src/vendor/turndown-plugin-gfm.mjs',
      { ...baseTurndownOptions, ...options },
    );
  } finally {
    selection?.removeAllRanges();
    document.body.innerHTML = '';
  }
}

describe('selectionToMarkdown code block handling', () => {
  it('converts nested pre content to fenced markdown text', async () => {
    const html = await fetch('/test/fixtures/nested-pre-code-block.html').then(r => r.text());
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'fenced' });

    expect(md).toBe(
      'Here is a short example with text before and after it.\n\n'
      + '```\n'
      + 'x = 10\n\n# test\ny = 20\nprint(x + y)\n'
      + '```\n\n'
      + 'And here is some text after the code snippet',
    );
  });

  it('converts nested pre content to indented markdown text', async () => {
    const html = await fetch('/test/fixtures/nested-pre-code-block.html').then(r => r.text());
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'indented' });

    expect(md).toBe(
      'Here is a short example with text before and after it.\n\n'
      + '    x = 10\n'
      + '    \n'
      + '    # test\n'
      + '    y = 20\n'
      + '    print(x + y)\n\n'
      + 'And here is some text after the code snippet',
    );
  });

  it('converts ChatGPT wrapped one-liner code block to full fenced markdown text', async () => {
    const html = await fetch('/test/fixtures/chatgpt-code-block-one-liner.html').then(r => r.text());
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'fenced' });

    expect(md).toBe(`\`\`\`ruby\n${wrappedOneLinerExpectedCode}\n\`\`\``);
  });

  it('converts ChatGPT wrapped one-liner code block to full indented markdown text', async () => {
    const html = await fetch('/test/fixtures/chatgpt-code-block-one-liner.html').then(r => r.text());
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'indented' });

    expect(md).toBe(`    ${wrappedOneLinerExpectedCode}`);
  });

  it('converts ChatGPT wrapped code block to full fenced markdown text', async () => {
    const html = await fetch('/test/fixtures/chatgpt-code-block.html').then(r => r.text());
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'fenced' });

    expect(md).toBe(`\`\`\`js\n${wrappedCodeBlockExpectedCode}\n\`\`\``);
  });

  it('converts ChatGPT wrapped code block to full indented markdown text', async () => {
    const html = await fetch('/test/fixtures/chatgpt-code-block.html').then(r => r.text());
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'indented' });

    expect(md).toBe(`    ${wrappedCodeBlockExpectedCode.replace(/\n/g, '\n    ')}`);
  });

  it('keeps canonical pre>code conversion for fenced style', async () => {
    const html = '<pre><code class="language-js">const x = 1;\nconsole.log(x);\n</code></pre>';
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'fenced' });

    expect(md).toBe('```js\nconst x = 1;\nconsole.log(x);\n```');
  });

  it('keeps canonical pre>code conversion for indented style', async () => {
    const html = '<pre><code class="language-js">const x = 1;\nconsole.log(x);\n</code></pre>';
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'indented' });

    expect(md).toBe('    const x = 1;\n    console.log(x);');
  });

  it('uses a longer fence when code contains fence-like runs', async () => {
    const html = '<pre><code class="language-js">const fence = ["```"];\n```\ninside\n```\n</code></pre>';
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'fenced' });

    expect(md.startsWith('````js\n')).toBe(true);
    expect(md).toContain('\n```\ninside\n```\n');
    expect(md.endsWith('\n````')).toBe(true);
  });

  it('does not force mixed prose + inline code pre into a block', async () => {
    const html = '<pre>Build command:\n<code>npm run build</code>\nThen open dist/index.html</pre>';
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'fenced' });

    expect(md).toBe('Build command:\n`npm run build`\nThen open dist/index.html');
    expect(md.startsWith('```')).toBe(false);
  });

  it('does not force pre with multiple code descendants into a single block', async () => {
    const html = '<pre><div><code class="language-js">const a = 1;\n</code></div><div><code class="language-js">const b = 2;\n</code></div></pre>';
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'fenced' });

    expect(md).toContain('`const a = 1;`');
    expect(md).toContain('`const b = 2;`');
    expect(md.startsWith('```')).toBe(false);
  });

  it('does not force wrapped single-line code without language class into a block', async () => {
    const html = '<pre><div><code>npm run build</code></div></pre>';
    const md = await convertSelectionToMarkdown(html, { codeBlockStyle: 'fenced' });

    expect(md).toBe('`npm run build`');
    expect(md.startsWith('```')).toBe(false);
  });
});
