import { t } from 'elysia'

const validate = {
  comment: {
    query: t.Object({
      stream: t.String()
    }),

    body: t.Object({
      user: t.String(),
      message: t.String()
    })
  }
}

export const holder = new Map<number, WS>()
export const groups = new Map<string, Set<number>>()


app.ws('/comments', {
  close(ws) {
    holder.delete(ws.id)

    const id = ws.data.query.stream

    if (groups.has(id)) {
      groups.get(id)!.delete(ws.id)
    }

    console.log('close', ws.id, id);
  },

  open(ws) {
    const id = ws.data.query.stream
    holder.set(ws.id, ws as any)

    if (!groups.has(id)) {
      groups.set(id, new Set())
    }

    groups.get(id)!.add(ws.id)
    console.log('open', ws.id, id);
  },

  query: validate.comment.query
})

type WS = Parameters<NonNullable<Parameters<typeof app.ws>[1]['open']>>[0]
