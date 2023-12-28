import { Stream } from '@elysiajs/stream'
import { emitter } from './FeedController'

app.get('/api/feed/comment/subscribe', ({ set }) => {

  set.headers['Access-Control-Allow-Origin'] = '*'
  set.headers['Access-Control-Allow-Methods'] = '*'

  return new Stream(stream => {
    emitter.on('message', body => stream.send(JSON.stringify(body)))
  })
})