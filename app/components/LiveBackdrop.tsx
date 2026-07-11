'use client'

import { useEffect, useRef } from 'react'

export function LiveBackdrop() {
  const backdropRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const backdrop = backdropRef.current
    if (!backdrop || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0

    function handlePointerMove(event: PointerEvent) {
      if (frame) window.cancelAnimationFrame(frame)

      frame = window.requestAnimationFrame(() => {
        const x = event.clientX / window.innerWidth - 0.5
        const y = event.clientY / window.innerHeight - 0.5

        backdrop?.style.setProperty('--mx', x.toFixed(3))
        backdrop?.style.setProperty('--my', y.toFixed(3))
      })
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={backdropRef} className="live-backdrop" aria-hidden="true">
      <div className="cinematic-city-bg" />
      <div className="cinematic-city-clouds" />
      <div className="cinematic-city-vignette" />
    </div>
  )
}
