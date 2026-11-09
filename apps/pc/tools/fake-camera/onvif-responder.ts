import { randomUUID } from 'node:crypto'
import { createSocket, type Socket as UdpSocket } from 'node:dgram'
import { createServer, type Server } from 'node:http'

/**
 * 최소 ONVIF 장치 — 진짜 IP 카메라의 검색·조회 부분을 대신한다.
 *
 * 구현 범위는 에이전트가 실제로 부르는 것만이다:
 *   WS-Discovery Probe → ProbeMatches
 *   GetSystemDateAndTime → GetServices → GetProfiles → GetVideoSources → GetStreamUri
 * 이 순서는 onvif 라이브러리의 접속 절차가 실제로 부르는 것과 같다.
 */

export const WS_DISCOVERY_ADDRESS = '239.255.255.250'
export const WS_DISCOVERY_PORT = 3702

export interface OnvifProfileSpec {
  readonly token: string
  readonly name: string
  readonly rtspUri: string
  readonly encoding: 'H264' | 'H265'
  readonly width: number
  readonly height: number
  readonly fps: number
  readonly bitrateKbps: number
}

export interface OnvifDeviceOptions {
  readonly host: string
  readonly port?: number
  readonly manufacturer?: string
  readonly model?: string
  readonly friendlyName?: string
  readonly profiles: readonly OnvifProfileSpec[]
  /** 검색 응답을 끈 카메라를 흉내내고 싶을 때 false. 수동 입력 경로 테스트용. */
  readonly advertise?: boolean
}

export interface OnvifDevice {
  readonly xaddr: string
  readonly uuid: string
  readonly port: number
  close(): Promise<void>
}

const NS = [
  'xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope"',
  'xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"',
  'xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"',
  'xmlns:dn="http://www.onvif.org/ver10/network/wsdl"',
  'xmlns:tds="http://www.onvif.org/ver10/device/wsdl"',
  'xmlns:trt="http://www.onvif.org/ver10/media/wsdl"',
  'xmlns:tt="http://www.onvif.org/ver10/schema"',
].join(' ')

