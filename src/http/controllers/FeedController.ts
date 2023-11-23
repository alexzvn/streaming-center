import { t } from 'elysia'
import { nanoid } from 'nanoid'
import { CommentDTO } from '~/plugins/SimpleDatabase'

const { app } = global

const validate = {
  comment: {
    body: t.Object({
      user: t.String({ maxLength: 20 }),
      content: t.String({ maxLength: 500 }),
    }),
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

  return comment
}, validate.comment)

