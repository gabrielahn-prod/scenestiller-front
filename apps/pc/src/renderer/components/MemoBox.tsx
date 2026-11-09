/**
 * 이벤트 메모 (요구사항 4.7 — 112 접수번호, 피해액 등). 2e 미리보기·2f 상세가 같이 쓴다.
 *
 * 저장 버튼이 없다 — 칸을 벗어나면 저장한다. 사장님이 전화하면서 받아 적는 칸이라
 * '저장'을 누를 여유가 없다.
 */
import { useEffect, useState } from 'react'
import { updateMemo, ServerError } from '../lib/server-api'
import { cn } from '../lib/cn'

export const MemoBox = ({
  eventId,
  initial,
  className,
}: {
  eventId: string
  initial: string | null
  className?: string
}) => {
  const [value, setValue] = useState(initial ?? '')
  const [saved, setSaved] = useState(initial ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  // 다른 이벤트를 고르면 그 이벤트의 메모로 바꾼다.
  useEffect(() => {
    setValue(initial ?? '')
    setSaved(initial ?? '')
    setState('idle')
  }, [eventId, initial])

  const save = async () => {
    if (value === saved) return
    setState('saving')
    try {
      await updateMemo(eventId, value)
      setSaved(value)
      setState('saved')
    } catch (saveError) {
      setError(saveError instanceof ServerError ? saveError.message : '메모를 저장하지 못했습니다.')
      setState('error')
    }
  }

  // 저장 상태는 칸 안 오른쪽 아래에 겹쳐 둔다. 칸 밑에 줄을 따로 두면 2e 오른쪽 패널이
  // 그만큼(20px) 길어져 900px 창을 넘는다 — 디자인에는 그 줄이 없다.
  return (
    <div className={cn('relative', className)}>
      <textarea
        aria-label="메모"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void save()}
        placeholder="메모 (예: 112 접수번호 …)"
        className={cn(
          'block min-h-[88px] w-full resize-none rounded-card bg-surface px-3.5 pb-7 pt-3 text-body-sm font-normal text-gray-900 outline-none',
          'shadow-[inset_0_0_0_1px_var(--gray-300)] placeholder:text-gray-600',
          'focus:shadow-[inset_0_0_0_1px_var(--blue-600)]',
        )}
      />
      <span
        role="status"
        className={cn(
          'pointer-events-none absolute bottom-2 right-3.5 max-w-[calc(100%-1.75rem)] truncate text-[12px] text-gray-600',
          state === 'error' && 'text-error-main',
        )}
      >
        {state === 'saving' && '저장 중…'}
        {state === 'saved' && '저장했습니다'}
        {state === 'error' && error}
      </span>
    </div>
  )
}
