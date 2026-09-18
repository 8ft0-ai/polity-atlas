import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkspaceStore } from './workspace-store';

describe('workspace store country selection', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      selectedM49: '036',
      selectedName: 'Australia',
      activeTab: 'overview',
    });
  });

  it('clears the selected country and resets the active tab', () => {
    useWorkspaceStore.getState().setActiveTab('relations');
    useWorkspaceStore.getState().clearCountry();

    expect(useWorkspaceStore.getState()).toMatchObject({
      selectedM49: null,
      selectedName: null,
      activeTab: 'overview',
    });
  });

  it('reopens a country selection after it has been cleared', () => {
    useWorkspaceStore.getState().clearCountry();
    useWorkspaceStore.getState().setCountry('554', 'New Zealand');

    expect(useWorkspaceStore.getState()).toMatchObject({
      selectedM49: '554',
      selectedName: 'New Zealand',
      activeTab: 'overview',
    });
  });
});
