import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value?.trim()) {
      return '<p>暂无应用介绍。</p>';
    }

    const lines = value.replace(/\r\n?/g, '\n').split('\n');
    const blocks: string[] = [];
    let paragraph: string[] = [];
    let listItems: string[] = [];
    let quoteLines: string[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushParagraph = () => {
      if (!paragraph.length) {
        return;
      }
      blocks.push(`<p>${this.renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    };

    const flushList = () => {
      if (!listItems.length) {
        return;
      }
      blocks.push(`<ul>${listItems.map((item) => `<li>${this.renderInline(item)}</li>`).join('')}</ul>`);
      listItems = [];
    };

    const flushQuote = () => {
      if (!quoteLines.length) {
        return;
      }
      blocks.push(`<blockquote>${quoteLines.map((item) => `<p>${this.renderInline(item)}</p>`).join('')}</blockquote>`);
      quoteLines = [];
    };

    const flushCode = () => {
      if (!codeLines.length) {
        return;
      }
      blocks.push(`<pre><code>${this.escapeHtml(codeLines.join('\n'))}</code></pre>`);
      codeLines = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      if (line.trim().startsWith('```')) {
        flushParagraph();
        flushList();
        flushQuote();
        if (inCodeBlock) {
          flushCode();
        }
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(rawLine);
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        flushQuote();
        continue;
      }

      const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        flushParagraph();
        flushList();
        flushQuote();
        const level = Math.min(heading[1].length, 4);
        blocks.push(`<h${level + 1}>${this.renderInline(heading[2])}</h${level + 1}>`);
        continue;
      }

      if (trimmed.startsWith('>')) {
        flushParagraph();
        flushList();
        quoteLines.push(trimmed.replace(/^>\s?/, ''));
        continue;
      }

      const list = trimmed.match(/^[-*]\s+(.*)$/);
      if (list) {
        flushParagraph();
        flushQuote();
        listItems.push(list[1]);
        continue;
      }

      flushList();
      flushQuote();
      paragraph.push(trimmed);
    }

    flushParagraph();
    flushList();
    flushQuote();
    if (inCodeBlock || codeLines.length) {
      flushCode();
    }

    return blocks.join('');
  }

  private renderInline(value: string): string {
    let result = this.escapeHtml(value);
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
      const safeUrl = this.sanitizeUrl(url);
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    return result;
  }

  private sanitizeUrl(value: string): string {
    const trimmed = value.trim();
    if (/^(https?:\/\/|mailto:|\/)/i.test(trimmed)) {
      return this.escapeAttribute(trimmed);
    }
    return '#';
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value);
  }
}
