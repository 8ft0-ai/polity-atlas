'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Pin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { loadCountryProfile } from '@/lib/profile-data';
import { supportedProfiles } from '@/lib/countries';
import { type CountryTab, useWorkspaceStore } from '@/lib/workspace-store';
import type { CountryProfile } from '@/packages/schemas/country';

const tabs: Array<{ value: CountryTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'parliament', label: 'Parliament' },
  { value: 'elections', label: 'Elections' },
  { value: 'relations', label: 'Relations' },
  { value: 'sources', label: 'Sources' },
];

function Sources({ ids, profile }: { ids: string[]; profile: CountryProfile }) {
  const sources = profile.sources.filter((source) => ids.includes(source.id));
  return (
    <span className="ui-text ml-1 inline-flex gap-1 text-xs">
      {sources.map((source, index) => (
        <a
          key={source.id}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
          aria-label={`Source: ${source.title}`}
        >
          [{index + 1}]
        </a>
      ))}
    </span>
  );
}

function SeatBar({
  chamber,
}: {
  chamber: CountryProfile['parliament']['chambers'][number];
}) {
  return (
    <div className="mt-3" aria-label={`${chamber.name} party composition`}>
      <div className="flex h-3 overflow-hidden rounded-[2px] border border-border bg-muted">
        {chamber.composition.map((group) => (
          <span
            key={group.shortName}
            style={{
              width: `${(group.seats / chamber.totalSeats) * 100}%`,
              background: group.color,
            }}
            title={`${group.party}: ${group.seats}`}
          />
        ))}
      </div>
      <div className="ui-text mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {chamber.composition.map((group) => (
          <div
            key={group.shortName}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0"
                style={{ background: group.color }}
              />
              <span className="truncate">{group.shortName}</span>
            </span>
            <strong>{group.seats}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CountryPanel() {
  const { selectedM49, selectedName, activeTab, setActiveTab } =
    useWorkspaceStore();
  const iso3 = supportedProfiles[selectedM49];
  const profileQuery = useQuery({
    queryKey: ['country-profile', iso3],
    queryFn: () => loadCountryProfile(iso3),
    enabled: Boolean(iso3),
  });

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-[min(500px,calc(100vw-28px))] flex-col border-l border-border bg-card max-md:top-auto max-md:h-[72vh] max-md:w-full max-md:border-l-0 max-md:border-t">
      <header className="border-b border-border px-5 pb-4 pt-4">
        <div className="ui-text mb-3 flex items-center justify-between text-xs uppercase tracking-[0.08em] text-muted-foreground">
          <span>Country briefing</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Pin country window"
              disabled
            >
              <Pin />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close country panel"
              disabled
            >
              <X />
            </Button>
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profileQuery.data?.identity.name ?? selectedName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profileQuery.data?.identity.officialName ??
            'This country is awaiting a verified profile.'}
        </p>
        {profileQuery.data && (
          <p className="ui-text mt-3 text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
            Verified {profileQuery.data.buildId} ·{' '}
            {profileQuery.data.identity.iso3}
          </p>
        )}
      </header>

      {!iso3 ? (
        <div className="flex flex-1 items-center p-6">
          <div className="border-l-2 border-primary pl-4">
            <h2 className="text-base font-semibold">Profile pipeline ready</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Map selection works globally. Australia is the first validated
              demonstration profile; additional country files can now be added
              without changing this interface.
            </p>
          </div>
        </div>
      ) : profileQuery.isPending ? (
        <div className="ui-text p-6 text-sm text-muted-foreground">
          Loading verified country data…
        </div>
      ) : profileQuery.isError || !profileQuery.data ? (
        <div className="p-6 text-sm text-destructive">
          The validated profile could not be loaded.
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as CountryTab)}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="overflow-x-auto border-b border-border px-4">
            <TabsList variant="line" className="h-11 min-w-max gap-4 p-0">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="px-0 text-xs shadow-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <TabsContent value="overview" className="space-y-6">
              <section>
                <p className="ui-text text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Government
                </p>
                <p className="mt-2 text-[15px] leading-6">
                  {profileQuery.data.government.system.value}
                  <Sources
                    ids={profileQuery.data.government.system.sourceIds}
                    profile={profileQuery.data}
                  />
                </p>
              </section>
              <section className="grid grid-cols-2 gap-3">
                {[
                  ...profileQuery.data.government.headOfGovernment,
                  ...profileQuery.data.government.headOfState,
                ].map((holder) => (
                  <article
                    key={holder.office}
                    className="border border-border bg-background/45 p-3"
                  >
                    <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {holder.office}
                    </p>
                    <h2 className="mt-2 text-sm font-semibold">
                      {holder.name}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Since {holder.since}
                    </p>
                    <Sources
                      ids={holder.sourceIds}
                      profile={profileQuery.data}
                    />
                  </article>
                ))}
              </section>
              <section className="border-t border-border pt-4">
                <p className="ui-text text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Next national election
                </p>
                <h2 className="mt-2 text-lg font-semibold">
                  {profileQuery.data.elections[0].dateLabel}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {profileQuery.data.elections[0].note}
                </p>
                <Sources
                  ids={profileQuery.data.elections[0].sourceIds}
                  profile={profileQuery.data}
                />
              </section>
            </TabsContent>

            <TabsContent value="parliament" className="space-y-4">
              {profileQuery.data.parliament.chambers.map((chamber) => (
                <section key={chamber.id} className="border border-border p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-sm font-semibold">{chamber.name}</h2>
                    <span className="ui-text text-xs text-muted-foreground">
                      {chamber.totalSeats} seats
                    </span>
                  </div>
                  <SeatBar chamber={chamber} />
                  <div className="mt-3">
                    <Sources
                      ids={chamber.sourceIds}
                      profile={profileQuery.data}
                    />
                  </div>
                </section>
              ))}
            </TabsContent>

            <TabsContent value="elections" className="space-y-3">
              {profileQuery.data.elections.map((election) => (
                <article
                  key={election.title}
                  className="border border-border p-4"
                >
                  <div className="ui-text flex items-center justify-between gap-3 text-xs">
                    <span className="uppercase tracking-[0.06em] text-muted-foreground">
                      {election.status}
                    </span>
                    <span>{election.dateLabel}</span>
                  </div>
                  <h2 className="mt-3 text-base font-semibold">
                    {election.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {election.note}
                  </p>
                  <Sources
                    ids={election.sourceIds}
                    profile={profileQuery.data}
                  />
                </article>
              ))}
            </TabsContent>

            <TabsContent value="relations" className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                Related countries are highlighted on the map while this tab is
                active.
              </p>
              {profileQuery.data.relations.map((relation) => (
                <article
                  key={relation.m49}
                  className="flex items-start justify-between gap-4 border-b border-border py-3 first:pt-0"
                >
                  <div>
                    <h2 className="text-sm font-semibold">
                      {relation.country}
                    </h2>
                    <p className="ui-text mt-1 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                      {relation.status.replaceAll('-', ' ')}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {relation.note}
                    </p>
                  </div>
                  <Sources
                    ids={relation.sourceIds}
                    profile={profileQuery.data}
                  />
                </article>
              ))}
            </TabsContent>

            <TabsContent value="sources" className="space-y-4">
              {profileQuery.data.sources.map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block border-b border-border pb-4"
                >
                  <span className="ui-text flex items-center gap-2 text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                    {source.kind} · {source.publisher}{' '}
                    <ExternalLink className="h-3 w-3" />
                  </span>
                  <span className="mt-2 block text-sm font-semibold group-hover:underline">
                    {source.title}
                  </span>
                </a>
              ))}
            </TabsContent>
          </div>
        </Tabs>
      )}
    </aside>
  );
}
