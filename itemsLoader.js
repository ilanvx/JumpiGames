const fs = require('fs');
const path = require('path');

const DEBUG_MODE = false;

// Item categories and their display names
const ITEM_CATEGORIES = {
    ht: "כובעים",
    ps: "מכנסיים", 
    st: "חולצות",
    gs: "משקפיים",
    nk: "שרשראות",
    hd: "צבעי גוף",
    sk: "סקייטבורדים",
    hr: "שיערות"
};

// Default positioning offsets for each direction
const DEFAULT_OFFSETS = {
    front: { x: 0, y: 0 },
    back: { x: 0, y: 0 },
    up: { x: 0, y: 0 },
    down: { x: 0, y: 0 },
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    up_left: { x: 0, y: 0 },
    up_right: { x: 0, y: 0 },
    down_left: { x: 0, y: 0 },
    down_right: { x: 0, y: 0 }
};

// Category-specific offset adjustments
const CATEGORY_OFFSETS = {
    ht: { // Hats - positioned on head
        front: { x: 0, y: -25 },
        back: { x: 0, y: -25 },
        up: { x: 0, y: -30 },
        down: { x: 0, y: -20 },
        left: { x: -2, y: -25 },
        right: { x: 2, y: -25 },
        up_left: { x: -2, y: -30 },
        up_right: { x: 2, y: -30 },
        down_left: { x: -2, y: -20 },
        down_right: { x: 2, y: -20 }
    },
    gs: { // Glasses - positioned on face
        front: { x: 0, y: -15 },
        back: { x: 0, y: -15 },
        up: { x: 0, y: -20 },
        down: { x: 0, y: -10 },
        left: { x: -1, y: -15 },
        right: { x: 1, y: -15 },
        up_left: { x: -1, y: -20 },
        up_right: { x: 1, y: -20 },
        down_left: { x: -1, y: -10 },
        down_right: { x: 1, y: -10 }
    },
    st: { // Shirts - positioned on torso
        front: { x: 0, y: 0 },
        back: { x: 0, y: 0 },
        up: { x: 0, y: -5 },
        down: { x: 0, y: 5 },
        left: { x: 0, y: 0 },
        right: { x: 0, y: 0 },
        up_left: { x: 0, y: -5 },
        up_right: { x: 0, y: -5 },
        down_left: { x: 0, y: 5 },
        down_right: { x: 0, y: 5 }
    },
    ps: { // Pants - positioned on legs
        front: { x: 0, y: 10 },
        back: { x: 0, y: 10 },
        up: { x: 0, y: 5 },
        down: { x: 0, y: 15 },
        left: { x: 0, y: 10 },
        right: { x: 0, y: 10 },
        up_left: { x: 0, y: 5 },
        up_right: { x: 0, y: 5 },
        down_left: { x: 0, y: 15 },
        down_right: { x: 0, y: 15 }
    },
    nk: { // Necklaces - positioned on neck
        front: { x: 0, y: -5 },
        back: { x: 0, y: -5 },
        up: { x: 0, y: -10 },
        down: { x: 0, y: 0 },
        left: { x: 0, y: -5 },
        right: { x: 0, y: -5 },
        up_left: { x: 0, y: -10 },
        up_right: { x: 0, y: -10 },
        down_left: { x: 0, y: 0 },
        down_right: { x: 0, y: 0 }
    },
    hr: { // Hair - positioned on head
        front: { x: 0, y: -20 },
        back: { x: 0, y: -20 },
        up: { x: 0, y: -25 },
        down: { x: 0, y: -15 },
        left: { x: -1, y: -20 },
        right: { x: 1, y: -20 },
        up_left: { x: -1, y: -25 },
        up_right: { x: 1, y: -25 },
        down_left: { x: -1, y: -15 },
        down_right: { x: 1, y: -15 }
    },
    hd: { // Body colors - no offset needed
        front: { x: 0, y: 0 },
        back: { x: 0, y: 0 },
        left: { x: 0, y: 0 },
        right: { x: 0, y: 0 },
        up_left: { x: 0, y: 0 },
        up_right: { x: 0, y: 0 },
        down_left: { x: 0, y: 0 },
        down_right: { x: 0, y: 0 }
    },
    sk: { // Skateboards - positioned below
        front: { x: 0, y: 30 },
        back: { x: 0, y: 30 },
        left: { x: 0, y: 30 },
        right: { x: 0, y: 30 },
        up_left: { x: 0, y: 25 },
        up_right: { x: 0, y: 25 },
        down_left: { x: 0, y: 35 },
        down_right: { x: 0, y: 35 }
    }
};

