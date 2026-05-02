import fs from 'fs'
import path from 'path'
import https from 'https'
import { execSync } from 'child_process'

export const STORAGE_DIR = path.join(process.cwd(), 'storage')
export const SETTINGS_DIR = path.join(process.cwd(), 'settings')
export const DB_PATH = path.join(STORAGE_DIR, 'wiki.db')
export const JSON_DB_PATH = path.join(STORAGE_DIR, 'jsonwiki.db')
export const CACHE_PATH = path.join(STORAGE_DIR, 'cache.json')
export const VER_PATH = path.join(process.cwd(), 'update', 'ver.json')
export const SETTINGS_PATH = path.join(SETTINGS_DIR, 'set.json')

export function initializeStorage() {
  
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
  }

  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true })
  }

  if (!fs.existsSync(SETTINGS_PATH)) {
    const defaultSettings = {
      settings: {
        discStats: {
          getDrive: true,
          maxStorageVolumeTakenGB: 0
        }
      }
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaultSettings, null, 4))
  }
}

export interface Settings {
  settings: {
    discStats: {
      getDrive: boolean;
      maxStorageVolumeTakenGB: number;
    }
  }
}

export function getSettings(): Settings {
  if (!fs.existsSync(SETTINGS_PATH)) {
    initializeStorage()
  }
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
}

export function getDiskInfo(): { total: number; free: number } {

  try {
    
    const output = execSync('df -B1 .').toString().split('\n')[1]
    const parts = output.split(/\s+/)
    
    return {
      total: parseInt(parts[1]),
      free: parseInt(parts[3])
    }
  } catch (e) {
    
    return { total: 0, free: 0 }
  }
}

export interface VerInfo {
  version: string;
  git: string;
  localVersion: string;
  locale: string;
}

export function getVersionInfo(): VerInfo {

  if (!fs.existsSync(VER_PATH)) {
    return { version: 'v0.1.6', git: 'https://raw.githubusercontent.com/ImpulseDoes/wiki/main/update/ver.json', localVersion: '', locale: 'en' }
  }
  
  const info = JSON.parse(fs.readFileSync(VER_PATH, 'utf-8'))

  return {
    ...info,
    locale: info.locale || 'en'
  }
}

export async function checkForUpdates(): Promise<string | null> {

  const info = getVersionInfo()
  
  if (!info.git) return null

  return new Promise((resolve) => {

    const options = {
      headers: { 'User-Agent': 'Wiki-CLI' }
    }
    
    https.get(info.git, options, (res) => {

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