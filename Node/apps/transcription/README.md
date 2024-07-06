# Transcription Sample

This guide provides instructions on how to use the Ubiq-Genie framework to transcribe audio streams in a room using the transcription sample. For each peer in the room, the sample records the audio stream and transcribes it using Azure Speech Services. The transcriptions are saved to a .csv file, and the audio recordings are saved to a .wav file.

## Prerequisites

For this sample, you will need a computer or VR headset equipped with a microphone, along with an Azure Speech Services subscription. To create a free subscription, follow the link [here](https://azure.microsoft.com/en-us/try/cognitive-services/?api=speech-services).

> [!IMPORTANT]
> Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the root [README](../../../README.md) file.

## Running the Sample

### Server (Node.js)

We recommend using VS Code to run and modify the server application, with the `Node` folder as the workspace root. To run the server application:

1. Open a terminal and navigate to the `Node/apps/transcription` directory. Ensure that your conda or venv environment is activated.
2. Execute the command below, which will guide you through the configuration process, including setting up the server information and the required environment variables. Configuration will only run the first time you start the application. Ensure that you apply the same server configuration to the Unity client (in `Unity/Assets/ServerConfig.asset`).

    ```bash
    npm start transcription
    ```

If you need to reconfigure the application, you can run `npm start transcription configure`. You may also manually configure the application by changing the `config.json` and `.env` files. The `config.json` file contains the server configuration, while the `.env` file contains the environment variables for the Azure Speech Services subscription key and region (`SPEECH_KEY` and `SPEECH_REGION`).

### Client (Unity)

1. Launch Unity and navigate to the `Unity/Assets/Apps/Transcription` directory. Open the `Transcription.unity` scene.
2. Ensure the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be `localhost`. This should correspond to the configuration on the server side.
3. In the Unity Editor, press the `Play` button to launch the application.
4. Speak into the microphone. The speech of every user will be recorded and saved to a .wav file and transcriptions are stored in a .csv file, both located in the `Node/samples/apps/transcription/recordings` directory by default.

## Support

For any questions or issues, please use the Discussions tab on GitHub or send a message in the *ubiq-genie* channel in the [Ubiq Discord server](https://discord.gg/cZYzdcxAAB).
