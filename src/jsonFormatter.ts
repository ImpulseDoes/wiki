import { JSDOM } from 'jsdom'

export interface JsonArticle {
  title: string
  tokens: Record<string, string>
}

export class JsonFormatter {
  
  extractTextTokens(html: string): Record<string, string> {
    const dom = new JSDOM(html)
    const document = dom.window.document

    const selectorsToRemove = [
      'script', 'style', 'noscript', '.infobox', '.navbox', '.reflist', 
      '.mw-empty-elt', '.reference', 'table', '.metadata', '.ambox', 
      '.asbox', '.hatnote', '.side-box', '.catlinks', 'figure', 'img',
      '.mw-editsection', '.mw-cite-backlink', '.ext-discussiontools-init-replylink-buttons',
      '.vcard', '.stub', '.portal', '.sistersitebox', 'li', 'ul', 'ol',
      '.toc', '#toc'
    ]

    selectorsToRemove.forEach(selector => {
      const elements = document.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    })

    const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6')
    
    const skipHeadings = ['contents']
    const stopHeadings = [
      'see also', 'notes', 'references', 'further reading', 'external links', 'citations', 'sources'
    ]

    let combinedText = ''
    let stopProcessing = false

    elements.forEach(el => {
      if (stopProcessing) return

      let text = el.textContent || ''
      
      text = text
        .replace(/\[[a-zA-Z0-9]+\]/g, '')
        .replace(/\u00a0/g, ' ')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/"/g, "'")
        .replace(/\s+/g, ' ')
        .trim()

      const isHeading = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)
      
      if (isHeading) {
        const lowerText = text.toLowerCase()
        if (stopHeadings.includes(lowerText)) {
          stopProcessing = true
          return
        }
        if (skipHeadings.includes(lowerText)) {
          return
        }
      }
      
      if (text) {
        combinedText += text + ' '
      }
    })

    const textBlocks: string[] = []
    combinedText = combinedText.trim()
    
    if (combinedText) {
      const MAX_LENGTH = 85
      let start = 0
      while (start < combinedText.length) {
        if (combinedText.length - start <= MAX_LENGTH) {
          textBlocks.push(combinedText.substring(start))
          break
        }

        let end = start + MAX_LENGTH
        const lastSpace = combinedText.lastIndexOf(' ', end)

        if (lastSpace > start) {
          textBlocks.push(combinedText.substring(start, lastSpace).trim())
          start = lastSpace + 1
        } else {
          textBlocks.push(combinedText.substring(start, end).trim())
          start = end
        }

        while (start < combinedText.length && combinedText[start] === ' ') {
          start++
        }
      }
    }

    const tokens: Record<string, string> = {}
    textBlocks.forEach((text, index) => {
      tokens[(index + 1).toString()] = text
    })

    return tokens
  }
}