import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { primaryEntityIdForM49 } from '@/lib/countries';
import { WorldMap } from './world-map';

function renderMap(
  overrides: Partial<React.ComponentProps<typeof WorldMap>> = {},
) {
  return render(
    <WorldMap
      selectedEntityId={null}
      relatedEntityIds={[]}
      relationMode={false}
      onSelect={vi.fn()}
      {...overrides}
    />,
  );
}

describe('WorldMap entity interaction', () => {
  it('selects Australia by canonical entity identity when its SVG shape is clicked', () => {
    const onSelect = vi.fn();
    const { container } = renderMap({ onSelect });

    const australiaPath = container.querySelector(
      '[data-world-copy="0"] [data-country-link][data-entity-id="state:m49:036"] path',
    );

    expect(australiaPath).not.toBeNull();
    fireEvent.click(australiaPath!);

    expect(onSelect).toHaveBeenCalledWith('state:m49:036', 'Australia', '036');
  });

  it('selects Kosovo independently from other non-M49 geometries', () => {
    const onSelect = vi.fn();
    const { container } = renderMap({ onSelect });

    const kosovoPath = container.querySelector(
      '[data-world-copy="0"] [data-country-link][data-entity-id="state:XKX"] path',
    );

    expect(kosovoPath).not.toBeNull();
    fireEvent.click(kosovoPath!);

    expect(onSelect).toHaveBeenCalledWith('state:XKX', 'Kosovo', undefined);
  });

  it('renders primary country links in adjacent world copies', () => {
    const { container } = renderMap({
      selectedEntityId: primaryEntityIdForM49('036'),
    });

    for (const copyOffset of ['-1', '0', '1']) {
      expect(
        container.querySelector(
          `[data-world-copy="${copyOffset}"] [data-country-link][data-entity-id="state:m49:036"]`,
        ),
      ).not.toBeNull();
    }
  });

  it('reports a country name through the hover callback', () => {
    const onHoverEntity = vi.fn();
    const { container } = renderMap({ onHoverEntity });

    const australia = container.querySelector(
      '[data-world-copy="0"] [data-country-link][data-entity-id="state:m49:036"]',
    );

    expect(australia).not.toBeNull();
    fireEvent.pointerEnter(australia!);

    expect(onHoverEntity).toHaveBeenCalledWith({
      entityId: 'state:m49:036',
      name: 'Australia',
      kind: 'primary-state',
    });
  });

  it('highlights Northern Cyprus separately when Cyprus is selected', () => {
    const { container } = renderMap({
      selectedEntityId: primaryEntityIdForM49('196'),
    });

    const northernCyprus = container.querySelector(
      '[data-world-copy="0"] [data-disputed-area][data-disputed-name="N. Cyprus"]',
    );

    expect(northernCyprus).not.toBeNull();
    expect(northernCyprus).toHaveAttribute(
      'fill',
      'var(--map-disputed-selected)',
    );
  });

  it('highlights Somaliland separately when Somalia is selected', () => {
    const { container } = renderMap({
      selectedEntityId: primaryEntityIdForM49('706'),
    });

    const somaliland = container.querySelector(
      '[data-world-copy="0"] [data-disputed-area][data-disputed-name="Somaliland"]',
    );

    expect(somaliland).not.toBeNull();
    expect(somaliland).toHaveAttribute('fill', 'var(--map-disputed-selected)');
  });

  it('associates Abkhazia and South Ossetia with Georgia', () => {
    const { container } = renderMap({
      selectedEntityId: primaryEntityIdForM49('268'),
    });

    for (const name of ['Abkhazia', 'South Ossetia']) {
      const area = container.querySelector(
        `[data-world-copy="0"] [data-disputed-area][data-disputed-name="${name}"]`,
      );
      expect(area).not.toBeNull();
      expect(area).toHaveAttribute('fill', 'var(--map-disputed-selected)');
    }
  });

  it('uses a separate associated colour for dependencies', () => {
    const { container } = renderMap({
      selectedEntityId: primaryEntityIdForM49('208'),
    });

    const greenland = container.querySelector(
      '[data-world-copy="0"] [data-map-entity][data-entity-id="territory:m49:304"]',
    );

    expect(greenland).not.toBeNull();
    expect(greenland).toHaveAttribute('fill', 'var(--map-dependency-selected)');
  });

  it('renders disputed boundaries with a dotted treatment', () => {
    const { container } = renderMap();

    const boundary = container.querySelector(
      '[data-world-copy="0"] [data-disputed-boundary]',
    );

    expect(boundary).not.toBeNull();
    expect(boundary).toHaveAttribute('stroke-dasharray', '3 3');
  });
});
