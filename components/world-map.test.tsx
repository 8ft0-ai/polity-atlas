import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorldMap } from './world-map';

describe('WorldMap country interaction', () => {
  it('selects a country when its SVG shape is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <WorldMap
        selectedM49={null}
        relatedM49={[]}
        relationMode={false}
        onSelect={onSelect}
      />,
    );

    const australiaPath = container.querySelector(
      '[data-world-copy="0"] [data-country-link][href="#country=036"] path',
    );

    expect(australiaPath).not.toBeNull();
    fireEvent.click(australiaPath!);

    expect(onSelect).toHaveBeenCalledWith('036', 'Australia');
  });

  it('renders country links in adjacent world copies for horizontal wrapping', () => {
    const { container } = render(
      <WorldMap
        selectedM49="036"
        relatedM49={[]}
        relationMode={false}
        onSelect={vi.fn()}
      />,
    );

    for (const copyOffset of ['-1', '0', '1']) {
      expect(
        container.querySelector(
          `[data-world-copy="${copyOffset}"] [data-country-link][href="#country=036"]`,
        ),
      ).not.toBeNull();
    }
  });
});
