import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkspaceStore } from './workspace-store';

describe('workspace store country selection', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      selectedEntityId: 'state:m49:036',
      selectedM49: '036',
      selectedName: 'Australia',
      activeTab: 'overview',
      detailSelection: null,
    });
  });

  it('clears the selected country and resets the active tab', () => {
    useWorkspaceStore.getState().setActiveTab('relations');
    useWorkspaceStore.getState().clearCountry();

    expect(useWorkspaceStore.getState()).toMatchObject({
      selectedEntityId: null,
      selectedM49: null,
      selectedName: null,
      activeTab: 'overview',
    });
  });

  it('reopens a country selection after it has been cleared', () => {
    useWorkspaceStore.getState().clearCountry();
    useWorkspaceStore
      .getState()
      .setCountry('state:m49:554', 'New Zealand', '554');

    expect(useWorkspaceStore.getState()).toMatchObject({
      selectedEntityId: 'state:m49:554',
      selectedM49: '554',
      selectedName: 'New Zealand',
      activeTab: 'overview',
    });
  });

  it('supports a primary entity without an M49 code', () => {
    useWorkspaceStore.getState().setCountry('state:XKX', 'Kosovo');

    expect(useWorkspaceStore.getState()).toMatchObject({
      selectedEntityId: 'state:XKX',
      selectedM49: null,
      selectedName: 'Kosovo',
    });
  });

  it('opens and clears a reusable party detail selection', () => {
    useWorkspaceStore.getState().openParty('party:wikipedia:216082');
    expect(useWorkspaceStore.getState().detailSelection).toEqual({
      kind: 'party',
      entityId: 'party:wikipedia:216082',
    });

    useWorkspaceStore.getState().clearDetail();
    expect(useWorkspaceStore.getState().detailSelection).toBeNull();
  });

  it('returns from a constituent party to its source-backed representation', () => {
    const store = useWorkspaceStore.getState();
    store.openRepresentation('FR-LC01', 'fr-new-popular-front-(nfp)-ug');
    expect(useWorkspaceStore.getState().detailSelection).toEqual({
      kind: 'representation',
      chamberId: 'FR-LC01',
      partyId: 'fr-new-popular-front-(nfp)-ug',
    });

    useWorkspaceStore.getState().openParty('party:wikipedia:39565408');
    expect(useWorkspaceStore.getState().detailSelection).toMatchObject({
      kind: 'party',
      entityId: 'party:wikipedia:39565408',
      returnTo: {
        kind: 'representation',
        chamberId: 'FR-LC01',
        partyId: 'fr-new-popular-front-(nfp)-ug',
      },
    });

    useWorkspaceStore.getState().clearDetail();
    expect(useWorkspaceStore.getState().detailSelection?.kind).toBe(
      'representation',
    );
    useWorkspaceStore.getState().clearDetail();
    expect(useWorkspaceStore.getState().detailSelection).toBeNull();
  });

  it('drops representation context on tab or country changes', () => {
    useWorkspaceStore
      .getState()
      .openRepresentation('AU-LC01', 'au-liberal_national_coalition');
    useWorkspaceStore.getState().setActiveTab('sources');
    expect(useWorkspaceStore.getState().detailSelection).toBeNull();

    useWorkspaceStore
      .getState()
      .openRepresentation('AU-LC01', 'au-liberal_national_coalition');
    useWorkspaceStore.getState().setCountry('state:m49:250', 'France', '250');
    expect(useWorkspaceStore.getState().detailSelection).toBeNull();
  });

  it('clears nested detail when the country or tab changes', () => {
    useWorkspaceStore.getState().openParty('party:wikipedia:216082');
    useWorkspaceStore.getState().setActiveTab('sources');
    expect(useWorkspaceStore.getState().detailSelection).toBeNull();

    useWorkspaceStore.getState().openParty('party:wikipedia:216082');
    useWorkspaceStore
      .getState()
      .setCountry('state:m49:554', 'New Zealand', '554');
    expect(useWorkspaceStore.getState().detailSelection).toBeNull();
  });
});
