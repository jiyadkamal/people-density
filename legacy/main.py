from ultralytics import YOLO
import cv2
import time
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from datetime import datetime
import tkinter as tk

# ==============================
# CONFIGURATION
# ==============================
MODEL_PATH = "yolov8n.pt"
IMG_SIZE = 640
CONF_THRES = 0.4
PLOT_PATH = "people_count_vs_time.png"

# ==============================
# LOAD YOLO MODEL (CPU)
# ==============================
model = YOLO(MODEL_PATH)

# ==============================
# OPEN WEBCAM
# ==============================
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise RuntimeError("Could not open webcam")

# Get screen dimensions for responsive sizing
try:
    root = tk.Tk()
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    root.destroy()
except:
    screen_width = 1920
    screen_height = 1080

# Calculate optimal display size (80% of screen)
display_width = int(screen_width * 0.8)
display_height = int(screen_height * 0.8)

# ==============================
# DATA STORAGE FOR GRAPH
# ==============================
time_points = []
people_counts = []
start_time = time.time()
frame_count = 0
fps_list = []
time_stamps = []  # Store real-time timestamps

# ==============================
# COLOR SCHEME (MODERN GRADIENT)
# ==============================
PRIMARY_COLOR = (136, 255, 0)      # BGR format for cyan-green (matches card RGB 0,255,136)
SECONDARY_COLOR = (34, 87, 255)    # BGR format for orange
ACCENT_COLOR = (153, 51, 102)      # BGR format for purple
DARK_BG = (27, 17, 17)             # BGR format for dark blue
LIGHT_TEXT = (255, 255, 255)       # Pure white

# Create window and position it
cv2.namedWindow("YOLOv8 People Counting - Premium Detection", cv2.WINDOW_NORMAL)

# ==============================
# VIDEO PROCESSING LOOP
# ==============================
def draw_premium_panel(frame, person_count, fps):
    """Draw a premium statistics panel on the frame"""
    h, w = frame.shape[:2]
    
    # Convert frame to PIL for advanced drawing
    frame_pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(frame_pil, 'RGBA')
    
    # Panel dimensions (compact)
    panel_width = 150
    panel_height = 90
    panel_x = w - panel_width - 20
    panel_y = 20
    
    # Draw semi-transparent dark background with rounded corners effect
    draw.rectangle(
        [(panel_x - 5, panel_y - 5), (panel_x + panel_width + 5, panel_y + panel_height + 5)],
        fill=(17, 17, 27, 220)
    )
    
    # Draw main panel background
    draw.rectangle(
        [(panel_x, panel_y), (panel_x + panel_width, panel_y + panel_height)],
        fill=(30, 35, 50, 250),
        outline=(0, 255, 136, 180),
        width=3
    )
    title_font = ImageFont.truetype("arial.ttf", 18)
    stat_font = ImageFont.truetype("arial.ttf", 24)
    label_font = ImageFont.truetype("arial.ttf", 10)
    
    # Draw title
    draw.text((panel_x + 12, panel_y + 10), "DETECTION", fill=(255, 255, 255, 255), font=title_font)
    
    # Draw people count (large)
    people_text = str(person_count)
    draw.text((panel_x + 110, panel_y + 28), people_text, fill=(0, 255, 136, 255), font=stat_font)
    draw.text((panel_x + 12, panel_y + 32), "People:", fill=(200, 200, 200, 255), font=label_font)
    
    # Draw FPS
    fps_text = f"FPS: {fps:.1f}"
    draw.text((panel_x + 12, panel_y + 50), fps_text, fill=(255, 87, 34, 255), font=label_font)
    
    # Draw live clock
    current_time = datetime.now().strftime("%H:%M:%S")
    draw.text((panel_x + 12, panel_y + 65), f"Clock: {current_time}", fill=(255, 87, 34, 255), font=label_font)
    
    
    # Convert back to OpenCV format
    frame_cv = cv2.cvtColor(np.array(frame_pil), cv2.COLOR_RGB2BGR)
    return frame_cv

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_count += 1
    frame_time = time.time()

    results = model(frame, imgsz=IMG_SIZE, conf=CONF_THRES, device="cpu")

    person_count = 0

    for box in results[0].boxes:
        if int(box.cls[0]) == 0:
            person_count += 1

            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # Premium bounding box - matching card color
            thickness = 3
            color = PRIMARY_COLOR  # Cyan - matches card border
            
            # Draw main box
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)
            
            # Draw corner accents for premium look
            corner_len = 30
            corner_thickness = 2
            
            # Top-left corner
            cv2.line(frame, (x1, y1), (x1 + corner_len, y1), color, corner_thickness)
            cv2.line(frame, (x1, y1), (x1, y1 + corner_len), color, corner_thickness)
            
            # Top-right corner
            cv2.line(frame, (x2, y1), (x2 - corner_len, y1), color, corner_thickness)
            cv2.line(frame, (x2, y1), (x2, y1 + corner_len), color, corner_thickness)
            
            # Bottom-left corner
            cv2.line(frame, (x1, y2), (x1 + corner_len, y2), color, corner_thickness)
            cv2.line(frame, (x1, y2), (x1, y2 - corner_len), color, corner_thickness)
            
            # Bottom-right corner
            cv2.line(frame, (x2, y2), (x2 - corner_len, y2), color, corner_thickness)
            cv2.line(frame, (x2, y2), (x2, y2 - corner_len), color, corner_thickness)
            

    # Time tracking - use real-time timestamps
    current_time = datetime.now()
    time_points.append(current_time.strftime("%H:%M:%S"))
    time_stamps.append(current_time)  # Also store datetime for reference
    people_counts.append(person_count)
    
    # Calculate FPS
    if frame_count > 0:
        current_fps = frame_count / (time.time() - start_time)
        fps_list.append(current_fps)
    else:
        current_fps = 0

    # Draw premium panel
    frame = draw_premium_panel(frame, person_count, current_fps)

    cv2.imshow("YOLOv8 People Counting - Premium Detection", frame)

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()

# ==============================
# PLOT WITH REAL-TIME TIMESTAMPS
# ==============================
plt.figure(figsize=(14, 6))
plt.plot(
    range(len(people_counts)),  # Use index for x-axis
    people_counts,
    color="#1f77b4",
    linewidth=2.5,
    marker="o",
    markersize=4,
    alpha=0.9,
    label="People Count"
)

# Add time labels on x-axis (show every Nth label for clarity)
step = max(1, len(time_points) // 10)  # Show ~10 labels max
xticks = range(0, len(time_points), step)
xticklabels = [time_points[i] if i < len(time_points) else "" for i in xticks]
plt.xticks(xticks, xticklabels, rotation=45)

plt.yticks(range(0, max(people_counts) + 1, 1))  # Set y-axis scale to unit intervals

plt.xlabel("Real-Time (HH:MM:SS)", fontsize=13, labelpad=10)
plt.ylabel("Number of People", fontsize=13, labelpad=10)
plt.title("People Count Over Real-Time", fontsize=16, fontweight="bold", pad=15)
plt.grid(True, linestyle="--", linewidth=0.6, alpha=0.6)
plt.legend(fontsize=11)
plt.tight_layout()
plt.savefig(PLOT_PATH, dpi=300, bbox_inches="tight")
plt.show()
