# Voice-based Texture Generation Sample

This guide demonstrates how to use the Ubiq-Genie framework to create an application that generates textures based on voice commands. Users also have the option to specify target objects using ray-based selection.

## Prerequisites

To run this sample, you'll need a computer capable of supporting Stable Diffusion 2.0. This typically requires a GPU with at least 4GB of memory and 16GB of RAM. The sample has been tested on Windows 11 with an NVIDIA GeForce RTX 3080 Ti GPU and 64GB of RAM.

Additionally, an Azure Speech Services subscription is required. You can create a free subscription [here](https://azure.microsoft.com/en-us/try/cognitive-services/?api=speech-services).

Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For more details, please see the [README](../../README.md) file in the Genie folder.

## Running the Sample

Follow these steps to run the sample:

1. Open a terminal and navigate to the `Server/samples/apps/texture_generation` directory.
2. Update the `key` and `serviceRegion` variables in `config.json` to match your Azure Speech Services subscription key and region.
3. Execute the following command:

    ```bash
    node app.js
    ```

4. Launch Unity and navigate to the `Unity/Assets/Samples/Ubiq-Genie/TextureGeneration` directory. Open the `TextureGeneration.unity` scene.
5. Ensure the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be `localhost`.
6. In the Unity Editor, press the `Play` button to launch the application.
7. Press and hold the space bar on desktop or use the grip button in VR to record a voice command, releasing it to stop the recording.
8. Use a command like "make the floor look like lava" or "make the wall look like a brick texture". The texture of the specified object will change to a checkerboard pattern while the new texture is being generated. Once generated, the object will take on the specified texture.

    - _In VR, the trigger button can be used for ray-based selection of the target object. In this case, use 'this' or 'that' to refer to the selected object. For example, "make this look like a leather texture"._

## Demonstration Video

For a demonstration video of this sample, please refer to the [Ubiq-Genie demo video](https://youtu.be/cGz0z9BIgQk).

## Support

For any questions or issues, please use the Discussions tab on Github or send an email to [Nels Numan](mailto:nels.numan@ucl.ac.uk).