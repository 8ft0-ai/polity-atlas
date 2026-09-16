import { create } from 'zustand';

export type CountryTab =
  | 'overview'
  | 'parliament'
  | 'elections'
  | 'relations'
  | 'sources';

type WorkspaceState = {
  selectedM49: string;
  selectedName: string;
  activeTab: CountryTab;
  setCountry: (m49: string, name: string) => void;
  setActiveTab: (tab: CountryTab) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedM49: '036',
  selectedName: 'Australia',
  activeTab: 'overview',
  setCountry: (selectedM49, selectedName) =>
    set({ selectedM49, selectedName, activeTab: 'overview' }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
