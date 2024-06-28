# Transcription Sample

This guide provides instructions on how to use the Ubiq-Genie framework to transcribe audio streams in a room using the transcription sample. For each peer in the room, the sample records the audio stream and transcribes it using Azure Speech Services. The transcriptions are saved to a .csv file, and the audio recordings are saved to a .wav file.

## Prerequisites

For this sample, you will need a computer or VR headset equipped with a microphone, along with an Azure Speech Services subscription. To create a free subscription, follow the link [here](https://azure.microsoft.com/en-us/try/cognitive-services/?api=speech-services).

> [!IMPORTANT]
> Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the root [README](../../README.md) file.

## Running the Sample

### Server (Node.js)

1. Open a terminal and navigate to the `Node/apps` directory. Make sure you have activated the `conda` virtual environment (e.g., `conda activate ubiq-genie`).
2. Confirm that `Node/apps/transcription/config.json` contains the correct configuration. Specifically, ensure that `roomserver:uri` points to the correct room server URI, `roomserver:tcp:port` is set to the correct port, and `roomserver:joinExisting` is set to `true` if you want to join an existing server, and `false` if you want to start a new server on `localhost`.
3. Update the `SPEECH_KEY` and `SPEECH_REGION` variables in `Node/apps/transcription/.env` to match your Azure Speech Services subscription key and region. For example:

    ```bash
    SPEECH_KEY=YOUR_SPEECH_KEY
    SPEECH_REGION=YOUR_SPEECH_REGION
    ```

4. Execute the following command:

    ```bash
    npm start transcription
    ```

### Client (Unity)

1. Launch Unity and navigate to the `Unity/Assets/Apps/Transcription` directory. Open the `Transcription.unity` scene. Confirm that the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be set to `localhost`.
2. In the Unity Editor, press the `Play` button to launch the application.
3. Speak into the microphone. The speech of every user will be recorded and saved to a .wav file and transcriptions are stored in a .csv file, both located in the `Server/samples/apps/transcription/recordings` directory by default.

## Support

For any questions or issues, please use the Discussions tab on Github or send a message in the *ubiq-genie* channel in the [Ubiq Discord server](https://discord.gg/cZYzdcxAAB).
