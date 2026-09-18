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



  it('keeps a stationary pointer gesture as a country click', () => {
    const onSelect = vi.fn();
    const { container } = renderMap({ onSelect });
    const svg = container.querySelector('svg');
    const australiaPath = container.querySelector(
      '[data-world-copy="0"] [data-country-link][data-entity-id="state:m49:036"] path',
    );

    expect(svg).not.toBeNull();
    expect(australiaPath).not.toBeNull();

    const setPointerCapture = vi.fn();
    Object.defineProperty(svg!, 'setPointerCapture', {
      configurable: true,
      value: setPointerCapture,
    });

    fireEvent.pointerDown(australiaPath!, {
      button: 0,
      pointerId: 7,
      clientX: 400,
      clientY: 300,
    });
    fireEvent.pointerUp(australiaPath!, {
      pointerId: 7,
      clientX: 400,
      clientY: 300,
    });
    fireEvent.click(australiaPath!);

    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('state:m49:036', 'Australia', '036');
  });

  it('renders and selects Norway with the same canonical identity used by search', () => {
    const onSelect = vi.fn();
    const { container } = renderMap({ onSelect });

    const norwayPath = container.querySelector(
      '[data-world-copy="0"] [data-country-link][data-entity-id="state:m49:578"] path',
    );

    expect(norwayPath).not.toBeNull();
    fireEvent.click(norwayPath!);

    expect(onSelect).toHaveBeenCalledWith('state:m49:578', 'Norway', '578');
  });

  it('highlights Norway when the canonical search identity is selected', () => {
    const { container } = renderMap({
      selectedEntityId: 'state:m49:578',
    });

    const norwayPath = container.querySelector(
      '[data-world-copy="0"] [data-country-link][data-entity-id="state:m49:578"] path',
    );

    expect(norwayPath).not.toBeNull();
    expect(norwayPath).toHaveAttribute('fill', 'var(--map-selected)');
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
      '[data-world-copy="0"] [data-disputed-area][data-disputed-name="Northern Cyprus"]',
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

  it('switches all map layers to the detailed 50m LOD after zooming in', () => {
    const { container } = renderMap();
    const zoomIn = container.querySelector('button[aria-label="Zoom in"]');
    const svg = container.querySelector('svg[data-active-lod]');

    expect(zoomIn).not.toBeNull();
    expect(svg).toHaveAttribute('data-active-lod', '110m');

    fireEvent.click(zoomIn!);
    fireEvent.click(zoomIn!);
    fireEvent.click(zoomIn!);

    expect(svg).toHaveAttribute('data-active-lod', '50m');
    expect(
      container.querySelector('[data-world-copy="0"][data-map-lod="50m"]'),
    ).not.toBeNull();
  });

  it('pans when a drag starts on a country without selecting it', () => {
    const onSelect = vi.fn();
    const { container } = renderMap({ onSelect });
    const svg = container.querySelector('svg');
    const australiaPath = container.querySelector(
      '[data-world-copy="0"] [data-country-link][data-entity-id="state:m49:036"] path',
    );
    const transformedWorld = container.querySelector('svg > g[transform]');

    expect(svg).not.toBeNull();
    expect(australiaPath).not.toBeNull();
    expect(transformedWorld).not.toBeNull();

    vi.spyOn(svg!, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1000,
      height: 600,
      top: 0,
      right: 1000,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const before = transformedWorld!.getAttribute('transform');

    fireEvent.pointerDown(australiaPath!, {
      button: 0,
      pointerId: 1,
      clientX: 400,
      clientY: 300,
    });
    fireEvent.pointerMove(svg!, {
      pointerId: 1,
      clientX: 440,
      clientY: 320,
    });
    fireEvent.pointerUp(svg!, {
      pointerId: 1,
      clientX: 440,
      clientY: 320,
    });
    fireEvent.click(australiaPath!);

    expect(transformedWorld!.getAttribute('transform')).not.toBe(before);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
