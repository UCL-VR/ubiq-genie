using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Ubiq.Voip;
using Ubiq.XR;

public class DesktopServerMicAudioController : MonoBehaviour
{
    public MicrophoneCapture microphoneCapture;

    private bool desktopMode = false;

    private HandController[] handControllers;

    // Start is called before the first frame update
    void Start()
    {
        desktopMode = Application.platform == RuntimePlatform.WindowsEditor || Application.platform == RuntimePlatform.WindowsPlayer || Application.platform == RuntimePlatform.OSXEditor || Application.platform == RuntimePlatform.OSXPlayer;
        handControllers = FindObjectsOfType<HandController>(includeInactive:true);
    }

    // Update is called once per frame
    void Update()
    {
        // Add a listener for space bar if deployed to mac or windows or when viewed in the editor
        if (desktopMode)
        {
            // Check for key down event for space bar
            if (Input.GetKeyDown(KeyCode.Space))
            {
                listenForCommand(true);
            }
            if (Input.GetKeyUp(KeyCode.Space))
            {
                listenForCommand(false);
            }
        }
        if (!Application.isEditor && Application.platform == RuntimePlatform.Android)
        {
            var listen = false;
            foreach(var controller in handControllers)
            {
                if (controller.PrimaryButtonState)
                {
                    listen = true;
                }
            }
            listenForCommand(listen);
        }
    }

    public void listenForCommand(bool listen)
    {
        microphoneCapture.gain = listen ? 1 : 0;
    }
}
