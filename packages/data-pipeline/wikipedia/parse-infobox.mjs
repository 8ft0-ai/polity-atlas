import { JSDOM } from 'jsdom';

function cleanText(value) {
  return value
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromHref(href) {
  if (!href) return undefined;
  const match = href.match(/(?:^\.\/|\/wiki\/)([^#?]+)/);
  if (!match) return undefined;
  return decodeURIComponent(match[1].replaceAll('_', ' '));
}

function parseSeatLabel(value) {
  const text = cleanText(value).replace(/^[•*–—-]\s*/, '');
  const match = text.match(/^(.+?)\s*\(([\d,]+)\)\s*$/);
  if (!match) return undefined;
  const seats = Number(match[2].replaceAll(',', ''));
  if (!Number.isInteger(seats) || seats < 0) return undefined;
  return { label: cleanText(match[1]), seats };
}

function ownText(element) {
  const clone = element.cloneNode(true);
  for (const nested of clone.querySelectorAll('ul, ol')) nested.remove();
  return cleanText(clone.textContent ?? '');
}

function nearestGroupLabel(element, root) {
  for (
    let ancestor = element.parentElement;
    ancestor && ancestor !== root;
    ancestor = ancestor.parentElement
  ) {
    if (ancestor.tagName === 'LI') {
      const group = parseSeatLabel(ownText(ancestor));
      if (group) return group.label;
    }
  }

  let current = element;
  while (current && current !== root) {
    for (
      let sibling = current.previousElementSibling;
      sibling;
      sibling = sibling.previousElementSibling
    ) {
      if (sibling.matches('ul, ol')) continue;
      const group = parseSeatLabel(sibling.textContent ?? '');
      if (group) return group.label;
    }
    current = current.parentElement;
  }

  return undefined;
}

export function parseInfobox(html) {
  const document = new JSDOM(html).window.document;
  const infobox = document.querySelector('table.infobox');
  if (!infobox) return { rows: [], text: '' };

  const rows = [];
  for (const row of infobox.querySelectorAll(
    ':scope > tbody > tr, :scope > tr',
  )) {
    const label = cleanText(
      row.querySelector(':scope > th')?.textContent ?? '',
    );
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
      html: dataCell.innerHTML,
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

export function extractPoliticalComposition(parsed) {
  const row = parsed.rows.find((entry) =>
    /^(political groups?|political parties|party composition|composition|seats by party)$/i.test(
      entry.label,
    ),
  );
  if (!row?.html) return undefined;

  const document = new JSDOM(`<body>${row.html}</body>`).window.document;
  const root = document.body;
  const entries = [];

  const leafItems = [...root.querySelectorAll('li')].filter(
    (item) => !item.querySelector('li'),
  );
  for (const item of leafItems) {
    const result = parseSeatLabel(ownText(item));
    if (!result) continue;
    entries.push({
      party: result.label,
      seats: result.seats,
      ...(nearestGroupLabel(item, root) && {
        group: nearestGroupLabel(item, root),
      }),
    });
  }

  if (!entries.length) {
    const blocks = [...root.querySelectorAll('div, p')].filter(
      (element) => !element.querySelector('div, p, ul, ol'),
    );
    for (const block of blocks) {
      const result = parseSeatLabel(block.textContent ?? '');
      if (!result) continue;
      entries.push({ party: result.label, seats: result.seats });
    }
  }

  const unique = new Map();
  for (const entry of entries) {
    const key = `${entry.party.toLowerCase()}\u0000${entry.seats}`;
    if (!unique.has(key)) unique.set(key, entry);
  }

  return unique.size ? [...unique.values()] : undefined;
}
