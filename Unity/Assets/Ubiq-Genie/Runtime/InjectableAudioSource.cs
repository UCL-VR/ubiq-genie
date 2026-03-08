using System;
using System.Collections.Concurrent;
using UnityEngine;
using Ubiq.Messaging;

namespace Ubiq.Genie
{

/// <summary>
/// Event args passed when an audio chunk is received from the network.
/// </summary>
public class AudioChunkReceivedEventArgs : EventArgs
{
    /// <summary>Number of PCM16 samples in this chunk (bytes / 2).</summary>
    public int SampleCount { get; set; }
}

/// <summary>
/// Event args passed when an AudioInfo header is received from the network.
/// </summary>
public class AudioInfoReceivedEventArgs : EventArgs
{
    public string Type { get; set; }
    public string TargetPeer { get; set; }
    public int AudioLength { get; set; }
}

/// <summary>
/// Pushes audio data directly onto the AudioSource via OnAudioFilterRead.
/// Can optionally receive audio packets from the network on a configurable
/// network ID, parsing the standard AudioInfo + raw-PCM protocol used by
/// Ubiq-Genie server applications.
/// </summary>
public class InjectableAudioSource : MonoBehaviour
{
    [Header("Network")]
    [Tooltip("When true, this component registers on the Ubiq network and " +
             "receives audio automatically. When false, audio must be fed " +
             "manually via InjectPcm().")]
    public bool receiveFromNetwork = false;

    [Tooltip("The Ubiq network ID to listen on (only used when receiveFromNetwork is true).")]
    public ushort networkIdValue = 95;

    [Header("Playback")]
    [Tooltip("When true, arriving AudioInfo headers clear the playback queue so " +
             "only the newest audio sequence is heard. When false, new audio is " +
             "appended to the existing queue.")]
    public bool dropOnNewSequence = true;

    [Tooltip("Log diagnostic messages to the Unity console.")]
    public bool debugLogging = false;

    /// <summary>
    /// Fired for every raw PCM audio chunk received from the network.
    /// Listeners can use this to track speech timing, drive animations, etc.
    /// </summary>
    public event EventHandler<AudioChunkReceivedEventArgs> OnAudioChunkReceived;

    /// <summary>
    /// Fired when an AudioInfo header message is received from the network.
    /// Contains metadata such as audio length and an optional target peer
    /// name.  This component does <b>not</b> filter on TargetPeer itself;
    /// consumers should subscribe to this event and apply their own filtering
    /// if needed (e.g. only playing audio addressed to a specific peer).
    /// </summary>
    public event EventHandler<AudioInfoReceivedEventArgs> OnAudioInfoReceived;

    private ConcurrentQueue<float> samples = new ConcurrentQueue<float>();
    private AudioClip clip;
    private NetworkContext context;

    /// <summary>
    /// Maximum number of float samples to keep in the playback queue.
    /// ~5 seconds at 48 kHz. Only used when dropOnNewSequence is false.
    /// </summary>
    private const int MAX_QUEUE_SAMPLES = 48000 * 5;

    /// <summary>
    /// Messages shorter than this are treated as AudioInfo JSON headers.
    /// </summary>
    private const int AUDIO_INFO_HEADER_MAX_SIZE = 100;

    /// <summary>
    /// Raw audio packets smaller than this are discarded as noise.
    /// </summary>
    private const int MIN_AUDIO_PACKET_SIZE = 200;

    [Serializable]
    private struct AudioInfoMessage
    {
        public string type;
        public string targetPeer;
        public string audioLength;
    }

