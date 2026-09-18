'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  primaryCountryByEntityId,
  type MapEntityKind,
} from '@/lib/countries';
import {
  mapGeometryByLod,
  nextMapLod,
  type MapLod,
} from '@/lib/map-lod';
import {
  geometryToMercatorLinePath,
  geometryToMercatorPath,
  initialMercatorY,
  MERCATOR_VIEWBOX_HEIGHT,
  MERCATOR_VIEWBOX_WIDTH,
  MERCATOR_WORLD_SIZE,
  projectMercator,
} from '@/lib/mercator';

export type MapHoverEntity = {
  entityId: string;
  name: string;
  kind: MapEntityKind;
};

type WorldMapProps = {
  selectedEntityId: string | null;
  relatedEntityIds: string[];
  relationMode: boolean;
  onSelect: (entityId: string, name: string, m49?: string) => void;
  onHoverEntity?: (entity: MapHoverEntity | null) => void;
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
};

type ShapePackage = {
  countries: Array<
    (typeof mapGeometryByLod)['110m']['countries'][number]['properties'] & {
      path: string;
    }
  >;
  disputedAreas: Array<
    (typeof mapGeometryByLod)['110m']['disputedAreas'][number] & {
      path: string;
    }
  >;
  disputedBoundaries: Array<
    (typeof mapGeometryByLod)['110m']['disputedBoundaries'][number] & {
      path: string;
    }
  >;
  tinyCountries: Array<
    (typeof mapGeometryByLod)['110m']['tinyCountries'][number] & {
      x: number;
      y: number;
    }
  >;
};

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DEFAULT_VIEWPORT: Viewport = {
  scale: 1,
  x: 0,
  y: initialMercatorY(),
};
const WORLD_COPIES = [-1, 0, 1] as const;

function createShapePackage(lod: MapLod): ShapePackage {
  const geometry = mapGeometryByLod[lod];

  return {
    countries: geometry.countries.map((country) => ({
      ...country.properties,
      path: geometryToMercatorPath(country.geometry),
    })),
    disputedAreas: geometry.disputedAreas.map((area) => ({
      ...area,
      path: geometryToMercatorPath(area.geometry),
    })),
    disputedBoundaries: geometry.disputedBoundaries.map((boundary) => ({
      ...boundary,
      path: geometryToMercatorLinePath(boundary.geometry),
    })),
    tinyCountries: geometry.tinyCountries.map((marker) => {
      const [x, y] = projectMercator(
        marker.coordinates[0] ?? 0,
        marker.coordinates[1] ?? 0,
      );
      return { ...marker, x, y };
    }),
  };
}

