import { CropTabs } from '../components/dashboard/CropTabs'
import { DashboardTopbar } from '../components/dashboard/DashboardTopbar'
import { EnvironmentPanel } from '../components/dashboard/EnvironmentPanel'
import { HeroPanel } from '../components/dashboard/HeroPanel'
import { MapPanel } from '../components/dashboard/MapPanel'
import { useDashboard } from '../hooks/useDashboard'
import { sourceText } from '../lib/formatters'
import type { DashboardData } from '../types'

const configuredDataSource = import.meta.env.VITE_DATA_SOURCE || 'remote'
const usesDjangoApi =
  configuredDataSource === 'remote' ||
  (!import.meta.env.VITE_DATA_SOURCE && import.meta.env.VITE_USE_REMOTE_DATA === 'true')
function dashboardSourceText(source: DashboardData['source']) {
  const label = sourceText(source)
  return usesDjangoApi ? `Django API / ${label}` : label
}

export function DashboardPage() {
  const {
    data: dashboard,
    error,
    isFetching,
    isPaused,
    refetch: refetchDashboard,
    closeMobileNav,
    cropAlerts,
    mobileNavOpen,
    selectCrop,
    selectGreenhouse,
    selectLocation,
    selectedCrop,
    selectedGreenhouse,
    theme,
    toggleMobileNav,
    toggleTheme,
    totals,
  } = useDashboard()

  if (!dashboard || !selectedCrop) {
    return (
      <main className="app-shell loading-shell">
        <div className="loading-panel">
          <img className="loading-logo" src="/logo-mark.svg" alt="" />
          <h1>智慧农业管理中枢</h1>
          <p>{error || '正在准备温室数据...'}</p>
          <button type="button" onClick={() => void refetchDashboard({ force: true })}>
            重新加载
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <DashboardTopbar
        error={error}
        isFetching={isFetching}
        isPaused={isPaused}
        mobileNavOpen={mobileNavOpen}
        theme={theme}
        totalAlerts={totals.alerts}
        onCloseMobileNav={closeMobileNav}
        onRefresh={() => void refetchDashboard({ force: true })}
        onToggleMobileNav={toggleMobileNav}
        onToggleTheme={toggleTheme}
      />

      <HeroPanel
        cropAlerts={cropAlerts}
        dashboard={dashboard}
        dashboardSourceLabel={dashboardSourceText(dashboard.source)}
        selectedCrop={selectedCrop}
        totals={totals}
      />

      <CropTabs
        crops={dashboard.crops}
        selectedCropId={selectedCrop.id}
        onSelectCrop={(crop) => selectCrop(crop.id, crop.greenhouses[0]?.id || '')}
      />

      <div id="map">
        <MapPanel
          selectedCropId={selectedCrop.id}
          onSelectLocation={(cropId, greenhouseId) => {
            selectLocation(cropId, greenhouseId)
          }}
        />
      </div>

      <EnvironmentPanel
        selectedCrop={selectedCrop}
        selectedGreenhouse={selectedGreenhouse}
        onSelectGreenhouse={selectGreenhouse}
      />
    </main>
  )
}

export default DashboardPage
