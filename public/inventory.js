// inventory.js - ניהול סל חפצים וציור פריטים + ציור כפתורי 🧺 🎁

let inventoryData = {};
const itemImageCache = {};

// Load item offsets
async function loadItemOffsets() {
  try {
    const response = await fetch('/api/item-offsets');
    const data = await response.json();
    if (data.success) {
      window.itemOffsets = data.offsets;
    }
  } catch (error) {
    console.error('Error loading item offsets:', error);
    window.itemOffsets = {};
  }
}

// Load offsets when the script loads
loadItemOffsets();

// קישור למשתנים גלובליים מתוך הקובץ הראשי אם קיימים
const canvas = window.canvas || document.getElementById('gameCanvas');
const ctx = window.ctx || (canvas ? canvas.getContext('2d') : null);
const players = window.players || {};
const toolbarButtons = window.toolbarButtons || {};
window.triggerBounce = window.triggerBounce || function () {};

socket.on('updateInventory', (inv) => {
  inventoryData = inv;
});

// Define the drawing order for equipped items
// Note: "hd" (skin color) and "sk" (skateboard) are drawn BEFORE the base character
const ITEM_DRAW_ORDER = ["hd", "sk", "st", "ps", "nk", "hr", "gs", "ht"];

function drawItems(p) {
  if (!p.equipped || !ctx) return;
  
  // Map old direction names to new ones
  let dir = p.direction;
  if (dir === 'up') dir = 'back';
  if (dir === 'down') dir = 'front';
  
  console.log(`=== Drawing items for player at world coordinates X=${p.x} Y=${p.y} ===`);
  
  // 1. Draw skateboard (sk) - before base character
  if (p.equipped.sk) {
    const skateboardItemId = p.equipped.sk;
    
    // Check if the direction image exists, fallback to 'front' if not
    let availableDir = dir;
    const skateboardImagePath = `items/sk/${skateboardItemId}/${availableDir}.png`;
    
    console.log(`Loading skateboard image: ${skateboardImagePath}`);
    
    const skateboardImage = new Image();
    skateboardImage.onload = function() {
      console.log(`✅ Skateboard image loaded successfully: ${skateboardImagePath}`);
      
      // Load offset data for this item
      const offsetData = window.itemOffsets?.sk?.[skateboardItemId]?.[availableDir];
      const x = (offsetData?.x || 0) - 27.5;
      const y = (offsetData?.y || 0);
      const width = (offsetData?.width || 1) * 55;
      const height = (offsetData?.height || 1) * 70; // No breathing animation for equipped items
      
      // Log for debugging with world coordinates
      const worldX = p.x + x;
      const worldY = p.y - 35 + y;
      console.log(`🛹 Drawing SKATEBOARD sk:${skateboardItemId} with direction ${availableDir} at world coordinates X=${worldX} Y=${worldY} with width=${width}, height=${height}`);
      
      ctx.drawImage(skateboardImage, x, y, width, height);
    };
    
    skateboardImage.onerror = function() {
      console.error(`❌ Skateboard image failed to load: ${skateboardImagePath}`);
      // Try fallback to 'front' direction
      if (availableDir !== 'front') {
        availableDir = 'front';
        const fallbackPath = `items/sk/${skateboardItemId}/${availableDir}.png`;
        console.log(`Trying fallback skateboard image: ${fallbackPath}`);
        
        const fallbackImg = new Image();
        fallbackImg.onload = function() {
          console.log(`✅ Fallback skateboard image loaded successfully: ${fallbackPath}`);
          
          // Load offset data for this item
          const offsetData = window.itemOffsets?.sk?.[skateboardItemId]?.[availableDir];
          const x = (offsetData?.x || 0) - 27.5;
          const y = (offsetData?.y || 0);
          const width = (offsetData?.width || 1) * 55;
          const height = (offsetData?.height || 1) * 70;
          
          // Log for debugging with world coordinates
          const worldX = p.x + x;
          const worldY = p.y - 35 + y;
          console.log(`🛹 Drawing FALLBACK SKATEBOARD sk:${skateboardItemId} with direction ${availableDir} at world coordinates X=${worldX} Y=${worldY} with width=${width}, height=${height}`);
          
          ctx.drawImage(fallbackImg, x, y, width, height);
        };
        
        fallbackImg.onerror = function() {
          console.error(`❌ Fallback skateboard image also failed to load: ${fallbackPath}`);
        };
        
        fallbackImg.src = fallbackPath;
      }
    };
    
    skateboardImage.src = skateboardImagePath;
  }
  
  // Note: Base character sprite (including skin color) is drawn in the main game loop
  // The main game loop now handles using skin color as the base character sprite
  
  // 2. Draw other equipped items AFTER the base character (this function is called after base character)
  for (const cat of ["st", "ps", "nk", "hr", "gs", "ht"]) {
    const id = p.equipped[cat];
    if (!id) continue;
    
    // Check if the direction image exists, fallback to 'front' if not
    let availableDir = dir;
    const path = `items/${cat}/${id}/${availableDir}.png`;
    
    if (!itemImageCache[path]) {
      const img = new Image();
      img.src = path;
      
      // Handle image load errors gracefully
      img.onerror = () => {
        console.warn(`Failed to load image for ${cat}:${id}:${availableDir}, trying 'front' as fallback`);
        if (availableDir !== 'front') {
          availableDir = 'front';
          const fallbackPath = `items/${cat}/${id}/${availableDir}.png`;
          if (!itemImageCache[fallbackPath]) {
            const fallbackImg = new Image();
            fallbackImg.src = fallbackPath;
            itemImageCache[fallbackPath] = fallbackImg;
          }
        }
      };
      
      itemImageCache[path] = img;
    }
    const img = itemImageCache[path];
    
    if (img.complete && img.naturalHeight > 0) {
      // Load offset data for this item
      const offsetData = window.itemOffsets?.[cat]?.[id]?.[availableDir];
      const x = (offsetData?.x || 0) - 27.5;
      const y = (offsetData?.y || 0);
      const width = (offsetData?.width || 1) * 55;
      const height = (offsetData?.height || 1) * 70; // No breathing animation for equipped items
      
      // Log for debugging with world coordinates
      const worldX = p.x + x;
      const worldY = p.y - 35 + y;
      console.log(`👕 Drawing ${cat.toUpperCase()} item ${id} with direction ${availableDir} at world coordinates X=${worldX} Y=${worldY} with width=${width}, height=${height}`);
      
      ctx.drawImage(img, x, y, width, height);
    }
  }
  
  console.log(`=== Finished drawing items for player ===`);
}

