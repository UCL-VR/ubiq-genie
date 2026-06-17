using Ubiq.Editor;

namespace Ubiq.Genie.Editor
{
    /// <summary>
    /// Imports Ubiq's "Demo (XRI)" sample automatically after Ubiq is
    /// installed. This adds the XR Interaction Toolkit dependency and the
    /// XRI player prefab used by the Ubiq-Genie sample scenes.
    ///
    /// This script lives in a separate assembly that references Ubiq.Editor,
    /// so it only compiles once Ubiq is present. On first compile it calls
    /// <see cref="PackageManagerHelper.RequireSample"/> which is a no-op if
    /// the sample has already been imported.
    /// </summary>
    [UnityEditor.InitializeOnLoad]
    public static class AddUbiqSamples
    {
        static AddUbiqSamples()
        {
            PackageManagerHelper.RequireSample("com.ucl.ubiq", "Demo (XRI)");
        }
    }
}
