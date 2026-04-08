/**
 * TerraceView Canvas 합성 엔진
 * 바닥 마스크 영역에 텍스처를 multiply + screen blend로 합성
 */

export interface Point { x: number; y: number }

export class TerraceCanvasEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private baseImage: HTMLImageElement | null = null
  private maskPolygon: Point[] = []
  private currentMaterial: HTMLImageElement | null = null
  private opacity: number = 0.72

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  async loadBaseImage(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        this.baseImage = img
        this.canvas.width = img.naturalWidth
        this.canvas.height = img.naturalHeight
        this.drawBase()
        resolve()
      }
      img.onerror = reject
      img.src = src
    })
  }

  setMaskPolygon(points: Point[]): void {
    this.maskPolygon = points
    this.render()
  }

  async applyMaterial(materialSrc: string, opacity = 0.72): Promise<void> {
    this.opacity = opacity
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        this.currentMaterial = img
        this.render()
        resolve()
      }
      img.onerror = () => {
        // 텍스처 이미지 로드 실패 시 색상 폴백
        this.currentMaterial = null
        this.applyColorFallback(materialSrc)
        resolve()
      }
      img.src = materialSrc
    })
  }

  updateOpacity(opacity: number): void {
    this.opacity = opacity
    this.render()
  }

  reset(): void {
    this.currentMaterial = null
    this.drawBase()
  }

  download(filename = 'terrace-preview.png'): void {
    const link = document.createElement('a')
    link.download = filename
    link.href = this.canvas.toDataURL('image/png')
    link.click()
  }

  toDataURL(): string {
    return this.canvas.toDataURL('image/png')
  }

  private drawBase(): void {
    if (!this.baseImage) return
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(this.baseImage, 0, 0)
  }

  private render(): void {
    this.drawBase()
    if (this.maskPolygon.length < 3) return
    if (this.currentMaterial) {
      this.compositeTexture()
    }
  }

  /**
   * 핵심 합성 알고리즘
   * 1. 텍스처를 타일링하여 캔버스 크기 오프스크린 캔버스 생성
   * 2. 마스크 폴리곤으로 클리핑
   * 3. multiply blend (조명/그림자 보존)
   * 4. screen blend (어두운 영역 보정)
   */
  private compositeTexture(): void {
    const { canvas, ctx } = this
    const W = canvas.width, H = canvas.height
    const mat = this.currentMaterial!

    // 텍스처 타일링 오프스크린
    const texCanvas = document.createElement('canvas')
    texCanvas.width = W; texCanvas.height = H
    const texCtx = texCanvas.getContext('2d')!
    const tileW = Math.min(W * 0.35, 320)
    const tileH = tileW * (mat.naturalHeight / mat.naturalWidth)
    for (let tx = 0; tx < W + tileW; tx += tileW)
      for (let ty = 0; ty < H + tileH; ty += tileH)
        texCtx.drawImage(mat, tx, ty, tileW, tileH)

    // 마스크 오프스크린: 폴리곤 클리핑 후 blend
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = W; maskCanvas.height = H
    const maskCtx = maskCanvas.getContext('2d')!

    maskCtx.beginPath()
    maskCtx.moveTo(this.maskPolygon[0].x, this.maskPolygon[0].y)
    for (let i = 1; i < this.maskPolygon.length; i++)
      maskCtx.lineTo(this.maskPolygon[i].x, this.maskPolygon[i].y)
    maskCtx.closePath()
    maskCtx.clip()

    // step 1: multiply — 원본 조명/그림자 유지하면서 색상 입힘
    maskCtx.globalCompositeOperation = 'multiply'
    maskCtx.globalAlpha = this.opacity
    maskCtx.drawImage(texCanvas, 0, 0)

    // step 2: screen — 너무 어두워지는 영역 밝기 보정
    maskCtx.globalCompositeOperation = 'screen'
    maskCtx.globalAlpha = 0.20
    maskCtx.drawImage(texCanvas, 0, 0)

    // 메인 캔버스에 합성 결과 적용
    ctx.drawImage(maskCanvas, 0, 0)
  }

  /** 텍스처 이미지 없을 때 단색 폴백 */
  private applyColorFallback(materialSrc: string): void {
    const colorMap: Record<string, string> = {
      'mix-pastel': 'rgba(212,184,208,0.55)',
      'dark-gray': 'rgba(107,107,114,0.60)',
      'pink-marble': 'rgba(200,160,160,0.55)',
      'natural-stone': 'rgba(184,168,144,0.55)',
      'concrete': 'rgba(160,160,160,0.55)',
      'ipe': 'rgba(122,90,58,0.55)',
      'pine': 'rgba(200,160,112,0.55)',
    }
    const key = Object.keys(colorMap).find(k => materialSrc.includes(k))
    const color = key ? colorMap[key] : 'rgba(180,160,140,0.55)'

    if (this.maskPolygon.length < 3) return
    const { ctx } = this
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(this.maskPolygon[0].x, this.maskPolygon[0].y)
    for (let i = 1; i < this.maskPolygon.length; i++)
      ctx.lineTo(this.maskPolygon[i].x, this.maskPolygon[i].y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.globalCompositeOperation = 'multiply'
    ctx.fill()
    ctx.restore()
  }
}
