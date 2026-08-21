import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project, Asset } from '@/engine/types'

export interface ExportJob {
  id: string
  projectName: string
  project: Project
  assets: Asset[]
  options: ExportOptions
  format: 'webm' | 'mp4'
  codec: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  progress: number
  totalFrames: number
  currentFrame: number
  createdAt: number
  updatedAt: number
  error?: string
  blobUrl?: string
  filename: string
  checkpoints: Checkpoint[]
  currentCheckpointIndex: number
}

export interface ExportOptions {
  width: number
  height: number
  fps: number
  bitrate: number
  codec: 'vp8' | 'vp9' | 'av1' | 'h264'
  format: 'webm' | 'mp4'
  masterVolume?: number
  muted?: boolean
  includeAudio?: boolean
  onProgress: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface Checkpoint {
  frameIndex: number
  timestamp: number
  muxerState: Uint8Array
  encoderState: Uint8Array
  mediaElementStates: Map<string, { currentTime: number }>
  createdAt: number
}

const DB_NAME = 'clipforge-export-queue'
const STORE_NAME = 'export-jobs'
const DB_VERSION = 1

interface ExportQueueDB extends DBSchema {
  [STORE_NAME]: {
    key: string
    value: ExportJob
    indexes: { status: string; createdAt: number; updatedAt: number }
  }
}

async function getDB(): Promise<IDBPDatabase<ExportQueueDB>> {
  return openDB<ExportQueueDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('status', 'status')
        store.createIndex('createdAt', 'createdAt')
        store.createIndex('updatedAt', 'updatedAt')
      }
    },
  })
}

export class ExportQueue {
  private abortControllers: Map<string, AbortController> = new Map()
  private statusListeners: Map<string, Set<(job: ExportJob) => void>> = new Map()
  private isProcessing = false
  private maxConcurrent = 1

  async addJob(job: Omit<ExportJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'progress' | 'totalFrames' | 'currentFrame' | 'checkpoints' | 'currentCheckpointIndex'>): Promise<string> {
    const db = await getDB()
    const id = crypto.randomUUID()
    const now = Date.now()
    const jobData: ExportJob = {
      ...job,
      id,
      status: 'pending',
      progress: 0,
      totalFrames: 0,
      currentFrame: 0,
      createdAt: now,
      updatedAt: now,
      checkpoints: [],
      currentCheckpointIndex: -1,
    }
    await db.put(STORE_NAME, jobData)
    this.notifyListeners(jobData)
    this.processQueue()
    return id
  }

  async getJob(id: string): Promise<ExportJob | undefined> {
    const db = await getDB()
    return db.get(STORE_NAME, id)
  }

  async getAllJobs(): Promise<ExportJob[]> {
    const db = await getDB()
    return db.getAllFromIndex(STORE_NAME, 'updatedAt')
  }

  async getJobsByStatus(status: ExportJob['status']): Promise<ExportJob[]> {
    const db = await getDB()
    return db.getAllFromIndex(STORE_NAME, 'status', status)
  }

  async updateJob(id: string, updates: Partial<ExportJob>): Promise<void> {
    const db = await getDB()
    const job = await db.get(STORE_NAME, id)
    if (!job) throw new Error(`Job ${id} not found`)
    const updated = { ...job, ...updates, updatedAt: Date.now() }
    await db.put(STORE_NAME, updated)
    this.notifyListeners(updated)
  }

  async deleteJob(id: string): Promise<void> {
    const db = await getDB()
    await db.delete(STORE_NAME, id)
    this.notifyListeners({ id, status: 'cancelled', projectName: '', project: {} as any, assets: [], options: {} as any, format: 'webm', codec: '', progress: 0, totalFrames: 0, currentFrame: 0, createdAt: 0, updatedAt: Date.now(), filename: '', checkpoints: [], currentCheckpointIndex: -1 } as ExportJob)
  }

  async pauseJob(id: string): Promise<void> {
    const job = await this.getJob(id)
    if (!job || job.status !== 'running') return

    const controller = this.abortControllers.get(id)
    controller?.abort()

    await this.updateJob(id, {
      status: 'paused',
      updatedAt: Date.now(),
    })
  }

  async resumeJob(id: string): Promise<void> {
    const job = await this.getJob(id)
    if (!job || job.status !== 'paused') return

    await this.updateJob(id, {
      status: 'pending',
      updatedAt: Date.now(),
    })
    this.processQueue()
  }

