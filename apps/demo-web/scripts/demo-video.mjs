#!/usr/bin/env node
/**
 * 시연 영상 → 30초 조각.
 *
 * `/wanted-test` 데모는 브라우저가 매장 PC 수집기 역할을 한다. 브라우저는 RTSP 를 못 열고
 * 실시간 인코딩도 믿을 수 없으니, 에이전트가 할 "자르기"를 빌드 때 미리 해 둔다.
 * 재생하는 동안 조각이 끝날 때마다 그 조각을 실제 서버(POST /v1/segments)로 올린다.
 *
 *   레포루트/public/demo-video/*.mp4          ← 사람이 넣는 원본
 *   apps/demo-web/.generated/wanted-test/demo-video/  ← 이 스크립트의 출력 (gitignore, vite publicDir)
 *                                                → 배포에서는 /wanted-test/demo-video/ (실서버 시연만 쓴다)
 *     manifest.json
 *     demo-<해시>/full.mp4                     화면에 트는 영상 (조각과 같은 인코딩)
 *     demo-<해시>/seg-000.mp4 …                서버로 올리는 조각
 *
 * 에이전트(segment-args.ts)와 같게 자른다 — H.264 mp4, 소리 없음, 조각 경계마다 키프레임.
 * 서버 입장에서는 매장 PC 가 올린 조각과 구별되지 않아야 한다.
 *
 *   node scripts/demo-video.mjs            # 한 번 돌려 보기
 *   DEMO_VIDEO_HEIGHT=720 DEMO_VIDEO_FPS=15 node scripts/demo-video.mjs
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const demoWeb = resolve(here, '..')
const repo = resolve(demoWeb, '../..')
const require = createRequire(import.meta.url)

export const DEFAULT_SOURCE_DIR = resolve(repo, 'public/demo-video')
export const OUTPUT_DIR = resolve(demoWeb, '.generated/wanted-test/demo-video')
/** 예전 출력 위치 (배포의 /demo-video/). 남아 있으면 그대로 배포에 실리므로 지운다. */
const LEGACY_OUTPUT_DIR = resolve(demoWeb, '.generated/demo-video')

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.avi'])

/** 출력 모양이 바뀌면 올린다 — 캐시가 옛 출력을 재사용하지 않게. */
const FORMAT_VERSION = 1

const numberFrom = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** 원본이 이보다 빠르면 내린다. AI 는 프레임마다 포즈를 뽑으므로 fps 가 곧 서버 분석 시간이다. */
const MAX_FPS = 30

/**
 * 인코딩 기준값. 세로 480, fps 는 원본 그대로(최대 MAX_FPS).
 * fps 를 15 로 낮추지 않는 이유: 서버 AI 는 한 사람을 연속 32프레임씩 묶어 본다. 15fps 면 그 묶음이
 * 2초가 넘어 짧게 튀는 동작이 묻히고, 추적이 한 번만 끊겨도 묶음이 안 생긴다 — 25fps 원본에서
 * 매번 '높음'이던 장면이 15fps 로는 '보통'에 그치거나 아예 안 잡혔다.
 */
export const encodingFromEnv = (env = process.env) => ({
  segmentSeconds: numberFrom(env.DEMO_SEGMENT_SECONDS, 30),
  height: numberFrom(env.DEMO_VIDEO_HEIGHT, 480),
  /** 0 = 원본 fps. */
  fps: numberFrom(env.DEMO_VIDEO_FPS, 0),
})

/** 실제로 쓸 fps — 정해 둔 값이 없으면 원본을 따르되 MAX_FPS 를 넘기지 않는다. */
export const outputFps = (encoding, sourceFps) =>
  encoding.fps || Math.min(sourceFps > 0 ? sourceFps : MAX_FPS, MAX_FPS)

const ffmpegPath = () => {
  const path = require('ffmpeg-static')
  if (!path || !existsSync(path)) throw new Error('ffmpeg 를 찾을 수 없습니다 (npm install 로 ffmpeg-static 설치)')
  return path
}

const ffprobePath = () => {
  const { path } = require('ffprobe-static')
  if (!path || !existsSync(path)) throw new Error('ffprobe 를 찾을 수 없습니다 (npm install 로 ffprobe-static 설치)')
  return path
}

const probe = (file) => {
  const raw = execFileSync(ffprobePath(), [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,r_frame_rate:format=duration',
    '-of', 'json',
    file,
  ]).toString()
  const json = JSON.parse(raw)
  const stream = json.streams?.[0]
  if (!stream) throw new Error(`영상 트랙이 없습니다: ${file}`)
  const [num, den] = String(stream.r_frame_rate ?? '0/1').split('/').map(Number)
  return {
    codec: stream.codec_name,
    width: stream.width,
    height: stream.height,
    fps: den ? Math.round((num / den) * 100) / 100 : 0,
    durationMs: Math.round(Number(json.format?.duration ?? 0) * 1000),
  }
}

/**
 * 카메라 id 는 파일 이름에서 나온다. 서버는 이 id(agentCameraId)로 카메라를 찾으므로
 * 빌드마다 바뀌면 안 된다 — 파일 이름을 안 바꾸는 한 같은 값이다.
 */
export const cameraIdFor = (fileName) =>
  `demo-${createHash('sha1').update(fileName.normalize('NFC')).digest('hex').slice(0, 8)}`

/** '01-계산대.mp4' → '계산대'. 앞의 번호는 순서를 정하는 용도로만 쓴다. */
export const cameraNameFor = (fileName) => {
  const stem = basename(fileName, extname(fileName)).normalize('NFC')
  const name = stem.replace(/^\d+[\s._-]+/, '').replace(/[_]+/g, ' ').trim()
  return name || stem
}

