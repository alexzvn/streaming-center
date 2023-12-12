import { t } from 'elysia'
import { nanoid } from 'nanoid'
import { d_id } from '~/plugins/RequestClient'
import { CommentDTO } from '~/plugins/SimpleDatabase'
import { queues } from '~/services/PushTextStream'
import { groups, holder } from '../sockets/comment'
import { createWriteStream } from 'fs'
import { asset } from '~/utils/misc'
import { worker } from '~/services/PushAudioStream'
import { unlink } from 'fs/promises'
import { AxiosError } from 'axios'

const { app } = global

const validate = {
  comment: {
    body: t.Object({
      user: t.String({ maxLength: 200 }),
      content: t.String({ maxLength: 5000 }),
    }),
  },
  audio: {
    body: t.Object({
      audio: t.String()
    })
  },

  audioFile: {
    body: t.Object({
      audio: t.File({ type: ['audio'], maxSize: '200m' })
    })
  }
}

app.get('/api/feed', ({ db, set }) => {
  return db.data.streams
    .map((stream) => ({
      id: stream.id,
      prompt: stream.prompt,
      avatar: stream.avatar,
      updated_at: stream.updated_at,
    }))
    .sort((a, b) => b.updated_at - a.updated_at)
})

app.post('/api/feed/:id/comment', ({ body, params, db, set }) => {
  const stream = db.data.streams.find((stream) => stream.id === params.id)

  if (!stream) {
    set.status = 'Not Found'
    return { error: 'Stream not found' }
  }

  const comment: CommentDTO = {
    id: nanoid(),
    stream_id: stream.id,
    sender: body.user,
    message: body.content,
    created_at: Date.now(),
  }

  db.data.comments.push(comment)
  db.write()

  queues.get(stream.id)?.push({ comment })

  return comment
}, validate.comment)

app.post('/api/feed/comment/passthrough', ({ body, db, set }) => {
  const stream = db.data.streams.sort((a, b) => b.updated_at - a.updated_at)[0]

  if (!stream) {
    set.status = 'Not Found'
    return { error: 'Stream not found' }
  }

  const group = groups.get(stream.id)

  if (! group || group.size < 1) {
    return 'No one is listening to this stream'
  }

  for (const id of group) {
    const ws = holder.get(id)

    if (!ws) continue

    ws.send(JSON.stringify({
      user: body.user,
      message: body.content
    }))

    console.log('passthrough', id, stream.id, body)
  }
}, validate.comment)

app.post('/api/feed/:id/comment/passthrough', ({ body, params, db, set }) => {
  const stream = db.data.streams.find((stream) => stream.id === params.id)

  if (!stream) {
    set.status = 'Not Found'
    return { error: 'Stream not found' }
  }

  const group = groups.get(params.id)

  if (! group || group.size < 1) {
    return 'No one is listening to this stream'
  }

  for (const id of group) {
    const ws = holder.get(id)

    if (!ws) continue

    ws.send(JSON.stringify({
      user: body.user,
      message: body.content
    }))

    console.log('passthrough', id, params.id, body)
  }

}, validate.comment)

app.post('/api/feed/:id/audio', async ({ body, params, db, set }) => {
  const stream = db.data.streams.find((stream) => stream.id === params.id)

  if (!stream) {
    set.status = 'Not Found'
    return { error: 'Stream not found' }
  }

  const response = await d_id.post(`talks/streams/${stream.stream_id}`, {
    script: {
      type: 'audio',
      audio_url: body.audio,
    },
    driver_url: 'bank://lively/',
    config: { stitch: true },
    session_id: stream.session_id,
  })

  return response.data
}, validate.audio)


app.post('/api/feed/:id/audio/file', async ({ body, params, db }) => {
  const id = nanoid()
  const ext = body.audio.name.split('.').pop()!

  const storage = `./public/upload/${id}.${ext}`
  const url = asset(`/public/upload/${id}.${ext}`)

  createWriteStream(storage).end(Buffer.from(await body.audio.arrayBuffer()))

  const stream = db.data.streams.find(s => s.id === params.id)

  if (!stream) {
    return `Stream ${params.id} not found`
  }

  await d_id.post(`talks/streams/${stream.stream_id}`, {
    script: {
      type: 'audio',
      audio_url: url,
    },
    driver_url: 'bank://lively/',
    config: { stitch: true },
    session_id: stream.session_id,
  })
  .then(data => console.log(data.data))
  .catch((error: AxiosError) => console.log(error.response?.data))
  .finally(() => unlink(storage))

  return { url }
}, validate.audioFile)