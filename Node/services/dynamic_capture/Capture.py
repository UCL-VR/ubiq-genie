import cv2
import numpy as np
import socket
import json
import csv
import time

# --- CONFIGURATION ---
UDP_IP = "127.0.0.1"
UDP_PORT = 5065
UNITY_AREA_WIDTH = 7
UNITY_AREA_HEIGHT = 7
LOG_FILENAME = "tracking_log.csv"

# Camera Params (Insta360 - standard or fisheye, used if you uncomment undistort)
K = np.array([[1.15709813e+03, 0, 9.86153891e+02],
              [0, 1.17329523e+03, 5.82845627e+02],
              [0, 0, 1]], dtype=np.float32)
D = np.array([-0.57465333, 0.64656927, 0.01184943, 0.0153547, -0.39175262], dtype=np.float32)

# Global variables for calibration
calibration_points = []
calibration_complete = False
reference_frame = None  # To store the initial ground truth
prev_frame = None       # To store the immediate previous frame for motion detection

def mouse_callback(event, x, y, flags, param):
    global calibration_points, calibration_complete
    if event == cv2.EVENT_LBUTTONDOWN:
        if len(calibration_points) < 4:
            calibration_points.append((x, y))
            print(f"Point selected: {x}, {y}")
        if len(calibration_points) == 4 and not calibration_complete:
            calibration_complete = True
            print("Area defined! Tracking started.")

def calculate_perspective_matrix(src_points, width, height):
    src = np.float32(src_points)
    # Unity Coordinate Mapping (Top-Left Origin)
    dst = np.float32([[0,0],
        [width, 0],
        [width, height],
        [0, height]])
    return cv2.getPerspectiveTransform(src, dst)

def map_pixel_to_unity(matrix, pixel_x, pixel_y):
    point = np.array([[[pixel_x, pixel_y]]], dtype=np.float32)
    transformed = cv2.perspectiveTransform(point, matrix)
    return transformed[0][0]

def calculate_unity_scale(matrix, x, y, w, h):
    """Calculates the width and height of a bounding box in Unity units."""
    # Transform the top-left and bottom-right points of the bounding box
    p1 = map_pixel_to_unity(matrix, x, y)
    p2 = map_pixel_to_unity(matrix, x + w, y + h)
    
    # Scale is the absolute difference between the transformed coordinates
    u_w = abs(p2[0] - p1[0])
    u_h = abs(p2[1] - p1[1])
    return round(float(u_w), 3), round(float(u_h), 3)

