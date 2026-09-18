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

const SEMICIRCLE_CENTER_X = 100;
const SEMICIRCLE_CENTER_Y = 100;
const SEMICIRCLE_RADIUS = 76;

function semicircleArcPath(startFraction: number, endFraction: number) {
  const startAngle = Math.PI + startFraction * Math.PI;
  const endAngle = Math.PI + endFraction * Math.PI;
  const startX = SEMICIRCLE_CENTER_X + SEMICIRCLE_RADIUS * Math.cos(startAngle);
  const startY = SEMICIRCLE_CENTER_Y + SEMICIRCLE_RADIUS * Math.sin(startAngle);
  const endX = SEMICIRCLE_CENTER_X + SEMICIRCLE_RADIUS * Math.cos(endAngle);
  const endY = SEMICIRCLE_CENTER_Y + SEMICIRCLE_RADIUS * Math.sin(endAngle);

  return [
    `M ${startX.toFixed(3)} ${startY.toFixed(3)}`,
    `A ${SEMICIRCLE_RADIUS} ${SEMICIRCLE_RADIUS} 0 0 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`,
  ].join(' ');
}

function seatColor(name: string) {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `hsl(${hash % 360} 55% 48%)`;
}

function electionDateLabel(
  election: NonNullable<
    CountryProfile['parliament']['chambers'][number]['latestElection']
  >,
) {
  return election.date.to
    ? `${election.date.from} – ${election.date.to}`
    : election.date.from;
}

