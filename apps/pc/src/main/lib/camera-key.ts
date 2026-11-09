import { createHash } from 'node:crypto'

/**
 * 카메라별 보관 폴더 이름.
 *
 * 카메라 id 는 `urn:uuid:…` 이거나 RTSP 주소라 콜론과 슬래시가 들어 있다.
 * 그대로 폴더명으로 쓰면 윈도우에서 만들어지지 않으므로 해시로 줄인다.
 * 같은 카메라는 재시작 후에도 같은 폴더를 쓴다.
 */
export const cameraKey = (cameraId: string): string =>
  `cam_${createHash('sha1').update(cameraId).digest('hex').slice(0, 12)}`
