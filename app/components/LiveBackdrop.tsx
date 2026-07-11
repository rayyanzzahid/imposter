'use client'

import { useEffect, useMemo, useRef } from 'react'

const backBuildings = [
  [0, 600, 76, 160], [76, 560, 92, 200], [168, 620, 70, 140], [238, 590, 96, 170],
  [334, 535, 82, 225], [416, 610, 112, 150], [528, 575, 76, 185], [604, 625, 118, 135],
  [722, 555, 84, 205], [806, 605, 104, 155], [910, 582, 82, 178], [992, 628, 134, 132],
  [1126, 548, 94, 212], [1220, 616, 122, 144], [1342, 565, 86, 195], [1428, 610, 172, 150],
]

const frontBuildings = [
  [0, 690, 96, 210], [96, 650, 90, 250], [186, 715, 126, 185], [312, 640, 74, 260],
  [386, 704, 118, 196], [504, 674, 96, 226], [600, 725, 156, 175], [756, 632, 92, 268],
  [848, 690, 120, 210], [968, 652, 86, 248], [1054, 714, 134, 186], [1188, 635, 108, 265],
  [1296, 704, 92, 196], [1388, 662, 82, 238], [1470, 610, 130, 290],
]

function windowsFor(building: number[], layer: 'back' | 'front') {
  const [x, y, w, h] = building
  const windows = []
  const gapX = layer === 'front' ? 18 : 22
  const gapY = layer === 'front' ? 24 : 28
  const winW = layer === 'front' ? 4 : 3
  const winH = layer === 'front' ? 9 : 7

  for (let wx = x + 15; wx < x + w - 12; wx += gapX) {
    for (let wy = y + 28; wy < y + h - 24; wy += gapY) {
      const seed = Math.abs(Math.sin(wx * 12.9898 + wy * 78.233) * 43758.5453)
      if (seed % 1 > (layer === 'front' ? 0.72 : 0.82)) {
        windows.push({ x: wx, y: wy, w: winW, h: winH, delay: `${((seed % 1) * 8).toFixed(2)}s` })
      }
    }
  }

  return windows
}

export function LiveBackdrop() {
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const backWindows = useMemo(() => backBuildings.flatMap((building) => windowsFor(building, 'back')), [])
  const frontWindows = useMemo(() => frontBuildings.flatMap((building) => windowsFor(building, 'front')), [])

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
      <svg className="moonlit-city" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="nightSky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#07101c" />
            <stop offset="46%" stopColor="#050a13" />
            <stop offset="78%" stopColor="#02050a" />
            <stop offset="100%" stopColor="#010204" />
          </linearGradient>
          <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#efe7b4" stopOpacity="0.9" />
            <stop offset="48%" stopColor="#d8d094" stopOpacity="0.62" />
            <stop offset="74%" stopColor="#d8d094" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#d8d094" stopOpacity="0" />
          </radialGradient>
          <filter id="softBlur">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        </defs>

        <rect width="1600" height="900" fill="url(#nightSky)" />
        <ellipse cx="1320" cy="308" rx="138" ry="88" fill="#8d9998" opacity="0.08" />
        <circle className="city-moon" cx="1344" cy="312" r="54" fill="url(#moonGlow)" />
        <circle cx="1344" cy="312" r="18" fill="#f0e9bb" opacity="0.86" />

        <g className="cloud-bank cloud-back" filter="url(#softBlur)">
          <ellipse cx="210" cy="180" rx="260" ry="95" fill="#1a222d" opacity="0.72" />
          <ellipse cx="520" cy="135" rx="330" ry="110" fill="#111720" opacity="0.82" />
          <ellipse cx="870" cy="210" rx="270" ry="92" fill="#2b333a" opacity="0.38" />
          <ellipse cx="1230" cy="190" rx="340" ry="105" fill="#10151c" opacity="0.86" />
        </g>

        <g className="cloud-bank cloud-front" filter="url(#softBlur)">
          <ellipse cx="310" cy="330" rx="290" ry="76" fill="#05080d" opacity="0.72" />
          <ellipse cx="740" cy="280" rx="390" ry="90" fill="#30383b" opacity="0.24" />
          <ellipse cx="1160" cy="360" rx="320" ry="86" fill="#06090e" opacity="0.86" />
          <ellipse cx="1430" cy="272" rx="250" ry="74" fill="#2b3438" opacity="0.2" />
        </g>

        <path d="M0 625 C220 560 340 610 510 565 C720 510 830 590 1020 540 C1240 495 1360 565 1600 510 L1600 900 L0 900 Z" fill="#050910" opacity="0.84" />
        <path d="M0 690 C260 620 380 685 570 640 C820 585 980 675 1160 620 C1350 565 1450 645 1600 610 L1600 900 L0 900 Z" fill="#02050a" opacity="0.94" />

        <g className="city-back-layer">
          {backBuildings.map(([x, y, w, h], index) => (
            <rect key={`back-${index}`} x={x} y={y} width={w} height={h} fill={index % 3 === 0 ? '#04080e' : '#03070c'} />
          ))}
          {backWindows.map((win, index) => (
            <rect className="city-window dim" key={`back-win-${index}`} x={win.x} y={win.y} width={win.w} height={win.h} style={{ animationDelay: win.delay }} />
          ))}
        </g>

        <g className="city-front-layer">
          {frontBuildings.map(([x, y, w, h], index) => (
            <g key={`front-${index}`}>
              <rect x={x} y={y} width={w} height={h} fill={index % 2 === 0 ? '#010307' : '#02050a'} />
              {index % 4 === 1 && <path d={`M ${x} ${y} L ${x + w / 2} ${y - 30} L ${x + w} ${y} Z`} fill="#010307" />}
              {index % 5 === 2 && <rect x={x + w / 2 - 1} y={y - 42} width="2" height="42" fill="#070b10" />}
            </g>
          ))}
          {frontWindows.map((win, index) => (
            <rect className="city-window" key={`front-win-${index}`} x={win.x} y={win.y} width={win.w} height={win.h} style={{ animationDelay: win.delay }} />
          ))}
        </g>

        <g className="low-fog" filter="url(#softBlur)">
          <ellipse cx="220" cy="730" rx="300" ry="52" fill="#879094" opacity="0.12" />
          <ellipse cx="780" cy="710" rx="420" ry="58" fill="#74808a" opacity="0.1" />
          <ellipse cx="1280" cy="724" rx="350" ry="52" fill="#899294" opacity="0.11" />
        </g>

        <rect width="1600" height="900" fill="url(#centerShade)" opacity="0" />
      </svg>
      <div className="moonlit-vignette" />
    </div>
  )
}
