using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Ubiq.Voip;
using Ubiq.Messaging;

public class HandMover : MonoBehaviour
{
    public Vector3 positionOffset;

    public float speed = 2.0f;
    public float lerpMultiplier = 5.0f;

    public Transform leftHand;
    public Transform rightHand;

    public Vector3 leftHandIdlePosition;
    public Quaternion leftHandIdleRotation;
    public Vector3 rightHandIdlePosition;
    public Quaternion rightHandIdleRotation;

    public List<Vector3> leftHandPositions;
    public List<Quaternion> leftHandRotations;
    public List<Vector3> rightHandPositions;
    public List<Quaternion> rightHandRotations;
    public List<float> times;

    private float animTime;
    private bool playing;

    private bool recording;
    private float recordingStartTime;

    public Ubiq.XR.HandController handController;

    public void Update()
    {
        // if (handController && handController.PrimaryButtonState)
        // {
        //     if (!recording)
        //     {
        //         leftHandPositions.Clear();
        //         leftHandRotations.Clear();
        //         rightHandPositions.Clear();
        //         rightHandRotations.Clear();
        //         times.Clear();
        //         recording = true;
        //         recordingStartTime = Time.time;
        //         leftHandIdlePosition = leftHand.localPosition;
        //         leftHandIdleRotation = leftHand.localRotation;
        //         rightHandIdlePosition = rightHand.localPosition;
        //         rightHandIdleRotation = rightHand.localRotation;
        //     }
        // }
        // else
        // {
        //     recording = false;
        // }

        // if (recording)
        // {
        //     leftHandPositions.Add(leftHand.localPosition);
        //     leftHandRotations.Add(leftHand.localRotation);
        //     rightHandPositions.Add(rightHand.localPosition);
        //     rightHandRotations.Add(rightHand.localRotation);
        //     times.Add(Time.time - recordingStartTime);
        // }

        var leftHandTargetPosition = leftHandIdlePosition;
        var leftHandTargetRotation = leftHandIdleRotation;
        var rightHandTargetPosition = rightHandIdlePosition;
        var rightHandTargetRotation = rightHandIdleRotation;

        if (playing)
        {
            var frameIdx = GetFrameIndex(animTime);
            if ((int)frameIdx < 0 || (int)(frameIdx+1) >= leftHandPositions.Count)
            {
                return;
            }
            leftHandTargetPosition = Vector3.Lerp(leftHandPositions[(int)frameIdx],leftHandPositions[(int)frameIdx+1],frameIdx%1);
            leftHandTargetRotation = Quaternion.Lerp(leftHandRotations[(int)frameIdx],leftHandRotations[(int)frameIdx+1],frameIdx%1);
            rightHandTargetPosition = Vector3.Lerp(rightHandPositions[(int)frameIdx],rightHandPositions[(int)frameIdx+1],frameIdx%1);
            rightHandTargetRotation = Quaternion.Lerp(rightHandRotations[(int)frameIdx],rightHandRotations[(int)frameIdx+1],frameIdx%1);
        }

        var t = Time.deltaTime * lerpMultiplier;
        leftHand.localPosition = Vector3.Lerp(leftHand.localPosition,leftHandTargetPosition+positionOffset,t);
        leftHand.localRotation = Quaternion.Lerp(leftHand.localRotation,leftHandTargetRotation,t);
        rightHand.localPosition = Vector3.Lerp(rightHand.localPosition,rightHandTargetPosition+positionOffset,t);
        rightHand.localRotation = Quaternion.Lerp(rightHand.localRotation,rightHandTargetRotation,t);

        animTime += Time.deltaTime * speed;
    }

    private float GetFrameIndex(float time)
    {
        time %= times[times.Count-1] + 0.01f;
        for (int i = times.Count-2; i >= 0; i--)
        {
            if (time > times[i])
            {
                return i + Mathf.InverseLerp(times[i],times[i+1],time);
            }
        }
        Debug.LogError("FrameIDX < 0! Check this function");
        return -1;
    }

    public void Play()
    {
        playing = true;
    }

    public void Stop()
    {
        playing = false;
    }
}
