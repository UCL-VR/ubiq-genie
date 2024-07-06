using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class AudioSourceSpeechIndicator : MonoBehaviour
{
    public List<Transform> volumeIndicators;

    public Vector3 minIndicatorScale;
    public Vector3 maxIndicatorScale;

    public float minVolume;
    public float maxVolume;

    private AudioSource audioSource;

    void Start()
    {
        audioSource = GetComponent<AudioSource>();
    }

    void Update()
    {

        UpdateIndicators();
        UpdatePosition();
    }

    private void UpdateIndicators()
    {
        UpdateIndicator(volumeIndicators[0],vol0 / SAMPLES_PER_INDICATOR);
        UpdateIndicator(volumeIndicators[1],vol1 / SAMPLES_PER_INDICATOR);
        UpdateIndicator(volumeIndicators[2],vol2 / SAMPLES_PER_INDICATOR);
    }

    private void UpdateIndicator(Transform indicator, float volume)
    {
        if (volume > minVolume)
        {
            indicator.gameObject.SetActive(true);
            var range = maxVolume - minVolume;
            var t = (volume - minVolume) / range;
            indicator.localScale = Vector3.Lerp(
                minIndicatorScale,maxIndicatorScale,t);
        }
        else
        {
            indicator.gameObject.SetActive(false);
        }
    }

    private void UpdatePosition()
    {
        var cameraTransform = Camera.main.transform;
        var headTransform = transform.parent;
        var indicatorRootTransform = transform;

        // If no indicator is being shown currently, reset position
        var indicatorVisible = false;
        for (int i = 0; i < volumeIndicators.Count; i++)
        {
            if (volumeIndicators[i].gameObject.activeInHierarchy)
            {
                indicatorVisible = true;
                break;
            }
        }

        if (!indicatorVisible)
        {
            indicatorRootTransform.forward = headTransform.forward;
        }

        // Rotate s.t. the indicator is always 90 deg from camera
        // Method - always two acceptable orientations, pick the closest
        var headToCamera = cameraTransform.position - headTransform.position;
        var headToCameraDir = headToCamera.normalized;
        var dirA = Vector3.Cross(headToCameraDir,headTransform.up);
        var dirB = Vector3.Cross(headTransform.up,headToCameraDir);

        var simA = Vector3.Dot(dirA,indicatorRootTransform.forward);
        var simB = Vector3.Dot(dirB,indicatorRootTransform.forward);

        var forward = simA > simB ? dirA : dirB;

        // Deal with rare case when avatars share a position
        if (forward.sqrMagnitude <= 0)
        {
            forward = indicatorRootTransform.forward;
        }

        indicatorRootTransform.forward = forward;
    }

    private volatile float vol0 = 0;
    private volatile float vol1 = 0;
    private volatile float vol2 = 0;

    private const int SAMPLES_PER_INDICATOR = 3840;
    private float[] samples = new float[SAMPLES_PER_INDICATOR*3];
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

            var v0tov1 = Wrap(samples,sampleIndex-SAMPLES_PER_INDICATOR);
            var v1tov2 = Wrap(samples,sampleIndex-2*SAMPLES_PER_INDICATOR);
            var v2off = samples[sampleIndex];

            vol0 = (vol0 - v0tov1) + sample;
            vol1 = (vol1 - v1tov2) + v0tov1;
            vol2 = (vol2 - v2off) + v1tov2;

            samples[sampleIndex] = sample;

            sampleIndex++;
            if (sampleIndex >= samples.Length)
            {
                sampleIndex = 0;
            }
        }
    }

    private float Wrap(float[] samples, int index)
    {
        if (index < 0)
        {
            index += samples.Length;
        }
        return samples[index];
    }
}
