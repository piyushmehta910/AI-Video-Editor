export interface MotionPreset {
  id: string
  name: string
  category: 'Typography' | 'Data / Charts' | 'Sci-Fi / HUD' | 'Overlay' | 'WebGL Particles'
  description: string
  type: 'canvas' | 'webgl'
  defaultDuration: number
  code: string
}

export const BUILTIN_MOTION_PRESETS: MotionPreset[] = [
  {
    id: 'kinetic-title',
    name: 'Kinetic Title Sequence',
    category: 'Typography',
    description: 'Dynamic kinetic typography with gradient background and smooth scale entrance',
    type: 'canvas',
    defaultDuration: 5,
    code: `window.__ANIMATE = function (ctx, t, w, h) {
  // Clear and render rich dark gradient backdrop
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7)
  grad.addColorStop(0, '#1e1b4b')
  grad.addColorStop(1, '#090714')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Title easing calculations
  const easeOutExpo = (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x))
  const pTitle = easeOutExpo(Math.min(1, t * 2.2))
  const pSub = easeOutExpo(Math.max(0, Math.min(1, (t - 0.25) * 2.0)))
  const pLine = easeOutExpo(Math.max(0, Math.min(1, (t - 0.4) * 2.5)))

  ctx.save()
  ctx.translate(w * 0.5, h * 0.46)

  // Glow underlay
  ctx.shadowColor = '#8b5cf6'
  ctx.shadowBlur = 40 * pTitle
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Main Title
  const titleSize = Math.max(28, Math.round(w * 0.065))
  ctx.font = '900 ' + titleSize + 'px system-ui, -apple-system, sans-serif'
  const titleScale = 0.85 + pTitle * 0.15
  ctx.save()
  ctx.scale(titleScale, titleScale)
  ctx.globalAlpha = pTitle
  ctx.fillText('NEXT GENERATION', 0, -titleSize * 0.4)
  ctx.fillText('CREATIVE STUDIO', 0, titleSize * 0.7)
  ctx.restore()

  // Accent Line
  ctx.shadowBlur = 0
  const lineWidth = w * 0.45 * pLine
  ctx.strokeStyle = '#06b6d4'
  ctx.lineWidth = Math.max(3, w * 0.004)
  ctx.beginPath()
  ctx.moveTo(-lineWidth * 0.5, titleSize * 1.5)
  ctx.lineTo(lineWidth * 0.5, titleSize * 1.5)
  ctx.stroke()

  // Subtitle
  const subSize = Math.max(14, Math.round(w * 0.022))
  ctx.font = '500 ' + subSize + 'px system-ui, sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.globalAlpha = pSub
  ctx.fillText('POWERED BY NEURAL MOTION GRAPHICS', 0, titleSize * 1.9 + (1 - pSub) * 20)

  ctx.restore()
};`,
  },
  {
    id: 'cyber-hud',
    name: 'Cyberpunk Telemetry HUD',
    category: 'Sci-Fi / HUD',
    description: 'Rotating holographic HUD rings, radar sweep, and telemetry target trackers',
    type: 'canvas',
    defaultDuration: 6,
    code: `window.__ANIMATE = function (ctx, t, w, h) {
  ctx.fillStyle = '#030712'
  ctx.fillRect(0, 0, w, h)

  const cx = w * 0.5
  const cy = h * 0.5
  const R = Math.min(w, h) * 0.35

  // Background Grid Matrix
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)'
  ctx.lineWidth = 1
  const step = 40
  for (let x = 0; x < w; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  // Outer Rotating Ring 1
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(t * Math.PI * 2)

  ctx.strokeStyle = '#06b6d4'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 1.5)
  ctx.stroke()

  // Tick marks
  ctx.strokeStyle = '#38bdf8'
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const x1 = Math.cos(a) * (R - 8)
    const y1 = Math.sin(a) * (R - 8)
    const x2 = Math.cos(a) * (R + 8)
    const y2 = Math.sin(a) * (R + 8)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.restore()

  // Inner Counter-Rotating Ring 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-t * Math.PI * 3)
  ctx.strokeStyle = '#ec4899'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.7, 0, Math.PI * 0.8)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.7, Math.PI, Math.PI * 1.8)
  ctx.stroke()
  ctx.restore()

  // Radar Sweep Beam
  ctx.save()
  ctx.translate(cx, cy)
  const sweepAngle = t * Math.PI * 4
  const sweepGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.95)
  sweepGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)')
  sweepGrad.addColorStop(1, 'rgba(6, 182, 212, 0)')
  ctx.fillStyle = sweepGrad
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, R * 0.95, sweepAngle - 0.4, sweepAngle)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Central Core & Status
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 ' + Math.max(12, Math.round(w * 0.016)) + 'px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('SYS.LOCK // ACTIVE', cx, cy - 12)

  const progressPct = Math.round(t * 100)
  ctx.fillStyle = '#06b6d4'
  ctx.fillText('SYNC: ' + progressPct + '%', cx, cy + 14)
};`,
  },
  {
    id: 'lower-third',
    name: 'Glassmorphic Lower Third',
    category: 'Overlay',
    description: 'Broadcast-ready transparent lower third with sliding accent bar and glass blur card',
    type: 'canvas',
    defaultDuration: 5,
    code: `window.__ANIMATE = function (ctx, t, w, h) {
  // Transparent backdrop for video compositing
  ctx.clearRect(0, 0, w, h)

  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)
  const easeInCubic = (x) => x * x * x

  // Enter in first 20%, stay, exit in last 20%
  let anim = 1
  if (t < 0.2) anim = easeOutCubic(t / 0.2)
  else if (t > 0.8) anim = 1 - easeInCubic((t - 0.8) / 0.2)

  const boxW = Math.min(w * 0.55, 620)
  const boxH = Math.max(70, h * 0.12)
  const boxX = w * 0.08 + (1 - anim) * -80
  const boxY = h * 0.78

  ctx.save()
  ctx.globalAlpha = anim

  // Glass card background
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxW, boxH, 12)
  ctx.fill()

  // Border stroke
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Left Gradient Accent Bar
  const barGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH)
  barGrad.addColorStop(0, '#8b5cf6')
  barGrad.addColorStop(1, '#06b6d4')
  ctx.fillStyle = barGrad
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, 8, boxH, [12, 0, 0, 12])
  ctx.fill()

  // Name Title
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 ' + Math.max(16, Math.round(boxH * 0.32)) + 'px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('SARAH CONNOR', boxX + 28, boxY + boxH * 0.36)

  // Subtitle / Designation
  ctx.fillStyle = '#38bdf8'
  ctx.font = '600 ' + Math.max(11, Math.round(boxH * 0.20)) + 'px system-ui, sans-serif'
  ctx.fillText('HEAD OF ARTIFICIAL INTELLIGENCE', boxX + 28, boxY + boxH * 0.70)

  ctx.restore()
};`,
  },
  {
    id: 'bar-metrics',
    name: 'Animated Metric Growth Graph',
    category: 'Data / Charts',
    description: 'Dynamic rising data columns with glowing neon gradients and percentage counters',
    type: 'canvas',
    defaultDuration: 5,
    code: `window.__ANIMATE = function (ctx, t, w, h) {
  ctx.fillStyle = '#090d16'
  ctx.fillRect(0, 0, w, h)

  const bars = [0.45, 0.72, 0.58, 0.89, 0.64, 0.95]
  const labels = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'TOTAL']
  const easeOutBack = (x) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
  }

  const cx = w * 0.5
  const chartW = w * 0.75
  const chartH = h * 0.55
  const startX = cx - chartW * 0.5
  const baseY = h * 0.75
  const barWidth = chartW / (bars.length * 1.6)

  // Title
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 ' + Math.max(18, Math.round(w * 0.03)) + 'px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('ANNUAL REVENUE TRAJECTORY', cx, h * 0.14)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 ' + Math.max(12, Math.round(w * 0.016)) + 'px system-ui, sans-serif'
  ctx.fillText('AI-Driven Automated Workflow Growth', cx, h * 0.19)

  // Base Axis Line
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(startX - 20, baseY)
  ctx.lineTo(startX + chartW + 20, baseY)
  ctx.stroke()

  bars.forEach((targetH, i) => {
    const delay = i * 0.1
    const p = Math.max(0, Math.min(1, (t - delay) / 0.5))
    const currentH = easeOutBack(p) * targetH * chartH
    const bx = startX + i * (chartW / bars.length) + barWidth * 0.3
    const by = baseY - Math.max(0, currentH)

    // Gradient bar
    const barGrad = ctx.createLinearGradient(bx, by, bx, baseY)
    barGrad.addColorStop(0, '#06b6d4')
    barGrad.addColorStop(1, '#6366f1')
    ctx.fillStyle = barGrad
    ctx.beginPath()
    ctx.roundRect(bx, by, barWidth, Math.max(4, currentH), [8, 8, 0, 0])
    ctx.fill()

    // Value Label above bar
    if (p > 0.4) {
      ctx.fillStyle = '#38bdf8'
      ctx.font = '700 ' + Math.max(10, Math.round(w * 0.014)) + 'px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('$' + Math.round(targetH * p * 100) + 'K', bx + barWidth * 0.5, by - 8)
    }

    // Category Label below bar
    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 ' + Math.max(10, Math.round(w * 0.014)) + 'px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(labels[i], bx + barWidth * 0.5, baseY + 24)
  })
};`,
  },
  {
    id: 'neural-flow',
    name: 'Neural Network Particles',
    category: 'WebGL Particles',
    description: 'WebGL-style interconnected particle network with glowing synaptic pulse lines',
    type: 'canvas',
    defaultDuration: 6,
    code: `window.__ANIMATE = function (ctx, t, w, h) {
  ctx.fillStyle = '#060814'
  ctx.fillRect(0, 0, w, h)

  const nodeCount = 28
  const nodes = []
  for (let i = 0; i < nodeCount; i++) {
    const angle = (i / nodeCount) * Math.PI * 2
    const baseR = Math.min(w, h) * (0.2 + (i % 3) * 0.08)
    const wobble = Math.sin(t * Math.PI * 2 + i * 1.5) * 25
    const nx = w * 0.5 + Math.cos(angle + t * 0.4) * (baseR + wobble)
    const ny = h * 0.5 + Math.sin(angle + t * 0.4) * (baseR + wobble)
    nodes.push({ x: nx, y: ny, id: i })
  }

  // Draw Interconnecting Synapse Lines
  ctx.lineWidth = 1
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x
      const dy = nodes[i].y - nodes[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const maxDist = Math.min(w, h) * 0.26
      if (dist < maxDist) {
        const alpha = (1 - dist / maxDist) * 0.5
        ctx.strokeStyle = 'rgba(139, 92, 246, ' + alpha + ')'
        ctx.beginPath()
        ctx.moveTo(nodes[i].x, nodes[i].y)
        ctx.lineTo(nodes[j].x, nodes[j].y)
        ctx.stroke()
      }
    }
  }

  // Draw Glowing Nodes
  nodes.forEach((node, i) => {
    const pulse = 0.8 + Math.sin(t * Math.PI * 4 + i) * 0.4
    const r = (4 + (i % 4) * 2) * pulse

    ctx.fillStyle = i % 2 === 0 ? '#06b6d4' : '#a855f7'
    ctx.shadowColor = ctx.fillStyle
    ctx.shadowBlur = 15
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
    ctx.fill()
  })

  // Center Core
  ctx.shadowBlur = 30
  ctx.shadowColor = '#06b6d4'
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(w * 0.5, h * 0.5, 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
};`,
  },
]
