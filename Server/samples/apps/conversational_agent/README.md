# Multi-Party Conversational Agent Sample

This guide provides instructions on using the Ubiq-Genie framework to create an application that enables collaborative interaction with a conversational agent in a shared environment. The agent recognizes users present in the room, responds to their queries, faces the speaker during the interaction, and uses simple gestures while communicating.

## Prerequisites

An Azure Speech Services subscription is needed for this sample. You can create a free subscription [here](https://azure.microsoft.com/en-us/try/cognitive-services/?api=speech-services).

Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the [README](../../README.md) file in the Genie folder.

## Running the Sample

Follow these steps to run the sample:

1. Open a terminal and navigate to the `Server/samples/apps/conversational_agent` directory. Ensure the Python virtual environment in the `samples` directory is activated (e.g., `source venv/bin/activate`).
2. Update the `key` and `serviceRegion` variables in `config.json` to match your Azure Speech Services subscription key and region.
3. Execute the following command:

    ```bash
    node app.js
    ```

4. Launch Unity and navigate to the `Unity/Assets/Samples/Ubiq-Genie/ConversationalAgent` directory. Open the `ConversationalAgent.unity` scene.
5. Check that the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be `localhost`.
6. In the Unity Editor, press the `Play` button to launch the application.
7. Speak into the microphone. The agent will respond to your queries and requests, facing you while speaking and employing simple gestures.
    - On desktop, press and hold the space bar to record a voice command, releasing it to stop the recording. In VR, use the grip button to record a voice command, releasing it to stop the recording.

## Demonstration Video

For a demonstration video of this sample, please refer to the [Ubiq-Genie demo video](https://youtu.be/cGz0z9BIgQk).

## Support

For any questions or issues, please use the Discussions tab on Github or send an email to [Nels Numan](mailto:nels.numan@ucl.ac.uk).
