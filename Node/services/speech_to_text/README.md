# Speech-to-Text Service

Manages a child process that transcribes audio into text.

## Providers

| Provider | Backend | Requirements | Process Mode |
|----------|---------|-------------|--------------|
| `azure` | Azure Cognitive Services | `SPEECH_KEY` and `SPEECH_REGION` env vars | per-peer |
| `nemotron-streaming` | NVIDIA Nemotron 0.6B (NeMo) | CUDA GPU, NeMo toolkit | per-peer |

## Config-Driven Usage

```json
{
  "services": {
    "speechToText": {
      "provider": "nemotron-streaming"
    }
  }
}
```

## Programmatic Usage

```typescript
import { SpeechToTextService, NemotronStreamingSTTProvider } from 'ubiq-genie';

// Auto-resolved from config.json (default: azure)
const service = new SpeechToTextService(scene);

// Or provide explicitly
const service = new SpeechToTextService(scene, NemotronStreamingSTTProvider);
```

## Protocol

- **Input**: Raw 48 kHz 16-bit mono PCM audio written to stdin
- **Output**: Transcribed text lines written to stdout with `>` prefix
- **Process mode**: Per-peer — one process per connected client, identified by peer UUID
