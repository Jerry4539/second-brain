import { useCallback, useEffect, useRef } from 'react'
import {
  buildFallbackSvgDataUrl,
  handleMochiHiggsMake,
  handleMochiNativeAsk,
  handleMochiRewrite,
  type MochiBoardSnapshot,
} from '../lib/mochiCanvasAgent'
import { generateImage, readImageDataUrl } from '../lib/imageEngine'
import { getSetting, insertImage, listModels, setSetting } from '../lib/db'
import { useToast } from '../lib/toast'

interface SecondBrainCanvasHost {
  ask: (
    prompt: string,
    snapshot: MochiBoardSnapshot,
    confirmed?: boolean,
    opts?: { mobbin?: boolean; higgs?: boolean },
  ) => Promise<string>
  rewrite: (text: string, how: string, title?: string, around?: string[]) => Promise<string>
  higgsMake: (o: { images?: Array<{ id: string; label?: string; w?: number; h?: number }> }) => Promise<string>
  drawFill: (o: { images?: Array<{ id: string; label?: string; w?: number; h?: number }> }) => Promise<string>
  syncStorage: (payload: { index: string; folders: string }) => void
  notify: (message: string) => void
}

interface CanvasImageJobBridge {
  start: (jobId: string, prompt: string) => string | null
  finish: (jobId: string, dataUrl: string, caption?: string) => boolean
  cancel: (jobId: string) => void
}

declare global {
  interface Window {
    __SECOND_BRAIN_CANVAS_HOST__?: SecondBrainCanvasHost
    __SB_CANVAS_IMAGE_JOB__?: CanvasImageJobBridge
    __SB_CANVAS_IMG_CONFIG__?: { steps?: number; res?: number }
  }
}

export function CanvasPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { showToast } = useToast()

  const handleGenerateCanvasImage = useCallback(
    async (prompt: string, opts?: { showCard?: boolean }): Promise<string | null> => {
      const showCard = opts?.showCard !== false
      const jobBridge = iframeRef.current?.contentWindow?.__SB_CANVAS_IMAGE_JOB__
      const jobId = `canvas-job-${Date.now()}`
      if (showCard) {
        jobBridge?.start(jobId, prompt)
      }

      try {
        const imageModels = await listModels('image')
        const activeModel = imageModels.find((m) => m.is_default === 1) ?? imageModels[0]
        if (!activeModel) {
          const fallbackUrl = buildFallbackSvgDataUrl(prompt, 0)
          if (showCard) {
            jobBridge?.finish(jobId, fallbackUrl, prompt)
          }
          showToast(
            'No local Stable Diffusion model installed — created an SVG concept card instead.',
            'info',
          )
          return fallbackUrl
        }

        const lowerModel = `${activeModel.name} ${activeModel.path} ${activeModel.architecture ?? ''}`.toLowerCase()
        const isLcm = lowerModel.includes('lcm')
        const isTurbo = lowerModel.includes('turbo')
        const isFast = isLcm || isTurbo

        const [savedSteps, savedRes, savedCfg, savedSampler] = await Promise.all([
          getSetting('image_gen_steps'),
          getSetting('image_gen_resolution'),
          getSetting('image_gen_cfg'),
          getSetting('image_gen_sampler'),
        ])
        const iframeCfg = iframeRef.current?.contentWindow?.__SB_CANVAS_IMG_CONFIG__

        const parsedRes = Number(iframeCfg?.res || savedRes || 384)
        const dim = parsedRes === 512 || parsedRes === 768 ? parsedRes : 384
        const width = dim
        const height = dim

        const parsedSteps = Number(iframeCfg?.steps || savedSteps || (isFast ? 6 : 8))
        const steps = !isNaN(parsedSteps) && parsedSteps >= 2 && parsedSteps <= 30 ? parsedSteps : (isFast ? 6 : 8)

        const parsedCfg = savedCfg ? parseFloat(savedCfg) : NaN
        const cfgScale = !isNaN(parsedCfg) && parsedCfg > 0 ? parsedCfg : (isFast ? 1.0 : 5.0)
        const samplingMethod = savedSampler || (isLcm ? 'lcm' : 'euler_a')

        const { result, cancel } = generateImage({
          modelPath: activeModel.path,
          prompt,
          width,
          height,
          steps,
          cfgScale,
          samplingMethod,
        })

        let timeoutHandle: ReturnType<typeof setTimeout> | null = null
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            cancel()
            reject(new Error('Canvas image generation timed out after 45s'))
          }, 45_000)
        })

        const filePath = await Promise.race([result, timeoutPromise]).finally(() => {
          if (timeoutHandle) clearTimeout(timeoutHandle)
        })

        const dataUrl = await readImageDataUrl(filePath)
        await insertImage({
          id: `canvas-img-${Date.now()}`,
          prompt,
          negativePrompt: null,
          filePath,
          seed: null,
          steps,
          modelId: activeModel.id,
          width,
          height,
        })
        if (showCard) {
          jobBridge?.finish(jobId, dataUrl, prompt)
        }
        showToast('AI image rendered right on your Canvas!', 'success')
        return dataUrl
      } catch (err) {
        console.warn('Canvas AI image generation fallback:', err)
        const fallbackUrl = buildFallbackSvgDataUrl(prompt, 0)
        if (showCard) {
          jobBridge?.finish(jobId, fallbackUrl, prompt)
        }
        return fallbackUrl
      }
    },
    [showToast],
  )

  useEffect(() => {
    const host: SecondBrainCanvasHost = {
      ask: (prompt, snapshot, confirmed = false, opts = {}) =>
        handleMochiNativeAsk(prompt, snapshot, confirmed, opts, {
          onGenerateImage: handleGenerateCanvasImage,
          onNotify: (msg) => showToast(msg, 'info'),
        }),
      rewrite: (text, how, title, around) => handleMochiRewrite(text, how, title, around),
      higgsMake: (o) =>
        handleMochiHiggsMake(o, {
          onGenerateImage: handleGenerateCanvasImage,
          onNotify: (msg) => showToast(msg, 'info'),
        }),
      drawFill: (o) =>
        handleMochiHiggsMake(o, {
          onGenerateImage: handleGenerateCanvasImage,
          onNotify: (msg) => showToast(msg, 'info'),
        }),
      syncStorage: ({ index, folders }) => {
        setSetting('canvas_mochiboard_index', index).catch(() => { })
        setSetting('canvas_mochiboard_folders', folders).catch(() => { })
      },
      notify: (message) => {
        showToast(message, 'info')
      },
    }

    window.__SECOND_BRAIN_CANVAS_HOST__ = host
    return () => {
      if (window.__SECOND_BRAIN_CANVAS_HOST__ === host) {
        delete window.__SECOND_BRAIN_CANVAS_HOST__
      }
    }
  }, [handleGenerateCanvasImage, showToast])

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#131118]">
      <iframe
        ref={iframeRef}
        src="/mochiboard/index.html?v=sb14"
        title="Canvas"
        className="h-full w-full border-0"
        allow="microphone; camera; clipboard-read; clipboard-write"
      />
    </div>
  )
}
