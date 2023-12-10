import { Elysia } from 'elysia'
import { staticPlugin } from '@elysiajs/static'
import { env } from '~/utils/env'
import { create } from '~/plugins/SimpleDatabase'

const port = +env('APP_PORT', 3000)!

const start = async () => {
  const application = new Elysia();

  (global as any).app = application
  global.state = { db: await create() }

  await import('~/plugins/RegisterHandler')

  return application
    .get('/', () => 'hello')
    .decorate('db', global.state.db)
    .use(staticPlugin({ assets: 'public' }))
    .listen(port)
}


declare global {
  var app: Awaited<ReturnType<typeof start>>
  var state: {
    db: Awaited<ReturnType<typeof create>>
  }
}

start().then(() => console.log(`Listening on port ${port}`))
