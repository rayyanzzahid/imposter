import { headers } from 'next/headers'

type LimitEntry = {
  count: number
  resetAt: number
}

const entries = new Map<string, LimitEntry>()

function getClientKey(requestKey: string) {
  return headers().then((requestHeaders) => {
    const forwardedFor = requestHeaders.get('x-forwarded-for')
    const realIp = requestHeaders.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown'
    return `${requestKey}:${ip}`
  })
}

/**
 * Short-window protection for expensive public actions.
 * For multi-instance production deployments, back this with a shared store
 * such as Upstash Redis so limits apply across all server instances.
 */
export async function enforceRateLimit(
  action: string,
  limit: number,
  windowMs: number
) {
  if (entries.size > 10_000) {
    const now = Date.now()
    for (const [entryKey, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(entryKey)
    }
  }

  const key = await getClientKey(action)
  const now = Date.now()
  const current = entries.get(key)

  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (current.count >= limit) {
    throw new Error('Too many attempts. Please wait a moment and try again.')
  }

  current.count += 1
}
