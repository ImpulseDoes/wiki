import fs from 'fs'
import path from 'path'
import https from 'https'
import { execSync } from 'child_process'

export const ROOT_DIR = path.join(__dirname, '..')
export const STORAGE_DIR = path.join(ROOT_DIR, 'storage')
export const SETTINGS_DIR = path.join(ROOT_DIR, 'settings')
export const DB_PATH = path.join(STORAGE_DIR, 'wiki.db')
export const JSON_DB_PATH = path.join(STORAGE_DIR, 'jsonwiki.db')
export const CACHE_PATH = path.join(STORAGE_DIR, 'cache.json')
export const VER_PATH = path.join(ROOT_DIR, 'update', 'ver.json')
export const SETTINGS_PATH = path.join(SETTINGS_DIR, 'set.json')

export function initializeStorage() {
  
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
  }

  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true })
  }

  if (!fs.existsSync(SETTINGS_PATH)) {
    const defaultSettings: Settings = {
      settings: {
        locale: 'en',
        discStats: {
          getDrive: {
            enabled: true,
            description: "Show disk space used by local databases."
          },
          maxStorageVolumeTakenGB: {
            enable: false,
            space: 0,
            description: "Set a fixed GB limit to compare against."
          }
        },
        prefix: {
          prefix: ".",
          description: "The prefix to run commands (default: .)"
        },
        appearance: {
          pageSize: 12,
          description: "Number of lines to display in the reader."
        }
      }
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaultSettings, null, 4))
  }
}

export interface Settings {
  settings: {
    locale: string;
    discStats: {
      getDrive: {
        enabled: boolean;
        description: string;
      };
      maxStorageVolumeTakenGB: {
        enable: boolean;
        space: number;
        description: string;
      };
    };
    prefix: {
      prefix: string;
      description: string;
    },
    appearance: {
      pageSize: number;
      description: string;
    }
  }
}

export function saveSettings(settings: Settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 4))
}

export function getSettings(): Settings {

  const defaultSettings: Settings = {
    settings: {
      locale: 'en',
      discStats: {
        getDrive: {
          enabled: true,
          description: "Show disk space used by local databases."
        },
        maxStorageVolumeTakenGB: {
          enable: false,
          space: 0,
          description: "Set a fixed GB limit to compare against."
        }
      },
      prefix: {
        prefix: ".",
        description: "The prefix to run commands (default: .)"
      },
      appearance: {
        pageSize: 12,
        description: "Number of lines to display in the reader."
      }
    }
  }

  if (!fs.existsSync(SETTINGS_PATH)) {

    initializeStorage()

    return defaultSettings
  }

  try {

    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    
    if (!settings.settings) return defaultSettings
    
    if (!settings.settings.appearance) {
      settings.settings.appearance = defaultSettings.settings.appearance
    }

    if (!settings.settings.prefix) {
      settings.settings.prefix = defaultSettings.settings.prefix
    }

    if (!settings.settings.discStats) {
      settings.settings.discStats = defaultSettings.settings.discStats
    }

    return settings
    
  } catch (e) {
    return defaultSettings
  }
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
}

export function getVersionInfo(): VerInfo {

  if (!fs.existsSync(VER_PATH)) {
    return { version: '', git: 'https://raw.githubusercontent.com/ImpulseDoes/wiki/main/update/ver.json', localVersion: '' }
  }
  
  return JSON.parse(fs.readFileSync(VER_PATH, 'utf-8'))
}

export function saveVersionInfo(info: VerInfo) {
  fs.writeFileSync(VER_PATH, JSON.stringify(info, null, 4))
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