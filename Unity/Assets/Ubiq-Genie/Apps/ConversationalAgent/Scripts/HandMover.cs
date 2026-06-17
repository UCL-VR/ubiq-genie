using System.Collections.Generic;
using UnityEngine;

namespace Ubiq.Genie.Samples.ConversationalAgent
{

public class HandMover : MonoBehaviour
{
    public Vector3 positionOffset;

    [Min(0.0f)]
    public float speed = 0.75f;
    [Min(0.0f)]
    public float lerpMultiplier = 5.0f;

    [Header("Natural Motion")]
    [Min(0.0f)]
    public float blendInMultiplier = 7.0f;
    [Min(0.0f)]
    public float blendOutMultiplier = 4.0f;
    [Range(0.0f, 1.0f)]
    public float keyframeEase = 0.75f;
    [Min(0.0f)]
    public float secondaryMotionAmplitude = 0.006f;
    [Min(0.0f)]
    public float secondaryMotionFrequency = 1.2f;

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
    private float gestureBlend;
    private bool playing;
    
    public void Update()
    {
        if (!HasValidConfiguration())
        {
            return;
        }

        var blendRate = playing ? blendInMultiplier : blendOutMultiplier;
        var blendTarget = playing ? 1.0f : 0.0f;
        gestureBlend = Mathf.MoveTowards(gestureBlend, blendTarget, blendRate * Time.deltaTime);

        var frameIdx = GetFrameIndex(animTime);
        var frame = Mathf.FloorToInt(frameIdx);
        var nextFrame = frame + 1;
        if (!IsValidFrame(frame, nextFrame))
        {
            return;
        }

        var rawFrameT = frameIdx - frame;
        var easedFrameT = Mathf.SmoothStep(0.0f, 1.0f, rawFrameT);
        var sampleT = Mathf.Lerp(rawFrameT, easedFrameT, keyframeEase);

        var leftHandGesturePosition = Vector3.Lerp(leftHandPositions[frame], leftHandPositions[nextFrame], sampleT) + positionOffset;
        var leftHandGestureRotation = Quaternion.Slerp(leftHandRotations[frame], leftHandRotations[nextFrame], sampleT);
        var rightHandGesturePosition = Vector3.Lerp(rightHandPositions[frame], rightHandPositions[nextFrame], sampleT) + positionOffset;
        var rightHandGestureRotation = Quaternion.Slerp(rightHandRotations[frame], rightHandRotations[nextFrame], sampleT);

        ApplySecondaryMotion(ref leftHandGesturePosition, ref leftHandGestureRotation, 0.35f);
        ApplySecondaryMotion(ref rightHandGesturePosition, ref rightHandGestureRotation, 2.45f);

        var leftIdlePosition = leftHandIdlePosition + positionOffset;
        var rightIdlePosition = rightHandIdlePosition + positionOffset;

        var leftHandTargetPosition = Vector3.Lerp(leftIdlePosition, leftHandGesturePosition, gestureBlend);
        var leftHandTargetRotation = Quaternion.Slerp(leftHandIdleRotation, leftHandGestureRotation, gestureBlend);
        var rightHandTargetPosition = Vector3.Lerp(rightIdlePosition, rightHandGesturePosition, gestureBlend);
        var rightHandTargetRotation = Quaternion.Slerp(rightHandIdleRotation, rightHandGestureRotation, gestureBlend);

        var t = 1.0f - Mathf.Exp(-lerpMultiplier * Time.deltaTime);
        leftHand.localPosition = Vector3.Lerp(leftHand.localPosition, leftHandTargetPosition, t);
        leftHand.localRotation = Quaternion.Slerp(leftHand.localRotation, leftHandTargetRotation, t);
        rightHand.localPosition = Vector3.Lerp(rightHand.localPosition, rightHandTargetPosition, t);
        rightHand.localRotation = Quaternion.Slerp(rightHand.localRotation, rightHandTargetRotation, t);

        if (speed > 0.0f && (playing || gestureBlend > 0.001f))
        {
            animTime += Time.deltaTime * speed;
        }
    }

    private void ApplySecondaryMotion(ref Vector3 targetPosition, ref Quaternion targetRotation, float phase)
    {
        if (gestureBlend <= 0.0f || secondaryMotionAmplitude <= 0.0f || secondaryMotionFrequency <= 0.0f)
        {
            return;
        }

        var time = Time.time * secondaryMotionFrequency + phase;
        var secondaryPositionOffset = new Vector3(
            Mathf.Sin(time),
            Mathf.Sin(time * 1.37f + 1.2f),
            Mathf.Cos(time * 0.73f + 0.5f))
            * (secondaryMotionAmplitude * gestureBlend);
        targetPosition += secondaryPositionOffset;

        var rotationAmount = secondaryMotionAmplitude * 130.0f * gestureBlend;
        var secondaryRotation = Quaternion.Euler(
            Mathf.Sin(time * 1.11f) * rotationAmount,
            Mathf.Cos(time * 0.89f) * rotationAmount,
            Mathf.Sin(time * 1.53f + 0.4f) * rotationAmount);
        targetRotation *= secondaryRotation;
    }

    private bool HasValidConfiguration()
    {
        return leftHand
            && rightHand
            && leftHandPositions != null
            && leftHandRotations != null
            && rightHandPositions != null
            && rightHandRotations != null
            && times != null
            && times.Count >= 2
            && leftHandPositions.Count >= 2
            && leftHandRotations.Count >= 2
            && rightHandPositions.Count >= 2
            && rightHandRotations.Count >= 2;
    }

    private bool IsValidFrame(int frame, int nextFrame)
    {
        return frame >= 0
            && nextFrame < times.Count
            && nextFrame < leftHandPositions.Count
            && nextFrame < leftHandRotations.Count
            && nextFrame < rightHandPositions.Count
            && nextFrame < rightHandRotations.Count;
    }

    private float GetFrameIndex(float time)
    {
        var loopDuration = times[times.Count - 1];
        if (loopDuration <= 0.0f)
        {
            return 0.0f;
        }

        time %= loopDuration + 0.01f;
        for (int i = times.Count - 2; i >= 0; i--)
        {
            if (time > times[i])
            {
                return i + Mathf.InverseLerp(times[i], times[i + 1], time);
            }
        }

        return 0.0f;
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

} // namespace Ubiq.Genie.Samples.ConversationalAgent
