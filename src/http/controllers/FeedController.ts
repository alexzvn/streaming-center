import { t } from 'elysia'
import { nanoid } from 'nanoid'
import { d_id } from '~/plugins/RequestClient'
import { CommentDTO } from '~/plugins/SimpleDatabase'
import { queues } from '~/services/PushTextStream'
import { groups, holder } from '../sockets/comment'

const { app } = global

const validate = {
  comment: {
    body: t.Object({
      user: t.String({ maxLength: 20 }),
      content: t.String({ maxLength: 500 }),
    }),
  },
  audio: {
    body: t.Object({
      audio: t.String()
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
