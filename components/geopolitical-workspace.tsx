/* oxlint-disable nextjs/no-img-element */
/* vinext does not expose next/image; these are local static logo assets. */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers3, Moon, Search, Sun } from 'lucide-react';
import logoDark from '@/components/logos/Logo-Dark.png';
import logoLight from '@/components/logos/Logo-Light.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CountryPanel } from '@/components/country-panel';
import { Providers } from '@/components/providers';
import { type MapHoverEntity, WorldMap } from '@/components/world-map';
import {
  countryOptions,
  findPrimaryCountry,
  supportedProfiles,
} from '@/lib/countries';
import { useWorkspaceStore } from '@/lib/workspace-store';

const pilotProfileEntityIds = Object.keys(supportedProfiles);

type StaticAsset = string | { src: string };

function staticAssetUrl(asset: StaticAsset) {
  return typeof asset === 'string' ? asset : asset.src;
}

const kindLabels: Record<MapHoverEntity['kind'], string> = {
  'primary-state': 'Country',
  dependency: 'Dependency',
  'overseas-territory': 'Overseas territory',
  'disputed-territory': 'Disputed territory',
  other: 'Map area',
};

function WorkspaceContent() {
  const { selectedEntityId, activeTab, setCountry } = useWorkspaceStore();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [query, setQuery] = useState('');
  const [hoveredEntity, setHoveredEntity] = useState<MapHoverEntity | null>(
    null,
  );

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark');
    const frame = requestAnimationFrame(() =>
      setTheme(dark ? 'dark' : 'light'),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const token = window.location.hash.match(/^#country=(.+)$/)?.[1];
    if (!token) return;

    const country = findPrimaryCountry(decodeURIComponent(token));
    if (country) {
      queueMicrotask(() =>
        setCountry(country.entityId, country.name, country.m49),
      );
    }
  }, [setCountry]);

  const selectCountry = useCallback(
    (entityId: string, name: string, m49?: string) => {
      setCountry(entityId, name, m49);
      const token = m49 ?? entityId.split(':').at(-1) ?? entityId;
      window.history.replaceState(null, '', `#country=${token}`);
    },
    [setCountry],
  );

  const matchingCountries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return countryOptions
      .filter(
        (country) =>
          country.name.toLowerCase().includes(normalized) ||
          country.aliases.some((alias) =>
            alias.toLowerCase().includes(normalized),
          ),
      )
      .slice(0, 6);
  }, [query]);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    document.documentElement.style.colorScheme = next;
    localStorage.setItem('polity-atlas-theme', next);
  }

  function submitSearch(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const country = matchingCountries[0];
    if (!country) return;
    selectCountry(country.entityId, country.name, country.m49);
    setQuery('');
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <header className="relative z-30 grid h-14 grid-cols-[auto_minmax(220px,520px)_1fr] items-center gap-5 border-b border-border bg-card px-4 max-md:h-24 max-md:grid-cols-[1fr_auto] max-md:items-start max-md:pt-3">
        <div className="flex items-center whitespace-nowrap">
          <img
            src={staticAssetUrl(theme === 'dark' ? logoDark : logoLight)}
            alt="Polity Atlas"
            className="h-9 w-auto max-w-[190px] object-contain"
          />
        </div>

        <form
          className="relative max-md:absolute max-md:inset-x-3 max-md:top-14"
          onSubmit={submitSearch}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search countries"
            aria-label="Search countries"
            className="h-8 rounded-[3px] bg-background pl-9"
          />
          {matchingCountries.length > 0 && (
            <div className="absolute inset-x-0 top-9 z-40 border border-border bg-popover p-1">
              {matchingCountries.map((country) => (
                <button
                  key={country.entityId}
                  type="button"
                  onClick={() => {
                    selectCountry(country.entityId, country.name, country.m49);
                    setQuery('');
                  }}
                  className="ui-text flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  <span>{country.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {country.m49
                      ? `M49 ${country.m49}`
                      : country.entityId.split(':').at(-1)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="ui-text flex items-center justify-end gap-3 text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
          <span className="hidden lg:inline">Dataset 18 Sep 2026</span>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon /> : <Sun />}
          </Button>
        </div>
      </header>

      <div className="relative h-[calc(100%-3.5rem)] max-md:h-[calc(100%-6rem)]">
        <WorldMap
          selectedEntityId={selectedEntityId}
          relatedEntityIds={
            selectedEntityId && supportedProfiles[selectedEntityId]
              ? pilotProfileEntityIds.filter(
                  (entityId) => entityId !== selectedEntityId,
                )
              : []
          }
          relationMode={activeTab === 'relations'}
          onSelect={selectCountry}
          onHoverEntity={setHoveredEntity}
        />

        <aside className="absolute left-3 top-3 z-10 w-52 border border-border bg-card/95 max-md:hidden">
          <div className="ui-text flex items-center gap-2 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em]">
            <Layers3 className="h-3.5 w-3.5" /> Map layers
          </div>
          <div className="ui-text space-y-2.5 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5"
                style={{ background: 'var(--map-selected)' }}
              />{' '}
              Selected country
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5"
                style={{ background: 'var(--map-related)' }}
              />{' '}
              Diplomatic link
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5"
                style={{ background: 'var(--map-dependency)' }}
              />{' '}
              Dependency / overseas territory
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5"
                style={{ background: 'var(--map-disputed)' }}
              />{' '}
              Disputed territory
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 border-t border-dashed"
                style={{ borderColor: 'var(--map-disputed-boundary)' }}
              />{' '}
              Disputed boundary
            </div>
            <div className="flex items-center gap-2">
              <span className="h-px w-3 bg-muted-foreground" /> National
              boundary
            </div>
          </div>

          <div className="ui-text min-h-16 border-t border-border px-3 py-2 text-xs">
            <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
              Hover
            </p>
            {hoveredEntity ? (
              <>
                <p className="mt-1 font-semibold text-card-foreground">
                  {hoveredEntity.name}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {kindLabels[hoveredEntity.kind]}
                </p>
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">Move over the map</p>
            )}
          </div>
        </aside>

        <CountryPanel />
      </div>
      <output aria-live="polite" className="sr-only">
        Selected country updated
      </output>
    </main>
  );
}

export function GeopoliticalWorkspace() {
  return (
    <Providers>
      <WorkspaceContent />
    </Providers>
  );
}
