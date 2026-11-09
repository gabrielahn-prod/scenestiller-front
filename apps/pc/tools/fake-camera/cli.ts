import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { startFakeCamera } from './index'

/**
 * `npm run fake-camera` — 가짜 카메라를 띄우고 Ctrl+C 까지 유지한다.
 *
 *   npm run fake-camera                      테스트 패턴 영상
 *   npm run fake-camera -- --webcam          노트북 웹캠
 *   npm run fake-camera -- --file 영상.mp4    가진 영상 파일
 *
 * 어느 쪽을 넣든 에이전트가 보는 것은 RTSP 하나뿐이다. 그래서 테스트셋 영상을
 * 여기에 넣으면 진짜 CCTV 를 꽂은 것과 같은 경로로 수집된다.
 */
const readFlag = (name: string): string | null => {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return null
  const value = process.argv[index + 1]
  return value && !value.startsWith('--') ? value : null
}

const run = async (): Promise<void> => {
  const useWebcam = process.argv.includes('--webcam') || process.env.FAKE_CAM_SOURCE === 'webcam'
  const file = readFlag('file') ?? process.env.FAKE_CAM_FILE ?? null

  if (file && !existsSync(file)) {
    // 여기서 막지 않으면 없는 경로에 테스트 패턴을 새로 만들어 버린다 — 오타를 조용히 삼키는 셈이다.
    console.error(`영상 파일을 찾을 수 없습니다: ${file}`)
    process.exit(1)
  }
  if (file && useWebcam) {
    console.error('--webcam 과 --file 은 같이 쓸 수 없습니다.')
    process.exit(1)
  }

  const camera = await startFakeCamera({
    host: process.env.FAKE_CAM_HOST ?? '127.0.0.1',
    ...(useWebcam ? { source: 'webcam' as const } : {}),
    ...(file ? { sourceFile: file } : {}),
    manufacturer: 'FakeCam',
    model: useWebcam ? 'WEBCAM-1' : 'SIM-1000',
    friendlyName: useWebcam ? '노트북웹캠' : file ? basename(file) : '테스트카메라',
  })

  const inputLabel = useWebcam ? '노트북 웹캠' : file ? file : '테스트 영상'
  console.log(`가짜 카메라가 떴습니다. (입력: ${inputLabel})`)
  console.log(`  ONVIF  ${camera.xaddr}`)
  console.log(`  UUID   ${camera.uuid}`)
  Object.entries(camera.rtsp).forEach(([name, url]) => console.log(`  RTSP   ${name}  ${url}`))
  console.log('\n에이전트에서 검색하거나, 위 RTSP 주소를 직접 입력해 보세요. (Ctrl+C 로 종료)')

  const shutdown = (): void => {
    void camera.close().then(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

void run()
