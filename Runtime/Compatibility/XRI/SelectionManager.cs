using Ubiq.Messaging;
using Ubiq.Rooms;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.InputSystem;

namespace Ubiq.Genie.XRI
{

public class SelectionManager : MonoBehaviour
{
    private const float TRIGGER_THRESHOLD = 0.1f;

    private NetworkContext context;
    private RoomClient roomClient;
    private NetworkId networkId = new NetworkId(97);

    [System.Serializable]
    public class HandState
    {
        public UnityEngine.XR.Interaction.Toolkit.Interactors.XRRayInteractor rayInteractor;
        public ActionBasedController controller;

        // Runtime state — not serialized by Unity (non-public)
        [System.NonSerialized] internal string lastSelection;
        [System.NonSerialized] internal string currentSelection;
        [System.NonSerialized] internal bool triggerHeld;
    }

    public HandState leftHand = new HandState();
    public HandState rightHand = new HandState();

    void Start()
    {
        context = NetworkScene.Register(this, networkId);
        roomClient = RoomClient.Find(this);

        // Initialise runtime state (NonSerialized fields default to null)
        foreach (var hand in new[] { leftHand, rightHand })
        {
            hand.lastSelection = "";
            hand.currentSelection = "";
        }
    }

    void Update()
    {
        HandleController(leftHand);
        HandleController(rightHand);
    }

    private void HandleController(HandState hand)
    {
        if (hand.controller.activateAction.action.ReadValue<float>() > TRIGGER_THRESHOLD)
        {
            if (!hand.triggerHeld)
            {
                hand.triggerHeld = true;
                if (hand.rayInteractor.TryGetCurrent3DRaycastHit(out RaycastHit hit))
                {
                    GetSubmeshName(hit, hand);
                }

                Debug.Log("Sending message: selection = " + hand.currentSelection + ", peer = " + roomClient.Me.uuid + ", triggerHeld = " + hand.triggerHeld);
                context.SendJson(new SelectionMessage { selection = hand.currentSelection, peer = roomClient.Me.uuid, triggerHeld = hand.triggerHeld });
            }
        }
        else
        {
            if (hand.triggerHeld)
            {
                hand.triggerHeld = false;

                if (hand.rayInteractor.TryGetCurrent3DRaycastHit(out RaycastHit hit))
                {
                    GetSubmeshName(hit, hand);
                }

                if (!string.IsNullOrEmpty(hand.lastSelection))
                {
                    Debug.Log("Sending message: selection = " + hand.lastSelection + ", peer = " + roomClient.Me.uuid + ", triggerHeld = " + hand.triggerHeld);
                    context.SendJson(new SelectionMessage { selection = hand.lastSelection, peer = roomClient.Me.uuid, triggerHeld = hand.triggerHeld });
                }

                hand.currentSelection = "";
            }
        }
    }

    private static void GetSubmeshName(RaycastHit raycasthitinfo, HandState hand)
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
                            hand.currentSelection = currentObjectName + ":" + currentMaterialName;
                            if (hand.currentSelection != hand.lastSelection)
                            {
                                hand.lastSelection = hand.currentSelection;
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

} // namespace Ubiq.Genie.XRI