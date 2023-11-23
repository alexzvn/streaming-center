import { env } from './env'

export const asset = (path: string) => {
  const base = env('APP_URL', 'http://localhost:3000')!

  return new URL(path, base).toString()
} 
