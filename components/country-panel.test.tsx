import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import australiaProfile from '@/public/data/countries/AUS.json';
import { useWorkspaceStore } from '@/lib/workspace-store';
import { CountryPanel } from './country-panel';
import { Providers } from './providers';

describe('CountryPanel source links', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      selectedEntityId: 'state:m49:036',
      selectedM49: '036',
      selectedName: 'Australia',
      activeTab: 'overview',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => australiaProfile,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the source title and external-link icon instead of a numeric reference', async () => {
    render(
      <Providers>
        <CountryPanel />
      </Providers>,
    );

    const link = await screen.findByRole('link', {
      name: "Source: Australia's system of government",
    });

    expect(link).toHaveTextContent("Australia's system of government");
    expect(link).not.toHaveTextContent('[1]');
    expect(link.querySelector('svg')).not.toBeNull();
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders parliament composition as thick semicircles with grouping indicators and notes', async () => {
    useWorkspaceStore.setState({ activeTab: 'parliament' });

    const { container } = render(
      <Providers>
        <CountryPanel />
      </Providers>,
    );

    await screen.findByText('House of Representatives');

    const houseSemicircle = container.querySelector(
      'svg[data-seat-semicircle="house"]',
    );
    expect(houseSemicircle).not.toBeNull();

    const houseBackground = houseSemicircle!.querySelector(
      '[data-seat-arc-background]',
    );
    expect(houseBackground).toHaveAttribute('stroke-width', '24');

    expect(
      houseSemicircle!.querySelector(
        '[data-party-segment="Liberal"]',
      ),
    ).not.toBeNull();
    expect(
      houseSemicircle!.querySelector(
        '[data-party-segment="Nationals"]',
      ),
    ).not.toBeNull();

    const coalitionIndicators = container.querySelectorAll(
      '[data-grouping-indicator="coalition"]',
    );
    expect(coalitionIndicators).toHaveLength(4);

    const coalitionNotes = container.querySelectorAll(
      '[data-grouping-note="coalition"]',
    );
    expect(coalitionNotes).toHaveLength(2);
    expect(coalitionNotes[0]).toHaveTextContent('†');
    expect(coalitionNotes[0]).toHaveTextContent('The Coalition');
    expect(coalitionNotes[0]).toHaveTextContent(
      'Liberal Party and The Nationals',
    );
  });

});
