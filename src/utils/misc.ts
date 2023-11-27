import { env } from './env'

export const asset = (path: string) => {
  const base = env('APP_URL', 'http://localhost:3000')!

  return new URL(path, base).toString()
} 

export const retries = async <T>(handler: () => Promise<T>, times = 3): Promise<T> => {
  let error: unknown

  while (times --> 0) {
    try {
      return await handler()
    } catch (e) {
      error = e
    }
  }

  throw error
}
