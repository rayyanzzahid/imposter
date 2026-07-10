'use client'

import Image from 'next/image'
import { useState } from 'react'

export function SpyFigures() {
  const [awake, setAwake] = useState([false, false, false])

  function toggle(index: number) {
    setAwake((current) => current.map((value, i) => (i === index ? !value : value)))
  }

  return (
    <div className="spy-figures" aria-label="Traitor agents">
      {['left', 'main', 'right'].map((position, index) => (
        <button
          key={position}
          type="button"
          onClick={() => toggle(index)}
          className={`spy-figure spy-${position} ${awake[index] ? 'awake' : ''}`}
          aria-label={`Wake agent ${index + 1}`}
        >
          <Image
            src="/assets/traitor-closed-final.png"
            alt=""
            fill
            sizes="(max-width: 780px) 34vw, 166px"
            className="traitor-image traitor-closed"
            priority
            unoptimized
            draggable={false}
          />
          <Image
            src="/assets/traitor-open-final.png"
            alt=""
            fill
            sizes="(max-width: 780px) 34vw, 166px"
            className="traitor-image traitor-open"
            priority
            unoptimized
            draggable={false}
          />
        </button>
      ))}
    </div>
  )
}
