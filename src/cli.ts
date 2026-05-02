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
import { CACHE_PATH, initializeStorage } from './init'

initializeStorage()

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
  "Deep Dive or Quick Check?"
]

const customMessage = messages[Math.floor(Math.random() * messages.length)]

program
  .name('wiki')
  .description('Beautiful Wikipedia CLI')
  .version('1.0.0')
  .option('-l, --lang <lang>', 'Language (default: en)', 'en')

const showSplash = () => {

  console.clear()

  const version = 'v0.1.3'

  const logo = `
          ${chalk.white('▄███▄')}        ${chalk.bold.white('██      ██  ██  ██   ██  ██')}
         ${chalk.white('██ █ ██')}       ${chalk.bold.white('██      ██  ██  ██  ██   ██')}
         ${chalk.white('███████')}       ${chalk.bold.white('██  ██  ██  ██  █████    ██')}
         ${chalk.white('██ █ ██')}       ${chalk.bold.white('████  ████  ██  ██  ██   ██')}
          ${chalk.white('▀███▀')}        ${chalk.bold.white('██      ██  ██  ██   ██  ██')}
  `

  console.log(logo)
  console.log(chalk.white(`   Wiki CLI ${chalk.dim(version)}  •  ${customMessage}`))
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

    if (['exit', 'quit', 'e', '.exit'].includes(query.toLowerCase())) {
      doExit()
    }

    const spinner = ora({ text: `Looking for "${query}"...`, color: 'cyan' }).start()

    try {
      let tokens: Record<string, string> | null = cacheManager.has(query)
        ? jsonIndexer.getArticleJson(query)
        : null
      let finalTitle = query

      if (!tokens) {

        spinner.text = 'Downloading...'
        const api = new WikiAPI('en')
        const article = await api.getArticle(query)

        if (!article) {
          spinner.fail(`Article "${query}" not found.`)
          await pauseThenSplash()
          continue
        }

        finalTitle = article.title
        indexer.saveArticle(article.title, article.content)
        tokens = jsonFormatter.extractTextTokens(article.content)
        jsonIndexer.saveArticleJson(article.title, tokens)
        indexer.deleteArticle(article.title)
        cacheManager.add(article.title)
        spinner.stop()

      } else {
        spinner.stop()
      }

      if (!tokens || Object.keys(tokens).length === 0) {
        console.log(chalk.red('   No content found.'))
        await pauseThenSplash()
        continue
      }

      await handleReader(finalTitle, tokens)

      console.clear()
      showSplash()

    } catch (err: any) {
      spinner.fail(`Error: ${err.message}`)
      await pauseThenSplash()
    }
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