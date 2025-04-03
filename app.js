// Import Firebase modules from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  push,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Firebase configuration (replace with your settings)
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
let elapsedTime = parseInt(localStorage.getItem("elapsedTime")) || 0; // seconds
let isRunning = false;
let currentSession = null;

// Require a name before allowing app usage.
let username = localStorage.getItem("studyUsername") || "";

// HTML Elements
const studyTimerEl = document.getElementById("studyTimer");
const toggleTimerBtn = document.getElementById("toggleTimer");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameBtn = document.getElementById("saveUsernameBtn");
const userSetupDiv = document.getElementById("userSetup");
const userDisplayDiv = document.getElementById("userDisplay");
const displayedUsernameEl = document.getElementById("displayedUsername");
const statusIndicator = document.getElementById("statusIndicator");
const motivationalQuoteEl = document.getElementById("motivationalQuote");
const streakCounterEl = document.getElementById("streakCounter");
const sessionTableBody = document.querySelector("#sessionTable tbody");
const leaderboardTableBody = document.querySelector("#leaderboardTable tbody");
const animatedClockEl = document.getElementById("animatedClock");
const prevDayBtn = document.getElementById("prevDayBtn");
const prevDayDataEl = document.getElementById("prevDayData");
const appContent = document.getElementById("appContent");

// Audio Elements (ensure these assets exist)
const startSound = document.getElementById("startSound");
const pauseSound = document.getElementById("pauseSound");

// Motivational Quotes
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

// Format seconds as HH:MM:SS
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 3600 % 60;
  return (
    String(hrs).padStart(2, "0") +
    ":" +
    String(mins).padStart(2, "0") +
    ":" +
    String(secs).padStart(2, "0")
  );
}

// Format leaderboard time as "Xh Ym"
function formatLeaderboardTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

function updateTimerDisplay() {
  studyTimerEl.innerText = formatTime(elapsedTime);
  localStorage.setItem("elapsedTime", elapsedTime);
}

// Check if it's a new day; reset local data if needed.
function checkDailyReset() {
  const todayStr = new Date().toDateString();
  const storedDate = localStorage.getItem("studyDate");
  if (storedDate !== todayStr) {
    savePreviousDayData(storedDate); // (stub for leaderboard history)
    elapsedTime = 0;
    localStorage.setItem("studyDate", todayStr);
    localStorage.removeItem("hasStudiedToday");
    localStorage.setItem("streak", 0);
    streakCounterEl.innerText = 0;
    // Clear today's session log
    localStorage.removeItem(getSessionKey());
    updateTimerDisplay();
    updateStatus("Idle");
    loadLocalSessionLog();
  }
}

// Save previous day's leaderboard data (stub)
function savePreviousDayData(dateStr) {
  if (!dateStr) return;
  const leaderboardRef = ref(db, "history/" + dateStr + "/leaderboard");
  const leaderboardData = { message: "Leaderboard data for " + dateStr };
  set(leaderboardRef, leaderboardData);
}

// Returns the localStorage key for today's session log.
function getSessionKey() {
  return "sessionLog_" + new Date().toDateString();
}

// Local Session Log: add a session and reload log.
function addLocalSessionLog(session) {
  const key = getSessionKey();
  let sessions = JSON.parse(localStorage.getItem(key)) || [];
  sessions.push(session);
  localStorage.setItem(key, JSON.stringify(sessions));
  loadLocalSessionLog();
}

