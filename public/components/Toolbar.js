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
            <div class="toolbar-logo">Jumpi</div>
            <div class="toolbar-links">
                <a class="toolbar-link" href="/">ראשי</a>
                <a class="toolbar-link" href="/game">למשחק</a>
                <a class="toolbar-link" href="/arcade">ארקייד</a>
                <a class="toolbar-link" href="/store">חנות</a>
                <a class="toolbar-link" href="/blog">בלוג</a>
                <a class="toolbar-link" href="/contact">צור קשר</a>
                <a class="toolbar-link" href="/terms">תקנון</a>
                <a class="toolbar-link" href="/privacy">מדיניות פרטיות</a>
            </div>
            <div class="toolbar-user">
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