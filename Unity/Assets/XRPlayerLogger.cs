using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using Ubiq.Messaging;
using Ubiq.Logging;
using UnityEngine;
using static UnityEngine.Mathf;

[System.Serializable]
public class TransformInfo
{
    public Vector3 position;
    public Quaternion rotation;

    public Vector3 angularVelocity;

    public TransformInfo(Vector3 position, Quaternion rotation, Vector3 angularVelocity)
    {
        this.position = position;
        this.rotation = rotation;
        this.angularVelocity = angularVelocity;
    }
}

public class XRPlayerLogger : MonoBehaviour
{
    public Camera headCamera;
    public LogEmitter transformLogger;
    private Quaternion lastFrameRotation = Quaternion.identity;

    // From https://forum.unity.com/threads/how-to-get-angular-velocity.265686/
    internal static Vector3 GetAngularVelocity(Quaternion foreLastFrameRotation, Quaternion lastFrameRotation)
    {
        var q = lastFrameRotation * Quaternion.Inverse(foreLastFrameRotation);
        if(Abs(q.w) > 1023.5f / 1024.0f)
            return new Vector3(0,0,0);
        float gain;
        // handle negatives, we could just flip it but this is faster
        if(q.w < 0.0f)
        {
            var angle = Acos(-q.w);
            gain = -2.0f * angle / (Sin(angle)*Time.deltaTime);
        }
        else
        {
            var angle = Acos(q.w);
            gain = 2.0f * angle / (Sin(angle)*Time.deltaTime);
        }
        return new Vector3(q.x * gain,q.y * gain,q.z * gain);
    }

    // Start is called before the first frame update
    void Start()
    {
        transformLogger = new ExperimentLogEmitter(this);
        InvokeRepeating("LogTransform", 2.0f, 0.2f);
    }

    // Update is called once per frame
    void Update()
    {
        
    }

    void LogTransform()
    {
        Quaternion headRotation = headCamera.transform.rotation;
        Vector3 angularVelocity = GetAngularVelocity(lastFrameRotation, headRotation);
        lastFrameRotation = headRotation;

        TransformInfo headTransformInfo = new TransformInfo(headCamera.transform.position, headCamera.transform.rotation, angularVelocity);
        transformLogger.Log("transform_head", headTransformInfo);
    }
}
