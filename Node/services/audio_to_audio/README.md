# Audio-to-Audio Service

Manages a child process that ingests raw audio and produces raw audio (and optionally text) output, replacing the traditional STT → text generation → TTS pipeline with a single model.

## Providers

| Provider | Backend | Requirements | Process Mode |
|----------|---------|-------------|--------------|
| `personaplex` | NVIDIA PersonaPlex (Moshi) via [nsalminen/personaplex](https://github.com/nsalminen/personaplex) fork (adds stdio streaming) | CUDA GPU, HF_TOKEN, external repo | singleton |

## Config-Driven Usage

```json
{
  "services": {
    "audioToAudio": {
      "provider": "personaplex",
      "python": {
        "command": "/path/to/personaplex/.venv/bin/python"
      },
      "externalRepo": {
        "path": "/path/to/personaplex",
        "url": "https://github.com/nsalminen/personaplex"
      },
      "options": {
        "voicePrompt": "NATF1.pt",
        "textPrompt": "Your name is Janet.",
        "device": "cuda"
      }
    }
  }
}
```

## Programmatic Usage

```typescript
import { AudioToAudioService, createPersonaPlexProvider } from 'ubiq-genie';

// Auto-resolved from config.json
const service = new AudioToAudioService(scene);

// Or provide explicitly
const service = new AudioToAudioService(scene, createPersonaPlexProvider({
    voicePrompt: 'NATF1.pt',
    textPrompt: 'You are a helpful assistant.',
}));
```

## Protocol

The PersonaPlex provider uses a binary length-prefixed framing protocol on stdin/stdout:

- **Packet format**: `[4-byte LE length][1-byte kind][payload]`
- **Kind bytes**: `0x00` = handshake, `0x01` = audio, `0x02` = text, `0xFF` = error
- **Audio format**: 24 kHz 16-bit mono PCM (upsampled to 48 kHz for Unity)

Use `encodePacket()` and `LengthPrefixedParser` from `ubiq-genie` for encoding/decoding.

## Prerequisites

1. Clone the fork with stdio streaming support: `git clone https://github.com/nsalminen/personaplex`
   (fork of [NVIDIA/personaplex](https://github.com/NVIDIA/personaplex))
2. Install: `pip install ./personaplex/moshi/.`
3. Accept the HuggingFace model license and set `HF_TOKEN`
4. Set the repo path and Python venv in your config.json
