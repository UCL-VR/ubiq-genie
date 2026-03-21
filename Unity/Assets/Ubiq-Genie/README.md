# Ubiq-Genie (Unity Package)

This is the Unity package (`com.ucl.ubiq-genie`) for [Ubiq-Genie](https://github.com/UCL-VR/ubiq-genie). For an overview of the project, server setup, and sample walkthroughs, see the [main README](https://github.com/UCL-VR/ubiq-genie#readme).

## Installation

### Cloning the Repository (recommended for development)

If you have cloned the full repository, this package is located at `Assets/Ubiq-Genie/` and is referenced via `Packages/manifest.json` — no extra steps are needed. Open the `Unity` folder in Unity Hub to get started. Sample apps are directly accessible in the Project window under `Assets/Ubiq-Genie/Apps/`.

### Via Git URL (UPM)

To use the package in your own Unity project, open **Window → Package Manager → + → Add package from git URL** and enter:

```
https://github.com/UCL-VR/ubiq-genie.git#upm
```

> [!NOTE]
> You still need a running Ubiq-Genie server for the samples to function. See the [server setup instructions](https://github.com/UCL-VR/ubiq-genie#initial-setup) in the main README.

## Samples

Import samples from **Window → Package Manager → Ubiq-Genie → Samples**:

| Sample | Server App | Description |
|---|---|---|
| **Base** | `base` | Minimal scene with networking set up — use as a starting point |
| **Conversational Agent** | `conversational_agent` | Voice-driven virtual assistant with avatar animation |
| **Scene Describer** | `stream_describer` | Camera capture sent to server for a textual scene description |
| **Texture Generation** | `texture_generation` | AI-generated textures applied to scene materials |
| **Transcription** | `transcription` | Real-time speech-to-text transcription |
| **Video Recorder** | `video_recorder` | Virtual camera recording streamed to the server |

Each sample has a corresponding Node.js server app (listed in the **Server App** column) located in `Node/apps/` of the main repository.

> [!NOTE]
> Node apps can define multiple versions as subfolders under `Node/apps/<app-name>/`, where each version folder contains its own `app.ts` and `config.json`. Use `npm start <app-name>` to select a version interactively, or `npm start <app-name> <version>` to start one directly.

## Package Structure

```
Runtime/                        Core scripts (assembly: Ubiq.Genie)
  Compatibility/XRI/            XR Interaction Toolkit support (assembly: Ubiq.Genie.XRI)
Apps/                           Sample app scenes and scripts
```

### Runtime

The `Runtime/` folder contains scripts shared across all samples:

- **MediaTrackManager / MediaTrackPeerConnection** — WebRTC media-track management using Ubiq's peer-connection layer.
- **InjectableAudioSource** — Receives PCM16 audio from the network and plays it through a Unity `AudioSource`.
- **MessageReceiver** — Generic Ubiq message receiver for server-to-client communication.
- **SelectionManager** *(Compatibility/XRI)* — Ray-cast object selection via XR Interaction Toolkit. Only compiled when XRI is installed.

### Dependencies

| Package | Required | Notes |
|---|---|---|
| [Ubiq](https://github.com/UCL-VR/ubiq) (`com.ucl.ubiq`) | Yes | Core networking framework |
| [Unity WebRTC (Ubiq fork)](https://github.com/UCL-VR/unity-webrtc-ubiq-fork) (`com.unity.webrtc-ubiq-fork`) | Yes | WebRTC media tracks |
| XR Interaction Toolkit (`com.unity.xr.interaction.toolkit`) | No | Enables `SelectionManager` for ray-cast selection |
