import { Maximize2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CropTabs } from '../components/dashboard/CropTabs'
import { EnvironmentPanel } from '../components/dashboard/EnvironmentPanel'
import { HeroPanel } from '../components/dashboard/HeroPanel'
import { MapPanel } from '../components/dashboard/MapPanel'
import { useDashboardContext } from './dashboardContext'

function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <header className="page-intro">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action}
    </header>
  )
}

function CropContextBar() {
  const { data, selectCrop, selectedCrop } = useDashboardContext()

  return (
    <CropTabs
      crops={data.crops}
      selectedCropId={selectedCrop.id}
      onSelectCrop={(crop) => selectCrop(crop.id, crop.greenhouses[0]?.id || '')}
    />
  )
}

export function HomePage() {
  const { selectedCrop, totals } = useDashboardContext()

  return <HeroPanel selectedCrop={selectedCrop} totals={totals} />
}

export function MonitoringPage() {
  const { selectGreenhouse, selectedCrop, selectedGreenhouse } = useDashboardContext()

  return (
    <div className="page-content">
      <PageIntro
        eyebrow="实时生产状态"
        title="棚区监测"
        description="集中查看天气、环境指标、设备趋势与当前预警。"
      />
      <CropContextBar />
      <EnvironmentPanel
        mode="monitoring"
        selectedCrop={selectedCrop}
        selectedGreenhouse={selectedGreenhouse}
        onSelectGreenhouse={selectGreenhouse}
      />
    </div>
  )
}

export function MapPage() {
  const navigate = useNavigate()
  const { selectLocation, selectedCrop } = useDashboardContext()

  return (
    <div className="page-content">
      <PageIntro
        eyebrow="大连棚区布局"
        title="地图分布"
        description="按区域查看作物与大棚位置，点击标记可直接进入对应棚区监测。"
      />
      <CropContextBar />
      <MapPanel
        selectedCropId={selectedCrop.id}
        onSelectLocation={(cropId, greenhouseId) => {
          selectLocation(cropId, greenhouseId)
          navigate('/monitoring')
        }}
      />
    </div>
  )
}

export function AnalyticsPage() {
  const navigate = useNavigate()
  const { selectGreenhouse, selectedCrop, selectedGreenhouse } = useDashboardContext()

  const openDataWall = () => {
    navigate(`/analytics/wall?crop=${selectedCrop.id}`)
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => undefined)
    }
  }

  return (
    <div className="page-content">
      <PageIntro
        eyebrow="采集数据洞察"
        title="数据分析"
        description="对比不同棚区和指标的历史变化、数据质量与阶段趋势。"
        action={
          <button className="data-wall-entry" type="button" onClick={openDataWall}>
            <Maximize2 size={19} aria-hidden="true" />
            大屏展示
          </button>
        }
      />
      <CropContextBar />
      <EnvironmentPanel
        mode="analytics"
        selectedCrop={selectedCrop}
        selectedGreenhouse={selectedGreenhouse}
        onSelectGreenhouse={selectGreenhouse}
      />
    </div>
  )
}

export function IntelligencePage() {
  const { selectGreenhouse, selectedCrop, selectedGreenhouse } = useDashboardContext()

  return (
    <div className="page-content">
      <PageIntro
        eyebrow="农业智能辅助"
        title="智能服务"
        description="上传作物图片进行症状诊断，并结合棚区环境获得操作建议。"
      />
      <CropContextBar />
      <EnvironmentPanel
        mode="intelligence"
        selectedCrop={selectedCrop}
        selectedGreenhouse={selectedGreenhouse}
        onSelectGreenhouse={selectGreenhouse}
      />
    </div>
  )
}
