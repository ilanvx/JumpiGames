// Map Navigation System
class MapNavigation {
    constructor() {
        this.rooms = [
            {
                id: 'football',
                name: 'Football Field',
                background: 'rooms/football.png',
                maxCapacity: 50,
                currentPlayers: 0
            },
            {
                id: 'space',
                name: 'Space',
                background: 'rooms/space.png',
                maxCapacity: 50,
                currentPlayers: 0
            },
            {
                id: 'beach',
                name: 'Beach',
                background: 'rooms/sea.png',
                maxCapacity: 50,
                currentPlayers: 0
            },
            {
                id: 'park',
                name: 'Park',
                background: 'rooms/park.png',
                maxCapacity: 50,
                currentPlayers: 0
            }
        ];
        this.currentRoom = 'beach'; // Default room
        this.isMapOpen = false;
        this.init();
    }

    init() {
        this.createMapButton();
        this.createMapModal();
        this.addEventListeners();
        this.requestRoomOccupancy();
    }

    createMapButton() {
        // Create map button
        const mapButton = document.createElement('button');
        mapButton.id = 'mapBtn';
        mapButton.className = 'toolbar-btn map-btn';
        mapButton.title = 'Map';
        mapButton.innerHTML = '<i class="fas fa-map"></i>';
        mapButton.style.cssText = `
            position: fixed;
            left: 18px;
            bottom: 32px;
            width: 54px;
            height: 54px;
            border: none;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
            z-index: 2001;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        document.body.appendChild(mapButton);
    }

    createMapModal() {
        const modal = document.createElement('div');
        modal.id = 'mapModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 2000;
            display: none;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        `;

        modal.innerHTML = `
            <div class="map-modal-content" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow: hidden;
                animation: slideIn 0.3s ease-out;
            ">
                <div class="map-header" style="
                    background: rgba(255, 255, 255, 0.1);
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                ">
                    <h3 style="color: white; margin: 0; font-size: 1.5rem; font-weight: 600;">
                        <i class="fas fa-map-marker-alt"></i> Room Selection
                    </h3>
                    <button class="map-close-btn" style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 1.2rem;
                        transition: all 0.3s ease;
                    ">&times;</button>
                </div>
                <div class="map-content" style="
                    padding: 20px;
                    overflow-y: auto;
                    max-height: 60vh;
                ">
                    <div id="roomsList" style="
                        display: grid;
                        gap: 15px;
                    "></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    addEventListeners() {
        // Map button click
        const mapBtn = document.getElementById('mapBtn');
        mapBtn.addEventListener('click', () => {
            // Add click animation
            mapBtn.style.transform = 'translateY(50%) scale(0.95)';
            setTimeout(() => {
                mapBtn.style.transform = 'translateY(50%) scale(1)';
            }, 150);
            this.toggleMap();
        });

        // Close button
        const closeBtn = document.querySelector('.map-close-btn');
        closeBtn.addEventListener('click', () => {
            // Add click animation
            closeBtn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                closeBtn.style.transform = 'scale(1)';
            }, 150);
            this.closeMap();
        });
        
        // Add hover effect to close button
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.3)';
            closeBtn.style.transform = 'scale(1.1)';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
            closeBtn.style.transform = 'scale(1)';
        });

        // Close on outside click
        document.getElementById('mapModal').addEventListener('click', (e) => {
            if (e.target.id === 'mapModal') {
                this.closeMap();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMapOpen) {
                this.closeMap();
            }
        });

        // Socket events
        if (window.socket) {
            window.socket.on('roomOccupancyUpdate', (data) => {
                this.updateRoomOccupancy(data);
            });

            window.socket.on('roomJoinResponse', (data) => {
                this.handleRoomJoinResponse(data);
            });
        }
    }

    toggleMap() {
        if (this.isMapOpen) {
            this.closeMap();
        } else {
            this.openMap();
        }
    }

    openMap() {
        this.isMapOpen = true;
        const modal = document.getElementById('mapModal');
        modal.style.display = 'flex';
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        
        // Animate in
        setTimeout(() => {
            modal.style.transition = 'all 0.3s ease-out';
            modal.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        }, 10);
        
        this.renderRooms();
    }

    closeMap() {
        this.isMapOpen = false;
        const modal = document.getElementById('mapModal');
        modal.style.transition = 'all 0.3s ease-in';
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    renderRooms() {
        const roomsList = document.getElementById('roomsList');
        roomsList.innerHTML = '';

        this.rooms.forEach(room => {
            const roomCard = document.createElement('div');
            roomCard.className = 'room-card';
            roomCard.style.cssText = `
                background: rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                padding: 20px;
                display: flex;
                align-items: center;
                gap: 15px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: all 0.3s ease;
                cursor: pointer;
            `;

            // Add hover effect to room card
            roomCard.addEventListener('mouseenter', () => {
                roomCard.style.background = 'rgba(255, 255, 255, 0.15)';
                roomCard.style.transform = 'translateY(-2px)';
                roomCard.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
            });

            roomCard.addEventListener('mouseleave', () => {
                roomCard.style.background = 'rgba(255, 255, 255, 0.1)';
                roomCard.style.transform = 'translateY(0)';
                roomCard.style.boxShadow = 'none';
            });

            const isCurrentRoom = room.id === this.currentRoom;
            const isFull = room.currentPlayers >= room.maxCapacity;

            roomCard.innerHTML = `
                <div class="room-image" style="
                    width: 80px;
                    height: 60px;
                    border-radius: 10px;
                    overflow: hidden;
                    background: url('${room.background}') center/cover;
                    border: 2px solid ${isCurrentRoom ? '#00aaff' : 'rgba(255,255,255,0.3)'};
                "></div>
                <div class="room-info" style="flex: 1;">
                    <h4 style="color: white; margin: 0 0 5px 0; font-size: 1.1rem;">
                        ${room.name}
                        ${isCurrentRoom ? '<span style="color: #00aaff; font-size: 0.9rem;"> (Current)</span>' : ''}
                    </h4>
                    <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 0.9rem;">
                        ${room.currentPlayers} / ${room.maxCapacity} players
                    </p>
                </div>
                <button class="join-room-btn" data-room="${room.id}" style="
                    background: ${isCurrentRoom ? 'rgba(0,170,255,0.3)' : isFull ? 'rgba(255,107,107,0.3)' : 'rgba(255,255,255,0.2)'};
                    border: 2px solid ${isCurrentRoom ? '#00aaff' : isFull ? '#ff6b6b' : 'rgba(255,255,255,0.3)'};
                    color: white;
                    padding: 10px 20px;
                    border-radius: 10px;
                    cursor: ${isCurrentRoom || isFull ? 'not-allowed' : 'pointer'};
                    font-weight: 600;
                    transition: all 0.3s ease;
                    ${isCurrentRoom || isFull ? 'opacity: 0.6;' : ''}
                ">
                    ${isCurrentRoom ? 'Current Room' : isFull ? 'Full' : 'Join'}
                </button>
            `;

            // Add click handler for join button
            const joinBtn = roomCard.querySelector('.join-room-btn');
            if (!isCurrentRoom && !isFull) {
                joinBtn.addEventListener('click', () => {
                    // Add click animation
                    joinBtn.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        joinBtn.style.transform = 'scale(1)';
                    }, 150);
                    this.joinRoom(room.id);
                });

                // Add hover effects
                joinBtn.addEventListener('mouseenter', () => {
                    joinBtn.style.transform = 'scale(1.05)';
                    joinBtn.style.boxShadow = '0 4px 15px rgba(255,255,255,0.3)';
                });

                joinBtn.addEventListener('mouseleave', () => {
                    joinBtn.style.transform = 'scale(1)';
                    joinBtn.style.boxShadow = 'none';
                });
            }

            roomsList.appendChild(roomCard);
        });
    }

    joinRoom(roomId) {
        if (window.socket) {
            window.socket.emit('joinRoom', { roomId });
        }
    }

    handleRoomJoinResponse(data) {
        if (data.success) {
            this.currentRoom = data.roomId;
            this.closeMap();
            
            // Find room info for better message
            const room = this.rooms.find(r => r.id === data.roomId);
            const roomName = room ? room.name : data.roomId;
            window.showNotification(`Successfully joined ${roomName}!`, 'success', 3000);
            
            // Update background image
            if (room && window.bg) {
                window.bg.src = room.background;
            }
        } else {
            window.showNotification(data.message, 'error', 4000);
        }
    }

    updateRoomOccupancy(data) {
        data.rooms.forEach(roomData => {
            const room = this.rooms.find(r => r.id === roomData.id);
            if (room) {
                room.currentPlayers = roomData.currentPlayers;
            }
        });

        if (this.isMapOpen) {
            this.renderRooms();
        }
    }

    requestRoomOccupancy() {
        if (window.socket) {
            window.socket.emit('requestRoomOccupancy');
        }
    }

    setCurrentRoom(roomId) {
        this.currentRoom = roomId;
    }
}

// Initialize map navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mapNavigation = new MapNavigation();
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapNavigation;
} else {
    window.MapNavigation = MapNavigation;
} 