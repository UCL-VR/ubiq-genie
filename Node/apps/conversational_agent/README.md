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

1. Open a terminal and navigate to the `Node/apps/conversational_agent` directory. Ensure that your conda or venv environment is activated.
2. Execute the command below, which will guide you through the configuration process, including setting up the server information and the required environment variables. Configuration will only run the first time you start the application. Ensure that you apply the same server configuration to the Unity client (in `Unity/Assets/ServerConfig.asset`).

    ```bash
    npm start conversational_agent
    ```

If you need to reconfigure the application, you can run `npm start conversational_agent configure`. You may also manually configure the application by changing the `config.json` and `.env` files. The `config.json` file contains the server configuration, while the `.env` file contains the environment variables for the Azure Speech Services subscription key and region (`SPEECH_KEY` and `SPEECH_REGION`) and the OpenAI API key (`OPENAI_API_KEY`).

### Client (Unity)

1. Launch Unity and navigate to the `Unity/Assets/Apps/ConversationalAgent` directory. Open the `ConversationalAgent.unity` scene.
2. Ensure the `Room Client` under the `Network Scene` object has the correct IP address and port for the server. If the server is running on the same machine as the Unity Editor, the IP address should be `localhost`. This should correspond to the configuration on the server side.
3. In the Unity Editor, press the `Play` button to launch the application.
4. Speak into the microphone. The agent will respond to your queries and requests, facing you while speaking and employing simple gestures.

## Demonstration Video

For a demonstration video of this sample, please refer to the [Ubiq-Genie demo video](https://youtu.be/cGz0z9BIgQk).

## Support

For any questions or issues, please use the Discussions tab on GitHub or send a message in the *ubiq-genie* channel in the [Ubiq Discord server](https://discord.gg/cZYzdcxAAB).
