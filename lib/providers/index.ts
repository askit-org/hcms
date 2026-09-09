// lib/providers/index.ts
// Provider Factory - Pure HTTP Database API Provider

import { create } from 'zustand';
import { ApiDataProvider } from './api';
import type { DataProvider } from './types';

interface ProviderState {
  isOfflineMode: false;
  provider: DataProvider;
  setOfflineMode: (offline: boolean) => void;
}

export const useProviderStore = create<ProviderState>((set) => ({
  // Strictly enforce API backend database calls across the entire application
  isOfflineMode: false,
  provider: ApiDataProvider,
  setOfflineMode: () => {
    // Local DB is disabled per configuration — strictly use API backend
    set({ isOfflineMode: false, provider: ApiDataProvider });
  },
}));

// Export helper hook to get the API provider instance
export const useProvider = () => ApiDataProvider;

// Direct accessor outside of React lifecycle
export const getProvider = () => ApiDataProvider;
