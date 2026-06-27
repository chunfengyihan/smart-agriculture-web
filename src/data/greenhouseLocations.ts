import type { Crop } from '../types'

export const greenhouseLocations = [
  {
    cropId: 'blueberry' as Crop['id'],
    greenhouseId: 'blueberry-c2',
    cropName: '蓝莓',
    marker: '蓝',
    name: '华家街道新石村蓝莓大棚',
    address: '大连市金普新区华家街道新石村',
    lon: 122.0278486,
    lat: 39.2802386,
    photo: '',
  },
  {
    cropId: 'jujube' as Crop['id'],
    greenhouseId: 'jujube-1',
    cropName: '冰糖枣',
    marker: '枣',
    name: '四平社区冰糖枣大棚',
    address: '大连市普兰店区四平街道四平社区',
    lon: 122.1747936,
    lat: 39.7834416,
    photo: '',
  },
  {
    cropId: 'cherry' as Crop['id'],
    greenhouseId: '',
    cropName: '樱桃',
    marker: '樱',
    name: '樱桃大棚',
    address: '位置待补充',
    photo: '',
  },
]

type GreenhouseLocation = (typeof greenhouseLocations)[number] & { lon: number; lat: number }

export function findGreenhouseLocation(cropId: Crop['id'], greenhouseId: string): GreenhouseLocation | undefined {
  const withCoordinates = greenhouseLocations.filter(
    (location): location is GreenhouseLocation =>
      typeof location.lon === 'number' && typeof location.lat === 'number',
  )

  return (
    withCoordinates.find((location) => location.cropId === cropId && location.greenhouseId === greenhouseId) ||
    withCoordinates.find((location) => location.cropId === cropId)
  )
}