// Valid image directions
const VALID_DIRECTIONS = ['front', 'back', 'left', 'right', 'up_left', 'up_right', 'down_left', 'down_right'];

function scanItemsDirectory() {
    const itemsPath = path.join(__dirname, 'items');
    const itemsMetadata = {};
    
    try {
        if (!fs.existsSync(itemsPath)) {
            return itemsMetadata;
        }
        
        // Scan each category folder
        for (const category of Object.keys(ITEM_CATEGORIES)) {
            const categoryPath = path.join(itemsPath, category);
            
            try {
                if (!fs.existsSync(categoryPath)) {
                    continue;
                }
                
                itemsMetadata[category] = {};
                
                // Scan each item folder (numbered folders)
                let itemFolders;
                try {
                    itemFolders = fs.readdirSync(categoryPath, { withFileTypes: true })
                        .filter(dirent => dirent.isDirectory())
                        .map(dirent => dirent.name)
                        .filter(name => /^\d+$/.test(name)) // Only numeric folders
                        .sort((a, b) => parseInt(a) - parseInt(b));
                } catch (error) {
                    continue;
                }
                
                for (const itemFolder of itemFolders) {
                    try {
                        const itemId = parseInt(itemFolder);
                        const itemPath = path.join(categoryPath, itemFolder);
                        
                        // Get all image files in the item folder
                        let imageFiles;
                        try {
                            imageFiles = fs.readdirSync(itemPath)
                                .filter(file => file.endsWith('.png'))
                                .map(file => file.replace('.png', ''));
                        } catch (error) {
                            continue;
                        }
                        
                        // Validate that we have the required images
                        const missingDirections = VALID_DIRECTIONS.filter(dir => !imageFiles.includes(dir));
                        if (missingDirections.length > 0) {
                        }
                        
                        // Create metadata for this item
                        itemsMetadata[category][itemId] = {
                            category: category,
                            id: itemId,
                            name: `${ITEM_CATEGORIES[category]} #${itemId}`,
                            images: imageFiles,
                            offsets: CATEGORY_OFFSETS[category] || DEFAULT_OFFSETS,
                            availableDirections: imageFiles.filter(dir => VALID_DIRECTIONS.includes(dir))
                        };
                    } catch (error) {
                        continue;
                    }
                }
            } catch (error) {
                continue;
            }
        }
    } catch (error) {
        return itemsMetadata;
    }
    
    return itemsMetadata;
}

function getItemMetadata(category, itemId) {
    const itemsMetadata = scanItemsDirectory();
    return itemsMetadata[category]?.[itemId] || null;
}

function getAllItemsMetadata() {
    return scanItemsDirectory();
}

function getCategoryItems(category) {
    const itemsMetadata = scanItemsDirectory();
    return itemsMetadata[category] || {};
}

function getAllAvailableItems() {
    try {
        const itemsMetadata = scanItemsDirectory();
        const allItems = [];
        
        for (const category in itemsMetadata) {
            for (const itemId in itemsMetadata[category]) {
                const item = itemsMetadata[category][itemId];
                allItems.push({
                    category: item.category,
                    id: item.id,
                    name: item.name,
                    displayName: ITEM_CATEGORIES[category] || category
                });
            }
        }
        
        return allItems.sort((a, b) => {
            // Sort by category first, then by ID
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.id - b.id;
        });
    } catch (error) {
        return [];
    }
}

// Export functions for use in other modules
module.exports = {
    scanItemsDirectory,
    getItemMetadata,
    getAllItemsMetadata,
    getCategoryItems,
    getAllAvailableItems,
    ITEM_CATEGORIES,
    VALID_DIRECTIONS,
    CATEGORY_OFFSETS
};

// If run directly, output the metadata
if (require.main === module) {
    const metadata = scanItemsDirectory();
    if (DEBUG_MODE) {
        console.log('Items Metadata:');
        console.log(JSON.stringify(metadata, null, 2));
        
        // Print summary
        let totalItems = 0;
        for (const category in metadata) {
            const itemCount = Object.keys(metadata[category]).length;
            console.log(`${category}: ${itemCount} items`);
            totalItems += itemCount;
        }
        console.log(`Total items: ${totalItems}`);
    }
} 