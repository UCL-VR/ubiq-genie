using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class AudioSourceVolume : MonoBehaviour
{
    public float volume
    {
        get
        {
            return vol / samples.Length;
        }
    }

    private volatile float vol = 0;

    private float[] samples = new float[3840];
    private int sampleIndex = 0;

    private void OnAudioFilterRead(float[] data, int channels)
    {
        for (int i = 0; i < data.Length; i+=channels)
        {
            var sample = 0.0f;
            for(int j = 0; j < channels; j++)
            {
                sample += Mathf.Abs(data[i+j]);
            }
            sample /= channels;

            vol = (vol - samples[sampleIndex]) + sample;

            samples[sampleIndex] = sample;

            sampleIndex++;
            if (sampleIndex >= samples.Length)
            {
                sampleIndex = 0;
            }
        }
    }
}