  async retryJob(id: string): Promise<void> {
    const job = await this.getJob(id)
    if (!job || job.status !== 'failed') return

    await this.updateJob(id, {
      status: 'pending',
      error: undefined,
      progress: 0,
      currentFrame: 0,
      updatedAt: Date.now(),
    })
    this.processQueue()
  }

  async cancelJob(id: string): Promise<void> {
    const job = await this.getJob(id)
    if (!job || ['completed', 'cancelled'].includes(job.status)) return

    const controller = this.abortControllers.get(id)
    controller?.abort()

    await this.updateJob(id, {
      status: 'cancelled',
      updatedAt: Date.now(),
    })
  }

  subscribe(id: string, listener: (job: ExportJob) => void): () => void {
    if (!this.statusListeners.has(id)) {
      this.statusListeners.set(id, new Set())
    }
    this.statusListeners.get(id)!.add(listener)
    return () => {
      this.statusListeners.get(id)?.delete(listener)
    }
  }

  private notifyListeners(job: ExportJob): void {
    const listeners = this.statusListeners.get(job.id)
    if (listeners) {
      listeners.forEach((listener) => listener(job))
    }
    const allListeners = this.statusListeners.get('*')
    if (allListeners) {
      allListeners.forEach((listener) => listener(job))
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      while (true) {
        const pendingJobs = await this.getJobsByStatus('pending')
        if (pendingJobs.length === 0) break

        const runningJobs = await this.getJobsByStatus('running')
        if (runningJobs.length >= this.maxConcurrent) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          continue
        }

        const job = pendingJobs[0]
        await this.runJob(job)
      }
    } finally {
      this.isProcessing = false
    }
  }

  private async runJob(job: ExportJob): Promise<void> {
    await this.updateJob(job.id, { status: 'running', updatedAt: Date.now() })

    const controller = new AbortController()
    // Store controller reference
    const controllers = (this as any).abortControllers
    controllers.set(job.id, controller)

    try {
      const { exportProject } = await import('./exportVideo')
      const { exportMp4 } = await import('./exportMp4')

      const shared = {
        width: job.options.width,
        height: job.options.height,
        fps: job.options.fps,
        bitrate: job.options.bitrate,
        format: job.format,
        masterVolume: job.options.masterVolume,
        muted: job.options.muted,
        includeAudio: job.options.includeAudio,
        onProgress: (done: number, totalFrames: number) => {
          this.updateJob(job.id, {
            progress: done,
            totalFrames,
            currentFrame: done,
            updatedAt: Date.now(),
          })
        },
        signal: controller.signal,
      }

      const { blob, frames } = job.format === 'mp4'
        ? await exportMp4(job.project, job.assets, shared)
        : await exportProject(job.project, job.assets, {
            ...shared,
            codec: job.codec as 'vp8' | 'vp9' | 'av1',
          })

      const url = URL.createObjectURL(blob)

      await this.updateJob(job.id, {
        status: 'completed',
        progress: job.totalFrames,
        currentFrame: frames,
        blobUrl: url,
        updatedAt: Date.now(),
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        await this.updateJob(job.id, { status: 'paused', updatedAt: Date.now() })
      } else {
        await this.updateJob(job.id, {
          status: 'failed',
          error: e instanceof Error ? e.message : 'Export failed',
          updatedAt: Date.now(),
        })
      }
    } finally {
      const controllers = (this as any).abortControllers
      controllers.delete(job.id)
      this.processQueue()
    }
  }

  async saveCheckpoint(jobId: string, checkpoint: Checkpoint): Promise<void> {
    const job = await this.getJob(jobId)
    if (!job) return

    const checkpoints = [...job.checkpoints, checkpoint]
    if (checkpoints.length > 10) checkpoints.shift()

    await this.updateJob(jobId, {
      checkpoints,
      currentCheckpointIndex: checkpoints.length - 1,
      updatedAt: Date.now(),
    })
  }

  async getLatestCheckpoint(jobId: string): Promise<Checkpoint | null> {
    const job = await this.getJob(jobId)
    if (!job || job.checkpoints.length === 0) return null
    return job.checkpoints[job.currentCheckpointIndex]
  }
}

export const exportQueue = new ExportQueue()