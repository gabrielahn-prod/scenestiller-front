/**
 * 설정 ▸ 고급 — 서버 주소 · 토큰 · 기기 ID.
 *
 * 예전 첫 화면(ServerSetup)이었다. 사장님이 볼 일이 없어 여기로 옮겼다 (2a 하단
 * "개발자용 서버 주소·토큰 입력은 설정 ▸ 고급에 있습니다"). 로그인 전에도 열린다 —
 * 서버 주소가 없으면 로그인 자체를 못 한다.
 *
 * 디자인에 그려진 화면이 없어 디자인시스템 카드·입력으로 만들었다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../app/session'
import { Logo } from '../../components/TopNav'
import { Button, Input, Notice } from '../../components/ui'

const isHttpUrl = (value: string): boolean => /^https?:\/\/[^\s]+$/.test(value)

export const Advanced = () => {
  const navigate = useNavigate()
  const { config, session, updateConfig } = useSession()
  const [backendBaseUrl, setBackendBaseUrl] = useState(config.backendBaseUrl)
  const [supabaseUrl, setSupabaseUrl] = useState(config.supabaseUrl)
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(config.supabaseAnonKey)
  const [deviceToken, setDeviceToken] = useState(config.deviceToken)
  const [storeId, setStoreId] = useState(config.storeId)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const urlError = (value: string): string | null =>
    value && !isHttpUrl(value.trim()) ? 'http:// 또는 https:// 로 시작해야 합니다' : null
  const invalid = Boolean(urlError(backendBaseUrl) || urlError(supabaseUrl))

  const save = async () => {
    setSaving(true)
    setSaved(false)
    await updateConfig({
      backendBaseUrl: backendBaseUrl.trim(),
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      deviceToken: deviceToken.trim(),
      storeId: storeId.trim(),
    })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="flex h-full flex-col bg-page">
      <header className="flex h-nav shrink-0 items-center justify-between border-b border-gray-200 bg-surface px-page py-5">
        <Logo />
        <Button variant="link" onClick={() => navigate(session.signedIn ? '/settings' : '/onboarding')}>
          {session.signedIn ? '← 설정으로' : '← 로그인으로'}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-page py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <div>
            <h1 className="text-h1">고급</h1>
            <p className="mt-1 text-body-sm font-normal leading-normal text-gray-600">
              서버 주소 · 토큰 · 기기 ID. 설치 담당자용 설정입니다 — 잘못 바꾸면 감시 영상이 서버로 가지 않습니다.
            </p>
          </div>

          <section className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-card">
            <h2 className="text-h3">서버</h2>
            <Input
              label="백엔드 주소"
              placeholder="https://api.example.com"
              value={backendBaseUrl}
              onChange={(event) => setBackendBaseUrl(event.target.value)}
              error={urlError(backendBaseUrl)}
              hint="영상 조각은 이 주소의 /v1/segments 로 전송됩니다"
            />
            <Input
              label="로그인 서버 (Supabase) 주소"
              placeholder="https://xxxx.supabase.co"
              value={supabaseUrl}
              onChange={(event) => setSupabaseUrl(event.target.value)}
              error={urlError(supabaseUrl)}
              hint="휴대폰 인증번호를 보내는 곳입니다"
            />
            <Input
              label="로그인 서버 공개 키 (anon)"
              value={supabaseAnonKey}
              onChange={(event) => setSupabaseAnonKey(event.target.value)}
            />
          </section>

          <section className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-card">
            <h2 className="text-h3">이 PC</h2>
            <Input
              label="기기 토큰"
              type="password"
              value={deviceToken}
              onChange={(event) => setDeviceToken(event.target.value)}
              hint="매장에 PC를 연결하면(2a) 자동으로 채워집니다. 직접 넣을 일은 거의 없습니다."
            />
            <Input
              label="매장 ID"
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              hint="어느 매장에서 온 영상인지 구분하는 값입니다"
            />
            <Input label="기기 ID" value={config.deviceId} readOnly state="done" hint="이 PC에 자동으로 부여된 값입니다. 바꿀 수 없습니다." />
          </section>

          {saved && <Notice tone="info">저장했습니다.</Notice>}
          <div className="flex justify-end">
            <Button variant="primary" loading={saving} disabled={invalid} onClick={() => void save()}>
              저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
