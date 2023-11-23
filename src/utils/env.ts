


export const env = <T>(key: string, fallback?: T): T | undefined => {
  return (process.env[key] ?? fallback) as any
}
