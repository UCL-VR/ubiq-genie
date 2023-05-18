using System.Collections;
using System.Collections.Generic;
using Ubiq.Networking;
using UnityEngine;
using Ubiq.Dictionaries;
using Ubiq.Messaging;
using Ubiq.Logging.Utf8Json;
using Ubiq.Rooms;
using System;
using System.IO;
using System.Text;
using UnityEngine.Networking;
using Ubiq.XR;

public class TextureGenerationCollector : MonoBehaviour
{
    public NetworkId networkId = new NetworkId(97);
    private NetworkContext context;
    private RoomClient client;
    public string serverBaseUrl;
    public SelectRay selectRay;
    private bool paintAll = false;

    [Serializable]
    private struct Message
    {
        public string type;
        public string target;
        public string data;
    }

    public Texture2D tempTexture;

    [Serializable]
    public struct MaterialKeywords {
        public Material material;
        public List<string> keywords;
    }
    public MaterialKeywords[] materialKeywords;

    [Serializable]
    public struct ObjectTargetKeywords {
        public GameObject targetObject;
        public int targetSubmeshIndex;
        public string targetMaterialName;
        public string[] targetKeywords;
    }
    public ObjectTargetKeywords[] targets;
    private List<Tuple<GameObject, int>> currentTargets;
    private int currentSubmeshIndex;
    private string currentTargetMaterialName;

    // Start is called before the first frame update
    void Start()
    {
        context = NetworkScene.Register(this,networkId);
        client = GetComponentInParent<RoomClient>();
    }

    private void SetTexture(Texture2D newTexture) {
        // Set the texture of the submeshes of the current targets
        foreach (Tuple<GameObject, int> target in currentTargets) {
            target.Item1.GetComponent<Renderer>().materials[target.Item2].mainTexture = newTexture;
            // target.Item1.GetComponent<Renderer>().materials[target.Item2].mainTextureScale = new Vector2(0.02f, 0.02f);
        }
    }

    // public void ScaleTexture(float scaleModifier) {
    //     foreach (Tuple<GameObject, int> target in currentTargets) {
    //         target.Item1.GetComponent<Renderer>().materials[target.Item2].mainTextureScale = new Vector2(scale, scale);
    //     }
    // }

    void LoadPNGFromURL(string url, System.Action<Texture2D> onComplete)
    {
        UnityWebRequest www = UnityWebRequestTexture.GetTexture(url);
        www.SendWebRequest().completed += operation =>
        {
            if (www.isNetworkError || www.isHttpError)
            {
                Debug.Log(www.error);
                onComplete(null);
            }
            else
            {
                Texture2D texture = DownloadHandlerTexture.GetContent(www);
                var mmTexture = new Texture2D(texture.width, texture.height, texture.format, true);
                mmTexture.SetPixelData(texture.GetRawTextureData<byte>(), 0);
                mmTexture.Apply(true, true);
                onComplete(mmTexture);
            }
        };
    }

    // Find all submeshes of GameObjects in the scene with the given material name. Return a list of tuples of the GameObject and submesh index.
    private List<Tuple<GameObject, int>> FindTargets(string materialName) {
        List<Tuple<GameObject, int>> targets = new List<Tuple<GameObject, int>>();
        GameObject[] allObjects = UnityEngine.Object.FindObjectsOfType<GameObject>();
        foreach (GameObject obj in allObjects) {
            if (obj.GetComponent<Renderer>() != null) {
                Material[] materials = obj.GetComponent<Renderer>().materials;
                for (int i = 0; i < materials.Length; i++) {
                    if (materials[i].name == materialName) {
                        targets.Add(new Tuple<GameObject, int>(obj, i));
                    }
                }
            }
        }
        return targets;
    }

    private void processTextureMessage(Message message) {
        Material targetMaterial = null;
        string targetMaterialName = null;

        // If message.target contains a colon (:) then our target is a specific object and material, divided by a colon.
        if (message.target.Contains(":")) {
            string[] targetParts = message.target.Split(':');
            if (targetParts.Length != 2) {
                Debug.Log("Invalid target: " + message.target);
                return;
            }
            targetMaterialName = targetParts[1];
        } else {
            // Search through MaterialKeywords to find the material with the given keyword.
            foreach (MaterialKeywords mk in materialKeywords) {
                foreach (string keyword in mk.keywords) {
                    if (keyword.StartsWith(message.target)) {
                        targetMaterial = mk.material;
                        targetMaterialName = mk.material.name + " (Instance)";  // Add " (Instance)" to the material name to find instances of the material.
                        break;
                    }
                }
            }

            if (targetMaterial == null) {
                Debug.Log("No material found for " + message.target);
                return;
            }
        }

        currentTargets = FindTargets(targetMaterialName);

        if (message.type == "TextureGeneration") {
            // If targets are found, load the texture from the server and set it on the targets.
            if (currentTargets.Count > 0) {
                string fileName = message.data.ToString().Trim('\r', '\n');
                LoadPNGFromURL(serverBaseUrl + fileName, SetTexture);
            } else {
                Debug.Log("No target found for " + message.target);
            }
        } else if (message.type == "GenerationStarted") {
            Debug.Log("Generation started of " + message.target);
            SetTexture(tempTexture);
        }
        // If targets are found, load the texture from the server and set it on the targets.
        // if (currentTargets.Count > 0) {
        //     string fileName = message.data.ToString().Trim('\r', '\n');
        //     LoadPNGFromURL(serverBaseUrl + fileName, SetTexture);
        // } else {
        //     Debug.Log("No target found for " + message.target);
        // }
    }

    public void ProcessMessage(ReferenceCountedSceneGraphMessage data)
    {
        Message message = data.FromJson<Message>();
        processTextureMessage(message);
    }
}
