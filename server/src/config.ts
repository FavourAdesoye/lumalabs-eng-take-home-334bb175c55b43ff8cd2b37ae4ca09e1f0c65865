import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

const currentFile = fileURLToPath(import.meta.url)
const srcDir = path.dirname(currentFile)
const serverDir = path.resolve(srcDir, '..')
const repoDir = path.resolve(serverDir, '..')

dotenv.config({ path: path.resolve(repoDir, '.env') })

export const config = {
  repoDir,
  serverDir,
  clientDistDir: path.resolve(repoDir, 'client', 'dist'),
  databasePath:
    process.env.DATABASE_PATH ?? path.resolve(serverDir, 'data', 'imessage-search.db'),
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  semanticSearchEnabled:
    (process.env.SEMANTIC_SEARCH_ENABLED ?? 'true') !== 'false' &&
    Boolean(process.env.ANTHROPIC_API_KEY),
  semanticModel: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
}
