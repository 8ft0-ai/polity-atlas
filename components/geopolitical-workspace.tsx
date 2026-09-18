'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers3, Moon, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CountryPanel } from '@/components/country-panel';
import { Providers } from '@/components/providers';
import { WorldMap } from '@/components/world-map';
import { countryOptions } from '@/lib/countries';
import { useWorkspaceStore } from '@/lib/workspace-store';

const australiaRelations = ['156', '360', '392', '554', '826', '840'];

function WorkspaceContent() {
  const { selectedM49, activeTab, setCountry } = useWorkspaceStore();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark');
    const frame = requestAnimationFrame(() =>
      setTheme(dark ? 'dark' : 'light'),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const m49 = window.location.hash.match(/^#country=(\d{3})$/)?.[1];
    const country = countryOptions.find((option) => option.m49 === m49);
    if (country) queueMicrotask(() => setCountry(country.m49, country.name));
  }, [setCountry]);

  const selectCountry = useCallback(
    (m49: string, name: string) => {
      setCountry(m49, name);
      window.history.replaceState(null, '', `#country=${m49}`);
    },
    [setCountry],
  );

  const matchingCountries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return countryOptions
      .filter((country) => country.name.toLowerCase().includes(normalized))
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
    selectCountry(country.m49, country.name);
    setQuery('');
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <header className="relative z-30 grid h-14 grid-cols-[auto_minmax(220px,520px)_1fr] items-center gap-5 border-b border-border bg-card px-4 max-md:h-24 max-md:grid-cols-[1fr_auto] max-md:items-start max-md:pt-3">
        <div className="ui-text flex items-center gap-3 whitespace-nowrap">
          <span className="grid h-7 w-7 place-items-center border border-primary bg-primary text-xs font-bold text-primary-foreground">
            PA
          </span>
          <div>
            <p className="text-sm font-semibold leading-none">Polity Atlas</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.11em] text-muted-foreground">
              Geopolitical research desk
            </p>
          </div>
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
                  key={country.m49}
                  type="button"
                  onClick={() => {
                    selectCountry(country.m49, country.name);
                    setQuery('');
                  }}
                  className="ui-text flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  <span>{country.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    M49 {country.m49}
                  </span>
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="ui-text flex items-center justify-end gap-3 text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
          <span className="hidden lg:inline">Dataset 17 Sep 2026</span>
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
          selectedM49={selectedM49}
          relatedM49={selectedM49 === '036' ? australiaRelations : []}
          relationMode={activeTab === 'relations'}
          onSelect={selectCountry}
        />

        <aside className="absolute left-3 top-3 z-10 w-44 border border-border bg-card/95 max-md:hidden">
          <div className="ui-text flex items-center gap-2 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em]">
            <Layers3 className="h-3.5 w-3.5" /> Map layers
          </div>
          <div className="ui-text space-y-2.5 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 bg-primary" /> Selected country
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 bg-[#aa6c35] dark:bg-[#d6a16d]" />{' '}
              Diplomatic link
            </div>
            <div className="flex items-center gap-2">
              <span className="h-px w-3 bg-muted-foreground" /> National
              boundary
            </div>
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
