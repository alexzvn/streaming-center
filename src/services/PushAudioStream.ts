import { d_id } from '~/plugins/RequestClient'
import { defineWorkerQueue } from '~/utils/WorkerQueue'
import { unlink } from 'fs/promises'

interface WorkerJob {
  /**
   * ID of the stream save in storage
   */
  id: string

  /**
   * Relative path to the audio file count from root of the project
   */
  storage_path: string

  /**
   * Absolute URL to the audio file
   */
  url: string
}

export const worker = defineWorkerQueue(async (data: WorkerJob) => {
  const { db } = global.state

  const stream = db.data.streams.find(s => s.id === data.id)

  if (!stream) {
    return
  }

  await d_id.post(`talks/streams/${stream.stream_id}`, {
    script: {
      type: 'audio',
      audio_url: data.url,
    },
    driver_url: 'bank://lively/',
    config: { stitch: true },
    session_id: stream.session_id,
  }).finally(() => unlink(data.storage_path))
}, { concurrent: 5 })