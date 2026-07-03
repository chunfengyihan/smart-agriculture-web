import { useEffect, useMemo } from 'react'
import { useDashboardQuery } from './useDashboardQuery'
import { useDashboardStore } from '../store/dashboardStore'

export function useDashboard() {
  const query = useDashboardQuery()
  const {
    selectedCropId,
    selectedGreenhouseId,
    theme,
    mobileNavOpen,
    closeMobileNav,
    selectCrop,
    selectGreenhouse,
    selectLocation,
    toggleMobileNav,
    toggleTheme,
  } = useDashboardStore()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const selectedCrop = useMemo(
    () => query.data?.crops.find((crop) => crop.id === selectedCropId) || query.data?.crops[0],
    [query.data, selectedCropId],
  )

  const selectedGreenhouse = useMemo(() => {
    if (!selectedCrop) return undefined
    return (
      selectedCrop.greenhouses.find((greenhouse) => greenhouse.id === selectedGreenhouseId) ||
      selectedCrop.greenhouses[0]
    )
  }, [selectedCrop, selectedGreenhouseId])

  const totals = useMemo(() => {
    const crops = query.data?.crops || []
    const greenhouses = crops.flatMap((crop) => crop.greenhouses)
    return {
      greenhouses: greenhouses.length,
      onlineDevices: greenhouses.reduce((sum, item) => sum + item.onlineDevices, 0),
      totalDevices: greenhouses.reduce((sum, item) => sum + item.totalDevices, 0),
      alerts: greenhouses.reduce((sum, item) => sum + item.alerts.length, 0),
    }
  }, [query.data])

  const cropAlerts = selectedCrop?.greenhouses.reduce((sum, item) => sum + item.alerts.length, 0) || 0

  return {
    ...query,
    closeMobileNav,
    cropAlerts,
    mobileNavOpen,
    selectCrop,
    selectGreenhouse,
    selectLocation,
    selectedCrop,
    selectedGreenhouse,
    selectedGreenhouseId,
    theme,
    toggleMobileNav,
    toggleTheme,
    totals,
  }
}
