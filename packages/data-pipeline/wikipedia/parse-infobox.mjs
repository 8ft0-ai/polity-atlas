import { JSDOM } from 'jsdom';

function cleanText(value) {
  return value.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
}

function titleFromHref(href) {
  if (!href) return undefined;
  const match = href.match(/(?:^\.\/|\/wiki\/)([^#?]+)/);
  if (!match) return undefined;
  return decodeURIComponent(match[1].replaceAll('_', ' '));
}

export function parseInfobox(html) {
  const document = new JSDOM(html).window.document;
  const infobox = document.querySelector('table.infobox');
  if (!infobox) return { rows: [], text: '' };

  const rows = [];
  for (const row of infobox.querySelectorAll(':scope > tbody > tr, :scope > tr')) {
    const label = cleanText(row.querySelector(':scope > th')?.textContent ?? '');
    const dataCell = row.querySelector(':scope > td');
    if (!label || !dataCell) continue;
    const links = [...dataCell.querySelectorAll('a')]
      .map((link) => ({
        text: cleanText(link.textContent ?? ''),
        title: titleFromHref(link.getAttribute('href')),
      }))
      .filter((link) => link.text && link.title);
    rows.push({
      label,
      text: cleanText(dataCell.textContent ?? ''),
      links,
    });
  }

  return { rows, text: cleanText(infobox.textContent ?? '') };
}

export function extractHouseLinks(parsed) {
  const row = parsed.rows.find((entry) => /^houses?$/i.test(entry.label));
  return row?.links ?? [];
}

export function extractSeatCount(parsed) {
  const row = parsed.rows.find((entry) =>
    /^(seats|members|membership|number of members)$/i.test(entry.label),
  );
  if (!row) return undefined;
  const match = row.text.replaceAll(',', '').match(/\b(\d{1,4})\b/);
  if (!match) return undefined;
  const seats = Number(match[1]);
  return Number.isInteger(seats) && seats > 0 ? seats : undefined;
}

export function extractExplicitChamberKind(parsed) {
  const row = parsed.rows.find((entry) =>
    /^(type|house type|chamber type)$/i.test(entry.label),
  );
  const text = `${row?.text ?? ''} ${parsed.text}`.toLowerCase();
  if (/\bupper house\b/.test(text)) return 'upper';
  if (/\blower house\b/.test(text)) return 'lower';
  if (/\bunicameral\b/.test(text)) return 'unicameral';
  return undefined;
}
