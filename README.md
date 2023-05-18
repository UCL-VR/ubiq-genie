# Welcome to Ubiq-Genie

![Illustrations of two sample demos available in Ubiq-Genie](header.png)

Ubiq-Genie is a framework that enables you to build server-assisted collaborative mixed reality applications with Unity using the [Ubiq](https://ubiq.online) framework.

## Features

Ubiq's goal is to enable your networked project. It includes message passing, room management, rendezvous and matchmaking, object spawning, shared binary blobs, multiple synchronisation models, lighweight XR interaction examples, customisable avatars and voice chat across Windows, Linux, Android, MacOS, and Javascript running in the browser.

## Quick Start

These instruction will get you a copy of the project up and running on your local machine to run the samples and to start building your own applications. Alternatively, [GitHub Codespaces](https://docs.github.com/en/codespaces) can be used to quickly set up a server and run the server-side components of the samples (in this case, you may skip installing Node.js, step 2, and step 3).

0. Install [Unity](https://unity3d.com/get-unity/download) and [Node.js](https://nodejs.org/en/download/).

1. Clone this repository somewhere on your local PC.

```
git clone git@github.com:UCL-VR/ubiq-genie.git Ubiq-Genie
```

2. Open a terminal in the `Genie` folder and run `npm install` to install the dependencies. This includes the Node.js server of Ubiq.

3. Create a virtual environment and install the Python dependencies:

    ```
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```

    Note: on Windows, run `venv\Scripts\activate.bat` instead of `source venv/bin/activate`.

4. In Unity, open the `Unity` folder. To add Ubiq to the `Unity Hub`, open the `Unity Hub`, click `Add`, then navigate to `/Ubiq/Unity` and click `Select Folder`.

5. Read the README file in the corresponding folder in the `Server/samples/apps` folder for further setup instructions. For a list of available samples, see the [Samples](#samples) section below.

## Documentation
For more information on how to use Ubiq-Genie, please refer to the README file in the `Genie` folder.

## Samples

The `Genie/samples` folder contains a number of samples that demonstrate how to use Ubiq-Genie. For more information on how to use these samples, please refer to the README files in the corresponding folders. Currently, the following collaborative samples are available:

- [**Texture Generation**](Server/samples/apps/texture_generation/README.md): generates a texture based on voice-based input and an optional ray to select target objects
- [**Multi-user Conversational Agent**](Server/samples/apps/virtual_assistant/README.md): a conversational agent that can be interacted with by multiple users
- [**Transcription**](Server/samples/apps/transcription/README.md): transcribes audio streams of users in a room

For a demo video of the samples, please refer to the [Ubiq-Genie demo video](https://youtu.be/cGz0z9BIgQk).