const shapesByLod: Record<MapLod, ShapePackage> = {
  '110m': createShapePackage('110m'),
  '50m': createShapePackage('50m'),
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function wrapHorizontalOffset(x: number, scale: number) {
  const worldWidth = MERCATOR_WORLD_SIZE * scale;
  const remainder = x % worldWidth;

  if (remainder === 0) return 0;
  return remainder > 0 ? remainder - worldWidth : remainder;
}

function clampViewport(viewport: Viewport): Viewport {
  const scaledWorldHeight = MERCATOR_WORLD_SIZE * viewport.scale;
  const minimumY = MERCATOR_VIEWBOX_HEIGHT - scaledWorldHeight;

  return {
    ...viewport,
    x: wrapHorizontalOffset(viewport.x, viewport.scale),
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

function baseFill(
  shape: ShapePackage['countries'][number],
  selectedEntityId: string | null,
  related: Set<string> | null,
) {
  if (shape.kind === 'primary-state') {
    if (shape.entityId === selectedEntityId) return 'var(--map-selected)';
    if (related?.has(shape.entityId)) return 'var(--map-related)';
    return 'var(--map-land)';
  }

  if (shape.kind === 'dependency' || shape.kind === 'overseas-territory') {
    return shape.associatedPrimaryEntityIds.includes(selectedEntityId ?? '')
      ? 'var(--map-dependency-selected)'
      : 'var(--map-dependency)';
  }

  if (shape.kind === 'disputed-territory') {
    return shape.associatedPrimaryEntityIds.includes(selectedEntityId ?? '')
      ? 'var(--map-disputed-selected)'
      : 'var(--map-disputed)';
  }

  return 'var(--map-land)';
}

function tinyCountryFill(
  entityId: string,
  selectedEntityId: string | null,
  related: Set<string> | null,
) {
  if (entityId === selectedEntityId) return 'var(--map-selected)';
  if (related?.has(entityId)) return 'var(--map-related)';
  return 'var(--map-land)';
}

export function WorldMap({
  selectedEntityId,
  relatedEntityIds,
  relationMode,
  onSelect,
  onHoverEntity,
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [activeLod, setActiveLod] = useState<MapLod>('110m');

  const related = relationMode ? new Set(relatedEntityIds) : null;
  const shapes = shapesByLod[activeLod];

  useEffect(() => {
    setActiveLod((current) => nextMapLod(current, viewport.scale));
  }, [viewport.scale]);

  function toViewBoxPoint(clientX: number, clientY: number) {
    const rectangle = svgRef.current?.getBoundingClientRect();
    if (!rectangle || rectangle.width === 0 || rectangle.height === 0) {
      return {
        x: MERCATOR_VIEWBOX_WIDTH / 2,
        y: MERCATOR_VIEWBOX_HEIGHT / 2,
      };
    }

    return {
      x:
        ((clientX - rectangle.left) / rectangle.width) * MERCATOR_VIEWBOX_WIDTH,
      y:
        ((clientY - rectangle.top) / rectangle.height) *
        MERCATOR_VIEWBOX_HEIGHT,
    };
  }

  function zoom(scaleFactor: number, clientX?: number, clientY?: number) {
    const anchor =
      clientX === undefined || clientY === undefined
        ? {
            x: MERCATOR_VIEWBOX_WIDTH / 2,
            y: MERCATOR_VIEWBOX_HEIGHT / 2,
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

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('[data-map-interactive-entity]')
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
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
      MERCATOR_VIEWBOX_WIDTH;
    const deltaY =
      ((event.clientY - drag.startY) / rectangle.height) *
      MERCATOR_VIEWBOX_HEIGHT;

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

    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function hover(entity: MapHoverEntity | null) {
    onHoverEntity?.(entity);
  }

  function selectAssociatedPrimary(entityIds: string[]) {
    if (entityIds.length !== 1) return;

    const country = primaryCountryByEntityId.get(entityIds[0]);
    if (!country) return;
    onSelect(country.entityId, country.name, country.m49);
  }

  function renderWorldCopy(copyOffset: number) {
    const translateX = copyOffset * MERCATOR_WORLD_SIZE;
    const markerRadius = 4 / viewport.scale;
    const markerHitRadius = 8 / viewport.scale;

    return (
      <g
        key={copyOffset}
        data-world-copy={copyOffset}
        data-map-lod={activeLod}
        transform={`translate(${translateX} 0)`}
      >
        <rect
          width={MERCATOR_WORLD_SIZE}
          height={MERCATOR_WORLD_SIZE}
          fill="var(--map-water)"
        />

        {shapes.countries.map((country, countryIndex) => {
          const fill = baseFill(country, selectedEntityId, related);
          const hoverEntity: MapHoverEntity = {
            entityId: country.entityId,
            name: country.name,
            kind: country.kind,
          };

          if (country.kind === 'primary-state') {
            return (
              <a
                key={`${copyOffset}:${country.entityId}:${countryIndex}`}
                href={`#country=${country.m49 ?? country.entityId}`}
                data-map-interactive-entity
                data-country-link
                data-entity-id={country.entityId}
                tabIndex={copyOffset === 0 ? undefined : -1}
                aria-label={country.name}
                aria-current={
                  selectedEntityId === country.entityId ? 'location' : undefined
                }
                onPointerEnter={() => hover(hoverEntity)}
                onPointerLeave={() => hover(null)}
                onFocus={() => hover(hoverEntity)}
                onBlur={() => hover(null)}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(country.entityId, country.name, country.m49);
                }}
              >
                <path
                  d={country.path}
                  fill={fill}
                  fillRule="evenodd"
                  stroke="var(--map-border)"
                  strokeWidth={0.65}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer focus:outline-none"
                />
              </a>
            );
          }

          return (
            <path
              key={`${copyOffset}:${country.entityId}:${countryIndex}`}
              d={country.path}
              data-map-entity
              data-entity-id={country.entityId}
              data-entity-kind={country.kind}
              aria-label={country.name}
              fill={fill}
              fillRule="evenodd"
              stroke="var(--map-border)"
              strokeWidth={0.65}
              vectorEffect="non-scaling-stroke"
              onPointerEnter={() => hover(hoverEntity)}
              onPointerLeave={() => hover(null)}
            />
          );
        })}

        {shapes.disputedAreas.map((area, areaIndex) => {
          const associated = area.associatedPrimaryEntityIds.includes(
            selectedEntityId ?? '',
          );
          const hoverEntity: MapHoverEntity = {
            entityId: area.entityId,
            name: area.name,
            kind: 'disputed-territory',
          };

          return (
            <path
              key={`${copyOffset}:${area.entityId}:${areaIndex}`}
              d={area.path}
              data-map-interactive-entity
              data-disputed-area
              data-disputed-name={area.name}
              aria-label={area.name}
              fill={
                associated
                  ? 'var(--map-disputed-selected)'
                  : 'var(--map-disputed)'
              }
              fillOpacity={0.86}
              stroke="none"
              onPointerEnter={() => hover(hoverEntity)}
              onPointerLeave={() => hover(null)}
              onClick={() =>
                selectAssociatedPrimary(area.associatedPrimaryEntityIds)
              }
            />
          );
        })}

        {shapes.disputedBoundaries.map((boundary, boundaryIndex) => (
          <path
            key={`${copyOffset}:${boundary.boundaryId}:${boundaryIndex}`}
            d={boundary.path}
            data-disputed-boundary
            data-disputed-boundary-name={boundary.name}
            fill="none"
            stroke="var(--map-disputed-boundary)"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ))}

        {shapes.tinyCountries.map((marker) => {
          const country = primaryCountryByEntityId.get(marker.entityId);
          if (!country) return null;

          const hoverEntity: MapHoverEntity = {
            entityId: marker.entityId,
            name: marker.name,
            kind: 'primary-state',
          };
          const fill = tinyCountryFill(
            marker.entityId,
            selectedEntityId,
            related,
          );

          return (
            <a
              key={`${copyOffset}:tiny:${marker.entityId}`}
              href={`#country=${marker.m49 ?? marker.entityId}`}
              data-map-interactive-entity
              data-tiny-country-marker
              data-entity-id={marker.entityId}
              tabIndex={copyOffset === 0 ? undefined : -1}
              aria-label={marker.name}
              onPointerEnter={() => hover(hoverEntity)}
              onPointerLeave={() => hover(null)}
              onFocus={() => hover(hoverEntity)}
              onBlur={() => hover(null)}
              onClick={(event) => {
                event.preventDefault();
                onSelect(country.entityId, country.name, country.m49);
              }}
            >
              <circle
                cx={marker.x}
                cy={marker.y}
                r={markerHitRadius}
                fill="transparent"
              />
              <circle
                cx={marker.x}
                cy={marker.y}
                r={markerRadius}
                fill={fill}
                stroke="var(--map-border)"
                strokeWidth={0.8}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
              />
            </a>
          );
        })}
      </g>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MERCATOR_VIEWBOX_WIDTH} ${MERCATOR_VIEWBOX_HEIGHT}`}
        className="h-full w-full touch-none select-none"
        aria-label="Interactive Mercator world map"
        data-active-lod={activeLod}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={endPointerDrag}
        onPointerLeave={() => hover(null)}
      >
        <rect
          width={MERCATOR_VIEWBOX_WIDTH}
          height={MERCATOR_VIEWBOX_HEIGHT}
          fill="var(--background)"
        />
        <g
          transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}
        >
          {WORLD_COPIES.map(renderWorldCopy)}
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
        Natural Earth · Mercator · {activeLod}
      </div>
    </div>
  );
}
