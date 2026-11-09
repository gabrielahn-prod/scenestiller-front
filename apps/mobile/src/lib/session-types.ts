export interface Session {
  readonly accessToken: string
  readonly refreshToken: string | null
  readonly expiresAt: number | null
  readonly userId: string | null
  readonly phone: string
}