// Load the local session log and update the table.
function loadLocalSessionLog() {
  const key = getSessionKey();
  sessionTableBody.innerHTML = "";
  let sessions = JSON.parse(localStorage.getItem(key)) || [];
  sessions.forEach((session) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${new Date(session.start).toLocaleTimeString()}</td>
                     <td>${new Date(session.end).toLocaleTimeString()}</td>
                     <td>${formatTime(session.duration)}</td>`;
    sessionTableBody.appendChild(row);
  });
}

// Timer Functions
function startTimer() {
  if (isRunning) return;
  isRunning = true;
  localStorage.setItem("timerRunning", "true");
  updateStatus("Studying");
  toggleTimerBtn.innerText = "Pause";
  startSound.play();
  if (!currentSession) {
    currentSession = {
      start: new Date().toISOString(),
      duration: 0,
    };
  }
  startTime = Date.now() - elapsedTime * 1000;
  timerInterval = setInterval(() => {
    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    updateTimerDisplay();
  }, 1000);
  // Update leaderboard on Firebase every 5 seconds
  firebaseUpdateInterval = setInterval(() => {
    updateLeaderboard(username, elapsedTime);
  }, 5000);
}

function pauseTimer() {
  if (!isRunning) return;
  isRunning = false;
  localStorage.setItem("timerRunning", "false");
  updateStatus("Paused");
  toggleTimerBtn.innerText = "Start";
  pauseSound.play();
  clearInterval(timerInterval);
  clearInterval(firebaseUpdateInterval);
  firebaseUpdateInterval = null;
  if (currentSession) {
    currentSession.end = new Date().toISOString();
    currentSession.duration = elapsedTime;
    addLocalSessionLog(currentSession);
    updateLeaderboard(username, elapsedTime);
    increaseStreak();
    currentSession = null;
  }
}

function updateStatus(status) {
  statusIndicator.innerText = status;
}

// Update the leaderboard entry on Firebase.
function updateLeaderboard(user, timeSec) {
  if (!user) return;
  const leaderboardRef = ref(db, "leaderboard/" + user);
  set(leaderboardRef, { totalSec: timeSec });
}

// Load the realtime leaderboard from Firebase.
function loadLeaderboard() {
  const leaderboardRoot = ref(db, "leaderboard");
  onValue(leaderboardRoot, (snapshot) => {
    const data = snapshot.val();
    const arr = [];
    for (let user in data) {
      arr.push({ user: user, totalSec: data[user].totalSec });
    }
    // Sort descending by study time
    arr.sort((a, b) => b.totalSec - a.totalSec);
    leaderboardTableBody.innerHTML = "";
    arr.forEach((item) => {
      const formattedTime = formatLeaderboardTime(item.totalSec);
      const row = document.createElement("tr");
      row.innerHTML = `<td>${item.user}</td><td>${formattedTime}</td>`;
      leaderboardTableBody.appendChild(row);
    });
  });
}

// Load streak from localStorage.
function loadStreak() {
  let streak = localStorage.getItem("streak") || 0;
  streakCounterEl.innerText = streak;
}

// Increase the streak only once per day.
function increaseStreak() {
  if (!localStorage.getItem("hasStudiedToday")) {
    let streak = parseInt(localStorage.getItem("streak")) || 0;
    streak++;
    localStorage.setItem("streak", streak);
    streakCounterEl.innerText = streak;
    localStorage.setItem("hasStudiedToday", "true");
  }
}

// Event Listeners

// Toggle timer only if username is set.
toggleTimerBtn.addEventListener("click", () => {
  if (!username) {
    alert("Please set your name first.");
    return;
  }
  checkDailyReset();
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

// Save Username: once set, disable changes.
saveUsernameBtn.addEventListener("click", () => {
  const inputName = usernameInput.value.trim();
  if (inputName) {
    username = inputName;
    localStorage.setItem("studyUsername", username);
    // Hide setup and show display
    userSetupDiv.style.display = "none";
    displayedUsernameEl.innerText = username;
    userDisplayDiv.style.display = "block";
    appContent.style.display = "block";
    loadLocalSessionLog();
    loadLeaderboard();
    loadStreak();
  } else {
    alert("Please enter a valid name.");
  }
});

// View Previous Day's Leaderboard (stub)
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

// On page load: restore timer state, check daily reset, and initialize data.
window.addEventListener("load", () => {
  const storedElapsed = parseInt(localStorage.getItem("elapsedTime"));
  if (!isNaN(storedElapsed)) {
    elapsedTime = storedElapsed;
    updateTimerDisplay();
  }
  if (localStorage.getItem("timerRunning") === "true") {
    isRunning = false;
    localStorage.setItem("timerRunning", "false");
    updateStatus("Paused");
    toggleTimerBtn.innerText = "Start";
  }
  checkDailyReset();
  loadLeaderboard();
  loadLocalSessionLog();
  loadStreak();
  displayRandomQuote();
  if (username) {
    userSetupDiv.style.display = "none";
    displayedUsernameEl.innerText = username;
    userDisplayDiv.style.display = "block";
    appContent.style.display = "block";
  } else {
    appContent.style.display = "none";
  }
});
