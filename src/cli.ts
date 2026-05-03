#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import readline from 'readline'
import fs from 'fs'
import { WikiAPI } from './api'
import { WikiIndexer } from './indexer'
import { JsonFormatter } from './jsonFormatter'
import { JsonWikiIndexer } from './jsonIndexer'
import { CACHE_PATH, initializeStorage, getVersionInfo, checkForUpdates, DB_PATH, JSON_DB_PATH, getSettings, getDiskInfo, VerInfo, saveSettings } from './init'
import { formatBytes } from './utils'

initializeStorage()

const verInfo = getVersionInfo()
let updateMessage = ''
checkForUpdates().then(v => { if (v) updateMessage = v }).catch(() => {})

const program = new Command()
const jsonFormatter = new JsonFormatter()
const indexer = new WikiIndexer()
const jsonIndexer = new JsonWikiIndexer()

const messages = [
  "Welcome Back, Explorer",
  "What's Googlin'",
  "WIKIpedia",
  "Explorer Spotted!",
  "Certified Info Spotter",
  "Deep Dive or Quick Check?",
  "Checkout Wikipedia!"
]

const customMessage = messages[Math.floor(Math.random() * messages.length)]

program
  .name('wiki')
  .description('Beautiful Wikipedia CLI')
  .version('1.0.0')
  .option('-l, --lang <lang>', 'Language (default: en)', getSettings().settings.locale)

const showSplash = () => {
  console.clear()
  const version = verInfo.localVersion
  const logo = `
          ${chalk.white('▄███▄')}        ${chalk.bold.white('██      ██  ██  ██   ██  ██')}
         ${chalk.white('██ █ ██')}       ${chalk.bold.white('██      ██  ██  ██  ██   ██')}
         ${chalk.white('███████')}       ${chalk.bold.white('██  ██  ██  ██  █████    ██')}
         ${chalk.white('██ █ ██')}       ${chalk.bold.white('████  ████  ██  ██  ██   ██')}
          ${chalk.white('▀███▀')}        ${chalk.bold.white('██      ██  ██  ██   ██  ██')}
  `

  console.log(logo)
  const versionDisplay = updateMessage
    ? `${chalk.dim(version)} ${chalk.white('→')} ${chalk.yellow(updateMessage)}`
    : chalk.dim(version)

  console.log(chalk.white(`   Wiki CLI ${versionDisplay}  •  ${customMessage}`))
  console.log(chalk.dim('   ─────────────────────────────────────────────────────────────────────────────'))
  console.log('\n')

  console.log(chalk.white('   Usage:'))
  console.log(`     ${chalk.cyan('wiki search')} ${chalk.dim('<query>')}     Search for articles`)
  console.log(`     ${chalk.cyan('wiki read')}   ${chalk.dim('<title>')}     Read a specific article`)
  console.log('\n')
  console.log(chalk.dim('   Type "wiki --help" for all commands and options.'))
  console.log('\n')
}

class CacheManager {

  private path = CACHE_PATH
  private data: Set<string> = new Set()

  constructor() {

    if (fs.existsSync(this.path)) {

      try {

        const content = fs.readFileSync(this.path, 'utf-8')
        this.data = new Set(JSON.parse(content))

      } catch (e) {

        this.data = new Set()
      }
    }
  }

  has(title: string) {
    return this.data.has(title)
  }

  add(title: string) {
    this.data.add(title)
    fs.writeFileSync(this.path, JSON.stringify([...this.data], null, 2))
  }

  search(query: string): string[] {

    const q = query.toLowerCase()
    
    return [...this.data].filter(t => t.toLowerCase().includes(q))
  }

  clear() {
    this.data.clear()
    fs.writeFileSync(this.path, JSON.stringify([], null, 2))
  }
}

const cacheManager = new CacheManager()

const doExit = () => {

  if (process.stdin.isTTY && (process.stdin as any).isRaw) {
    process.stdin.setRawMode(false)
  }

  process.stdout.write('\x1b[?1000l\x1b[?1006l')
  process.stdout.write('\x1B[?25h')
  console.log(chalk.cyan('\n\n   Goodbye!'))
  process.exit(0)
}

