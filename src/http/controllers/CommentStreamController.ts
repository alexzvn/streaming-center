import { Stream } from '@elysiajs/stream'
import { emitter } from './FeedController'
import dayjs, { Dayjs } from 'dayjs'

let buffer = new Array<Record<string, any>&{ time: Dayjs }>()

emitter.on('message', comment => {
  buffer.push({ ...comment, time: dayjs() })
})

setInterval(() => {
  buffer = buffer.filter(value => value.time.subtract(1, 'minute').isBefore(dayjs()))
}, 10 * 1000)

app.get('/api/feed/comment/subscribe', ({ set }) => {

  set.headers['Access-Control-Allow-Origin'] = '*'
  set.headers['Access-Control-Allow-Methods'] = '*'

  return new Stream(stream => {
    for (const item of buffer) {
      stream.send(JSON.stringify({ ...item, time: undefined }))
    }

    emitter.on('message', body => stream.send(JSON.stringify(body)))
  })
})