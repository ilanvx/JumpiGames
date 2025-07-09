// Registration Flow Variables
let selectedSkinColor = null;
let selectedShirt = null;
let selectedPants = null;
let currentStep = 1;

// DOM Elements
const skinOptions = document.getElementById('skinOptions');
const shirtOptions = document.getElementById('shirtOptions');
const pantsOptions = document.getElementById('pantsOptions');
const continueBtn = document.getElementById('continueBtn');
const continueBtn2 = document.getElementById('continueBtn2');
const continueBtn3 = document.getElementById('continueBtn3');
const detailsForm = document.getElementById('detailsForm');
const submitBtn = document.getElementById('submitBtn');

// Item metadata and offsets
let itemOffsets = {};
let itemsMetadata = {};

// Available items
const SKIN_COLORS = [null, 2, 3, 4, 5, 7]; // null = default blue
const SHIRTS = [3, 4, 5, 6, 7];
const PANTS = [1, 2, 4, 5, 6, 7, 8];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  loadItemsMetadata();
  loadItemOffsets();
  renderSkinOptions();
  setupEventListeners();
  updateStepper();
});

// Load metadata
async function loadItemsMetadata() {
  try {
    const response = await fetch('/api/items');
    itemsMetadata = await response.json();
  } catch (e) { 
    itemsMetadata = {}; 
  }
}

async function loadItemOffsets() {
  try {
    const response = await fetch('/api/item-offsets');
    const data = await response.json();
    if (data.success) {
      itemOffsets = data.offsets || {};
    } else {
      itemOffsets = {};
    }
  } catch (e) { 
    console.error('Error loading item offsets:', e);
    itemOffsets = {}; 
  }
}

// Canvas preview setup
function setupCanvasPreview(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  
  // Clear existing content
  container.innerHTML = '';
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 100;
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  container.appendChild(canvas);
  
  return canvas;
}

// Get item offset
function getItemOffset(cat, itemId) {
  const previewDirection = 'front';
  let offset = { x: 0, y: 0, width: 1, height: 1 };
  
  if (itemOffsets && itemOffsets[cat] && itemOffsets[cat][itemId] && itemOffsets[cat][itemId][previewDirection]) {
    offset = { ...offset, ...itemOffsets[cat][itemId][previewDirection] };
  } else if (itemsMetadata && itemsMetadata[cat] && itemsMetadata[cat][itemId] && itemsMetadata[cat][itemId].offsets && itemsMetadata[cat][itemId].offsets[previewDirection]) {
    offset = { ...offset, ...itemsMetadata[cat][itemId].offsets[previewDirection] };
  }
  
  offset.width = offset.width || 1;
  offset.height = offset.height || 1;
  offset.x = offset.x || 0;
  offset.y = offset.y || 0;
  return offset;
}

// Draw preview
function drawPreview(canvas) {
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const charX = (canvas.width - 55) / 2;
  const charY = (canvas.height - 70) / 2;
  
  // Draw base character
  const baseImg = new Image();
  baseImg.onload = function() {
    ctx.drawImage(baseImg, charX, charY, 55, 70);
    drawSkin(ctx, charX, charY);
  };
  baseImg.src = 'assets/character_down.png';
  
  function drawSkin(ctx, charX, charY) {
    if (selectedSkinColor !== null && selectedSkinColor !== undefined) {
      const img = new Image();
      img.onload = function() {
        const offset = getItemOffset('hd', selectedSkinColor);
        ctx.drawImage(img, charX + offset.x, charY + offset.y, 55 * offset.width, 70 * offset.height);
        drawPants(ctx, charX, charY);
      };
      img.onerror = () => drawPants(ctx, charX, charY);
      img.src = `/items/hd/${selectedSkinColor}/front.png`;
    } else {
      drawPants(ctx, charX, charY);
    }
  }
  
  function drawPants(ctx, charX, charY) {
    if (selectedPants) {
      const img = new Image();
      img.onload = function() {
        const offset = getItemOffset('ps', selectedPants);
        ctx.drawImage(img, charX + offset.x, charY + offset.y, 55 * offset.width, 70 * offset.height);
        drawShirt(ctx, charX, charY);
      };
      img.onerror = () => drawShirt(ctx, charX, charY);
      img.src = `/items/ps/${selectedPants}/front.png`;
    } else {
      drawShirt(ctx, charX, charY);
    }
  }
  
  function drawShirt(ctx, charX, charY) {
    if (selectedShirt) {
      const img = new Image();
      img.onload = function() {
        const offset = getItemOffset('st', selectedShirt);
        ctx.drawImage(img, charX + offset.x, charY + offset.y, 55 * offset.width, 70 * offset.height);
      };
      img.src = `/items/st/${selectedShirt}/front.png`;
    }
  }
}

