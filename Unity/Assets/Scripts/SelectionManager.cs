using Ubiq.Messaging;
using Ubiq.Rooms;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.InputSystem;

public class SelectionManager : MonoBehaviour
{
    private NetworkContext context;
    private RoomClient roomClient;
    private NetworkId networkId = new NetworkId(97);
    public XRRayInteractor rayInteractor;
    public ActionBasedController actionBasedController; // Add reference to the Action Based Controller
    private string lastSelection = "";
    private string currentSelection = "";
    private bool triggerHeld = false;

    void Start()
    {
        context = NetworkScene.Register(this, networkId);
        roomClient = RoomClient.Find(this);
    }

    void Update()
    {
        if (actionBasedController.activateAction.action.ReadValue<float>() > 0.1f)
        {
            if (!triggerHeld)
            {
                triggerHeld = true;
                if (rayInteractor.TryGetCurrent3DRaycastHit(out RaycastHit hit))
                {
                    GetSubmeshName(hit);
                }
                
                Debug.Log("Sending message: selection = " + currentSelection + ", peer = " + roomClient.Me.uuid + ", triggerHeld = " + triggerHeld);
                context.SendJson(new SelectionMessage { selection = currentSelection, peer = roomClient.Me.uuid, triggerHeld = triggerHeld });
            }
        }
        else
        {
            if (triggerHeld)
            {
                triggerHeld = false;
                
                if (rayInteractor.TryGetCurrent3DRaycastHit(out RaycastHit hit))
                {
                    GetSubmeshName(hit);
                }
                
                if (!string.IsNullOrEmpty(lastSelection))
                {
                    Debug.Log("Sending message: selection = " + lastSelection + ", peer = " + roomClient.Me.uuid + ", triggerHeld = " + triggerHeld);
                    context.SendJson(new SelectionMessage { selection = lastSelection, peer = roomClient.Me.uuid, triggerHeld = triggerHeld });
                }

                currentSelection = ""; // We reset the current selection as the trigger has been released
            }
        }
    }

    private void GetSubmeshName(RaycastHit raycasthitinfo)
    {
        if (raycasthitinfo.collider != null)
        {
            var meshCollider = raycasthitinfo.collider as MeshCollider;
            if (meshCollider != null && meshCollider.sharedMesh != null)
            {
                var mesh = meshCollider.sharedMesh;
                var submeshes = mesh.subMeshCount;
                for (int i = 0; i < submeshes; i++)
                {
                    var indices = mesh.GetIndices(i);
                    for (int j = 0; j < indices.Length; j += 3)
                    {
                        if (indices[j] == raycasthitinfo.triangleIndex ||
                            indices[j + 1] == raycasthitinfo.triangleIndex ||
                            indices[j + 2] == raycasthitinfo.triangleIndex)
                        {
                            string currentObjectName = raycasthitinfo.collider.gameObject.name;
                            string currentMaterialName = raycasthitinfo.collider.gameObject.GetComponent<Renderer>().materials[i].name;
                            currentSelection = currentObjectName + ":" + currentMaterialName;
                            if (currentSelection != lastSelection)
                            {
                                lastSelection = currentSelection;
                            }
                        }
                    }
                }
            }
        }
    }

    struct SelectionMessage
    {
        public string selection;
        public string peer;
        public bool triggerHeld;
    }

    public void ProcessMessage(ReferenceCountedSceneGraphMessage data)
    {
    }
}