const envelope = (body: string, header = ''): string =>
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<SOAP-ENV:Envelope ${NS}>` +
  (header ? `<SOAP-ENV:Header>${header}</SOAP-ENV:Header>` : '') +
  `<SOAP-ENV:Body>${body}</SOAP-ENV:Body>` +
  `</SOAP-ENV:Envelope>`

/** 요청 XML 에서 호출된 오퍼레이션 이름을 뽑는다. */
export const soapAction = (xml: string): string | null =>
  /<(?:\w+:)?Body[^>]*>\s*<(?:\w+:)?(\w+)/.exec(xml)?.[1] ?? null

const dateAndTime = (now: Date): string =>
  `<tds:GetSystemDateAndTimeResponse><tds:SystemDateAndTime>` +
  `<tt:DateTimeType>NTP</tt:DateTimeType><tt:DaylightSavings>false</tt:DaylightSavings>` +
  `<tt:TimeZone><tt:TZ>UTC</tt:TZ></tt:TimeZone>` +
  `<tt:UTCDateTime>` +
  `<tt:Time><tt:Hour>${now.getUTCHours()}</tt:Hour><tt:Minute>${now.getUTCMinutes()}</tt:Minute><tt:Second>${now.getUTCSeconds()}</tt:Second></tt:Time>` +
  `<tt:Date><tt:Year>${now.getUTCFullYear()}</tt:Year><tt:Month>${now.getUTCMonth() + 1}</tt:Month><tt:Day>${now.getUTCDate()}</tt:Day></tt:Date>` +
  `</tt:UTCDateTime></tds:SystemDateAndTime></tds:GetSystemDateAndTimeResponse>`

/** 카메라의 물리 이미지 센서. 프로필이 이 토큰을 참조해야 라이브러리가 짝을 짓는다. */
const VIDEO_SOURCE_TOKEN = 'vsrc0'

const profileXml = (profile: OnvifProfileSpec): string =>
  `<trt:Profiles token="${profile.token}" fixed="true">` +
  `<tt:Name>${profile.name}</tt:Name>` +
  `<tt:VideoSourceConfiguration token="vsconf_${profile.token}">` +
  `<tt:Name>${profile.name}</tt:Name><tt:UseCount>1</tt:UseCount>` +
  `<tt:SourceToken>${VIDEO_SOURCE_TOKEN}</tt:SourceToken>` +
  `<tt:Bounds x="0" y="0" width="${profile.width}" height="${profile.height}"/>` +
  `</tt:VideoSourceConfiguration>` +
  `<tt:VideoEncoderConfiguration token="venc_${profile.token}">` +
  `<tt:Name>${profile.name}</tt:Name><tt:UseCount>1</tt:UseCount>` +
  `<tt:Encoding>${profile.encoding}</tt:Encoding>` +
  `<tt:Resolution><tt:Width>${profile.width}</tt:Width><tt:Height>${profile.height}</tt:Height></tt:Resolution>` +
  `<tt:Quality>4</tt:Quality>` +
  `<tt:RateControl><tt:FrameRateLimit>${profile.fps}</tt:FrameRateLimit>` +
  `<tt:EncodingInterval>1</tt:EncodingInterval>` +
  `<tt:BitrateLimit>${profile.bitrateKbps}</tt:BitrateLimit></tt:RateControl>` +
  `</tt:VideoEncoderConfiguration></trt:Profiles>`

/** GetStreamUri 요청에서 대상 프로필 토큰을 뽑는다. */
export const requestedProfileToken = (xml: string): string | null =>
  /<(?:\w+:)?ProfileToken[^>]*>([^<]+)</.exec(xml)?.[1]?.trim() ?? null

export const startOnvifDevice = async (options: OnvifDeviceOptions): Promise<OnvifDevice> => {
  const uuid = `urn:uuid:${randomUUID()}`
  const manufacturer = options.manufacturer ?? 'FakeCam'
  const model = options.model ?? 'SIM-1000'
  const friendlyName = options.friendlyName ?? manufacturer

  const server: Server = createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      const xml = Buffer.concat(chunks).toString('utf8')
      const action = soapAction(xml)
      const base = `http://${options.host}:${port}`

      const reply = (body: string, status = 200): void => {
        res.writeHead(status, { 'content-type': 'application/soap+xml; charset=utf-8' })
        res.end(envelope(body))
      }

      if (action === 'GetSystemDateAndTime') return reply(dateAndTime(new Date()))

      if (action === 'GetServices') {
        // Media2(ver20) 는 일부러 빼둔다. Profile S 경로(ver10/media)만 쓰게 하기 위함이다.
        const service = (namespace: string, path: string): string =>
          `<tds:Service><tds:Namespace>${namespace}</tds:Namespace>` +
          `<tds:XAddr>${base}${path}</tds:XAddr>` +
          `<tds:Version><tt:Major>2</tt:Major><tt:Minor>5</tt:Minor></tds:Version></tds:Service>`
        return reply(
          `<tds:GetServicesResponse>` +
            service('http://www.onvif.org/ver10/device/wsdl', '/onvif/device_service') +
            service('http://www.onvif.org/ver10/media/wsdl', '/onvif/media_service') +
            `</tds:GetServicesResponse>`,
        )
      }

      if (action === 'GetVideoSources') {
        const widest = options.profiles.reduce(
          (best, profile) => (profile.width > best.width ? profile : best),
          options.profiles[0]!,
        )
        return reply(
          `<trt:GetVideoSourcesResponse>` +
            `<trt:VideoSources token="${VIDEO_SOURCE_TOKEN}">` +
            `<tt:Framerate>${widest.fps}</tt:Framerate>` +
            `<tt:Resolution><tt:Width>${widest.width}</tt:Width><tt:Height>${widest.height}</tt:Height></tt:Resolution>` +
            `</trt:VideoSources></trt:GetVideoSourcesResponse>`,
        )
      }

      if (action === 'GetCapabilities') {
        return reply(
          `<tds:GetCapabilitiesResponse><tds:Capabilities>` +
            `<tt:Device><tt:XAddr>${base}/onvif/device_service</tt:XAddr></tt:Device>` +
            `<tt:Media><tt:XAddr>${base}/onvif/media_service</tt:XAddr>` +
            `<tt:StreamingCapabilities><tt:RTPMulticast>false</tt:RTPMulticast>` +
            `<tt:RTP_TCP>true</tt:RTP_TCP><tt:RTP_RTSP_TCP>true</tt:RTP_RTSP_TCP>` +
            `</tt:StreamingCapabilities></tt:Media>` +
            `</tds:Capabilities></tds:GetCapabilitiesResponse>`,
        )
      }

      if (action === 'GetDeviceInformation') {
        return reply(
          `<tds:GetDeviceInformationResponse>` +
            `<tds:Manufacturer>${manufacturer}</tds:Manufacturer>` +
            `<tds:Model>${model}</tds:Model>` +
            `<tds:FirmwareVersion>1.0.0</tds:FirmwareVersion>` +
            `<tds:SerialNumber>SIM-0001</tds:SerialNumber>` +
            `<tds:HardwareId>${model}</tds:HardwareId>` +
            `</tds:GetDeviceInformationResponse>`,
        )
      }

      if (action === 'GetProfiles') {
        return reply(
          `<trt:GetProfilesResponse>${options.profiles.map(profileXml).join('')}</trt:GetProfilesResponse>`,
        )
      }

      if (action === 'GetStreamUri') {
        const token = requestedProfileToken(xml)
        const profile = options.profiles.find((p) => p.token === token) ?? options.profiles[0]
        if (!profile) return reply('<SOAP-ENV:Fault/>', 500)
        return reply(
          `<trt:GetStreamUriResponse><trt:MediaUri>` +
            `<tt:Uri>${profile.rtspUri}</tt:Uri>` +
            `<tt:InvalidAfterConnect>false</tt:InvalidAfterConnect>` +
            `<tt:InvalidAfterReboot>false</tt:InvalidAfterReboot>` +
            `<tt:Timeout>PT60S</tt:Timeout>` +
            `</trt:MediaUri></trt:GetStreamUriResponse>`,
        )
      }

      reply('<SOAP-ENV:Fault><SOAP-ENV:Reason><SOAP-ENV:Text>Not implemented</SOAP-ENV:Text></SOAP-ENV:Reason></SOAP-ENV:Fault>', 500)
    })().catch(() => {
      res.writeHead(500).end()
    })
  })

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, options.host, resolve))
  const port = (server.address() as { port: number }).port
  const xaddr = `http://${options.host}:${port}/onvif/device_service`

  const discovery: UdpSocket | null = options.advertise === false ? null : await (async () => {
    const socket = createSocket({ type: 'udp4', reuseAddr: true })
    const bound = await new Promise<boolean>((resolve) => {
      socket.once('error', () => resolve(false))
      socket.bind(WS_DISCOVERY_PORT, () => {
        try {
          socket.addMembership(WS_DISCOVERY_ADDRESS)
          socket.setMulticastLoopback(true)
          resolve(true)
        } catch {
          resolve(false)
        }
      })
    })
    if (!bound) return null

    socket.on('message', (message, rinfo) => {
      const xml = message.toString('utf8')
      if (!/Probe/.test(xml)) return
      const messageId = /<(?:\w+:)?MessageID[^>]*>([^<]+)</.exec(xml)?.[1] ?? ''
      const response = envelope(
        `<d:ProbeMatches><d:ProbeMatch>` +
          `<wsa:EndpointReference><wsa:Address>${uuid}</wsa:Address></wsa:EndpointReference>` +
          `<d:Types>dn:NetworkVideoTransmitter</d:Types>` +
          `<d:Scopes>onvif://www.onvif.org/name/${encodeURIComponent(friendlyName)} ` +
          `onvif://www.onvif.org/hardware/${encodeURIComponent(model)} ` +
          `onvif://www.onvif.org/Profile/Streaming</d:Scopes>` +
          `<d:XAddrs>${xaddr}</d:XAddrs>` +
          `<d:MetadataVersion>1</d:MetadataVersion>` +
          `</d:ProbeMatch></d:ProbeMatches>`,
        `<wsa:MessageID>urn:uuid:${randomUUID()}</wsa:MessageID>` +
          `<wsa:RelatesTo>${messageId}</wsa:RelatesTo>` +
          `<wsa:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>` +
          `<wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action>`,
      )
      // 응답은 탐색자에게 유니캐스트로 돌려준다.
      socket.send(response, rinfo.port, rinfo.address)
    })
    return socket
  })()

  const closed = { done: false }

  return {
    xaddr,
    uuid,
    port,
    close: async () => {
      if (closed.done) return
      closed.done = true
      try {
        discovery?.close()
      } catch {
        // 이미 닫혔다
      }
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}
