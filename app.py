
import os
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI

# Always load .env from the same folder as this file
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024

CORS(app, resources={
    r"/transcribe": {
        "origins": [
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ]
    }
})

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "api_key_configured": bool(os.getenv("OPENAI_API_KEY"))
    })

@app.route("/transcribe", methods=["POST"])
def transcribe():
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        return jsonify({
            "error": "API key not loaded. Check the .env file."
        }), 500

    if "audio" not in request.files:
        return jsonify({"error": "No audio file received."}), 400

    audio = request.files["audio"]

    if not audio.filename:
        return jsonify({"error": "Audio filename is missing."}), 400

    try:
        client = OpenAI(api_key=api_key)

        result = client.audio.transcriptions.create(
            model="gpt-transcribe",
            file=(
                audio.filename,
                audio.stream,
                audio.mimetype or "audio/webm",
            ),
        )

        return jsonify({"transcript": result.text})

    except Exception as error:
        app.logger.exception("Transcription failed")
        return jsonify({
            "error": f"{type(error).__name__}: {error}"
        }), 502

@app.errorhandler(413)
def file_too_large(error):
    return jsonify({
        "error": "Recording exceeds the 25 MB limit."
    }), 413

if __name__ == "__main__":
    print("Environment file exists:", env_path.is_file())
    print("API key loaded:", bool(os.getenv("OPENAI_API_KEY")))
    app.run(host="127.0.0.1", port=5000, debug=False)
