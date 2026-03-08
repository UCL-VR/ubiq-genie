# Welcome to Ubiq-Genie

![Illustrations of two sample demos available in Ubiq-Genie](header.png)

Ubiq-Genie is a framework that enables you to build server-assisted collaborative mixed reality applications with Unity using the [Ubiq](https://ubiq.online) framework. This is particularly useful for building multi-user applications that require server-side processing such as generative models, conversational agents, and real-time transcription. For more information, please refer to the [Ubiq-Genie paper](https://ubiq.online/publication/ubiq-genie/).

> [!NOTE]
> Before starting with Ubiq-Genie, we recommend that you familiarize yourself with the Ubiq framework. For more information, see Ubiq's [documentation](https://ucl-vr.github.io/ubiq/) and [website](https://ubiq.online). Ubiq-Genie currently uses Ubiq [v1.0.0-pre.16](https://github.com/UCL-VR/ubiq/releases/tag/unity-v1.0.0-pre.16).

## Initial Setup

These instructions will get you a copy of the project up and running to run the samples and to start building your own applications. Ubiq-Genie supports Windows, macOS, and Linux. Ubiq-Genie has a server-client architecture, which means you may need to run the server on a separate machine from the Unity client.

### Server (Node.js)

0. Install [Node.js](https://nodejs.org/en/download/) (v20 or later) and [Python](https://www.python.org/downloads/) (v3.10 or later).

1. Clone this repository somewhere on your machine (either local or remote).

2. Open a terminal in the `Node` folder and run `npm install` to install the dependencies.

3. Install the Python dependencies for the services you plan to use. Each service provider has its own `requirements.txt` file located in its provider folder (e.g., `Node/services/speech_to_text/providers/azure/requirements.txt`). Install them with `pip install -r <path_to_requirements.txt>`. If you are using a virtual environment, activate it before running the command. Missing dependencies will be flagged as warnings when a service starts. Please ensure that you have the correct PyTorch and CUDA versions installed (see the [PyTorch website](https://pytorch.org/get-started/locally/) for more information).

### Client (Unity)

Install [Unity](https://unity3d.com/get-unity/download) **6.0 LTS** (version currently used is *Unity 6000.0.67f1*). There are two ways to set up the Unity client:

#### Option A: Use the Included Unity Project

This is the quickest way to explore the samples.

1. Clone or download this repository if you haven't already, and add the `Unity` folder to Unity Hub. The Ubiq-Genie package (`com.ucl.ubiq-genie`) is included as an embedded package and will be loaded automatically.
2. In the Package Manager, select the **Ubiq** package (`com.ucl.ubiq`), open the **Samples** tab, and import **Demo (XRI)**. This adds the XR Interaction Toolkit and scripts used by the samples.
3. In the Project window, navigate to `Assets/Ubiq-Genie/Apps/` and open any sample scene.

#### Option B: Add Ubiq-Genie to Your Own Project

Use this if you want to integrate Ubiq-Genie into an existing Unity project.

1. In Unity, go to **Window → Package Manager → + → Add package from git URL** and enter:

    ```
    https://github.com/UCL-VR/ubiq-genie.git#upm
    ```

    This installs the Ubiq-Genie package and its dependencies (Ubiq and Unity WebRTC).

2. In the Package Manager, select the **Ubiq** package (`com.ucl.ubiq`), open the **Samples** tab, and import **Demo (XRI)**.
3. Import any Ubiq-Genie sample from **Window → Package Manager → Ubiq-Genie → Samples** and open its scene.

> [!NOTE]
> Regardless of which option you choose, you need a running Ubiq-Genie server — see the [Server setup](#server-nodejs) above. Read the README in the corresponding `Node/apps` folder for sample-specific instructions. For a list of available samples, see the [Samples](#samples) section below.

## Documentation

For more information on how to use Ubiq-Genie, please refer to the README files in the `Node` folder.

## Samples

The `Node/apps` folder contains a number of samples that demonstrate how to use Ubiq-Genie, which each utilize one or more services defined in the `Node/services` folder. For more information on how to use these samples, please refer to the README files in the corresponding folders. Currently, the following collaborative sample applications are available:

- [**Texture Generation**](Node/apps/texture_generation/README.md): generates a texture based on voice-based input and an optional ray to select target objects
- [**Multi-user Conversational Agent**](Node/apps/conversational_agent/README.md): a conversational agent that can be interacted with by multiple users
- [**Transcription**](Node/apps/transcription/README.md): transcribes and audio of each user in the room in separate files

For a demo video of the samples, please refer to the [Ubiq-Genie demo video](https://youtu.be/cGz0z9BIgQk).

## Support

For any questions, please use the Discussions tab on GitHub or send a message in the *ubiq-genie* channel in the [Ubiq Discord server](https://discord.gg/cZYzdcxAAB). For bug reports, please use the Issues tab on GitHub.
