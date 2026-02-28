import subprocess
import time
import sys
import os

def run_servers():
    print("🚀 Starting VisionMetrics Pro Full Stack...")
    
    # Start Backend
    print("📦 Launching Python Detection Backend (Port 8000)...")
    backend_proc = subprocess.Popen([sys.executable, "backend/main.py"], shell=True)
    
    # Give backend a moment to start
    time.sleep(2)
    
    # Start Frontend
    print("🌐 Launching Next.js Frontend (Port 3000)...")
    frontend_proc = subprocess.Popen(["npm", "run", "dev"], shell=True)
    
    print("\n✅ Both servers are starting. Please wait for the Next.js compilation to finish.")
    print("👉 Frontend: http://localhost:3000")
    print("\nPress Ctrl+C in this terminal to stop both servers.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Stopping servers...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Done.")

if __name__ == "__main__":
    run_servers()
