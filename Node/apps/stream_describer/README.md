# Scene Describer Sample

This guide provides instructions on how to use the Ubiq-Genie framework to generate natural-language descriptions of a video stream using a Visual Language Model. The application ingests a video stream (with track ID `description_stream`) via WebRTC, passes frames to a **Visual Question Answering** service powered by [FastVLM](https://github.com/apple/ml-fastvlm), and sends the resulting text description back to Unity clients. Optionally, descriptions can also be read aloud using text-to-speech (Kokoro TTS).

## Prerequisites

For this sample, you will need:

- A computer with a GPU. On macOS with Apple Silicon, the model runs on MPS; on Linux/Windows with an NVIDIA GPU, it uses CUDA; otherwise it falls back to CPU.
- A local clone of the [ml-fastvlm](https://github.com/apple/ml-fastvlm) repository with its dependencies installed (see the repo's README for setup instructions).
- A downloaded FastVLM checkpoint (e.g. `llava-fastvithd_1.5b_stage3`) placed under the `checkpoints/` directory of the ml-fastvlm repo.

> [!IMPORTANT]
> Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the root [README](../../../README.md) file.

## Running the Sample

### Server (Node.js)

We recommend using VS Code to run and modify the server application, with the `Node` folder as the workspace root. To run the server application:

1. Open a terminal and navigate to the `Node/apps/stream_describer` directory. Ensure that your conda or venv environment is activated.
2. Execute the command below, which will guide you through the configuration process, including setting up the server information. Configuration will only run the first time you start the application. Ensure that you apply the same server configuration to the Unity client (in `Unity/Assets/ServerConfig.asset`).

    ```bash
    npm start stream_describer
    ```

If you need to reconfigure the application, you can run `npm start stream_describer configure`. You may also manually configure the application by editing the `config.json` file. At a minimum, set `fastvlmRepoPath` and `fastvlmModelPath` to point to your local ml-fastvlm clone and checkpoint directory.

### Client (Unity)

1. Launch Unity and navigate to the `Unity/Assets/Apps/SceneDescriber` directory. Open the `SceneDescriber.unity` scene.
2. Ensure the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be `localhost`. This should correspond to the configuration on the server side.
3. In the Unity Editor, press the `Play` button to launch the application.
4. Press the **Spacebar** to trigger a scene description. The resulting text will appear in the Unity console via the `MessageReceiver` component, and if TTS is enabled, the description will be spoken aloud through the `InjectableAudioSource`.

## Configuration

The `config.json` file supports the following options:

- **`fastvlmRepoPath`**: Absolute path to your local clone of the [ml-fastvlm](https://github.com/apple/ml-fastvlm) repository. Required.
- **`fastvlmModelPath`**: Absolute path to the FastVLM checkpoint directory (e.g. `<repo>/checkpoints/llava-fastvithd_1.5b_stage3`). Required.
- **`prompt`**: The prompt sent to the VLM for each frame. Change this to control the style and length of the descriptions.
- **`tts`**: Set to `true` to enable text-to-speech. When enabled, descriptions are converted to audio using Kokoro TTS (runs locally, no API key required) and sent on network ID `96`.

## Demonstration Video

*Coming soon.*

## Support

For any questions or issues, please use the Discussions tab on GitHub or send a message in the *ubiq-genie* channel in the [Ubiq Discord server](https://discord.gg/cZYzdcxAAB).
