'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, X } from 'lucide-react';
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
    <span className="ui-text ml-1 inline-flex flex-wrap gap-x-2 gap-y-1 text-xs">
      {sources.map((source) => (
        <a
          key={source.id}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
          aria-label={`Source: ${source.title}`}
        >
          <span>{source.title}</span>
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
        </a>
      ))}
    </span>
  );
}

const GROUPING_SYMBOLS = ['†', '‡', '§', '¶'] as const;
const SEMICIRCLE_CENTER_X = 100;
const SEMICIRCLE_CENTER_Y = 100;
const SEMICIRCLE_RADIUS = 76;

function groupingSymbol(index: number) {
  return GROUPING_SYMBOLS[index] ?? `(${index + 1})`;
}

function semicircleArcPath(startFraction: number, endFraction: number) {
  const startAngle = Math.PI + startFraction * Math.PI;
  const endAngle = Math.PI + endFraction * Math.PI;

  const startX =
    SEMICIRCLE_CENTER_X + SEMICIRCLE_RADIUS * Math.cos(startAngle);
  const startY =
    SEMICIRCLE_CENTER_Y + SEMICIRCLE_RADIUS * Math.sin(startAngle);
  const endX = SEMICIRCLE_CENTER_X + SEMICIRCLE_RADIUS * Math.cos(endAngle);
  const endY = SEMICIRCLE_CENTER_Y + SEMICIRCLE_RADIUS * Math.sin(endAngle);

  return [
    `M ${startX.toFixed(3)} ${startY.toFixed(3)}`,
    `A ${SEMICIRCLE_RADIUS} ${SEMICIRCLE_RADIUS} 0 0 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`,
  ].join(' ');
}

function formatMemberParties(memberParties: string[]) {
  if (memberParties.length <= 1) return memberParties[0] ?? '';
  if (memberParties.length === 2) {
    return `${memberParties[0]} and ${memberParties[1]}`;
  }

  return `${memberParties.slice(0, -1).join(', ')}, and ${memberParties.at(-1)}`;
}

function SeatBar({
  chamber,
}: {
  chamber: CountryProfile['parliament']['chambers'][number];
}) {
  const groupings = chamber.groupings ?? [];
  const groupingSymbolsById = new Map(
    groupings.map((grouping, index) => [
      grouping.id,
      groupingSymbol(index),
    ]),
  );
  const groupingNamesById = new Map(
    groupings.map((grouping) => [grouping.id, grouping.name]),
  );

  const seatSegments = chamber.composition.map((group, index) => {
    const seatsBefore = chamber.composition
      .slice(0, index)
      .reduce((total, entry) => total + entry.seats, 0);
    const startFraction = seatsBefore / chamber.totalSeats;
    const endFraction = Math.min(
      1,
      startFraction + group.seats / chamber.totalSeats,
    );

    return {
      ...group,
      startFraction,
      endFraction,
    };
  });

  return (
    <div className="mt-3" aria-label={`${chamber.name} party composition`}>
      <svg
        viewBox="0 0 200 116"
        className="h-32 w-full overflow-visible"
        aria-label={`${chamber.name} seating composition semicircle`}
        data-seat-semicircle={chamber.id}
      >
        <title>{`${chamber.name} seating composition semicircle`}</title>
        <path
          d={semicircleArcPath(0, 1)}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={24}
          strokeLinecap="butt"
          data-seat-arc-background
        />
        {seatSegments
          .filter((segment) => segment.endFraction > segment.startFraction)
          .map((segment) => (
            <path
              key={segment.shortName}
              d={semicircleArcPath(
                segment.startFraction,
                segment.endFraction,
              )}
              fill="none"
              stroke={segment.color}
              strokeWidth={24}
              strokeLinecap="butt"
              data-party-segment={segment.shortName}
            >
              <title>{`${segment.party}: ${segment.seats} seats`}</title>
            </path>
          ))}
      </svg>

      <div className="ui-text mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
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
              <span className="truncate">
                {group.shortName}
                {group.groupingIds?.map((groupingId) => {
                  const groupingName = groupingNamesById.get(groupingId);
                  return (
                    <sup
                      key={groupingId}
                      data-grouping-indicator={groupingId}
                      className="ml-0.5 text-[9px] font-semibold text-foreground"
                      aria-label={
                        groupingName
                          ? `Member of ${groupingName}`
                          : `Grouping ${groupingId}`
                      }
                    >
                      {groupingSymbolsById.get(groupingId) ?? '•'}
                    </sup>
                  );
                })}
              </span>
            </span>
            <strong>{group.seats}</strong>
          </div>
        ))}
      </div>

      {groupings.length > 0 && (
        <div className="ui-text mt-4 space-y-1 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">
          {groupings.map((grouping, index) => (
            <p key={grouping.id} data-grouping-note={grouping.id}>
              <span
                className="mr-1 font-semibold text-foreground"
                aria-hidden="true"
              >
                {groupingSymbol(index)}
              </span>
              <span>
                <strong className="font-semibold text-foreground/80">
                  {grouping.name}
                </strong>{' '}
                — {formatMemberParties(grouping.memberParties)}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function CountryPanel() {
  const {
    selectedEntityId,
    selectedName,
    activeTab,
    setActiveTab,
    clearCountry,
  } = useWorkspaceStore();
  const iso3 = selectedEntityId
    ? supportedProfiles[selectedEntityId]
    : undefined;
  const profileQuery = useQuery({
    queryKey: ['country-profile', iso3],
    queryFn: () => loadCountryProfile(iso3!),
    enabled: Boolean(iso3),
  });

  if (!selectedEntityId || !selectedName) return null;

  function clearSelection() {
    clearCountry();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-[min(500px,calc(100vw-28px))] flex-col border-l border-border bg-card max-md:top-auto max-md:h-[72vh] max-md:w-full max-md:border-l-0 max-md:border-t">
      <header className="border-b border-border px-5 pb-4 pt-4">
        <div className="ui-text mb-3 flex items-center justify-between text-xs uppercase tracking-[0.08em] text-muted-foreground">
          <span>Country briefing</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear country selection"
              onClick={clearSelection}
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
