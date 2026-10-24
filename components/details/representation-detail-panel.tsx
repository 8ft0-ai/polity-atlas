'use client';

import { ExternalLink } from 'lucide-react';
import { EntityDetailPanel } from '@/components/details/entity-detail-panel';
import { PartyPosition } from '@/components/legislature/party-position';
import type { RepresentationDetail } from '@/lib/representation-details';
import type { SourceRecord } from '@/packages/schemas/country';
import type { PartySummary } from '@/packages/schemas/party';

const kindNames = {
  coalition: 'Parliamentary coalition',
  'electoral-alliance': 'Electoral alliance',
  'parliamentary-group': 'Parliamentary group',
} as const;

export function RepresentationDetailPanel({
  detail,
  sources,
  parties,
  onOpenParty,
  onClose,
}: {
  detail: RepresentationDetail;
  sources: SourceRecord[];
  parties: PartySummary[];
  onOpenParty: (entityId: string, trigger: HTMLButtonElement) => void;
  onClose: () => void;
}) {
  const knownSources = sources.filter((source) =>
    detail.sourceIds.includes(source.id),
  );
  const partyDetails = new Map(parties.map((party) => [party.entityId, party]));
  return (
    <EntityDetailPanel
      eyebrow={kindNames[detail.kind]}
      title={detail.name}
      onClose={onClose}
    >
      <div className="space-y-6" data-representation-detail-panel>
        <section>
          <p className="ui-text text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Reported parliamentary composition
          </p>
          <p className="mt-2 text-sm font-semibold">{detail.chamberName}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {detail.seats}{' '}
            <span className="text-sm font-normal">reported seats</span>
          </p>
          {detail.observation && (
            <p className="mt-1 text-xs text-muted-foreground">
              {detail.observation.type === 'election'
                ? 'Election / renewal date'
                : 'Source snapshot retrieved'}{' '}
              {detail.observation.value.slice(0, 10)}
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            This is an aggregate reported by the cited parliamentary source, not
            a calculated sum of constituent party seats or a current live seat
            count.
          </p>
          {knownSources.length > 0 && (
            <ul className="mt-2 space-y-1">
              {knownSources.map((source) => (
                <li key={source.id}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                  >
                    {source.title}{' '}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold">
            Verified constituent parties
          </h3>
          {detail.members.length ? (
            <>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Membership is taken from independently reviewed evidence, which
                may refer to a different reporting date from the seat count.
              </p>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {detail.members.map((member) => {
                  const party = member.partyEntityId
                    ? partyDetails.get(member.partyEntityId)
                    : undefined;
                  return (
                    <li key={member.name} className="py-3">
                      {party ? (
                        <button
                          type="button"
                          className="text-left text-sm font-medium text-primary underline underline-offset-2 focus-visible:outline-2"
                          onClick={(event) =>
                            onOpenParty(party.entityId, event.currentTarget)
                          }
                        >
                          {member.name}
                        </button>
                      ) : (
                        <span className="text-sm">{member.name}</span>
                      )}
                      {party && (
                        <div className="mt-1">
                          <PartyPosition position={party.position} compact />
                        </div>
                      )}
                      {!party && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Individual party details not yet verified in this
                          country profile
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {detail.membershipContext && (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {detail.membershipContext}
                </p>
              )}
              <div className="mt-3 space-y-1">
                {detail.membershipEvidence.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                  >
                    {source.title}{' '}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Source-verified constituent membership is not available for this
              representation. The reported aggregate is still shown without
              assuming which individual parties or seat allocations it contains.
            </p>
          )}
        </section>

        <p className="border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">
          No group-wide political position is calculated. Each independently
          verified constituent party retains its own Wikipedia-sourced position.
        </p>
      </div>
    </EntityDetailPanel>
  );
}
