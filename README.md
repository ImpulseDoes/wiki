# Wiki CLI

A high-performance, professional Wikipedia reader for the terminal. Inspired by the Fabric design philosophy, it provides a distraction-free, interactive environment for exploring knowledge.

## Features

- **Interactive REPL**: A persistent shell environment.
- **Advanced Reader**: Non-blocking article reader with smooth navigation.
- **Smart Search**: Find specific text within articles using the built-in search feature (`f`).
- **High Performance**: Powered by SQLite for instant caching and tokenized article access.

## Usage

Start the interactive shell:
```bash
wiki
```

Inside the shell, you can use:
- `search <query>`: Find and index new articles.
- `read <title>`: Open a cached article.
- `exit` or `e`: Close the application.

### Reader Controls
- `↑ / ↓`: Scroll line by line.
- `← / →`: Page up / Page down.
- `f`: Enter search mode to find text in the article.
- `n / N`: Jump to next / previous search match.
- `e`: Exit the reader and return to the main menu.

## Storage
All local data (databases and cache) are stored in the `./storage` directory to keep your workspace clean.

## License
MIT