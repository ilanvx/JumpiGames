class Store {
    constructor() {
        this.isAuthenticated = false;
        this.userData = null;
        this.packages = [];
        this.init();
    }

    async init() {
        this.updateDebugStatus('מתחיל אתחול...');
        
        await this.checkAuthentication();
        if (this.isAuthenticated) {
            this.updateDebugStatus('משתמש מאומת, טוען חבילות...');
            await this.loadPackages();
            this.displayPackages();
            this.updateDebugStatus('החנות נטענה בהצלחה!');
        } else {
            this.updateDebugStatus('משתמש לא מאומת');
            this.showAuthMessage();
        }
    }

    updateDebugStatus(message) {
        const debugStatus = document.getElementById('debugStatus');
        if (debugStatus) {
            debugStatus.textContent = message;
        }
        console.log('Debug status:', message);
    }

    async checkAuthentication() {
        try {
            console.log('Checking authentication...');
            const response = await fetch('/api/user', {
                credentials: 'include'
            });
            
            console.log('Auth response status:', response.status);
            
            if (response.ok) {
                this.userData = await response.json();
                console.log('User data:', this.userData);
                this.isAuthenticated = true;
                this.updateUserInfo();
            } else {
                console.log('Authentication failed');
                this.isAuthenticated = false;
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.isAuthenticated = false;
        }
    }

    updateUserInfo() {
        if (this.userData) {
            // Update user info if elements exist
            const userNameEl = document.getElementById('userName');
            const userCoinsEl = document.getElementById('userCoins');
            const userDiamondsEl = document.getElementById('userDiamonds');
            const userInfoEl = document.getElementById('userInfo');
            const authMessageEl = document.getElementById('authMessage');
            const packageListEl = document.getElementById('packageList');
            
            if (userNameEl) userNameEl.textContent = this.userData.username;
            if (userCoinsEl) userCoinsEl.textContent = this.userData.coins || 0;
            if (userDiamondsEl) userDiamondsEl.textContent = this.userData.diamonds || 0;
            if (userInfoEl) userInfoEl.style.display = 'block';
            if (authMessageEl) authMessageEl.style.display = 'none';
            if (packageListEl) packageListEl.style.display = 'flex';
            
            // Add logout button functionality
            this.setupLogoutButton();
        }
    }

    showAuthMessage() {
        const authMessageEl = document.getElementById('authMessage');
        const packageListEl = document.getElementById('packageList');
        const userInfoEl = document.getElementById('userInfo');
        
        if (authMessageEl) authMessageEl.style.display = 'block';
        if (packageListEl) packageListEl.style.display = 'none';
        if (userInfoEl) userInfoEl.style.display = 'none';
    }

    setupLogoutButton() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    async logout() {
        try {
            console.log('Logging out...');
            // Use GET method since the server has a GET route for logout
            window.location.href = '/logout';
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('שגיאה בהתנתקות');
        }
    }

    async loadPackages() {
        try {
            console.log('Loading packages...');
            const response = await fetch('/store/packages', {
                credentials: 'include'
            });
            
            console.log('Packages response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Packages data:', data);
                this.packages = data.packages;
            } else {
                const errorData = await response.json();
                console.error('Packages error:', errorData);
                throw new Error(errorData.error || 'Failed to load packages');
            }
        } catch (error) {
            console.error('Error loading packages:', error);
            this.showError('שגיאה בטעינת החבילות: ' + error.message);
        }
    }

    displayPackages() {
        const packageList = document.getElementById('packageList');
        if (!packageList) {
            console.error('Package list element not found');
            return;
        }
        
        packageList.innerHTML = '';
        packageList.style.display = 'flex';

        this.packages.forEach(pkg => {
            const card = this.createPackageCard(pkg);
            packageList.appendChild(card);
        });
    }

    createPackageCard(pkg) {
        const card = document.createElement('div');
        card.className = 'package-card';
        
        const icon = pkg.coinsReward > 0 ? '🪙' : '💎';
        
        card.innerHTML = `
            <img src="${pkg.imagePath || '/images/package-default.png'}" alt="${pkg.name}" class="package-img" onerror="this.style.display='none'">
            <div class="package-name">${pkg.name}</div>
            <div class="package-desc">${pkg.description}</div>
            <div class="package-amount">${pkg.amount}</div>
            <div class="package-price">₪${pkg.price}</div>
            <div class="paypal-btn" id="paypal-button-container-${pkg.id}"></div>
        `;
        
        // Add PayPal button
        this.addPayPalButton(pkg, card);
        
        return card;
    }

    addPayPalButton(pkg, card) {
        const container = card.querySelector(`#paypal-button-container-${pkg.id}`);
        if (!container) return;

        paypal.Buttons({
            createOrder: async (data, actions) => {
                try {
                    const response = await fetch('/store/create-order', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({ packageId: pkg.id })
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || 'שגיאה ביצירת הזמנה');
                    }

                    const orderData = await response.json();
                    return orderData.orderId;
                } catch (error) {
                    console.error('Error creating order:', error);
                    this.showError(error.message || 'שגיאה ביצירת הזמנה');
                    throw error;
                }
            },
            onApprove: async (data, actions) => {
                try {
                    const response = await fetch(`/store/success?token=${data.orderID}&PayerID=${data.payerID}`, {
                        credentials: 'include'
                    });

                    if (response.ok) {
                        const result = await response.json();
                        window.location.href = `/store-success.html?coinsAdded=${result.coinsAdded}&diamondsAdded=${result.diamondsAdded}`;
                    } else {
                        const error = await response.json();
                        window.location.href = `/store-failed.html?reason=${encodeURIComponent(error.error || 'שגיאה בעיבוד התשלום')}`;
                    }
                } catch (error) {
                    console.error('Payment error:', error);
                    window.location.href = `/store-failed.html?reason=${encodeURIComponent('שגיאה בעיבוד התשלום')}`;
                }
            },
            onError: (err) => {
                console.error('PayPal error:', err);
                this.showError('שגיאה בתשלום PayPal');
            }
        }).render(container);
    }

    async purchasePackage(packageId) {
        if (!this.isAuthenticated) {
            this.showError('עליך להתחבר כדי לרכוש חבילות');
            return;
        }

        const button = event.target;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'מעבד...';

        try {
            // Create PayPal order
            const response = await fetch('/store/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ packageId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'שגיאה ביצירת הזמנה');
            }

            const orderData = await response.json();
            
            // Redirect to PayPal
            window.location.href = orderData.approvalUrl;

        } catch (error) {
            console.error('Purchase error:', error);
            this.showError(error.message || 'שגיאה ברכישה');
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    async handlePaymentReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const payerId = urlParams.get('PayerID');

        if (token && payerId) {
            try {
                console.log('Payment return detected with token:', token, 'payerId:', payerId);
                
                // We need to get the order ID from the server based on the token
                const response = await fetch(`/store/success?token=${token}&PayerID=${payerId}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const result = await response.json();
                    // Redirect to success page with params
                    window.location.href = `/store-success.html?coinsAdded=${result.coinsAdded}&diamondsAdded=${result.diamondsAdded}`;
                    return;
                    // this.showSuccess(`הרכישה הושלמה בהצלחה! נוספו ${result.coinsAdded} מטבעות ו-${result.diamondsAdded} יהלומים`);
                    // Update user info
                    // if (this.userData) {
                    //     this.userData.coins = result.newCoins;
                    //     this.userData.diamonds = result.newDiamonds;
                    //     this.updateUserInfo();
                    // }
                } else {
                    const error = await response.json();
                    window.location.href = `/store-failed.html?reason=${encodeURIComponent(error.error || 'שגיאה בעיבוד התשלום')}`;
                    return;
                    // this.showError(error.error || 'שגיאה בעיבוד התשלום');
                }
            } catch (error) {
                console.error('Payment return error:', error);
                this.showError('שגיאה בעיבוד התשלום');
            }
        }
    }

    showSuccess(message) {
        const successDiv = document.getElementById('successMessage');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 5000);
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Initialize store when page loads
let store;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Store page loaded');
    store = new Store();
    
    // Check if this is a payment return
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token') && urlParams.get('PayerID')) {
        // Wait a bit for the store to initialize
        setTimeout(() => {
            store.handlePaymentReturn();
        }, 1000);
    }
});

// Handle payment cancel
if (window.location.pathname === '/store/cancel') {
    store?.showError('התשלום בוטל');
} 