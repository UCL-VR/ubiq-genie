using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro; // Added for TextMesh Pro support
/// <summary>
/// Manages the instantiation and positioning of UI prefabs (like Text or Icons) 
/// on a Canvas Panel based on incoming XY coordinates.
/// </summary>
public class obstacleSpawner : MonoBehaviour
{
    [Header("UI References")]
    [Tooltip("The UI Panel that will act as the parent for spawned objects.")]
    public RectTransform targetPanel;

    [Tooltip("The UI prefab (e.g., a Text object) to be instantiated.")]
    public GameObject uiPrefab;

    [Header("Settings")]
    [Tooltip("If true, the script will reuse existing objects instead of destroying/re-instantiating.")]
    public bool usePooling = true;

    // Internal list to keep track of currently active UI instances
    private List<GameObject> _activeUIElements = new List<GameObject>();

    // A pool to store disabled objects for reuse
    private Stack<GameObject> _pool = new Stack<GameObject>();

    /// <summary>
    /// Call this method whenever the list of XY coordinates and labels updates.
    /// </summary>
    /// <param name="newCoordinates">List of Vector2 where X and Y map to the Panel's local space.</param>
    /// <param name="labels">List of strings to be displayed on the UI prefabs.</param>
    public void UpdateUIElements(List<Vector2> newCoordinates, List<string> labels)
    {
        if (uiPrefab == null || targetPanel == null)
        {
            Debug.LogError("UISpawner: Prefab or Target Panel is missing in the inspector!");
            return;
        }

        // Ensure we don't go out of bounds if lists are mismatched
        int count = Mathf.Min(newCoordinates.Count, labels.Count);

        if (usePooling)
        {
            SyncWithPool(newCoordinates, labels, count);
        }
        else
        {
            SyncWithReinstantiation(newCoordinates, labels, count);
        }
    }

    /// <summary>
    /// Reuses existing UI elements and positions them.
    /// </summary>
    private void SyncWithPool(List<Vector2> coords, List<string> labels, int count)
    {
        // 1. Move extra active objects to the pool if we have more objects than coordinates
        while (_activeUIElements.Count > count)
        {
            GameObject obj = _activeUIElements[_activeUIElements.Count - 1];
            _activeUIElements.RemoveAt(_activeUIElements.Count - 1);
            obj.SetActive(false);
            _pool.Push(obj);
        }

        // 2. Update positions/text for existing active objects and spawn/retrieve new ones if needed
        for (int i = 0; i < count; i++)
        {
            Vector2 targetPosition = coords[i];
            string targetLabel = labels[i];

            if (i < _activeUIElements.Count)
            {
                // Update existing element
                UpdateElement(_activeUIElements[i], targetPosition, targetLabel);
                _activeUIElements[i].SetActive(true);
            }
            else
            {
                // Create or Retrieve from pool
                GameObject newObj;
                if (_pool.Count > 0)
                {
                    newObj = _pool.Pop();
                    newObj.SetActive(true);
                }
                else
                {
                    // Instantiate as a child of the panel
                    newObj = Instantiate(uiPrefab, targetPanel);
                }

                UpdateElement(newObj, targetPosition, targetLabel);
                _activeUIElements.Add(newObj);
            }
        }
    }

    /// <summary>
    /// Clears and recreates UI elements.
    /// </summary>
    private void SyncWithReinstantiation(List<Vector2> coords, List<string> labels, int count)
    {
        // Clean up old ones
        foreach (var obj in _activeUIElements)
        {
            if (obj != null) Destroy(obj);
        }
        _activeUIElements.Clear();

        // Instantiate new ones
        for (int i = 0; i < count; i++)
        {
            GameObject instance = Instantiate(uiPrefab, targetPanel);
            UpdateElement(instance, coords[i], labels[i]);
            _activeUIElements.Add(instance);
        }
    }

    /// <summary>
    /// Safely sets the anchoredPosition and TextMeshPro content of a UI element.
    /// </summary>
    private void UpdateElement(GameObject obj, Vector2 pos, string label)
    {
        // Update Position
        RectTransform rt = obj.GetComponent<RectTransform>();
        if (rt != null)
        {
            float adjustedX = pos.x - 960f;
            float adjustedY = 540f - pos.y;
            rt.anchoredPosition = new Vector2(adjustedX, adjustedY);
        }

        // Update Text (TextMesh Pro)
        TMP_Text textComp = obj.GetComponent<TMP_Text>();
        if (textComp == null)
        {
            // Check children in case the text is on a child object of the prefab
            textComp = obj.GetComponentInChildren<TMP_Text>();
        }

        if (textComp != null)
        {
            textComp.text = label;
        }
        else
        {
            Debug.LogWarning($"UISpawner: Prefab {obj.name} or its children are missing a TMP_Text component!");
        }
    }
}