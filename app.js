let focusDuration = parseInt(localStorage.getItem('zen_focus_duration')) || 25;
let breakDuration = parseInt(localStorage.getItem('zen_break_duration')) || 5;
let isRunning = false, isPaused = false;
let currentMode = 'focus';
let timeLeft = focusDuration * 60;
let totalDuration = timeLeft;
let timerInterval = null, expectedEndTime = 0;
let history = JSON.parse(localStorage.getItem('zen_focus_history')) || [];
let audioCtx = null, ambientSource = null, ambientGain = null;

const timerDisplay = document.getElementById('timer-display');
const timerStatus = document.getElementById('timer-status');
const progressCircle = document.getElementById('progress-circle');
const progressBadge = document.getElementById('progress-badge');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnReset = document.getElementById('btn-reset');
const sliderFocus = document.getElementById('focus-slider');
const sliderBreak = document.getElementById('break-slider');
const valFocus = document.getElementById('focus-val');
const valBreak = document.getElementById('break-val');
const toggleAudio = document.getElementById('toggle-audio');
const toggleAmbient = document.getElementById('toggle-ambient');
const historyList = document.getElementById('history-list');
const btnClearHistory = document.getElementById('btn-clear-history');
const confettiCanvas = document.getElementById('confetti-canvas');
const ctxConfetti = confettiCanvas.getContext('2d');

let confettiParticles = [];
let isConfettiActive = false;

const initAudio = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
};

const playChime = () => {
  if (!toggleAudio.checked) return;
  initAudio();
  const now = audioCtx.currentTime;

  [440, 660, 880].forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(idx === 0 ? 0.3 : 0.1, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5 - idx * 0.5);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 3);
  });
};

const startAmbient = () => {
  initAudio();
  if (ambientSource) return;

  const bufSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0.0;
  for (let i = 0; i < bufSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5;
  }

  ambientSource = audioCtx.createBufferSource();
  ambientSource.buffer = buffer;
  ambientSource.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, audioCtx.currentTime);

  ambientGain = audioCtx.createGain();
  ambientGain.gain.setValueAtTime(0, audioCtx.currentTime);
  ambientGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 1);

  ambientSource.connect(filter).connect(ambientGain).connect(audioCtx.destination);
  ambientSource.start();
};

const stopAmbient = () => {
  if (!ambientSource) return;
  const source = ambientSource;
  ambientSource = null;

  try {
    source.stop();
  } catch (e) { }
};

const triggerConfetti = () => {
  isConfettiActive = true;
  confettiParticles = [];
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#d8b4fe', '#6ee7b7'];
  for (let i = 0; i < 80; i++) {
    const isLeft = Math.random() > 0.5;
    confettiParticles.push({
      x: isLeft ? 0 : confettiCanvas.width,
      y: confettiCanvas.height * 0.8,
      vx: (isLeft ? 8 : -8) + (Math.random() - 0.5) * 5,
      vy: -10 - Math.random() * 10,
      size: 6 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: 0.3
    });
  }
  animateConfetti();
};

const animateConfetti = () => {
  if (!isConfettiActive) return;
  ctxConfetti.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  let active = 0;

  confettiParticles.forEach(p => {
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;

    ctxConfetti.fillStyle = p.color;
    ctxConfetti.fillRect(p.x, p.y, p.size, p.size);

    if (p.y < confettiCanvas.height && p.x > -20 && p.x < confettiCanvas.width + 20) active++;
  });

  if (active > 0) requestAnimationFrame(animateConfetti);
  else isConfettiActive = false;
};

const updateUI = () => {
  const min = Math.floor(timeLeft / 60);
  const sec = timeLeft % 60;
  const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  timerDisplay.textContent = formatted;

  const offset = 879.64 * (1 - (timeLeft / totalDuration));
  progressCircle.style.strokeDashoffset = totalDuration > 0 ? offset : 0;

  timerStatus.textContent = isPaused ? 'Paused' : (currentMode === 'focus' ? 'Focus Session' : 'Take a Break');

  const icon = currentMode === 'focus' ? '🎯' : '☕';
  document.title = `${isPaused ? '⏸ ' : ''}${formatted} ${icon} ZenPomodoro`;
};

const startTimer = () => {
  isRunning = true;
  isPaused = false;

  expectedEndTime = Date.now() + timeLeft * 1000;
  document.body.classList.add('timer-running');
  document.body.classList.remove('state-paused');

  document.getElementById('icon-play').style.display = 'none';
  document.getElementById('icon-pause').style.display = 'block';

  if (toggleAmbient.checked && currentMode === 'focus') startAmbient();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const delta = Math.round((expectedEndTime - Date.now()) / 1000);
    if (delta <= 0) {
      timeLeft = 0;
      updateUI();
      handleCycleCompletion();
    } else {
      timeLeft = delta;
      updateUI();
    }
  }, 100);
  updateUI();
};

