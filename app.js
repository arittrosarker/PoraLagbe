// Import Firebase modules from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  push,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Firebase configuration (as provided)
const firebaseConfig = {
  apiKey: "AIzaSyAx3b-2EPm2qPjYu6L07GCCKAkoF_z1sF0",
  authDomain: "poralagbe-17c0e.firebaseapp.com",
  projectId: "poralagbe-17c0e",
  storageBucket: "poralagbe-17c0e.firebasestorage.app",
  messagingSenderId: "380156491503",
  appId: "1:380156491503:web:9983033564385f0b5d8d1a",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Global Variables
let timerInterval = null;
let firebaseUpdateInterval = null;
let startTime = null;
let elapsedTime = parseInt(localStorage.getItem("elapsedTime")) || 0; // in seconds
let isRunning = false;
let username = localStorage.getItem("studyUsername") || "";
let currentSession = null;
let dailyGoal = 0; // in hours

// HTML Elements
const studyTimerEl = document.getElementById("studyTimer");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameBtn = document.getElementById("saveUsernameBtn");
const statusIndicator = document.getElementById("statusIndicator");
const motivationalQuoteEl = document.getElementById("motivationalQuote");
const streakCounterEl = document.getElementById("streakCounter");
const lifetimeTimeEl = document.getElementById("lifetimeTime");
const sessionTableBody = document.querySelector("#sessionTable tbody");
const leaderboardTableBody = document.querySelector("#leaderboardTable tbody");
const animatedClockEl = document.getElementById("animatedClock");
const studyGoalInput = document.getElementById("studyGoalInput");
const setGoalBtn = document.getElementById("setGoalBtn");
const goalProgressEl = document.getElementById("goalProgress");
const prevDayBtn = document.getElementById("prevDayBtn");
const prevDayDataEl = document.getElementById("prevDayData");

// Sound effects (ensure these files exist)
const startSound = document.getElementById("startSound");
const pauseSound = document.getElementById("pauseSound");

// Motivational quotes (sample array)
const quotes = [
  "Keep pushing your limits!",
  "Small steps every day.",
  "Study hard, shine bright!",
  "Your future self will thank you.",
  "Stay focused and never give up!",
];

function displayRandomQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  motivationalQuoteEl.innerText = quotes[randomIndex];
}

// Animated clock display
function updateClock() {
  const now = new Date();
  animatedClockEl.innerText = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// Helper: format seconds into HH:MM:SS
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return (
    hrs.toString().padStart(2, "0") +
    ":" +
    mins.toString().padStart(2, "0") +
    ":" +
    secs.toString().padStart(2, "0")
  );
}

function updateTimerDisplay() {
  studyTimerEl.innerText = formatTime(elapsedTime);
  // Update progress bar if a goal is set (goal is in hours)
  if (dailyGoal > 0) {
    const progressPercent = Math.min(
      (elapsedTime / (dailyGoal * 3600)) * 100,
      100
    );
    goalProgressEl.style.width = progressPercent + "%";
  }
  localStorage.setItem("elapsedTime", elapsedTime);
}

// Check if it is a new day – if yes, reset timer & leaderboard data locally.
function checkDailyReset() {
  const todayStr = new Date().toDateString();
  const storedDate = localStorage.getItem("studyDate");
  if (storedDate !== todayStr) {
    savePreviousDayData(storedDate);
    elapsedTime = 0;
    localStorage.setItem("studyDate", todayStr);
    localStorage.setItem("streak", 0);
    updateTimerDisplay();
    updateStatus("Idle");
  }
}

// Save previous day data (stub)
function savePreviousDayData(dateStr) {
  if (!dateStr) return;
  const leaderboardRef = ref(db, "history/" + dateStr + "/leaderboard");
  const leaderboardData = { message: "Leaderboard data for " + dateStr };
  set(leaderboardRef, leaderboardData);
}

// Timer Functions
function startTimer() {
  if (isRunning) return;
  isRunning = true;
  localStorage.setItem("timerRunning", "true");
  updateStatus("Studying");
  startSound.play();
  if (!currentSession) {
    currentSession = {
      start: new Date().toISOString(),
      duration: 0,
    };
  }
  // Set the startTime so that elapsedTime continues from the stored value
  startTime = Date.now() - elapsedTime * 1000;
  timerInterval = setInterval(() => {
    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    updateTimerDisplay();
  }, 1000);
  // Update Firebase every 5 seconds for realtime leaderboard updates.
  firebaseUpdateInterval = setInterval(() => {
    updateLeaderboard(username, elapsedTime);
  }, 5000);
}

function pauseTimer() {
  if (!isRunning) return;
  isRunning = false;
  localStorage.setItem("timerRunning", "false");
  updateStatus("Paused");
  pauseSound.play();
  clearInterval(timerInterval);
  clearInterval(firebaseUpdateInterval);
  firebaseUpdateInterval = null;
  // End and record the current session
  if (currentSession) {
    currentSession.end = new Date().toISOString();
    currentSession.duration = elapsedTime; // in seconds
    saveSessionLog(currentSession);
    updateLeaderboard(username, elapsedTime);
    updateLifetimeStudyTime(currentSession.duration);
    currentSession = null;
  }
}

