import os
import sys
import webbrowser
# pyrefly: ignore [missing-import]
import uvicorn

# Ensure project root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

if __name__ == "__main__":
    print("=" * 70)
    print(" AI-POWERED GEOSPATIAL SITE READINESS ANALYZER (PS-2)")
    print("=" * 70)
    print(" Starting FastAPI backend server at http://127.0.0.1:8000 ...")
    print(" Interactive Web Dashboard will be accessible at: http://127.0.0.1:8000")
    print("=" * 70)
    
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
