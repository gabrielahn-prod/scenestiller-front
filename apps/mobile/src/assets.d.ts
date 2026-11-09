/**
 * 이미지 파일 import. Metro 가 에셋으로 바꿔 준다 (네이티브는 에셋 번호, 웹은 주소가 든 값) —
 * 모양을 풀지 말고 expo-image 의 source 로 그대로 넘긴다.
 */
declare module '*.png' {
  const source: number | { readonly uri: string; readonly width?: number; readonly height?: number }
  export default source
}
