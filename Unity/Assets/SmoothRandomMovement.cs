using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System.IO;
using System.Linq;
using Ubiq.XR;

public class SmoothRandomMovement : MonoBehaviour
{
    public GameObject leftHand;
    public GameObject rightHand;
    public GameObject head;

    private Vector3 lastLeftHandPosition;
    private Quaternion lastLeftHandOrientation;
    private Vector3 lastRightHandPosition;
    private Quaternion lastRightHandOrientation;
    private Vector3 lastHeadPosition;
    private Quaternion lastHeadOrientation;

    private class CaptureAnimation
    {
        public List<Vector3> rec_positionLeftHand = new List<Vector3>();
        public List<Quaternion> rec_orientationLeftHand = new List<Quaternion>();
        public List<Vector3> rec_positionRightHand = new List<Vector3>();
        public List<Quaternion> rec_orientationRightHand = new List<Quaternion>();
        public List<Vector3> rec_positionHead = new List<Vector3>();
        public List<Quaternion> rec_orientationHead = new List<Quaternion>();

    };

    List<CaptureAnimation> animations = new List<CaptureAnimation>();
    CaptureAnimation animation = new CaptureAnimation();

    public HandController rec_leftHand;
    public HandController rec_rightHand;
    public GameObject rec_head;

    bool isPressedRight = false;
    bool stopPressedRight = false;

    bool isPressedLeft = false;
    bool stopPressedLeft = false;

    public bool record = false;

    Dictionary<string, string> files_00 = new Dictionary<string, string>();
    //Dictionary<string, string> files_01 = new Dictionary<string, string>();
    //Dictionary<string, string> files_02 = new Dictionary<string, string>();

    int count = 0;
    float gestureLength = 2.0f;
    float timeElapsed = 0.0f;

    private void Start()
    {
        // first animation
        files_00.Add("00_lefthand_positions", "/test00_lh_positions.txt");
        files_00.Add("00_lefthand_orientations", "/test00_lh_orientations.txt");

        files_00.Add("00_righthand_positions", "/test00_rh_positions.txt");
        files_00.Add("00_righthand_orientations", "/test00_rh_orientations.txt");

        files_00.Add("00_head_positions", "/test00_h_positions.txt");
        files_00.Add("00_head_orientations", "/test00_h_orientations.txt");

        // second animation
        /*files_01.Add("01_lefthand_positions", "/test01_lh_positions.txt");
        files_01.Add("01_lefthand_orientations", "/test01_lh_orientations.txt");

        files_01.Add("01_righthand_positions", "/test01_rh_positions.txt");
        files_01.Add("01_righthand_orientations", "/test01_rh_orientations.txt");

        files_01.Add("01_head_positions", "/test01_h_positions.txt");
        files_01.Add("01_head_orientations", "/test01_h_orientations.txt");*/

        // third animation
        /*files_02.Add("02_lefthand_positions", "/test02_lh_positions.txt");
        files_02.Add("02_lefthand_orientations", "/test02_lh_orientations.txt");

        files_02.Add("02_righthand_positions", "/test02_rh_positions.txt");
        files_02.Add("02_righthand_orientations", "/test02_rh_orientations.txt");

        files_02.Add("02_head_positions", "/test02_h_positions.txt");
        files_02.Add("02_head_orientations", "/test02_h_orientations.txt");*/

        rec_rightHand.GripPress.AddListener(listenForCommandRightHand);
        rec_leftHand.GripPress.AddListener(listenForCommandLeftHand);

        if (record == false)
        {
            LoadAnimations();
        }


        lastLeftHandPosition = leftHand.transform.localPosition;
        lastLeftHandOrientation = leftHand.transform.localRotation;
        lastRightHandPosition = rightHand.transform.localPosition;
        lastRightHandOrientation = rightHand.transform.localRotation;
        lastHeadPosition = head.transform.localPosition;
        lastHeadOrientation = head.transform.localRotation;
    }

    public void listenForCommandRightHand(bool listen) {

        if (isPressedRight) {
            if(listen == false)
            {
                stopPressedRight = true;
            }
        }
        isPressedRight = listen;
    }

    public void listenForCommandLeftHand(bool listen)
    {

        if (isPressedLeft)
        {
            if (listen == false)
            {
                stopPressedLeft = true;
            }
        }
        isPressedLeft = listen;
    }

    void LoadAnimations()
    {
        animation = new CaptureAnimation();
        foreach (KeyValuePair<string, string> value in files_00)
        {
            LoadAnimation(ref animation, value);
        }
        animations.Add(animation);

    }

