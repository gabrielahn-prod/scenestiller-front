export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(units.length, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[exponent - 1]}`
}

export const formatRelativeTime = (iso: string | null): string => {
  if (!iso) return '없음'
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (seconds < 60) return `${seconds}초 전`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`
  return `${Math.floor(seconds / 3600)}시간 전`
}

/**
 * 이 화질로 하루 종일 올리면 얼마나 쓰는지.
 * 메인/서브 선택이 실제로 무엇을 의미하는지 숫자로 보여주기 위한 것이다.
 */
export const formatDailyUsage = (bitrateKbps: number | null): string | null => {
  if (!bitrateKbps || bitrateKbps <= 0) return null
  return `${formatBytes((bitrateKbps * 1000 * 60 * 60 * 24) / 8)}/일`
}

export const formatResolution = (width: number, height: number): string => `${width}×${height}`

export const formatSegmentLength = (seconds: number): string =>
  seconds >= 60 ? `${Math.round(seconds / 60)}분` : `${seconds}초`
