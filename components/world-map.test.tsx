import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorldMap } from './world-map';

describe('WorldMap country interaction', () => {
  it('selects a country when its SVG shape is clicked', () => {
    const onSelect = vi.fn();

    render(
      <WorldMap
        selectedM49={null}
        relatedM49={[]}
        relationMode={false}
        onSelect={onSelect}
      />,
    );

    const australiaLinks = screen.getAllByLabelText('Australia');
    fireEvent.click(australiaLinks[0]);

    expect(onSelect).toHaveBeenCalledWith('036', 'Australia');
  });

  it('keeps country links available in each horizontal world copy', () => {
    const onSelect = vi.fn();

    render(
      <WorldMap
        selectedM49="036"
        relatedM49={[]}
        relationMode={false}
        onSelect={onSelect}
      />,
    );

    expect(screen.getAllByLabelText('Australia')).toHaveLength(3);
  });
});
