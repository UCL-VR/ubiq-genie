# Image Generation Service

Manages a child process that generates images from text prompts.

## Providers

| Provider | Backend | Requirements | Process Mode |
|----------|---------|-------------|--------------|
| `stable-diffusion` | HuggingFace Diffusers (Python) | CUDA GPU | lazy-singleton |

## Config-Driven Usage

```json
{
  "services": {
    "imageGeneration": {
      "provider": "stable-diffusion",
      "options": {
        "outputFolder": "../../apps/texture_generation/data",
        "promptPostfix": ", 4k"
      }
    }
  }
}
```

## Programmatic Usage

```typescript
import { ImageGenerationService, createStableDiffusionProvider } from 'ubiq-genie';

// Auto-resolved from config.json
const service = new ImageGenerationService(scene);

// Or provide explicitly
const service = new ImageGenerationService(scene, createStableDiffusionProvider({
    outputFolder: './output',
    promptPostfix: ', high quality',
}));
```

## Protocol

- **Input**: JSON lines with `prompt` and `output_file` fields
- **Output**: Generated filename written to stdout when complete
- **Process mode**: Lazy-singleton — spawned on first peer join, killed when all peers leave
