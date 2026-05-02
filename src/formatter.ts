import chalk from 'chalk'
import { NodeHtmlMarkdown } from 'node-html-markdown'
import terminalLink from 'terminal-link'
import { JSDOM } from 'jsdom'

export class WikiFormatter {

  private nhm: NodeHtmlMarkdown

  constructor() {
    this.nhm = new NodeHtmlMarkdown({
      ignore: ['script', 'style', 'noscript'],
    })
  }

  private cleanHtml(html: string): string {

    const dom = new JSDOM(html)
    const document = dom.window.document

    const selectorsToRemove = [
      '.infobox',
      '.navbox',
      '.reflist',
      '.mw-empty-elt',
      '.reference',
      '.ext-discussiontools-init-replylink-buttons',
      'table',
      '.metadata',
      '.ambox',
      '.asbox',
      '.hatnote',
      '.side-box',
      '.catlinks'
    ]

    selectorsToRemove.forEach(selector => {
      const elements = document.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    })

    return document.body.innerHTML
  }

  formatArticle(title: string, htmlContent: string, url: string): string {
    
    const cleanedHtml = this.cleanHtml(htmlContent)
    let markdown = this.nhm.translate(cleanedHtml)

    const header = chalk.bold.bgBlue.white(`  ${title.toUpperCase()}  `) + '\n'
    const link = chalk.dim(`  ${terminalLink('View Online', url)}\n`)
    
    let formatted = markdown
      .replace(/^(#+)(.*)$/gm, (match, hashes, content) => {
        const level = hashes.length
        const text = content.trim()
        if (level === 1) return `\n${chalk.bold.yellow.underline(text)}\n`
        if (level === 2) return `\n${chalk.bold.yellow(text)}\n`
        return `\n${chalk.bold.white(text)}\n`
      })
      .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
      .replace(/\*(.*?)\*/g, chalk.italic('$1'))
      .replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
        if (url.startsWith('/wiki/')) {
          url = `https://en.wikipedia.org${url}`
        }
        return terminalLink(chalk.blue(text), url)
      })

    return `\n${header}${link}\n${formatted.split('\n').map(line => `  ${line}`).join('\n')}\n`
  }

  formatSearchResult(results: any[]): string {
    
    if (results.length === 0) return chalk.red('No results found.')

    return results.map((r, i) => {
      const index = chalk.dim(`${i + 1}.`)
      const title = chalk.bold.green(r.title)
      const snippet = r.snippet.replace(/<span class="searchmatch">(.*?)<\/span>/g, chalk.bold.yellow('$1'))
      return `${index} ${title}\n   ${chalk.italic.dim(snippet)}...`
    }).join('\n\n')
  }
}