// Connect to Render backend
const BACKEND_URL = "https://sheat-iot-backend.onrender.com";
const socket = io(BACKEND_URL);

let currentUser = null;

// ---------------- SIGN UP ----------------
async function signup() {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  try {
    await firebase.auth().createUserWithEmailAndPassword(email, pass);
    document.getElementById("authMsg").innerText =
      "Signup successful. Please log in.";
  } catch (err) {
    document.getElementById("authMsg").innerText = err.message;
  }
}

// ---------------- LOGIN ----------------
async function login() {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  try {
    const result = await firebase.auth().signInWithEmailAndPassword(email, pass);
    currentUser = result.user;

    // Optional: tell backend user connected
    socket.emit("auth-uid", currentUser.uid);

    document.getElementById("authBox").style.display = "none";
    document.getElementById("deviceBox").style.display = "block";
  } catch (err) {
    document.getElementById("authMsg").innerText = err.message;
  }
}

// ---------------- CLAIM DEVICE ----------------
async function claimDevice() {
  if (!currentUser) {
    alert("Please login first");
    return;
  }

  const deviceId = document.getElementById("deviceId").value.trim();
  if (!deviceId) {
    alert("Enter a device ID");
    return;
  }

  try {
    const token = await currentUser.getIdToken();

    const res = await fetch(`${BACKEND_URL}/claim-device`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ deviceId }),
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Failed to claim device");
      return;
    }

    alert("Device claimed successfully!");
    startListening(deviceId);
  } catch (err) {
    alert("Network error while claiming device");
    console.error(err);
  }
}

// ---------------- LISTEN FOR LIVE SENSOR DATA ----------------
function startListening(deviceId) {
  document.getElementById("liveTitle").innerText =
    "Live Data for Device: " + deviceId;

  socket.off(`update-${deviceId}`); // prevent duplicate listeners

  socket.on(`update-${deviceId}`, (data) => {
    document.getElementById("temp").innerText = data.temperature ?? "--";
    document.getElementById("hum").innerText = data.humidity ?? "--";
    document.getElementById("h2").innerText = data.h2_ppm ?? "--";
    document.getElementById("co").innerText = data.co_ppm ?? "--";
    document.getElementById("ch4").innerText = data.ch4_ppm ?? "--";
    document.getElementById("aqi").innerText = data.aqi ?? "--";
  });
}