const prompt = (question: string): Promise<string> => {

  return new Promise((resolve) => {

    if (process.stdin.isTTY && (process.stdin as any).isRaw) {
      process.stdin.setRawMode(false)
    }

    process.stdin.resume()

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })

    rl.on('SIGINT', () => {
      rl.close()
      doExit()
    })

    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

const showTopStats = () => {

  const config = getSettings()
  const stats = config.settings.discStats
  
  const dbSize     = fs.existsSync(DB_PATH)     ? fs.statSync(DB_PATH).size     : 0
  const jsonDbSize = fs.existsSync(JSON_DB_PATH) ? fs.statSync(JSON_DB_PATH).size : 0
  const cacheSize  = fs.existsSync(CACHE_PATH)   ? fs.statSync(CACHE_PATH).size   : 0
  const total      = dbSize + jsonDbSize + cacheSize

  let limitBytes = 0
  let limitLabel = ''

  if (stats.getDrive.enabled) {

    const disk = getDiskInfo()
    
    limitBytes = disk.total
    limitLabel = 'Disk'
  } else if (stats.maxStorageVolumeTakenGB.enable && stats.maxStorageVolumeTakenGB.space > 0) {
    limitBytes = stats.maxStorageVolumeTakenGB.space * 1024 * 1024 * 1024
    limitLabel = 'Limit'
  }

  const BAR_WIDTH = 12

  const makeBar = (bytes: number, color: (s: string) => string): string => {

    const pct = limitBytes > 0 ? (bytes / limitBytes) : 0
    const filled = Math.round(pct * BAR_WIDTH)

    return color('█'.repeat(filled)) + chalk.dim('░'.repeat(BAR_WIDTH - filled))
  }

  const makePct = (bytes: number): string => {

    const ofTotal = total > 0 ? (bytes / total) * 100 : 0
    const ofLimit = limitBytes > 0 ? (bytes / limitBytes) * 100 : 0
    
    return `${chalk.white(ofTotal.toFixed(1).padStart(5) + '%')} ${chalk.dim('/')} ${chalk.yellow(ofLimit.toFixed(3) + '%')}`
  }

  const fmtSize = (bytes: number): string => formatBytes(bytes).padStart(9)
  const SEP = chalk.dim('   ' + '─'.repeat(73))

  console.log()
  console.log(`   ${chalk.bold.white('Storage Status')} ${chalk.dim(`(Comparison: ${limitLabel})`)}`)
  console.log(SEP)
  console.log()

  console.log(
    `   ${chalk.cyan('⊞')} ${chalk.cyan('Main DB')}      ` +
    `${chalk.white(fmtSize(dbSize))}  ` +
    `${makeBar(dbSize, chalk.cyan)}  ` +
    `${makePct(dbSize)}`
  )

  console.log(
    `   ${chalk.blue('⊕')} ${chalk.blue('JSON DB')}      ` +
    `${chalk.white(fmtSize(jsonDbSize))}  ` +
    `${makeBar(jsonDbSize, chalk.blue)}  ` +
    `${makePct(jsonDbSize)}`
  )

  console.log(
    `   ${chalk.yellow('⌘')} ${chalk.yellow('Cache')}        ` +
    `${chalk.white(fmtSize(cacheSize))}  ` +
    `${makeBar(cacheSize, chalk.yellow)}  ` +
    `${makePct(cacheSize)}`
  )

  console.log()
  console.log(
    `   ${chalk.white('⍟')} ${chalk.bold.white('Total Usage')}  ` +
    `${chalk.bold.green(fmtSize(total))}  ` +
    `${makeBar(total, chalk.green)}  ` +
    `${makePct(total)}`
  )
  console.log()
}

const pauseThenSplash = async (ms = 1800) => {

  await new Promise((r) => setTimeout(r, ms))
  showSplash()
}

const handleReader = async (title: string, tokens: Record<string, string>): Promise<void> => {

  const keys        = Object.keys(tokens)
  const totalTokens = keys.length
  const totalWords  = Object.values(tokens).reduce((acc, t) => acc + t.split(/\s+/).length, 0)

  let startIndex = 0
  const pageSize = 12

  let findMode      = false
  let findInput     = ''
  let searchTerm    = ''
  let searchMatches: number[] = []
  let matchCursor   = 0

  const computeMatches = (term: string): number[] => {

    if (!term) return []
    
    const lower = term.toLowerCase()
    
    return keys.reduce((acc, key, i) => {
      
      if (tokens[key].toLowerCase().includes(lower)) acc.push(i)
      
        return acc
    }, [] as number[])
  }

  const highlightText = (text: string, term: string): string => {

    if (!term) return text
    
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    
    return text.replace(new RegExp(escaped, 'gi'), (m) => chalk.bgYellow.black.bold(m))
  }

  const render = () => {

    console.clear()
    console.log('\n' + chalk.bold.white(`   ─── ${title.toUpperCase()} ───`) + '\n')

    const visibleKeys = keys.slice(startIndex, startIndex + pageSize)

    visibleKeys.forEach((key) => {
      console.log(`   ${chalk.dim('')} ${highlightText(tokens[key], searchTerm)}\n`)
    })

    const empty = pageSize - visibleKeys.length
    for (let i = 0; i < empty * 2; i++) console.log('')

    console.log(chalk.dim('   ─────────────────────────────────────────────────────────────────────────────'))

    if (findMode) {

      const cursor  = chalk.bgWhite.black(' ')
      const findBar = `   ${chalk.cyan('/')} ${findInput}${cursor}`
      const hint    = chalk.dim('Enter  confirm   Esc  cancel   ⌫  delete')
      const fbLen   = findBar.replace(/\u001b\[.*?m/g, '').length
      const hintLen = hint.replace(/\u001b\[.*?m/g, '').length
      const pad     = Math.max(2, 78 - fbLen - hintLen)
      console.log(`${findBar}${' '.repeat(pad)}${hint}`)

    } else {

      const parts = [
        `${chalk.blue('↑↓')} ${chalk.white('scroll')}`,
        `${chalk.blue('←→')} ${chalk.white('page')}`,
        `${chalk.blue('f')} ${chalk.white('find')}`,
        searchMatches.length > 0 ? `${chalk.blue('n/N')} ${chalk.white('next/prev')}` : '',
        `${chalk.blue('e')} ${chalk.white('exit')}`,
      ].filter(Boolean).join('   ')

      const menuLine = `   ${parts}`
      const progress = `${startIndex + 1}-${Math.min(startIndex + pageSize, totalTokens)}`

      let matchBadge = ''
      if (searchTerm) {
        matchBadge = searchMatches.length > 0
          ? `   ${chalk.yellow(`[${matchCursor + 1}/${searchMatches.length}]`)}`
          : `   ${chalk.red('[no matches]')}`
      }

      const stats    = `${chalk.blue('◈')} ${chalk.dim('Tokens:')} ${chalk.white(progress)}/${chalk.white(totalTokens)}   ${chalk.blue('≡')} ${chalk.dim('Words:')} ${chalk.white(totalWords)}${matchBadge}`
      const menuLen  = menuLine.replace(/\u001b\[.*?m/g, '').length
      const statsLen = stats.replace(/\u001b\[.*?m/g, '').length
      const padding  = Math.max(2, 78 - menuLen - statsLen)
      console.log(`${menuLine}${' '.repeat(padding)}${stats}`)
    }

    console.log(chalk.dim('   ─────────────────────────────────────────────────────────────────────────────'))
  }

  process.stdout.write('\x1b[?1000h\x1b[?1006h')
  process.stdin.resume()
  process.stdin.setRawMode(true)

  render()

  await new Promise<void>((resolve) => {

    const onData = (data: Buffer) => {

      const str = data.toString()
      const hex = data.toString('hex')

      const mouse = str.match(/^\x1b\[<(\d+);\d+;\d+M$/)

      if (mouse) {

        const btn = parseInt(mouse[1])

        if (btn === 64) {
          startIndex = Math.max(0, startIndex - 3)
          render()
        } else if (btn === 65) {
          startIndex = Math.min(startIndex + 3, Math.max(0, totalTokens - pageSize))
          render()
        }

        return
      }

      if (findMode) {

        if (hex === '0d' || hex === '0a') {

          findMode   = false
          searchTerm = findInput
          findInput  = ''

          if (searchTerm) {
            searchMatches = computeMatches(searchTerm)
            matchCursor   = 0
            if (searchMatches.length > 0) startIndex = searchMatches[0]
          } else {
            searchMatches = []
          }

          render()

        } else if (hex === '1b') {

          findMode  = false
          findInput = ''
          render()

        } else if (hex === '7f' || hex === '08') {

          findInput = findInput.slice(0, -1)
          render()

        } else if (str.length === 1 && str.charCodeAt(0) >= 32) {

          findInput += str
          render()
        }

        return
      }

      if (hex === '1b5b41' || hex === '1b5b44') {

        startIndex = Math.max(0, startIndex - pageSize)
        render()

      } else if (hex === '1b5b42' || hex === '1b5b43') {

        if (startIndex + pageSize < totalTokens) {
          startIndex += pageSize
          render()
        }

      } else if (str === 'f' || str === 'F') {

        findMode  = true
        findInput = ''
        render()

      } else if (str === 'n' && searchMatches.length > 0) {

        matchCursor = (matchCursor + 1) % searchMatches.length
        startIndex  = searchMatches[matchCursor]
        render()

      } else if (str === 'N' && searchMatches.length > 0) {

        matchCursor = (matchCursor - 1 + searchMatches.length) % searchMatches.length
        startIndex  = searchMatches[matchCursor]
        render()

      } else if (str === 'e' || str === 'q' || str === '\u0003') {
        process.stdin.removeListener('data', onData)
        resolve()
      }
    }

    process.stdin.on('data', onData)
  })

  process.stdout.write('\x1b[?1000l\x1b[?1006l')
  process.stdin.setRawMode(false)
  process.stdin.pause()
}

const startInteractive = async () => {

  process.on('SIGINT', () => doExit())

  showSplash()

  while (true) {

    console.log(chalk.dim('   ─────────────────────────────────────────────────────────────────────────────'))
    const query = await prompt(`   ${chalk.cyan('>')} `)
    console.log(chalk.dim('   ─────────────────────────────────────────────────────────────────────────────'))

    if (!query) {
      console.clear()
      showSplash()
      continue
    }

    const currentSettings = getSettings()
    const prefix = currentSettings.settings.prefix?.prefix || '.'

    if (['exit', 'quit', 'e', `${prefix}exit`].includes(query.toLowerCase())) {
      doExit()
    }

    if (query === `${prefix}top`) {
      showTopStats()
      continue
    }

    if ([`${prefix}clear`, `${prefix}c`].includes(query.toLowerCase())) {

      console.clear()
      showSplash()
      continue
    }

    if (query === `${prefix}cache`) {

      const dbSize     = fs.existsSync(DB_PATH)     ? fs.statSync(DB_PATH).size     : 0
      const jsonDbSize = fs.existsSync(JSON_DB_PATH) ? fs.statSync(JSON_DB_PATH).size : 0
      const cacheSize  = fs.existsSync(CACHE_PATH)   ? fs.statSync(CACHE_PATH).size   : 0
      const totalMB    = ((dbSize + jsonDbSize + cacheSize) / (1024 * 1024)).toFixed(2)

      const confirmed = await handleConfirmation(`Are you sure you want to delete ${totalMB} MB data from cache?`)
      
      if (confirmed) {

        const spinner = ora({ text: '   Clearing cache...', color: 'red' }).start()
        
        try {

          indexer.clearAll()
          jsonIndexer.clearAll()
          cacheManager.clear()
          spinner.succeed('   Cache cleared successfully!')

        } catch (e: any) {
          
          spinner.fail(`   Failed to clear cache: ${e.message}`)
        }

        await pauseThenSplash()

      } else {

        console.clear()
        showSplash()

      }

      continue
    }

    if (query === `${prefix}config`) {

      await handleConfig()
      
      console.clear()
      showSplash()
      
      continue
    }

    const spinner = ora({ text: `   Searching for "${query}"...`, color: 'cyan' }).start()

    try {

      const locale = getSettings().settings.locale
      const localMatches = cacheManager.search(query)
      const api = new WikiAPI(locale)
      const remoteMatches = await api.search(query)
      
      spinner.stop()

      const results: { title: string, isLocal: boolean, snippet?: string }[] = []
      
      localMatches.forEach(t => results.push({ title: t, isLocal: true }))
      
      remoteMatches.forEach(r => {

        if (!localMatches.some(l => l.toLowerCase() === r.title.toLowerCase())) {
          results.push({ title: r.title, isLocal: false, snippet: r.snippet })
        }
      })

      if (results.length === 0) {

        console.log(`   ${chalk.red('✖')} No results found for "${query}"`)
        
        await pauseThenSplash()
        continue

      }

      if (results.length === 1) {

        await openArticle(results[0].title, results[0].isLocal)

      } else {

        const selected = await handleSelection(query, results.slice(0, 8))

        if (selected) {
          await openArticle(selected.title, selected.isLocal)
        }
      }

      console.clear()
      showSplash()

    } catch (err: any) {
      spinner.fail(`   Error: ${err.message}`)

      await pauseThenSplash()
    }
  }
}

const handleConfig = async () => {

  let info = getVersionInfo()
  let settingsData = getSettings()
  
  const verKeys: (keyof VerInfo)[] = ['version', 'git', 'localVersion']
  
  type SettingConfig = {
    key: string;
    label: string;
    path: string;
    type: 'string' | 'boolean' | 'number';
    description: string;
    validation?: (val: string) => boolean;
  }

  const settingConfigs: SettingConfig[] = [

    {
      key: 'prefix',
      label: 'Command Prefix',
      path: 'prefix.prefix',
      type: 'string',
      description: settingsData.settings.prefix?.description || 'The prefix to run commands (default: .)',
      validation: (v) => v.length == 1
    },
    {
      key: 'locale',
      label: 'Locale',
      path: 'locale',
      type: 'string',
      description: 'Language for Wikipedia search and articles (default: en).',
      validation: (v) => v.length === 2
    },
    {
      key: 'getDrive',
      label: 'Get Drive',
      path: 'discStats.getDrive.enabled',
      type: 'boolean',
      description: settingsData.settings.discStats.getDrive.description
    },
    {
      key: 'storageLimitEnabled',
      label: 'Storage Limit Enabled',
      path: 'discStats.maxStorageVolumeTakenGB.enable',
      type: 'boolean',
      description: settingsData.settings.discStats.maxStorageVolumeTakenGB.description
    },
    {
      key: 'storageLimitSpace',
      label: 'Storage Limit Space (GB)',
      path: 'discStats.maxStorageVolumeTakenGB.space',
      type: 'number',
      description: 'Set a fixed GB limit to compare against.'
    }
  ]
  
  const allKeys = [...verKeys, ...settingConfigs.map(c => c.key)]
  
  let cursor = 0
  let isEditing = false
  let editValue = ''

  const getValueByPath = (obj: any, path: string) => {

    return path.split('.').reduce((acc, part) => acc && acc[part], obj)
  }

  const setValueByPath = (obj: any, path: string, value: any) => {
    
    const parts = path.split('.')
    const last = parts.pop()!
    const target = parts.reduce((acc, part) => acc && acc[part], obj)

    if (target) target[last] = value
  }

  return new Promise<void>((resolve) => {

    process.stdin.setRawMode(true)
    process.stdin.resume()

    const render = () => {

      process.stdout.write('\x1b[H\x1b[2J')
      console.log('\n')
      console.log(`   ${chalk.bold.white('Configuration')} (${chalk.dim(info.version)})`)
      console.log(chalk.dim('   ─────────────────────────────────────────────────────────────────────────────\n'))

      allKeys.forEach((key, i) => {

        const isSelected = i === cursor
        const verKey = verKeys[i]
        const isLocked = !!verKey
        const icon = isLocked ? '🔒︎  ' : '  '
        const prefix = isSelected ? chalk.cyan('  ▸ ') : '    '
        
        let label = ''
        let valueDisplay = ''
        
        if (isLocked) {
          
          label = isSelected ? chalk.bold.cyan(verKey) : chalk.white(verKey)
          valueDisplay = chalk.dim((info as any)[verKey])

        } else {
          
          const config = settingConfigs[i - verKeys.length]
          
          label = isSelected ? chalk.bold.cyan(config.label) : chalk.white(config.label)
          
          if (isSelected && isEditing) {

            valueDisplay = chalk.yellow(editValue) + chalk.cyan('█')
          } else {
            
            const val = getValueByPath(settingsData.settings, config.path)
            
            if (config.type === 'boolean') {
              valueDisplay = val ? chalk.green('true') : chalk.red('false')
            } else {
              valueDisplay = chalk.dim(val?.toString() || '')
            }
          }
        }
        
        console.log(`${prefix}${icon}${label.padEnd(25)}: ${valueDisplay}`)
      })

      console.log('\n')
      const isBack = cursor === allKeys.length
      const backPrefix = isBack ? chalk.cyan('  ▸ ') : '    '
      console.log(`${backPrefix}${isBack ? chalk.bold.cyan('BACK') : chalk.white('BACK')}`)

      console.log()
      console.log(chalk.dim('   ─────────────────────────────────────────────────────────────────────────────\n'))
      
      if (isEditing) {
        console.log(`   ${chalk.dim('Editing...')} ${chalk.cyan('Enter')} ${chalk.dim('to save,')} ${chalk.cyan('Esc')} ${chalk.dim('to cancel')}`)
      } else {

        if (cursor < allKeys.length && cursor >= verKeys.length) {
          
          const config = settingConfigs[cursor - verKeys.length]

          console.log(`   ${chalk.italic.dim(config.description)}`)
          console.log()
        }
        console.log(`   ${chalk.dim('Use')} ${chalk.cyan('↑/↓')} ${chalk.dim('to navigate,')} ${chalk.cyan('Enter')} ${chalk.dim('to edit/toggle')}`)
      }
    }

    render()

    const onData = (data: Buffer) => {

      const hex = data.toString('hex')
      const str = data.toString()

      if (isEditing) {

        const config = settingConfigs[cursor - verKeys.length]

        if (hex === '0d') {

          if (config.validation && !config.validation(editValue)) {
            return
          }

          let finalValue: any = editValue.trim()
          if (config.type === 'number') finalValue = parseFloat(finalValue) || 0
          
          setValueByPath(settingsData.settings, config.path, finalValue)
          saveSettings(settingsData)
          isEditing = false
          render()

        } else if (hex === '1b') {

          isEditing = false
          render()

        } else if (hex === '7f' || hex === '08') {

          editValue = editValue.slice(0, -1)
          render()

        } else if (str.length === 1) {

          if (config.type === 'number' && !/[0-9.]/.test(str)) return
          if (config.key === 'locale' && editValue.length >= 2) return
          
          if (!/[\x00-\x1F\x7F]/.test(str)) {
            editValue += str
            render()
          }
        }

        return
      }

      if (hex === '1b5b41') {

        cursor = (cursor - 1 + allKeys.length + 1) % (allKeys.length + 1)
        render()

      } else if (hex === '1b5b42') {

        cursor = (cursor + 1) % (allKeys.length + 1)
        render()

      } else if (hex === '0d') {

        if (cursor === allKeys.length) {

          process.stdin.removeListener('data', onData)
          process.stdin.setRawMode(false)
          process.stdin.pause()
          resolve()

        } else if (cursor < verKeys.length) {

          console.log(`\n   ${chalk.yellow('🔒︎  This field is read-only.')}`)
          setTimeout(render, 1000)

        } else {

          const config = settingConfigs[cursor - verKeys.length]
          
          if (config.type === 'boolean') {
            const current = getValueByPath(settingsData.settings, config.path)
            setValueByPath(settingsData.settings, config.path, !current)
            saveSettings(settingsData)
            render()
          } else {
            isEditing = true
            editValue = getValueByPath(settingsData.settings, config.path)?.toString() || ''
            render()
          }
        }

      } else if (hex === '1b' || hex === '03') {

        process.stdin.removeListener('data', onData)
        process.stdin.setRawMode(false)
        process.stdin.pause()
        resolve()

      }
    }

    process.stdin.on('data', onData)

  })
}

const handleSelection = async (query: string, results: { title: string, isLocal: boolean, snippet?: string }[]): Promise<{ title: string, isLocal: boolean } | null> => {
  
  let cursor = 0
  
  return new Promise((resolve) => {

    process.stdin.setRawMode(true)
    process.stdin.resume()

    const render = () => {
      
      process.stdout.write('\x1b[H\x1b[2J')

      console.log()
      console.log(`   ${chalk.bold.white('Results for')} ${chalk.cyan(`"${query}"`)}:\n`)
      console.log(chalk.dim('   ─────────────────────────────────────────────────────────────────────────────'))
      
      results.forEach((res, i) => {

        const isSelected = i === cursor
        const prefix = isSelected ? chalk.cyan('  ▸ ') : '    '
        const title = isSelected ? chalk.bold.cyan(res.title) : chalk.white(res.title)
        const type = res.isLocal ? chalk.green('[Local]') : chalk.dim('[Wiki]')
        
        console.log(` ${prefix}${title} ${type}`)

        if (isSelected && res.snippet) {
          console.log(`      ${chalk.italic.dim(res.snippet)}`)
        } else if (!isSelected && res.snippet) {
          console.log(`      ${chalk.dim(res.snippet.substring(0, 80) + '...')}`)
        }
      })
      
      console.log()
      console.log(chalk.dim('   ─────────────────────────────────────────────────────────────────────────────\n'))
      console.log(`   ${chalk.dim('Use')} ${chalk.cyan('↑/↓')} ${chalk.dim('to navigate,')} ${chalk.cyan('Enter')} ${chalk.dim('to select,')} ${chalk.cyan('e')} ${chalk.dim('to cancel')}`)
    }

    render()

    const onData = (data: Buffer) => {

      const str = data.toString()
      const hex = data.toString('hex')

      if (hex === '1b5b41') {

        cursor = (cursor - 1 + results.length) % results.length
        
        render()

      } else if (hex === '1b5b42') {
        
        cursor = (cursor + 1) % results.length
        
        render()

      } else if (hex === '0d') {
        
        process.stdin.removeListener('data', onData)
        process.stdin.setRawMode(false)
        process.stdin.pause()
        
        resolve(results[cursor])

      } else if (hex === '1b' || hex === '03' || str === 'e' || str === 'E') {
        
        process.stdin.removeListener('data', onData)
        process.stdin.setRawMode(false)
        process.stdin.pause()
        
        resolve(null)
      }
    }

    process.stdin.on('data', onData)
  })
}

const handleConfirmation = async (message: string): Promise<boolean> => {
  
  let cursor = 1

  return new Promise((resolve) => {

    process.stdin.setRawMode(true)
    process.stdin.resume()

    const render = () => {

      process.stdout.write('\x1b[H\x1b[2J')
      console.log('\n\n')
      console.log(`   ${chalk.bold.white(message)}`)
      console.log()

      const yes = cursor === 0 ? chalk.bold.underline.cyan('YES') : chalk.dim('YES')
      const no = cursor === 1 ? chalk.bold.underline.cyan('NO') : chalk.dim('NO')

      console.log(`      ${yes}   ${no}`)
      console.log('\n')
      console.log(`   ${chalk.dim('Use')} ${chalk.cyan('←/→')} ${chalk.dim('to navigate,')} ${chalk.cyan('Enter')} ${chalk.dim('to confirm')}`)
    }

    render()

    const onData = (data: Buffer) => {

      const hex = data.toString('hex')

      if (hex === '1b5b44' || hex === '1b5b41') {

        cursor = 0
        
        render()

      } else if (hex === '1b5b43' || hex === '1b5b42') {
        
        cursor = 1
        
        render()

      } else if (hex === '0d') {
        
        process.stdin.removeListener('data', onData)
        process.stdin.setRawMode(false)
        process.stdin.pause()
        
        resolve(cursor === 0)

      } else if (hex === '1b' || hex === '03') {
        
        process.stdin.removeListener('data', onData)
        process.stdin.setRawMode(false)
        process.stdin.pause()
        
        resolve(false)

      }
    }

    process.stdin.on('data', onData)
  })
}

const openArticle = async (title: string, isLocal: boolean) => {

  const spinner = ora({ text: `   Opening "${title}"...`, color: 'cyan' }).start()
  
  try {

    let tokens: Record<string, string> | null = null
    let finalTitle = title

    if (isLocal) {
      tokens = jsonIndexer.getArticleJson(title)
    }

    if (!tokens) {

      spinner.text = '   Downloading...'

      const locale = getSettings().settings.locale
      const api = new WikiAPI(locale)
      const article = await api.getArticle(title)

      if (!article) {

        spinner.fail(`   Article "${title}" not found.`)
        return
        
      }

      finalTitle = article.title
      indexer.saveArticle(article.title, article.content)
      tokens = jsonFormatter.extractTextTokens(article.content)
      jsonIndexer.saveArticleJson(article.title, tokens)
      indexer.deleteArticle(article.title)
      cacheManager.add(article.title)
    }

    spinner.stop()
    await handleReader(finalTitle, tokens!)

  } catch (err: any) {
    spinner.fail(`   Error opening article: ${err.message}`)
  }
}

if (process.argv.length === 2) {
  startInteractive().catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  program.parse()
}