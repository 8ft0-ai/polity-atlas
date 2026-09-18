'use client';

import { useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { countryFeatures } from '@/lib/countries';
import {
  geometryToRobinsonPath,
  ROBINSON_SPHERE_PATH,
  ROBINSON_VIEWBOX_HEIGHT,
  ROBINSON_VIEWBOX_WIDTH,
} from '@/lib/robinson';

type WorldMapProps = {
  selectedM49: string | null;
  relatedM49: string[];
  relationMode: boolean;
  onSelect: (m49: string, name: string) => void;
};

type Viewport = {
  scale: number;
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DEFAULT_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };

const countryShapes = countryFeatures.features.map((country) => ({
  m49: country.properties.m49,
  name: country.properties.name ?? 'Unknown',
  path: geometryToRobinsonPath(country.geometry),
}));

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampViewport(viewport: Viewport): Viewport {
  const minimumX = ROBINSON_VIEWBOX_WIDTH * (1 - viewport.scale);
  const minimumY = ROBINSON_VIEWBOX_HEIGHT * (1 - viewport.scale);

  return {
    ...viewport,
    x: clamp(viewport.x, minimumX, 0),
    y: clamp(viewport.y, minimumY, 0),
  };
}

function zoomViewport(
  viewport: Viewport,
  scaleFactor: number,
  anchorX: number,
  anchorY: number,
): Viewport {
  const scaled = viewport.scale * scaleFactor;
  const nextScale = clamp(scaled, MIN_SCALE, MAX_SCALE);
  if (nextScale === viewport.scale) return viewport;

  const ratio = nextScale / viewport.scale;
  return clampViewport({
    scale: nextScale,
    x: anchorX - (anchorX - viewport.x) * ratio,
    y: anchorY - (anchorY - viewport.y) * ratio,
  });
}

export function WorldMap({
  selectedM49,
  relatedM49,
  relationMode,
  onSelect,
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);

  const related = relationMode ? new Set(relatedM49) : null;

  function toViewBoxPoint(clientX: number, clientY: number) {
    const rectangle = svgRef.current?.getBoundingClientRect();
    if (!rectangle || rectangle.width === 0 || rectangle.height === 0) {
      return {
        x: ROBINSON_VIEWBOX_WIDTH / 2,
        y: ROBINSON_VIEWBOX_HEIGHT / 2,
      };
    }

    return {
      x:
        ((clientX - rectangle.left) / rectangle.width) *
        ROBINSON_VIEWBOX_WIDTH,
      y:
        ((clientY - rectangle.top) / rectangle.height) *
        ROBINSON_VIEWBOX_HEIGHT,
    };
  }

  function zoom(scaleFactor: number, clientX?: number, clientY?: number) {
    const anchor =
      clientX === undefined || clientY === undefined
        ? {
            x: ROBINSON_VIEWBOX_WIDTH / 2,
            y: ROBINSON_VIEWBOX_HEIGHT / 2,
          }
        : toViewBoxPoint(clientX, clientY);

    setViewport((current) =>
      zoomViewport(current, scaleFactor, anchor.x, anchor.y),
    );
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
    zoom(factor, event.clientX, event.clientY);
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
      moved: false,
    };
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const rectangle = svgRef.current?.getBoundingClientRect();
    if (
      !drag ||
      drag.pointerId !== event.pointerId ||
      !rectangle ||
      rectangle.width === 0 ||
      rectangle.height === 0
    ) {
      return;
    }

    const deltaX =
      ((event.clientX - drag.startX) / rectangle.width) *
      ROBINSON_VIEWBOX_WIDTH;
    const deltaY =
      ((event.clientY - drag.startY) / rectangle.height) *
      ROBINSON_VIEWBOX_HEIGHT;

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      drag.moved = true;
    }

    setViewport((current) =>
      clampViewport({
        ...current,
        x: drag.originX + deltaX,
        y: drag.originY + deltaY,
      }),
    );
  }

  function endPointerDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    suppressClickRef.current = drag.moved;
    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function selectCountry(m49: string, name: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    onSelect(m49, name);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ROBINSON_VIEWBOX_WIDTH} ${ROBINSON_VIEWBOX_HEIGHT}`}
        className="h-full w-full touch-none select-none"
        aria-label="Interactive Robinson projection world map"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={endPointerDrag}
      >
        <rect
          width={ROBINSON_VIEWBOX_WIDTH}
          height={ROBINSON_VIEWBOX_HEIGHT}
          fill="var(--background)"
        />
        <g
          transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}
        >
          <path
            d={ROBINSON_SPHERE_PATH}
            fill="var(--map-water)"
            stroke="var(--map-border)"
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
          {countryShapes.map((country) => {
            const selected = selectedM49 === country.m49;
            const relatedCountry = Boolean(related?.has(country.m49));
            let fill = 'var(--map-land)';
            if (relatedCountry) fill = 'var(--map-related)';
            if (selected) fill = 'var(--map-selected)';

            return (
              <a
                key={country.m49}
                href={`#country=${country.m49}`}
                aria-label={country.name}
                aria-current={selected ? 'location' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  selectCountry(country.m49, country.name);
                }}
              >
                <path
                  d={country.path}
                  data-m49={country.m49}
                  fill={fill}
                  fillRule="evenodd"
                  stroke="var(--map-border)"
                  strokeWidth={0.65}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer focus:outline-none"
                />
              </a>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-3 left-3 z-10 flex flex-col overflow-hidden border border-border bg-card">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => zoom(1.25)}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => zoom(1 / 1.25)}
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Reset world view"
          onClick={() => setViewport(DEFAULT_VIEWPORT)}
        >
          <RotateCcw />
        </Button>
      </div>

      <div className="ui-text pointer-events-none absolute bottom-3 left-14 border border-border bg-card/90 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        Boundary data: Natural Earth · Robinson projection
      </div>
    </div>
  );
}
