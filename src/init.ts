import fs from 'fs'
import path from 'path'
import https from 'https'

export const STORAGE_DIR = path.join(process.cwd(), 'storage')

export const DB_PATH = path.join(STORAGE_DIR, 'wiki.db')
export const JSON_DB_PATH = path.join(STORAGE_DIR, 'jsonwiki.db')
export const CACHE_PATH = path.join(STORAGE_DIR, 'cache.json')
export const VER_PATH = path.join(process.cwd(), 'update', 'ver.json')

export function initializeStorage() {
  
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
  }
}

export interface VerInfo {
  version: string;
  git: string;
  localVersion: string;
}

export function getVersionInfo(): VerInfo {

  if (!fs.existsSync(VER_PATH)) {
    return { version: 'v0.0.0', git: '', localVersion: 'v0.0.0' }
  }
  
  return JSON.parse(fs.readFileSync(VER_PATH, 'utf-8'))
}

export async function checkForUpdates(): Promise<string | null> {

  const info = getVersionInfo()
  
  if (!info.git) return null

  return new Promise((resolve) => {

    https.get(info.git, (res) => {

      let data = ''
      
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const remote = JSON.parse(data)
          if (remote.version !== info.localVersion) {
            resolve(remote.version)
          } else {
            resolve(null)
          }
        } catch (e) {
          resolve(null)
        }
      })
    }).on('error', () => {
      resolve(null)
    })
  })
}