import { create } from 'zustand'
import type { CropId, ThemeMode } from '../types'

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'

  const stored = localStorage.getItem('theme') as ThemeMode | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface DashboardUiState {
  selectedCropId: CropId
  selectedGreenhouseId: string
  theme: ThemeMode
  mobileNavOpen: boolean
  closeMobileNav: () => void
  selectCrop: (cropId: CropId, greenhouseId?: string) => void
  selectGreenhouse: (greenhouseId: string) => void
  selectLocation: (cropId: CropId, greenhouseId: string) => void
  setTheme: (theme: ThemeMode) => void
  toggleMobileNav: () => void
  toggleTheme: () => void
}

export const useDashboardStore = create<DashboardUiState>((set) => ({
  selectedCropId: 'jujube',
  selectedGreenhouseId: '',
  theme: getInitialTheme(),
  mobileNavOpen: false,
  closeMobileNav: () => set({ mobileNavOpen: false }),
  selectCrop: (cropId, greenhouseId = '') =>
    set({ selectedCropId: cropId, selectedGreenhouseId: greenhouseId, mobileNavOpen: false }),
  selectGreenhouse: (greenhouseId) => set({ selectedGreenhouseId: greenhouseId }),
  selectLocation: (cropId, greenhouseId) =>
    set({ selectedCropId: cropId, selectedGreenhouseId: greenhouseId, mobileNavOpen: false }),
  setTheme: (theme) => set({ theme }),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}))
