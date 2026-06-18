/**
 * Convert result_json from the generator into HTML for the TipTap editor.
 * The JSON structure is flexible — we render each top-level key as a section.
 */
export function quoteJsonToHtml(json: Record<string, unknown> | null | undefined): string {
  if (!json) return '<p>No content generated.</p>';

  const parts: string[] = [];

  for (const [key, value] of Object.entries(json)) {
    const heading = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    parts.push(`<h2>${heading}</h2>`);
    parts.push(renderValue(value));
  }

  return parts.join('\n');
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '<p>—</p>';

  if (typeof value === 'string') return `<p>${escHtml(value)}</p>`;
  if (typeof value === 'number' || typeof value === 'boolean') return `<p>${value}</p>`;

  if (Array.isArray(value)) {
    if (value.length === 0) return '<p>—</p>';
    const items = value.map((item) => {
      if (typeof item === 'object' && item !== null) {
        return `<li>${Object.entries(item as Record<string, unknown>)
          .map(([k, v]) => `<strong>${escHtml(k)}:</strong> ${escHtml(String(v ?? '—'))}`)
          .join(' &nbsp;|&nbsp; ')}</li>`;
      }
      return `<li>${escHtml(String(item))}</li>`;
    });
    return `<ul>${items.join('')}</ul>`;
  }

  if (typeof value === 'object') {
    const rows = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) =>
        `<tr><td><strong>${escHtml(k)}</strong></td><td>${escHtml(String(v ?? '—'))}</td></tr>`
    );
    if (rows.length === 0) return '<p>—</p>';
    return `<table><tbody>${rows.join('')}</tbody></table>`;
  }

  return `<p>${escHtml(String(value))}</p>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
