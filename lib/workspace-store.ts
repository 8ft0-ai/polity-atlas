import { create } from 'zustand';

export type CountryTab =
  | 'overview'
  | 'parliament'
  | 'elections'
  | 'relations'
  | 'sources';

type WorkspaceState = {
  selectedM49: string | null;
  selectedName: string | null;
  activeTab: CountryTab;
  setCountry: (m49: string, name: string) => void;
  clearCountry: () => void;
  setActiveTab: (tab: CountryTab) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedM49: '036',
  selectedName: 'Australia',
  activeTab: 'overview',
  setCountry: (selectedM49, selectedName) =>
    set({ selectedM49, selectedName, activeTab: 'overview' }),
  clearCountry: () =>
    set({ selectedM49: null, selectedName: null, activeTab: 'overview' }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
