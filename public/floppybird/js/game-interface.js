// Game Interface for Floppybird
// This file handles communication between the game and the parent window

(function() {
    'use strict';
    
    let gameScore = 0;
    let gameCompleted = false;
    let originalPlayerDead = null;
    let originalShowScore = null;
    let hooked = false;
    
    // Function to send game completion message to parent
    function sendGameCompletion(score) {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'gameComplete',
                score: score,
                game: 'floppybird'
            }, '*');
        }
    }
    
    // Override the original playerDead function only once
    function hookIntoGame() {
        if (hooked) return;
        if (typeof playerDead === 'function') {
            originalPlayerDead = playerDead;
            window.playerDead = function() {
                // Mark game as completed
                gameCompleted = true;
                gameScore = window.score || 0;
                // קרא לפונקציה המקורית (לא ל-new!)
                if (originalPlayerDead && window.playerDead !== originalPlayerDead) {
                    originalPlayerDead();
                }
                // שלח ניקוד להורה
                setTimeout(() => {
                    if (gameScore > 0) {
                        sendGameCompletion(gameScore);
                    }
                }, 1000);
            };
            hooked = true;
        }
    }
    
    // Wait for the game to load and then hook into it
    function initializeGameInterface() {
        if (typeof $ !== 'undefined' && typeof states !== 'undefined') {
            setTimeout(hookIntoGame, 1000);
        } else {
            setTimeout(initializeGameInterface, 500);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGameInterface);
    } else {
        initializeGameInterface();
    }
    setTimeout(hookIntoGame, 3000);
    window.gameInterface = {
        sendGameCompletion: sendGameCompletion,
        hookIntoGame: hookIntoGame,
        gameScore: () => gameScore,
        gameCompleted: () => gameCompleted
    };
})(); 