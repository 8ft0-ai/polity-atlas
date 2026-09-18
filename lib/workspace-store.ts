import { create } from 'zustand';

export type CountryTab =
  | 'overview'
  | 'parliament'
  | 'elections'
  | 'relations'
  | 'sources';

type WorkspaceState = {
  selectedEntityId: string | null;
  selectedM49: string | null;
  selectedName: string | null;
  activeTab: CountryTab;
  setCountry: (
    entityId: string,
    name: string,
    m49?: string,
  ) => void;
  clearCountry: () => void;
  setActiveTab: (tab: CountryTab) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedEntityId: 'state:m49:036',
  selectedM49: '036',
  selectedName: 'Australia',
  activeTab: 'overview',
  setCountry: (selectedEntityId, selectedName, selectedM49) =>
    set({
      selectedEntityId,
      selectedM49: selectedM49 ?? null,
      selectedName,
      activeTab: 'overview',
    }),
  clearCountry: () =>
    set({
      selectedEntityId: null,
      selectedM49: null,
      selectedName: null,
      activeTab: 'overview',
    }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
