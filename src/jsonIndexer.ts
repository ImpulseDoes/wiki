import Database from 'better-sqlite3'
import { JSON_DB_PATH } from './init'

export class JsonWikiIndexer {
  
  private db: Database.Database

  constructor(dbPath: string = JSON_DB_PATH) {

    this.db = new Database(dbPath)
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles_json (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT UNIQUE,
        data_json TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_json_title ON articles_json(title);
    `)
  }

  saveArticleJson(title: string, tokens: Record<string, string>) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO articles_json (title, data_json, last_updated)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `)
    stmt.run(title, JSON.stringify(tokens))
  }

  getArticleJson(title: string): Record<string, string> | null {
    
    const stmt = this.db.prepare('SELECT data_json FROM articles_json WHERE title = ?')
    const row: any = stmt.get(title)
   
    return row ? JSON.parse(row.data_json) : null
  }
  
  clearAll() {
    this.db.exec("DELETE FROM articles_json")
  }
}