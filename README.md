# Little House AI

A clean foundation for a free-first AI chat workspace. No login, account, billing, or paid AI API is built in.

## Foundation
- Minimal chat interface with message bubbles and a composer
- Small Node.js server with local Ollama chat and model health endpoints
- Basic reference search through Wikipedia, plus links to full DuckDuckGo searches
- Browser-local conversation history and settings
- No frontend framework or npm dependencies

## Run
Requires Node.js 20+.

```sh
npm start
```

Open http://localhost:4173.

For AI replies, install [Ollama](https://ollama.com/) and download a model:

```sh
ollama pull qwen2.5:3b
```

Then open Settings in the app and refresh the model list. Models run locally; performance depends on your hardware. To use an Ollama service on another address, set `OLLAMA_HOST` before starting the server.

## Notes
Search queries go to Wikipedia; full web search opens DuckDuckGo. Chat requests are sent to the configured Ollama service. This is a starter foundation, not a finished autonomous browsing agent.
