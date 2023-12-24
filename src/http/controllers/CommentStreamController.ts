import { Stream } from '@elysiajs/stream'
import { emitter } from './FeedController'

app.get('/api/feed/comment/subscribe', () => {
  return new Stream(stream => {
    emitter.on('message', body => stream.send(JSON.stringify(body)))
  })
})