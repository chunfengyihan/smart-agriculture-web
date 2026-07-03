import type { Crop } from '../../types'

interface CropTabsProps {
  crops: Crop[]
  selectedCropId: Crop['id']
  onSelectCrop: (crop: Crop) => void
}

export function CropTabs({ crops, selectedCropId, onSelectCrop }: CropTabsProps) {
  return (
    <nav className="crop-tabs" aria-label="作物切换">
      {crops.map((crop) => (
        <button
          key={crop.id}
          className={crop.id === selectedCropId ? 'active' : ''}
          type="button"
          onClick={() => onSelectCrop(crop)}
        >
          <span style={{ backgroundColor: crop.accent }} />
          <strong>{crop.name}</strong>
          <small>
            {crop.greenhouses.length} 座棚 · {crop.greenhouses.reduce((sum, greenhouse) => sum + greenhouse.alerts.length, 0)} 条提醒
          </small>
        </button>
      ))}
    </nav>
  )
}
