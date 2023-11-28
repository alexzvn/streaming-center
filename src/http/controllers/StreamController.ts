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
      session_id: t.Optional(t.String()),
    })
  },

  sdp: {
    body: t.Object({
      type: t.String(),
      sdp: t.String(),
    })
  }
}

const createIdleAnimation = async (image: string) => {
  interface AnimationData {
    id: string
    source_url: string
    result_url?: string
    error?: {
      description: string
      kind: string
    }
  }

  interface AnimationRequest {
    id: string
    status: 'created',
    created_at: string
  }

  console.log('beginning animation request')


  const requesting = await d_id.post<AnimationRequest>('/animations', {
    source_url: image,
    driver_url: 'bank://nostalgia/'
  })
  .catch(() => undefined)

  if (!requesting) {
    return undefined
  }

  const { data: animation } = await d_id.get<AnimationData>(`/animations/${requesting.data.id}`)

  if (animation.error) {
    return undefined
  }

  let times = 5

  while (times --> 0) {
    await new Promise((resolve) => setTimeout(resolve, 2500))
    const { data: animation } = await d_id.get<AnimationData>(`/animations/${requesting.data.id}`)

    if (animation.result_url) {
      return animation.result_url
    }
  }

  // To bad, animation request generate timed out
  return undefined
}

app.post('/api/stream/create', async ({ body, db, set }) => {
  const id = nanoid()
  let error: unknown

  const extension = body.avatar.name.split('.').pop() || 'png'
  const filepath = `./public/upload/${id}.${extension}`

  createWriteStream(filepath)
    .end(Buffer.from(await body.avatar.arrayBuffer()))

  const animation = await createIdleAnimation(asset(filepath))

  const data = await retries(async () => {
    return d_id.post<DStreamData>('/talks/streams', {
      source_url: asset(filepath),
    })
    .then((res) => res.data)
  }).catch((e: AxiosError) => {
    set.status = e.status
    error = e.response?.data
  })

  if (!data || error) return error

  const stream = {
    id: id,
    session_id: data.session_id,
    stream_id: data.id,
    prompt: body.prompt,
    avatar: asset(filepath),
    updated_at: Date.now()
  }

  createHandlerQueue(id)

  db.data.streams.push(stream)
  db.write()

  return { stream, wrtc: data, animation }
}, validate.create)


app.post('/api/stream/:id/exchange/ice', ({ params, body, db, set }) => {
  const stream = db.data.streams.find((stream) => stream.id === params.id)

  if (!stream) {
    set.status = 'Not Found'
    return { message: 'Stream not found' }
  }

  return d_id.post(`/talks/streams/${stream.stream_id}/ice`, {
      ...body,
      session_id: stream.session_id
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
}, validate.sdp)

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
