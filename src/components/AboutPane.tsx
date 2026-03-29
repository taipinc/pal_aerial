import { useMemo } from 'react';
import aboutRaw from '../content/about.md?raw';

function mdToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      out.push(`<h${level}>${headingMatch[2]}</h${level}>`);
      continue;
    }

    if (line.trim() === '') {
      continue;
    }

    const processed = line
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
    out.push(`<p>${processed}</p>`);
  }

  return out.join('\n');
}

export default function AboutPane() {
  const html = useMemo(() => mdToHtml(aboutRaw), []);

  return (
    <div className="pane__body pane__body--about">
      <div
        className="about-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
