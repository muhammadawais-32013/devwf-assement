# 🎯 ZenPomodoro — Deep Focus Timer

ZenPomodoro is a premium, distraction-free, and highly aesthetic Pomodoro timer web application. Built entirely with a pure, lightweight vanilla frontend stack (HTML5, CSS3, and ES6+ JavaScript), it delivers a high-end desktop experience without any external framework weight or internet dependencies.

![ZenPomodoro UI](file:///home/muhammad-awais-qarni/.gemini/antigravity/brain/2eae92ca-2541-4c35-86e3-06a6705e861b/.system_generated/click_feedback/click_feedback_1779455451245.png)

---

## ✨ Features & Polish

- **State-Based Morphing Themes**: The application shifts colors organically.
  - **Focus Mode**: Deep amethysts and rich purple neon-glow gradients representing concentration.
  - **Break Mode**: Soothing midnight emeralds and mint gradients representing refreshment.
  - **Paused State**: Breathing warm amber glows.
- **Drift-Free Precision Countdown**: Uses calibrated difference ticking comparing timestamp logs rather than simple `setInterval` delays to protect counting integrity even when browser tabs are minimized.
- **Tibetan Chime Synthesis**: Utilizes the built-in **Web Audio API** to synthesize a clear, resonant tibetan gong chime on cycle completion—preventing broken network media files.
- **Zen Ambient Sound Generator**: Directly synthesizes continuous, calming **Brownian Ambient Noise** inside the browser to block environmental distractions.
- **Celebration Confetti Physics**: An inlined 2D Canvas confetti generator with custom gravity and air drag equations that bursts when your focus session is completed.
- **Persistent Daily Logs**: Keeps logs of daily accomplishments (surviving reloads) but automatically purges itself at midnight using local calendar comparisons.
- **High-End Glassmorphism**: Tailored utilizing modern custom Google Typography (*Plus Jakarta Sans* & *Outfit*), CSS filters (`backdrop-filter`), organic SVG graphics, and precise responsive clamp structures.
- **Universal Accessibility**: Implements custom keyboard interaction (spacebar triggers timer play/pause), high-contrast accessibility focus states, and aria roles.

---

## 🚀 How to Run Locally

Since ZenPomodoro is written with zero dependencies, you can open and run it instantly on a fresh machine.

#### Method : Live URL

**https://muhammadawais-32013.github.io/DevWF-Assement/**

### The Offline Instant Way (Zero Tooling)
Simply double-click the `index.html` file or drag it directly into any modern web browser (Chrome, Firefox, Safari, Edge, etc.):
```bash
# On Linux / macOS
open index.html

# On Windows
start index.html
```

## 📁 File Structure

```
DevWF Assement/
├── index.html       # Semantic layout with inline SVG assets
├── styles.css       # Core typography, glassmorphism elements & theme keyframes
├── app.js           # Timing, synthesized Web Audio, and history states
├── README.md        # Running instructions (this file)
└── ANSWERS.md       # Written assessment questions response sheet
```
