// Toolbar Component - Reusable across all pages
class Toolbar {
    constructor() {
        this.init();
    }

    init() {
        this.createToolbar();
        this.addEventListeners();
    }

    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        toolbar.innerHTML = `
            <div class="toolbar-container">
                <div class="toolbar-left">
                    <a href="/" class="toolbar-logo">
                        <span class="logo-icon">🎮</span>
                        <span class="logo-text">Jumpi</span>
                    </a>
                </div>
                <div class="toolbar-center">
                    <nav class="toolbar-nav">
                        <a href="/" class="nav-link">בית</a>
                        <a href="/blog" class="nav-link">בלוג</a>
                        <a href="/contact" class="nav-link">צור קשר</a>
                    </nav>
                </div>
                <div class="toolbar-right">
                    <div class="toolbar-links">
                        <a href="/terms" class="toolbar-link">תנאים</a>
                        <a href="/privacy" class="toolbar-link">פרטיות</a>
                        <a href="/accessibility" class="toolbar-link">נגישות</a>
                    </div>
                </div>
            </div>
        `;
        
        // Insert at the beginning of body
        document.body.insertBefore(toolbar, document.body.firstChild);
    }

    addEventListeners() {
        // Add any toolbar-specific event listeners here
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Add active state
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Toolbar;
} else {
    window.Toolbar = Toolbar;
} 