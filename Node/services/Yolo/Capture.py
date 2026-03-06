import cv2
import numpy as np
import socket
import json
import csv
import time
from ultralytics import YOLO

# --- CONFIGURATION ---
UDP_IP = "127.0.0.1"
UDP_PORT = 5065
UNITY_AREA_WIDTH = 1920
UNITY_AREA_HEIGHT = 1080
LOG_FILENAME = "yolo_tracking_log.csv"

# Global variables for calibration
calibration_points = [(0,0), (1920,0),(1920,1080),(0,1080)]
calibration_complete = True

def mouse_callback(event, x, y, flags, param):
    global calibration_points, calibration_complete
    if event == cv2.EVENT_LBUTTONDOWN:
        if len(calibration_points) < 4:
            calibration_points.append((x, y))
            print(f"Point selected: {x}, {y}")
        if len(calibration_points) == 4 and not calibration_complete:
            calibration_complete = True
            print("Area defined! YOLO Tracking started.")

def calculate_perspective_matrix(src_points, width = 1920, height = 1080):
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

def run_tracking(video_source=0):
    global calibration_complete

    # 1. Setup UDP
    # sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    # 2. Setup Camera
    cap = cv2.VideoCapture(video_source) 
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

    # 3. Load YOLO Model (yolov8n is the nano model, great for real-time webcam)
    print("Loading YOLO model...")
    model = YOLO("yolov8n.pt") 

    # 4. Logging Setup
    csv_file = open(LOG_FILENAME, 'w', newline='')
    writer = csv.writer(csv_file)
    writer.writerow(["frame count", "object count", "udpstring"])
    print(f"Logging started to {LOG_FILENAME}")

    window_name = "YOLO Object Detection"
    cv2.namedWindow(window_name)
    # cv2.setMouseCallback(window_name, mouse_callback)

    M = None
    frame_count = 0

    print("\n--- INSTRUCTIONS ---")
    # print("1. Click 4 points on the floor (Clockwise: TL, TR, BR, BL) to set area.")
    # print("2. The system will start detecting objects inside the mapped area.")
    # print("3. Press 'q' to quit.")
    print("--------------------\n")

    try:
        while True:
            ret, frame = cap.read()
            if not ret: break
            
            frame_count += 1

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

                # Draw the ROI (Region of Interest)
                cv2.polylines(frame, [np.array(calibration_points)], True, (255, 0, 0), 2)

                # 1. Run YOLO inference on the frame
                results = model(frame, verbose=False)
                
                detected_objects = []
                obj_id_counter = 0

                # 2. Process YOLO Results
                for result in results:
                    boxes = result.boxes
                    for box in boxes:
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        
                        # Calculate center of the bounding box
                        cx = int((x1 + x2) / 2)
                        cy = int((y1 + y2) / 2)
                        
                        # Get class label
                        class_id = int(box.cls[0].item())
                        label = model.names[class_id]

                        # Check if centroid is INSIDE the 4-point calibration polygon
                        poly_result = cv2.pointPolygonTest(np.array(calibration_points), (cx, cy), False)
                        
                        if poly_result >= 0: # Inside or on the edge
                            
                            # Transform pixel coordinates to mapped (Unity) coordinates
                            unity_x, unity_y = map_pixel_to_unity(M, cx, cy)

                            # Create JSON-style dictionary for the object
                            obj_data = {
                                "id": obj_id_counter,
                                "x": round(float(unity_x), 2),
                                "y": round(float(unity_y), 2),
                                "label": label
                            }
                            detected_objects.append(obj_data)
                            obj_id_counter += 1

                            # Visualization
                            color = (0, 255, 0)
                            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                            cv2.circle(frame, (cx, cy), 5, (0, 0, 255), -1) # Red dot at center
                            cv2.putText(frame, f"{label} (ID:{obj_data['id']})", (int(x1), int(y1)-10), 
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                # 3. Report & Log
                total_objects = len(detected_objects)
                udp_packet = {
                    "count": total_objects,
                    "objects": detected_objects
                }
                udp_string = json.dumps(udp_packet)
                
                # Uncomment the line below to send data over UDP
                # sock.sendto(udp_string.encode(), (UDP_IP, UDP_PORT))
                
                writer.writerow([frame_count, total_objects, udp_string])
                print([frame_count, total_objects, udp_string])
                cv2.putText(frame, f"Total Objects: {total_objects}", (30, 50), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

            # Display the frame
            cv2.imshow(window_name, frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()
        csv_file.close()
        print("Execution finished.")

if __name__ == "__main__":
    # Use 0 for default webcam, 1 for secondary, or provide a video file path
    run_tracking(0)