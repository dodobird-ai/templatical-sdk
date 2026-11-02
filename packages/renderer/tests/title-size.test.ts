import { describe, expect, it } from 'vitest';
import mjml2html from 'mjml';
import { createDefaultTemplateContent, createTitleBlock } from '@templatical/types';
import type { TitleBlock } from '@templatical/types';
import { renderBlock, RenderContext, renderToMjml } from '../src';

const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);

function title(partial: Partial<TitleBlock>): TitleBlock {
  return createTitleBlock({
    id: 't1',
    content: '<p>Hello</p>',
    level: 1,
    color: '#333333',
    textAlign: 'center',
    ...partial,
  });
}

describe('title size and title line height', () => {
  it('renders a title without its own size byte-for-byte as before', () => {
    // Recorded from v0.52.1, before titles had a size of their own. Content
    // saved then must render exactly as it did.
    expect(renderBlock(title({}), ctx)).toBe(
      '<mj-text\n  font-size="36px"\n  color="#333333"\n  align="center"\n  line-height="1.3"\n  padding="10px 10px 10px 10px" css-class="tpl-rich-text tpl-rich-text-8"\n><h1 style="margin:0;font-size:inherit;color:inherit;line-height:inherit;font-weight:700">Hello</h1></mj-text>',
    );
  });

  it("writes the title's own size over the heading level's", () => {
    const result = renderBlock(title({ fontSize: 31 }), ctx);
    expect(result).toContain('font-size="31px"');
    expect(result).not.toContain('font-size="36px"');
    // The level still decides the element, so the email keeps its outline.
    expect(result).toContain('<h1 style=');
  });

  it("writes the title's own line height", () => {
    const result = renderBlock(title({ lineHeight: 1.05 }), ctx);
    expect(result).toContain('line-height="1.05"');
    expect(result).not.toContain('line-height="1.3"');
  });

  it('falls back to the level when the stored size cannot be rendered', () => {
    const result = renderBlock(title({ level: 3, fontSize: 0 }), ctx);
    expect(result).toContain('font-size="22px"');
  });

  it('reaches the compiled HTML on the heading cell', async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [title({ fontSize: 42, lineHeight: 1.1 })];
    const mjml = await renderToMjml(content);
    const { html, errors } = await mjml2html(mjml);
    expect(errors).toEqual([]);
    expect(html).toMatch(/font-size:42px;[^"]*line-height:1\.1;/);
  });
});
