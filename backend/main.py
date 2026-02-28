from fastapi import FastAPI, File, UploadFile, Form
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import cv2
import numpy as np
import io
import os
import smtplib
import ssl
import time
import threading
import base64
from PIL import Image
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables from the same directory as this script
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

# Initialize FastAPI app
app = FastAPI()

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLO models
MODELS = {
    "yolov8n.pt": YOLO("yolov8n.pt"),
}

# Email Alert Configuration
LAST_EMAIL_TIME = 0
EMAIL_COOLDOWN = 300  # 5 minutes in seconds
ALERT_RECIPIENT = "sng23cs086@sngce.ac.in"
ALERT_THRESHOLD = 5

def send_alert_email(count: int):
    global LAST_EMAIL_TIME
    
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    
    if not smtp_user or not smtp_pass:
        print("[SMTP] Warning: Credentials missing. Skipping email.")
        return

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = ALERT_RECIPIENT
        msg['Subject'] = f"🚨 ALERT: High Person Density Detected ({count})"
        
        body = f"""
        <html>
            <body style="font-family: sans-serif; color: #333;">
                <h2 style="color: #e11d48;">High Occupancy Alert</h2>
                <p>The VisionMetrics Pro engine has detected <b>{count} people</b>, which exceeds your threshold of {ALERT_THRESHOLD}.</p>
                <p><b>Timestamp:</b> {time.strftime('%Y-%m-%d %H:%M:%S')}</p>
                <hr style="border: none; border-top: 1px solid #eee;" />
                <p style="font-size: 12px; color: #666;">This is an automated security notification from your Person Density Analytics system.</p>
            </body>
        </html>
        """
        msg.attach(MIMEText(body, 'html'))

        context = ssl.create_default_context()
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls(context=context)
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            
        LAST_EMAIL_TIME = time.time()
        print(f"[SMTP] Alert email sent successfully for {count} people.")
    except Exception as e:
        print(f"[SMTP] Error sending email: {e}")

@app.post("/detect")
async def detect_people(
    file: UploadFile = File(...),
    model_name: str = Form("yolov8n.pt"),
    conf_threshold: float = Form(0.3)
):
    # Read image
    start_time = time.time()
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        print("Backend Error: Could not decode image")
        return {"error": "Invalid image"}

    # Run detection with smaller imgsz for speed
    model = MODELS.get(model_name, MODELS["yolov8n.pt"])
    
    # Inference timing
    inf_start = time.time()
    results = model(img, conf=conf_threshold, imgsz=320, verbose=False)
    inf_end = time.time()
    
    person_count = 0
    # Draw detections on the image
    for box in results[0].boxes:
        if int(box.cls[0]) == 0:  # Person class
            person_count += 1
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cv2.rectangle(img, (x1, y1), (x2, y2), (136, 255, 0), 2) # BGR for #00ff88

    # Encode image to base64 with optimized quality for speed
    _, buffer = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
    img_base64 = base64.b64encode(buffer).decode('utf-8')

    total_time = (time.time() - start_time) * 1000
    inf_time = (inf_end - inf_start) * 1000
    print(f"Backend: Detected {person_count} people in {total_time:.1f}ms (Inf: {inf_time:.1f}ms)")

    # Check for email alert trigger
    global LAST_EMAIL_TIME
    if person_count > ALERT_THRESHOLD:
        current_time = time.time()
        if (current_time - LAST_EMAIL_TIME) > EMAIL_COOLDOWN:
            # Send email in a separate thread to avoid blocking detection
            print(f"[SMTP] Triggering alert for {person_count} people...")
            threading.Thread(target=send_alert_email, args=(person_count,), daemon=True).start()
            # Optimistically update to prevent duplicate triggers while thread is starting
            LAST_EMAIL_TIME = current_time 

    return {
        "person_count": person_count,
        "image": f"data:image/jpeg;base64,{img_base64}"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)