// Update all previews
function updateAllPreviews() {
  const previews = ['characterPreview', 'characterPreview2', 'characterPreview3'];
  previews.forEach(id => {
    const canvas = setupCanvasPreview(id);
    if (canvas) drawPreview(canvas);
  });
}

// Render skin options
function renderSkinOptions() {
  if (!skinOptions) return;
  
  skinOptions.innerHTML = '';
  SKIN_COLORS.forEach(id => {
    const option = document.createElement('div');
    option.className = 'skin-option';
    option.tabIndex = 0;
    
    if (id === null) {
      option.title = 'דמות כחולה (ברירת מחדל)';
      const img = document.createElement('img');
      img.src = 'assets/character_down.png';
      img.alt = 'דמות כחולה';
      option.appendChild(img);
      if (selectedSkinColor === null) option.classList.add('selected');
      option.onclick = () => selectSkinColor(null);
      option.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') selectSkinColor(null); };
    } else {
      option.title = `צבע גוף #${id}`;
      const img = document.createElement('img');
      img.src = `/items/hd/${id}/front.png`;
      img.alt = `Skin color ${id}`;
      option.appendChild(img);
      if (selectedSkinColor === id) option.classList.add('selected');
      option.onclick = () => selectSkinColor(id);
      option.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') selectSkinColor(id); };
    }
    skinOptions.appendChild(option);
  });
}

// Select skin color
function selectSkinColor(id) {
  selectedSkinColor = id;
  renderSkinOptions();
  continueBtn.disabled = false;
  updateAllPreviews();
}

// Render shirt options
function renderShirtOptions() {
  if (!shirtOptions) return;
  
  shirtOptions.innerHTML = '';
  SHIRTS.forEach(id => {
    const option = document.createElement('div');
    option.className = 'skin-option';
    option.tabIndex = 0;
    option.title = `חולצה #${id}`;
    
    const img = document.createElement('img');
    img.src = `/items/st/${id}/front.png`;
    img.alt = `Shirt ${id}`;
    option.appendChild(img);
    
    if (selectedShirt === id) option.classList.add('selected');
    option.onclick = () => selectShirt(id);
    option.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') selectShirt(id); };
    shirtOptions.appendChild(option);
  });
}

// Select shirt
function selectShirt(id) {
  selectedShirt = id;
  renderShirtOptions();
  continueBtn2.disabled = false;
  updateAllPreviews();
}

// Render pants options
function renderPantsOptions() {
  if (!pantsOptions) return;
  
  pantsOptions.innerHTML = '';
  PANTS.forEach(id => {
    const option = document.createElement('div');
    option.className = 'skin-option';
    option.tabIndex = 0;
    option.title = `מכנסיים #${id}`;
    
    const img = document.createElement('img');
    img.src = `/items/ps/${id}/front.png`;
    img.alt = `Pants ${id}`;
    option.appendChild(img);
    
    if (selectedPants === id) option.classList.add('selected');
    option.onclick = () => selectPants(id);
    option.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') selectPants(id); };
    pantsOptions.appendChild(option);
  });
}

// Select pants
function selectPants(id) {
  selectedPants = id;
  renderPantsOptions();
  continueBtn3.disabled = false;
  updateAllPreviews();
}

// Navigation functions
function goToStep(step) {
  // Hide all steps
  document.querySelectorAll('.register-step').forEach(el => {
    el.classList.remove('active');
  });
  
  // Show current step
  const currentStepEl = document.getElementById(`step${step}`);
  if (currentStepEl) {
    currentStepEl.classList.add('active');
  }
  
  currentStep = step;
  updateStepper();
  
  // Update title and content based on step
  switch(step) {
    case 1:
      document.querySelector('.register-title').textContent = 'שלב 1: בחר צבע גוף לדמות שלך';
      break;
    case 2:
      document.querySelector('.register-title').textContent = 'שלב 2: בחר חולצה';
      renderShirtOptions();
      break;
    case 3:
      document.querySelector('.register-title').textContent = 'שלב 3: בחר מכנסיים';
      renderPantsOptions();
      break;
    case 4:
      document.querySelector('.register-title').textContent = 'שלב 4: פרטי משתמש';
      detailsForm.classList.add('active');
      break;
    case 5:
      document.querySelector('.register-title').textContent = 'הרשמה הושלמה!';
      renderSuccessCharacter();
      showConfetti();
      setTimeout(() => {
        window.location.href = '/';
      }, 5000);
      break;
  }
  
  updateAllPreviews();
}

