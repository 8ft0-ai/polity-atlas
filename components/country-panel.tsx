'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { loadCountryProfile, loadSourceRegistry } from '@/lib/profile-data';
import { supportedProfiles } from '@/lib/countries';
import { type CountryTab, useWorkspaceStore } from '@/lib/workspace-store';
import type { CountryProfile, SourceRecord } from '@/packages/schemas/country';

const tabs: Array<{ value: CountryTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'parliament', label: 'Parliament' },
  { value: 'elections', label: 'Elections' },
  { value: 'relations', label: 'Relations' },
  { value: 'sources', label: 'Sources' },
];

function Sources({ ids, sources }: { ids: string[]; sources: SourceRecord[] }) {
  const resolvedSources = sources.filter((source) => ids.includes(source.id));
  return (
    <span className="ui-text ml-1 inline-flex flex-wrap gap-x-2 gap-y-1 text-xs">
      {resolvedSources.map((source) => (
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

function sourceIdsForProfile(profile: CountryProfile) {
  return new Set([
    ...profile.government.system.sourceIds,
    ...profile.government.headOfState.flatMap((holder) => holder.sourceIds),
    ...profile.government.headOfGovernment.flatMap(
      (holder) => holder.sourceIds,
    ),
    ...profile.parliament.name.sourceIds,
    ...profile.parliament.chambers.flatMap((chamber) => chamber.sourceIds),
    ...profile.parliament.chambers.flatMap((chamber) =>
      chamber.speakers.flatMap((speaker) => speaker.sourceIds),
    ),
    ...profile.parliament.chambers.flatMap(
      (chamber) => chamber.electoralSystem?.sourceIds ?? [],
    ),
    ...profile.parliament.chambers.flatMap(
      (chamber) => chamber.latestElection?.sourceIds ?? [],
    ),
    ...profile.parliament.chambers.flatMap(
      (chamber) => chamber.composition?.sourceIds ?? [],
    ),
    ...profile.nextExpectedElections.flatMap((election) => election.sourceIds),
    ...profile.relations.flatMap((relation) => relation.sourceIds),
    ...(profile.territories ?? []).flatMap((territory) => territory.sourceIds),
  ]);
}

const SEMICIRCLE_CENTER_X = 100;
const SEMICIRCLE_CENTER_Y = 100;
const SEMICIRCLE_RADIUS = 76;
const PARTY_COLORS = [
  '#b8333a',
  '#315ca8',
  '#00843d',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#be185d',
  '#4d7c0f',
  '#6b7280',
] as const;

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

function SeatBar({
  entries,
  totalSeats,
  label,
}: {
  entries: Array<{
    partyId: string;
    party: string;
    seats: number;
    group?: string;
  }>;
  totalSeats: number;
  label: string;
}) {
  const seatSegments = entries.map((group, index) => {
    const seatsBefore = entries
      .slice(0, index)
      .reduce((total, entry) => total + entry.seats, 0);
    const startFraction = seatsBefore / totalSeats;
    const endFraction = Math.min(1, startFraction + group.seats / totalSeats);

    return {
      ...group,
      color: PARTY_COLORS[index % PARTY_COLORS.length],
      startFraction,
      endFraction,
    };
  });

  return (
    <div className="mt-3" aria-label={label}>
      <svg
        viewBox="0 0 200 116"
        className="h-32 w-full overflow-visible"
        aria-label={`${label} semicircle`}
        data-seat-semicircle
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
        {seatSegments
          .filter((segment) => segment.endFraction > segment.startFraction)
          .map((segment) => (
            <path
              key={segment.partyId}
              d={semicircleArcPath(segment.startFraction, segment.endFraction)}
              fill="none"
              stroke={segment.color}
              strokeWidth={24}
              strokeLinecap="butt"
              data-party-segment={segment.partyId}
            >
              <title>{`${segment.party}: ${segment.seats} seats`}</title>
            </path>
          ))}
      </svg>

      <div className="ui-text mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {seatSegments.map((group) => (
          <div
            key={group.partyId}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0"
                style={{ background: group.color }}
              />
              <span className="min-w-0">
                <span className="block truncate">{group.party}</span>
                {group.group && (
                  <span className="block truncate text-[10px]">
                    {group.group}
                  </span>
                )}
              </span>
            </span>
            <strong>{group.seats}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDateRange(date: { from: string; to?: string }) {
  const format = (value: string) =>
    new Intl.DateTimeFormat('en', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
  return date.to && date.to !== date.from
    ? `${format(date.from)} – ${format(date.to)}`
    : format(date.from);
}

function humanize(value: string) {
  return value.replaceAll('-', ' ');
}

function ChamberComposition({
  chamber,
  sources,
}: {
  chamber: CountryProfile['parliament']['chambers'][number];
  sources: SourceRecord[];
}) {
  const composition = chamber.composition;
  if (!composition) return null;

  const publishers = [
    ...new Set(
      sources
        .filter((source) => composition.sourceIds.includes(source.id))
        .map((source) => source.publisher),
    ),
  ];
  const sourceLabel = publishers.length
    ? publishers.join(' / ')
    : 'Cited source';

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        Source-reported chamber composition
      </p>
      <p className="mt-1 text-sm font-semibold">
        {sourceLabel} party-seat breakdown
      </p>
      <SeatBar
        entries={composition.entries}
        totalSeats={chamber.totalSeats}
        label={`${chamber.name} source-reported chamber composition`}
      />
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {composition.reportedSeats} seats are represented in this source
        breakdown of {chamber.totalSeats} statutory seats. This is a
        source-reported chamber composition, not an IPU election result, and it
        may differ from the composition immediately after the latest election.
      </p>
      <div className="mt-3">
        <Sources ids={composition.sourceIds} sources={sources} />
      </div>
    </div>
  );
}

function ElectionOutcome({
  chamber,
  sources,
}: {
  chamber: CountryProfile['parliament']['chambers'][number];
  sources: SourceRecord[];
}) {
  const election = chamber.latestElection;
  const outcome = election?.outcome;
  const hasFullComposition = Boolean(
    outcome?.display === 'post-election-full-composition' &&
    outcome.postElectionComposition,
  );
  const primaryEntries = hasFullComposition
    ? outcome?.postElectionComposition
    : outcome?.seatsWonInElection;
  const primaryTotal = hasFullComposition
    ? election?.chamberSize
    : election?.seatsAtStake;
  const isPartial = election?.scope === 'partial-renewal';

  if (!election && !chamber.composition) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No recent parliamentary election or chamber-composition record is
        available from the cited sources.
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      {election ? (
        <>
          <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {hasFullComposition
              ? 'Post-election composition'
              : isPartial
                ? 'Latest partial election result'
                : 'Most recent election outcome'}
          </p>
          <p className="mt-1 text-sm font-semibold">
            {formatDateRange(election.date)}
          </p>
          {election.seatsAtStake && (
            <p className="ui-text mt-1 text-xs text-muted-foreground">
              {isPartial
                ? `${election.seatsAtStake} of ${election.chamberSize} seats contested`
                : `${election.seatsAtStake} seats contested`}
            </p>
          )}

          {primaryEntries?.length && primaryTotal ? (
            <SeatBar
              entries={primaryEntries}
              totalSeats={primaryTotal}
              label={`${chamber.name} ${
                hasFullComposition
                  ? 'post-election composition'
                  : 'contested-seat result'
              }`}
            />
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              The cited election source does not report a structured party-seat
              outcome for this record.
            </p>
          )}

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {hasFullComposition
              ? 'This is the full chamber immediately after the latest election or renewal reported by IPU. It is not necessarily the current composition.'
              : 'These figures cover only the seats decided in this election or renewal. They must not be read as the full or current chamber composition.'}
          </p>

          {hasFullComposition &&
            isPartial &&
            outcome?.seatsWonInElection.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Seats decided in this renewal
                </p>
                <div className="ui-text mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {outcome.seatsWonInElection.map((result) => (
                    <div
                      key={result.partyId}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-muted-foreground">
                        {result.party}
                      </span>
                      <strong>{result.seats}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {election.notes?.map((note) => (
            <p
              key={note}
              className="mt-3 text-xs leading-5 text-muted-foreground"
            >
              {note}
            </p>
          ))}
          <div className="mt-3">
            <Sources ids={election.sourceIds} sources={sources} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No recent parliamentary election record is available from the cited
          sources.
        </p>
      )}

      {!hasFullComposition && (
        <ChamberComposition chamber={chamber} sources={sources} />
      )}
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
  const sourceRegistryQuery = useQuery({
    queryKey: ['source-registry'],
    queryFn: loadSourceRegistry,
    enabled: Boolean(iso3),
  });
  const profileQuery = useQuery({
    queryKey: ['country-profile', iso3],
    queryFn: () => loadCountryProfile(iso3!),
    enabled: Boolean(iso3),
  });

  if (!selectedEntityId || !selectedName) return null;

  const sources = sourceRegistryQuery.data?.sources ?? [];

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
      ) : profileQuery.isPending || sourceRegistryQuery.isPending ? (
        <div className="ui-text p-6 text-sm text-muted-foreground">
          Loading verified country data and sources…
        </div>
      ) : profileQuery.isError ||
        !profileQuery.data ||
        sourceRegistryQuery.isError ||
        !sourceRegistryQuery.data ? (
        <div className="p-6 text-sm text-destructive">
          The validated profile or source registry could not be loaded.
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
                    sources={sources}
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
                    <Sources ids={holder.sourceIds} sources={sources} />
                  </article>
                ))}
              </section>
              <section className="border-t border-border pt-4">
                <p className="ui-text text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Next expected parliamentary elections
                </p>
                {profileQuery.data.nextExpectedElections.length ? (
                  <div className="mt-3 space-y-3">
                    {profileQuery.data.nextExpectedElections.map((election) => (
                      <article key={election.id}>
                        <h2 className="text-sm font-semibold">
                          {election.chamberName}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Expected {formatDateRange(election.date)} ·{' '}
                          {humanize(election.eventType)}
                        </p>
                        <Sources ids={election.sourceIds} sources={sources} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    No expected parliamentary election date is currently
                    available from IPU.
                  </p>
                )}
              </section>
            </TabsContent>

            <TabsContent value="parliament" className="space-y-4">
              {profileQuery.data.parliament.chambers.map((chamber) => (
                <section key={chamber.id} className="border border-border p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-sm font-semibold">{chamber.name}</h2>
                    <span className="ui-text text-xs text-muted-foreground">
                      {chamber.totalSeats} statutory seats
                    </span>
                  </div>
                  <ElectionOutcome chamber={chamber} sources={sources} />

                  <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                    <section>
                      <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        Speaker
                      </p>
                      {chamber.speakers.length ? (
                        <div className="mt-2 space-y-3">
                          {chamber.speakers.map((speaker, index) => (
                            <div key={speaker.personId ?? `speaker-${index}`}>
                              <p className="text-sm font-semibold">
                                {speaker.vacant
                                  ? 'Vacant'
                                  : (speaker.name ?? 'Name not reported')}
                                {speaker.acting ? ' (acting)' : ''}
                              </p>
                              {speaker.officialTitle && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {speaker.officialTitle}
                                </p>
                              )}
                              {speaker.term?.from && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  In office from {speaker.term.from}
                                </p>
                              )}
                              {speaker.designationMode && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {speaker.designationMode}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No Speaker data is currently available from the cited
                          sources.
                        </p>
                      )}
                    </section>

                    <section>
                      <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        Electoral system
                      </p>
                      {chamber.electoralSystem ? (
                        <>
                          <p className="mt-2 text-sm font-semibold">
                            {chamber.electoralSystem.systems.join(' · ') ||
                              (chamber.electoralSystem.directlyElected
                                ? 'Direct election'
                                : 'Not directly elected')}
                          </p>
                          <div className="ui-text mt-2 space-y-1 text-xs text-muted-foreground">
                            {chamber.electoralSystem.votingAge !==
                              undefined && (
                              <p>
                                Voting age: {chamber.electoralSystem.votingAge}
                              </p>
                            )}
                            {chamber.electoralSystem.eligibilityAge !==
                              undefined && (
                              <p>
                                Eligibility age:{' '}
                                {chamber.electoralSystem.eligibilityAge}
                              </p>
                            )}
                            {chamber.electoralSystem.compulsoryVoting && (
                              <p>
                                Compulsory voting:{' '}
                                {chamber.electoralSystem.compulsoryVoting}
                              </p>
                            )}
                            {chamber.electoralSystem.directlyElectedSeats !==
                              undefined && (
                              <p>
                                Directly elected:{' '}
                                {chamber.electoralSystem.directlyElectedSeats}
                              </p>
                            )}
                            {chamber.electoralSystem.appointedSeats !==
                              undefined && (
                              <p>
                                Appointed:{' '}
                                {chamber.electoralSystem.appointedSeats}
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No electoral-system data is currently available from
                          the cited sources.
                        </p>
                      )}
                    </section>
                  </div>

                  <div className="mt-4">
                    <Sources ids={chamber.sourceIds} sources={sources} />
                  </div>
                </section>
              ))}
            </TabsContent>

            <TabsContent value="elections" className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                IPU entries cover national parliamentary chambers and renewals
                only. Expected dates may be calculated from law or practice and
                are not announcements of a polling day.
              </p>
              {profileQuery.data.nextExpectedElections.length ? (
                profileQuery.data.nextExpectedElections.map((election) => (
                  <article
                    key={election.id}
                    className="border border-border p-4"
                  >
                    <div className="ui-text flex items-center justify-between gap-3 text-xs">
                      <span className="uppercase tracking-[0.06em] text-muted-foreground">
                        {election.status}
                      </span>
                      <span>{formatDateRange(election.date)}</span>
                    </div>
                    <h2 className="mt-3 text-base font-semibold">
                      {election.chamberName}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      National parliamentary {humanize(election.eventType)}
                    </p>
                    <Sources ids={election.sourceIds} sources={sources} />
                  </article>
                ))
              ) : (
                <p className="border border-border p-4 text-sm text-muted-foreground">
                  No expected parliamentary election date is currently available
                  from IPU.
                </p>
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
                  <Sources ids={relation.sourceIds} sources={sources} />
                </article>
              ))}
            </TabsContent>

            <TabsContent value="sources" className="space-y-4">
              {sources
                .filter((source) =>
                  sourceIdsForProfile(profileQuery.data).has(source.id),
                )
                .map((source) => (
                  <article
                    key={source.id}
                    className="border-b border-border pb-4"
                  >
                    <span className="ui-text flex items-center gap-2 text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                      {source.kind} · {source.publisher}
                    </span>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-2 text-sm font-semibold hover:underline"
                    >
                      {source.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {source.attribution && (
                      <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                        {source.attribution}
                      </span>
                    )}
                    {source.license && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {source.license}
                      </span>
                    )}
                    {source.termsUrl && (
                      <a
                        href={source.termsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ui-text mt-2 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                      >
                        Terms of use
                        <ExternalLink className="h-3 w-3" />
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
