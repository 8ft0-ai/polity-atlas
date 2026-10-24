import { create } from 'zustand';

export type CountryTab =
  | 'overview'
  | 'parliament'
  | 'elections'
  | 'relations'
  | 'sources';

export type RepresentationSelection = {
  kind: 'representation';
  chamberId: string;
  partyId: string;
};

export type DetailSelection =
  | {
      kind: 'party';
      entityId: string;
      returnTo?: RepresentationSelection;
    }
  | RepresentationSelection
  | null;

type WorkspaceState = {
  selectedEntityId: string | null;
  selectedM49: string | null;
  selectedName: string | null;
  activeTab: CountryTab;
  detailSelection: DetailSelection;
  setCountry: (entityId: string, name: string, m49?: string) => void;
  clearCountry: () => void;
  setActiveTab: (tab: CountryTab) => void;
  openParty: (entityId: string) => void;
  openRepresentation: (chamberId: string, partyId: string) => void;
  clearDetail: () => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedEntityId: 'state:m49:036',
  selectedM49: '036',
  selectedName: 'Australia',
  activeTab: 'overview',
  detailSelection: null,
  setCountry: (selectedEntityId, selectedName, selectedM49) =>
    set({
      selectedEntityId,
      selectedM49: selectedM49 ?? null,
      selectedName,
      activeTab: 'overview',
      detailSelection: null,
    }),
  clearCountry: () =>
    set({
      selectedEntityId: null,
      selectedM49: null,
      selectedName: null,
      activeTab: 'overview',
      detailSelection: null,
    }),
  setActiveTab: (activeTab) => set({ activeTab, detailSelection: null }),
  openParty: (entityId) =>
    set((state) => ({
      detailSelection: {
        kind: 'party',
        entityId,
        ...(state.detailSelection?.kind === 'representation'
          ? { returnTo: state.detailSelection }
          : {}),
      },
    })),
  openRepresentation: (chamberId, partyId) =>
    set({ detailSelection: { kind: 'representation', chamberId, partyId } }),
  clearDetail: () =>
    set((state) => ({
      detailSelection:
        state.detailSelection?.kind === 'party'
          ? (state.detailSelection.returnTo ?? null)
          : null,
    })),
}));
