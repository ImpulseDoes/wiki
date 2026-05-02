import Database from 'better-sqlite3'
import { WikiAPI } from './api'
import ora from 'ora'
import zlib from 'zlib'
import { Readable } from 'stream'
import { DB_PATH } from './init'

export class WikiIndexer {
  
  private db: Database.Database

  constructor(dbPath: string = DB_PATH) {
    this.db = new Database(dbPath)
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT UNIQUE,
        content TEXT,
        last_indexed DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_title ON articles(title);
    `)
  }

  async indexArticle(title: string, api: WikiAPI) {

    const article = await api.getArticle(title)
    
    if (!article) return
    this.saveArticle(article.title, article.content)
  }

  saveArticle(title: string, content: string) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO articles (title, content, last_indexed)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `)
    stmt.run(title, content)
  }

  getCachedArticle(title: string) {
    const stmt = this.db.prepare('SELECT * FROM articles WHERE title = ?')
    
    return stmt.get(title)
  }

  deleteArticle(title: string) {
    const stmt = this.db.prepare('DELETE FROM articles WHERE title = ?')
    stmt.run(title)
  }

  async importTitles(lang: string = 'en') {

    const url = `https://dumps.wikimedia.org/${lang}wiki/latest/${lang}wiki-latest-all-titles-in-ns0.gz`
    const spinner = ora(`Downloading titles dump from ${url}...`).start()

    try {

      const response = await fetch(url)
      
      if (!response.body) throw new Error('Failed to get response body')

      const gunzip = zlib.createGunzip()
      
      const nodeStream = Readable.fromWeb(response.body as any)
      
      let count = 0
      const insert = this.db.prepare('INSERT OR IGNORE INTO articles (title) VALUES (?)')
      
      const transaction = this.db.transaction((titles: string[]) => {
        for (const title of titles) {
          insert.run(title.replace(/_/g, ' '))
        }
      })

      let buffer = ''
      let batch: string[] = []

      nodeStream.pipe(gunzip).on('data', (chunk: Buffer) => {
        
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {

          if (line.trim()) {
            batch.push(line.trim())
            
            if (batch.length >= 1000) {
              transaction(batch)
              count += batch.length
              spinner.text = `Imported ${count} titles...`
              batch = []
            }
          }
        }
      }).on('end', () => {
        if (batch.length > 0) {
          transaction(batch)
          count += batch.length
        }
        spinner.succeed(`Successfully indexed ${count} Wikipedia titles.`)
      })

    } catch (error: any) {
      spinner.fail(`Import failed: ${error.message}`)
    }
  }
}