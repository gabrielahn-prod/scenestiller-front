import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import './index.css'

/**
 * HashRouter 를 쓰는 이유: 배포된 Electron 은 렌더러를 file:// 로 불러오는데
 * history API 라우팅은 그 위에서 새로고침·딥링크가 깨진다.
 */
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  )
}
