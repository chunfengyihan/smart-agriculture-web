import { useOutletContext } from 'react-router-dom'
import type { useDashboard } from '../hooks/useDashboard'
import type { Crop, DashboardData } from '../types'

type DashboardState = ReturnType<typeof useDashboard>

export type DashboardOutletContext = Omit<DashboardState, 'data' | 'selectedCrop'> & {
  data: DashboardData
  selectedCrop: Crop
}

export function useDashboardContext() {
  return useOutletContext<DashboardOutletContext>()
}
