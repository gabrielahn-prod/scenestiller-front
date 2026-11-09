import ffmpegStatic from 'ffmpeg-static'

/**
 * 번들된 ffmpeg 바이너리 경로.
 * electron-builder 로 패키징하면 바이너리가 app.asar 안에 들어가 실행할 수 없으므로
 * asarUnpack 된 경로로 보정한다. (package.json 의 build.asarUnpack 과 짝을 이룬다)
 */
export const resolveFfmpegPath = (): string => {
  const path = ffmpegStatic as unknown as string | null
  if (!path) throw new Error('ffmpeg 바이너리를 찾을 수 없습니다 (ffmpeg-static 설치 확인)')
  return path.replace('app.asar', 'app.asar.unpacked')
}
