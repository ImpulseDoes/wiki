import fs from 'fs'
import path from 'path'

export const STORAGE_DIR = path.join(process.cwd(), 'storage')

export const DB_PATH = path.join(STORAGE_DIR, 'wiki.db')
export const JSON_DB_PATH = path.join(STORAGE_DIR, 'jsonwiki.db')
export const CACHE_PATH = path.join(STORAGE_DIR, 'cache.json')

export function initializeStorage() {
  
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
  }
}