def run_tracking(video_source=0):
    global reference_frame, prev_frame

    # 1. Setup UDP
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    # 2. Setup Camera
    cap = cv2.VideoCapture(video_source, cv2.CAP_DSHOW) 
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

    # 3. Logging Setup
    csv_file = open(LOG_FILENAME, 'w', newline='')
    writer = csv.writer(csv_file)
    writer.writerow(["frame count", "object count", "udpstring"])
    print(f"Logging started to {LOG_FILENAME}")

    window_name = "Object Detection"
    cv2.namedWindow(window_name)
    cv2.setMouseCallback(window_name, mouse_callback)

    M = None
    frame_count = 0

    print("\n--- INSTRUCTIONS ---")
    print("1. Click 4 points on the floor (Clockwise: TL, TR, BR, BL).")
    print("2. The system will CAPTURE the background immediately after the 4th click.")
    print("3. Press 'b' to reset/recapture the background ground truth.")
    print("4. Press 'q' to quit.")
    print("--------------------\n")

    try:
        while True:
            ret, raw_frame = cap.read()
            if not ret: break
            
            frame_count += 1
            frame = raw_frame 

            # --- CALIBRATION PHASE ---
            if not calibration_complete:
                for pt in calibration_points:
                    cv2.circle(frame, pt, 5, (0, 0, 255), -1)
                if len(calibration_points) > 1:
                    cv2.polylines(frame, [np.array(calibration_points)], False, (0, 0, 255), 2)
                
                cv2.putText(frame, f"Click 4 Points: {len(calibration_points)}/4", (30, 50), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

            # --- TRACKING PHASE ---
            else:
                if M is None:
                    M = calculate_perspective_matrix(calibration_points, UNITY_AREA_WIDTH, UNITY_AREA_HEIGHT)

                # 1. Image Pre-processing
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                gray = cv2.GaussianBlur(gray, (21, 21), 0)

                # 2. Capture Ground Truth
                if reference_frame is None:
                    reference_frame = gray
                    prev_frame = gray
                    print(">>> GROUND TRUTH CAPTURED. Comparison started.")
                    continue

                # 3. Compare with BASE (Static Detection) and PREVIOUS (Dynamic Detection)
                frame_delta_base = cv2.absdiff(reference_frame, gray)
                frame_delta_prev = cv2.absdiff(prev_frame, gray)

                # 4. Thresholding
                thresh_base = cv2.threshold(frame_delta_base, 25, 255, cv2.THRESH_BINARY)[1]
                thresh_prev = cv2.threshold(frame_delta_prev, 25, 255, cv2.THRESH_BINARY)[1]

                # 5. Dilation
                thresh_base = cv2.dilate(thresh_base, None, iterations=2)

                # 6. Find Contours based on Base Delta
                contours, _ = cv2.findContours(thresh_base.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

                detected_objects = []

                # Draw ROI
                cv2.polylines(frame, [np.array(calibration_points)], True, (255, 0, 0), 2)

                # 7. Process Contours
                for i, cnt in enumerate(contours):
                    area = cv2.contourArea(cnt)
                    
                    if area > 800:
                        x, y, w, h = cv2.boundingRect(cnt)
                        
                        # Get Centroid
                        M_moments = cv2.moments(cnt)
                        if M_moments["m00"] != 0:
                            cx = int(M_moments["m10"] / M_moments["m00"])
                            cy = int(M_moments["m01"] / M_moments["m00"])
                            
                            # Check if centroid is INSIDE ROI
                            result = cv2.pointPolygonTest(np.array(calibration_points), (cx, cy), False)
                            
                            if result >= 0: 
                                # Motion Detection
                                roi_motion = thresh_prev[y:y+h, x:x+w]
                                motion_score = np.sum(roi_motion) / (w * h)
                                is_dynamic = motion_score > 5.0 
                                status = "Dynamic" if is_dynamic else "Static"
                                
                                # Transform to Unity Position
                                unity_x, unity_y = map_pixel_to_unity(M, cx, cy)
                                
                                # Calculate Unity Scale
                                unity_w, unity_h = calculate_unity_scale(M, x, y, w, h)

                                obj_data = {
                                    "id": i,
                                    "pos": {"x": round(float(unity_x), 2), "y": round(float(unity_y), 2)},
                                    "scale": {"w": unity_w, "h": unity_h},
                                    "status": status
                                }
                                detected_objects.append(obj_data)

                                # Visualization
                                color = (0, 0, 255) if is_dynamic else (0, 255, 0)
                                cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
                                cv2.putText(frame, f"{status} W:{unity_w} H:{unity_h}", (x, y-10), 
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                # 8. Update Previous Frame
                prev_frame = gray

                # 9. Report & Log
                total_objects = len(detected_objects)
                udp_packet = {
                    "count": total_objects,
                    "objects": detected_objects
                }
                udp_string = json.dumps(udp_packet)
                
                # sock.sendto(udp_string.encode(), (UDP_IP, UDP_PORT))
                writer.writerow([frame_count, total_objects, udp_string])
                # key to send over ubiq genie
                print([frame_count, total_objects, udp_string])
                cv2.putText(frame, f"Total Objects: {total_objects}", (30, 50), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

            cv2.imshow(window_name, frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('b'):
                reference_frame = None
                print("Resetting background...")

    finally:
        cap.release()
        cv2.destroyAllWindows()
        csv_file.close()
        print("Execution finished.")

if __name__ == "__main__":
    run_tracking(1)