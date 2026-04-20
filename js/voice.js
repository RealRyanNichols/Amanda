// Push-to-talk dictation using the Web Speech API.
// Works in Chrome/Edge/Safari (iOS 14.5+) without a backend.
// Falls back gracefully when unsupported — the UI just doesn't show the mic button.

export function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Attach a push-to-talk mic button that dictates into a given textarea.
 * Returns the button element; caller decides where to place it.
 *
 * - Hold or tap to start. Tap again (or release) to stop.
 * - Interim transcripts show live; final transcript is appended to the
 *   textarea at the current caret position.
 * - If speech API is unsupported, a disabled button points the user to
 *   their phone's built-in keyboard dictation instead.
 */
export function micButton(textarea, { onStart, onStop, language = "en-US" } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mic-btn";
  btn.setAttribute("aria-label", "Dictate");
  btn.innerHTML = '<span class="mic-dot" aria-hidden="true"></span><span class="mic-label">Hold to talk</span>';

  if (!speechSupported()) {
    btn.classList.add("mic-btn-disabled");
    btn.title = "Use your phone's keyboard mic (the microphone on your keyboard) instead.";
    btn.querySelector(".mic-label").textContent = "Use keyboard mic";
    btn.addEventListener("click", () => {
      alert(
        "Voice dictation isn't supported in this browser.\n\n" +
        "Good news: your phone already has it. Tap the textarea, then tap the microphone icon on your keyboard. " +
        "It works the same way."
      );
    });
    return btn;
  }

  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let interimNode = null;
  let committedText = "";

  function start() {
    if (listening) return;
    recognition = new Rec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    committedText = textarea.value;
    interimNode = null;

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalChunk) {
        committedText = (committedText + " " + finalChunk.trim()).trim();
        textarea.value = committedText + (interim ? " " + interim : "");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (interim) {
        textarea.value = committedText + (committedText ? " " : "") + interim;
      }
    };

    recognition.onerror = (e) => {
      // Common: "not-allowed" if user denied mic permission, "no-speech" if quiet
      if (e.error === "not-allowed") {
        alert("Microphone permission denied. Check your browser's site settings and allow mic access.");
      }
      stop();
    };

    recognition.onend = () => {
      listening = false;
      btn.classList.remove("mic-btn-on");
      btn.querySelector(".mic-label").textContent = "Hold to talk";
      textarea.value = committedText;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      onStop?.();
    };

    try {
      recognition.start();
      listening = true;
      btn.classList.add("mic-btn-on");
      btn.querySelector(".mic-label").textContent = "Listening… tap to stop";
      onStart?.();
    } catch {
      listening = false;
    }
  }

  function stop() {
    if (!listening) return;
    try { recognition.stop(); } catch {}
  }

  // Tap toggle (more reliable than hold events across devices)
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (listening) stop();
    else start();
  });

  return btn;
}
