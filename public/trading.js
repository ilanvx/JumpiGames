// trading.js - Jumpi Trading System Module
// All trading-related logic, UI, and event handlers are encapsulated here.

(function(window) {
    // --- Trading State ---
    let tradeRequests = [];
    let activeTrade = null;
    let tradeListenersInitialized = false;

    // --- DOM Elements ---
    let tradeRequestsPanel = null;
    let tradeWindow = null;

    // --- Outgoing Trade Requests Panel ---
    let outgoingTradeRequests = [];
    let outgoingTradePanel = null;

    // --- Public API ---
    const Trading = {
        sendTradeRequest,
        openTradeWindow,
        cancelTradeRequest,
        declineTradeRequest,
        acceptTradeRequest,
        lockTradeOffer,
        unlockTradeOffer,
        confirmTrade,
        initTradingSystem
    };

    // --- Initialization ---
    function initTradingSystem() {
        if (tradeListenersInitialized) return;
        tradeListenersInitialized = true;
        injectTradingCSS();
        createTradeRequestsPanel();
        setupSocketListeners();
    }

    // --- UI Creation ---
    function createTradeRequestsPanel() {
        // Create the trade requests panel (top-left corner)
        tradeRequestsPanel = document.createElement('div');
        tradeRequestsPanel.id = 'tradeRequestsPanel';
        tradeRequestsPanel.style.position = 'fixed';
        tradeRequestsPanel.style.top = '70px';
        tradeRequestsPanel.style.left = '20px';
        tradeRequestsPanel.style.zIndex = '1200';
        tradeRequestsPanel.style.display = 'flex';
        tradeRequestsPanel.style.flexDirection = 'column';
        tradeRequestsPanel.style.gap = '8px';
        document.body.appendChild(tradeRequestsPanel);
        renderTradeRequests();
    }

    function renderTradeRequests() {
        if (!tradeRequestsPanel) return;
        tradeRequestsPanel.innerHTML = '';
        tradeRequests.forEach(req => {
            const tile = document.createElement('div');
            tile.className = 'trade-request-tile';
            tile.style.display = 'flex';
            tile.style.alignItems = 'center';
            tile.style.background = 'rgba(255,255,255,0.92)';
            tile.style.borderRadius = '10px';
            tile.style.boxShadow = '0 2px 8px rgba(120,144,255,0.13)';
            tile.style.padding = '8px 12px';
            tile.style.gap = '10px';
            tile.style.minWidth = '120px';
            tile.style.fontWeight = 'bold';
            tile.innerHTML = `
                <span style="color:#4b3869;">${req.senderName}</span>
                <button class="accept-btn" title="Accept" style="background:#4fd18b;color:white;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:1.1em;">✔️</button>
                <button class="decline-btn" title="Decline" style="background:#ffb347;color:white;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:1.1em;">❌</button>
            `;
            tile.querySelector('.accept-btn').onclick = () => acceptTradeRequest(req.senderId);
            tile.querySelector('.decline-btn').onclick = () => declineTradeRequest(req.senderId);
            tradeRequestsPanel.appendChild(tile);
        });
        tradeRequestsPanel.style.display = tradeRequests.length > 0 ? 'flex' : 'none';
    }

    // --- Trade Window UI ---
    function openTradeWindow(tradeData) {
        // Remove any existing trade window
        if (tradeWindow) tradeWindow.remove();
        tradeWindow = document.createElement('div');
        tradeWindow.id = 'tradeWindow';
        tradeWindow.style.position = 'fixed';
        tradeWindow.style.top = '50%';
        tradeWindow.style.left = '50%';
        tradeWindow.style.transform = 'translate(-50%, -50%)';
        tradeWindow.style.background = 'white';
        tradeWindow.style.borderRadius = '18px';
        tradeWindow.style.boxShadow = '0 8px 32px rgba(120,144,255,0.18)';
        tradeWindow.style.zIndex = '10000';
        tradeWindow.innerHTML = renderTradeWindowHTML(tradeData);
        document.body.appendChild(tradeWindow);
        setupTradeWindowEventListeners(tradeData);
        setTimeout(() => {
            if (lastYourBubble && document.getElementById('yourTradeBubble')) document.getElementById('yourTradeBubble').innerHTML = lastYourBubble;
            if (lastTheirBubble && document.getElementById('theirTradeBubble')) document.getElementById('theirTradeBubble').innerHTML = lastTheirBubble;
        }, 0);
        // Remove any previous status bar
        const oldBar = document.getElementById('tradeStatusBar');
        if (oldBar) oldBar.remove();
    }

    function renderTradeWindowHTML(tradeData) {
        // tradeData: { your, their, locked, confirmed, usernames, ... }
        // Show inventory for item selection
        const yourName = tradeData?.yourName || 'You';
        const theirName = tradeData?.theirName || 'Other';
        const yourSlots = tradeData?.yourOffer || [];
        const theirSlots = tradeData?.theirOffer || [];
        const yourLocked = tradeData?.yourLocked || false;
        const theirLocked = tradeData?.theirLocked || false;
        const yourConfirmed = tradeData?.yourConfirmed || false;
        const theirConfirmed = tradeData?.theirConfirmed || false;
        const inventory = window.players?.[window.socket.id]?.inventory || {};
        const currentCategory = tradeData?.currentCategory || 'ht';
        const yourPlayer = window.players?.[window.socket.id];
        const theirPlayer = window.players?.[tradeData?.theirId];
        const chatMessages = tradeData?.chatMessages || [];
        const isYouAdmin = window.players?.[window.socket.id]?.isAdmin;
        const isTheirAdmin = window.players?.[tradeData?.theirId]?.isAdmin;
        return `
            <div style="width:800px;max-height:500px;overflow-y:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:0 16px;position:relative;">
                    <div style="display:flex;flex-direction:column;align-items:center;position:relative;">
                        <div style="font-weight:bold;font-size:1em;margin-bottom:6px;">${theirName}</div>
                        <canvas id="theirTradeAvatar" width="70" height="90" style="border-radius:8px;background:#f3f3f3;border:2px solid #ddd;"></canvas>
                        <div id="theirTradeBubble" style="position:absolute;right:-120px;top:20px;z-index:2;">${lastTheirBubble}</div>
                        ${isTheirAdmin ? '<div style=\"position:absolute;left:50%;top:100px;transform:translateX(-50%);background:#e74c3c;color:white;padding:4px 12px;border-radius:14px;font-size:0.85em;font-weight:bold;box-shadow:0 2px 8px rgba(231,76,60,0.13);\">מנהל</div>' : ''}
                    </div>
                    <div style="font-size:1.5em;color:#4fd18b;">⇄</div>
                    <div style="display:flex;flex-direction:column;align-items:center;position:relative;">
                        <div style="font-weight:bold;font-size:1em;margin-bottom:6px;">${yourName}</div>
                        <canvas id="yourTradeAvatar" width="70" height="90" style="border-radius:8px;background:#f3f3f3;border:2px solid #ddd;"></canvas>
                        <div id="yourTradeBubble" style="position:absolute;left:-120px;top:20px;z-index:2;">${lastYourBubble}</div>
                        ${isYouAdmin ? '<div style=\"position:absolute;left:50%;top:100px;transform:translateX(-50%);background:#e74c3c;color:white;padding:4px 12px;border-radius:14px;font-size:0.85em;font-weight:bold;box-shadow:0 2px 8px rgba(231,76,60,0.13);\">מנהל</div>' : ''}
                    </div>
                </div>
                <div style="display:flex;gap:16px;">
                    <div style="flex:1;display:flex;flex-direction:column;align-items:center;">
                        <div style="font-weight:bold;font-size:1em;margin-bottom:6px;">הצעה שלהם</div>
                        <div class="trade-slots" id="theirTradeSlots" style="display:grid;grid-template-columns:repeat(3,50px);gap:6px;margin-bottom:8px;">
                            ${renderTradeSlots(theirSlots, false, theirLocked)}
                        </div>
                        <button id="unlockOfferBtn" style="background:${theirLocked ? '#aaa' : '#ffb347'};color:white;border:none;border-radius:6px;padding:5px 12px;font-size:0.9em;cursor:pointer;" disabled>🔒 נעול</button>
                    </div>
                    <div style="flex:1;display:flex;flex-direction:column;align-items:center;">
                        <div style="font-weight:bold;font-size:1em;margin-bottom:6px;">הצעה שלך</div>
                        <div class="trade-slots" id="yourTradeSlots" style="display:grid;grid-template-columns:repeat(3,50px);gap:6px;margin-bottom:8px;">
                            ${renderTradeSlots(yourSlots, true, yourLocked)}
                        </div>
                        <button id="lockOfferBtn" style="background:${yourLocked ? '#aaa' : '#4fd18b'};color:white;border:none;border-radius:6px;padding:5px 12px;font-size:0.9em;cursor:pointer;">${yourLocked ? '🔒 נעול' : '🔓 נעל'}</button>
                    </div>
                    <div style="flex:1;display:flex;flex-direction:column;align-items:center;">
                        <div style="font-weight:bold;margin-bottom:6px;font-size:1em;">החפצים שלך</div>
                        <div id="tradeCategoryTabs" style="display:flex;justify-content:center;gap:4px;margin-bottom:8px;flex-wrap:wrap;">
                            ${renderTradeCategoryTabs(currentCategory)}
                        </div>
                        <div id="tradeInventory" style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-width:240px;max-height:150px;overflow-y:auto;">
                            ${renderInventoryItems(inventory, yourSlots, yourLocked, currentCategory)}
                        </div>
                    </div>
                </div>
                <div style="margin:16px 0 0 0;border-top:1px solid #eee;padding-top:12px;">
                    <div style="display:flex;gap:6px;justify-content:center;align-items:center;">
                        <input type="text" id="tradeChatInput" placeholder="הקלד הודעה..." style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:0.9em;">
                        <button id="sendTradeChatBtn" style="background:#4fd18b;color:white;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:0.9em;">שלח</button>
                    </div>
                </div>
                <div style="display:flex;justify-content:center;align-items:center;gap:16px;margin-top:16px;">
                    <button id="cancelTradeBtn" style="background:#ff6b6b;color:white;border:none;border-radius:6px;padding:6px 18px;font-size:1em;cursor:pointer;">ביטול</button>
                    <button id="confirmTradeBtn" style="background:${yourLocked ? '#4fd18b' : '#aaa'};color:white;border:none;border-radius:6px;padding:6px 18px;font-size:1em;cursor:pointer;" ${yourLocked ? '' : 'disabled'}>אישור</button>
                </div>
            </div>
        `;
    }

    function renderTradeSlots(slots, isYours, locked) {
        let html = '';
        for (let i = 0; i < 9; i++) {
            const item = slots[i];
            const slotStyle = `width:50px;height:50px;border:2px solid ${locked ? '#ccc' : '#ddd'};border-radius:6px;background:${item ? '#f0f8ff' : '#f9f9f9'};display:flex;align-items:center;justify-content:center;cursor:${locked ? 'default' : 'pointer'};`;
            html += `<div class="trade-slot" style="${slotStyle}">${item ? `<img src="/items/${item.cat}/${item.id}/front.png" style="max-width:40px;max-height:40px;" />` : ''}</div>`;
        }
        return html;
    }
    function renderTradeCategoryTabs(currentCategory) {
        const categories = {
            ht: '🎩', st: '👕', ps: '👖', nk: '👟', gs: '🕶️', hd: '🎨', sk: '🛹', hr: '💇‍♂️'
        };
        let html = '';
        Object.entries(categories).forEach(([cat, emoji]) => {
            const isSelected = cat === currentCategory;
            html += `<button class="trade-cat-tab" data-cat="${cat}" style="width:32px;height:32px;border-radius:6px;border:2px solid ${isSelected ? '#4fd18b' : '#bbb'};background:${isSelected ? '#4fd18b' : '#f9f9f9'};color:${isSelected ? 'white' : '#333'};cursor:pointer;font-size:1em;display:flex;align-items:center;justify-content:center;">${emoji}</button>`;
        });
        return html;
    }
    function renderInventoryItems(inventory, yourSlots, locked, currentCategory) {
        // Show items from current category only
        const items = inventory[currentCategory] || [];
        if (items.length === 0) {
            return '<div style="color:#888;font-size:12px;text-align:center;width:100%;">אין לך פריטים בקטגוריה זו</div>';
        }
        let html = '';
        items.forEach(itemId => {
            const inTrade = yourSlots.some(slot => slot && slot.cat === currentCategory && slot.id === itemId);
            html += `<div class="trade-inv-item" data-cat="${currentCategory}" data-id="${itemId}" style="width:40px;height:40px;border-radius:6px;border:2px solid ${inTrade ? '#4fd18b' : '#bbb'};background:#fff;display:flex;align-items:center;justify-content:center;cursor:${locked||inTrade?'not-allowed':'pointer'};opacity:${locked?0.5:1};">
                <img src="/items/${currentCategory}/${itemId}/front.png" style="max-width:32px;max-height:32px;" />
            </div>`;
        });
        return html;
    }
    function drawTradeAvatar(canvasId, player) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !player) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Center the character
        const charX = (canvas.width - 55) / 2;
        const charY = (canvas.height - 70) / 2;
        
        // Draw base character first (if no skin color equipped)
        if (!player.equipped || !player.equipped.hd) {
            const baseImg = new Image();
            baseImg.onload = function() {
                ctx.drawImage(baseImg, charX, charY, 55, 70);
                // After base character is drawn, draw equipped items
                drawEquippedItems(ctx, charX, charY, player);
            };
            baseImg.onerror = function() {
                // If base character fails to load, still try to draw equipped items
                drawEquippedItems(ctx, charX, charY, player);
            };
            baseImg.src = '/assets/character_down.png';
        } else {
            // If skin color is equipped, draw equipped items directly
            drawEquippedItems(ctx, charX, charY, player);
        }
    }
    
    function drawEquippedItems(ctx, charX, charY, player) {
        // Draw equipped items in order using proper offsets
        const order = ['hd', 'sk', 'ps', 'st', 'nk', 'hr', 'gs', 'ht'];
        let itemsToDraw = [];
        
        // Collect all items that need to be drawn
        order.forEach(cat => {
            const itemId = player.equipped && player.equipped[cat];
            if (itemId) {
                itemsToDraw.push({ cat, itemId });
            }
        });
        
        // If no items to draw, we're done
        if (itemsToDraw.length === 0) return;
        
        // Draw items synchronously in order
        drawNextItem(ctx, charX, charY, itemsToDraw, 0);
    }
    
    function drawNextItem(ctx, charX, charY, itemsToDraw, index) {
        if (index >= itemsToDraw.length) return; // All items drawn
        
        const item = itemsToDraw[index];
        const img = new Image();
        
        img.onload = function() {
            // Use proper item offsets
            const offsetData = window.itemOffsets?.[item.cat]?.[item.itemId]?.front;
            const x = charX + (offsetData?.x || 0);
            const y = charY + (offsetData?.y || 0);
            const width = (offsetData?.width || 1) * 55;
            const height = (offsetData?.height || 1) * 70;
            ctx.drawImage(img, x, y, width, height);
            
            // Draw next item
            drawNextItem(ctx, charX, charY, itemsToDraw, index + 1);
        };
        
        img.onerror = function() {
            // If this item fails to load, continue with next item
            drawNextItem(ctx, charX, charY, itemsToDraw, index + 1);
        };
        
        img.src = `/items/${item.cat}/${item.itemId}/front.png`;
    }
    function updateTradeSlotsAndInventory(tradeData) {
        // Update your slots
        const yourSlotsDiv = document.getElementById('yourTradeSlots');
        if (yourSlotsDiv) {
            yourSlotsDiv.innerHTML = renderTradeSlots(tradeData.yourOffer || [], true, tradeData.yourLocked);
        }
        // Update their slots
        const theirSlotsDiv = document.getElementById('theirTradeSlots');
        if (theirSlotsDiv) {
            theirSlotsDiv.innerHTML = renderTradeSlots(tradeData.theirOffer || [], false, tradeData.theirLocked);
        }
        // Update inventory
        const invDiv = document.getElementById('tradeInventory');
        if (invDiv) {
            const inventory = window.players?.[window.socket.id]?.inventory || {};
            invDiv.innerHTML = renderInventoryItems(inventory, tradeData.yourOffer || [], tradeData.yourLocked, tradeData.currentCategory || 'ht');
        }
        // Update confirm button state
        const confirmBtn = document.getElementById('confirmTradeBtn');
        if (confirmBtn) {
            if (tradeData.yourLocked) {
                confirmBtn.disabled = false;
                confirmBtn.style.background = '#4fd18b';
            } else {
                confirmBtn.disabled = true;
                confirmBtn.style.background = '#aaa';
            }
        }
        // Re-attach event listeners for slots and inventory
        attachTradeSlotAndInventoryListeners(tradeData);
    }
    function attachTradeSlotAndInventoryListeners(tradeData) {
        // Inventory item click handlers
        const invItems = document.querySelectorAll('.trade-inv-item');
        invItems.forEach(invEl => {
            if (tradeData.yourLocked) return;
            if (invEl.style.cursor === 'pointer') {
                invEl.onclick = () => {
                    const cat = invEl.getAttribute('data-cat');
                    const id = parseInt(invEl.getAttribute('data-id'));
                    let offer = tradeData.yourOffer || [];
                    if (!Array.isArray(offer)) offer = [];
                    if (offer.some(slot => slot && slot.cat === cat && slot.id === id)) return;
                    let emptyIdx = offer.findIndex(slot => !slot);
                    if (emptyIdx === -1) emptyIdx = offer.length;
                    if (emptyIdx >= 9) return;
                    offer[emptyIdx] = { cat, id };
                    tradeData.yourOffer = offer;
                    window.socket.emit('updateTradeOffer', { offer });
                    updateTradeSlotsAndInventory(tradeData);
                };
            }
        });
        // Slot click handlers for removing items
        const yourSlots = document.querySelectorAll('#yourTradeSlots .trade-slot');
        yourSlots.forEach((slot, idx) => {
            if (!tradeData.yourLocked) {
                slot.style.cursor = 'pointer';
                slot.onclick = () => {
                    let offer = tradeData.yourOffer || [];
                    if (!Array.isArray(offer)) offer = [];
                    if (offer[idx]) {
                        offer[idx] = null;
                        tradeData.yourOffer = offer;
                        window.socket.emit('updateTradeOffer', { offer });
                        updateTradeSlotsAndInventory(tradeData);
                    }
                };
            } else {
                slot.style.cursor = 'default';
                slot.onclick = null;
            }
        });
    }
    function setupTradeWindowEventListeners(tradeData) {
        const lockBtn = document.getElementById('lockOfferBtn');
        const confirmBtn = document.getElementById('confirmTradeBtn');
        const cancelBtn = document.getElementById('cancelTradeBtn');
        if (lockBtn) lockBtn.onclick = () => {
            if (!tradeData.yourLocked) lockTradeOffer();
        };
        if (confirmBtn) confirmBtn.onclick = () => {
            if (tradeData.yourLocked) confirmTrade();
        };
        if (cancelBtn) cancelBtn.onclick = () => {
            cancelTrade();
        };
        // Category tab click handlers
        const catTabs = document.querySelectorAll('.trade-cat-tab');
        catTabs.forEach(tab => {
            tab.onclick = () => {
                const cat = tab.getAttribute('data-cat');
                tradeData.currentCategory = cat;
                // Only re-render inventory section
                const invDiv = document.getElementById('tradeInventory');
                if (invDiv) {
                    const inventory = window.players?.[window.socket.id]?.inventory || {};
                    invDiv.innerHTML = renderInventoryItems(inventory, tradeData.yourOffer || [], tradeData.yourLocked, cat);
                }
                attachTradeSlotAndInventoryListeners(tradeData);
            };
        });
        // Attach listeners for slots and inventory
        attachTradeSlotAndInventoryListeners(tradeData);
        // Draw avatars
        drawTradeAvatar('yourTradeAvatar', window.players?.[window.socket.id]);
        drawTradeAvatar('theirTradeAvatar', window.players?.[tradeData?.theirId]);
        // Chat functionality
        const chatInput = document.getElementById('tradeChatInput');
        const sendChatBtn = document.getElementById('sendTradeChatBtn');
        if (chatInput && sendChatBtn) {
            const sendMessage = () => {
                const text = chatInput.value.trim();
                if (text) {
                    window.socket.emit('sendTradeChat', { text });
                    chatInput.value = '';
                }
            };
            sendChatBtn.onclick = sendMessage;
            chatInput.onkeypress = (e) => {
                if (e.key === 'Enter') sendMessage();
            };
        }
    }

    // --- Trading Logic (Socket Actions) ---
    function sendTradeRequest(targetPlayerId) {
        if (tradeRequests.some(r => r.senderId === window.socket.id && r.targetId === targetId)) return;
        // Add to outgoing requests
        const targetPlayer = window.players?.[targetPlayerId];
        if (targetPlayer) {
            outgoingTradeRequests.push({ targetId: targetPlayerId, targetName: targetPlayer.username });
            updateOutgoingTradeRequestsUI();
        }
        window.socket.emit('sendTradeRequest', { targetId: targetPlayerId });
    }
    function cancelTradeRequest(targetPlayerId) {
        // Remove from outgoing requests
        outgoingTradeRequests = outgoingTradeRequests.filter(r => r.targetId !== targetPlayerId);
        updateOutgoingTradeRequestsUI();
        window.socket.emit('cancelTradeRequest', { targetId: targetPlayerId });
        // Optionally close trade window if open
        if (tradeWindow) { tradeWindow.remove(); tradeWindow = null; }
    }
    function declineTradeRequest(senderId) {
        window.socket.emit('declineTradeRequest', { senderId });
        // Remove from local requests
        tradeRequests = tradeRequests.filter(r => r.senderId !== senderId);
        updateTradeRequestsUI();
    }
    function acceptTradeRequest(senderId) {
        window.socket.emit('acceptTradeRequest', { senderId });
        // Remove from local requests
        tradeRequests = tradeRequests.filter(r => r.senderId !== senderId);
        updateTradeRequestsUI();
    }
    function lockTradeOffer() {
        window.socket.emit('lockTradeOffer');
    }
    function unlockTradeOffer() {
        window.socket.emit('unlockTradeOffer');
    }
    function confirmTrade() {
        window.socket.emit('confirmTrade');
    }
    function cancelTrade() {
        window.socket.emit('cancelTrade');
        if (tradeWindow) { tradeWindow.remove(); tradeWindow = null; }
        activeTrade = null;
    }

    // --- Socket Event Listeners ---
    function setupSocketListeners() {
        if (!window.socket) return;
        window.socket.on('tradeRequestReceived', (data) => {
            // { senderId, senderName, targetId }
            // Prevent duplicate requests from same sender to same target
            if (tradeRequests.some(r => r.senderId === data.senderId && r.targetId === data.targetId)) return;
            tradeRequests.push(data);
            updateTradeRequestsUI();
        });
        window.socket.on('tradeRequestDeclined', (data) => {
            // Remove from local requests
            tradeRequests = tradeRequests.filter(r => r.senderId !== data.senderId);
            updateTradeRequestsUI();
        });
        window.socket.on('tradeRequestCanceled', (data) => {
            // Remove from outgoing requests
            outgoingTradeRequests = outgoingTradeRequests.filter(r => r.targetId !== data.targetId);
            updateOutgoingTradeRequestsUI();
        });
        window.socket.on('tradeStarted', (tradeData) => {
            // Remove from outgoing requests
            outgoingTradeRequests = outgoingTradeRequests.filter(r => r.targetId !== tradeData.theirId);
            updateOutgoingTradeRequestsUI();
            activeTrade = tradeData;
            openTradeWindow(tradeData);
        });
        window.socket.on('tradeOfferUpdated', ({ senderId, offer }) => {
            if (activeTrade) {
                if (senderId === activeTrade.theirId) {
                    activeTrade.theirOffer = offer;
                } else {
                    activeTrade.yourOffer = offer;
                }
                updateTradeSlotsAndInventory(activeTrade);
            }
        });
        window.socket.on('tradeChatMessage', ({ senderId, senderName, text }) => {
            if (activeTrade) {
                // Show bubble for 8 seconds
                showTradeBubble(senderId === window.socket.id, text);
            }
        });
        window.socket.on('tradeOfferLocked', ({ senderId }) => {
            if (activeTrade) {
                if (senderId === activeTrade.theirId) {
                    activeTrade.theirLocked = true;
                    const username = window.players?.[activeTrade.theirId]?.username || 'השותף';
                    showTradeStatusBar(`${username} נעל את ההצעה שלו!`);
                } else {
                    activeTrade.yourLocked = true;
                }
                updateTradeSlotsAndInventory(activeTrade);
            }
        });
        window.socket.on('tradeOfferUnlocked', ({ senderId }) => {
            if (activeTrade) {
                if (senderId === activeTrade.theirId) {
                    activeTrade.theirLocked = false;
                    activeTrade.theirConfirmed = false;
                } else {
                    activeTrade.yourLocked = false;
                    activeTrade.yourConfirmed = false;
                }
                openTradeWindow(activeTrade);
            }
        });
        window.socket.on('tradeOfferConfirmed', ({ senderId }) => {
            if (activeTrade) {
                if (senderId === activeTrade.theirId) {
                    activeTrade.theirConfirmed = true;
                    const username = window.players?.[activeTrade.theirId]?.username || 'השותף';
                    showTradeStatusBar(`${username} אישר את ההחלפה!<br><span style='font-size:0.95em;font-weight:400;'>האם ברצונך גם לאשר? <b>שימו לב: לאחר אישור ההחלפה אין דרך חזרה!</b></span>`);
                } else {
                    activeTrade.yourConfirmed = true;
                }
                updateTradeSlotsAndInventory(activeTrade);
            }
        });
        window.socket.on('tradeCanceled', ({ senderId }) => {
            if (tradeWindow) { tradeWindow.remove(); tradeWindow = null; }
            activeTrade = null;
            window.showNotification('החלפה בוטלה', 'info', 3000);
        });
        window.socket.on('tradeCompleted', ({ message, newInventory, newEquipped }) => {
            if (tradeWindow) { tradeWindow.remove(); tradeWindow = null; }
            activeTrade = null;
            // Update local inventory and equipped items
            if (window.players && window.players[window.socket.id]) {
                window.players[window.socket.id].inventory = newInventory;
                if (newEquipped) {
                    window.players[window.socket.id].equipped = newEquipped;
                }
            }
            window.showNotification(message, 'success', 5000);
        });
        // Show a notification if the user or target is busy
        window.socket.on('tradeBusy', ({ message }) => {
            // You can replace this with a custom UI notification if desired
            alert(message);
            // Optionally, clear any pending outgoing trade requests from the UI here if you track them
        });
    }

    // --- Inject Trading CSS ---
    function injectTradingCSS() {
        if (document.getElementById('trading-css')) return;
        const style = document.createElement('style');
        style.id = 'trading-css';
        style.innerHTML = `
        #tradeRequestsPanel {
            box-shadow: 0 2px 12px rgba(120,144,255,0.13);
            background: none;
        }
        .trade-request-tile {
            transition: box-shadow 0.2s;
        }
        .trade-request-tile:hover {
            box-shadow: 0 4px 16px rgba(120,144,255,0.18);
        }
        #tradeWindow {
            animation: tradeWindowPopIn 0.18s cubic-bezier(.4,1.6,.6,1) 1;
        }
        @keyframes tradeWindowPopIn {
            from { opacity: 0; transform: scale(0.92) translate(-50%, -50%); }
            to { opacity: 1; transform: scale(1) translate(-50%, -50%); }
        }
        .trade-slot {
            transition: box-shadow 0.18s, background 0.18s;
        }
        .trade-slot:hover {
            box-shadow: 0 2px 8px #7c8aff44;
            background: #e3f2fd !important;
        }
        #lockOfferBtn[disabled], #confirmTradeBtn[disabled] {
            opacity: 0.6;
            cursor: not-allowed;
        }
        `;
        document.head.appendChild(style);
    }

    // --- Trade Requests UI ---
    function updateTradeRequestsUI() {
        if (!tradeRequestsPanel) {
            tradeRequestsPanel = document.createElement('div');
            tradeRequestsPanel.id = 'tradeRequestsPanel';
            tradeRequestsPanel.style.position = 'fixed';
            tradeRequestsPanel.style.top = '20px';
            tradeRequestsPanel.style.left = '20px';
            tradeRequestsPanel.style.zIndex = '1000';
            tradeRequestsPanel.style.maxWidth = '300px';
            document.body.appendChild(tradeRequestsPanel);
        }
        
        if (tradeRequests.length === 0) {
            tradeRequestsPanel.style.display = 'none';
            return;
        }
        
        tradeRequestsPanel.style.display = 'block';
        tradeRequestsPanel.innerHTML = `
            <div style="background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:16px;border:1px solid #eee;">
                <div style="font-weight:bold;margin-bottom:12px;color:#333;">בקשות החלפה</div>
                ${tradeRequests.map(request => `
                    <div class="trade-request-tile" style="background:#f8f9fa;border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid #e9ecef;">
                        <div style="font-weight:500;margin-bottom:6px;color:#495057;">${request.senderName}</div>
                        <div style="display:flex;gap:8px;">
                            <button onclick="Trading.acceptTradeRequest('${request.senderId}')" style="background:#4fd18b;color:white;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">✅ אישור</button>
                            <button onclick="Trading.declineTradeRequest('${request.senderId}')" style="background:#ff6b6b;color:white;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">❌ דחייה</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // --- Outgoing Trade Requests Panel ---
    function updateOutgoingTradeRequestsUI() {
        if (!outgoingTradePanel) {
            outgoingTradePanel = document.createElement('div');
            outgoingTradePanel.id = 'outgoingTradePanel';
            outgoingTradePanel.style.position = 'fixed';
            outgoingTradePanel.style.top = '20px';
            outgoingTradePanel.style.right = '20px';
            outgoingTradePanel.style.zIndex = '1000';
            outgoingTradePanel.style.maxWidth = '300px';
            document.body.appendChild(outgoingTradePanel);
        }
        
        if (outgoingTradeRequests.length === 0) {
            outgoingTradePanel.style.display = 'none';
            return;
        }
        
        outgoingTradePanel.style.display = 'block';
        outgoingTradePanel.innerHTML = `
            <div style="background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:16px;border:1px solid #eee;">
                <div style="font-weight:bold;margin-bottom:12px;color:#333;">בקשות שנשלחו</div>
                ${outgoingTradeRequests.map(request => `
                    <div class="outgoing-trade-tile" style="background:#f8f9fa;border-radius:8px;padding:12px;margin-bottom:8px;border:1px solid #e9ecef;">
                        <div style="font-weight:500;margin-bottom:6px;color:#495057;">${request.targetName}</div>
                        <div style="display:flex;justify-content:center;">
                            <button onclick="Trading.cancelTradeRequest('${request.targetId}')" style="background:#ff6b6b;color:white;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">❌ ביטול</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // --- Expose API ---
    window.Trading = Trading;

    // --- Chat bubble state ---
    let yourBubbleTimer = null;
    let theirBubbleTimer = null;
    let lastYourBubble = '';
    let lastTheirBubble = '';

    // Show chat bubble for 8 seconds, reset timer on new message, and preserve bubble on re-render
    function showTradeBubble(isMe, text) {
        const bubbleId = isMe ? 'yourTradeBubble' : 'theirTradeBubble';
        const bubbleDiv = document.getElementById(bubbleId);
        const html = `<div class=\"trade-bubble\" style=\"background:white;color:#222;padding:8px 16px;border-radius:18px;box-shadow:0 2px 12px rgba(120,144,255,0.13);font-size:1em;max-width:180px;word-break:break-word;display:inline-block;\">${text}</div>`;
        if (!bubbleDiv) return;
        bubbleDiv.innerHTML = html;
        if (isMe) {
            lastYourBubble = html;
            if (yourBubbleTimer) clearTimeout(yourBubbleTimer);
            yourBubbleTimer = setTimeout(() => { lastYourBubble = ''; if (document.getElementById('yourTradeBubble')) document.getElementById('yourTradeBubble').innerHTML = ''; }, 8000);
        } else {
            lastTheirBubble = html;
            if (theirBubbleTimer) clearTimeout(theirBubbleTimer);
            theirBubbleTimer = setTimeout(() => { lastTheirBubble = ''; if (document.getElementById('theirTradeBubble')) document.getElementById('theirTradeBubble').innerHTML = ''; }, 8000);
        }
    }

    let tradeStatusBarTimeout = null;
    function showTradeStatusBar(message) {
        let bar = document.getElementById('tradeStatusBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'tradeStatusBar';
            bar.style.position = 'absolute';
            bar.style.top = '0';
            bar.style.left = '0';
            bar.style.width = '100%';
            bar.style.background = 'linear-gradient(90deg,#4fd18b 0%,#7c8aff 100%)';
            bar.style.color = 'white';
            bar.style.fontWeight = 'bold';
            bar.style.fontSize = '1em';
            bar.style.textAlign = 'center';
            bar.style.padding = '10px 0 8px 0';
            bar.style.zIndex = '10001';
            bar.style.borderRadius = '18px 18px 0 0';
            bar.style.boxShadow = '0 2px 12px rgba(120,144,255,0.13)';
            const tradeWindow = document.getElementById('tradeWindow');
            if (tradeWindow) tradeWindow.appendChild(bar);
        }
        bar.innerHTML = message;
        bar.style.display = 'block';
        if (tradeStatusBarTimeout) clearTimeout(tradeStatusBarTimeout);
        tradeStatusBarTimeout = setTimeout(() => { if (bar) bar.style.display = 'none'; }, 6000);
    }
})(window); 