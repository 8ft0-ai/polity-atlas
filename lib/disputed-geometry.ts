import { mapGeometryByLod } from './map-lod';

export type {
  LodDisputedArea as DisputedArea,
  LodDisputedBoundary as DisputedBoundary,
} from './map-lod';

export const disputedAreaFeatures = mapGeometryByLod['50m'].disputedAreas;
export const disputedBoundaryFeatures =
  mapGeometryByLod['50m'].disputedBoundaries;
