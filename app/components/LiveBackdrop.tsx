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
      <div className="live-sky" />
      <div className="live-stars stars-far" />
      <div className="live-stars stars-near" />
      <div className="live-clouds clouds-far" />
      <div className="live-clouds clouds-near" />
      <div className="live-moon" />
      <div className="city-layer city-back">
        <span className="antenna antenna-a" />
        <span className="beacon beacon-a" />
      </div>
      <div className="city-layer city-mid">
        <span className="antenna antenna-b" />
        <span className="beacon beacon-b" />
      </div>
      <div className="city-layer city-front">
        <span className="antenna antenna-c" />
        <span className="beacon beacon-c" />
      </div>
      <div className="live-fog skyline-fog" />
      <div className="live-vignette" />
    </div>
  )
}

