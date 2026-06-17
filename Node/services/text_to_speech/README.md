# Text-to-Speech Service

Manages a child process that synthesizes speech from text.

## Providers

| Provider | Backend | Requirements | Process Mode |
|----------|---------|-------------|--------------|
| `azure` | Azure Cognitive Services | `SPEECH_KEY` and `SPEECH_REGION` env vars | singleton |
| `kokoro` | Kokoro-82M (local) | No API keys — runs locally | singleton |

## Config-Driven Usage

```json
{
  "services": {
    "textToSpeech": {
      "provider": "kokoro"
    }
  }
}
```

## Programmatic Usage

```typescript
import { TextToSpeechService, KokoroTTSProvider } from 'ubiq-genie';

// Auto-resolved from config.json (default: azure)
const service = new TextToSpeechService(scene);

// Or provide explicitly
const service = new TextToSpeechService(scene, KokoroTTSProvider);
```

## Protocol

- **Input**: Text lines written to stdin (one sentence/phrase per line)
- **Output**: Raw 48 kHz 16-bit mono PCM audio written to stdout