// Setup event listeners
function setupEventListeners() {
  // Continue buttons
  if (continueBtn) {
    continueBtn.addEventListener('click', () => goToStep(2));
  }
  
  if (continueBtn2) {
    continueBtn2.addEventListener('click', () => goToStep(3));
  }
  
  if (continueBtn3) {
    continueBtn3.addEventListener('click', () => goToStep(4));
  }
  
  // Form submission
  if (detailsForm) {
    detailsForm.addEventListener('submit', handleFormSubmit);
  }
  
  // Form validation
  const inputs = document.querySelectorAll('.reg-input');
  inputs.forEach(input => {
    input.addEventListener('input', validateForm);
    input.addEventListener('blur', validateForm);
  });
  
  const termsCheckbox = document.getElementById('regTerms');
  if (termsCheckbox) {
    termsCheckbox.addEventListener('change', validateForm);
  }
}

// Form validation
function validateForm() {
  const username = document.getElementById('regUsername');
  const email = document.getElementById('regEmail');
  const password = document.getElementById('regPassword');
  const password2 = document.getElementById('regPassword2');
  const terms = document.getElementById('regTerms');
  
  let isValid = true;
  
  // Username validation
  if (username && username.value.length < 3) {
    username.classList.add('error');
    isValid = false;
  } else if (username) {
    username.classList.remove('error');
  }
  
  // Email validation
  if (email && !email.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    email.classList.add('error');
    isValid = false;
  } else if (email) {
    email.classList.remove('error');
  }
  
  // Password validation
  if (password && password.value.length < 6) {
    password.classList.add('error');
    isValid = false;
  } else if (password) {
    password.classList.remove('error');
  }
  
  // Password confirmation
  if (password2 && password2.value !== password.value) {
    password2.classList.add('error');
    isValid = false;
  } else if (password2) {
    password2.classList.remove('error');
  }
  
  // Terms validation
  if (terms && !terms.checked) {
    isValid = false;
  }
  
  if (submitBtn) {
    submitBtn.disabled = !isValid;
  }
  
  return isValid;
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();
  
  if (!validateForm()) {
    showToast('אנא מלא/י את כל השדות הנדרשים', 'error');
    return;
  }
  
  const formData = {
    username: document.getElementById('regUsername').value,
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPassword').value,
    skinColor: selectedSkinColor,
    shirt: selectedShirt,
    pants: selectedPants
  };
  
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      showToast('ההרשמה בוצעה בהצלחה!', 'success');
      goToStep(5);
    } else {
      const error = await response.json();
      showToast(error.message || 'שגיאה בהרשמה', 'error');
    }
  } catch (error) {
    showToast('שגיאה בחיבור לשרת', 'error');
  }
}

// Render success character
function renderSuccessCharacter() {
  const successPreview = document.getElementById('successCharacterPreview');
  if (!successPreview) return;
  
  const canvas = setupCanvasPreview('successCharacterPreview');
  if (canvas) drawPreview(canvas);
}

// Show confetti
function showConfetti() {
  const confetti = document.getElementById('confetti');
  if (!confetti) return;
  
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.style.position = 'absolute';
    particle.style.width = '10px';
    particle.style.height = '10px';
    particle.style.background = `hsl(${Math.random() * 360}, 70%, 50%)`;
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = '-10px';
    particle.style.borderRadius = '50%';
    particle.style.animation = `fall ${Math.random() * 3 + 2}s linear forwards`;
    confetti.appendChild(particle);
  }
  
  // Add fall animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fall {
      to {
        transform: translateY(100vh) rotate(360deg);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// Update stepper
function updateStepper() {
  const steps = document.querySelectorAll('.step');
  steps.forEach((step, index) => {
    const stepNum = index + 1;
    step.classList.remove('active', 'completed');
    
    if (stepNum === currentStep) {
      step.classList.add('active');
    } else if (stepNum < currentStep) {
      step.classList.add('completed');
    }
  });
}

// Toast notification
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Initialize previews
updateAllPreviews();