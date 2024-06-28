using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Concurrent;
using UnityEngine;

/// <summary>
/// Pushes audio data directly onto the audiosource with a filter
/// </summary>
public class InjectableAudioSource : MonoBehaviour
{
    private ConcurrentQueue<float> samples = new ConcurrentQueue<float>();
    private AudioClip clip;

    private void Start()
    {
        // Use a clip filled with 1s
        // This helps us piggyback on Unity's spatialisation using filters
        Debug.Log("Output sample rate: " + AudioSettings.outputSampleRate);
        var samples = new float[AudioSettings.outputSampleRate];
        for(int i = 0; i < samples.Length; i++)
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
        clip.SetData(samples,0);
        audioSource.Play();
    }

    private void OnDestroy()
    {
        if (clip != null)
        {
            Destroy(clip);
            clip = null;
        }
    }


    public void InjectPcm(Span<byte> bytes)
    {
        // float[] floatSamples = new float[bytes.Length / 2];
        for (int i = 0; i < bytes.Length / 2; i++)
        {
            var sample = (short)(bytes[i * 2] | (bytes[i * 2 + 1] << 8)) / 32768f;

            // 16kHz -> 48kHz
            samples.Enqueue(sample);
            // samples.Enqueue(sample);
            // samples.Enqueue(sample);
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