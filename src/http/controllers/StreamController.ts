import { AxiosError } from 'axios'
import { t } from 'elysia'
import { createWriteStream } from 'fs'
import { nanoid } from 'nanoid'
import { DStreamData, d_id } from '~/plugins/RequestClient'
import { createHandlerQueue, destroyHandlerQueue } from '~/services/PushTextStream'
import { asset, retries } from '~/utils/misc'


const { app } = global

const validate = {
  create: {
    body: t.Object({
      prompt: t.String({ maxLength: 1000 }),
      avatar: t.File({type: ['image'], maxSize: '10m' })
    })
  },

  ice: {
    body: t.Object({
      candidate: t.String(),
      sdpMid: t.String(),
      sdpMLineIndex: t.Number(),
    })
  },

  sdp: {
    body: t.Object({
      type: t.String(),
      sdp: t.String(),
    })
  }
}

app.post('/api/stream/create', async ({ body, db, set }) => {
  const id = nanoid()
  let error: unknown

  const extension = body.avatar.name.split('.').pop() || 'png'
  createWriteStream(`./public/upload/${id}.${extension}`)
    .end(Buffer.from(await body.avatar.arrayBuffer()))

  const data = await retries(async () => {
    return d_id.post<DStreamData>('/talks/streams', {
      source_url: asset(`/upload/${id}.png`),
    })
    .then((res) => res.data)
  }).catch((e: AxiosError) => {
    set.status = e.status
    error = e.response?.data
  })

  if (!data || error) return error

  createHandlerQueue(id)

  db.data.streams.push({
    id: id,
    session_id: data.session_id,
    stream_id: data.id,
    prompt: body.prompt,
    avatar: asset(`/upload/${id}.${extension}`),
    updated_at: Date.now()
  })

  db.write()

  return data
}, validate.create)


app.post('/api/stream/:id/exchange/ice', ({ params, body, db, set }) => {
  const stream = db.data.streams.find((stream) => stream.id === params.id)

  if (!stream) {
    set.status = 'Not Found'
    return { message: 'Stream not found' }
  }

  return d_id.post(`/talks/streams/${stream.stream_id}/exchange/ice`, {
    ...body, session_id: stream.session_id
  })
    .then((res) => res.data)
    .catch((e: AxiosError) => {
      set.status = e.status
      return e.response?.data
    })
}, validate.ice)

app.post('/api/stream/:id/exchange/sdp', ({ params, body, db, set }) => {
  const stream = db.data.streams.find((stream) => stream.id === params.id)

  if (!stream) {
    set.status = 'Not Found'
    return { message: 'Stream not found' }
  }

  return d_id.post(`talks/streams/${stream.stream_id}/sdp`, {
    answer: body,
    session_id: stream.session_id
  })
    .then((res) => res.data)
    .catch((e: AxiosError) => {
      set.status = e.status
      return e.response?.data
    })
})

app.post('/api/stream/:id/terminate', ({ params, db, set }) => {
  const id = params.id

  const index = db.data.streams.findIndex((stream) => stream.id === id)

  if (index === -1) {
    set.status = 'Not Found'
    return { message: 'Stream not found' }
  }

  const stream = db.data.streams[index]!
  db.data.streams.splice(index, 1)
  db.write()

  destroyHandlerQueue(id)

  // TODO: maybe delete the uploaded file as well

  return d_id.delete(`/talks/streams/talks/streams/${stream.stream_id}`, {
    data: { session_id: stream.session_id }
  })
    .then((res) => res.data)
    .catch((e: AxiosError) => {
      set.status = e.status
      return e.response?.data
    })
})
