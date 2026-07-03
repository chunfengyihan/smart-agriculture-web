import { useEffect, useMemo, useState } from 'react'
import { Camera, MapPin } from 'lucide-react'
import { greenhouseLocations } from '../../data/greenhouseLocations'
import type { Crop } from '../../types'

type DalianFeatureCollection = {
  type: 'FeatureCollection'
  features: DalianFeature[]
}

type DalianFeature = {
  type: 'Feature'
  properties: {
    name: string
    adcode: number
    center?: [number, number]
    centroid?: [number, number]
  }
  geometry: {
    type: 'MultiPolygon'
    coordinates: number[][][][]
  }
}

interface MapPanelProps {
  selectedCropId: Crop['id']
  onSelectLocation: (cropId: Crop['id'], greenhouseId: string) => void
}

const mapWidth = 760
const mapHeight = 520
const mapPadding = 26

export function MapPanel({ selectedCropId, onSelectLocation }: MapPanelProps) {
  const [mapData, setMapData] = useState<DalianFeatureCollection | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/data/dalian.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('Dalian map data failed to load')
        return response.json() as Promise<DalianFeatureCollection>
      })
      .then((data) => {
        if (!cancelled) setMapData(data)
      })
      .catch(() => {
        if (!cancelled) setMapData(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const mapProjection = useMemo(() => {
    if (!mapData) return null

    const points = mapData.features.flatMap((feature) =>
      feature.geometry.coordinates.flatMap((polygon) => polygon.flatMap((ring) => ring)),
    )
    const longitudes = points.map(([lon]) => lon)
    const latitudes = points.map(([, lat]) => lat)
    const minLon = Math.min(...longitudes)
    const maxLon = Math.max(...longitudes)
    const minLat = Math.min(...latitudes)
    const maxLat = Math.max(...latitudes)
    const scale = Math.min(
      (mapWidth - mapPadding * 2) / (maxLon - minLon),
      (mapHeight - mapPadding * 2) / (maxLat - minLat),
    )
    const drawnWidth = (maxLon - minLon) * scale
    const drawnHeight = (maxLat - minLat) * scale
    const offsetX = (mapWidth - drawnWidth) / 2
    const offsetY = (mapHeight - drawnHeight) / 2
    const project = ([lon, lat]: [number, number]) => ({
      x: offsetX + (lon - minLon) * scale,
      y: offsetY + (maxLat - lat) * scale,
    })

    return {
      project,
      paths: mapData.features.map((feature) => ({
        name: feature.properties.name,
        adcode: feature.properties.adcode,
        d: feature.geometry.coordinates
          .flatMap((polygon) =>
            polygon.map((ring) =>
              ring
                .map((point, index) => {
                  const projected = project(point as [number, number])
                  return `${index === 0 ? 'M' : 'L'}${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`
                })
                .join(' ') + ' Z',
            ),
          )
          .join(' '),
        labelPoint: project((feature.properties.centroid || feature.properties.center || [0, 0]) as [number, number]),
      })),
    }
  }, [mapData])

  const plottedLocations = greenhouseLocations.filter(
    (location): location is (typeof greenhouseLocations)[number] & { lon: number; lat: number } =>
      typeof location.lon === 'number' && typeof location.lat === 'number',
  )
  const pendingLocations = greenhouseLocations.filter((location) => typeof location.lon !== 'number')

  return (
    <section className="location-panel">
      <div className="section-heading location-heading">
        <div>
          <p>大连棚区位置</p>
          <h2>棚区位置与作物分布</h2>
        </div>
        <span>
          <MapPin size={16} />
          {plottedLocations.length} 处已标注
        </span>
      </div>

      <div className="dalian-map-wrap">
        <div className="dalian-map" aria-label="大连市作物大棚位置示意图">
          <svg className="dalian-map-shape" viewBox="0 0 760 520" role="img" aria-label="大连市地图轮廓">
            {mapProjection?.paths.map((district) => (
              <path key={district.adcode} d={district.d}>
                <title>{district.name}</title>
              </path>
            ))}
          </svg>
          {mapProjection?.paths.map((district) => (
            <span
              key={district.adcode}
              className="map-label"
              style={{
                left: `${(district.labelPoint.x / mapWidth) * 100}%`,
                top: `${(district.labelPoint.y / mapHeight) * 100}%`,
              }}
            >
              {district.name}
            </span>
          ))}
          {mapProjection &&
            plottedLocations.map((location) => {
              const point = mapProjection.project([location.lon, location.lat])

              return (
                <button
                  key={location.cropId}
                  className={`crop-marker ${location.cropId} ${point.y < 170 ? 'tooltip-below' : ''} ${
                    selectedCropId === location.cropId ? 'active' : ''
                  }`}
                  style={{ left: `${(point.x / mapWidth) * 100}%`, top: `${(point.y / mapHeight) * 100}%` }}
                  type="button"
                  onClick={() => onSelectLocation(location.cropId, location.greenhouseId)}
                  aria-label={`${location.cropName}位置：${location.address}`}
                >
                  <span className="marker-icon">{location.marker}</span>
                  <span className="marker-tooltip">
                    <strong>{location.name}</strong>
                    <small>{location.address}</small>
                    <span className="photo-placeholder">
                      {location.photo ? (
                        <img src={location.photo} alt={`${location.name}实景`} />
                      ) : (
                        <>
                          <Camera size={20} />
                          大棚图片待补充
                        </>
                      )}
                    </span>
                  </span>
                </button>
              )
            })}

          {!mapProjection && (
            <span className="map-loading">
              <MapPin size={22} />
              正在加载大连市地图
            </span>
          )}
        </div>

        <div className="location-legend">
          {greenhouseLocations.map((location) => (
            <button
              key={location.cropId}
              className={`legend-item ${selectedCropId === location.cropId ? 'active' : ''}`}
              type="button"
              disabled={!location.greenhouseId}
              onClick={() => location.greenhouseId && onSelectLocation(location.cropId, location.greenhouseId)}
            >
              <span>{location.marker}</span>
              <strong>{location.cropName}</strong>
              <small>{location.address}</small>
            </button>
          ))}
          {pendingLocations.length > 0 && <p className="pending-note">樱桃棚位置确定后，可在这里补充地图坐标。</p>}
        </div>
      </div>
    </section>
  )
}