    private void Start()
    {
        // Use a clip filled with 1s
        // This helps us piggyback on Unity's spatialisation using filters
        if (debugLogging) Debug.Log($"[InjectableAudioSource] Output sample rate: {AudioSettings.outputSampleRate}");
        var samples = new float[AudioSettings.outputSampleRate];
        for (int i = 0; i < samples.Length; i++)
        {
            samples[i] = 1.0f;
        }

        clip = AudioClip.Create("Injectable",
            samples.Length,
            1,
            AudioSettings.outputSampleRate,
            false);

        var audioSource = GetComponent<AudioSource>();
        audioSource.clip = clip;
        audioSource.loop = true;   // Must loop so OnAudioFilterRead keeps firing
        clip.SetData(samples, 0);
        audioSource.Play();

        if (receiveFromNetwork)
        {
            var networkId = new NetworkId(networkIdValue);
            context = NetworkScene.Register(this, networkId);
        }
    }

    private void OnDestroy()
    {
        if (clip != null)
        {
            Destroy(clip);
            clip = null;
        }
    }

    /// <summary>
    /// Called by Ubiq when a message arrives on our network ID.
    /// Handles the AudioInfo header + raw PCM chunk protocol.
    /// </summary>
    public void ProcessMessage(ReferenceCountedSceneGraphMessage data)
    {
        if (data.data.Length < AUDIO_INFO_HEADER_MAX_SIZE)
        {
            try
            {
                var message = data.FromJson<AudioInfoMessage>();
                int.TryParse(message.audioLength, out int audioLen);

                if (debugLogging) Debug.Log($"[InjectableAudioSource] AudioInfo: audioLength={audioLen}");

                // A new audio sequence is starting.
                if (dropOnNewSequence)
                {
                    // Atomic swap: OnAudioFilterRead will pick up the new
                    // (empty) queue immediately — no per-sample drain needed.
                    samples = new ConcurrentQueue<float>();
                }

                OnAudioInfoReceived?.Invoke(this, new AudioInfoReceivedEventArgs
                {
                    Type = message.type ?? "",
                    TargetPeer = message.targetPeer ?? "",
                    AudioLength = audioLen,
                });
                return;
            }
            catch (Exception)
            {
                // Not valid JSON — fall through to treat as audio data
            }
        }

        if (data.data.Length < MIN_AUDIO_PACKET_SIZE)
        {
            return;
        }

        // Raw PCM16 audio chunk — inject it
        InjectPcm(data.data.ToArray());

        OnAudioChunkReceived?.Invoke(this, new AudioChunkReceivedEventArgs
        {
            SampleCount = data.data.Length / 2,
        });
    }

    /// <summary>
    /// Inject raw PCM16-LE audio bytes into the playback queue.
    /// Can be called manually or is called automatically when
    /// receiveFromNetwork is true.
    /// </summary>
    public void InjectPcm(Span<byte> bytes)
    {
        // When not dropping on new sequence, cap the queue to prevent
        // unbounded growth. Atomic swap avoids per-sample drain overhead.
        if (!dropOnNewSequence)
        {
            int incomingSamples = bytes.Length / 2;
            if (samples.Count + incomingSamples > MAX_QUEUE_SAMPLES)
            {
                samples = new ConcurrentQueue<float>();
                if (debugLogging) Debug.LogWarning("[InjectableAudioSource] Queue overflow — cleared");
            }
        }

        for (int i = 0; i < bytes.Length / 2; i++)
        {
            var sample = (short)(bytes[i * 2] | (bytes[i * 2 + 1] << 8)) / 32768f;
            samples.Enqueue(sample);
        }
    }

    private void OnAudioFilterRead(float[] data, int channels)
    {
        for (int dataIdx = 0; dataIdx < data.Length; dataIdx+=channels)
        {
            if (samples.TryDequeue(out float sample))
            {
                for (int channelIdx = 0; channelIdx < channels; channelIdx++)
                {
                    // *= because we're including pre-existing spatialization
                    data[dataIdx + channelIdx] *= sample;
                }
            }
            else
            {
                for (int channelIdx = 0; channelIdx < channels; channelIdx++)
                {
                    // zero out the pre-existing spatialization
                    data[dataIdx + channelIdx] = 0.0f;
                }
            }
        }
    }
}

} // namespace Ubiq.Genie