function resetTimer() {
  pauseTimer();
  elapsedTime = 0;
  updateTimerDisplay();
  updateStatus("Idle");
}

// Update status display
function updateStatus(status) {
  statusIndicator.innerText = status;
}

// Save session log in Firebase under "sessions/username"
function saveSessionLog(session) {
  const sessionRef = ref(db, "sessions/" + username);
  const newSessionRef = push(sessionRef);
  set(newSessionRef, session);
  // Update local session log table
  const row = document.createElement("tr");
  row.innerHTML = `<td>${new Date(session.start).toLocaleTimeString()}</td>
                   <td>${new Date(session.end).toLocaleTimeString()}</td>
                   <td>${formatTime(session.duration)}</td>`;
  sessionTableBody.appendChild(row);
}

// Update leaderboard in Firebase under "leaderboard/username"
function updateLeaderboard(user, timeSec) {
  if (!user) return;
  const leaderboardRef = ref(db, "leaderboard/" + user);
  // Store study time in hours (rounded to 2 decimals)
  set(leaderboardRef, { studyTime: (timeSec / 3600).toFixed(2) });
}

// Update lifetime study time in Firebase under "lifetimeStudy/username"
function updateLifetimeStudyTime(sessionDuration) {
  const lifetimeRef = ref(db, "lifetimeStudy/" + username);
  onValue(
    lifetimeRef,
    (snapshot) => {
      let lifetime = snapshot.val() ? parseFloat(snapshot.val().total) : 0;
      lifetime += sessionDuration / 3600;
      set(lifetimeRef, { total: lifetime.toFixed(2) });
      lifetimeTimeEl.innerText = lifetime.toFixed(2);
    },
    { onlyOnce: true }
  );
}

// Load and display leaderboard (sorted highest-to-lowest)
function loadLeaderboard() {
  const leaderboardRoot = ref(db, "leaderboard");
  onValue(leaderboardRoot, (snapshot) => {
    const data = snapshot.val();
    const arr = [];
    for (let user in data) {
      arr.push({ user: user, studyTime: parseFloat(data[user].studyTime) });
    }
    // Sort descending by studyTime
    arr.sort((a, b) => b.studyTime - a.studyTime);
    leaderboardTableBody.innerHTML = "";
    arr.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${item.user}</td><td>${item.studyTime}</td>`;
      leaderboardTableBody.appendChild(row);
    });
  });
}

// Daily streak counter: load streak from localStorage
function loadStreak() {
  let streak = localStorage.getItem("streak");
  if (!streak) {
    streak = 0;
  }
  streakCounterEl.innerText = streak;
}

// Increase streak count when a session has recorded time
function increaseStreak() {
  let streak = parseInt(localStorage.getItem("streak")) || 0;
  streak++;
  localStorage.setItem("streak", streak);
  streakCounterEl.innerText = streak;
}

// Event Listeners
startBtn.addEventListener("click", () => {
  checkDailyReset();
  startTimer();
});

pauseBtn.addEventListener("click", () => {
  pauseTimer();
  if (elapsedTime > 0) increaseStreak();
});

resetBtn.addEventListener("click", () => {
  resetTimer();
});

saveUsernameBtn.addEventListener("click", () => {
  username = usernameInput.value.trim();
  if (username) {
    localStorage.setItem("studyUsername", username);
    alert(`Username set to ${username}`);
  } else {
    alert("Please enter a valid name.");
  }
});

// Set daily study goal
setGoalBtn.addEventListener("click", () => {
  const goal = parseFloat(studyGoalInput.value);
  if (!isNaN(goal) && goal > 0) {
    dailyGoal = goal;
    alert(`Daily study goal set to ${goal} hours`);
  } else {
    alert("Please enter a valid number for study goal.");
  }
});

// View previous day's data (stub retrieval from Firebase history)
prevDayBtn.addEventListener("click", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateKey = yesterday.toDateString();
  const historyRef = ref(db, "history/" + dateKey + "/leaderboard");
  onValue(
    historyRef,
    (snapshot) => {
      const data = snapshot.val();
      if (data) {
        prevDayDataEl.innerText = JSON.stringify(data);
      } else {
        prevDayDataEl.innerText = "No data for " + dateKey;
      }
    },
    { onlyOnce: true }
  );
});

// On page load: restore timer state and other data
window.addEventListener("load", () => {
  // Load elapsed time from localStorage
  const storedElapsed = parseInt(localStorage.getItem("elapsedTime"));
  if (!isNaN(storedElapsed)) {
    elapsedTime = storedElapsed;
    updateTimerDisplay();
  }
  // If the timer was running before refresh, pause it.
  if (localStorage.getItem("timerRunning") === "true") {
    isRunning = false;
    localStorage.setItem("timerRunning", "false");
    updateStatus("Paused");
  }
  checkDailyReset();
  loadLeaderboard();
  loadStreak();
  displayRandomQuote();
  if (username) {
    usernameInput.value = username;
  }
});
