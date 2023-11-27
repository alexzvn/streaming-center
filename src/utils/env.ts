


export const env = <T>(key: string, fallback?: T): T | undefined => {
  return (process.env[key] ?? fallback) as any
}

export const envOrFail = <T=String>(key: string, error?: string|Error): T|never => {
  if (env(key, false)) {
    return env(key) as T
  }

  if (!error) {
    throw new Error(`Environment variable ${key} is not defined`)
  }

  if (error instanceof Error) {
    throw error
  }

  throw new Error(error)
}
