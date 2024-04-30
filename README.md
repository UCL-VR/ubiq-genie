# Welcome to Ubiq-Genie

![Illustrations of two sample demos available in Ubiq-Genie](header.png)

Ubiq-Genie is a framework that enables you to build server-assisted collaborative mixed reality applications with Unity using the [Ubiq](https://ubiq.online) framework. This is particularly useful for building multi-user applications that require server-side processing such as generative models, conversational agents, and real-time transcription. For more information, please refer to the [Ubiq-Genie paper](https://ubiq.online/publication/ubiq-genie/).

Note: _Ubiq-Genie currently uses the Ubiq [v0.4.2](https://github.com/UCL-VR/ubiq/releases/tag/v0.4.2) client code. An updated version of Ubiq-Genie supporting the latest versions of Ubiq will be released later in summer 2024._

## Setup

These instructions will get you a copy of the project up and running to run the samples and to start building your own applications. Please note that Ubiq's server dependencies only support installation on Windows and Linux at the moment. An alternative for macOS users is to use [GitHub Codespaces](https://docs.github.com/en/codespaces) to run the server-side components (in this case, you may skip installing Node.js, step 1, 2, and 3). The client-side components can be run on practically any platform supported by Unity and Ubiq.

0. Install [Unity](https://unity3d.com/get-unity/download) and [Node.js](https://nodejs.org/en/download/).

1. Clone this repository somewhere on your local PC.

2. Open a terminal in the `Server` folder and run `npm install` to install the dependencies. This includes the Node.js server of Ubiq.

3. Create a virtual environment using `venv` or `conda`.

4. Install `torch`, `torchvision`, and `torchaudio` version 1.13 using the installation instructions on the [PyTorch website](https://pytorch.org/get-started/previous-versions/#v1131). Note: please ensure to install the correct version of PyTorch matching the CUDA version of your GPU.

5. From the `Server` folder, install the Python dependencies by running `pip install -r samples/requirements.txt` or `conda install --file samples/requirements.txt`, depending on your virtual environment.

4. In Unity, open the `Unity` folder. To add Ubiq to the `Unity Hub`, open the `Unity Hub`, click `Add`, then navigate to `/Ubiq/Unity` and click `Select Folder`.

5. Read the README file in the corresponding folder in the `Server/samples/apps` folder for further setup instructions. For a list of available samples, see the [Samples](#samples) section below.

## Documentation

For more information on how to use Ubiq-Genie, please refer to the README file in the `Server` folder.

## Samples

The `Server/samples` folder contains a number of samples that demonstrate how to use Ubiq-Genie. For more information on how to use these samples, please refer to the README files in the corresponding folders. Currently, the following collaborative samples are available:

-   [**Texture Generation**](Server/samples/apps/texture_generation/README.md): generates a texture based on voice-based input and an optional ray to select target objects
-   [**Multi-user Conversational Agent**](Server/samples/apps/virtual_assistant/README.md): a conversational agent that can be interacted with by multiple users
-   [**Transcription**](Server/samples/apps/transcription/README.md): transcribes audio streams of users in a room

For a demo video of the samples, please refer to the [Ubiq-Genie demo video](https://youtu.be/cGz0z9BIgQk).