function showInventory() {
  let panel = document.getElementById('inventoryPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'inventoryPanel';
    panel.style.cssText = `
      display: none;
      position: absolute;
      top: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 0 30px rgba(0,0,0,0.3);
      z-index: 10;
      max-width: 600px;
      text-align: center;
    `;
    panel.innerHTML = `
      <h3>🎒 סל החפצים שלך</h3>
      <div id="inventoryItems" style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;"></div>
      <button onclick="document.getElementById('inventoryPanel').style.display='none'" style="margin-top: 20px; padding: 10px 20px; border: none; background: #00aaff; color: white; border-radius: 10px; font-size: 16px; cursor: pointer;">סגור</button>
    `;
    document.body.appendChild(panel);
  }
  const container = document.getElementById('inventoryItems');
  container.innerHTML = '';
  for (const cat in inventoryData) {
    for (const id of inventoryData[cat]) {
      const btn = document.createElement('button');
      btn.innerText = `${cat}/${id}`;
      btn.style.margin = '5px';
      btn.onclick = () => socket.emit('equipItem', { category: cat, itemId: id });
      container.appendChild(btn);
    }
  }
  panel.style.display = 'block';
}

function openItemPanel() {
  if (document.getElementById('itemAdmin')) return;
  const html = `
    <div id="itemAdmin" style="position:fixed; top:50px; left:50%; transform:translateX(-50%); background:#fff;
      border-radius:10px; box-shadow:0 0 30px rgba(0,0,0,0.3); padding:20px; z-index:1000;">
      <h3>📦 שליחת פריט</h3>
      <input id="give_user" placeholder="שם משתמש" style="width:100%;margin-bottom:10px"/>
      <input id="give_cat" placeholder="קטגוריה (ht)" style="width:100%;margin-bottom:10px"/>
      <input id="give_id" placeholder="מספר פריט (למשל 1)" style="width:100%;margin-bottom:10px"/>
      <button onclick="sendItem()">שלח</button>
      <button onclick="document.getElementById('itemAdmin').remove()">סגור</button>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function sendItem() {
  const username = document.getElementById('give_user').value;
  const category = document.getElementById('give_cat').value;
  const itemId = parseInt(document.getElementById('give_id').value);
  if (!username || !category || isNaN(itemId)) return alert('נא למלא את כל השדות');
  socket.emit('adminGiveItem', { username, category, itemId });
  alert('הפריט נשלח!');
  document.getElementById('itemAdmin').remove();
}

if (typeof drawToolbar === 'function') {
  const originalDrawToolbar = drawToolbar;
  drawToolbar = function () {
    originalDrawToolbar();
    const currentPlayer = players[socket.id];
    const isAdmin = !!currentPlayer?.isAdmin;
    const barHeight = 60, barY = canvas.height - barHeight;
    const inputW = 400, inputH = 40, inputX = canvas.width/2 - inputW/2, inputY = barY + 10;

    toolbarButtons.bag = { x: inputX - 160, y: inputY, w: 40, h: 40 };
    ctx.fillStyle = '#eee';
    ctx.roundRect(toolbarButtons.bag.x, inputY, 40, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧺', toolbarButtons.bag.x + 20, inputY + 20);

    if (isAdmin) {
      toolbarButtons.itemsend = { x: inputX + inputW + 150, y: inputY, w: 40, h: 40 };
      ctx.fillStyle = '#eee';
      ctx.roundRect(toolbarButtons.itemsend.x, inputY, 40, 40, 10);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.font = '20px Arial';
      ctx.fillText('🎁', toolbarButtons.itemsend.x + 20, inputY + 20);
    }
  }
}

if (canvas && typeof canvas.addEventListener === 'function') {
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (inButton(x, y, toolbarButtons.bag)) {
      showInventory();
      triggerBounce('bag');
    }
    if (inButton(x, y, toolbarButtons.itemsend)) {
      openItemPanel();
      triggerBounce('itemsend');
    }
  });
}