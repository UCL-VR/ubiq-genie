# Voice-based Texture Generation Sample

This guide demonstrates how to use the Ubiq-Genie framework to create an application that generates textures based on voice commands. Users also have the option to specify target objects using ray-based selection.

## Prerequisites

To run this sample, you'll need a computer capable of supporting Stable Diffusion 2.0. This typically requires a GPU with at least 4GB of memory and 16GB of RAM. The sample has been tested on Windows 11 with an NVIDIA GeForce RTX 3080 Ti GPU and 64GB of RAM. macOS is also supported through PyTorch's MPS support (requires Apple Silicon).

Additionally, an Azure Speech Services subscription is required. You can create a free subscription [here](https://azure.microsoft.com/en-us/try/cognitive-services/?api=speech-services).

> [!IMPORTANT]
> Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the root [README](../../../README.md) file.

## Running the Sample

### Server (Node.js)

We recommend using VS Code to run and modify the server application, with the `Node` folder as the workspace root. To run the server application:

1. Open a terminal and navigate to the `Node/apps/texture_generation` directory. Ensure that your conda or venv environment is activated.
2. Execute the command below, which will guide you through the configuration process, including setting up the server information and the required environment variables. Configuration will only run the first time you start the application. Ensure that you apply the same server configuration to the Unity client (in `Unity/Assets/ServerConfig.asset`).

    ```bash
    npm start texture_generation
    ```

If you need to reconfigure the application, you can run `npm start texture_generation configure`. You may also manually configure the application by changing the `config.json` and `.env` files. The `config.json` file contains the server configuration, while the `.env` file contains the environment variables for the Azure Speech Services subscription key and region (`SPEECH_KEY` and `SPEECH_REGION`).

### Client (Unity)

1. Launch Unity and navigate to the `Unity/Assets/Apps/TextureGeneration` directory. Open the `TextureGeneration.unity` scene.
2. Ensure the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be `localhost`. This should correspond to the configuration on the server side.
3. In the Unity Editor, press the `Play` button to launch the application or deploy it to a VR headset.
4. Press and hold the trigger button to activate the voice command system.
5. Say a command like "make this look like lava" while pointing at your target object in the scene.

## Demonstration Video

For a demonstration video of this sample, please refer to the [Ubiq-Genie demo video](https://youtu.be/cGz0z9BIgQk).

## Support

For any questions or issues, please use the Discussions tab on GitHub or send a message in the *ubiq-genie* channel in the [Ubiq Discord server](https://discord.gg/cZYzdcxAAB).
