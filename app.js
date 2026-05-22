/**
 * ZenPomodoro — Core Application Logic
 * Built with HTML5, CSS3, and Vanilla JavaScript
 */

class ZenPomodoro {
  constructor() {
    // --- DOM Elements ---
    this.timerDisplay = document.getElementById('timer-display');
    this.timerStatus = document.getElementById('timer-status');
    this.progressCircle = document.getElementById('progress-circle');
    this.progressBadge = document.getElementById('progress-badge');
    
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.btnReset = document.getElementById('btn-reset');
    this.btnClearHistory = document.getElementById('btn-clear-history');
    
    this.iconPlay = document.getElementById('icon-play');
    this.iconPause = document.getElementById('icon-pause');
    
    this.sliderFocus = document.getElementById('focus-slider');
    this.sliderBreak = document.getElementById('break-slider');
    this.valFocus = document.getElementById('focus-val');
    this.valBreak = document.getElementById('break-val');
    
    this.toggleAudio = document.getElementById('toggle-audio');
    this.toggleAmbient = document.getElementById('toggle-ambient');
    this.historyList = document.getElementById('history-list');
    this.confettiCanvas = document.getElementById('confetti-canvas');

    // --- State Variables ---
    this.isRunning = false;
    this.isPaused = false;
    this.currentMode = 'focus'; // 'focus' or 'break'
    this.timeLeft = 0;          // in seconds
    this.totalDuration = 0;     // in seconds
    this.timerInterval = null;
    this.expectedEndTime = 0;   // for drift-free timing
    
    // Config values
    this.focusDuration = 25;    // in minutes
    this.breakDuration = 5;     // in minutes
    this.audioEnabled = true;
    this.ambientEnabled = false;
    
    // History
    this.history = [];
    
    // Circle Progress Stroke Math
    this.circleCircumference = 2 * Math.PI * 140; // 879.64
    
    // Audio Context & Nodes (Lazy loaded)
    this.audioCtx = null;
    this.ambientSource = null;
    this.ambientGain = null;

    // Confetti Animation State
    this.confettiCtx = null;
    this.confettiParticles = [];
    this.isConfettiActive = false;

    // --- Initialization ---
    this.init();
  }

  init() {
    this.loadSettings();
    this.setupEventListeners();
    this.checkAndResetDailyHistory();
    this.renderHistory();
    this.resetTimer(false); // Init display state without starting
    this.setupConfetti();
  }

  // --- Settings & Persistence ---
  loadSettings() {
    // Sliders
    this.focusDuration = parseInt(localStorage.getItem('zen_focus_duration')) || 25;
    this.breakDuration = parseInt(localStorage.getItem('zen_break_duration')) || 5;
    
    this.sliderFocus.value = this.focusDuration;
    this.sliderBreak.value = this.breakDuration;
    this.valFocus.textContent = `${this.focusDuration}m`;
    this.valBreak.textContent = `${this.breakDuration}m`;

    // Toggles
    this.audioEnabled = localStorage.getItem('zen_audio_enabled') !== 'false';
    this.toggleAudio.checked = this.audioEnabled;

    this.ambientEnabled = localStorage.getItem('zen_ambient_enabled') === 'true';
    this.toggleAmbient.checked = this.ambientEnabled;
  }

  saveSettings() {
    localStorage.setItem('zen_focus_duration', this.focusDuration);
    localStorage.setItem('zen_break_duration', this.breakDuration);
    localStorage.setItem('zen_audio_enabled', this.audioEnabled);
    localStorage.setItem('zen_ambient_enabled', this.ambientEnabled);
  }

