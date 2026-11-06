let isLoggedIn = false;
let currentUser = null;
let currentBalance = 0;
let isDemo = true;

const modal = document.getElementById('auth-modal');
const closeModal = document.getElementById('close-modal');
const showLogin = document.getElementById('show-login');
const showRegister = document.getElementById('show-register');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authSwitchText = document.getElementById('auth-switch-text');
let isLoginMode = true;

function openModal(loginMode) {
  isLoginMode = loginMode;
  modal.style.display = 'flex';
  if (isLoginMode) {
    authTitle.textContent = 'Login to SignalForge';
    authSubmit.textContent = 'Login';
    authSwitchText.innerHTML = 'Don\'t have an account? <span id="switch-to-register">Register</span>';
  } else {
    authTitle.textContent = 'Create an Account';
    authSubmit.textContent = 'Register';
    authSwitchText.innerHTML = 'Already have an account? <span id="switch-to-register">Login</span>';
  }
  document.getElementById('switch-to-register').addEventListener('click', () => openModal(!isLoginMode));
}

showLogin.addEventListener('click', () => openModal(true));
showRegister.addEventListener('click', () => openModal(false));
closeModal.addEventListener('click', () => modal.style.display = 'none');

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const endpoint = isLoginMode ? '/api/login' : '/api/register';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) return alert(data.error);

    if (!isLoginMode) {
      alert('Registration successful! Please log in.');
      openModal(true);
   } else {
  isLoggedIn = true;
  currentUser = data.email;
  currentBalance = data.demoBalance; 
  modal.style.display = 'none';
  
  // SWITCH FROM LIGHT LANDING PAGE TO DARK DASHBOARD
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('trading-dashboard').style.display = 'flex';
  
  // Update the balance in the top bar
  document.getElementById('nav-balance').textContent = '$' + parseFloat(data.demoBalance).toFixed(2);
  
  // Start the chart
  startChart();
}
    }
  } catch (err) {
    alert('Connection error.');
  }
});

function updateUI() {
  document.getElementById('live-price').textContent = currentPrice.toFixed(5);
}

// --- THE PRO CHART ENGINE ---
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');
let currentPrice = 1.0854;
let priceHistory = [];
let maxPoints = 100;
let lastTime = 0;
let updateInterval = 500; 

function resizeCanvas() {
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function generateNewPrice() {
  const volatility = 0.00015;
  const change = (Math.random() - 0.5) * volatility;
  currentPrice += change;
  
  priceHistory.push(currentPrice);
  if (priceHistory.length > maxPoints) priceHistory.shift();
}

for (let i = 0; i < maxPoints; i++) {
  generateNewPrice();
}

function drawChart(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const deltaTime = timestamp - lastTime;

  if (deltaTime > updateInterval) {
    generateNewPrice();
    updateUI();
    lastTime = timestamp;
  }

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // 1. DRAW RECTANGULAR GRID BOXES
  ctx.strokeStyle = '#e2e8f0'; 
  ctx.lineWidth = 1;
  
  const gridCols = 8;
  const gridRows = 6;
  const colWidth = w / gridCols;
  const rowHeight = h / gridRows;

  for (let i = 0; i <= gridCols; i++) {
    ctx.beginPath();
    ctx.moveTo(i * colWidth, 0);
    ctx.lineTo(i * colWidth, h);
    ctx.stroke();
  }
  for (let j = 0; j <= gridRows; j++) {
    ctx.beginPath();
    ctx.moveTo(0, j * rowHeight);
    ctx.lineTo(w, j * rowHeight);
    ctx.stroke();
  }

  if (priceHistory.length < 2) {
    requestAnimationFrame(drawChart);
    return;
  }

  // 2. MAP PRICES TO CANVAS
  const min = Math.min(...priceHistory);
  const max = Math.max(...priceHistory);
  const range = max - min || 0.0001;
  const padding = 20;

  const points = priceHistory.map((p, i) => ({
    x: (i / (maxPoints - 1)) * w,
    y: h - padding - ((p - min) / range) * (h - padding * 2)
  }));

  // 3. DRAW GRADIENT UNDER LINE
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(39, 119, 232, 0.2)'); 
  gradient.addColorStop(1, 'rgba(39, 119, 232, 0)');
  
  ctx.beginPath();
  ctx.moveTo(points[0].x, h);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, h);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // 4. DRAW SHARP ZIGZAG BLUE LINE
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y); 
  });
  ctx.strokeStyle = '#2777E8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 5. LIVE PRICE INDICATOR
  const lastPoint = points[points.length - 1];
  
  ctx.beginPath();
  ctx.setLineDash([5, 5]);
  ctx.moveTo(0, lastPoint.y);
  ctx.lineTo(w, lastPoint.y);
  ctx.strokeStyle = '#2777E8';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#2777E8';
  ctx.fill();

  requestAnimationFrame(drawChart);
}

requestAnimationFrame(drawChart);

document.getElementById('btn-buy').addEventListener('click', () => alert('BUY order placed (Simulation)'));
document.getElementById('btn-sell').addEventListener('click', () => alert('SELL order placed (Simulation)'));

document.getElementById('trade-amount').addEventListener('input', (e) => {
  const amt = parseFloat(e.target.value) || 0;
  document.getElementById('potential-profit').textContent = `$${(amt * 0.85).toFixed(2)}`;
});
// --- LOGOUT FUNCTION ---
function logout() {
  // Hide the dark dashboard
  document.getElementById('trading-dashboard').style.display = 'none';
  
  // Show the light landing page again
  document.getElementById('landing-page').style.display = 'flex';
  
  // Reset the login state
  isLoggedIn = false;
  currentUser = null;
}
