using UnityEngine;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEditor.PackageManager.Requests;

namespace Ubiq.Genie.Editor
{
    /// <summary>
    /// Automatically adds the Ubiq package when Ubiq-Genie is first imported.
    /// Uses [InitializeOnLoad] so it runs on every domain reload until Ubiq is
    /// present. Once Ubiq is installed, its own Editor script handles adding
    /// the WebRTC fork dependency.
    /// </summary>
    [InitializeOnLoad]
    public static class AddDependencies
    {
        private const string UbiqPackageId = "com.ucl.ubiq";
        private const string UbiqGitUrl = "https://github.com/UCL-VR/ubiq.git#upm";

        private static ListRequest listRequest;
        private static AddRequest addRequest;

        static AddDependencies()
        {
            listRequest = Client.List(offlineMode: true, includeIndirectDependencies: false);
            EditorApplication.update += CheckList;
        }

        private static void CheckList()
        {
            if (!listRequest.IsCompleted)
                return;

            EditorApplication.update -= CheckList;

            if (listRequest.Status != StatusCode.Success)
            {
                Debug.LogWarning("[Ubiq-Genie] Could not query installed packages. " +
                    "Please ensure com.ucl.ubiq is installed manually.");
                return;
            }

            foreach (var pkg in listRequest.Result)
            {
                if (pkg.name == UbiqPackageId)
                    return; // Already installed
            }

            Debug.Log($"[Ubiq-Genie] Installing missing dependency: {UbiqPackageId}");
            addRequest = Client.Add(UbiqGitUrl);
            EditorApplication.update += WaitForAdd;
        }

        private static void WaitForAdd()
        {
            if (!addRequest.IsCompleted)
                return;

            EditorApplication.update -= WaitForAdd;

            if (addRequest.Status == StatusCode.Failure)
            {
                Debug.LogError($"[Ubiq-Genie] Failed to add {UbiqPackageId}: {addRequest.Error?.message}");
                return;
            }

            Debug.Log($"[Ubiq-Genie] Successfully added {addRequest.Result.name}@{addRequest.Result.version}");
        }
    }
}
