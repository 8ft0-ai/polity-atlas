'use client';

import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { countryFeatures } from '@/lib/countries';

type WorldMapProps = {
  selectedM49: string | null;
  relatedM49: string[];
  relationMode: boolean;
  theme: 'light' | 'dark';
  onSelect: (m49: string, name: string) => void;
};

type HighlightState = {
  selectedM49: string | null;
  relatedM49: string[];
  relationMode: boolean;
};

function applyHighlightFilters(map: MapLibreMap, state: HighlightState) {
  map.setFilter('selected-country', [
    '==',
    ['get', 'm49'],
    state.selectedM49 ?? '',
  ]);
  map.setFilter('related-countries', [
    'in',
    ['get', 'm49'],
    ['literal', state.relationMode ? state.relatedM49 : []],
  ]);
}

export function WorldMap({
  selectedM49,
  relatedM49,
  relationMode,
  theme,
  onSelect,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const highlightStateRef = useRef<HighlightState>({
    selectedM49,
    relatedM49,
    relationMode,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    void import('maplibre-gl').then(({ Map, NavigationControl }) => {
      if (cancelled || !containerRef.current) return;

      const colors = getComputedStyle(document.documentElement);
      const map = new Map({
        container: containerRef.current,
        center: [18, 8],
        zoom: 1.35,
        minZoom: 0.8,
        maxZoom: 7,
        attributionControl: false,
        renderWorldCopies: false,
        style: {
          version: 8,
          sources: {
            countries: { type: 'geojson', data: countryFeatures },
          },
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: {
                'background-color': colors
                  .getPropertyValue('--map-water')
                  .trim(),
              },
            },
            {
              id: 'countries',
              type: 'fill',
              source: 'countries',
              paint: {
                'fill-color': colors.getPropertyValue('--map-land').trim(),
                'fill-opacity': 1,
              },
            },
            {
              id: 'related-countries',
              type: 'fill',
              source: 'countries',
              filter: ['in', ['get', 'm49'], ['literal', []]],
              paint: {
                'fill-color': colors.getPropertyValue('--map-related').trim(),
                'fill-opacity': 0.72,
              },
            },
            {
              id: 'selected-country',
              type: 'fill',
              source: 'countries',
              filter: ['==', ['get', 'm49'], ''],
              paint: {
                'fill-color': colors.getPropertyValue('--map-selected').trim(),
                'fill-opacity': 0.92,
              },
            },
            {
              id: 'country-borders',
              type: 'line',
              source: 'countries',
              paint: {
                'line-color': colors.getPropertyValue('--map-border').trim(),
                'line-width': 0.65,
              },
            },
          ],
        },
      });

      map.addControl(
        new NavigationControl({ showCompass: false }),
        'bottom-left',
      );

      map.on('style.load', () => {
        map.setProjection({ type: 'globe' });
        applyHighlightFilters(map, highlightStateRef.current);
      });

      map.on('click', 'countries', (event) => {
        const selected = event.features?.[0];
        const m49 = selected?.properties?.m49;
        if (!m49) return;

        onSelect(String(m49), String(selected.properties?.name ?? 'Unknown'));
      });
      map.on('mouseenter', 'countries', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'countries', () => {
        map.getCanvas().style.cursor = '';
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [theme, onSelect]);

  useEffect(() => {
    highlightStateRef.current = {
      selectedM49,
      relatedM49,
      relationMode,
    };

    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applyHighlightFilters(map, highlightStateRef.current);
  }, [selectedM49, relatedM49, relationMode]);

  return (
    <div className="relative h-full w-full" aria-label="Interactive world map">
      <div ref={containerRef} className="h-full w-full" />
      <div className="ui-text pointer-events-none absolute bottom-3 left-12 border border-border bg-card/90 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        Boundary data: Natural Earth
      </div>
    </div>
  );
}
