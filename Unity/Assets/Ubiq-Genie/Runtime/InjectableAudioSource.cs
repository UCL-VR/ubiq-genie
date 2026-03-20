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
    /// <summary>Source sample rate declared by the server (Hz). 0 if not provided.</summary>
    public int SampleRate { get; set; }
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
    /// The sample rate declared by the server in the most recent AudioInfo
    /// header. Defaults to 48 000 Hz for backward compatibility with servers
    /// that do not send the field.
    /// </summary>
    private int sourceSampleRate = 48000;

    /// <summary>Cached device output sample rate, set once in Start().</summary>
    private int outputSampleRate;

    /// <summary>
    /// Maximum number of float samples to keep in the playback queue.
    /// ~5 seconds at 48 kHz. Only used when dropOnNewSequence is false.
    /// </summary>
    private const int MAX_QUEUE_SAMPLES = 48000 * 5;

    /// <summary>
    /// Messages shorter than this are treated as AudioInfo JSON headers.
    /// Increased from 100 to 256 to accommodate the added sampleRate field
    /// and future metadata without silently dropping headers.
    /// </summary>
    private const int AUDIO_INFO_HEADER_MAX_SIZE = 256;

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
        public string sampleRate;
    }

    private void Start()
    {
        outputSampleRate = AudioSettings.outputSampleRate;
        SetupAudioClip();

        AudioSettings.OnAudioConfigurationChanged += OnAudioConfigurationChanged;

        if (receiveFromNetwork)
        {
            var networkId = new NetworkId(networkIdValue);
            context = NetworkScene.Register(this, networkId);
        }
    }

    /// <summary>
    /// Creates (or recreates) the 1-filled AudioClip at the current
    /// outputSampleRate and assigns it to the AudioSource.
    /// </summary>
    private void SetupAudioClip()
    {
        var audioSource = GetComponent<AudioSource>();

        if (clip != null)
        {
            audioSource.Stop();
            Destroy(clip);
        }

        // Use a clip filled with 1s
        // This helps us piggyback on Unity's spatialisation using filters
        var onesBuffer = new float[outputSampleRate];
        for (int i = 0; i < onesBuffer.Length; i++)
        {
            onesBuffer[i] = 1.0f;
        }

        clip = AudioClip.Create("Injectable",
            onesBuffer.Length,
            1,
            outputSampleRate,
            false);

        clip.SetData(onesBuffer, 0);
        audioSource.clip = clip;
        audioSource.loop = true;   // Must loop so OnAudioFilterRead keeps firing
        audioSource.Play();
    }

    /// <summary>
    /// Called by Unity when the audio device configuration changes (e.g.
    /// Bluetooth switching from A2C to HFP when the microphone activates).
    /// Updates the cached output sample rate, recreates the AudioClip, and
    /// clears any stale samples that were resampled for the old rate.
    /// </summary>
    private void OnAudioConfigurationChanged(bool deviceWasChanged)
    {
        int newRate = AudioSettings.outputSampleRate;
        if (newRate == outputSampleRate)
            return;

        if (debugLogging) Debug.Log($"[InjectableAudioSource] Output sample rate changed: {outputSampleRate} → {newRate} Hz");
        outputSampleRate = newRate;

        // Queued samples were resampled for the old rate — discard them.
        samples = new ConcurrentQueue<float>();

        SetupAudioClip();
    }

    private void OnDestroy()
    {
        AudioSettings.OnAudioConfigurationChanged -= OnAudioConfigurationChanged;

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

                // Update source sample rate; default to 48 000 if absent
                if (int.TryParse(message.sampleRate, out int parsedRate) && parsedRate > 0)
                {
                    sourceSampleRate = parsedRate;
                }
                else
                {
                    sourceSampleRate = 48000;
                }

                if (debugLogging) Debug.Log($"[InjectableAudioSource] AudioInfo: audioLength={audioLen}, sampleRate={sourceSampleRate}");

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
                    SampleRate = sourceSampleRate,
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
        int samplesInjected = InjectPcm(data.data.ToArray());

        OnAudioChunkReceived?.Invoke(this, new AudioChunkReceivedEventArgs
        {
            SampleCount = samplesInjected,
        });
    }

    /// <summary>
    /// Inject raw PCM16-LE audio bytes into the playback queue.
    /// If the source sample rate (from the most recent AudioInfo header)
    /// differs from the device output rate, the audio is resampled using
    /// linear interpolation before being enqueued.
    /// Can be called manually or is called automatically when
    /// receiveFromNetwork is true.
    /// </summary>
    /// <returns>The number of samples enqueued (at the output sample rate).</returns>
    public int InjectPcm(Span<byte> bytes)
    {
        int inputSampleCount = bytes.Length / 2;
        bool needsResample = sourceSampleRate != outputSampleRate && outputSampleRate > 0;

        // Decode PCM16-LE into float[] first — we need random access for resampling
        float[] decoded = new float[inputSampleCount];
        for (int i = 0; i < inputSampleCount; i++)
        {
            decoded[i] = (short)(bytes[i * 2] | (bytes[i * 2 + 1] << 8)) / 32768f;
        }

        float[] output;
        if (needsResample)
        {
            // Linear-interpolation resampler
            double ratio = (double)sourceSampleRate / outputSampleRate;
            int outputCount = (int)Math.Ceiling(inputSampleCount / ratio);
            output = new float[outputCount];

            for (int o = 0; o < outputCount; o++)
            {
                double srcPos = o * ratio;
                int idx = (int)srcPos;
                double frac = srcPos - idx;

                float s0 = decoded[Math.Min(idx, inputSampleCount - 1)];
                float s1 = decoded[Math.Min(idx + 1, inputSampleCount - 1)];
                output[o] = (float)(s0 + (s1 - s0) * frac);
            }
        }
        else
        {
            output = decoded;
        }

        // When not dropping on new sequence, cap the queue to prevent
        // unbounded growth. Atomic swap avoids per-sample drain overhead.
        if (!dropOnNewSequence)
        {
            if (samples.Count + output.Length > MAX_QUEUE_SAMPLES)
            {
                samples = new ConcurrentQueue<float>();
                if (debugLogging) Debug.LogWarning("[InjectableAudioSource] Queue overflow — cleared");
            }
        }

        for (int i = 0; i < output.Length; i++)
        {
            samples.Enqueue(output[i]);
        }

        return output.Length;
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