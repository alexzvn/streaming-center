import { CommentDTO } from '~/plugins/SimpleDatabase'
import { defineWorkerQueue } from '~/utils/WorkerQueue'

interface WorkerJob {
  comment: CommentDTO
  retries?: number
}

const handler = async ({ comment, retries = 0 }: WorkerJob) => {
  const { db } = global.state

  if (retries > 3) {
    return // TODO: report error
  }

  const stream = db.data.streams.find(s => s.id === comment.stream_id)

  if (!stream) {
    db.data.comments = db.data.comments.filter(c => c.id !== comment.id)
    return db.write()
  }

  // TODO: generate response text via ChatGPT
  // and convert to audio via TTS
  // then send to stream

  stream.updated_at = Date.now()

  db.data.streams = db.data.streams.map(s => s.id === stream.id ? stream : s)
  db.data.comments = db.data.comments.filter(c => c.id !== comment.id)
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
      queue!.prepend({ comment: data.comment, retries: (data.retries ?? 0) + 1 })
    },
    concurrent
  })

  queues.set(stream_id, queue)

  return queue
}
