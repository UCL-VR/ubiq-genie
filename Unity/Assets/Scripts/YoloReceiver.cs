using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using Ubiq.Networking;
using UnityEngine;
using Ubiq.Messaging;
using Ubiq.Rooms;

public class YoloReceiver : MonoBehaviour
{
    private NetworkId networkId = new NetworkId(99);
    private NetworkContext context;
    public List<Vector2> result = new List<Vector2>();
    public List<string> labels = new List<string>();
    public obstacleSpawner spawner;

    // 1. NEW: Added wrapper struct to handle the outer {"data": "..."} layer
    [System.Serializable]
    private struct MessageContainer
    {
        public string data;
    }

    [System.Serializable]
    public class DetectionData
    {
        public int count;
        public List<DetectedObject> objects;
    }

    [System.Serializable]
    public class DetectedObject
    {
        public int id;
        public float x;
        public float y;
        public int scale_x; // Added to match Python script
        public int scale_y; // Added to match Python script
        public string label; // Added to match Python script
    }

    void Start()
    {
        context = NetworkScene.Register(this, networkId);
    }

    public void ProcessMessage(ReferenceCountedSceneGraphMessage Mdata)
    {
        try
        {
            string rawLogLine = Encoding.UTF8.GetString(Mdata.bytes, Mdata.start, Mdata.length);

            // 2. FIXED: Unwrap the outer container if it exists.
            // The log shows the message comes as: {"data":"[96762, 2, '...']"}
            // If we don't unwrap this, the parser sees the outer brackets and fails to find 'count' or 'objects'.
            string stringToScan = rawLogLine;

            // Try to parse as a container first
            try
            {
                // We do a quick check to see if it looks like a JSON object with "data"
                if (rawLogLine.Contains("\"data\""))
                {
                    MessageContainer container = JsonUtility.FromJson<MessageContainer>(rawLogLine);
                    if (!string.IsNullOrEmpty(container.data))
                    {
                        // If successful, we scan the inner content: [96762, 2, '{"count":...}']
                        stringToScan = container.data;
                    }
                }
            }
            catch
            {
                // If parsing container fails, we fall back to scanning the raw line
            }

            // 3. Extract the inner JSON string.
            // We look for the first curly brace in the UNWRAPPED string.
            int startIndex = stringToScan.IndexOf('{');
            int endIndex = stringToScan.LastIndexOf('}');

            if (startIndex == -1 || endIndex == -1 || endIndex < startIndex)
            {
                return;
            }

            // Extract exactly: {"count": 1, "objects": [...]}
            string jsonString = stringToScan.Substring(startIndex, endIndex - startIndex + 1);

            // 4. Parse using JsonUtility
            DetectionData data = JsonUtility.FromJson<DetectionData>(jsonString);

            if (data != null && data.objects != null)
            {
                // Debug.Log($"Parsed {data.objects[0].x} objects.");

                result.Clear();

                foreach (DetectedObject obj in data.objects)
                {
                    // You can now access obj.scale_x, obj.scale_y, and obj.label if needed!
                    result.Add(new Vector2(obj.x, obj.y));
                    labels.Add(obj.label); // Store labels if you want to display them in the UI
                }

                if (data.objects.Count > 0)
                {
                    // Example logic: Move object
                    transform.position = new Vector3(data.objects[0].x, 0, data.objects[0].y);
                }
                spawner.UpdateUIElements(result,labels);
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"Error processing message: {e.Message}");
        }
    }
}