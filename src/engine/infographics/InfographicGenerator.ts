import type { ColorPalette } from '@/engine/design/ColorDesignEngine'

export type InfographicType =
  | 'bar_chart'
  | 'line_chart'
  | 'process_flow'
  | 'comparison'
  | 'stat_callout'
  | 'timeline_milestones'
  | 'code_snippet'

export interface InfographicData {
  type: InfographicType
  title: string
  subtitle?: string
  items: Array<{
    label: string
    value?: number | string
    sublabel?: string
    icon?: string
    color?: string
  }>
  animationDurationSeconds?: number
}

/**
 * 7.4 Infographic and Explanation Animation Generator
 * Generates self-contained HTML/CSS/JS snippets for visual infographics that render smoothly on canvas/video.
 */
export class InfographicGenerator {
  private static instance: InfographicGenerator

  public static getInstance(): InfographicGenerator {
    if (!InfographicGenerator.instance) {
      InfographicGenerator.instance = new InfographicGenerator()
    }
    return InfographicGenerator.instance
  }

  /**
   * Compile Infographic Data into self-contained HTML document
   */
  public generateHtml(data: InfographicData, palette: ColorPalette): string {
    const primary = palette.primary
    const accent = palette.accent
    const textPrimary = palette.textPrimary
    const textSecondary = palette.textSecondary
    const surface = palette.surface

    let bodyContent = ''

    if (data.type === 'bar_chart') {
      const maxVal = Math.max(...data.items.map((i) => (typeof i.value === 'number' ? i.value : 100)), 1)
      const barsHtml = data.items
        .map((item, idx) => {
          const num = typeof item.value === 'number' ? item.value : 50
          const pct = Math.round((num / maxVal) * 100)
          const delay = (idx * 0.2).toFixed(2)
          return `
            <div class="bar-group" style="animation-delay: ${delay}s;">
              <div class="bar-label">${item.label}</div>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${pct}%; background: ${item.color || primary}; animation-delay: ${delay}s;">
                  <span class="bar-val">${item.value ?? ''}</span>
                </div>
              </div>
            </div>
          `
        })
        .join('')

      bodyContent = `
        <div class="infographic-card">
          <div class="header">
            <h2>${data.title}</h2>
            ${data.subtitle ? `<p>${data.subtitle}</p>` : ''}
          </div>
          <div class="chart-container">
            ${barsHtml}
          </div>
        </div>
      `
    } else if (data.type === 'stat_callout') {
      const statsHtml = data.items
        .map((item, idx) => {
          const delay = (idx * 0.15).toFixed(2)
          return `
            <div class="stat-card" style="animation-delay: ${delay}s; border-color: ${item.color || primary}40;">
              <div class="stat-val" style="color: ${item.color || primary};">${item.value ?? '100%'}</div>
              <div class="stat-label">${item.label}</div>
              ${item.sublabel ? `<div class="stat-sub">${item.sublabel}</div>` : ''}
            </div>
          `
        })
        .join('')

      bodyContent = `
        <div class="infographic-card">
          <div class="header">
            <h2>${data.title}</h2>
            ${data.subtitle ? `<p>${data.subtitle}</p>` : ''}
          </div>
          <div class="stats-grid">
            ${statsHtml}
          </div>
        </div>
      `
    } else if (data.type === 'process_flow') {
      const stepsHtml = data.items
        .map((item, idx) => {
          const delay = (idx * 0.25).toFixed(2)
          return `
            <div class="flow-step" style="animation-delay: ${delay}s;">
              <div class="step-num" style="background: ${primary};">${idx + 1}</div>
              <div class="step-content">
                <div class="step-title">${item.label}</div>
                ${item.sublabel ? `<div class="step-desc">${item.sublabel}</div>` : ''}
              </div>
            </div>
            ${idx < data.items.length - 1 ? `<div class="flow-arrow" style="animation-delay: ${(idx * 0.25 + 0.1).toFixed(2)}s;">→</div>` : ''}
          `
        })
        .join('')

      bodyContent = `
        <div class="infographic-card">
          <div class="header">
            <h2>${data.title}</h2>
            ${data.subtitle ? `<p>${data.subtitle}</p>` : ''}
          </div>
          <div class="flow-container">
            ${stepsHtml}
          </div>
        </div>
      `
    } else {
      // Comparison / Generic
      const itemsHtml = data.items
        .map((item, idx) => `
          <div class="compare-row" style="animation-delay: ${(idx * 0.15).toFixed(2)}s;">
            <span class="compare-dot" style="background: ${item.color || primary};"></span>
            <div class="compare-text">
              <strong>${item.label}</strong>
              ${item.sublabel ? `<p>${item.sublabel}</p>` : ''}
            </div>
          </div>
        `)
        .join('')

      bodyContent = `
        <div class="infographic-card">
          <div class="header">
            <h2>${data.title}</h2>
            ${data.subtitle ? `<p>${data.subtitle}</p>` : ''}
          </div>
          <div class="compare-list">
            ${itemsHtml}
          </div>
        </div>
      `
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: ${palette.fontFamily}; }
    body {
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
    .infographic-card {
      background: ${surface}f0;
      backdrop-filter: blur(16px);
      border: 1px solid ${primary}40;
      border-radius: 20px;
      padding: 28px 36px;
      width: 90%;
      max-width: 860px;
      color: ${textPrimary};
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
      animation: cardAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes cardAppear {
      from { opacity: 0; transform: translateY(24px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .header h2 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: ${palette.gradient};
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 4px;
    }
    .header p {
      font-size: 14px;
      color: ${textSecondary};
      margin-bottom: 20px;
    }
    .chart-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bar-group {
      display: flex;
      align-items: center;
      gap: 16px;
      opacity: 0;
      animation: fadeIn 0.4s ease forwards;
    }
    .bar-label {
      width: 130px;
      font-size: 13px;
      font-weight: 600;
      color: ${textPrimary};
      text-align: right;
      flex-shrink: 0;
    }
    .bar-track {
      flex: 1;
      height: 28px;
      background: rgba(255,255,255,0.06);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
    }
    .bar-fill {
      height: 100%;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
      width: 0%;
      animation: fillBar 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fillBar {
      from { width: 0%; }
    }
    .bar-val {
      font-size: 12px;
      font-weight: 800;
      color: #fff;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }
    .stat-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: 16px 20px;
      text-align: center;
      opacity: 0;
      animation: popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .stat-val {
      font-size: 34px;
      font-weight: 900;
      line-height: 1.1;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 13px;
      font-weight: 700;
      color: ${textPrimary};
    }
    .stat-sub {
      font-size: 11px;
      color: ${textSecondary};
      margin-top: 2px;
    }
    .flow-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .flow-step {
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0;
      animation: fadeIn 0.4s ease forwards;
    }
    .step-num {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      color: #fff;
      flex-shrink: 0;
    }
    .step-title {
      font-size: 14px;
      font-weight: 700;
    }
    .step-desc {
      font-size: 11px;
      color: ${textSecondary};
    }
    .flow-arrow {
      font-size: 20px;
      color: ${accent};
      opacity: 0;
      animation: fadeIn 0.4s ease forwards;
    }
    @keyframes fadeIn {
      to { opacity: 1; }
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`
  }
}

export const infographicGenerator = InfographicGenerator.getInstance()
