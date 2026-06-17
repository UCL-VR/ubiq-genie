# Audio Recorder Service

Records audio from connected peers to WAV files. This service does not use the provider pattern — it manages WAV file writers directly.

## Usage

```typescript
import { AudioRecorder } from 'ubiq-genie';

const recorder = new AudioRecorder(scene);
recorder.write(uuid, audioBuffer);
```

Recordings are saved per-peer as 48 kHz 16-bit mono WAV files. Files are finalized with correct headers when peers disconnect.
