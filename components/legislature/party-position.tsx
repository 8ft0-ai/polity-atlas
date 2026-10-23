import type { PoliticalPosition } from '@/packages/schemas/party';

const points = [
  ['far-left', 'Far Left'],
  ['left', 'Left'],
  ['centre-left', 'Centre Left'],
  ['centre', 'Centre'],
  ['centre-right', 'Centre Right'],
  ['right', 'Right'],
  ['far-right', 'Far-Right'],
] as const;

export function PartyPosition({
  position,
  compact = false,
}: {
  position?: PoliticalPosition;
  compact?: boolean;
}) {
  if (!position) {
    return (
      <span className="ui-text text-xs text-muted-foreground">
        <span className={compact ? 'sr-only' : ''}>
          Wikipedia infobox position:{' '}
        </span>
        Not available
      </span>
    );
  }

  if (position.kind === 'label') {
    return (
      <span className="ui-text text-xs text-muted-foreground">
        <span className={compact ? 'sr-only' : ''}>
          Wikipedia infobox position:{' '}
        </span>
        {position.label}
      </span>
    );
  }

  const from = points.findIndex(([value]) => value === position.from);
  const to = points.findIndex(([value]) => value === position.to);
  return (
    <span
      className="inline-flex flex-col gap-1"
      aria-label={`Wikipedia infobox position: ${position.raw}`}
    >
      <span className="flex items-center gap-1" aria-hidden="true">
        {points.map(([value, label], index) => {
          const selected = index >= from && index <= to;
          return (
            <span
              key={value}
              title={label}
              className={`h-2 w-2 rounded-full border ${
                selected
                  ? 'border-foreground bg-foreground'
                  : 'border-muted-foreground/60 bg-transparent'
              }`}
              data-position-point={value}
              data-selected={selected ? 'true' : 'false'}
            />
          );
        })}
      </span>
      {!compact && (
        <span className="ui-text text-[10px] text-muted-foreground">
          {position.raw}
        </span>
      )}
    </span>
  );
}