const pauseTimer = () => {
  isPaused = true;
  clearInterval(timerInterval);
  document.body.classList.remove('timer-running');
  document.body.classList.add('state-paused');
  document.getElementById('icon-play').style.display = 'block';
  document.getElementById('icon-pause').style.display = 'none';
  stopAmbient();
  updateUI();
};

const resetTimer = (userInitiated = true) => {
  clearInterval(timerInterval);
  isRunning = false;
  isPaused = false;
  document.body.classList.remove('timer-running', 'state-paused');
  document.getElementById('icon-play').style.display = 'block';
  document.getElementById('icon-pause').style.display = 'none';
  stopAmbient();

  if (userInitiated) currentMode = 'focus';

  timeLeft = (currentMode === 'focus' ? focusDuration : breakDuration) * 60;
  totalDuration = timeLeft;
  updateUI();
};

const toggleTimer = () => {
  initAudio();
  if (isRunning && !isPaused) pauseTimer();
  else startTimer();
};

const handleCycleCompletion = () => {
  clearInterval(timerInterval);
  isRunning = false;
  isPaused = false;
  document.body.classList.remove('timer-running', 'state-paused');
  stopAmbient();
  playChime();

  if (currentMode === 'focus') {
    triggerConfetti();
    logSession(focusDuration);

    currentMode = 'break';
    timeLeft = breakDuration * 60;
    totalDuration = timeLeft;
    document.body.classList.replace('mode-focus', 'mode-break');
    setTimeout(startTimer, 1000);
  } else {
    currentMode = 'focus';
    timeLeft = focusDuration * 60;
    totalDuration = timeLeft;
    document.body.classList.replace('mode-break', 'mode-focus');
    setTimeout(startTimer, 1000);
  }
  updateUI();
};

const checkDailyHistory = () => {
  const today = new Date().toDateString();
  if (localStorage.getItem('zen_history_date') !== today) {
    localStorage.setItem('zen_history_date', today);
    localStorage.setItem('zen_focus_history', JSON.stringify([]));
    history = [];
  }
};

const logSession = (duration) => {
  const now = new Date();
  let hours = now.getHours();
  const timeStr = `${hours % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}${hours >= 12 ? 'pm' : 'am'}`;

  history.unshift({ id: Date.now(), duration, time: timeStr });
  localStorage.setItem('zen_focus_history', JSON.stringify(history));
  renderHistory();
};

const renderHistory = () => {
  historyList.innerHTML = '';
  if (history.length === 0) {
    historyList.innerHTML = `<li class="history-empty"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.5 13H11v-6h1.5v6z"/></svg><span>No sessions completed today.</span></li>`;
    progressBadge.textContent = '0 / 4';
    return;
  }

  history.forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `<div class="history-item-left"><div class="history-check"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div><div class="history-details"><span class="history-mode">Focus Session</span><span class="history-duration">${item.duration}:00 focus</span></div></div><span class="history-time-stamp">${item.time}</span>`;
    historyList.appendChild(li);
  });

  progressBadge.innerHTML = `<span>${history.length}</span> / 4`;
};

document.addEventListener('DOMContentLoaded', () => {
  sliderFocus.value = focusDuration;
  sliderBreak.value = breakDuration;
  valFocus.textContent = `${focusDuration}m`;
  valBreak.textContent = `${breakDuration}m`;

  toggleAudio.checked = localStorage.getItem('zen_audio_enabled') !== 'false';
  toggleAmbient.checked = localStorage.getItem('zen_ambient_enabled') === 'true';

  sliderFocus.addEventListener('input', (e) => {
    focusDuration = parseInt(e.target.value);
    valFocus.textContent = `${focusDuration}m`;
    localStorage.setItem('zen_focus_duration', focusDuration);
    if (!isRunning && currentMode === 'focus') resetTimer(false);
  });

  sliderBreak.addEventListener('input', (e) => {
    breakDuration = parseInt(e.target.value);
    valBreak.textContent = `${breakDuration}m`;
    localStorage.setItem('zen_break_duration', breakDuration);
    if (!isRunning && currentMode === 'break') resetTimer(false);
  });

  btnPlayPause.addEventListener('click', toggleTimer);
  btnReset.addEventListener('click', () => resetTimer(true));
  btnClearHistory.addEventListener('click', () => {
    history = [];
    localStorage.setItem('zen_focus_history', JSON.stringify([]));
    renderHistory();
  });

  toggleAudio.addEventListener('change', (e) => localStorage.setItem('zen_audio_enabled', e.target.checked));
  toggleAmbient.addEventListener('change', (e) => {
    localStorage.setItem('zen_ambient_enabled', e.target.checked);
    if (e.target.checked && isRunning && !isPaused && currentMode === 'focus') startAmbient();
    else stopAmbient();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !['BUTTON', 'INPUT'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      toggleTimer();
    }
  });

  window.addEventListener('resize', () => {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  });

  checkDailyHistory();
  renderHistory();
  resetTimer(false);
});
