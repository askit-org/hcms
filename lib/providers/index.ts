// lib/providers/index.ts
// Provider Factory - This is where we switch between Local DB and API Backend

import { create } from 'zustand';
import { LocalDataProvider } from './local';
import { ApiDataProvider } from './api';
import type { DataProvider } from './types';

// A simple Zustand store to manage the active provider so we can switch it on the fly
interface ProviderState {
  isOfflineMode: boolean;
  provider: DataProvider;
  setOfflineMode: (offline: boolean) => void;
}

export const useProviderStore = create<ProviderState>((set) => ({
  // Default to API backend mode
  isOfflineMode: false,
  provider: ApiDataProvider,
  
  // Call this to toggle seamlessly between the API and the local DB
  setOfflineMode: (offline) => set({
    isOfflineMode: offline,
    provider: offline ? LocalDataProvider : ApiDataProvider
  })
}));

// Export a helper hook to get just the provider instance
export const useProvider = () => useProviderStore(s => s.provider);

// You can still import this directly if you need to use it outside of React (e.g. in regular TS functions)
// But using the useProvider hook is preferred inside components so they react to mode changes.
export const getProvider = () => useProviderStore.getState().provider;
