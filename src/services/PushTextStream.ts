import { ChatGPTAPI } from 'chatgpt'
import { CommentDTO } from '~/plugins/SimpleDatabase'
import { defineWorkerQueue } from '~/utils/WorkerQueue'
import axios from 'axios'
import { envOrFail } from '~/utils/env'
import { d_id } from '~/plugins/RequestClient'

interface WorkerJob {
  comment: CommentDTO
  state?: Partial<{
    generated: string
    audio_url: string
    ready: true
  }>
  retries?: number
}

const fpt = axios.create({
  baseURL: 'https://api.fpt.ai',
  headers: {
    'api-key': envOrFail('FPT_AI_KEY'),
    voice: 'banmai',
    format: 'mp3',
  }
})

interface FPTResponse {
  async: string
  error: string
  request_id: string
  message: string
}

const chatgpt = new ChatGPTAPI({
  apiKey: envOrFail('OPENAI_KEY'),
  completionParams: {
    model: 'gpt-4'
  }
})

const handler = async (job: WorkerJob) => {
  const { db } = global.state

  job.retries ??= 0
  job.state ??= {}

  if (job.retries > 3) {
    return // TODO: report error
  }

  const stream = db.data.streams.find(s => s.id === job.comment.stream_id)

  if (!stream) {
    db.data.comments = db.data.comments.filter(c => c.id !== job.comment.id)
    return db.write()
  }


  /**
   * Generate text from comment
   */
  if (!job.state.generated) {
    const message = `${job.comment.sender}: ${job.comment.message}`
    const generated = await chatgpt.sendMessage(message, {
      systemMessage: stream.prompt
    })

    job.state.generated = generated.text
    job.retries = 0
  }

  /**
   * Convert text to audio
   */
  if (! job.state.audio_url) {
    const { data } = await fpt.post<FPTResponse>('/hmi/tts/v5', job.state.generated, {
      headers: {
        voice: stream.tts.voice || 'banmai',
        speed: stream.tts.speed || 0
      }
    })

    if (data.error) {
      throw new Error(data.message)
    }

    job.state.audio_url = data.async
    job.retries = 0
  }

  /**
   * Check if audio is ready
   */
  job.state.ready ??= await new Promise<true>((resolve, reject) => {
    const checker = setInterval(() => {
      let finished = false
      const controller = new AbortController()

      fetch(job.state!.audio_url!, { signal: controller.signal })
        .then(res => res.ok && [resolve(true), clearInterval(checker)])
        .catch(() => undefined) // ignore error and retry
        .finally(() => finished = true)

      setTimeout(() => !finished && controller.abort(), 1_000)
    }, 500)

    setTimeout(() => {
      clearInterval(checker)
      reject(new Error(`Timeout waiting for audio ${job.state!.audio_url}`))
    }, 10_000)
  })

  /**
   * Push audio to the stream
   */
  await d_id.post(`talks/streams/${stream.stream_id}`, {
    script: {
      type: 'audio',
      audio_url: job.state.audio_url,
    },
    driver_url: 'bank://lively/',
    config: { stitch: true },
    session_id: stream.session_id,
  })

  stream.updated_at = Date.now()

  db.data.streams = db.data.streams.map(s => s.id === stream.id ? stream : s)
  db.data.comments = db.data.comments.filter(c => c.id !== job.comment.id)
  return db.write()
}


export const queues = new Map<string, ReturnType<typeof defineWorkerQueue<WorkerJob>>>()

export const destroyHandlerQueue = async (stream_id: string) => {
  const queue = queues.get(stream_id)

  if (queue) {
    await queue.stop()
    queues.delete(stream_id)
  }
}

export const createHandlerQueue = async (stream_id: string, concurrent = 5) => {
  if (queues.has(stream_id)) {
    console.warn(`Queue for stream ${stream_id} already exists. Auto destroy it...`)
    await destroyHandlerQueue(stream_id)
  }

  const queue = defineWorkerQueue(handler, {
    onError: (error, data) => {
      console.error(error)
      queue!.prepend({ ...data, retries: (data.retries ?? 0) + 1 })
    },
    concurrent
  })

  queues.set(stream_id, queue)

  return queue
}