  setupEventListeners() {
    // Sliders
    this.sliderFocus.addEventListener('input', (e) => {
      this.focusDuration = parseInt(e.target.value);
      this.valFocus.textContent = `${this.focusDuration}m`;
      this.saveSettings();
      if (!this.isRunning && this.currentMode === 'focus') {
        this.resetTimer(false);
      }
    });

    this.sliderBreak.addEventListener('input', (e) => {
      this.breakDuration = parseInt(e.target.value);
      this.valBreak.textContent = `${this.breakDuration}m`;
      this.saveSettings();
      if (!this.isRunning && this.currentMode === 'break') {
        this.resetTimer(false);
      }
    });

    // Control buttons
    this.btnPlayPause.addEventListener('click', () => this.toggleTimer());
    this.btnReset.addEventListener('click', () => this.resetTimer(true));
    this.btnClearHistory.addEventListener('click', () => this.clearHistory());

    // Toggles
    this.toggleAudio.addEventListener('change', (e) => {
      this.audioEnabled = e.target.checked;
      this.saveSettings();
    });

    this.toggleAmbient.addEventListener('change', (e) => {
      this.ambientEnabled = e.target.checked;
      this.saveSettings();
      if (this.ambientEnabled) {
        if (this.isRunning && !this.isPaused) {
          this.startAmbientNoise();
        }
      } else {
        this.stopAmbientNoise();
      }
    });

    // Handle spacebar to start/pause
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'BUTTON' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.toggleTimer();
      }
    });

    // Resize canvas
    window.addEventListener('resize', () => {
      if (this.confettiCanvas) {
        this.confettiCanvas.width = window.innerWidth;
        this.confettiCanvas.height = window.innerHeight;
      }
    });
  }

  // --- Timer Core Engine (Drift-Free) ---
  toggleTimer() {
    this.initAudioContext(); // Lazy init Audio Context on user interaction

    if (this.isRunning && !this.isPaused) {
      // Pause
      this.pauseTimer();
    } else {
      // Start or Resume
      this.startTimer();
    }
  }

  startTimer() {
    this.isRunning = true;
    this.isPaused = false;
    
    // Set timing
    if (this.timeLeft <= 0) {
      this.timeLeft = (this.currentMode === 'focus' ? this.focusDuration : this.breakDuration) * 60;
      this.totalDuration = this.timeLeft;
    }
    
    this.expectedEndTime = Date.now() + this.timeLeft * 1000;
    
    // HTML state styling classes
    document.body.classList.add('timer-running');
    document.body.classList.remove('state-paused');
    
    // Sync Button Icons
    this.iconPlay.style.display = 'none';
    this.iconPause.style.display = 'block';
    this.btnPlayPause.setAttribute('aria-label', 'Pause Timer');

    // Ambient Noise Control
    if (this.ambientEnabled && this.currentMode === 'focus') {
      this.startAmbientNoise();
    }

    // Precise drift-free ticking
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const now = Date.now();
      const delta = Math.round((this.expectedEndTime - now) / 1000);
      
      if (delta <= 0) {
        this.timeLeft = 0;
        this.updateUI();
        this.handleCycleCompletion();
      } else {
        this.timeLeft = delta;
        this.updateUI();
      }
    }, 100);

    this.updateUI();
  }

  pauseTimer() {
    this.isPaused = true;
    clearInterval(this.timerInterval);
    
    document.body.classList.remove('timer-running');
    document.body.classList.add('state-paused');
    
    this.iconPlay.style.display = 'block';
    this.iconPause.style.display = 'none';
    this.btnPlayPause.setAttribute('aria-label', 'Resume Timer');

    this.stopAmbientNoise();
    this.updateUI();
  }

  resetTimer(userInitiated = true) {
    clearInterval(this.timerInterval);
    this.isRunning = false;
    this.isPaused = false;
    
    document.body.classList.remove('timer-running', 'state-paused');
    
    this.iconPlay.style.display = 'block';
    this.iconPause.style.display = 'none';
    this.btnPlayPause.setAttribute('aria-label', 'Start Timer');
    
    this.stopAmbientNoise();

    if (userInitiated) {
      // Return to focus mode
      this.currentMode = 'focus';
    }

    this.timeLeft = (this.currentMode === 'focus' ? this.focusDuration : this.breakDuration) * 60;
    this.totalDuration = this.timeLeft;
    
    this.updateUI();
  }

  handleCycleCompletion() {
    clearInterval(this.timerInterval);
    this.isRunning = false;
    this.isPaused = false;
    
    document.body.classList.remove('timer-running', 'state-paused');
    this.stopAmbientNoise();

    // Trigger Audible Chime
    if (this.audioEnabled) {
      this.playChime();
    }

    if (this.currentMode === 'focus') {
      // Celebrate Focus completion!
      this.triggerConfetti();
      this.logSession(this.focusDuration);
      
      // Auto transition to Break Mode
      this.currentMode = 'break';
      this.timerStatus.textContent = 'Take a Break';
      this.timeLeft = this.breakDuration * 60;
      this.totalDuration = this.timeLeft;
      
      // Flash UI background visually
      document.body.classList.remove('mode-focus');
      document.body.classList.add('mode-break');
      
      // Auto-start Break Mode
      setTimeout(() => this.startTimer(), 1000);
    } else {
      // Auto transition to Focus Mode
      this.currentMode = 'focus';
      this.timerStatus.textContent = 'Focus Session';
      this.timeLeft = this.focusDuration * 60;
      this.totalDuration = this.timeLeft;
      
      document.body.classList.remove('mode-break');
      document.body.classList.add('mode-focus');
      
      // Auto-start Focus Mode
      setTimeout(() => this.startTimer(), 1000);
    }

    this.updateUI();
  }

  // --- UI Presentation Sync ---
  updateUI() {
    // Format Display Time (MM:SS)
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    this.timerDisplay.textContent = formattedTime;
    
    // Update SVG Progress
    if (this.totalDuration > 0) {
      const percentage = this.timeLeft / this.totalDuration;
      const offset = this.circleCircumference * (1 - percentage);
      this.progressCircle.style.strokeDashoffset = offset;
    } else {
      this.progressCircle.style.strokeDashoffset = 0;
    }

    // Update Status label
    if (this.isPaused) {
      this.timerStatus.textContent = 'Paused';
    } else {
      this.timerStatus.textContent = this.currentMode === 'focus' ? 'Focus Session' : 'Take a Break';
    }

    // Tab title countdown sync
    const stateMarker = this.currentMode === 'focus' ? '🎯' : '☕';
    const pauseMarker = this.isPaused ? '⏸ ' : '';
    document.title = `${pauseMarker}${formattedTime} ${stateMarker} ZenPomodoro`;
  }

  // --- History Management ---
  checkAndResetDailyHistory() {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('zen_history_date');
    
    if (savedDate !== today) {
      // Clear past history and update date
      localStorage.setItem('zen_history_date', today);
      localStorage.setItem('zen_focus_history', JSON.stringify([]));
      this.history = [];
    } else {
      this.history = JSON.parse(localStorage.getItem('zen_focus_history')) || [];
    }
  }

  logSession(duration) {
    const now = new Date();
    // Time formatting: e.g. "3:42pm"
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const timeStr = `${hours}:${minutes}${ampm}`;

    const newLog = {
      id: Date.now(),
      mode: 'focus',
      duration: duration,
      time: timeStr
    };

    this.history.unshift(newLog); // Add to beginning of array
    localStorage.setItem('zen_focus_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  clearHistory() {
    this.history = [];
    localStorage.setItem('zen_focus_history', JSON.stringify([]));
    this.renderHistory();
  }

  renderHistory() {
    // Clear list
    this.historyList.innerHTML = '';
    
    if (this.history.length === 0) {
      this.historyList.innerHTML = `
        <li class="history-empty">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
          </svg>
          <span>No focus sessions completed today.</span>
        </li>
      `;
      this.progressBadge.textContent = '0 / 4';
      return;
    }

    this.history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div class="history-item-left">
          <div class="history-check">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
          <div class="history-details">
            <span class="history-mode">Focus Session</span>
            <span class="history-duration">${item.duration}:00 focus</span>
          </div>
        </div>
        <span class="history-time-stamp">${item.time}</span>
      `;
      this.historyList.appendChild(li);
    });

    // Update Daily progress badge (Targeting 4 standard sessions)
    const count = this.history.filter(h => h.mode === 'focus').length;
    this.progressBadge.innerHTML = `<span>${count}</span> / 4`;
  }

  // --- Web Audio API Modules (100% Dependency-Free) ---
  initAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if suspended (browser security block)
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playChime() {
    this.initAudioContext();
    const now = this.audioCtx.currentTime;

    // Resonant Tibetan Chime synthesis (fundamental frequency + harmonics)
    const fundamentalFreq = 440; // Pitch: A4
    const partials = [
      { freq: fundamentalFreq, gain: 0.5, decay: 3.5 },      // Fundamental
      { freq: fundamentalFreq * 1.5, gain: 0.25, decay: 2.5 },  // Fifth
      { freq: fundamentalFreq * 2, gain: 0.15, decay: 1.5 },     // Octave
      { freq: fundamentalFreq * 2.51, gain: 0.08, decay: 0.8 }   // Atmospheric harmonic
    ];

    partials.forEach(partial => {
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(partial.freq, now);

      // Envelope structure (instant attack, exponential decay)
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(partial.gain, now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + partial.decay);

      // Highpass filtration for extra crystalline airiness
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(150, now);

      osc.connect(gainNode);
      gainNode.connect(filter);
      filter.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + partial.decay);
    });
  }

  startAmbientNoise() {
    this.initAudioContext();
    if (this.ambientSource) return; // Already running

    const bufferSize = 2 * this.audioCtx.sampleRate;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    // Synthesize organic Brown Noise (low-frequency heavy waterfall rumble)
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Gain compensation
    }

    this.ambientSource = this.audioCtx.createBufferSource();
    this.ambientSource.buffer = noiseBuffer;
    this.ambientSource.loop = true;

    // Filter node to shape the sound into a super cozy fireplace/deep rain glow
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, this.audioCtx.currentTime); // Deep warm cut-off

    this.ambientGain = this.audioCtx.createGain();
    this.ambientGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    // Smooth fade in
    this.ambientGain.gain.linearRampToValueAtTime(0.08, this.audioCtx.currentTime + 1.5);

    this.ambientSource.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.audioCtx.destination);

    this.ambientSource.start();
  }

  stopAmbientNoise() {
    if (!this.ambientSource) return;

    const sourceToStop = this.ambientSource;
    const gainNode = this.ambientGain;

    this.ambientSource = null;
    this.ambientGain = null;

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      const fadeTime = 0.4;
      gainNode.gain.setValueAtTime(gainNode.gain.value, this.audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + fadeTime);
      
      setTimeout(() => {
        try {
          sourceToStop.stop();
        } catch (e) {
          // In case it was already stopped
        }
      }, fadeTime * 1000);
    }
  }

  // --- Confetti / Celebration Engine ---
  setupConfetti() {
    this.confettiCtx = this.confettiCanvas.getContext('2d');
    this.confettiCanvas.width = window.innerWidth;
    this.confettiCanvas.height = window.innerHeight;
  }

  triggerConfetti() {
    this.isConfettiActive = true;
    this.confettiParticles = [];

    const colors = ['#8b5cf6', '#a855f7', '#d8b4fe', '#10b981', '#34d399', '#6ee7b7', '#f59e0b', '#fcd34d'];

    // Spawn 120 particles from the bottom corners
    for (let i = 0; i < 120; i++) {
      const isLeft = Math.random() > 0.5;
      this.confettiParticles.push({
        x: isLeft ? 0 : this.confettiCanvas.width,
        y: this.confettiCanvas.height * 0.8,
        angle: isLeft ? -Math.PI / 4 + (Math.random() - 0.5) * 0.2 : -3 * Math.PI / 4 + (Math.random() - 0.5) * 0.2,
        speed: 10 + Math.random() * 12,
        gravity: 0.4,
        drag: 0.98,
        size: 8 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15
      });
    }

    // Animate
    this.animateConfetti();
  }

  animateConfetti() {
    if (!this.isConfettiActive) return;

    this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
    let activeParticles = 0;

    this.confettiParticles.forEach(p => {
      // Apply velocity and drag
      p.speed *= p.drag;
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed + p.gravity;
      p.rotation += p.rotationSpeed;
      p.gravity += 0.05; // falling gravity accelerates

      // Draw particle
      this.confettiCtx.save();
      this.confettiCtx.translate(p.x, p.y);
      this.confettiCtx.rotate(p.rotation);
      this.confettiCtx.fillStyle = p.color;
      this.confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      this.confettiCtx.restore();

      // Check if still visible
      if (p.y < this.confettiCanvas.height && p.x > -50 && p.x < this.confettiCanvas.width + 50) {
        activeParticles++;
      }
    });

    if (activeParticles > 0) {
      requestAnimationFrame(() => this.animateConfetti());
    } else {
      this.isConfettiActive = false;
      this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
    }
  }
}

// Start application when page is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ZenPomodoro();
});
