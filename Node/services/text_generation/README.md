# Text Generation Service

Manages a child process that generates text responses from text prompts.

## Providers

| Provider | Backend | Requirements | Process Mode |
|----------|---------|-------------|--------------|
| `openai` | OpenAI ChatGPT API (Python) | `OPENAI_API_KEY` env var | singleton |
| `huggingface` | HuggingFace Transformers (Python) | GPU with ~12-14 GB VRAM for 4B models | singleton |
| `llama-cpp` | node-llama-cpp GGUF (Node.js) | Auto-downloads GGUF models from HuggingFace | singleton |
| `ollama` | Ollama API (Node.js) | `ollama serve` running | singleton |

## Config-Driven Usage

Set the provider in your app's `config.json`:

```json
{
  "services": {
    "textGeneration": {
      "provider": "llama-cpp",
      "model": "hf:Qwen/Qwen3-4B-GGUF/Qwen3-4B-Q8_0.gguf",
      "options": {
        "preprompt": "You are a helpful assistant.",
        "thinking": false
      }
    }
  }
}
```

## Programmatic Usage

```typescript
import { TextGenerationService } from 'ubiq-genie';
import { createLlamaCppProvider } from 'ubiq-genie';

// Auto-resolved from config.json
const service = new TextGenerationService(scene);

// Or provide explicitly
const service = new TextGenerationService(scene, createLlamaCppProvider({
    model: 'hf:Qwen/Qwen3-4B-GGUF/Qwen3-4B-Q8_0.gguf',
    preprompt: 'You are a helpful assistant.',
}));
```

## Protocol

- **Input**: Text messages written to stdin (one per line)
- **Output**: Generated text written to stdout (streamed, `>` prefix per line for some providers)