function SeatBar({
  chamber,
}: {
  chamber: CountryProfile['parliament']['chambers'][number];
}) {
  const election = chamber.latestElection;
  if (!election) return null;

  const rows =
    election.postElectionComposition ?? election.resultSeats ?? [];
  if (rows.length === 0) return null;

  const fullChamber = Boolean(election.postElectionComposition?.length);
  const total =
    (fullChamber
      ? election.postElectionTotalSeats
      : election.seatsAtStake) ??
    rows.reduce((sum, row) => sum + row.seats, 0);
  const label = fullChamber
    ? `${chamber.name} post-election composition`
    : `${chamber.name} latest partial election result`;

  const segments = rows.map((row, index) => {
    const seatsBefore = rows
      .slice(0, index)
      .reduce((sum, entry) => sum + entry.seats, 0);
    return {
      ...row,
      startFraction: seatsBefore / total,
      endFraction: Math.min(1, (seatsBefore + row.seats) / total),
    };
  });

  return (
    <div className="mt-3" aria-label={label}>
      <svg
        viewBox="0 0 200 116"
        className="h-32 w-full overflow-visible"
        aria-label={`${label} semicircle`}
        data-seat-semicircle={chamber.id}
      >
        <title>{`${label} semicircle`}</title>
        <path
          d={semicircleArcPath(0, 1)}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={24}
          strokeLinecap="butt"
          data-seat-arc-background
        />
        {segments
          .filter((segment) => segment.endFraction > segment.startFraction)
          .map((segment) => (
            <path
              key={segment.party}
              d={semicircleArcPath(
                segment.startFraction,
                segment.endFraction,
              )}
              fill="none"
              stroke={seatColor(segment.party)}
              strokeWidth={24}
              strokeLinecap="butt"
              data-party-segment={segment.party}
            >
              <title>{`${segment.party}: ${segment.seats} seats`}</title>
            </path>
          ))}
      </svg>

      <div className="ui-text mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {rows.map((row) => (
          <div
            key={row.party}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0"
                style={{ background: seatColor(row.party) }}
              />
              <span className="truncate">{row.shortName ?? row.party}</span>
            </span>
            <strong>{row.seats}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

type OfficeHolder = CountryProfile['government']['headOfState'][number];

type OfficeHolderCard = OfficeHolder & {
  key: string;
  roles: string[];
};

function officeHolderCards(profile: CountryProfile): OfficeHolderCard[] {
  const holders = [
    ...profile.government.headOfGovernment.map((holder) => ({
      holder,
      role: 'Head of government',
    })),
    ...profile.government.headOfState.map((holder) => ({
      holder,
      role: 'Head of state',
    })),
  ];

  const cards = new Map<string, OfficeHolderCard>();

  for (const { holder, role } of holders) {
    const key = [holder.name, holder.office, holder.since].join('|');
    const existing = cards.get(key);

    if (existing) {
      if (!existing.roles.includes(role)) {
        existing.roles.push(role);
      }
      existing.sourceIds = [
        ...new Set([...existing.sourceIds, ...holder.sourceIds]),
      ];
      continue;
    }

    cards.set(key, {
      ...holder,
      key,
      roles: [role],
    });
  }

  return [...cards.values()];
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
              A verified profile is not yet available for this country. Map
              selection still works globally.
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
                {officeHolderCards(profileQuery.data).map((holder) => (
                  <article
                    key={holder.key}
                    className="border border-border bg-background/45 p-3"
                  >
                    <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {holder.roles.join(' · ')}
                    </p>
                    <h2 className="mt-2 text-sm font-semibold">
                      {holder.name}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {holder.office} · Since {holder.since}
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
                  Next expected parliamentary elections
                </p>
                {profileQuery.data.elections.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No expected parliamentary election or renewal date is
                    currently available from IPU.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {profileQuery.data.elections.map((election) => (
                      <article key={election.id}>
                        <h2 className="text-sm font-semibold">
                          {election.title}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {election.dateLabel}
                        </p>
                        <Sources
                          ids={election.sourceIds}
                          profile={profileQuery.data}
                        />
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </TabsContent>

            <TabsContent value="parliament" className="space-y-4">
              {profileQuery.data.parliament.chambers.map((chamber) => {
                const latest = chamber.latestElection;
                const hasFullSnapshot = Boolean(
                  latest?.postElectionComposition?.length,
                );

                return (
                  <section key={chamber.id} className="border border-border p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-sm font-semibold">{chamber.name}</h2>
                      <span className="ui-text text-xs text-muted-foreground">
                        {chamber.statutorySeats} statutory seats
                      </span>
                    </div>

                    <div className="ui-text mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {chamber.termYears && (
                        <span>{chamber.termYears}-year term</span>
                      )}
                      {chamber.designationMode && (
                        <span>{chamber.designationMode}</span>
                      )}
                    </div>

                    {chamber.speakers.length > 0 && (
                      <div className="mt-4 border-t border-border pt-3">
                        <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Presiding officer
                        </p>
                        {chamber.speakers.map((speaker) => (
                          <div
                            key={`${speaker.officialTitle}-${speaker.name ?? 'vacant'}`}
                            className="mt-2"
                          >
                            <p className="text-sm font-semibold">
                              {speaker.vacant ? 'Vacant' : speaker.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {speaker.officialTitle}
                              {speaker.termStart
                                ? ` · Since ${speaker.termStart}`
                                : ''}
                            </p>
                            <Sources
                              ids={speaker.sourceIds}
                              profile={profileQuery.data}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {chamber.electoralSystem && (
                      <div className="mt-4 border-t border-border pt-3">
                        <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Electoral system
                        </p>
                        <p className="mt-2 text-sm">
                          {chamber.electoralSystem.directlyElected
                            ? [
                                chamber.electoralSystem.system,
                                chamber.electoralSystem.subsystem,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'Directly elected'
                            : chamber.designationMode ?? 'Not directly elected'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[
                            chamber.electoralSystem.minimumVotingAge !==
                            undefined
                              ? `Voting age ${chamber.electoralSystem.minimumVotingAge}`
                              : null,
                            chamber.electoralSystem.minimumEligibilityAge !==
                            undefined
                              ? `Eligibility age ${chamber.electoralSystem.minimumEligibilityAge}`
                              : null,
                            chamber.electoralSystem.compulsoryVoting
                              ? `Compulsory voting: ${chamber.electoralSystem.compulsoryVoting}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        <Sources
                          ids={chamber.electoralSystem.sourceIds}
                          profile={profileQuery.data}
                        />
                      </div>
                    )}

                    {latest && (
                      <div className="mt-4 border-t border-border pt-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            {hasFullSnapshot
                              ? 'Post-election composition'
                              : 'Latest election result'}
                          </p>
                          <span className="ui-text text-xs text-muted-foreground">
                            {electionDateLabel(latest)}
                          </span>
                        </div>
                        {latest.seatsAtStake && (
                          <p className="ui-text mt-1 text-xs text-muted-foreground">
                            {latest.seatsAtStake} of {chamber.statutorySeats}{' '}
                            statutory seats
                            {latest.scope === 'partial-renewal'
                              ? ' contested in this renewal'
                              : ' at stake'}
                          </p>
                        )}
                        <SeatBar chamber={chamber} />
                        <p className="ui-text mt-3 text-[11px] leading-5 text-muted-foreground">
                          {hasFullSnapshot
                            ? 'This shows the full chamber immediately following the most recent election or renewal reported by IPU. It is not a statement of current composition.'
                            : latest.scope === 'partial-renewal'
                              ? 'IPU provides the result for the seats contested in this partial renewal. This does not represent the full chamber or its current composition.'
                              : 'This shows the outcome reported for the most recent election. It is not a statement of current composition.'}
                        </p>
                      </div>
                    )}

                    <div className="mt-3">
                      <Sources
                        ids={chamber.sourceIds}
                        profile={profileQuery.data}
                      />
                    </div>
                  </section>
                );
              })}
            </TabsContent>

            <TabsContent value="elections" className="space-y-3">
              {profileQuery.data.elections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No expected parliamentary election or renewal date is
                  currently available from IPU.
                </p>
              ) : (
                profileQuery.data.elections.map((election) => (
                  <article
                    key={election.id}
                    className="border border-border p-4"
                  >
                    <div className="ui-text flex items-center justify-between gap-3 text-xs">
                      <span className="uppercase tracking-[0.06em] text-muted-foreground">
                        {election.eventType.replaceAll('-', ' ')}
                      </span>
                      <span>{election.dateLabel}</span>
                    </div>
                    <h2 className="mt-3 text-base font-semibold">
                      {election.title}
                    </h2>
                    {election.note && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {election.note}
                      </p>
                    )}
                    <Sources
                      ids={election.sourceIds}
                      profile={profileQuery.data}
                    />
                  </article>
                ))
              )}
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
                <article
                  key={source.id}
                  className="border-b border-border pb-4"
                >
                  <span className="ui-text block text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                    {source.kind} · {source.publisher}
                  </span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
                  >
                    {source.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {source.attribution && (
                    <p className="ui-text mt-2 text-xs text-muted-foreground">
                      {source.attribution}
                    </p>
                  )}
                  {source.termsUrl && (
                    <a
                      href={source.termsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-text mt-1 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                    >
                      Terms of use <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </article>
              ))}
            </TabsContent>
          </div>
        </Tabs>
      )}
    </aside>
  );
}
