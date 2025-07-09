class ItemOffsetEditor {
    constructor() {
        this.canvas = document.getElementById('previewCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentOffset = { x: 0, y: 0 };
        this.itemsMetadata = {};
        this.itemOffsets = {};
        this.characterImages = {};
        this.itemImages = {};
        this.showBackground = true; // Track background visibility
        
        this.initializeElements();
        this.loadData();
        this.setupEventListeners();
    }
    
    initializeElements() {
        this.categorySelect = document.getElementById('categorySelect');
        this.itemSelect = document.getElementById('itemSelect');
        this.directionSelect = document.getElementById('directionSelect');
        this.offsetXInput = document.getElementById('offsetX');
        this.offsetYInput = document.getElementById('offsetY');
        this.widthMultiplierInput = document.getElementById('widthMultiplier');
        this.heightMultiplierInput = document.getElementById('heightMultiplier');
        this.saveBtn = document.getElementById('saveBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.resetAllBtn = document.getElementById('resetAllBtn');
        this.viewOffsetsBtn = document.getElementById('viewOffsetsBtn');
        this.toggleBackgroundBtn = document.getElementById('toggleBackgroundBtn');
        this.applyToAllCheck = document.getElementById('applyToAllCheck');
        this.applyToCurrentDirectionCheck = document.getElementById('applyToCurrentDirectionCheck');
        this.statusMessage = document.getElementById('statusMessage');
        this.loadingMessage = document.getElementById('loadingMessage');
        
        // Arrow buttons
        this.upBtn = document.getElementById('upBtn');
        this.downBtn = document.getElementById('downBtn');
        this.leftBtn = document.getElementById('leftBtn');
        this.rightBtn = document.getElementById('rightBtn');
    }
    
    async loadData() {
        try {
            // Load items metadata
            const itemsResponse = await fetch('/api/items');
            this.itemsMetadata = await itemsResponse.json();
            
            // Load item offsets
            const offsetsResponse = await fetch('/api/item-offsets', {
                headers: {
                    'x-admin-token': 'YOUR_SECRET_ADMIN_TOKEN'
                }
            });
            const offsetsData = await offsetsResponse.json();
            this.itemOffsets = offsetsData.offsets;
            
            // Load character images
            await this.loadCharacterImages();
            
            this.populateDropdowns();
            this.hideLoading();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showStatus('Error loading data', 'error');
            this.hideLoading();
        }
    }
    
    async loadCharacterImages() {
        const directions = ['front', 'back', 'left', 'right', 'up_left', 'up_right', 'down_left', 'down_right'];
        
        for (const direction of directions) {
            const img = new Image();
            // Map direction names to actual filenames
            let fileDirection = direction;
            if (direction === 'front') {
                fileDirection = 'down';
            } else if (direction === 'back') {
                fileDirection = 'up';
            }
            img.src = `/assets/character_${fileDirection}.png`;
            this.characterImages[direction] = img;
        }
    }
    
    populateDropdowns() {
        // Populate category dropdown
        this.categorySelect.innerHTML = '<option value="">Select category...</option>';
        const categoryDisplayNames = {
            ht: 'Hats',
            ps: 'Pants',
            st: 'Shirts',
            gs: 'Glasses',
            nk: 'Necklaces',
            hd: 'Skin Colors',
            sk: 'Skateboards',
            hr: 'Hair'
        };
        
        Object.entries(categoryDisplayNames).forEach(([key, name]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = name;
            this.categorySelect.appendChild(option);
        });
        
        // Populate direction dropdown
        this.directionSelect.innerHTML = '<option value="">Select direction...</option>';
        const directions = [
            'front', 'back', 'left', 'right',
            'up_left', 'up_right', 'down_left', 'down_right'
        ];
        
        directions.forEach(direction => {
            const option = document.createElement('option');
            option.value = direction;
            option.textContent = direction.replace('_', ' ').toUpperCase();
            this.directionSelect.appendChild(option);
        });
    }
    
    setupEventListeners() {
        this.categorySelect.addEventListener('change', () => this.onCategoryChange());
        this.itemSelect.addEventListener('change', () => this.onItemChange());
        this.directionSelect.addEventListener('change', () => this.onDirectionChange());
        
        this.offsetXInput.addEventListener('input', () => this.onOffsetInputChange());
        this.offsetYInput.addEventListener('input', () => this.onOffsetInputChange());
        this.widthMultiplierInput.addEventListener('input', () => this.onSizeInputChange());
        this.heightMultiplierInput.addEventListener('input', () => this.onSizeInputChange());
        
        this.saveBtn.addEventListener('click', () => this.saveOffset());
        this.resetBtn.addEventListener('click', () => this.resetOffset());
        this.resetAllBtn.addEventListener('click', () => this.resetAllOffsets());
        this.viewOffsetsBtn.addEventListener('click', () => this.viewCurrentOffsets());
        this.toggleBackgroundBtn.addEventListener('click', () => this.toggleBackground());
        
        // Add event listeners for checkboxes to ensure mutual exclusivity
        this.applyToAllCheck.addEventListener('change', () => this.handleCheckboxChange());
        this.applyToCurrentDirectionCheck.addEventListener('change', () => this.handleCheckboxChange());
        
        // Arrow button events
        this.upBtn.addEventListener('click', () => this.adjustOffset(0, -1));
        this.downBtn.addEventListener('click', () => this.adjustOffset(0, 1));
        this.leftBtn.addEventListener('click', () => this.adjustOffset(-1, 0));
        this.rightBtn.addEventListener('click', () => this.adjustOffset(1, 0));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }
    
    onCategoryChange() {
        const category = this.categorySelect.value;
        this.itemSelect.innerHTML = '<option value="">Select item...</option>';
        
        if (category && this.itemsMetadata[category]) {
            Object.keys(this.itemsMetadata[category]).forEach(itemId => {
                const option = document.createElement('option');
                option.value = itemId;
                option.textContent = `Item #${itemId}`;
                this.itemSelect.appendChild(option);
            });
        }
        
        this.updatePreview();
    }
    
    onItemChange() {
        this.updatePreview();
    }
    
    onDirectionChange() {
        this.loadCurrentOffset();
        this.updatePreview();
    }
    
    loadCurrentOffset() {
        const category = this.categorySelect.value;
        const itemId = this.itemSelect.value;
        const direction = this.directionSelect.value;
        
        if (category && itemId && direction) {
            const savedOffset = this.itemOffsets[category]?.[itemId]?.[direction];
            this.currentOffset = savedOffset ? { 
                x: savedOffset.x || 0, 
                y: savedOffset.y || 0,
                width: savedOffset.width || 1,
                height: savedOffset.height || 1
            } : { x: 0, y: 0, width: 1, height: 1 };
        } else {
            this.currentOffset = { x: 0, y: 0, width: 1, height: 1 };
        }
        
        this.updateOffsetInputs();
    }
    
    updateOffsetInputs() {
        this.offsetXInput.value = this.currentOffset.x;
        this.offsetYInput.value = this.currentOffset.y;
        this.widthMultiplierInput.value = this.currentOffset.width;
        this.heightMultiplierInput.value = this.currentOffset.height;
    }
    
    onOffsetInputChange() {
        this.currentOffset.x = parseInt(this.offsetXInput.value) || 0;
        this.currentOffset.y = parseInt(this.offsetYInput.value) || 0;
        this.updatePreview();
    }
    
    onSizeInputChange() {
        this.currentOffset.width = parseFloat(this.widthMultiplierInput.value) || 1;
        this.currentOffset.height = parseFloat(this.heightMultiplierInput.value) || 1;
        this.updatePreview();
    }
    
    handleCheckboxChange() {
        // Ensure only one checkbox is checked at a time
        if (this.applyToAllCheck.checked && this.applyToCurrentDirectionCheck.checked) {
            // If both are checked, uncheck the one that wasn't just clicked
            if (event.target === this.applyToAllCheck) {
                this.applyToCurrentDirectionCheck.checked = false;
            } else {
                this.applyToAllCheck.checked = false;
            }
        }
    }
    
    adjustOffset(dx, dy) {
        this.currentOffset.x += dx;
        this.currentOffset.y += dy;
        this.updateOffsetInputs();
        this.updatePreview();
    }
    
    handleKeyboard(e) {
        const step = e.shiftKey ? 5 : 1;
        
        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.adjustOffset(0, -step);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.adjustOffset(0, step);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.adjustOffset(-step, 0);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.adjustOffset(step, 0);
                break;
        }
    }
    
    async updatePreview() {
        const category = this.categorySelect.value;
        const itemId = this.itemSelect.value;
        const direction = this.directionSelect.value;
        
        if (!category || !itemId || !direction) {
            this.clearCanvas();
            return;
        }
        
        try {
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw background if enabled
            if (this.showBackground) {
                this.drawCheckerboardBackground();
            }
            
            // Define the drawing order for equipped items
            const ITEM_DRAW_ORDER = ["hd", "st", "ps", "sk", "nk", "hr", "gs", "ht"];
            
            const charX = (this.canvas.width - 55) / 2;
            const charY = (this.canvas.height - 70) / 2;
            
            // 1. Draw skateboard first (if it's the current item or if we're previewing a skateboard)
            if (category === "sk") {
                const itemKey = `${category}_${itemId}_${direction}`;
                let itemImg = this.itemImages[itemKey];
                
                if (!itemImg) {
                    itemImg = new Image();
                    itemImg.src = `/items/${category}/${itemId}/${direction}.png`;
                    this.itemImages[itemKey] = itemImg;
                }
                
                if (itemImg.complete && itemImg.naturalHeight > 0) {
                    const itemX = charX + this.currentOffset.x;
                    const itemY = charY + this.currentOffset.y;
                    const itemWidth = 55 * this.currentOffset.width;
                    const itemHeight = 70 * this.currentOffset.height;
                    this.ctx.drawImage(itemImg, itemX, itemY, itemWidth, itemHeight);
                }
            }
            
            // 2. Draw base character sprite (skin/body)
            const characterImg = this.characterImages[direction];
            if (characterImg && characterImg.complete) {
                this.ctx.drawImage(characterImg, charX, charY, 55, 70);
            }
            
            // 3. Draw the current item if it's not a skateboard (skateboards are drawn first)
            if (category !== "sk") {
                const itemKey = `${category}_${itemId}_${direction}`;
                let itemImg = this.itemImages[itemKey];
                
                if (!itemImg) {
                    itemImg = new Image();
                    itemImg.src = `/items/${category}/${itemId}/${direction}.png`;
                    this.itemImages[itemKey] = itemImg;
                }
                
                if (itemImg.complete && itemImg.naturalHeight > 0) {
                    const itemX = charX + this.currentOffset.x;
                    const itemY = charY + this.currentOffset.y;
                    const itemWidth = 55 * this.currentOffset.width;
                    const itemHeight = 70 * this.currentOffset.height;
                    this.ctx.drawImage(itemImg, itemX, itemY, itemWidth, itemHeight);
                }
            }
        } catch (error) {
            console.error('Error updating preview:', error);
        }
    }
    
    toggleBackground() {
        this.showBackground = !this.showBackground;
        this.updatePreview();
        const buttonText = this.showBackground ? 'Hide Background' : 'Show Background';
        this.toggleBackgroundBtn.innerHTML = `<i class="fas fa-image"></i> ${buttonText}`;
        this.showStatus(`Background ${this.showBackground ? 'shown' : 'hidden'}`, 'success');
    }
    
    drawCheckerboardBackground() {
        const tileSize = 20;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        for (let x = 0; x < width; x += tileSize) {
            for (let y = 0; y < height; y += tileSize) {
                const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
                this.ctx.fillStyle = isEven ? '#f0f0f0' : '#e0e0e0';
                this.ctx.fillRect(x, y, tileSize, tileSize);
            }
        }
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    async saveOffset() {
        const category = this.categorySelect.value;
        const itemId = this.itemSelect.value;
        const direction = this.directionSelect.value;
        const applyToAll = this.applyToAllCheck.checked;
        const applyToCurrentDirection = this.applyToCurrentDirectionCheck.checked;
        
        if (!category || !direction) {
            this.showStatus('Please select category and direction', 'error');
            return;
        }
        
        if (!applyToAll && !applyToCurrentDirection && !itemId) {
            this.showStatus('Please select an item or check one of the "Apply to ALL" options', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/item-offsets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': 'YOUR_SECRET_ADMIN_TOKEN'
                },
                body: JSON.stringify({
                    category: category,
                    itemId: (applyToAll || applyToCurrentDirection) ? null : parseInt(itemId),
                    direction: direction,
                    offset: this.currentOffset,
                    applyToAll: applyToAll,
                    applyToCurrentDirection: applyToCurrentDirection
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showStatus(result.message, 'success');
                // Reload offsets
                const offsetsResponse = await fetch('/api/item-offsets', {
                    headers: {
                        'x-admin-token': 'YOUR_SECRET_ADMIN_TOKEN'
                    }
                });
                const offsetsData = await offsetsResponse.json();
                this.itemOffsets = offsetsData.offsets;
            } else {
                this.showStatus(result.error || 'Failed to save offset', 'error');
            }
        } catch (error) {
            console.error('Error saving offset:', error);
            this.showStatus('Error saving offset', 'error');
        }
    }
    
    resetOffset() {
        this.currentOffset = { x: 0, y: 0, width: 1, height: 1 };
        this.updateOffsetInputs();
        this.updatePreview();
        this.showStatus('Offset reset to default', 'success');
    }
    
    async resetAllOffsets() {
        const category = this.categorySelect.value;
        const direction = this.directionSelect.value;
        
        if (!category || !direction) {
            this.showStatus('Please select category and direction', 'error');
            return;
        }
        
        if (!confirm(`Are you sure you want to reset ALL offsets for category '${category}' in direction '${direction}'?`)) {
            return;
        }
        
        try {
            const response = await fetch('/api/item-offsets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': 'YOUR_SECRET_ADMIN_TOKEN'
                },
                body: JSON.stringify({
                    category: category,
                    direction: direction
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showStatus(result.message, 'success');
                // Reload offsets
                const offsetsResponse = await fetch('/api/item-offsets', {
                    headers: {
                        'x-admin-token': 'YOUR_SECRET_ADMIN_TOKEN'
                    }
                });
                const offsetsData = await offsetsResponse.json();
                this.itemOffsets = offsetsData.offsets;
                this.loadCurrentOffset();
            } else {
                this.showStatus(result.error || 'Failed to reset offsets', 'error');
            }
        } catch (error) {
            console.error('Error resetting offsets:', error);
            this.showStatus('Error resetting offsets', 'error');
        }
    }
    
    async viewCurrentOffsets() {
        const category = this.categorySelect.value;
        const itemId = this.itemSelect.value;
        const direction = this.directionSelect.value;
        
        if (!category) {
            this.showStatus('Please select a category first', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/item-offsets', {
                headers: {
                    'x-admin-token': 'YOUR_SECRET_ADMIN_TOKEN'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                const offsets = result.offsets;
                const categoryOffsets = offsets[category] || {};
                
                let message = `Offsets for category '${category}':\n\n`;
                
                if (Object.keys(categoryOffsets).length === 0) {
                    message += 'No offsets found for this category.';
                } else {
                    for (const itemId in categoryOffsets) {
                        message += `Item ${itemId}:\n`;
                        const itemOffsets = categoryOffsets[itemId];
                        
                        for (const dir in itemOffsets) {
                            const offset = itemOffsets[dir];
                            message += `  ${dir}: x=${offset.x}, y=${offset.y}, width=${offset.width || 1}, height=${offset.height || 1}\n`;
                        }
                        message += '\n';
                    }
                }
                
                alert(message);
            } else {
                this.showStatus('Failed to load offsets', 'error');
            }
        } catch (error) {
            console.error('Error viewing offsets:', error);
            this.showStatus('Error loading offsets', 'error');
        }
    }
    
    showStatus(message, type) {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message status-${type}`;
        this.statusMessage.style.display = 'block';
        
        setTimeout(() => {
            this.statusMessage.style.display = 'none';
        }, 5000);
    }
    
    hideLoading() {
        this.loadingMessage.style.display = 'none';
    }
}

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ItemOffsetEditor();
}); 