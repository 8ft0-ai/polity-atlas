import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import australiaProfile from '@/public/data/countries/AUS.json';
import indonesiaProfile from '@/public/data/countries/IDN.json';
import japanProfile from '@/public/data/countries/JPN.json';
import usaProfile from '@/public/data/countries/USA.json';
import { useWorkspaceStore } from '@/lib/workspace-store';
import { CountryPanel } from './country-panel';
import { Providers } from './providers';

type ProfileFixture = unknown;

function selectProfile({
  entityId,
  m49,
  name,
  profile,
}: {
  entityId: string;
  m49: string;
  name: string;
  profile: ProfileFixture;
}) {
  useWorkspaceStore.setState({
    selectedEntityId: entityId,
    selectedM49: m49,
    selectedName: name,
    activeTab: 'overview',
  });

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => profile,
    }),
  );
}

function renderPanel() {
  return render(
    <Providers>
      <CountryPanel />
    </Providers>,
  );
}

describe('CountryPanel', () => {
  beforeEach(() => {
    selectProfile({
      entityId: 'state:m49:036',
      m49: '036',
      name: 'Australia',
      profile: australiaProfile,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the source title and external-link icon instead of a numeric reference', async () => {
    renderPanel();

    const link = await screen.findByRole('link', {
      name: "Source: Australia's system of government",
    });

    expect(link).toHaveTextContent("Australia's system of government");
    expect(link).not.toHaveTextContent('[1]');
    expect(link.querySelector('svg')).not.toBeNull();
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders IPU election snapshots without calling them current composition', async () => {
    useWorkspaceStore.setState({ activeTab: 'parliament' });

    renderPanel();

    const house = await screen.findByLabelText(
      'House of Representatives post-election composition semicircle',
    );
    expect(house.querySelector('[data-seat-arc-background]')).toHaveAttribute(
      'stroke-width',
      '24',
    );
    expect(
      house.querySelector(
        '[data-party-segment="Australian Labor Party (ALP)"]',
      ),
    ).not.toBeNull();

    const senate = screen.getByLabelText(
      'Senate post-election composition semicircle',
    );
    expect(senate).toBeInTheDocument();
    expect(
      screen.getByText(/40 of 76 statutory seats contested in this renewal/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        'This shows the full chamber immediately following the most recent election or renewal reported by IPU. It is not a statement of current composition.',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('shows IPU attribution and terms in the Sources tab', async () => {
    useWorkspaceStore.setState({ activeTab: 'sources' });

    renderPanel();

    expect(
      await screen.findByText(
        'Inter-Parliamentary Union: Parline, September 2026',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Terms of use/ })).toHaveAttribute(
      'href',
      'https://www.ipu.org/terms-use',
    );
  });

  it.each([
    {
      entityId: 'state:m49:840',
      m49: '840',
      name: 'United States',
      profile: usaProfile,
      person: 'Donald Trump',
      since: '2025-01-20',
    },
    {
      entityId: 'state:m49:360',
      m49: '360',
      name: 'Indonesia',
      profile: indonesiaProfile,
      person: 'Prabowo Subianto',
      since: '2024-10-20',
    },
  ])(
    'renders a president who is both head of state and head of government once for $name',
    async ({ entityId, m49, name, profile, person, since }) => {
      selectProfile({ entityId, m49, name, profile });
      renderPanel();

      expect(await screen.findAllByText(person)).toHaveLength(1);
      expect(
        screen.getByText('Head of government · Head of state'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(`President · Since ${since}`),
      ).toBeInTheDocument();
    },
  );

  it('keeps genuinely separate head-of-state and head-of-government cards', async () => {
    selectProfile({
      entityId: 'state:m49:392',
      m49: '392',
      name: 'Japan',
      profile: japanProfile,
    });
    renderPanel();

    expect(await screen.findByText('Sanae Takaichi')).toBeInTheDocument();
    expect(screen.getByText('Naruhito')).toBeInTheDocument();
    expect(screen.getByText('Head of government')).toBeInTheDocument();
    expect(screen.getByText('Head of state')).toBeInTheDocument();
    expect(screen.queryByText('Head of government · Head of state')).toBeNull();
  });

  it('uses durable copy for countries without a validated profile', () => {
    useWorkspaceStore.setState({
      selectedEntityId: 'state:m49:578',
      selectedM49: '578',
      selectedName: 'Norway',
      activeTab: 'overview',
    });

    renderPanel();

    expect(
      screen.getByText(
        'A verified profile is not yet available for this country. Map selection still works globally.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Australia is the first validated demonstration profile/,
      ),
    ).toBeNull();
  });
});
