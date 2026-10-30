
const questions = [
  "Do you work or are you a student?",
  "What do you like most about your studies?",
  "What do you usually do in your free time?",
  "Do you prefer studying alone or with other people?"
];

let currentQuestionIndex = 0;
let mediaRecorder = null;
let audioChunks = [];
let lastRecordingBlob = null;
let audioUrl = null;
let stream = null;

// HTML elements

const questionText = document.getElementById("question-text");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");

const startButton = document.getElementById("start-recording");
const stopButton = document.getElementById("stop-recording");
const nextButton = document.getElementById("next-button");
const restartButton = document.getElementById("restart-button");

const audioContainer = document.getElementById("audio-container");
const audioPlayback = document.getElementById("audio-playback");

const transcribeButton = document.getElementById("transcribe-button");
const transcriptionStatus = document.getElementById("transcription-status");
const transcriptContainer = document.getElementById("transcript-container");
const transcriptText = document.getElementById("transcript-text");

const recordingStatus = document.getElementById("recording-status");
const statusDot = document.getElementById("status-dot");
const errorMessage = document.getElementById("error-message");


// Display the current question
function updateScreen() {
  questionText.textContent = questions[currentQuestionIndex];

  progressText.textContent =
    `Question ${currentQuestionIndex + 1} of ${questions.length}`;

  progressBar.style.width =
    `${((currentQuestionIndex + 1) / questions.length) * 100}%`;

  nextButton.disabled =
    currentQuestionIndex === questions.length - 1;
}

// Clear the previous recording and transcript
function clearRecording() {
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }

  audioPlayback.removeAttribute("src");
  audioPlayback.load();

  audioContainer.hidden = true;

  lastRecordingBlob = null;
  transcriptText.textContent = "";
  transcriptContainer.hidden = true;
  transcriptionStatus.textContent = "";

  transcribeButton.disabled = false;
}

// Start recording
async function startRecording() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Microphone access is unavailable. Open the website using localhost."
      );
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    audioChunks = [];

    let options = {};

    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      options.mimeType = "audio/webm;codecs=opus";
    }

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const mimeType =
        mediaRecorder.mimeType || "audio/webm";

      const audioBlob = new Blob(audioChunks, {
        type: mimeType
      });

      if (audioBlob.size > 0) {
        clearRecording();

        lastRecordingBlob = audioBlob;

        audioUrl = URL.createObjectURL(audioBlob);
        audioPlayback.src = audioUrl;
        audioContainer.hidden = false;

        transcriptionStatus.textContent =
          "Your recording is ready. Click Transcribe Answer to see your transcript.";
      } else {
        transcriptionStatus.textContent =
          "No audio was recorded. Please try again.";
        audioContainer.hidden = false;
      }

      // Release the microphone
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }

      startButton.disabled = false;
      stopButton.disabled = true;
    };

    mediaRecorder.start();

    startButton.disabled = true;
    stopButton.disabled = false;
    nextButton.disabled = true;

    transcriptionStatus.textContent = "Recording...";

  } catch (error) {
    console.error("Recording error:", error);

    alert(
      error.message ||
      "Could not access the microphone. Please check your browser permissions."
    );

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    startButton.disabled = false;
    stopButton.disabled = true;
  }
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  nextButton.disabled =
    currentQuestionIndex === questions.length - 1;
}

// Send the recording to the Flask backend for transcription
async function transcribeRecording() {
  if (!lastRecordingBlob) {
    transcriptionStatus.textContent =
      "Please record an answer first.";
    return;
  }

  transcribeButton.disabled = true;
  transcriptionStatus.textContent =
    "Transcribing your answer. Please wait...";

  transcriptContainer.hidden = true;

  try {
    const formData = new FormData();

    const extension = lastRecordingBlob.type.includes("mp4")
      ? "mp4"
      : lastRecordingBlob.type.includes("ogg")
        ? "ogg"
        : "webm";

    formData.append(
      "audio",
      lastRecordingBlob,
      `speaking-answer.${extension}`
    );

    const response = await fetch(
      "http://127.0.0.1:5000/transcribe",
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Transcription failed."
      );
    }

    transcriptText.textContent = data.transcript;
    transcriptContainer.hidden = false;

    transcriptionStatus.textContent =
      "Transcription complete!";

  } catch (error) {
    console.error("Transcription error:", error);

    transcriptionStatus.textContent =
      error.message ||
      "Could not connect to the backend. Make sure Flask is running.";
  } finally {
    transcribeButton.disabled = false;
  }
}

// Move to the next question
function nextQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;

    clearRecording();
    updateScreen();
  }
}

// Restart the practice session
function restartPractice() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  currentQuestionIndex = 0;

  clearRecording();

  startButton.disabled = false;
  stopButton.disabled = true;
  nextButton.disabled = false;

  updateScreen();
}

// Button event listeners
startButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
nextButton.addEventListener("click", nextQuestion);
restartButton.addEventListener("click", restartPractice);
transcribeButton.addEventListener("click", transcribeRecording);

// Initial setup
stopButton.disabled = true;
updateScreen();