export const listSourceVideos = (sourceDir) => {
  if (!existsSync(sourceDir)) return []
  return readdirSync(sourceDir)
    .filter((name) => VIDEO_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'ko'))
}

const cacheKeyFor = (sourceFile, encoding) => {
  const { size, mtimeMs } = statSync(sourceFile)
  return createHash('sha1')
    .update(JSON.stringify({ FORMAT_VERSION, size, mtimeMs: Math.round(mtimeMs), encoding }))
    .digest('hex')
}

const encodeOne = (sourceFile, outDir, encoding) => {
  const ffmpeg = ffmpegPath()
  const { segmentSeconds, height, fps } = encoding
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  // 1) 한 번 인코딩한다. 조각 경계(segmentSeconds 배수)마다 키프레임을 강제해서
  //    2) 에서 재인코딩 없이 정확히 그 자리에서 자를 수 있게 한다.
  const full = join(outDir, 'full.mp4')
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', sourceFile,
    '-an',
    // 원본보다 키우지는 않는다. 너비는 비율을 지키며 짝수로 맞춘다 (H.264 요구).
    '-vf', `fps=${fps},scale=-2:'min(${height},ih)'`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
    '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    // B-프레임을 끈다 — CCTV 스트림처럼. 켜 두면 첫 조각 시작이 두 프레임 밀려 조각 길이가 어긋난다.
    '-bf', '0',
    '-g', String(Math.round(fps * 2)), '-sc_threshold', '0',
    '-force_key_frames', `expr:gte(t,n_forced*${segmentSeconds})`,
    '-movflags', '+faststart',
    full,
  ], { stdio: 'inherit' })

  // 2) 스트림 복사로 자른다. 에이전트의 segment muxer 와 같은 방식이다.
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', full,
    '-c', 'copy', '-map', '0:v:0',
    '-f', 'segment', '-segment_time', String(segmentSeconds),
    '-reset_timestamps', '1',
    '-segment_format_options', 'movflags=+faststart',
    join(outDir, 'seg-%03d.mp4'),
  ], { stdio: 'inherit' })
}

const describeOne = (fileName, outDir, relDir) => {
  const full = probe(join(outDir, 'full.mp4'))
  const segmentFiles = readdirSync(outDir).filter((name) => /^seg-\d{3}\.mp4$/.test(name)).sort()
  let offsetMs = 0
  const segments = segmentFiles.map((name) => {
    const info = probe(join(outDir, name))
    const segment = {
      file: `${relDir}/${name}`,
      offsetMs,
      durationMs: info.durationMs,
      sizeBytes: statSync(join(outDir, name)).size,
    }
    offsetMs += info.durationMs
    return segment
  })
  return {
    id: relDir,
    name: cameraNameFor(fileName),
    source: fileName,
    file: `${relDir}/full.mp4`,
    codec: full.codec === 'hevc' ? 'h265' : 'h264',
    width: full.width,
    height: full.height,
    fps: full.fps,
    durationMs: full.durationMs,
    segments,
  }
}

/**
 * 원본 폴더의 영상을 전부 처리해 outputDir 에 manifest 와 함께 쓴다.
 * 원본이 그대로면(크기·수정 시각·설정이 같으면) 다시 인코딩하지 않는다.
 */
export const buildDemoVideos = ({
  sourceDir = process.env.DEMO_VIDEO_SOURCE ? resolve(process.env.DEMO_VIDEO_SOURCE) : DEFAULT_SOURCE_DIR,
  outputDir = OUTPUT_DIR,
  encoding = encodingFromEnv(),
  log = console.log,
} = {}) => {
  if (outputDir === OUTPUT_DIR) rmSync(LEGACY_OUTPUT_DIR, { recursive: true, force: true })
  mkdirSync(outputDir, { recursive: true })
  const sources = listSourceVideos(sourceDir)
  log(`시연 영상: ${sources.length}개 (${sourceDir})`)

  const videos = sources.map((fileName) => {
    const sourceFile = join(sourceDir, fileName)
    const id = cameraIdFor(fileName)
    const outDir = join(outputDir, id)
    const key = cacheKeyFor(sourceFile, encoding)
    const keyFile = join(outDir, '.key')
    const cached = existsSync(keyFile) && readFileSync(keyFile, 'utf8') === key
    if (cached) {
      log(`  ${fileName} → ${id} (이전 결과 재사용)`)
    } else {
      const fps = outputFps(encoding, probe(sourceFile).fps)
      log(`  ${fileName} → ${id} 인코딩 (${encoding.height}p · ${fps}fps · ${encoding.segmentSeconds}초 조각)`)
      encodeOne(sourceFile, outDir, { ...encoding, fps })
      writeFileSync(keyFile, key)
    }
    const described = describeOne(fileName, outDir, id)
    log(`    ${Math.round(described.durationMs / 1000)}초 · ${described.width}×${described.height} · 조각 ${described.segments.length}개`)
    return described
  })

  // 원본에서 빠진 영상의 출력은 지운다. 남겨 두면 manifest 에는 없는데 배포에는 실린다.
  const keep = new Set(videos.map((video) => video.id))
  readdirSync(outputDir)
    .filter((name) => name.startsWith('demo-') && !keep.has(name))
    .forEach((name) => rmSync(join(outputDir, name), { recursive: true, force: true }))

  const manifest = {
    version: FORMAT_VERSION,
    segmentSeconds: encoding.segmentSeconds,
    videos,
  }
  writeFileSync(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = buildDemoVideos()
  console.log(`\n완료 → ${OUTPUT_DIR} (영상 ${manifest.videos.length}개)`)
}
