# Voice-based Texture Generation Sample

This guide demonstrates how to use the Ubiq-Genie framework to create an application that generates textures based on voice commands. Users also have the option to specify target objects using ray-based selection.

## Prerequisites

To run this sample, you'll need a computer capable of supporting Stable Diffusion 2.0. This typically requires a GPU with at least 4GB of memory and 16GB of RAM. The sample has been tested on Windows 11 with an NVIDIA GeForce RTX 3080 Ti GPU and 64GB of RAM. macOS is also supported through PyTorch's mps support (requires Apple Silicon).

Additionally, an Azure Speech Services subscription is required. You can create a free subscription [here](https://azure.microsoft.com/en-us/try/cognitive-services/?api=speech-services).

> [!IMPORTANT]
> Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the root [README](../../README.md) file.

## Running the Sample

### Server (Node.js)

1. Open a terminal and navigate to the `Node/apps/texture_generation` directory. Make sure you have activated the `conda` virtual environment (e.g., `conda activate ubiq-genie`). For this sample, also ensure you have the correct PyTorch and CUDA versions installed (see the [PyTorch website](https://pytorch.org/get-started/locally/) for more information).
2. Confirm that `Node/apps/texture_generation/config.json` contains the correct configuration. Specifically, ensure that `roomserver:uri` points to the correct room server URI, `roomserver:tcp:port` is set to the correct port, and `roomserver:joinExisting` is set to `true` if you want to join an existing server, and `false` if you want to start a new server on `localhost`.
3. Update the `SPEECH_KEY` and `SPEECH_REGION` variables in `Node/apps/texture_generation/.env` to match your Azure Speech Services subscription key and region. For example:

    ```bash
    SPEECH_KEY=YOUR_SPEECH_KEY
    SPEECH_REGION=YOUR_SPEECH_REGION
    ```

4. Execute the following command:

    ```bash
    npm start texture_generation
    ```

### Client (Unity)

1. Launch Unity and navigate to the `Unity/Assets/Apps/TextureGeneration` directory. Open the `TextureGeneration.unity` scene.
2. Ensure the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be `localhost`. This should correspond to the configuration on the server side.
3. In the Unity Editor, press the `Play` button to launch the application, or deploy it to a VR headset.
4. Press and hold the trigger button to activate the voice command system.
5. Say a command like "make this look like lava" while pointing at your target object in the scene.

## Demonstration Video

For a demonstration video of this sample, please refer to the [Ubiq-Genie demo video](https://youtu.be/cGz0z9BIgQk).

## Support

For any questions or issues, please use the Discussions tab on Github or send a message in the *ubiq-genie* channel in the [Ubiq Discord server](https://discord.gg/cZYzdcxAAB).