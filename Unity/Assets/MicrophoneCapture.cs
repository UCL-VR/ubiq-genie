using System.Collections;
using System.Collections.Generic;
using Ubiq.Networking;
using UnityEngine;
using Ubiq.Dictionaries;
using Ubiq.Messaging;
using Ubiq.Logging.Utf8Json;
using Ubiq.Rooms;
using System;
using System.Text;
using Ubiq.Samples;
using Ubiq.Voip;
using Ubiq.Voip.Implementations;
using Ubiq.Voip.Implementations.Dotnet;

public class MicrophoneCapture : MonoBehaviour, IPlaybackStatsSource
{
    public bool sendToServer = true;
    public float gain = 1.0f;
    public PlaybackStats lastFrameStats { get; private set; }
    public NetworkId networkId = new NetworkId(98);
    private NetworkContext context;

    private RoomClient roomClient;
    private IDotnetVoipSource microphoneInput;
    private G722AudioDecoder decoder = new G722AudioDecoder();

    void Start()
    {
        context = NetworkScene.Register(this,networkId);
    }

    void OnDestroy()
    {
        if (microphoneInput != null)
        {
            microphoneInput.OnAudioSourceEncodedSample -= SendAudioToServer;
        }
    }

    // Update is called once per frame
    void Update()
    {
        if (!roomClient)
        {
            roomClient = NetworkScene.Find(this)?.GetComponentInChildren<RoomClient>();
            if (!roomClient)
            {
                return;
            }
        }

        if (microphoneInput == null)
        {
            microphoneInput = roomClient.GetComponentInChildren<IDotnetVoipSource>(includeInactive:true);
            if (microphoneInput != null)
            {
                microphoneInput.OnAudioSourceEncodedSample += SendAudioToServer;
            }
        }
    }

    private void SendAudioToServer(uint durationRtpUnits, byte[] sample)
    {
        // lastFrameStats

        if (sendToServer) {
            // Debug.Log("Sending audio to server");
            // Decode the sample from G722 to PCM
            short[] decodedSampleShort = decoder.Decode(sample);

            var stats = new PlaybackStats();
            stats.sampleCount = decodedSampleShort.Length;
            foreach(var pcm in decodedSampleShort)
            {
                stats.volumeSum += Mathf.Abs(((float)pcm) / short.MaxValue);
            }
            lastFrameStats = stats;

            byte[] decodedSampleByte = new byte[decodedSampleShort.Length * sizeof(short)];
            Buffer.BlockCopy(decodedSampleShort, 0, decodedSampleByte, 0, decodedSampleByte.Length);

            // Get the client UUID
            byte[] clientUUID = System.Text.Encoding.UTF8.GetBytes(roomClient.Me.uuid);

            // Create a message that fits the client UUID and the decoded sample
            var message = ReferenceCountedSceneGraphMessage.Rent(decodedSampleByte.Length + clientUUID.Length);

            // Copy the client UUID and the decoded sample into the message
            clientUUID.CopyTo(new Span<byte>(message.bytes, message.start, clientUUID.Length));
            decodedSampleByte.CopyTo(new Span<byte>(message.bytes, message.start + clientUUID.Length, decodedSampleByte.Length));

            // Send the message to the server with a fixed network ID
            context.Send(message);
        }
    }

    public void ProcessMessage(ReferenceCountedSceneGraphMessage msg)
    {
    }
}