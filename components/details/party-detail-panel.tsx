'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { EntityDetailPanel } from '@/components/details/entity-detail-panel';
import { PartyPosition } from '@/components/legislature/party-position';
import { loadPartyProfile } from '@/lib/profile-data';
import type { PartySummary } from '@/packages/schemas/party';

export function PartyDetailPanel({
  party,
  onClose,
}: {
  party: PartySummary;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ['party-profile', party.entityId],
    queryFn: () => loadPartyProfile(party.entityId),
  });

  return (
    <EntityDetailPanel
      eyebrow="Political party"
      title={party.displayName}
      onClose={onClose}
    >
      {query.isPending ? (
        <output className="ui-text text-sm text-muted-foreground">
          Loading reviewed party profile…
        </output>
      ) : query.isError || !query.data ? (
        <div role="alert" className="border-l-2 border-destructive pl-4">
          <h3 className="text-sm font-semibold">Party profile unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The reviewed party detail could not be loaded. The country briefing
            remains available when you go back.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <p className="ui-text text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Wikipedia infobox position
            </p>
            <div className="mt-2">
              <PartyPosition position={query.data.position} />
            </div>
          </section>

          {query.data.facts.length > 0 && (
            <dl className="divide-y divide-border border-y border-border">
              {query.data.facts.map((fact) => (
                <div
                  key={fact.key}
                  className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]"
                >
                  <dt className="ui-text text-xs font-medium text-muted-foreground">
                    {fact.label}
                  </dt>
                  <dd className="text-sm leading-6">
                    {fact.values.join(' · ')}
                    {fact.links?.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ui-text ml-2 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                      >
                        {link.label}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <section className="border-l-2 border-primary pl-4">
            <p className="text-sm leading-6 text-muted-foreground">
              This summary is derived from the cited English Wikipedia infobox.
            </p>
            <a
              href={query.data.identity.wikipediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Source: English Wikipedia — ${query.data.identity.wikipediaTitle}`}
              className="ui-text mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-2"
            >
              View on Wikipedia
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </section>
        </div>
      )}
    </EntityDetailPanel>
  );
}
