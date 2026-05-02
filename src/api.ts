
export interface WikiArticle {
  title: string
  content: string
  url: string
}

export interface SearchResult {
  title: string
  snippet: string
  pageid: number
}

export class WikiAPI {

  private baseUrl: string = 'https://en.wikipedia.org/w/api.php'

  constructor(private lang: string = 'en') {
    this.baseUrl = `https://${lang}.wikipedia.org/w/api.php`
  }

  async search(query: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '10',
      srprop: 'snippet|titlesnippet',
      format: 'json',
      origin: '*',
      redirects: '1'
    })

    const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
      headers: {
        'User-Agent': 'WikiCLI/1.0 (https://github.com/ImpulseDoes/wiki-cli)'
      }
    })

    const data: any = await response.json()

    if (!data.query || !data.query.search) {
      return []
    }

    return data.query.search.map((item: any) => ({
      title: item.title,
      snippet: item.snippet.replace(/<span class="searchmatch">|<\/span>/g, ''),
      pageid: item.pageid
    }))
  }

  async getArticle(title: string): Promise<WikiArticle | null> {
    
    const params = new URLSearchParams({
      action: 'parse',
      page: title,
      prop: 'text|displaytitle',
      format: 'json',
      origin: '*',
      disableeditsection: 'true',
      mobileformat: 'true',
      redirects: '1'
    })

    const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
      headers: {
        'User-Agent': 'WikiCLI/1.0 (https://github.com/ImpulseDoes/wiki-cli)'
      }
    })
    const data: any = await response.json()

    if (data.error) {
      return null
    }

    return {
      title: data.parse.title,
      content: data.parse.text['*'],
      url: `https://${this.lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`
    }
  }
}