    void LoadAnimation(ref CaptureAnimation animation, KeyValuePair<string, string> value)
    {
        bool orientation = value.Value.Contains("orientations");

        if (orientation)
        {
            List<Quaternion> array = new List<Quaternion>();

            if (value.Key.Contains("left"))
            {
                array = animation.rec_orientationLeftHand;
            }
            else if (value.Key.Contains("right"))
            {
                array = animation.rec_orientationRightHand;
            }
            else if (value.Key.Contains("head"))
            {
                array = animation.rec_orientationHead;
            }

            using (StreamReader reader = new StreamReader(Application.dataPath + @"\" +value.Value))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    // Split the line by the comma
                    string[] values = line.Trim().Trim('(', ')').Split(',');

                    // Parse the values as doubles
                    float value1 = float.Parse(values[0]);
                    float value2 = float.Parse(values[1]);
                    float value3 = float.Parse(values[2]);
                    float value4 = float.Parse(values[3]);
                    array.Add(new Quaternion(value1, value2, value3, value4));
                }
            }

        } else
        {
            List<Vector3> array = new List<Vector3>();

            if (value.Key.Contains("left"))
            {
                array = animation.rec_positionLeftHand;
            }
            else if (value.Key.Contains("right"))
            {
                array = animation.rec_positionRightHand;
            }
            else if (value.Key.Contains("head"))
            {
                array = animation.rec_positionHead;
            }

            using (StreamReader reader = new StreamReader(Application.dataPath + @"\" + value.Value))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    // Split the line by the comma
                    string[] values = line.Trim().Trim('(', ')').Split(',');

                    // Parse the values as doubles
                    float value1 = float.Parse(values[0]); //this is because the offset of the player
                    float value2 = float.Parse(values[1]) - rec_head.transform.parent.parent.GetComponent<CameraOffsetter>().cameraOffset; //that should be removed when we record.
                    float value3 = float.Parse(values[2]);
                    array.Add(new Vector3(value1, value2, value3));
                }
            }
        }



    }


    private void FixedUpdate()
    {
        if(record == true)
        {
            if (stopPressedRight)
            {
                Debug.Log("Save file in here: " + Application.dataPath);
                string positionsString = string.Join("\n", animation.rec_positionLeftHand.Select(p => p.ToString("f4")));
                File.WriteAllText(Application.dataPath + "/test00_lh_positions.txt", positionsString);

                string orientationString = string.Join("\n", animation.rec_orientationLeftHand.Select(p => p.ToString("f4")));
                File.WriteAllText(Application.dataPath + "/test00_lh_orientations.txt", orientationString);

                positionsString = string.Join("\n", animation.rec_positionRightHand.Select(p => p.ToString("f4")));
                File.WriteAllText(Application.dataPath + "/test00_rh_positions.txt", positionsString);

                orientationString = string.Join("\n", animation.rec_orientationRightHand.Select(p => p.ToString("f4")));
                File.WriteAllText(Application.dataPath + "/test00_rh_orientations.txt", orientationString);

                positionsString = string.Join("\n", animation.rec_positionHead.Select(p => p.ToString("f4")));
                File.WriteAllText(Application.dataPath + "/test00_h_positions.txt", positionsString);

                orientationString = string.Join("\n", animation.rec_orientationHead.Select(p => p.ToString("f4")));
                File.WriteAllText(Application.dataPath + "/test00_h_orientations.txt", orientationString);

                stopPressedRight = false;
            }

            if (isPressedRight)
            {
                animation.rec_positionLeftHand.Add(rec_leftHand.gameObject.transform.localPosition);
                animation.rec_orientationLeftHand.Add(rec_leftHand.gameObject.transform.localRotation);

                animation.rec_positionRightHand.Add(rec_rightHand.gameObject.transform.localPosition);
                animation.rec_orientationRightHand.Add(rec_rightHand.gameObject.transform.localRotation);

                animation.rec_positionHead.Add(rec_head.gameObject.transform.localPosition);
                animation.rec_orientationHead.Add(rec_head.gameObject.transform.localRotation);
            }
        }
        else
        {
            if(Input.GetKey(KeyCode.L))
            {
                long size = animation.rec_orientationHead.Count;
                float step_size = gestureLength / size;
                if (count > size - 1)
                {
                    count = 0;
                }

                timeElapsed += Time.fixedDeltaTime;
                if (timeElapsed > step_size)
                {
                    leftHand.transform.localPosition = Vector3.Lerp(lastLeftHandPosition, animations[0].rec_positionLeftHand[count], count* step_size);
                    leftHand.transform.localRotation = Quaternion.Lerp(lastLeftHandOrientation, animations[0].rec_orientationLeftHand[count], count * step_size);

                    rightHand.transform.localPosition = Vector3.Lerp(lastRightHandPosition, animations[0].rec_positionRightHand[count], count * step_size);
                    rightHand.transform.localRotation = Quaternion.Lerp(lastRightHandOrientation, animations[0].rec_orientationRightHand[count], count * step_size);

                    head.transform.localPosition = Vector3.Lerp(lastHeadPosition, animations[0].rec_positionHead[count], count * step_size);
                    head.transform.localRotation = Quaternion.Lerp(lastRightHandOrientation, animations[0].rec_orientationHead[count], count * step_size);

                    count++;
                    timeElapsed = 0.0f;

                    lastLeftHandPosition = leftHand.transform.localPosition;
                    lastLeftHandOrientation = leftHand.transform.localRotation;
                    lastRightHandPosition = rightHand.transform.localPosition;
                    lastRightHandOrientation = rightHand.transform.localRotation;
                    lastHeadPosition = head.transform.localPosition;
                    lastHeadOrientation = head.transform.localRotation;
                }

            }
        }
    }
}
