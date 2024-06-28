# Multi-Party Conversational Agent Sample

This guide provides instructions on using the Ubiq-Genie framework to create an application that enables collaborative interaction with a conversational agent in a shared environment. The agent recognizes users present in the room, responds to their queries, faces the speaker during the interaction, and uses simple gestures while communicating.

## Prerequisites

An Azure Speech Services subscription is needed for this sample. You can create a free subscription [here](https://azure.microsoft.com/en-us/try/cognitive-services/?api=speech-services).

> [!IMPORTANT]
> Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the root [README](../../README.md) file.

## Running the Sample

Follow these steps to run the sample:

### Server (Node.js)

1. Open a terminal and navigate to the `Node/apps/conversational_agent` directory. Ensure the Python virtual environment in the `samples` directory is activated (e.g., `source venv/bin/activate`).
2. Confirm that `Node/apps/conversational_agent/config.json` contains the correct configuration. Specifically, ensure that `roomserver:uri` points to the correct room server URI, `roomserver:tcp:port` is set to the correct port, and `roomserver:joinExisting` is set to `true` if you want to join an existing server, and `false` if you want to start a new server on `localhost`.
3. Create an .env file and define the `SPEECH_KEY` and `SPEECH_REGION` variables in `Node/apps/conversational_agent/.env` to match your Azure Speech Services subscription key and region. Also add the `OPENAI_API_KEY` variable with your OpenAI API key. For example:

    ```bash
    SPEECH_KEY=YOUR_SPEECH_KEY
    SPEECH_REGION=YOUR_SPEECH_REGION
    OPENAI_API_KEY=YOUR_OPENAI_API_KEY
    ```

4. Execute the following command:

    ```bash
    npm start conversational_agent
    ```

### Client (Unity)

1. Launch Unity and navigate to the `Unity/Assets/Apps/ConversationalAgent` directory. Open the `ConversationalAgent.unity` scene.
2. Check that the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be `localhost`. This should correspond to the configuration on the server side.
3. In the Unity Editor, press the `Play` button to launch the application.
4. Speak into the microphone. The agent will respond to your queries and requests, facing you while speaking and employing simple gestures.

## Demonstration Video

For a demonstration video of this sample, please refer to the [Ubiq-Genie demo video](https://youtu.be/cGz0z9BIgQk).

## Support

For any questions or issues, please use the Discussions tab on Github or send a message in the *ubiq-genie* channel in the [Ubiq Discord server](https://discord.gg/cZYzdcxAAB).
