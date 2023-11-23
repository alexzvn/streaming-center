import { Elysia } from 'elysia'
import { env } from '~/utils/env'
import RegisterHandler from '~/plugins/RegisterHandler'
import { create } from '~/plugins/SimpleDatabase'

const port = +env('APP_PORT', 3000)!

const start = async () => {
  const application = new Elysia();

  (global as any).app = application
  global.state = { db: await create() }

  return application
    .decorate('db', global.state.db)
    .on('start', RegisterHandler)
    .listen(port)
}


declare global {
  var app: Awaited<ReturnType<typeof start>>
  var state: {
    db: Awaited<ReturnType<typeof create>>
  }
}

start().then(() => console.log(`Listening on port ${port}`))
