# Visual Question Answering Service

Manages a child process that answers questions about images (visual question answering / image captioning).

## Providers

| Provider | Backend | Requirements | Process Mode |
|----------|---------|-------------|--------------|
| `fastvlm` | Apple ml-fastvlm (Python) | CUDA/MPS GPU, external repo | singleton |

## Config-Driven Usage

```json
{
  "services": {
    "visualQuestionAnswering": {
      "provider": "fastvlm",
      "model": "llava-fastvithd_1.5b_stage3",
      "python": {
        "command": "/path/to/ml-fastvlm/.venv/bin/python"
      },
      "externalRepo": {
        "path": "/path/to/ml-fastvlm",
        "url": "https://github.com/apple/ml-fastvlm"
      }
    }
  }
}
```

## Programmatic Usage

```typescript
import { VisualQuestionAnsweringService, createFastVLMProvider } from 'ubiq-genie';

// Auto-resolved from config.json
const service = new VisualQuestionAnsweringService(scene);

// Or provide explicitly
const service = new VisualQuestionAnsweringService(scene, createFastVLMProvider({
    modelPath: 'llava-fastvithd_0.5b_stage3',
}));
```

## Protocol

- **Input**: JSON header line (`{"width": N, "height": N, "prompt": "..."}`) followed by raw I420 frame data
- **Output**: JSON response lines (`{"description": "..."}`)

## Prerequisites

1. Clone: `git clone https://github.com/apple/ml-fastvlm`
2. Install: `pip install -e /path/to/ml-fastvlm`
3. Download checkpoints: `cd /path/to/ml-fastvlm && bash get_models.sh`
4. Set the repo path, model, and Python venv in your config.json
