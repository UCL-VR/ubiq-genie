# Transcription Sample

This guide provides instructions on how to use the Ubiq-Genie framework to transcribe audio streams in a room using the transcription sample. The transcriptions are stored in a file named `transcription.txt` located in the `Server/samples/apps/transcription` directory.

## Prerequisites

For this sample, you will need a computer or VR headset equipped with a microphone, along with an Azure Speech Services subscription. To create a free subscription, follow the link [here](https://azure.microsoft.com/en-us/try/cognitive-services/?api=speech-services). Alternatively, you can use Google Cloud Speech-to-Text or OpenAI Whisper (locally on the server) by modifying the `speech_to_text` service in `Genie/services` to use the `transcribe_gcp.py` or `transcribe_whisper.py` scripts, respectively.

Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the [README](../../README.md) file in the Genie folder.

## Running the Sample

Follow these steps to run the sample:

1. Open a terminal and navigate to the `Server/samples/apps/transcription` directory. Make sure you have activated the Python virtual environment in the `samples` directory (e.g., `source venv/bin/activate`).
2. Update the `key` and `serviceRegion` variables in `config.json` to match your Azure Speech Services subscription key and region.
3. Execute the following command:

    ```bash
    node app.js
    ```

4. Launch Unity and navigate to the `Unity/Assets/Samples/Ubiq-Genie/Transcription` directory. Open the `Transcription.unity` scene. Confirm that the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be set to `localhost`.
5. In the Unity Editor, press the `Play` button to launch the application.
6. Speak into the microphone. The transcriptions will appear in the `transcription.txt` file (prefixed with the UUID of the user who spoke) and will also be displayed in the Unity Editor debug console.

## Support

For any questions or issues, please use the Discussions tab on Github, or send an email to [Nels Numan](mailto:nels.numan@ucl.ac.uk).