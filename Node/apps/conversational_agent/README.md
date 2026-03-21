# Multi-Party Conversational Agent Sample

This guide provides instructions on using the Ubiq-Genie framework to create an application that enables collaborative interaction with a conversational agent in a shared environment. The agent recognizes users present in the room, responds to their queries, faces the speaker during the interaction, and uses simple gestures while communicating.

## Prerequisites

An Azure Speech Services subscription is needed for this sample. You can create a free subscription [here](https://azure.microsoft.com/en-us/try/cognitive-services/?api=speech-services).

> [!IMPORTANT]
> Before proceeding, ensure the Ubiq-Genie framework and the necessary dependencies for this sample are correctly installed. For further details, please see the root [README](../../../README.md) file.

## Running the Sample

Follow these steps to run the sample:

### Server (Node.js)

We recommend using VS Code to run and modify the server application, with the `Node` folder as the workspace root. To run the server application:

1. Open a terminal and navigate to the `Node` directory. Ensure that your conda or venv environment is activated.
2. Start the app from `Node` using one of the commands below. Configuration will run automatically the first time a version is started. Ensure that you apply the same server configuration to the Unity client (in `Unity/Assets/ServerConfig.asset`).

    ```bash
    # Prompt for a version (personaplex or multi_model)
    npm start conversational_agent

    # Start a specific version directly
    npm start conversational_agent personaplex
    npm start conversational_agent multi_model
    ```

If you need to reconfigure, run one of the following:

```bash
npm start conversational_agent configure
npm start conversational_agent personaplex configure
npm start conversational_agent multi_model configure
```

Each version has its own configuration files:

- `Node/apps/conversational_agent/personaplex/config.json` for the PersonaPlex audio-to-audio pipeline.
- `Node/apps/conversational_agent/multi_model/config.json` for the STT → text generation → TTS pipeline.
- `Node/apps/conversational_agent/multi_model/.env` for Azure/OpenAI credentials (`SPEECH_KEY`, `SPEECH_REGION`, `OPENAI_API_KEY`).

> [!WARNING]
> The `personaplex` version is currently not optimized for multi-party conversations. It does not differentiate which peer in the room is speaking.

### Version Differences

| Version | Pipeline | Typical Use | Requirements | Multi-Party Behavior |
|---|---|---|---|---|
| `personaplex` | Audio → PersonaPlex → Audio (speech-to-speech) | Low-latency voice-to-voice interactions with a single active speaker | PersonaPlex repo + model assets + Python environment configured in `personaplex/config.json` | Does not reliably identify which peer is speaking |
| `multi_model` | Speech-to-text → text generation → text-to-speech | Multi-user conversations where speaker identity and addressing matter | Azure Speech credentials + OpenAI API key in `multi_model/.env` | Tracks speaker identity through STT output and routes responses to the parsed target peer |

In short: choose `personaplex` for direct speech-to-speech behavior, and choose `multi_model` for more reliable multi-party turn-taking and speaker-aware routing.

### Client (Unity)

1. In Unity, open the `ConversationalAgent.unity` scene. If you installed the package via git URL (UPM), you first need to import the **Conversational Agent** sample from **Window → Package Manager → Ubiq-Genie → Samples**.
2. Ensure the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be `localhost`. This should correspond to the configuration on the server side.
3. In the Unity Editor, press the `Play` button to launch the application.
4. Speak into the microphone. The agent will respond to your queries and requests, facing you while speaking and employing simple gestures.

## Demonstration Video

For a demonstration video of this sample, please refer to the [Ubiq-Genie demo video](https://youtu.be/cGz0z9BIgQk).

## Support

For any questions or issues, please use the Discussions tab on GitHub or send a message in the *ubiq-genie* channel in the [Ubiq Discord server](https://discord.gg/cZYzdcxAAB).
