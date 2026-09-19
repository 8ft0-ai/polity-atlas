import { JSDOM } from 'jsdom';

function cleanText(value) {
  let text = value
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.startsWith('.mw-parser-output') && text.includes('}')) {
    text = text.slice(text.lastIndexOf('}') + 1).trim();
  }

  return text;
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

function canonicalHexColor(value) {
  const raw = value?.trim();
  if (!raw) return undefined;

  const short = raw.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    return `#${short[1]
      .split('')
      .map((digit) => digit + digit)
      .join('')
      .toUpperCase()}`;
  }

  const full = raw.match(/^#([0-9a-f]{6})$/i);
  if (full) return `#${full[1].toUpperCase()}`;

  const rgb = raw.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:1(?:\.0+)?|0?\.\d+))?\s*\)$/i,
  );
  if (!rgb) return undefined;
  const channels = rgb.slice(1, 4).map(Number);
  if (channels.some((channel) => channel < 0 || channel > 255)) {
    return undefined;
  }
  return `#${channels
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function entryVisual(element) {
  const candidates = [
    element,
    ...element.querySelectorAll(
      '.legend-color, .legend-colour, .legend, [style*="background"]',
    ),
  ];
  for (const candidate of candidates) {
    const style = candidate.getAttribute?.('style') ?? '';
    const match = style.match(
      /(?:background-color|background)\s*:\s*([^;!]+)/i,
    );
    const color = canonicalHexColor(match?.[1]);
    if (color) return { color, method: 'wikipedia-entry' };
  }
  return undefined;
}

function linkedArticleTitles(element) {
  const titles = [];
  for (const link of element.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (href?.includes('#')) continue;
    const title = titleFromHref(href);
    if (title && !titles.includes(title)) titles.push(title);
  }
  return titles;
}

function linkedArticleTitle(element) {
  return linkedArticleTitles(element)[0];
}

function ownArticleTitles(element) {
  const clone = element.cloneNode(true);
  for (const nested of clone.querySelectorAll('ul, ol, dl')) nested.remove();
  return linkedArticleTitles(clone);
}

function ownText(element) {
  const clone = element.cloneNode(true);
  for (const nested of clone.querySelectorAll(
    'ul, ol, dl, style, script, link, sup.reference',
  )) {
    nested.remove();
  }
  return cleanText(clone.textContent ?? '');
}

function headingText(element) {
  const tag = element.tagName;
  if (!['B', 'STRONG', 'DIV', 'P', 'H1', 'H2', 'H3', 'H4'].includes(tag)) {
    return undefined;
  }
  const directEmphasis = element.matches('b, strong')
    ? element
    : element.querySelector(':scope > b, :scope > strong');
  const text = cleanText((directEmphasis ?? element).textContent ?? '');
  if (!text || text.length > 120) return undefined;
  const label = parseSeatLabel(text)?.label ?? text;
  return cleanText(label.replace(/\s*\([\d,]+\)\s*/g, ' '));
}

function nearestGroup(element, root) {
  for (
    let ancestor = element.parentElement;
    ancestor && ancestor !== root;
    ancestor = ancestor.parentElement
  ) {
    if (ancestor.matches('li, dd')) {
      const group = parseSeatLabel(ownText(ancestor));
      if (group) {
        const articleTitles = ownArticleTitles(ancestor);
        return {
          label: group.label,
          ...(articleTitles.length && { articleTitles }),
        };
      }
    }
  }

  let current = element;
  while (current && current !== root) {
    if (current.parentElement?.matches('ul, ol, dl')) {
      current = current.parentElement;
    }

    for (
      let sibling = current.previousElementSibling;
      sibling;
      sibling = sibling.previousElementSibling
    ) {
      if (sibling.matches('link, style, br, ul, ol, dl, li, dd')) continue;
      const label = headingText(sibling);
      if (label) {
        const articleTitles = linkedArticleTitles(sibling);
        return {
          label,
          ...(articleTitles.length && { articleTitles }),
        };
      }
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
  if (!row) return undefined;

  const text = row.text.toLowerCase();
  if (/\bupper house\b/.test(text)) return 'upper';
  if (/\blower house\b/.test(text)) return 'lower';
  if (/\bunicameral\b/.test(text)) return 'unicameral';
  return undefined;
}

function compositionRow(parsed) {
  return parsed.rows.find((entry) =>
    /(?:^|\s)political groups?$|^political parties$|^party composition$|^composition$|^seats by party$/i.test(
      entry.label,
    ),
  );
}

function compositionDimension(value) {
  const label = cleanText(value).toLowerCase();
  if (/^by\s+faction$/.test(label)) return 'faction';
  if (/^by\s+party$/.test(label)) return 'party';
  if (/^by\s+coalition$/.test(label)) return 'coalition';
  return undefined;
}

function elementDepth(element, root) {
  let depth = 0;
  for (
    let current = element;
    current && current !== root;
    current = current.parentElement
  ) {
    depth += 1;
  }
  return depth;
}

function compositionViewSections(root) {
  const candidates = [];
  for (const element of root.querySelectorAll('li, dd, div, td')) {
    if (!element.querySelector('ul, ol, dl')) continue;
    const label = ownText(element);
    const dimension = compositionDimension(label);
    if (!dimension) continue;
    candidates.push({
      element,
      dimension,
      label: `By ${dimension}`,
      depth: elementDepth(element, root),
    });
  }

  const selected = new Map();
  for (const candidate of candidates) {
    const current = selected.get(candidate.dimension);
    if (!current || candidate.depth > current.depth) {
      selected.set(candidate.dimension, candidate);
    }
  }
  return [...selected.values()].sort((left, right) =>
    left.element.compareDocumentPosition(right.element) &
    left.element.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1,
  );
}

function hasNestedSeatAggregate(item, root) {
  for (
    let ancestor = item.parentElement;
    ancestor && ancestor !== root;
    ancestor = ancestor.parentElement
  ) {
    if (ancestor.matches('li, dd') && parseSeatLabel(ownText(ancestor))) {
      return true;
    }
  }
  return false;
}

function extractCompositionEntries(root) {
  const entries = [];
  const leafItems = [...root.querySelectorAll('li, dd')].filter(
    (item) => !item.querySelector('li, dd'),
  );
  const containsNestedAggregates = leafItems.some((item) =>
    hasNestedSeatAggregate(item, root),
  );

  for (const item of leafItems) {
    const result = parseSeatLabel(ownText(item));
    if (!result) continue;
    const group = nearestGroup(item, root);
    const visual = entryVisual(item);
    const articleTitle = linkedArticleTitle(item);
    entries.push({
      party: result.label,
      seats: result.seats,
      ...(group && { group: group.label }),
      ...(group?.articleTitles && {
        groupArticleTitles: group.articleTitles,
      }),
      ...(articleTitle && { articleTitle }),
      ...(visual && { visual }),
    });
  }

  if (!entries.length) {
    const blocks = [...root.querySelectorAll('div, p')].filter(
      (element) => !element.querySelector('div, p, ul, ol, dl'),
    );
    for (const block of blocks) {
      const result = parseSeatLabel(block.textContent ?? '');
      if (!result) continue;
      const visual = entryVisual(block);
      const articleTitle = linkedArticleTitle(block);
      entries.push({
        party: result.label,
        seats: result.seats,
        ...(articleTitle && { articleTitle }),
        ...(visual && { visual }),
      });
    }
  }

  const unique = new Map();
  for (const entry of entries) {
    const key = [
      entry.party.toLowerCase(),
      entry.group?.toLowerCase() ?? '',
      entry.seats,
    ].join('\u0000');
    if (!unique.has(key)) unique.set(key, entry);
  }

  return {
    entries: [...unique.values()],
    containsNestedAggregates,
  };
}

function withoutViewHeadingGroup(entry, viewLabel) {
  if (
    !entry.group ||
    cleanText(entry.group).toLowerCase() !== cleanText(viewLabel).toLowerCase()
  ) {
    return entry;
  }
  const {
    group: _group,
    groupArticleTitles: _groupArticleTitles,
    ...rest
  } = entry;
  return rest;
}

export function extractPoliticalCompositionViews(parsed) {
  const row = compositionRow(parsed);
  if (!row?.html) return undefined;

  const document = new JSDOM(`<body>${row.html}</body>`).window.document;
  const root = document.body;
  const sections = compositionViewSections(root);

  if (sections.length) {
    const views = sections
      .map(({ element, dimension, label }) => {
        const parsedView = extractCompositionEntries(element);
        return {
          id: dimension,
          label,
          dimension,
          entries: parsedView.entries.map((entry) =>
            withoutViewHeadingGroup(entry, label),
          ),
          ...(parsedView.containsNestedAggregates && {
            containsNestedAggregates: true,
          }),
        };
      })
      .filter((view) => view.entries.length);
    return views.length ? views : undefined;
  }

  const parsedView = extractCompositionEntries(root);
  if (!parsedView.entries.length) return undefined;
  return [
    {
      id: 'composition',
      label: 'Composition',
      dimension: 'party',
      entries: parsedView.entries,
      ...(parsedView.containsNestedAggregates && {
        containsNestedAggregates: true,
      }),
    },
  ];
}

export function extractPoliticalComposition(parsed) {
  const views = extractPoliticalCompositionViews(parsed);
  if (!views?.length) return undefined;
  if (views.length === 1) return views[0].entries;
  return (
    views.find((view) => view.dimension === 'party')?.entries ??
    views[0].entries
  );
}
