const firebaseConfig = {
    apiKey: "AIzaSyAz3dYVqV10k7SMtuZIjNhFvaviocEbiQ0",
    authDomain: "masoudi-drive.firebaseapp.com",
    projectId: "masoudi-drive",
    storageBucket: "masoudi-drive.firebasestorage.app",
    messagingSenderId: "1071702393539",
    appId: "1:1071702393539:web:85f6e93b520fa7e1a91876",
    measurementId: "G-5BE1PJ39PL"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
window.auth = auth;
window.db = db;
window.pendingStoreCovers = [];


// Set Auth Persistence to LOCAL for session retention
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(err => console.error("Persistence Error:", err));

// --- Robust Data Parsers ---
function parseCurrency(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Remove anything that isn't a digit, dot, or minus sign
    const sanitized = val.toString().replace(/[^\d.-]/g, '');
    const num = parseFloat(sanitized);
    return isNaN(num) ? 0 : num;
}

// Global flag to track initial auth check completion
window.isInitialAuthCheckDone = false;

// --- Google Identity Services (GSI) Integration ---
const GOOGLE_CLIENT_ID = "1071702393539-5qad3k1165ou5mae3kpshgeultejrssr.apps.googleusercontent.com";

window.handleCredentialResponse = (response) => {
    const credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
    auth.signInWithCredential(credential)
        .then(() => {
            console.log("GSI Login Success");
            localStorage.setItem('masoudi_has_session', 'true'); // Set persistence flag
            
            // Auto-close modal if it's open (Fallback for onAuthStateChanged)
            const modal = document.getElementById('loginModal');
            if (modal) modal.style.display = 'none';
        })
        .catch(err => {
            console.error("GSI Login Error:", err);
            window.showToast?.("خطأ في تسجيل الدخول عبر جوجل");
        });
};

function initGSI() {
    if (typeof google === 'undefined') {
        console.warn("GSI: 'google' library not loaded yet, retrying...");
        setTimeout(initGSI, 1000); 
        return;
    }
    try {
        console.log("GSI: Initializing with ID:", GOOGLE_CLIENT_ID);
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: window.handleCredentialResponse,
            auto_select: true,
            cancel_on_tap_outside: false
        });
        
        const renderGoogleBtn = (id) => {
            const el = document.getElementById(id);
            if (el) {
                google.accounts.id.renderButton(el, {
                    theme: "filled_blue", size: "large", width: 320, text: "signin_with", shape: "rectangular", logo_alignment: "left"
                });
                console.log(`GSI: Button rendered into #${id}`);
                
                // Hide fallback ONLY if GSI actually rendered content
                setTimeout(() => {
                    const fallback = document.getElementById('gsiFallbackBtn');
                    if (el.innerHTML !== "" && fallback) {
                        fallback.style.display = 'none';
                        console.log("GSI: Success, hiding fallback button");
                    }
                }, 500);
            }
        };

        renderGoogleBtn("g_id_signin");
        renderGoogleBtn("g_id_signin_driver");

    } catch (err) {
        console.error("GSI Initialization Error:", err);
        const fallback = document.getElementById('gsiFallbackBtn');
        if (fallback) fallback.style.display = 'flex';
    }
}

// Initialize GSI when window loads
window.addEventListener('load', initGSI);

window.triggerGoogleLogin = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
        if (err.code === 'auth/popup-blocked') {
            auth.signInWithRedirect(provider);
        } else {
            alert("خطأ: " + err.message);
        }
    });
};

// Load Delivery Config as early as possible
loadDeliveryConfig();

// --- Dynamic Site Configuration ---
async function applySiteConfig() {
    try {
        const doc = await db.collection('settings').doc('siteConfig').get();
        if (doc.exists) {
            const data = doc.data();
            
            // Apply Primary Color
            if (data.primaryColor) {
                document.documentElement.style.setProperty('--primary', data.primaryColor);
            }
            // Apply Main Logo
            if (data.siteLogo) {
                const logos = document.querySelectorAll('.brand-icon-wrapper img');
                logos.forEach(img => img.src = data.siteLogo);
            }
            // Apply Favicon
            if (data.siteFavicon) {
                const iconLinks = document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]');
                iconLinks.forEach(link => link.href = data.siteFavicon);
            }
            // Apply Startup Icon
            if (data.startupIcon) {
                const sphere = document.querySelector('.central-sphere');
                if (sphere) {
                    const svg = sphere.querySelector('svg');
                    if (svg) svg.style.display = 'none';
                    let img = sphere.querySelector('.dynamic-startup-img');
                    if (!img) {
                        img = document.createElement('img');
                        img.className = 'dynamic-startup-img';
                        img.style.cssText = 'width: 45px; height: 45px; object-fit: contain; z-index: 2; position: relative;';
                        sphere.appendChild(img);
                    }
                    img.src = data.startupIcon;
                }
            }
            // Apply Category Layout (Grid vs Scroll)
            if (data.categoryLayout) {
                window.categoryLayout = data.categoryLayout;
                const container = document.getElementById('categoryPills');
                if (container) {
                    if (data.categoryLayout === 'grid') {
                        container.classList.add('grid-mode');
                    } else {
                        container.classList.remove('grid-mode');
                    }
                }
            }
        } else {
            window.geminiKey = null;
        }
    } catch (err) {
        console.error("Failed to apply site config:", err);
    }
}
applySiteConfig();

window.loyaltyConfig = {
    earnAmount: 1000,
    earnPoints: 200,
    redeemThreshold: 200,
    redeemValue: 10,
    levelCollecting: 'جمع النقاط',
    levelReady: 'مكافأة جاهزة',
    successMessage: '🎁 مبروك! الشريط ممتلئ، استبدل الآن'
};

async function applyLoyaltyConfig() {
    try {
        const doc = await db.collection('settings').doc('loyaltyConfig').get();
        if (doc.exists) {
            window.loyaltyConfig = { ...window.loyaltyConfig, ...doc.data() };
        }
    } catch (e) { console.error("Failed to load loyalty config", e); }
}
applyLoyaltyConfig();

// --- Check for Referral in URL ---
const urlParams = new URLSearchParams(window.location.search);
const refCode = urlParams.get('ref');
if (refCode) {
    sessionStorage.setItem('referral_code', refCode);
    // Clean URL to keep it pretty
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
}

// Global Error Handler for Debugging
window.onerror = function(msg, url, line, col, error) {
    console.error("Global Error:", msg, "at", line, ":", col);
    // Only alert for major issues that prevent button clicks
    if(msg.includes('getLocation') || msg.includes('navigateTo')) {
        alert("⚠️ حدث خطأ في البرمجة: " + msg);
    }
    return false;
};
// Register Service Worker for PWA
let deferredPrompt;
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('Service Worker Registered!');
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // New update available!
                                console.log('New update found, reloading...');
                                window.location.reload();
                            }
                        }
                    };
                };
            })
            .catch(err => console.log('Service Worker Registration Failed', err));
    });
}

// PWA Install Logic
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser prompt
    e.preventDefault();
    // Save the event so it can be triggered later
    deferredPrompt = e;
    // Show our custom install banner
    const installBanner = document.getElementById('pwaInstallBanner');
    if (installBanner && !localStorage.getItem('pwaBannerDismissed')) {
        installBanner.style.display = 'flex';
    }
});

window.closeInstallBanner = () => {
    document.getElementById('pwaInstallBanner').style.display = 'none';
    localStorage.setItem('pwaBannerDismissed', 'true');
};

document.getElementById('installPwaBtn')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    // Show the browser install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again
    deferredPrompt = null;
    // Hide our banner
    document.getElementById('pwaInstallBanner').style.display = 'none';
});

// const db = firebase.firestore();
// Disable Firestore Offline Cache to ensure 100% real-time accuracy and stability of wallet balances/points
// db.enablePersistence({ synchronizeTabs: true })
//   .catch((err) => {
//       console.warn("Firestore offline cache state:", err.message);
//   });
const storage = firebase.storage();

/**
 * Robust File Upload Helper for Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} path - The storage path (e.g., 'products', 'merchants/logos')
 * @returns {Promise<string>} - The download URL
 */
/**
 * Compresses and converts a file to a Base64 string (Fallback when Storage is not available)
 * @param {File} file - The file to compress
 * @param {number} maxWidth - Max width of the image
 * @returns {Promise<string>} - Base64 string
 */
async function compressAndEncodeImage(file, maxWidth = 800) {
    if (!file) return null;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Use JPEG with 0.5 quality for larger images to save space (Firestore 1MB limit)
                const quality = maxWidth > 500 ? 0.5 : 0.7;
                const base64 = canvas.toDataURL('image/jpeg', quality);
                resolve(base64);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

/**
 * Uploads a file. Now uses Base64 fallback by default to avoid credit card requirements.
 */
async function uploadFile(file, path) {
    console.log(`Processing image for: ${path}`);
    try {
        // We use Base64 compression to stay under Firestore's 1MB limit per document.
        // This avoids the need for Firebase Storage setup/billing.
        const base64 = await compressAndEncodeImage(file, path.includes('logo') ? 300 : 1600);
        console.log("Image compressed and encoded to Base64");
        return base64;
    } catch (error) {
        console.error("Image Processing Error:", error);
        throw new Error("فشل معالجة الصورة. يرجى المحاولة مرة أخرى.");
    }
}
const provider = new firebase.auth.GoogleAuthProvider();

// --- Image Preview Helper ---
window.previewImage = (input, previewId) => {
    const preview = document.getElementById(previewId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
};

window.showToast = (msg) => {
    // Detect message type to choose the perfect icon and styling
    let iconSvg = '';
    let iconBg = '#ff6b00'; // Default orange
    
    if (msg.includes('سلة') || msg.includes('سلة المشتريات') || msg.includes('إضافة') || msg.includes('منتج')) {
        // Cart-related
        iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
        iconBg = '#ff6b00'; // Brand orange
    } else if (msg.includes('نجاح') || msg.includes('تم ') || msg.includes('تمت') || msg.includes('بنجاح')) {
        // Success
        iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        iconBg = '#10b981'; // Fresh Green
    } else if (msg.includes('خطأ') || msg.includes('فشل') || msg.includes('عفواً') || msg.includes('تنبيه')) {
        // Warning/Error
        iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        iconBg = '#ef4444'; // Red
    } else {
        // Info
        iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        iconBg = '#3b82f6'; // Blue
    }

    // Determine current theme to adapt background colors
    const isDark = document.body.classList.contains('dark-theme') || (document.documentElement.getAttribute('data-theme') === 'dark');
    const toastBg = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const toastColor = isDark ? '#f8fafc' : '#1e293b';
    const toastBorder = isDark ? 'rgba(255, 107, 0, 0.35)' : 'rgba(255, 107, 0, 0.22)';

    const toast = document.createElement('div');
    toast.className = 'premium-toast-alert';
    toast.style.cssText = `
        position: fixed; top: 25px; left: 50%; transform: translateX(-50%);
        background: ${toastBg}; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        color: ${toastColor}; padding: 10px 20px; border-radius: 16px;
        font-family: 'Cairo', sans-serif; font-weight: 700; font-size: 0.88rem; z-index: 300000;
        box-shadow: 0 12px 35px rgba(255, 107, 0, 0.15), 0 4px 10px rgba(0,0,0,0.04);
        border: 1.5px solid ${toastBorder};
        display: flex; align-items: center; gap: 12px;
        direction: rtl;
        animation: slideDownToast 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    `;
    
    toast.innerHTML = `
        <div style="width: 26px; height: 26px; border-radius: 50%; background: ${iconBg}; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 0 10px ${iconBg}4d; flex-shrink: 0;">
            ${iconSvg}
        </div>
        <span style="line-height: 1.4; display: inline-block;">${msg}</span>
    `;
    
    document.body.appendChild(toast);
    
    if (!document.getElementById('toastStyles')) {
        const style = document.createElement('style');
        style.id = 'toastStyles';
        style.innerHTML = `
            @keyframes slideDownToast {
                from { opacity: 0; transform: translate(-50%, -35px) scale(0.92); }
                to { opacity: 1; transform: translate(-50%, 0) scale(1); }
            }
            @keyframes slideUpToast {
                from { opacity: 1; transform: translate(-50%, 0) scale(1); }
                to { opacity: 0; transform: translate(-50%, -35px) scale(0.92); }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        toast.style.animation = 'slideUpToast 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards';
        setTimeout(() => toast.remove(), 400);
    }, 2800);
};

// --- Delivery Calculation Logic ---
let deliveryConfig = {
    pricePerKm: 15,
    storeLat: null,
    storeLng: null
};

async function loadDeliveryConfig() {
    try {
        const doc = await db.collection('settings').doc('store').get();
        if (doc.exists) {
            const data = doc.data();
            deliveryConfig.pricePerKm = data.pricePerKm || 15;
            deliveryConfig.storeLat = parseFloat(data.storeLat);
            deliveryConfig.storeLng = parseFloat(data.storeLng);
        }
    } catch (err) { console.error("Load Delivery Config Error:", err); }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

// Geolocation logic (Moved to Top for reliability)
window.getLocation = (targetAddressId = 'checkoutAddress', targetLatlngId = 'latlng', targetStatusId = 'locationStatus') => {
    console.log("GPS Triggered for:", targetAddressId);
    const status = document.getElementById(targetStatusId);
    const latlngInput = document.getElementById(targetLatlngId);
    const addressInput = document.getElementById(targetAddressId);
    
    if (!navigator.geolocation) {
        if(status) status.textContent = "❌ متصفحك لا يدعم خاصية تحديد الموقع";
        return;
    }

    if(status) {
        status.textContent = "⏳ جاري البحث عن موقعك... (يرجى السماح بالوصول)";
        status.style.color = "var(--primary)";
    }
    
    const options = { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 0 
    };

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        if(latlngInput) latlngInput.value = `${lat},${lng}`;
        
        let accuracyMsg = accuracy < 100 ? "بدقة عالية" : "بدقة تقريبية";
        if(status) {
            status.textContent = `✅ تم تحديد موقعك ${accuracyMsg}، جاري جلب العنوان...`;
            status.style.color = "var(--primary)";
        }
        
        try {
            // Priority: Use the coordinates for the map link later, but show the address now
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar`);
            const data = await response.json();
            if (data && data.display_name) {
                if(addressInput) addressInput.value = data.display_name;
                if(status) {
                    status.textContent = `✅ تم تحديد موقعك (${accuracyMsg})`;
                    status.style.color = "#10B981";
                    
                    // Force update delivery fee with fresh coords
                    if (deliveryConfig.storeLat && deliveryConfig.storeLng) {
                        const distance = calculateDistance(deliveryConfig.storeLat, deliveryConfig.storeLng, lat, lng);
                        const fee = Math.ceil(distance * deliveryConfig.pricePerKm);
                        window.currentDeliveryFee = fee;
                        
                        const feeEl = document.getElementById('deliveryFeeAmount');
                        const feeDisplay = document.getElementById('deliveryFeeDisplay');
                        if (feeEl) {
                            feeEl.textContent = `${fee} ج.م`;
                            if(feeDisplay) {
                                feeDisplay.innerHTML = `🚲 مصاريف التوصيل (${distance.toFixed(1)} كم):`;
                                feeDisplay.parentElement.style.display = 'flex';
                            }
                        }
                        updateCheckoutTotal();
                    }
                }
            } else {
                if(status) status.textContent = `✅ تم تحديد الإحداثيات (${accuracyMsg})`;
            }
        } catch (error) {
            if(status) status.textContent = "✅ تم تحديد الإحداثيات بنجاح";
        }
    }, (err) => {
        let errorMsg = "❌ فشل تحديد الموقع";
        if (err.code === 1) errorMsg = "❌ يرجى تفعيل إذن الوصول للموقع لتحديد عنوانك بدقة";
        if (err.code === 3) errorMsg = "⏳ استغرق البحث وقتاً طويلاً، يرجى المحاولة مرة أخرى في مكان مكشوف";
        
        if(status) {
            status.textContent = errorMsg;
            status.style.color = "#EF4444";
        }
        alert(errorMsg);
    }, options);
};

let products = [];
let isMerchantUser = false;
let cart = JSON.parse(localStorage.getItem('masoudi_cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('masoudi_wishlist')) || [];

// Navbar Elements
const navbar = document.querySelector('.floating-header');
const cartBadge = document.getElementById('cartBadge');
const productsGrid = document.getElementById('productsGrid');

// Theme Management Removed

// Format Price
const formatPrice = (p) => `<span class="price-num">${p.toLocaleString()}</span> <span class="price-currency">ج.م</span>`;

// Navbar Scroll Effect


// Dynamic Banner Settings
async function loadBannerSettings() {
    try {
        const doc = await db.collection('settings').doc('bannerSlider').get();
        if (doc.exists) {
            const data = doc.data();
            const desktopH = data.heightDesktop ? Math.max(data.heightDesktop, 100) : 240;
            const mobileH = data.heightMobile ? Math.max(data.heightMobile, 280) : 280;
            document.documentElement.style.setProperty('--banner-height-desktop', desktopH + 'px');
            document.documentElement.style.setProperty('--banner-height-mobile', mobileH + 'px');
            
            if (data.widthDesktop) document.documentElement.style.setProperty('--banner-width-desktop', data.widthDesktop + 'px');
            if (data.widthMobile) document.documentElement.style.setProperty('--banner-width-mobile', data.widthMobile + '%');
            
            // Also update slider duration if available
            if (data.duration) {
                window.sliderInterval = data.duration * 1000;
            }
        }
    } catch (err) { console.error("Error loading banner settings:", err); }
}
loadBannerSettings();

// Fetch Products from Firestore
// Consolidated Fetch Products
async function fetchProducts() {
    try {
        if(typeof renderSkeletons === 'function') renderSkeletons();
        const snapshot = await db.collection('products').get();
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Calculate best sellers dynamically based on real order counts
        calculateDynamicBestSellers();
        
        // Fetch Merchants for the store-first view
        if(typeof loadMerchants === 'function') {
            await loadMerchants();
        } else {
            renderProducts(products);
        }
    } catch (error) {
        console.error("Error fetching products:", error);
    }
}

window.dynamicBestSellerIds = [];
function calculateDynamicBestSellers() {
    if (!products || products.length === 0) return;
    
    // Get all products with at least 1 sale and sort descending
    const sorted = [...products]
        .filter(p => p.salesCount && p.salesCount > 0)
        .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
        
    // Take the top 4 highest selling products in the store
    window.dynamicBestSellerIds = sorted.slice(0, 4).map(p => p.id);
    console.log("Calculated Dynamic Best Sellers:", window.dynamicBestSellerIds);
}

function renderSkeletons() {
    if(!productsGrid) return;
    productsGrid.innerHTML = '';
    for(let i=0; i<8; i++) {
        const skel = document.createElement('div');
        skel.className = 'skeleton-card-ui';
        skel.innerHTML = `
            <div class="skeleton-item skeleton-img"></div>
            <div class="skeleton-item skeleton-text"></div>
            <div class="skeleton-item skeleton-price"></div>
        `;
        productsGrid.appendChild(skel);
    }
}

// Render Products with Advanced Features
// Create Product Card HTML helper to keep code DRY
function createProductCardHTML(p) {
    const finalPrice = p.discount > 0 ? p.price * (1 - p.discount/100) : p.price;
    const card = document.createElement('div');
    card.className = 'product-card fade-in';
    
    // Render badges based on tag, discount, or real salesCount!
    let badgeHTML = '';
    const isDynamicBestSeller = window.dynamicBestSellerIds && window.dynamicBestSellerIds.includes(p.id);
    
    if (p.discount > 0) {
        badgeHTML = `<span class="badge badge-discount">خصم ${p.discount}%</span>`;
    } else if (p.tag === 'new') {
        badgeHTML = `<span class="badge badge-new">جديد ✨</span>`;
    } else if (p.tag === 'bestseller' || p.tag === 'hot' || isDynamicBestSeller) {
        badgeHTML = `<span class="badge badge-hot">الأكثر مبيعاً 🔥</span>`;
    } else if (p.tag === 'limited') {
        badgeHTML = `<span class="badge badge-limited">كمية محدودة ⏳</span>`;
    } else if (p.tag === 'discount') {
        badgeHTML = `<span class="badge badge-discount">عرض خاص 🏷️</span>`;
    }

    const isWishlisted = wishlist.includes(p.id);

    card.innerHTML = `
        <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" onclick="toggleWishlist(this, '${p.id}')">
            <i data-lucide="heart" ${isWishlisted ? 'fill="currentColor"' : ''}></i>
        </button>
        ${badgeHTML}
        <div class="image-wrapper" onclick="openQuickView('${p.id}')" style="cursor:pointer;">
            <img src="${p.image}" alt="${p.name}" loading="lazy">
        </div>
        <div class="product-info">
            <span class="category-label">${p.category || 'عام'}</span>
            <h3>${p.name}</h3>
            <div class="rating-bar">
                <div class="rating-stars">
                    ${'★'.repeat(Math.round(p.rating || 5))}${'☆'.repeat(5-Math.round(p.rating || 5))}
                </div>
                <span class="rating-count">(${p.rating ? parseFloat(p.rating).toFixed(1) : '5.0'}) (${p.ratingCount || 0})</span>
            </div>
            <div class="price-container">
                <div class="price-wrapper">
                    ${p.discount > 0 ? `<span class="old-price">${formatPrice(p.price)}</span>` : ''}
                    <span class="current-price">${formatPrice(finalPrice)}</span>
                </div>
                <button class="add-to-cart-quick" onclick="addToCart('${p.id}')">
                    <i data-lucide="plus"></i>
                </button>
            </div>
        </div>
    `;
    return card;
}

// Render Products with Advanced Features
function renderProducts(filtered = products, forceProducts = false) {
    if(!productsGrid) return;
    
    // Restore Header if we are indeed in products view
    const header = document.querySelector('.floating-header');
    if (header) header.classList.remove('header-minimal');
    
    // IF we are on Home (no search, no category filter) AND NOT forced to products
    const searchInput = document.getElementById('searchInput');
    const searchVal = searchInput ? searchInput.value.trim() : '';
    const currentCat = window.currentCategoryFilter || 'all';

    // If we are on Home (no search, no category filter) AND NOT forced to products
    const isMainHome = currentCat === 'all' && searchVal.length === 0;

    if (!forceProducts && isMainHome && typeof renderStores === 'function' && window.merchants && window.merchants.length > 0) {
        renderStores();
        return;
    }

    productsGrid.innerHTML = '';

    // If search is active or category filter is active, render matching stores first
    if (searchVal.length > 0 || currentCat !== 'all') {
        if (typeof renderStores === 'function' && window.merchants && window.merchants.length > 0) {
            renderStores(true); // Render but don't clear
        }
        
        // If a category is selected (not searching), the user wants to see ONLY stores
        if (currentCat !== 'all' && searchVal.length === 0) {
            if (window.lucide) lucide.createIcons();
            return; // EXIT EARLY: Do not display products for category navigation
        }

        if (filtered.length > 0) {
            const h = document.createElement('h2');
            h.style.cssText = "grid-column: 1/-1; margin: 30px 10px 15px; font-family: 'Cairo', sans-serif; font-weight: 1000; font-size: 1.15rem; color: #1e293b; border-right: 4px solid var(--primary); padding-right: 12px;";
            h.textContent = "المنتجات المتاحة";
            productsGrid.appendChild(h);
        }
    }
    
    if(filtered.length === 0) {
        productsGrid.classList.add('products-grid');
        productsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 100px; color: var(--text-muted);"><h3>لا توجد منتجات تطابق بحثك حالياً</h3></div>';
        return;
    }

    // If search is active or category filter is active, render flat list
    if (searchVal.length > 0 || currentCat !== 'all' || !window.allCategories || Object.keys(window.allCategories).length === 0) {
        productsGrid.classList.add('products-grid');
        
        filtered.forEach(p => {

            const card = createProductCardHTML(p);
            productsGrid.appendChild(card);
        });
        
        if (window.lucide) lucide.createIcons();
        return;
    }

    // Otherwise, render dynamically grouped sections!
    productsGrid.classList.remove('products-grid');

    // Group products by category
    const grouped = {};
    filtered.forEach(p => {

        const catId = p.category || 'other';
        if (!grouped[catId]) grouped[catId] = [];
        grouped[catId].push(p);
    });

    // Render each category section
    Object.keys(grouped).forEach(catId => {
        const catProds = grouped[catId];
        if (catProds.length === 0) return;

        // Get category info
        const translation = {
            'electronics': 'إلكترونيات',
            'fashion': 'أزياء',
            'home': 'المنزل',
            'offers': 'عروض جملة',
            'other': 'منتجات عامة'
        };
        const catInfo = window.allCategories[catId] || { name: translation[catId] || catId, icon: 'tag' };
        let catName = catInfo.name;
        if (translation[catId] && (catName === catId || /^[a-zA-Z\s]+$/.test(catName))) {
            catName = translation[catId];
        }
        const catIcon = catInfo.icon || 'tag';

        // Limit to 4 products in overview mode
        const hasMore = catProds.length > 4;
        const displayProds = catProds.slice(0, 4);

        // Create Section element
        const section = document.createElement('div');
        section.className = 'category-section fade-in';
        section.style.cssText = "margin-bottom: 45px; background: white; padding: 24px; border-radius: 28px; border: 1px solid rgba(241,245,249,0.8); box-shadow: 0 10px 30px rgba(15,23,42,0.02);";

        // Section header with "View All" button
        section.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 15px; direction: rtl;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="background: var(--primary-light); color: var(--primary); width: 42px; height: 42px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px var(--primary-glow);">
                        <i data-lucide="${catIcon}" style="width: 20px; height: 20px;"></i>
                    </div>
                    <div style="text-align: right;">
                        <h3 style="font-size: 1.25rem; font-weight: 950; color: #0f172a; margin: 0; font-family: 'Cairo', sans-serif;">${catName}</h3>
                        <p style="font-size: 0.65rem; color: #94a3b8; font-weight: 700; margin: 2px 0 0;">منتجات ممتازة ومختارة بعناية</p>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 0.7rem; font-weight: 900; color: var(--primary); background: var(--primary-light); padding: 6px 14px; border-radius: 50px;">
                        ${catProds.length} منتج
                    </span>
                </div>
            </div>
        `;

        // Create Grid container inside the section
        const grid = document.createElement('div');
        grid.className = 'products-grid';

        displayProds.forEach(p => {
            const card = createProductCardHTML(p);
            grid.appendChild(card);
        });

        if (hasMore) {
            const viewAllCard = document.createElement('div');
            viewAllCard.className = 'product-card fade-in';
            viewAllCard.style.cssText = 'display: flex; flex-direction: column; justify-content: center; align-items: center; cursor: pointer; background: var(--primary-light); box-shadow: none; border: 2px dashed rgba(255, 107, 0, 0.3); transition: all 0.3s ease; text-align: center; min-height: 250px;';
            viewAllCard.onclick = () => window.viewAllCategory(catId);
            viewAllCard.onmouseover = () => { viewAllCard.style.background = 'var(--primary)'; viewAllCard.style.color = 'white'; const i = viewAllCard.querySelector('i'); if(i){ i.style.color = 'var(--primary)'; } const h = viewAllCard.querySelector('h3'); if(h) h.style.color = 'white'; const s = viewAllCard.querySelector('span'); if(s) s.style.color = 'rgba(255,255,255,0.8)'; };
            viewAllCard.onmouseout = () => { viewAllCard.style.background = 'var(--primary-light)'; viewAllCard.style.color = 'inherit'; const i = viewAllCard.querySelector('i'); if(i){ i.style.color = 'var(--primary)'; } const h = viewAllCard.querySelector('h3'); if(h) h.style.color = 'var(--primary)'; const s = viewAllCard.querySelector('span'); if(s) s.style.color = '#64748b'; };
            viewAllCard.innerHTML = `
                <div style="background: white; width: 50px; height: 50px; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-bottom: 15px; color: var(--primary); box-shadow: 0 4px 10px rgba(0,0,0,0.05); transition: all 0.3s ease;">
                    <i data-lucide="arrow-left" style="width: 24px; height: 24px;"></i>
                </div>
                <h3 style="color: var(--primary); font-family: 'Cairo', sans-serif; font-weight: 900; margin: 0; font-size: 1.1rem; transition: all 0.3s ease;">عرض الكل</h3>
                <span style="font-size: 0.8rem; color: #64748b; font-weight: 700; margin-top: 5px; transition: all 0.3s ease;">+${catProds.length - 4} منتجات أخرى</span>
            `;
            grid.appendChild(viewAllCard);
        }

        section.appendChild(grid);
        productsGrid.appendChild(section);
    });

    if (typeof renderOffers === 'function') renderOffers();
    if (window.lucide) lucide.createIcons();
}

// --- Image Zoom Logic ---
function setupZoom(container) {
    const img = container.querySelector('img');
    
    container.addEventListener('mousemove', (e) => {
        const { left, top, width, height } = container.getBoundingClientRect();
        const x = ((e.pageX - left - window.scrollX) / width) * 100;
        const y = ((e.pageY - top - window.scrollY) / height) * 100;
        
        img.style.transformOrigin = `${x}% ${y}%`;
        img.style.transform = "scale(2)";
    });
    
    container.addEventListener('mouseleave', () => {
        img.style.transform = "scale(1)";
        img.style.transformOrigin = "center center";
    });
}

window.toggleWishlist = (btn, id) => {
    const index = wishlist.indexOf(id);
    if (index === -1) {
        wishlist.push(id);
        btn.classList.add('active');
        const icon = btn.querySelector('i') || btn.querySelector('svg');
        if(icon) icon.setAttribute('fill', 'currentColor');
        window.showToast("تمت الإضافة للمفضلة ❤️");
    } else {
        wishlist.splice(index, 1);
        btn.classList.remove('active');
        const icon = btn.querySelector('i') || btn.querySelector('svg');
        if(icon) icon.setAttribute('fill', 'none');
        window.showToast("تمت الإزالة من المفضلة");
    }
    localStorage.setItem('masoudi_wishlist', JSON.stringify(wishlist));
    updateWishlistUI();
};

function updateWishlistUI() {
    const grid = document.getElementById('wishlistGrid');
    const badge = document.getElementById('wishlistBadge');
    const emptyView = document.getElementById('emptyWishlistView');
    
    if (badge) {
        badge.textContent = wishlist.length;
        badge.style.display = wishlist.length > 0 ? 'flex' : 'none';
    }

    if (!grid) return;

    const wishlistProducts = products.filter(p => wishlist.includes(p.id));

    if (wishlistProducts.length === 0) {
        grid.style.display = 'none';
        if (emptyView) emptyView.style.display = 'block';
    } else {
        grid.style.display = 'grid';
        if (emptyView) emptyView.style.display = 'none';
        
        grid.innerHTML = '';
        wishlistProducts.forEach(p => {
            const finalPrice = p.discount > 0 ? p.price * (1 - p.discount/100) : p.price;
            const card = document.createElement('div');
            card.className = 'product-card fade-in';
            
            let badgeHTML = '';
            const isDynamicBestSeller = window.dynamicBestSellerIds && window.dynamicBestSellerIds.includes(p.id);
            if (p.discount > 0) {
                badgeHTML = `<span class="badge badge-discount">خصم ${p.discount}%</span>`;
            } else if (p.tag === 'bestseller' || p.tag === 'hot' || isDynamicBestSeller) {
                badgeHTML = `<span class="badge badge-hot">الأكثر مبيعاً 🔥</span>`;
            }

            card.innerHTML = `
                <button class="wishlist-btn active" onclick="toggleWishlist(this, '${p.id}')">
                    <i data-lucide="heart" fill="currentColor"></i>
                </button>
                ${badgeHTML}
                <div class="image-wrapper" onclick="openQuickView('${p.id}')" style="cursor:pointer;">
                    <img src="${p.image}" alt="${p.name}" loading="lazy">
                </div>
                <div class="product-info">
                    <span class="category-label">${p.category || 'عام'}</span>
                    <h3>${p.name}</h3>
                    <div class="price-container">
                        <div class="price-wrapper">
                            ${p.discount > 0 ? `<span class="old-price">${formatPrice(p.price)}</span>` : ''}
                            <span class="current-price">${formatPrice(finalPrice)}</span>
                        </div>
                        <button class="add-to-cart-quick" onclick="addToCart('${p.id}')">
                            <i data-lucide="plus"></i>
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        lucide.createIcons();
    }
}

// Cart Logic
function addToCart(productId) {
    if (!auth.currentUser) {
        document.getElementById('loginModal').style.display = 'flex';
        return;
    }
    const product = products.find(p => p.id === productId);
    if(!product) return;
    
    // Check if store is open (Manual + Schedule)
    const store = window.merchants ? window.merchants.find(m => m.id === product.merchantId || (m.ownerUid && m.ownerUid === product.merchantId)) : null;
    if (store && isStoreCurrentlyOpen(store) === false) {
        window.showToast("⚠️ عذراً، هذا المتجر مغلق حالياً ولا يمكن استقبال طلبات جديدة.");
        return;
    }
    
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        const finalPrice = product.discount > 0 ? product.price * (1 - product.discount/100) : product.price;
        cart.push({ ...product, price: finalPrice, quantity: 1 });
    }
    
    updateCartUI();
    window.showToast("تمت الإضافة للسلة بنجاح ✅");
}

function updateCartUI() {
    const itemsContainer = document.getElementById('cartItems');
    const pageItemsContainer = document.getElementById('cartPageItems');
    const totalEl = document.getElementById('cartTotal'); // Hidden but keep for compatibility if needed
    const pageTotalEl = document.getElementById('cartPageTotal');
    const pageSubtotalEl = document.getElementById('cartSubtotal');
    const badge = document.getElementById('cartBadge');
    const bottomBadge = document.getElementById('bottomNavCartBadge');
    
    // Save to LocalStorage
    localStorage.setItem('masoudi_cart', JSON.stringify(cart));
    
    let total = 0;
    let count = 0;

    if(itemsContainer) itemsContainer.innerHTML = '';
    if(pageItemsContainer) pageItemsContainer.innerHTML = '';

    const cartPageGrid = document.getElementById('cartPageGrid');
    const emptyCartView = document.getElementById('emptyCartView');
    const hasActiveOrders = document.getElementById('myOrdersContainerPage') && document.getElementById('myOrdersContainerPage').style.display === 'block';

    if(cart.length === 0 && !hasActiveOrders) {
        if(cartPageGrid) cartPageGrid.style.display = 'none';
        if(emptyCartView) emptyCartView.style.display = 'block';
    } else {
        if(cartPageGrid) cartPageGrid.style.display = 'grid';
        if(emptyCartView) emptyCartView.style.display = 'none';
    }

    cart.forEach(item => {
        total += item.price * item.quantity;
        count += item.quantity;
        
        // Side Drawer View
        if(itemsContainer) {
            const div = document.createElement('div');
            div.style.cssText = "display:flex; gap:15px; align-items:center; margin-bottom:20px; background:#fff; padding:10px; border-radius:12px; border:1px solid #f1f5f9;";
            div.innerHTML = `
                <img src="${item.image}" style="width:60px; height:60px; border-radius:10px; object-fit:cover;">
                <div style="flex:1;">
                    <h4 style="font-size:0.9rem;">${item.name}</h4>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                        <span style="color:var(--primary); font-weight:800;">${item.price.toLocaleString()} ج.م</span>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <button onclick="changeQty('${item.id}', -1)" style="border:none; background:none; cursor:pointer; font-weight:800;">-</button>
                            <span>${item.quantity}</span>
                            <button onclick="changeQty('${item.id}', 1)" style="border:none; background:none; cursor:pointer; font-weight:800;">+</button>
                        </div>
                    </div>
                </div>
                <button onclick="removeItem('${item.id}')" style="border:none; background:none; cursor:pointer; color:#EF4444;"><i data-lucide="trash-2" style="width:18px;"></i></button>
            `;
            itemsContainer.appendChild(div);
        }

        // Full Page View
        const itemHTML = `
            <div class="cart-item-row fade-in" style="background:#fcfcfc; border-radius:18px; padding:12px; margin-bottom:12px; border:1px solid #f1f5f9; position:relative; display:flex; align-items:center; gap:15px;">
                <img src="${item.image}" style="width:75px; height:75px; border-radius:14px; object-fit:cover; border:2px solid white; box-shadow:0 5px 15px rgba(0,0,0,0.05);">
                
                <div style="flex:1; display:flex; flex-direction:column; gap:5px;">
                    <h4 style="font-size:0.9rem; font-weight:800; color:#1e293b; margin:0;">${item.name}</h4>
                    <div style="font-size:0.8rem; color:#94a3b8; font-weight:600;">${item.price.toLocaleString()} ج.م</div>
                    <div style="font-weight:900; color:var(--primary); font-size:1rem;">${(item.price * item.quantity).toLocaleString()} ج.م</div>
                </div>

                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                    <button onclick="removeItem('${item.id}')" style="background:#fee2e2; color:#ef4444; border:none; width:30px; height:30px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="trash-2" style="width:16px;"></i>
                    </button>
                    
                    <div style="display:flex; align-items:center; background:white; border:1px solid #e2e8f0; border-radius:12px; padding:4px 8px; gap:10px; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                        <button onclick="changeQty('${item.id}', -1)" style="background:none; border:none; cursor:pointer; color:#64748b; padding:2px;">
                            <i data-lucide="minus-circle" style="width:18px;"></i>
                        </button>
                        <span style="font-weight:900; font-size:0.9rem; min-width:15px; text-align:center;">${item.quantity}</span>
                        <button onclick="changeQty('${item.id}', 1)" style="background:none; border:none; cursor:pointer; color:var(--primary); padding:2px;">
                            <i data-lucide="plus-circle" style="width:18px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        if(pageItemsContainer) pageItemsContainer.insertAdjacentHTML('beforeend', itemHTML);
    });

    if(totalEl) totalEl.textContent = `${total.toLocaleString()} ج.م`;
    if(pageTotalEl) pageTotalEl.textContent = `${total.toLocaleString()} ج.م`;
    if(pageSubtotalEl) pageSubtotalEl.textContent = `${total.toLocaleString()} ج.م`;
    if(badge) badge.textContent = count;
    if(bottomBadge) bottomBadge.textContent = count;

    lucide.createIcons();
}

window.navigateTo = (pageId, scrollToProducts = false) => {
    const header = document.querySelector('.floating-header');
    if (header) {
        // Show header only on home, store detail, cart, and wishlist
        const showHeaderOn = ['homePage', 'cartPage', 'wishlistPage', 'searchPage'];
        if (showHeaderOn.includes(pageId)) {
            header.style.display = 'block';
            // Only keep minimal if on homePage AND stores are rendered (handled by renderStores)
            // But to be safe, we remove it here and let renderStores/renderProducts handle it
            header.classList.remove('header-minimal');
        } else {
            header.style.display = 'none';
        }
    }


    // Hide all sections with extreme prejudice
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
        // Force hide specific heavy elements if needed
        if (sec.id === 'storeDetailPage') {
            sec.setAttribute('aria-hidden', 'true');
        }
    });
    
    // Authentication Guard for Profile and History Page
    if ((pageId === 'contactPage' || pageId === 'historyPage') && !auth.currentUser) {
        if (window.isInitialAuthCheckDone) {
            document.getElementById('loginModal').style.display = 'flex';
            window.showToast("يرجى تسجيل الدخول أولاً للوصول لبياناتك 🔑");
            return;
        }
    }

    // Show target section
    const target = document.getElementById(pageId);
    if(target) {
        console.log(`[NAV] Switching to: ${pageId}`);
        target.classList.add('active');
        target.style.display = 'block';
        if (pageId === 'storeDetailPage') {
            target.setAttribute('aria-hidden', 'false');
        }
        // Force browser to acknowledge the change
        void target.offsetHeight; 
    }

    // Toggle common sections (removed as sections are now page-specific)

    // Merchant Security Guard
    if (pageId === 'merchantPage') {
        if (!auth.currentUser) {
            document.getElementById('loginModal').style.display = 'flex';
            return;
        }
        if (!isMerchantUser) {
            const modal = document.getElementById('merchantAccessModal');
            if (modal) {
                modal.style.display = 'flex';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            // Add this to revert the page view to contactPage
            document.querySelectorAll('.page-section').forEach(sec => {
                sec.classList.remove('active');
                sec.style.display = 'none';
            });
            const cp = document.getElementById('contactPage');
            if (cp) {
                cp.classList.add('active');
                cp.style.display = 'block';
            }
            return;
        }
        renderMerchantProducts();
        if (typeof loadMerchantPageForUser === 'function') {
            loadMerchantPageForUser(auth.currentUser);
        }
    }

    if(pageId === 'wishlistPage') updateWishlistUI();
    if(pageId === 'listsPage') updateShoppingListsUI();

    // Update Bottom Nav active state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    // Hide bottom nav on delivery page, show on all others
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = (pageId === 'deliveryPage' || pageId === 'merchantPage') ? 'none' : 'flex';
    }

    const navMapping = {
        'homePage': 'nav-products',
        'offersPage': 'nav-offers',
        'cartPage': 'nav-cart',
        'listsPage': 'nav-lists',
        'contactPage': 'nav-contact'
    };
    
    // If scrollToProducts is true, treat as Products nav
    const activeNavId = scrollToProducts ? 'nav-products' : navMapping[pageId];
    if(activeNavId) {
        const navItem = document.getElementById(activeNavId);
        if(navItem) navItem.classList.add('active');
    }


    if(scrollToProducts) {
        const prodSec = document.getElementById('integratedProducts');
        if(prodSec) {
            prodSec.scrollIntoView({ behavior: 'smooth' });
            return;
        }
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh icons for dynamic content
    try {
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } catch(e) {}
};

window.closeCheckoutModal = () => {
    document.getElementById('checkoutModal').style.display = 'none';
};

window.changeQty = (id, delta) => {
    const item = cart.find(i => i.id === id);
    if(item) {
        item.quantity += delta;
        if(item.quantity <= 0) removeItem(id);
        else updateCartUI();
    }
};

window.removeItem = (id) => {
    cart = cart.filter(i => i.id !== id);
    updateCartUI();
};

// UI Triggers
window.openCart = () => navigateTo('cartPage');
window.closeCart = () => navigateTo('homePage');

window.openQuickView = (id) => {
    window.currentDisplayedProductId = id;
    const p = products.find(item => item.id === id);
    if(!p) return;
    const finalPrice = p.discount > 0 ? p.price * (1 - p.discount/100) : p.price;
    const body = document.getElementById('quickViewBody');
    const isMobile = window.innerWidth <= 768;

    body.innerHTML = `
        <div style="display: flex; flex-direction: ${isMobile ? 'column' : 'row'}; gap: ${isMobile ? '15px' : '30px'}; position: relative;">
            <!-- Left: Image Section -->
            <div style="flex: 1; min-width: 0;">
                <div class="zoom-container" id="qvZoomContainer" style="border-radius: 20px; overflow: hidden; background: #f8fafc; border: 1px solid #e2e8f0; position: relative;">
                    <img src="${p.image}" alt="${p.name}" style="width: 100%; aspect-ratio: ${isMobile ? '4/3' : '1'}; object-fit: cover; transition: all 0.5s ease;">
                    ${p.discount > 0 ? `<span style="position: absolute; top: 10px; right: 10px; background: #EF4444; color: white; padding: 4px 10px; border-radius: 50px; font-weight: 900; font-size: 0.7rem;">-${p.discount}% خصم</span>` : ''}
                </div>
            </div>

            <!-- Right: Content Section -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: ${isMobile ? '12px' : '20px'}; font-family: 'Cairo', sans-serif;">
                <div>
                    <span style="background: #FFF1E7; color: var(--primary); padding: 4px 10px; border-radius: 50px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase;">${p.category || 'عام'}</span>
                    <h2 style="font-size: ${isMobile ? '1.3rem' : '2.5rem'}; font-weight: 900; color: #0F172A; margin: 5px 0;">${p.name}</h2>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                        <div style="color: #F59E0B; font-size: 0.9rem;" id="topProductStarsDisplay">
                            ${'★'.repeat(Math.round(p.rating || 5))}${'☆'.repeat(5-Math.round(p.rating || 5))}
                        </div>
                        <span style="color: #94A3B8; font-size: 0.75rem; font-weight: 700;" id="topProductCountDisplay">(${p.rating ? parseFloat(p.rating).toFixed(1) : '5.0'} تقييم العملاء)</span>
                    </div>
                </div>

                <div style="background: #F1F5F950; padding: ${isMobile ? '12px' : '20px'}; border-radius: 15px; border: 1px solid #F1F5F9;">
                    <p style="color: #475569; line-height: 1.6; font-size: ${isMobile ? '0.85rem' : '0.95rem'}; margin: 0;">${p.description || 'هذا المنتج المميز صمم خصيصاً ليناسب ذوقكم الرفيع بجودة تضمن لكم أفضل تجربة استخدام.'}</p>
                </div>

                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="color: #94A3B8; font-size: 0.75rem; font-weight: 700;">السعر الحالي</span>
                    <div style="display: flex; align-items: baseline; gap: 8px;">
                        <span class="current-price" style="font-size: ${isMobile ? '1.5rem' : '2.2rem'}; font-weight: 900; color: var(--primary);">${formatPrice(finalPrice)}</span>
                        ${p.discount > 0 ? `<span class="old-price" style="text-decoration: line-through; color: #94A3B8; font-size: 0.9rem; font-weight: 600;">${formatPrice(p.price)}</span>` : ''}
                    </div>
                </div>

                <!-- Add to Cart Area -->
                <div style="display: flex; flex-direction: column; gap: 10px; margin-top: auto;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="display: flex; align-items: center; background: #F8FAF7; border: 2px solid #E2E8F0; border-radius: 12px; padding: 3px 12px; gap: 12px;">
                            <button onclick="changeModalQty(-1)" style="background: none; border: none; cursor: pointer; color: #64748B; font-size: 1.2rem; font-weight: 900;">-</button>
                            <span id="modalQty" style="font-weight: 900; font-size: 1rem; min-width: 15px; text-align: center;">1</span>
                            <button onclick="changeModalQty(1)" style="background: none; border: none; cursor: pointer; color: var(--primary); font-size: 1.2rem; font-weight: 900;">+</button>
                        </div>
                        <div style="flex: 1; color: #10B981; font-size: 0.75rem; font-weight: 700;">متوفر ✅</div>
                    </div>

                    <button class="btn-primary" onclick="addModalToCart('${p.id}')" style="width: 100%; padding: 14px; border-radius: 15px; font-size: 1rem; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 8px 20px rgba(255, 107, 0, 0.2);">
                        <i data-lucide="shopping-cart" style="width: 18px;"></i>
                        أضف إلى السلة
                    </button>
                </div>
            </div>
        </div>

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 35px 0;">
        
        <!-- Reviews Section -->
        <div id="productReviewsContainer" style="display: flex; flex-direction: column; gap: 20px; font-family: 'Cairo', sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <h3 style="font-size: 1.2rem; font-weight: 900; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="message-square" style="color: var(--primary); width: 22px; height: 22px;"></i>
                    تقييمات وآراء العملاء الحقيقية 💬⭐
                </h3>
                <span id="reviewsSummaryText" style="font-size: 0.85rem; font-weight: 800; color: var(--primary); background: #FFF1E7; padding: 4px 12px; border-radius: 50px;">جاري تحميل التقييمات...</span>
            </div>
            
            <div style="display: flex; flex-direction: ${isMobile ? 'column' : 'row'}; gap: 25px;">
                <!-- Left: List of Reviews -->
                <div style="flex: 1.8; display: flex; flex-direction: column; gap: 15px; min-width: 0;" id="reviewsListContainer">
                    <p style="color: #64748B; font-size: 0.85rem;">جاري جلب التقييمات...</p>
                </div>
                
                <!-- Right: Submit Review Form -->
                <div style="flex: 1.2; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 20px; padding: 22px; height: fit-content;" id="addReviewFormContainer">
                    <!-- Loaded dynamically based on auth status -->
                </div>
            </div>
        </div>
    `;
    setupZoom(document.getElementById('qvZoomContainer'));
    document.getElementById('quickViewModal').style.display = 'flex';
    if (window.lucide) lucide.createIcons();
    
    // Load actual product reviews from Firestore!
    loadProductReviews(id);
};

window.changeModalQty = (delta) => {
    const el = document.getElementById('modalQty');
    let val = parseInt(el.textContent);
    val = Math.max(1, val + delta);
    el.textContent = val;
};

window.addModalToCart = (id) => {
    const qty = parseInt(document.getElementById('modalQty').textContent);
    for(let i=0; i<qty; i++) {
        addToCart(id);
    }
    closeQuickViewModal();
    window.showToast("تمت الإضافة للسلة بنجاح ✅");
};


window.closeQuickViewModal = () => {
    window.currentDisplayedProductId = null;
    document.getElementById('quickViewModal').style.display = 'none';
};

window.openCheckout = () => {
    if (!auth.currentUser) {
        document.getElementById('loginModal').style.display = 'flex';
        return;
    }
    if(cart.length === 0) { alert('السلة فارغة!'); return; }
    
    // Refresh delivery config to catch latest admin changes
    loadDeliveryConfig();
    
    closeCart();
    document.getElementById('checkoutModal').style.display = 'flex';
    window.currentDeliveryFee = 0; // Reset
    const feeCont = document.getElementById('deliveryFeeContainer');
    if (feeCont) feeCont.style.display = 'none';
    updateCheckoutTotal();
};

window.updateCheckoutTotal = () => {
    const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const fee = window.currentDeliveryFee || 0;
    const total = subtotal + fee;

    if (document.getElementById('checkoutSubtotal')) document.getElementById('checkoutSubtotal').textContent = `${subtotal.toLocaleString()} ج.م`;
    if (document.getElementById('deliveryFeeAmount')) document.getElementById('deliveryFeeAmount').textContent = `${fee.toLocaleString()} ج.م`;
    if (document.getElementById('checkoutTotal')) document.getElementById('checkoutTotal').textContent = `${total.toLocaleString()} ج.م`;
    
    const feeCont = document.getElementById('deliveryFeeContainer');
    if (feeCont && fee > 0) feeCont.style.display = 'flex';
};



window.paymentConfig = { vodafoneCashNumber: '01035528656', instapayNumber: '01035528656' }; // Default fallback

async function loadPaymentConfig() {
    try {
        const doc = await db.collection('settings').doc('payment').get();
        if (doc.exists) {
            window.paymentConfig = doc.data();
        }
    } catch (err) { console.error("Error loading payment config:", err); }
}
loadPaymentConfig();

window.togglePaymentDetails = (val) => {
    const container = document.getElementById('paymentDetailsContainer');
    const label = document.getElementById('transferNumberLabel');
    const number = document.getElementById('transferNumber');
    
    if (val === 'vodafone_cash' || val === 'instapay') {
        container.style.display = 'flex';
        const config = window.paymentConfig || {};
        if (val === 'vodafone_cash') {
            label.textContent = "رقم تحويل فودافون كاش:";
            number.textContent = config.vodafoneCashNumber || "01035528656";
        } else {
            label.textContent = "رقم تحويل انستا باي:";
            number.textContent = config.instapayNumber || "01035528656";
        }
    } else {
        container.style.display = 'none';
    }
};

// Forms
document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
        alert("سلتك فارغة، يرجى إضافة منتجات أولاً");
        return;
    }

    const user = auth.currentUser;
    const name = document.getElementById('checkoutName').value;
    const address = document.getElementById('checkoutAddress').value;
    const phone = document.getElementById('checkoutPhone').value;
    const latlng = document.getElementById('latlng').value;
    const payment = document.getElementById('paymentMethod').value;
    const receiptFile = document.getElementById('paymentReceipt')?.files?.[0];
    const senderDigits = document.getElementById('senderLastDigits')?.value || '';

    // Location is optional - notify but don't block
    if (!latlng || latlng.trim() === '') {
        console.log("No GPS location provided - proceeding without it");
    }


    // Robust Phone Validation (Egyptian Format)
    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
        alert("يرجى إدخال رقم هاتف مصري صحيح (11 رقم يبدأ بـ 01)");
        return;
    }

    // Security Check: Blocked Phone Numbers
    try {
        const isBlocked = await db.collection('blockedUsers').doc(phone).get();
        if (isBlocked.exists) {
            alert("⚠️ نأسف، تم حظر هذا الرقم من قبل الإدارة. يرجى التواصل مع الدعم الفني.");
            return;
        }
    } catch (err) {
        console.error("Ban check error:", err);
    }

    if ((payment === 'vodafone_cash' || payment === 'instapay') && (!receiptFile || !senderDigits)) {
        alert("يرجى رفع صورة الإيصال وإدخال آخر 3 أرقام للمحول");
        return;
    }

    // Wallet Balance Check
    if (payment === 'wallet') {
        if (!user) {
            alert("يرجى تسجيل الدخول أولاً لتتمكن من الدفع بالمحفظة");
            return;
        }
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const balance = userDoc.data()?.walletBalance || 0;
            const subtotal = cart.reduce((s,i) => s + (i.price * i.quantity), 0);
            const total = subtotal + (window.currentDeliveryFee || 0);
            
            if (balance < total) {
                alert(`رصيدك غير كافٍ! رصيدك الحالي: ${balance} ج.م، وقيمة الطلب: ${total} ج.م`);
                return;
            }
        } catch (err) {
            alert("حدث خطأ أثناء فحص الرصيد، يرجى المحاولة لاحقاً");
            return;
        }
    }

    try {
        console.log("Resilient Submit Started");
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spin" style="display:inline-block; width:15px; height:15px; border:2px solid white; border-top-color:transparent; border-radius:50%; margin-left:10px;"></span> جاري تأكيد الطلب...';
        }

        // 1. Prepare Order Data (Fast)
        // Generate a random 6-digit integer for uniqueness
        let nextNumber = Math.floor(100000 + Math.random() * 900000);

        const data = {
            orderNumber: nextNumber,
            customer: name || "عميل",
            address: address || "بدون عنوان",
            phone: phone,
            paymentMethod: payment,
            paymentProof: "", // Will update in background
            paymentSenderDigits: senderDigits || "",
            paymentConfirmed: false,
            location: latlng ? `https://www.google.com/maps?q=${latlng}` : null,
            latlng: latlng || null,
            userId: user ? user.uid : 'guest',
            userEmail: user ? user.email : 'زائر',
            userPhoto: user ? (user.photoURL || 'https://ui-avatars.com/api/?name=U') : 'https://ui-avatars.com/api/?name=Guest',
            items: [...cart],
            deliveryFee: window.currentDeliveryFee || 0,
            total: cart.reduce((s,i) => s + (i.price*i.quantity), 0) + (window.currentDeliveryFee || 0),
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await db.collection('orders').add(data);
        console.log("Order Saved Instantly:", docRef.id);

        // Store for PDF generation
        window.lastOrderData = { ...data, id: docRef.id };
        
        // 2. SHOW SUCCESS MODAL INSTANTLY TO USER (< 0.2s response time!)
        document.getElementById('checkoutModal').style.display = 'none';
        document.getElementById('successModal').style.display = 'flex';
        
        const successTitle = document.querySelector('#successModal h2');
        const successMsg = document.querySelector('#successModal p');
        if (successTitle) successTitle.textContent = "تم استلام طلبك بنجاح! 🎉";
        if (successMsg) successMsg.innerHTML = `رقم الطلب الخاص بك هو: <strong>#${nextNumber}</strong><br>سيتم التواصل معك قريباً لتأكيد الشحن.`;

        // Handle WhatsApp Receipt Button if applicable
        if (payment === 'vodafone_cash' || payment === 'instapay') {
            const waBtn = document.getElementById('whatsappReceiptBtn');
            if (waBtn) {
                const config = window.paymentConfig || {};
                const supportNumber = config.whatsappSupportNumber || "01035528656";
                let cleanSupport = supportNumber.replace(/\D/g, '');
                if (cleanSupport.startsWith('0')) cleanSupport = cleanSupport.substring(1);
                if (!cleanSupport.startsWith('2')) cleanSupport = '2' + cleanSupport;

                waBtn.style.display = 'flex';
                waBtn.href = `https://wa.me/${cleanSupport}?text=${encodeURIComponent(`مرحباً، لقد قمت بطلب أوردر جديد رقم #${nextNumber}.\nالاسم: ${name}\nالمبلغ: ${data.total} ج.م\nهذا هو إيصال الدفع:`)}`;
            }

            if (receiptFile && successMsg) {
                successMsg.innerHTML += `<div id="uploadStatus" style="margin-top:15px; background:#F8FAFC; padding:10px; border-radius:12px; font-size:0.8rem; color:#64748B; display:flex; align-items:center; justify-content:center; gap:8px;"><span class="spin" style="width:12px; height:12px; border:2px solid #64748B; border-top-color:transparent; border-radius:50%;"></span> جاري رفع صورة الإيصال...</div>`;
            }
        }

        // Fast Cleanup & UI Reset
        const currentCartItems = [...cart];
        document.getElementById('checkoutForm').reset();
        if(document.getElementById('paymentDetailsContainer')) document.getElementById('paymentDetailsContainer').style.display = 'none';
        closeCart();
        cart = [];
        localStorage.removeItem('masoudi_cart');
        updateCartUI();
        if (user) trackOrders(); 

        // 3. NON-BLOCKING BACKGROUND TASKS (Parallel execution in background)
        (async () => {
            // Increment salesCount in parallel for all items
            Promise.all(currentCartItems.map(item => 
                db.collection('products').doc(item.id).update({
                    salesCount: firebase.firestore.FieldValue.increment(item.quantity)
                }).catch(err => console.error(`Failed to increment salesCount:`, err))
            ));

            // Wallet Deduction if applicable
            if (payment === 'wallet' && user) {
                try {
                    const userRef = db.collection('users').doc(user.uid);
                    await db.runTransaction(async (transaction) => {
                        const userSnap = await transaction.get(userRef);
                        const currentBalance = userSnap.data().walletBalance || 0;
                        transaction.update(userRef, { 
                            walletBalance: currentBalance - data.total,
                            lastSpentAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        transaction.update(docRef, { paymentConfirmed: true });
                    });
                    logWalletTransaction(user.uid, -data.total, 'purchase', `شراء طلب رقم #${nextNumber}`);
                } catch (err) {
                    console.error("Wallet deduction error:", err);
                }
            }

            // Referral check
            if (user) {
                try {
                    const referralInput = document.getElementById('checkoutReferral');
                    const providedCode = referralInput ? referralInput.value.trim().toUpperCase() : '';
                    const deviceFingerprint = localStorage.getItem('masoudi_ref_fingerprint');
                    const ordersSnap = await db.collection('orders').where('userId', '==', user.uid).limit(2).get();
                    
                    if (providedCode && ordersSnap.size <= 1 && !deviceFingerprint) {
                        const referrersSnap = await db.collection('users').where('referralCode', '==', providedCode).get();
                        if (!referrersSnap.empty) {
                            const referrerDoc = referrersSnap.docs[0];
                            if (referrerDoc.id !== user.uid) {
                                await docRef.update({
                                    pendingReferralReward: { referrerId: referrerDoc.id, amount: 20 }
                                });
                                localStorage.setItem('masoudi_ref_fingerprint', Date.now());
                            }
                        }
                    }
                } catch(e) { console.error("Referral error:", e); }
            }

            // Background Receipt Upload
            if ((payment === 'vodafone_cash' || payment === 'instapay') && receiptFile) {
                try {
                    const fileName = `rec_${docRef.id}_${Date.now()}.jpg`;
                    const storageRef = firebase.storage().ref().child(`receipts/${fileName}`);
                    const snapshot = await storageRef.put(receiptFile);
                    const url = await snapshot.ref.getDownloadURL();
                    await docRef.update({ paymentProof: url });
                    
                    const statusEl = document.getElementById('uploadStatus');
                    if (statusEl) {
                        statusEl.style.background = '#ECFDF5';
                        statusEl.style.color = '#10B981';
                        statusEl.innerHTML = '✅ تم رفع الإيصال بنجاح';
                    }
                    const waBtn = document.getElementById('whatsappReceiptBtn');
                    if (waBtn) waBtn.innerHTML = '✅ تم رفع الإيصال تلقائياً';
                } catch (err) {
                    console.error("Upload failed", err);
                    const statusEl = document.getElementById('uploadStatus');
                    if (statusEl) {
                        statusEl.style.background = '#FEF2F2';
                        statusEl.style.color = '#EF4444';
                        statusEl.innerHTML = '❌ فشل رفع الإيصال.. يرجى إرساله واتساب';
                    }
                }
            }
        })();

    } catch (err) { 
        console.error("Critical Submit Error:", err);
        alert("❌ عذراً، حدث خطأ في إرسال الطلب. يرجى المحاولة مرة أخرى أو الاتصال بنا."); 
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'تأكيد طلب الشراء';
        }
    }
});

// --- PDF Invoice Generation (Dynamic Implementation) ---
window.downloadLastInvoice = async () => {
    if(!window.lastOrderData) { alert("عذراً، لم يتم العثور على بيانات الفاتورة"); return; }
    
    // Function to load a script dynamically
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject();
            document.body.appendChild(script);
        });
    };

    // Load PDF libraries dynamically if not present
    if (!window.jspdf || !window.html2canvas) {
        window.showToast("⏳ جاري تحميل أدوات إنشاء الفاتورة... يرجى الانتظار");
        try {
            if (!window.html2canvas) {
                await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
            }
            if (!window.jspdf) {
                await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
            }
        } catch (e) {
            console.error("Failed to load PDF libraries dynamically:", e);
            alert("⚠️ فشل تحميل أدوات إنشاء الفاتورة من الخادم. يرجى التحقق من اتصالك بالإنترنت.");
            return;
        }
    }

    const data = window.lastOrderData;
    const { jsPDF } = window.jspdf;

    // 1. Create temporary container
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.innerHTML = `
        <div id="invoiceCapture" style="width: 800px; background: white; padding: 50px; direction: rtl; font-family: 'Cairo', sans-serif; color: #1e293b;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #ff6b00; padding-bottom: 30px; margin-bottom: 40px;">
                <div style="text-align: right;">
                    <h1 style="color: #ff6b00; margin: 0; font-size: 42px; font-weight: 900;">فاتورة ضريبية</h1>
                    <p style="color: #64748b; margin: 5px 0 0; font-size: 18px;">متجر مسعودي - Masoudi Store</p>
                    <p style="color: #94a3b8; margin: 2px 0 0; font-size: 14px;">رقم الطلب: <span style="color: #1e293b; font-weight: 700;">${data.orderNumber || 'N/A'}</span></p>
                </div>
                <div style="text-align: left;">
                    <img src="./logo.png" style="width: 100px; height: 100px; object-fit: cover; border-radius: 20px;" onerror="this.src='https://ui-avatars.com/api/?name=M&background=ff6b00&color=fff&bold=true'">
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 50px;">
                <div style="background: #f8fafc; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="color: #ff6b00; margin: 0 0 15px; font-size: 18px; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px;">بيانات العميل</h3>
                    <p style="margin: 8px 0; font-size: 15px;">الاسم: <strong>${data.customer}</strong></p>
                    <p style="margin: 8px 0; font-size: 15px;">الهاتف: <strong>${data.phone}</strong></p>
                    <p style="margin: 8px 0; font-size: 15px;">العنوان: <strong style="line-height: 1.4;">${data.address}</strong></p>
                </div>
                <div style="background: #fff; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; justify-content: center;">
                    <p style="margin: 8px 0; font-size: 15px; display: flex; justify-content: space-between;"><span>التاريخ:</span> <strong>${new Date().toLocaleDateString('ar-EG')}</strong></p>
                    <p style="margin: 8px 0; font-size: 15px; display: flex; justify-content: space-between;"><span>حالة الدفع:</span> <strong style="color: #10b981;">عند الاستلام</strong></p>
                    <p style="margin: 8px 0; font-size: 15px; display: flex; justify-content: space-between;"><span>الشحن:</span> <strong style="color: #ff6b00;">${data.deliveryFee ? data.deliveryFee + ' ج.م' : 'حسب الموقع'}</strong></p>
                </div>
            </div>

            <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px; border-radius: 15px; overflow: hidden; border: 1px solid #e2e8f0;">
                <thead>
                    <tr style="background: #1e293b; color: white;">
                        <th style="padding: 18px; text-align: right; font-size: 15px;">المنتج</th>
                        <th style="padding: 18px; text-align: center; font-size: 15px;">الكمية</th>
                        <th style="padding: 18px; text-align: left; font-size: 15px;">السعر الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map((item, idx) => `
                        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                            <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${item.name}</td>
                            <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">${item.quantity}</td>
                            <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: 800; color: #ff6b00;">${(item.price * item.quantity).toLocaleString()} ج.م</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="display: flex; justify-content: flex-end;">
                <div style="width: 300px; background: #1e293b; color: white; padding: 25px; border-radius: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; opacity: 0.8; font-size: 14px;">
                        <span>المجموع الفرعي:</span>
                        <span>${data.total.toLocaleString()} ج.م</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; opacity: 0.8; font-size: 14px;">
                        <span>رسوم التوصيل:</span>
                        <span>0 ج.م</span>
                    </div>
                    <div style="height: 1px; background: rgba(255,255,255,0.2); margin-bottom: 15px;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 18px; font-weight: 700;">الإجمالي الكلي:</span>
                        <span style="font-size: 24px; font-weight: 900; color: #ff6b00;">${data.total.toLocaleString()} ج.م</span>
                    </div>
                </div>
            </div>

            <div style="margin-top: 60px; text-align: center; border-top: 2px dashed #e2e8f0; padding-top: 30px;">
                <p style="color: #1e293b; font-weight: 800; font-size: 18px; margin-bottom: 10px;">شكراً لتسوقكم من مسعودي! ❤️</p>
                <p style="color: #64748b; font-size: 14px; margin: 0;">لأي استفسار يرجى التواصل معنا عبر واتساب: 01035528656</p>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 15px;">تم إنشاء هذه الفاتورة إلكترونياً بمتجر مسعودي (Masoudi Store © 2026)</p>
            </div>
        </div>
    `;
    document.body.appendChild(tempDiv);

    // 2. Capture and generate PDF
    try {
        const element = tempDiv.querySelector('#invoiceCapture');
        
        // Wait for fonts to load
        await document.fonts.ready;
        
        const canvas = await html2canvas(element, {
            scale: 1.2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            imageTimeout: 0
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Masoudi_Invoice_${data.orderNumber || 'Order'}.pdf`);
    } catch (err) {
        console.error("PDF Generation Error:", err);
        alert("حدث خطأ أثناء إنشاء الفاتورة، يرجى المحاولة لاحقاً.");
    } finally {
        // 3. Clean up
        document.body.removeChild(tempDiv);
    }
};

// --- Real-Time Order Tracking Logic ---
let orderSnapshotUnsub = null;

window.updateOrderStatus = async (orderId, newStatus) => {
    try {
        await db.collection('orders').doc(orderId).update({ status: newStatus });
        if (newStatus === 'completed' || newStatus === 'archived_received') {
            await window.awardPointsIfCompleted(orderId);
        }
    } catch (err) { console.error("Error updating order:", err); }
};

// Transaction Logging Helper
async function logWalletTransaction(userId, amount, type, description) {
    try {
        await db.collection('walletTransactions').add({
            userId: userId,
            amount: amount,
            type: type,
            description: description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("Failed to log transaction:", e);
    }
}

function trackOrders(userId = (auth.currentUser ? auth.currentUser.uid : null)) {
    if (userId) {
        setupRealTimeTracking(userId);
    } else {
        console.log("Tracking: No user detected");
    }
}

// Order Notification Logic
let lastKnownStatuses = {};

function notifyOrderStatusChange(order, newStatus) {
    const statusMessages = {
        'processing': 'يتم تجهيز طلبك الآن! 🛠️',
        'shipped': 'طلبك الآن في الطريق إليك! 🚚',
        'completed': 'وصل طلبك! نتمنى لك تجربة سعيدة. ✅',
        'archived_received': 'شكراً لتعاملك معنا، تم استلام الطلب. ❤️',
        'cancelled': order.rejectionMessage || 'عذراً، تم إلغاء طلبك ❌'
    };

    const voiceMessages = {
        'processing': 'يتم تجهيز طلبك الآن في متجر مسعودي',
        'shipped': 'طلبك في الطريق إليك الآن من متجر مسعودي',
        'completed': 'وصل طلبك من متجر مسعودي بالسلامة'
    };

    // Check user preferences before notifying
    const settings = window.userNotifSettings || { orders: true, offers: true };
    if (settings.orders === false) {
        console.log("Notifications disabled by user for orders.");
        return;
    }

    const msg = statusMessages[newStatus];
    if (msg) {
        // 1. Play Sound
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log("Audio play blocked"));
        } catch (e) {}

        // 2. Show Toast
        if (window.showToast) window.showToast(msg);

        // 3. Text to Speech (Arabic)
        if ('speechSynthesis' in window && voiceMessages[newStatus]) {
            const utterance = new SpeechSynthesisUtterance(voiceMessages[newStatus]);
            utterance.lang = 'ar-SA';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }
}

window.activeDriverListeners = window.activeDriverListeners || {};

function unsubscribeAllDriverListeners() {
    if (window.activeDriverListeners) {
        Object.keys(window.activeDriverListeners).forEach(key => {
            if (typeof window.activeDriverListeners[key] === 'function') {
                window.activeDriverListeners[key]();
            }
        });
        window.activeDriverListeners = {};
    }
}

function listenToDriverLocation(driverId, orderId) {
    const key = `${driverId}_${orderId}`;
    if (window.activeDriverListeners[key]) return;

    window.activeDriverListeners[key] = db.collection('drivers').doc(driverId).onSnapshot(doc => {
        if (!doc.exists) return;
        const driverData = doc.data();

        // Update avatar image
        const picEl = document.getElementById(`driver-pic-${orderId}`);
        if (picEl && driverData.photoURL) {
            picEl.src = driverData.photoURL;
        }

        // Update driver name
        const nameEl = document.getElementById(`driver-name-${orderId}`);
        if (nameEl && driverData.name) {
            nameEl.textContent = driverData.name;
        }

        // Update phone call button
        const phoneEl = document.getElementById(`driver-phone-${orderId}`);
        const phoneTextEl = document.getElementById(`driver-phone-text-${orderId}`);
        if (phoneEl) {
            if (driverData.phone) {
                phoneEl.href = `tel:${driverData.phone}`;
                phoneEl.style.display = 'flex';
                if (phoneTextEl) {
                    phoneTextEl.textContent = driverData.phone;
                    phoneTextEl.parentElement.style.display = 'flex';
                }
            } else {
                phoneEl.style.display = 'none';
                if (phoneTextEl) phoneTextEl.parentElement.style.display = 'none';
            }
        }

        // Update WhatsApp chat button
        const whatsappEl = document.getElementById(`driver-whatsapp-${orderId}`);
        if (whatsappEl) {
            const driverPhone = driverData.phone;
            if (driverPhone) {
                whatsappEl.href = `https://wa.me/2${driverPhone}`;
                whatsappEl.style.display = 'flex';
            } else {
                whatsappEl.style.display = 'none';
            }
        }

        // Update live tracking button
        const mapContainer = document.getElementById(`driver-map-container-${orderId}`);
        const mapBtn = document.getElementById(`driver-map-btn-${orderId}`);
        if (mapContainer && mapBtn) {
            if (driverData.lat && driverData.lng) {
                mapContainer.style.display = 'block';
                mapBtn.onclick = () => {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${driverData.lat},${driverData.lng}`, '_blank');
                };
            } else {
                mapContainer.style.display = 'none';
            }
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, err => {
        console.error("Error listening to driver details:", err);
    });
}

window.openDriverMap = async (orderId) => {
    try {
        // Fetch the order to get driverId
        const orderSnap = await db.collection('orders').doc(orderId).get();
        if (!orderSnap.exists) {
            window.showToast('تعذر الوصول لبيانات الطلب');
            return;
        }
        const driverId = orderSnap.data().driverId;
        if (!driverId) {
            window.showToast('لم يتم تعيين مندوب لهذا الطلب بعد');
            return;
        }

        // Fetch the driver's live location
        const driverSnap = await db.collection('drivers').doc(driverId).get();
        if (!driverSnap.exists || !driverSnap.data().lat || !driverSnap.data().lng) {
            window.showToast('موقع المندوب غير متوفر حالياً، حاول مرة أخرى');
            return;
        }

        const { lat, lng } = driverSnap.data();
        window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    } catch (err) {
        console.error('openDriverMap error:', err);
        window.showToast('حدث خطأ أثناء تحميل موقع المندوب');
    }
};

function setupRealTimeTracking(userId) {
    if (orderSnapshotUnsub) {
        orderSnapshotUnsub();
        unsubscribeAllDriverListeners();
    }

    const drawerContainer = document.getElementById('myOrdersContainer');
    const drawerList = document.getElementById('activeOrdersList');
    const pageContainer = document.getElementById('myOrdersContainerPage');
    const pageList = document.getElementById('activeOrdersListPage');
    const historyList = document.getElementById('historyOrdersList');
    const emptyHistory = document.getElementById('emptyHistoryView');

    orderSnapshotUnsub = db.collection('orders')
        .where('userId', '==', userId)
        .onSnapshot(snapshot => {
            const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Detect Changes for Notifications
            orders.forEach(o => {
                const prevStatus = lastKnownStatuses[o.id];
                if (prevStatus && prevStatus !== o.status) {
                    notifyOrderStatusChange(o, o.status);
                }
                lastKnownStatuses[o.id] = o.status;
            });

            // Filter Orders
            const activeStatuses = ['pending', 'processing', 'shipped', 'completed'];
            const historyStatuses = ['archived_received', 'archived_refused', 'cancelled'];

            const activeOrders = orders.filter(o => activeStatuses.includes(o.status))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            
            const historyOrders = orders.filter(o => historyStatuses.includes(o.status))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            // Update Active UI
            if (activeOrders.length === 0) {
                if (drawerContainer) drawerContainer.style.display = 'none';
                if (pageContainer) pageContainer.style.display = 'none';
            } else {
                if (drawerContainer) drawerContainer.style.display = 'block';
                if (pageContainer) pageContainer.style.display = 'block';
                
                const activeHTML = activeOrders.map(o => renderOrderCard(o)).join('');
                if (drawerList) drawerList.innerHTML = activeHTML;
                if (pageList) pageList.innerHTML = activeHTML;

                // Bind driver location listeners for active orders
                activeOrders.forEach(o => {
                    if (o.driverId) {
                        setTimeout(() => listenToDriverLocation(o.driverId, o.id), 50);
                    }
                });
            }

            // Update History UI
            if (historyList) {
                if (historyOrders.length === 0) {
                    historyList.style.display = 'none';
                    if (emptyHistory) emptyHistory.style.display = 'block';
                } else {
                    historyList.style.display = 'flex';
                    if (emptyHistory) emptyHistory.style.display = 'none';
                    historyList.innerHTML = historyOrders.map(o => renderOrderCard(o, true)).join('');
                }
            }
            
            updateCartUI();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
}

function renderOrderCard(o, isHistory = false) {
    const isDigital = o.paymentMethod === 'vodafone_cash' || o.paymentMethod === 'instapay';
    const statusInfo = {
        'pending': { label: isDigital ? 'جاري التحقق' : 'تم استلام الطلب 📝', icon: 'clipboard-list', color: '#f59e0b', desc: 'تلقينا طلبك وجاري المراجعة والتأكيد' },
        'processing': { label: 'جاري التجهيز 🛒', icon: 'shopping-cart', color: '#ff6b00', desc: 'تم التأكيد وجاري تحضير وتغليف طلبك في المتجر' },
        'shipped': { label: 'المندوب في الطريق 🏍️', icon: 'bike', color: '#3b82f6', desc: 'طلبك مع المندوب الآن وهو في الطريق لعنوانك' },
        'completed': { label: 'تم التسليم 🎉', icon: 'check-circle', color: '#10b981', desc: 'تم التوصيل بنجاح، نتمنى لك تجربة سعيدة!' },
        'archived_received': { label: 'تم الاستلام', icon: 'check-square', color: '#10b981', desc: 'تم استلام وتأكيد الطلب بنجاح' },
        'archived_refused': { label: 'تم الرفض', icon: 'x-octagon', color: '#ef4444', desc: o.rejectionMessage || 'تم رفض استلام الشحنة من العميل' },
        'cancelled': { label: 'تم الإلغاء', icon: 'x-circle', color: '#ef4444', desc: 'تم إلغاء الطلب بالكامل' }
    };
    
    const s = statusInfo[o.status] || statusInfo['pending'];
    const activeStatuses = ['pending', 'processing', 'shipped', 'completed'];
    const currentIdx = activeStatuses.indexOf(o.status);

    return `
        <div class="cart-order-card fade-in" style="background:white; border-radius:18px; padding:20px; margin-bottom:20px; border:1px solid #f1f5f9; box-shadow:0 10px 25px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <span style="font-weight:900; font-size:0.85rem; color:#1e293b;">طلب #${o.orderNumber}</span>
                <span style="font-size:0.7rem; background:${s.color}15; color:${s.color}; padding:5px 12px; border-radius:50px; font-weight:800; display:flex; align-items:center; gap:5px;">
                    <i data-lucide="${s.icon}" style="width:12px; height:12px;"></i> ${s.label}
                </span>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px; border-bottom:1px dashed #f1f5f9; padding-bottom:15px;">
                ${(o.items || []).map(item => `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${item.image}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">
                        <div style="flex:1;">
                            <div style="font-size:0.8rem; font-weight:700;">${item.name}</div>
                            <div style="font-size:0.7rem; color:#94a3b8;">${item.quantity} × ${item.price.toLocaleString()} ج.م</div>
                        </div>
                        <div style="font-size:0.8rem; font-weight:900; color:var(--primary);">${(item.price * item.quantity).toLocaleString()} ج.م</div>
                    </div>
                `).join('')}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:0.75rem; color:#64748b;">إجمالي الطلب:</span>
                <span style="font-size:1rem; font-weight:900; color:var(--primary);">${o.total.toLocaleString()} ج.م</span>
            </div>

            ${!isHistory ? `
                <div class="premium-timeline" style="--timeline-progress: ${currentIdx >= 0 ? (currentIdx / 3) * 100 : 0}%">
                    ${['pending', 'processing', 'shipped', 'completed'].map((stat, i) => {
                        const info = statusInfo[stat];
                        const isStepCompleted = i < currentIdx;
                        const isStepActive = i === currentIdx;
                        const stepClass = isStepCompleted ? 'completed' : (isStepActive ? 'active' : 'pending');
                        return `
                            <div class="timeline-step ${stepClass}">
                                <div class="timeline-dot"></div>
                                <div class="timeline-icon-box">
                                    <i data-lucide="${isStepCompleted ? 'check' : info.icon}" style="width: 18px; height: 18px;"></i>
                                </div>
                                <div class="timeline-content-box">
                                    <h4 style="font-size:0.85rem; font-weight:900; color:#1e293b; margin:0 0 3px 0;">${info.label}</h4>
                                    <p style="font-size:0.7rem; color:#64748b; margin:0; line-height:1.4;">${info.desc}</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                ${o.driverId ? `
                    <div id="driver-card-${o.id}" class="driver-tracking-card">
                        <div class="driver-tracking-header">
                            <div class="driver-info-wrapper">
                                <div class="driver-avatar-container">
                                    <img id="driver-pic-${o.id}" src="https://ui-avatars.com/api/?name=${encodeURIComponent(o.driverName || 'D')}&background=ff6b00&color=fff" class="driver-avatar" />
                                    <div class="driver-status-dot"></div>
                                </div>
                                <div class="driver-details">
                                    <h4 id="driver-name-${o.id}">${o.driverName || 'طيار مسعودي'}</h4>
                                    <div class="driver-badge">
                                        <i data-lucide="shield-check" style="width:12px; color:#10b981;"></i>
                                        <span>طيار معتمد لدى مسعودي</span>
                                    </div>
                                    <div id="driver-phone-container-${o.id}" style="display:none; margin-top:4px; font-size:0.75rem; font-weight:800; color:var(--primary); align-items:center; gap:5px;">
                                        <i data-lucide="phone" style="width:12px;"></i>
                                        <span id="driver-phone-text-${o.id}"></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="driver-action-grid">
                            <a id="driver-phone-${o.id}" href="#" class="driver-btn call">
                                <i data-lucide="phone"></i>
                                <span>اتصال</span>
                            </a>
                            <a id="driver-whatsapp-${o.id}" href="#" target="_blank" class="driver-btn whatsapp">
                                <i data-lucide="message-square"></i>
                                <span>واتساب</span>
                            </a>
                        </div>
                        
                        <button class="driver-tracking-btn" onclick="openDriverMap('${o.id}')">
                            <i data-lucide="map"></i>
                            تتبع موقع المندوب على الخريطة
                        </button>
                    </div>
                ` : ''}

                <div id="status-actions-${o.id}" style="margin-top:20px; display: ${o.status === 'completed' ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap:10px;">
                    <button onclick="updateOrderStatus('${o.id}', 'archived_received')" style="background:#10b981; color:white; border:none; padding:14px; border-radius:14px; font-weight:900; font-size:0.85rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <i data-lucide="check-circle" style="width:16px;"></i> استلمت الطلب
                    </button>
                    <button onclick="updateOrderStatus('${o.id}', 'archived_refused')" style="background:#f1f5f9; color:#ef4444; border:1px solid #fee2e2; padding:14px; border-radius:14px; font-weight:900; font-size:0.85rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <i data-lucide="trash-2" style="width:16px;"></i> رفض الاستلام
                    </button>
                </div>
            ` : `
                <div style="margin-top:10px; padding:12px; background:#f8fafc; border-radius:12px; border:1px solid #f1f5f9; font-size:0.75rem; color:#64748b;">
                    <div style="display:flex; justify-content:space-between;">
                        <span>تاريخ الطلب:</span>
                        <span style="font-weight:700;">${o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '---'}</span>
                    </div>
                </div>
            `}
        </div>
    `;
}

// Smart Assistant Voice Integration Variables
let isBotVoiceMuted = localStorage.getItem('botVoiceMuted') === 'true';
let botSpeechRecognition = null;
let isBotRecognizing = false;
let isHandsFreeActive = false;

// Warm Egyptian/Arabic locale
const VOICE_LANG = 'ar-EG';

window.toggleBotVoice = () => {
    isBotVoiceMuted = !isBotVoiceMuted;
    localStorage.setItem('botVoiceMuted', isBotVoiceMuted);
    
    // Update the button icon in the UI
    const voiceToggleBtn = document.querySelector('.chat-voice-toggle-btn');
    if (voiceToggleBtn) {
        voiceToggleBtn.innerHTML = `<i data-lucide="${isBotVoiceMuted ? 'volume-x' : 'volume-2'}" style="width:20px; height:20px; color:${isBotVoiceMuted ? '#64748b' : '#ff6b00'};"></i>`;
    }
    lucide.createIcons();
    
    if (isBotVoiceMuted) {
        window.speechSynthesis.cancel();
        stopHandsFreeVoice();
        window.showToast("تم كتم صوت المساعد وإيقاف الاستماع التلقائي 🔇");
    } else {
        window.showToast("تم تفعيل صوت المساعد والبحث الصوتي 🔊");
        if (document.getElementById('globalChatPopup')?.classList.contains('active')) {
            startHandsFreeVoice();
        }
    }
};

window.speakBotMessage = (text) => {
    // Stop listening before speaking so it doesn't listen to its own voice!
    stopHandsFreeVoice(false); // temp pause recognition, don't clear hands-free flag
    
    if (isBotVoiceMuted) {
        // If voice is muted, we immediately start listening again because we won't speak
        if (isHandsFreeActive) {
            setTimeout(startHandsFreeVoice, 500);
        }
        return;
    }
    
    // Stop any currently running speech
    window.speechSynthesis.cancel();
    
    // Remove HTML tags & clean spacing
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!cleanText) {
        if (isHandsFreeActive) startHandsFreeVoice();
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = VOICE_LANG;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Try to find an Egyptian Arabic voice
    const voices = window.speechSynthesis.getVoices();
    const egyVoice = voices.find(v => v.lang === 'ar-EG' || v.lang === 'ar_EG' || (v.name && v.name.toLowerCase().includes('egypt')));
    const arabicVoice = egyVoice || voices.find(v => v.lang && v.lang.includes('ar'));
    if (arabicVoice) utterance.voice = arabicVoice;
    
    utterance.onend = () => {
        // When speaking is complete, automatically start listening for customer's response!
        if (isHandsFreeActive) {
            setTimeout(startHandsFreeVoice, 600); // 600ms breathing room
        }
    };
    
    utterance.onerror = () => {
        if (isHandsFreeActive) {
            setTimeout(startHandsFreeVoice, 600);
        }
    };
    
    window.speechSynthesis.speak(utterance);
};

window.startHandsFreeVoice = () => {
    if (isBotVoiceMuted) return; // Don't auto-listen if muted
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    isHandsFreeActive = true;
    
    const chatInput = document.getElementById('globalChatInput');
    const statusText = document.getElementById('botStatusText');
    const activeDot = document.getElementById('botActiveDot');
    
    if (!botSpeechRecognition) {
        botSpeechRecognition = new SpeechRecognition();
        botSpeechRecognition.lang = VOICE_LANG;
        botSpeechRecognition.continuous = false;
        botSpeechRecognition.interimResults = false;
        
        botSpeechRecognition.onstart = () => {
            isBotRecognizing = true;
            if (chatInput) chatInput.placeholder = '🎙️ المساعد يستمع لك الآن، تحدث مباشرة...';
            if (statusText) statusText.textContent = 'يستمع إليك الآن... 🎙️';
            if (activeDot) {
                activeDot.style.background = '#3b82f6'; // Cyan-Blue glowing dot when listening
                activeDot.style.boxShadow = '0 0 15px #3b82f6';
                activeDot.style.animation = 'listenBreathe 1.2s infinite alternate';
            }
            
            if (!document.getElementById('botListenStyles')) {
                const style = document.createElement('style');
                style.id = 'botListenStyles';
                style.innerHTML = `
                    @keyframes listenBreathe {
                        from { transform: scale(1); opacity: 0.8; }
                        to { transform: scale(1.3); opacity: 1; box-shadow: 0 0 15px #3b82f6; }
                    }
                `;
                document.head.appendChild(style);
            }
        };
        
        botSpeechRecognition.onresult = (event) => {
            const resultText = event.results[0][0].transcript;
            if (chatInput) chatInput.value = resultText;
        };
        
        botSpeechRecognition.onerror = (e) => {
            console.error("Speech Recognition Error:", e);
            resetSpeechUI();
        };
        
        botSpeechRecognition.onend = () => {
            resetSpeechUI();
            if (chatInput && chatInput.value.trim() !== '') {
                handleBotChat();
            }
        };
    }
    
    if (!isBotRecognizing) {
        try {
            botSpeechRecognition.start();
        } catch (e) {
            console.warn("SpeechRecognition start error:", e);
        }
    }
};

window.stopHandsFreeVoice = (clearHandsFree = true) => {
    if (clearHandsFree) {
        isHandsFreeActive = false;
    }
    if (botSpeechRecognition && isBotRecognizing) {
        try {
            botSpeechRecognition.stop();
        } catch (e) {
            console.warn("SpeechRecognition stop error:", e);
        }
    }
    resetSpeechUI();
};

function resetSpeechUI() {
    isBotRecognizing = false;
    const chatInput = document.getElementById('globalChatInput');
    const statusText = document.getElementById('botStatusText');
    const activeDot = document.getElementById('botActiveDot');
    
    if (chatInput) {
        chatInput.placeholder = 'اكتب استفسارك هنا...';
    }
    if (statusText) {
        statusText.textContent = 'نشط الآن للرد على استفساراتك';
    }
    if (activeDot) {
        activeDot.style.background = '#10b981'; // Green active dot
        activeDot.style.boxShadow = '0 0 10px #10b981';
        activeDot.style.animation = 'none';
    }
}

function addGlobalChat() {
    if(document.querySelector('.global-chat-btn')) return;
    
    const btn = document.createElement('div');
    btn.className = 'global-chat-btn';
    btn.innerHTML = '<i data-lucide="message-circle" style="width:32px; height:32px;"></i>';
    btn.onclick = () => {
        const popup = document.getElementById('globalChatPopup');
        popup.classList.toggle('active');
        if(popup.classList.contains('active')) {
            const msgBody = document.getElementById('globalChatMsgs');
            if(msgBody.children.length === 0) {
                // Initial Bot Welcome
                setTimeout(() => {
                    const user = auth.currentUser;
                    const userName = (window.currentUserData && window.currentUserData.name) || (user ? (user.displayName || 'عميل مسعودي') : 'عميل جديد');
                    if (!user) {
                        appendBotMessage(`أهلاً بك في <strong>متجر مسعودي</strong>! 🤖 أنا مساعدك الذكي. يمكنك التسجيل بنقرة واحدة الآن لتتبع طلباتك والحصول على عروض حصرية! 👇`);
                    } else {
                        appendBotMessage(`أهلاً بك يا <strong>${userName}</strong>! 🤖 أنا مساعد مسعودي الذكي الصوتي. تحدث معي مباشرة وبدون أزرار! كيف يمكنني مساعدتك؟`);
                    }
                    showQuickActions();
                }, 500);
            } else {
                // If reopened, start listening immediately
                startHandsFreeVoice();
            }
        } else {
            // Stop listening when popup closed
            stopHandsFreeVoice();
        }
    };
    
    const popup = document.createElement('div');
    popup.id = 'globalChatPopup';
    popup.className = 'chat-popup';
    popup.innerHTML = `
        <div class="chat-p-header">
            <div style="display:flex; align-items:center; gap:12px;">
                <div id="botActiveDot" style="width:10px; height:10px; background:#10b981; border-radius:50%; box-shadow:0 0 10px #10b981; transition:all 0.3s ease;"></div>
                <div>
                    <strong style="display:block; font-size:1rem;">مساعد مسعودي الذكي 🗣️🎙️</strong>
                    <span id="botStatusText" style="font-size:0.7rem; color:#64748b; transition:all 0.3s ease;">نشط الآن للرد على استفساراتك</span>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button class="chat-voice-toggle-btn" onclick="toggleBotVoice()" style="background:none; border:none; color:${isBotVoiceMuted ? '#64748b' : '#ff6b00'}; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:5px;">
                    <i data-lucide="${isBotVoiceMuted ? 'volume-x' : 'volume-2'}" style="width:20px; height:20px;"></i>
                </button>
                <button class="chat-close-btn" onclick="document.getElementById('globalChatPopup').classList.remove('active'); stopHandsFreeVoice();">
                    <i data-lucide="x" style="width:20px;"></i>
                </button>
            </div>
        </div>
        <div id="globalChatMsgs" class="chat-p-body" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:10px; background:#f8fafc;"></div>
        <div class="chat-p-footer" style="padding:15px; background:white; border-top:1px solid #f1f5f9; display:flex; gap:10px;">
            <input type="text" id="globalChatInput" class="chat-p-input" placeholder="اكتب استفسارك هنا..." style="flex:1; padding:12px; border-radius:12px; border:1px solid #e2e8f0; outline:none;" onkeypress="if(event.key==='Enter') { stopHandsFreeVoice(); handleBotChat(); }">
            <button onclick="stopHandsFreeVoice(); handleBotChat()" class="chat-p-send" style="background:var(--primary); color:white; border:none; width:45px; height:45px; border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                <i data-lucide="send" style="width:20px;"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(btn);
    document.body.appendChild(popup);
    lucide.createIcons();
}

function appendUserMessage(text) {
    const msgBody = document.getElementById('globalChatMsgs');
    const msgDiv = document.createElement('div');
    msgDiv.style = "background:var(--primary); color:white; padding:10px 18px; border-radius:18px 18px 4px 18px; max-width:85%; font-size:0.9rem; align-self:flex-end; box-shadow:0 8px 20px rgba(255,107,0,0.2); animation: slideUp 0.3s ease; margin-bottom: 15px; font-weight: 700;";
    msgDiv.innerHTML = text;
    msgBody.appendChild(msgDiv);
    msgBody.scrollTop = msgBody.scrollHeight;
}

function appendBotMessage(text, isVisual = false, customSpeechText = null) {
    const msgBody = document.getElementById('globalChatMsgs');
    const container = document.createElement('div');
    container.style = "display:flex; gap:10px; align-items:flex-end; margin-bottom:15px; animation: slideUp 0.3s ease;";
    
    const avatar = `<div style="width:30px; height:30px; background:white; border:1px solid #e2e8f0; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,0.05);"><i data-lucide="bot" style="width:16px; color:var(--primary);"></i></div>`;
    
    const msgDiv = document.createElement('div');
    if(isVisual) {
        msgDiv.style = "flex:1; max-width:90%;";
    } else {
        msgDiv.style = "background:#f8fafc; color:#1e293b; padding:10px 18px; border-radius:18px 18px 18px 4px; max-width:85%; font-size:0.9rem; border:1px solid #e2e8f0; line-height:1.6; font-weight:600; position:relative; display:flex; justify-content:space-between; align-items:center; gap:10px;";
    }
    
    let contentHTML = `<span>${text}</span>`;
    
    // Add small speaker icon next to bot text for optional re-play
    if (!isVisual) {
        const cleanSpeakText = customSpeechText || text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/['"`]/g, '').replace(/\s+/g, ' ').trim();
        contentHTML += `
            <button onclick="window.speakBotMessage('${cleanSpeakText}')" style="background:none; border:none; cursor:pointer; color:#94a3b8; transition:color 0.2s; padding:2px; display:flex; align-items:center; flex-shrink:0;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='#94a3b8'">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </button>
        `;
    }
    
    msgDiv.innerHTML = contentHTML;
    container.innerHTML = avatar;
    container.appendChild(msgDiv);
    msgBody.appendChild(container);
    msgBody.scrollTop = msgBody.scrollHeight;
    lucide.createIcons();
    // Speak out loud!
    if (!isVisual) {
        const cleanSpeech = customSpeechText || text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/['"`]/g, '').replace(/\s+/g, ' ').trim();
        window.speakBotMessage(cleanSpeech);
    }
}

function showQuickActions() {
    const msgBody = document.getElementById('globalChatMsgs');
    const actions = [
        { label: "💵 رصيدي ونقاطي", text: "رصيدي" },
        { label: "🛒 سلة مشترياتي", text: "السلة" },
        { label: "📦 تتبع طلبي", text: "تتبع" },
        { label: "🚚 مصاريف التوصيل", text: "توصيل" },
        { label: "📞 واتساب الدعم", text: "تواصل" }
    ];
    
    const container = document.createElement('div');
    container.style = "display:flex; gap:8px; flex-wrap:wrap; margin-bottom:15px; padding-left:40px; direction:rtl;";
    
    if (!auth.currentUser) {
        const loginBtn = document.createElement('button');
        loginBtn.style = "background:linear-gradient(135deg, #FF6B00, #ff8c33); border:none; color:white; padding:10px 20px; border-radius:50px; font-size:0.85rem; font-weight:900; cursor:pointer; transition:all 0.3s; box-shadow: 0 5px 15px rgba(255, 107, 0, 0.3); display:flex; align-items:center; gap:8px;";
        loginBtn.innerHTML = `<i data-lucide="log-in" style="width:16px;"></i> تسجيل دخول بنقرة واحدة`;
        loginBtn.onclick = () => window.login();
        container.appendChild(loginBtn);
    }

    actions.forEach(act => {
        const btn = document.createElement('button');
        btn.style = "background:white; border:1px solid var(--primary); color:var(--primary); padding:8px 16px; border-radius:50px; font-size:0.75rem; font-weight:900; cursor:pointer; transition:all 0.2s; box-shadow: 0 2px 8px rgba(255, 107, 0, 0.05);";
        btn.innerHTML = act.label;
        btn.onclick = () => {
            const input = document.getElementById('globalChatInput');
            input.value = act.text;
            handleBotChat();
        };
        container.appendChild(btn);
    });
    
    msgBody.appendChild(container);
    msgBody.scrollTop = msgBody.scrollHeight;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleBotChat() {
    const input = document.getElementById('globalChatInput');
    const msgBody = document.getElementById('globalChatMsgs');
    const originalText = input.value.trim();
    const text = originalText.toLowerCase();
    if(!text) return;
    
    appendUserMessage(originalText);
    input.value = '';
    
    // Typing Indicator with sleek spin styling
    const typingDiv = document.createElement('div');
    typingDiv.style = "display:flex; align-items:center; gap:8px; margin-left:40px; margin-bottom:15px; color:#94a3b8; font-size:0.75rem; font-weight:700; direction:rtl;";
    typingDiv.innerHTML = `<span class="spin-animation" style="display:inline-block; width:10px; height:10px; border:2px solid var(--primary); border-top-color:transparent; border-radius:50%; animation: spin 1s linear infinite;"></span> مساعد مسعودي الفائق يكتب...`;
    msgBody.appendChild(typingDiv);
    msgBody.scrollTop = msgBody.scrollHeight;

    setTimeout(async () => {
        typingDiv.remove();
        
        const user = auth.currentUser;

        // --- 1. Dynamic UI Navigation Actions ---
        // Open Cart
        const openCartQueries = ['افتح السله', 'افتح السلة', 'شوف السله', 'شوف السلة', 'روق السلة', 'اشتري', 'الدفع', 'تأكيد الطلب', 'اخلص الطلب', 'عربة', 'سلة', 'المشتريات'];
        if (openCartQueries.some(q => text.includes(q))) {
            navigateTo('cartPage');
            appendBotMessage("بكل سرور! لقد قمت بفتح سلة مشترياتك. يمكنك الآن مراجعة طلبك والضغط على 'تأكيد الطلب' لإتمام عملية الشراء بنجاح. 🛒🚀");
            return;
        }

        // Open Profile / Wallet
        const openProfileQueries = ['حسابي', 'بروفايلي', 'محفظتي', 'المحفظة', 'نقاطي', 'النقاط', 'الولاء', 'مستواي', 'الملف الشخصي'];
        if (openProfileQueries.some(q => text.includes(q))) {
            navigateTo('contactPage');
            if (user) {
                appendBotMessage("لقد قمت بفتح صفحة حسابك الشخصي؛ يمكنك الآن الاطلاع على رصيد محفظتك، نقاط الولاء، وإدارة تفاصيل حسابك بكل سهولة. 🏆👑");
            } else {
                appendBotMessage("لقد قمت بفتح صفحة الحساب لك، ولكن يرجى تسجيل الدخول أولاً لتتمكن من استعراض رصيدك ونقاط الخصم الخاصة بك. 🔑");
                document.getElementById('loginModal').style.display = 'flex';
            }
            return;
        }

        // Open Wishlist
        const openWishlistQueries = ['المفضلة', 'المفضله', 'عجبني', 'عجباني', 'المنتجات اللي عجبتني', 'المفضلات'];
        if (openWishlistQueries.some(q => text.includes(q))) {
            navigateTo('wishlistPage');
            appendBotMessage("تم بكل سرور! إليك قائمة منتجاتك المفضلة التي قمت باختيارها. هل ترغب في إضافة أي منها إلى سلة المشتريات الآن؟ ❤️🛒");
            return;
        }

        // Open Home / Browse
        const openHomeQueries = ['الرئيسية', 'الرئيسيه', 'البيت', 'المنزل', 'الصفحة الأولى', 'الصفحه الاولى', 'المنتجات', 'تصفح', 'الواجهة'];
        if (openHomeQueries.some(q => text.includes(q))) {
            navigateTo('homePage');
            appendBotMessage("كما تفضل! لقد قمت بتوجيهك إلى الصفحة الرئيسية لتتمكن من تصفح كافة منتجاتنا الطازجة والممتازة. 🥦🍊");
            return;
        }

        // Scroll to Offers
        const scrollToOffersQueries = ['فرجني على العروض', 'العروض', 'الخصومات', 'خصم', 'التخفيضات', 'شوف العروض', 'تنزيلات'];
        if (scrollToOffersQueries.some(q => text.includes(q))) {
            navigateTo('homePage');
            const slider = document.getElementById('bannerSliderContainer');
            if (slider) {
                slider.scrollIntoView({ behavior: 'smooth', block: 'center' });
                appendBotMessage("عروض اليوم لا تُفوّت! لقد قمت بنقلك إلى قسم أفضل العروض والخصومات لتتصفحها بنفسك. 🔥");
            } else {
                appendBotMessage("كافة العروض والتخفيضات متاحة أمامك في الصفحة الرئيسية! ابحث عن المنتجات المميزة بعلامة الخصم واستفد منها الآن. 🎉");
            }
            return;
        }

        // Empty Cart Action
        const emptyCartQueries = ['فضي السله', 'فضي السلة', 'امسح السله', 'امسح السلة', 'احذف السله', 'احذف السلة', 'تفريغ السلة', 'تفريغ السله'];
        if (emptyCartQueries.some(q => text.includes(q))) {
            if (typeof cart !== 'undefined' && cart.length > 0) {
                cart = [];
                localStorage.setItem('masoudi_cart', JSON.stringify([]));
                updateCartUI();
                appendBotMessage("تم الأمر بنجاح، لقد قمت بتفريغ سلة مُشترياتك بالكامل. يمكنك البدء في ملئها متى شئت. 🧹");
            } else {
                appendBotMessage("سلة مُشترياتك فارغة بالفعل! ما هي المنتجات التي تود إضافتها؟ 😉");
            }
            return;
        }

        // --- 2. Add to Cart Intent Parser (إضافة منتج حقيقية وتفاعلية!) ---
        const addKeywords = ['حط', 'اضف', 'أضف', 'ضيف', 'عايز منتج', 'اشتري منتج', 'شراء منتج', 'هات لي', 'ضيفلي', 'حطه'];
        const isAddQuery = addKeywords.some(k => text.includes(k));
        
        if (isAddQuery) {
            // Find which product matches the user input
            const cleanText = text.replace(/[؟\?\.!,]/g, '');
            // Filter out query keywords
            const queryWords = cleanText.split(' ').filter(w => !addKeywords.includes(w) && w.trim().length > 1);
            const searchName = queryWords.join(' ').trim();
            
            let matchedProduct = null;
            
            // Check if user refers to the currently displayed product card / panel
            const referKeywords = ['هذا', 'ده', 'الي معروض', 'اللي معروض', 'الي في اللوحه', 'اللي في اللوحة', 'قدامي', 'المعروض', 'اللي في العرض', 'الي في العرض', 'الي في لوحه', 'اللي في لوحة'];
            const refersToCurrent = referKeywords.some(rk => text.includes(rk)) || text.endsWith('ضيف ده') || text.endsWith('ضيفه') || text === 'ضيف' || text === 'حطه';

            if (refersToCurrent && window.currentDisplayedProductId) {
                matchedProduct = products.find(p => p.id === window.currentDisplayedProductId);
            }

            if (!matchedProduct && searchName.length > 0) {
                // Try exact match or partial match on products
                matchedProduct = products.find(p => p.name.toLowerCase().includes(searchName) || p.category.toLowerCase().includes(searchName));
            }
            
            // Fallback: If still not matched, but a product is currently open in the quick view details panel, use it!
            if (!matchedProduct && window.currentDisplayedProductId) {
                matchedProduct = products.find(p => p.id === window.currentDisplayedProductId);
            }
            
            // Second Fallback: If they say "ضيف المنتج" or "ضيف المعروض" and nothing is open, add the first product on the screen!
            if (!matchedProduct && (refersToCurrent || searchName.length === 0)) {
                const visibleProducts = products;
                if (visibleProducts.length > 0) {
                    matchedProduct = visibleProducts[0];
                }
            }

            // Fallback: Default search is handled above

            if (matchedProduct) {
                if (!user) {
                    appendBotMessage(`لقد وجدت هذا المنتج الرائع: <strong>${matchedProduct.name}</strong>، ولكن عذراً، يجب عليك تسجيل الدخول أولاً لأتمكن من إضافته إلى سلة مشترياتك. 😉🔒`);
                    document.getElementById('loginModal').style.display = 'flex';
                    return;
                }
                
                addToCart(matchedProduct.id);
                
                const price = matchedProduct.discount > 0 ? matchedProduct.price * (1 - matchedProduct.discount/100) : matchedProduct.price;
                const visualCard = `
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 18px; padding: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: center; margin-top: 10px; animation: slideUp 0.3s ease; max-width: 200px; margin-left: auto; margin-right: auto;">
                        <img src="${matchedProduct.image}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 12px;">
                        <div style="font-weight: 900; font-size: 0.85rem; color: #1e293b; margin: 8px 0 4px;">${matchedProduct.name}</div>
                        <div style="font-size: 0.85rem; color: var(--primary); font-weight: 900;">${price.toLocaleString()} ج.م</div>
                        <div style="font-size: 0.7rem; color: #10b981; font-weight: 800; margin-top: 5px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i> تمت الإضافة بنجاح!
                        </div>
                    </div>
                `;
                appendBotMessage(`تم الأمر! لقد قمت بإضافة <strong>${matchedProduct.name}</strong> إلى سلة مشترياتك بنجاح. أرفقت لك البطاقة الخاصة بالمنتج في الأسفل. هل أستطيع مساعدتك بشيء آخر؟ 🛒`, false);
                appendBotMessage(visualCard, true);
                return;
            } else {
                appendBotMessage("لقد بحثت في المنتجات المتوفرة لدينا حالياً، ولكنني لم أتمكن من العثور على ما تطابق مع طلبك. يرجى كتابة اسم المنتج بشكل دقيق (مثل: حليب، طماطم، أو زيت) وسأقوم بإحضاره لك فوراً. 🥦🛒");
                return;
            }
        }

        // --- 3. Warm Greetings ---
        const greetings = ['هلا', 'مرحبا', 'سلام', 'السلام عليكم', 'مساء', 'صباح', 'hi', 'hello', 'أهلاً', 'اهلاً', 'منور'];
        if (greetings.some(g => text.includes(g))) {
            const userName = (window.currentUserData && window.currentUserData.name) || (user ? (user.displayName || 'عميل مسعودي المميز') : 'عميل مسعودي المميز');
            appendBotMessage(`أهلاً بك يا <strong>${userName}</strong>! 🌸 طاب يومك بكل خير. أنا مساعدك الذكي الخاص بقطاع البيع بالتجزئة من مسعودي. كيف يُمكنني خدمتك اليوم؟ 😉`);
            showQuickActions();
            return;
        }

        // --- 4. Personal Wallet & Loyalty Points Check ---
        const accountQueries = ['رصيد', 'محفظة', 'محفظه', 'نقاط', 'فلوس', 'حساب'];
        if (accountQueries.some(q => text.includes(q))) {
            if (!user) {
                appendBotMessage("تفاصيل حسابك محفوظة ومحمية! 😉 يرجى تسجيل الدخول أولاً لأتمكن من عرض رصيدك ونقاط الخصم الخاصة بك.");
                document.getElementById('loginModal').style.display = 'flex';
                return;
            }
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const data = userDoc.data();
                    const bal = data.walletBalance || 0;
                    const pts = data.points || 0;
                    
                    // Determine Tier
                    let tier = 'البرونزي 🥉';
                    let tierColor = '#b45309';
                    if (pts >= 5000) { tier = 'الذهبي 👑'; tierColor = '#c29600'; }
                    else if (pts >= 500) { tier = 'الفضي 🥈'; tierColor = '#4b5563'; }

                    const balanceHTML = `
                        <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e2e8f0; border-radius: 20px; padding: 18px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); font-family: 'Cairo', sans-serif; direction: rtl; width: 100%; animation: slideUp 0.3s ease;">
                            <!-- Header -->
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                                <div style="width: 32px; height: 32px; background: rgba(255,107,0,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                                    <i data-lucide="user-check" style="width: 18px; height: 18px;"></i>
                                </div>
                                <span style="font-weight: 900; font-size: 0.95rem; color: #1e293b;">الملخص المالي ومستوى الولاء</span>
                            </div>
                            
                            <!-- Cards Grid -->
                            <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 15px;">
                                <!-- Wallet Card -->
                                <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #a7f3d0; border-radius: 16px; padding: 12px 15px; display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div style="width: 36px; height: 36px; background: #10b981; color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(16,185,129,0.2);">
                                            <i data-lucide="wallet" style="width: 18px; height: 18px;"></i>
                                        </div>
                                        <div>
                                            <div style="font-size: 0.75rem; color: #065f46; font-weight: 700;">رصيد المحفظة</div>
                                            <div style="font-size: 1.1rem; font-weight: 900; color: #064e3b; margin-top: 2px;">${bal.toLocaleString()} ج.م</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Points Card -->
                                <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 1px solid #fed7aa; border-radius: 16px; padding: 12px 15px; display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div style="width: 36px; height: 36px; background: var(--primary); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(255,107,0,0.2);">
                                            <i data-lucide="award" style="width: 18px; height: 18px;"></i>
                                        </div>
                                        <div>
                                            <div style="font-size: 0.75rem; color: #854d0e; font-weight: 700;">نقاط الولاء</div>
                                            <div style="font-size: 1.1rem; font-weight: 900; color: #78350f; margin-top: 2px;">${pts.toLocaleString()} نقطة</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- VIP Tier Level Badge -->
                            <div style="background: #f1f5f9; border-radius: 14px; padding: 10px 15px; display: flex; align-items: center; justify-content: space-between; border: 1px solid #e2e8f0;">
                                <span style="font-size: 0.8rem; color: #64748b; font-weight: 800;">مستواك الحالي:</span>
                                <span style="font-size: 0.85rem; font-weight: 900; color: ${tierColor}; background: white; padding: 4px 12px; border-radius: 30px; border: 1px solid #cbd5e1; box-shadow: 0 2px 5px rgba(0,0,0,0.02); display: inline-flex; align-items: center; gap: 6px;">
                                    ${tier}
                                </span>
                            </div>
                        </div>
                    `;
                    appendBotMessage(`بكل سرور! لقد أحضرت تفاصيل حسابك؛ رصيد محفظتك يبلغ <strong>${bal.toLocaleString()} ج.م</strong>، وتمتلك <strong>${pts.toLocaleString()} نقطة ولاء</strong>. لقد حققت معنا مستوى <strong>${tier}</strong>! أنت عميل مميز دائماً.`, false);
                    appendBotMessage(balanceHTML, true);
                } else {
                    appendBotMessage("عذراً، لم أتمكن من إيجاد حساب مسجل لك. يرجى التأكد من الدخول بالحساب الصحيح! 🔍");
                }
            } catch(e) {
                appendBotMessage("عذراً، توجد مشكلة في الاتصال بالشبكة حالياً. يرجى المحاولة مرة أخرى لاحقاً!");
            }
            return;
        }

        // --- 5. Cart/Basket Check ---
        const cartQueries = ['سلة', 'سله', 'مشتريات', 'كارت', 'عربة', 'عربه'];
        if (cartQueries.some(q => text.includes(q))) {
            if (typeof cart === 'undefined' || cart.length === 0) {
                appendBotMessage("🛒 <strong>سلة مُشترياتك فارغة تماماً!</strong><br>تصفح عروضنا للمنتجات الطازجة والسلع الغذائية، وأضف ما ينال إعجابك! 🛍️🥦", false, "سلة مُشترياتك فارغة تماماً! تصفح عروضنا للمنتجات الطازجة والسلع الغذائية، وأضف ما ينال إعجابك.");
            } else {
                let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                let cartHTML = `🛒 <strong>محتويات السلة الخاصة بك:</strong><br>`;
                let cartSpeech = `محتويات السلة الخاصة بك: `;
                cart.forEach((item, idx) => {
                    cartHTML += `${idx + 1}️⃣ ${item.name} (${item.quantity} قطع) - <strong>${(item.price * item.quantity).toLocaleString()} ج.م</strong><br>`;
                    cartSpeech += `${item.quantity} وحدات من ${item.name}، `;
                });
                cartHTML += `💰 الإجمالي: <strong style="color:var(--primary);">${total.toLocaleString()} ج.م</strong><br><br>💡 اضغط على قائمة السلة بالأسفل لتأكيد طلبك وسنقوم بتوصيله أسرع ما يمكن! 🚀`;
                cartSpeech += `بإجمالي ${total} جنيه. اضغط على قائمة السلة بالأسفل لتأكيد طلبك.`;
                appendBotMessage(cartHTML, false, cartSpeech);
            }
            return;
        }

        // --- 6. Order Tracking ---
        const hasNumbers = /\d+/.test(text);
        if (hasNumbers && (text.includes('تتبع') || text.includes('طلب') || text.includes('رقم') || !isNaN(text.replace(/[^0-9]/g, '')) || text.includes('ord') || text.includes('ms'))) {
            const orderCode = text.replace(/[^0-9]/g, '');
            if (orderCode.length >= 3) {
                await processOrderTracking(orderCode);
                return;
            }
        }

        // --- 7. Search Products ---
        const productKeywords = ['عندكم', 'موجود', 'اشتري', 'سعر', 'كام', 'بكام', 'عايز', 'ابحث', 'منتج', 'منتجات', 'خضار', 'فاكهة', 'بقالة'];
        const isProductQuery = productKeywords.some(k => text.includes(k));
        
        if (isProductQuery) {
            const cleanSearchText = text.replace(/[؟\?\.!,]/g, '');
            const queryWords = cleanSearchText.split(' ').filter(w => !productKeywords.includes(w) && w.trim().length > 1);
            const searchQuery = queryWords.join(' ').trim();
            
            if (searchQuery.length > 0) {
                const found = products.filter(p => p.name.toLowerCase().includes(searchQuery) || p.category.toLowerCase().includes(searchQuery)).slice(0, 3);
                
                if (found.length > 0) {
                    let cardsHTML = `<div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px;">`;
                    found.forEach(p => {
                        const price = p.discount > 0 ? p.price * (1 - p.discount/100) : p.price;
                        cardsHTML += `
                            <div onclick="openQuickView('${p.id}')" style="min-width:140px; background:white; border-radius:15px; border:1px solid #e2e8f0; overflow:hidden; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.05); text-align:center;">
                                <img src="${p.image}" style="width:100%; height:100px; object-fit:cover;">
                                <div style="padding:8px;">
                                    <div style="font-size:0.75rem; font-weight:900; color:#1e293b; margin-bottom:4px;">${p.name}</div>
                                    <div style="font-size:0.75rem; color:var(--primary); font-weight:900;">${price.toLocaleString()} ج.م</div>
                                </div>
                            </div>
                        `;
                    });
                    cardsHTML += `</div>`;
                    appendBotMessage(`دورتلك وجبتلك الخلاصة يا ريس! 😍 المنتجات دي هتاكل عقلك، دوس على أي كارت عشان تشوف تفاصيله:`, false);
                    appendBotMessage(cardsHTML, true);
                    return;
                }
            }
        }

        // --- 8. Knowledge Base & General Explanations (Fusha) ---
        const kb = [
            {
                keys: ['مشاركة', 'مشاركه', 'اصدقاء', 'أصدقاء', 'صديق', 'مكافآت', 'مكافات', 'دعوة', 'دعوه', 'كود الخصم'],
                val: "<strong>هل ترغب في زيادة رصيدك معنا؟ 💸</strong><br>الأمر بغاية السهولة! شارك كود الدعوة الخاص بك (الموجود في الصفحة الرئيسية) مع أصدقائك. بمجرد تسجيل صديقك وطلبه لأول مرة باستخدام الكود، ستحصلان معاً على <strong>مكافأة 20 جنيه</strong> تُضاف فوراً لمحفظتيكما! 🎁✨"
            },
            {
                keys: ['النقاط', 'نقاط', 'ولاء', 'استبدال النقاط', 'هعمل ايه بالنقاط', 'فائدة النقاط'],
                val: "<strong>نقاط ولاء مسعودي هي كنز حقيقي! 🏆</strong><br>مع كل طلب جديد، يزداد رصيد نقاطك ليرتقي بك إلى مستويات أعلى (البرونزي، الفضي، ثم الذهبي 👑). يمكنك استبدال هذه النقاط بخصومات نقدية مباشرة على مشترياتك القادمة، لتستمتع بأفضل المنتجات وتوفر أموالك! 🛒🔥"
            },
            {
                keys: ['شحن', 'اشحن', 'المحفظة', 'محفظه', 'المحفظه', 'فائدة المحفظة', 'رصيد', 'محفظتي'],
                val: "<strong>محفظتك لدينا هي بمثابة حسابك البنكي الآمن! 💼</strong><br>يمكنك شحنها بسهولة (عبر فودافون كاش أو إنستا باي) من زر 'شحن' في القائمة السفلية. تُسهّل المحفظة عملية الدفع لتصبح بضغطة زر، وتمكّنك من تخزين الصرف أو الهدايا لتسوق بلا حدود! 💳🚀"
            },
            {
                keys: ['طلب', 'طريقة', 'كيف', 'ازاي', 'أطلب', 'اطلب', 'اتمام الطلب', 'تحديد الموقع', 'الخريطه', 'الخريطة', 'رقم الهاتف'],
                val: "<strong>إتمام الطلب لدينا سلس للغاية! 🛒</strong><br>1️⃣ من سلة التسوق، اضغط على 'تأكيد الطلب'.<br>2️⃣ أدخل اسمك ورقم هاتفك بدقة للتواصل معك. 📱<br>3️⃣ <strong>الخطوة الأهم:</strong> اضغط على أيقونة الخريطة (الدبوس 📍) وحدد موقعك بدقة بالغة؛ هذا سيمكننا من حساب قيمة التوصيل الرمزية بدقة وتوجيه المندوب لباب منزلك مباشرة! 🗺️🚚"
            },
            {
                keys: ['توصيل', 'شحن', 'شحنكم', 'توصيلكم', 'توصل', 'سعر الشحن', 'المحافظات', 'مندوب', 'المندوب', 'هيجيلي'],
                val: "<strong>فريق توصيل مسعودي هو الأسرع في خدمتك! 🛵</strong><br>بمجرد تحديد موقعك على الخريطة (بالدبوس 📍) أثناء تأكيد الطلب، يتوجه المندوب إليك مباشرة مستعيناً بنظام الملاحة GPS. لن تحتاج بعد اليوم لوصف العنوان؛ نحن نصلك أينما كنت. 🎯"
            },
            {
                keys: ['فاتورة', 'فاتوره', 'الفاتورة', 'تحميل', 'اطبع', 'وصل'],
                val: "<strong>حقوقك محفوظة بالكامل! 📄</strong><br>بعد تأكيد الطلب، ستظهر لك الفاتورة الرسمية الموثقة مع إمكانية تحميلها وطباعتها. وإذا كنت تمتلك حساباً، ستجد كافة فواتيرك مُنظمة في (سجل الطلبات) لسهولة الرجوع إليها متى شئت. 🖨️✅"
            },
            {
                keys: ['دفع', 'طريقة الدفع', 'كاش', 'استلام', 'فيزا', 'دفع عند الاستلام'],
                val: "<strong>طريقة الدفع الأساسية هي 'الدفع عند الاستلام'! 💵</strong><br>لأن راحتك وثقتك تهمنا، نقوم بتسليم الطلب لك لتتأكد من جودة المنتجات أولاً، ومن ثم تقوم بسداد القيمة للمندوب. ميزة لا مثيل لها للثقة والأمان! 😉🛡️"
            },
            {
                keys: ['ضمان', 'مضمون', 'جودة', 'مرتجع', 'ترجيع', 'استرجاع', 'مسترجعة'],
                val: "<strong>ضمان مسعودي الذهبي الثابت! 🛡️🍯</strong><br>يحق لك فحص المنتجات ومراجعتها مع المندوب قبل إجراء أي عمليات دفع. وإذا واجهتك أية ملاحظات تتعلق بالجودة، يمكنك استرجاع المنتج للمندوب بشكل فوري وبدون أية رسوم. نحن نشتري ثقتك وراحتك دوماً."
            },
            {
                keys: ['عنوان', 'مكان', 'مقر', 'فين', 'محافظات', 'مخزن', 'موقعكم'],
                val: "<strong>مركز عملياتنا يقع في قلب التجمع الأول! 🇪🇬</strong><br>ومن هناك، تنطلق فرق التوصيل الخاصة بنا لتلبية طلباتكم في أسرع وقت ممكن وبأعلى معايير الجودة."
            },
            {
                keys: ['خضار', 'فاكهة', 'خضروات', 'فواكه', 'ألبان', 'البان', 'جبن', 'بقالة', 'بقال', 'سلع', 'أرز', 'زيت', 'المنتجات', 'الأنواع', 'الانواع'],
                val: "<strong>نحن نوفر لك أفضل السلع الغذائية والمنتجات الطازجة على الإطلاق! 🥦🍎</strong><br>نحرص على توريد الخضروات والفواكه يوماً بيوم، بالإضافة إلى منتجات الألبان والأجبان الفاخرة، ومختلف سلع البقالة الأساسية بأسعار تنافسية وجودة استثنائية!"
            },
            {
                keys: ['تواصل', 'دعم', 'واتس', 'رقم', 'تليفون', 'رقمكم', 'تشتكي', 'مشكلة', 'شكوى'],
                val: `<strong>فريق الدعم دائماً في خدمتك! 📞</strong><br>إذا كانت لديك أية استفسارات أو احتجت للمساعدة، يمكنك التواصل مباشرة مع خدمة العملاء الحية عبر تطبيق واتساب بالضغط على الزر الأخضر بالأسفل:<br>
                    <a href="https://wa.me/201035528656" target="_blank" style="display:inline-flex; align-items:center; gap:10px; background:#25D366; color:white; padding:10px 20px; border-radius:50px; text-decoration:none; margin-top:10px; font-weight:900; box-shadow:0 5px 15px rgba(37, 211, 102, 0.3);">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-14h.9M22 4L12 14.01M22 4l-6.5 18-3.5-7-7-3.5z"></path></svg>
                        واتساب الدعم: 01035528656
                    </a>`
            },
            {
                keys: ['شكرا', 'تسلم', 'حبيبي', 'تمام', 'شكراً', 'الف شكر', 'ألف شكر', 'جزاك'],
                val: "العفو، هذا من دواعي سروري! نحن هنا لخدمتك وتوفير تجربة تسوق راقية لا تُنسى. لا تتردد بالطلب إذا احتجت لأي شيء آخر! 😊🍯"
            },
            {
                keys: ['مين', 'انت', 'أنت', 'مين انت', 'اسمك'],
                val: "أنا **مساعد مسعودي الذكي** 🤖🎙️! مُصمم بتقنيات متقدمة لمساعدتك في أية عمليات داخل الموقع، من إضافة المنتجات للسلة، لتتبع الطلبات، والإجابة عن استفساراتك العامة لحظة بلحظة!"
            }
        ];

        let matched = false;
        for (let item of kb) {
            if (item.keys.some(k => text.includes(k))) {
                appendBotMessage(item.val);
                matched = true;
                break;
            }
        }

        if (!matched) {
            // Check if Gemini API is enabled for open-ended chatting
            if (window.geminiKey) {
                try {
                    const fallbackTypingDiv = document.createElement('div');
                    fallbackTypingDiv.style = "display:flex; align-items:center; gap:8px; margin-left:40px; margin-bottom:15px; color:#94a3b8; font-size:0.75rem; font-weight:700; direction:rtl;";
                    fallbackTypingDiv.innerHTML = `<span class="spin-animation" style="display:inline-block; width:10px; height:10px; border:2px solid var(--primary); border-top-color:transparent; border-radius:50%; animation: spin 1s linear infinite;"></span> جاري التفكير...`;
                    msgBody.appendChild(fallbackTypingDiv);
                    msgBody.scrollTop = msgBody.scrollHeight;

                    const sysPrompt = `أنت مساعد ذكي ومحترف لمتجر "مسعودي" لتجارة المواد الغذائية والسلع الطازجة في مصر.
مهامك مقتصرة فقط على:
- الإجابة عن أسئلة المنتجات والأسعار والعروض داخل المتجر.
- مساعدة العملاء في إتمام الطلبات، والتوصيل، وطرق الدفع.
- توضيح سياسات الإرجاع والاستبدال والضمان في المتجر.
- الرد على الاستفسارات المتعلقة بحسابات العملاء في المتجر.

إذا سألك أي مستخدم عن موضوع خارج نطاق متجر مسعودي (كالسياسة، الرياضة، التاريخ، التقنية العامة، أو أي موضوع لا علاقة له بالمتجر)، فاعتذر بلطف وذكّره بأنك مساعد متخصص في خدمات متجر مسعودي فقط.
أجب دائماً باللغة العربية الفصحى بأسلوب احترافي وودود وموجز.`;

                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.geminiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: "user", parts: [{ text: `${sysPrompt}\n\nسؤال المستخدم: ${originalText}` }] }]
                        })
                    });
                    const data = await response.json();
                    fallbackTypingDiv.remove();

                    // Log full API response for debug
                    console.log("Gemini response:", JSON.stringify(data));

                    if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
                        const aiText = data.candidates[0].content.parts[0].text.trim();
                        // Format markdown bold **text** to <strong>
                        const formattedText = aiText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        appendBotMessage(formattedText);
                    } else if (data && data.error) {
                        console.error("Gemini API Error:", data.error);
                        appendBotMessage(`عذراً، واجه المساعد خطأً: ${data.error.message || 'يرجى التحقق من مفتاح الـ API.'}`);
                    } else {
                        appendBotMessage("عذراً، لم أتمكن من استيعاب طلبك بشكل كامل. كيف يمكنني إفادتك بطرق أخرى؟");
                        showQuickActions();
                    }
                } catch (e) {
                    appendBotMessage("عذراً، حدث خطأ في الشبكة أثناء محاولة التفكير الذكي! يُرجى التحقق من اتصالك بالإنترنت.");
                    console.error("Gemini Error:", e);
                }
            } else {
                appendBotMessage("أهلاً بك! أنا مساعد مسعودي الذكي. كيف يمكنني إفادتك في تصفح الموقع اليوم؟ هل تريدني أن أفتح لك سلة المشتريات، أمرر لك العروض، أو أعرض لك ملخص حسابك؟ اختر مما يلي:");
                showQuickActions();
            }
        }
    }, 1200);
}

async function processOrderTracking(text) {
    try {
        const user = auth.currentUser;
        if(!user) {
            appendBotMessage("يرجى تسجيل الدخول أولاً لتتمكن من تتبع طلباتك.");
            return;
        }
        const snapshot = await db.collection('orders').where('userId', '==', user.uid).get();
        let foundOrder = null;
        snapshot.forEach(doc => {
            if(doc.id.includes(text) || (doc.data().orderNumber && doc.data().orderNumber.toString().includes(text))) {
                foundOrder = { id: doc.id, ...doc.data() };
            }
        });

        if(foundOrder) {
            const statusMap = {
                'pending': 'انتظار التجهيز 🕒', 'processing': 'جاري التحضير 📦',
                'shipped': 'في الطريق إليك 🚚', 'completed': 'وصل بالسلامة! ✅',
                'archived_received': 'تم استلامه 👍', 'archived_refused': 'تم الرفض ❌'
            };
            let botMsg = `<strong>وجدت طلبك! 🎉</strong><br>كود الطلب: #${foundOrder.orderNumber || foundOrder.id.slice(-5)}<br>الحالة: ${statusMap[foundOrder.status]}`;
            if (foundOrder.rejectionMessage) {
                botMsg += `<br><span style="color:#ef4444; font-weight:bold;">تنبيه: ${foundOrder.rejectionMessage}</span>`;
            }
            appendBotMessage(botMsg);
        } else {
            appendBotMessage("لم أجد طلباً بهذا الكود. جرب الاستفسار عن (كيفية الطلب) أو (التوصيل).");
        }
    } catch(e) {
        appendBotMessage("عذراً، حدث خطأ فني بسيط. حاول مرة أخرى.");
    }
}

window.sendGlobalChat = async (orderId) => {
    const input = document.getElementById('globalChatInput');
    const text = input.value.trim();
    if(!text) return;
    try {
        await db.collection('orders').doc(orderId).collection('chats').add({
            text: text,
            sender: 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        input.value = '';
    } catch (err) { console.error("Chat Send Error:", err); }
};

function setupChatListener(orderId) {
    db.collection('orders').doc(orderId).collection('chats')
        .orderBy('createdAt', 'asc')
        .onSnapshot(snapshot => {
            const box = document.getElementById('globalChatMsgs');
            if(!box) return;
            box.innerHTML = '';
            snapshot.forEach(doc => {
                const m = doc.data();
                const div = document.createElement('div');
                div.className = `msg-bubble ${m.sender}`;
                div.textContent = m.text;
                box.appendChild(div);
            });
            box.scrollTop = box.scrollHeight;
        });
}

// Consolidated Authentication State Listener
auth.onAuthStateChanged(async (user) => {
    window.isInitialAuthCheckDone = true;
    const accountBtn = document.getElementById('accountTrigger');
    const userImg = document.getElementById('userImg');
    const userIcon = accountBtn ? accountBtn.querySelector('i') : null;
    const navContact = document.getElementById('nav-contact');

    if (user) {
        // --- Universal Admin Recognition ---
        const userEmail = (user.email || '').toLowerCase().trim();
        const isSuperAdmin = userEmail === 'engyhamid860@gmail.com';
        if (isSuperAdmin) {
             console.log("👑 [AUTH] Super Admin detected globally:", userEmail);
             window.isAdmin = true;
        }

        // 1. UI Updates (Header & Nav)
        if (user.photoURL && userImg) {
            userImg.src = user.photoURL;
            userImg.style.display = 'block';
            if(userIcon) userIcon.style.display = 'none';
        } else {
            if (userIcon) userIcon.style.display = 'block';
            if (userImg) userImg.style.display = 'none';
        }
        if (accountBtn) accountBtn.onclick = () => navigateTo('contactPage');
        if (navContact) navContact.onclick = () => navigateTo('contactPage');

        // 2. Data & Tracking
        try {
            // Force fetching from server to avoid local cache false-negatives
            let userDoc;
            try {
                userDoc = await db.collection('users').doc(user.uid).get({ source: 'server' });
            } catch (getErr) {
                console.error("Critical: Failed to fetch user doc from server:", getErr);
                // Fallback to cache if server fetch fails - may still allow some functionality
                userDoc = await db.collection('users').doc(user.uid).get();
            }

            if (userDoc && userDoc.exists) {
                const userData = userDoc.data();
                if (userData.isBanned && userData.role !== 'admin' && userData.role !== 'super_admin') {
                    alert("⚠️ نأسف، لقد تم حظر حسابك. تواصل مع الدعم.");
                    auth.signOut();
                    return;
                }
                
                // Automatically sync profile details
                try {
                    const updates = {};
                    if ((!userData.name || userData.name === 'عميل مسعودي') && user.displayName) {
                        updates.name = user.displayName;
                    }
                    if (!userData.photo && !userData.photoURL && user.photoURL) {
                        updates.photo = user.photoURL;
                        updates.photoURL = user.photoURL;
                    }
                    if (Object.keys(updates).length > 0) {
                        await db.collection('users').doc(user.uid).update(updates);
                    }
                } catch (syncErr) {
                    console.warn("Profile sync partially failed (likely permissions):", syncErr.message);
                }

                // 2.1 Driver & Merchant Role Recognition
                const driverBtn = document.getElementById('deliveryDashboardBtn');
                const merchantEntryBtn = document.getElementById('merchantEntryBtn');

                if (userData.role === 'delivery_partner') {
                    if (driverBtn) driverBtn.style.display = 'flex';
                    if (document.getElementById('deliveryPage')?.classList.contains('active')) {
                        initDriverPortal();
                    }
                } else if (driverBtn) {
                    driverBtn.style.display = 'none';
                }

                if (userData.isMerchant || userData.merchantStatus === 'approved' || isSuperAdmin) {
                    isMerchantUser = true; // Sync global flag for navigation
                    updateMerchantButtonUI('approved');
                    if (typeof loadMerchantPageForUser === 'function') loadMerchantPageForUser(user);
                } else if (userData.merchantStatus === 'pending') {
                    isMerchantUser = false;
                    updateMerchantButtonUI('pending');
                } else {
                    isMerchantUser = false;
                    updateMerchantButtonUI('none');
                }
            } else {
                // Secure atomic creation of user profile
                console.log("Creating new user profile for:", user.uid);
                const storedRef = sessionStorage.getItem('referral_code');
                const newUserDoc = {
                    name: user.displayName || 'عميل جديد',
                    email: user.email || '',
                    phone: user.phoneNumber || '',
                    photo: user.photoURL || '',
                    walletBalance: 0,
                    points: 0,
                    role: 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (storedRef) newUserDoc.referredByCode = storedRef;

                await db.collection('users').doc(user.uid).set(newUserDoc);
                console.log("User profile created successfully");
                
                // Referral Tracking (Balance update must happen via Admin/Cloud Function for security)
                if (storedRef) {
                    try {
                        const referrersSnap = await db.collection('users').where('referralCode', '==', storedRef).get({ source: 'server' });
                        if (!referrersSnap.empty) {
                            const referrerId = referrersSnap.docs[0].id;
                            
                            console.log("Referral tracked for referrer:", referrerId);
                            // NOTE: Client-side updates to other users' balances are blocked by security rules.
                            // The 'referredByCode' field in this new user document is enough for admin tracking.
                        }
                    } catch (refErr) {
                        console.warn("Referral tracking skipped:", refErr.message);
                    } finally {
                        sessionStorage.removeItem('referral_code');
                    }
                }
            }
        } catch (err) { 
            console.error("Initialization Flow Error:", err); 
        }

        if (typeof trackOrders === 'function') trackOrders();
        if (typeof loadUserProfile === 'function') loadUserProfile(user);
        
        // Load Smart Assistant Bot for authenticated users
        if (typeof addGlobalChat === 'function') addGlobalChat();

        // 3. Auto-close login modal if open
        const loginModal = document.getElementById('loginModal');
        if(loginModal && loginModal.style.display === 'flex') {
            loginModal.style.display = 'none';
            // Open the products page (homePage) directly for the customer after login/register
            navigateTo('homePage');
        }

    } else {
        // Guest State
        isMerchantUser = false; // Reset role flag for guests
        if (userIcon) userIcon.style.display = 'block';
        if (userImg) userImg.style.display = 'none';
        
        const loginTrigger = () => {
            const modal = document.getElementById('loginModal');
            if (modal) {
                modal.style.display = 'flex';
                // Refresh Lucide icons for the new modal structure
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            // Re-render GSI button if possible to ensure visibility
            if (typeof google !== 'undefined' && google.accounts.id.renderButton) {
                const btnCont = document.getElementById("g_id_signin");
                if (btnCont) {
                    btnCont.innerHTML = ''; // Clear for fresh render
                    google.accounts.id.renderButton(btnCont, {
                        theme: "outline", size: "large", width: "100%", text: "signin_with", shape: "pill", logo_alignment: "left"
                    });
                }
            }
            window.showToast("يرجى تسجيل الدخول أولاً للوصول لحسابك 🔑");
        };

        if (accountBtn) accountBtn.onclick = loginTrigger;
        if (navContact) navContact.onclick = loginTrigger;

        // Reset Profile UI
        if (document.getElementById('profileUserName')) {
            document.getElementById('profileUserName').textContent = 'زائر';
            document.getElementById('profileUserEmail').textContent = '';
            document.getElementById('profileUserImg').src = '';
            
            // Reset VIP Elements
            const vipEls = ['superAdminCrown', 'superAdminAura', 'superAdminBadge', 'vipStatusText', 'profileVerifiedBadge', 'superAdminEntryBtn'];
            vipEls.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }
        if (window.userProfileUnsub) {
            window.userProfileUnsub();
            window.userProfileUnsub = null;
        }

        if (orderSnapshotUnsub) {
            orderSnapshotUnsub();
            orderSnapshotUnsub = null;
        }
        const cartTrackingSection = document.getElementById('myOrdersContainer');
        if (cartTrackingSection) cartTrackingSection.style.display = 'none';
        document.body.querySelectorAll('.global-chat-btn, .chat-popup').forEach(el => el.remove());
    }
    if (typeof loadShoppingLists === 'function') loadShoppingLists();
});

window.closeSuccessAndShowTracking = () => {
    document.getElementById('successModal').style.display = 'none';
    openCart(); // Open the cart to show the new order tracking
    trackOrders();
};


// Auth Logic
window.login = () => {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';
        console.log("Login modal opened via window.login()");
        
        // Re-render Google button every time modal opens to ensure visibility
        if (window.google && google.accounts.id) {
            const btnCont = document.getElementById("g_id_signin");
            if (btnCont) {
                google.accounts.id.renderButton(btnCont, {
                    theme: "outline", size: "large", width: 320, text: "signin_with", shape: "pill", logo_alignment: "left"
                });
                console.log("GSI Button re-rendered in modal with fixed width");
                
                // Hide fallback ONLY if GSI actually rendered content
                setTimeout(() => {
                    const fallback = document.getElementById('gsiFallbackBtn');
                    if (btnCont.innerHTML !== "" && fallback) {
                        fallback.style.display = 'none';
                        console.log("GSI: Modal success, hiding fallback");
                    }
                }, 500);
            }
        } else {
            // No google library, ensure fallback is visible (it should be by default)
            const fb = document.getElementById('gsiFallbackBtn');
            if (fb) fb.style.display = 'flex';
        }
    } else {
        // Fallback for direct Google login if modal isn't found
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(err => alert("خطأ: " + err.message));
    }
};

window.handleConfirmDelivery = async (orderId, type) => {
    const msg = type === 'received' ? "هل تؤكد استلام الطلب بنجاح؟" : "يجب دفع مصاريف الشحن للمندوب. هل أنت متأكد؟";
    if (!confirm(msg)) return;

    try {
        const finalStatus = type === 'received' ? 'archived_received' : 'archived_refused';
        const updateData = { 
            status: finalStatus,
            customerFeedback: type,
            finishedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (type === 'refused') {
            updateData.rejectionMessage = "يجب دفع مصاريف الشحن";
        }

        await db.collection('orders').doc(orderId).update(updateData);
        
        if(type === 'received') {
            await window.awardPointsIfCompleted(orderId);
            alert("شكراً لك! تم إتمام الطلب بنجاح.");
        } else {
            alert("يجب دفع مصاريف الشحن للمندوب");
        }
        
        trackOrders();
    } catch (error) { alert("خطأ: " + error.message); }
};

window.logout = () => {
    if(confirm("هل تريد تسجيل الخروج؟")) {
        localStorage.removeItem('masoudi_has_session'); // Clear persistence flag
        auth.signOut().then(() => window.location.reload());
    }
};

window.closeLogin = () => document.getElementById('loginModal').style.display = 'none';

// Toast
/*
function showToast() {
    const t = document.getElementById('toast');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}
*/

// Auth Logic

window.logout = () => {
    if(confirm("هل تريد تسجيل الخروج؟")) {
        localStorage.removeItem('masoudi_has_session'); // Clear persistence flag
        auth.signOut().then(() => window.location.reload());
    }
};

window.closeLogin = () => document.getElementById('loginModal').style.display = 'none';

// Banner Slider Logic
let currentBannerIndex = 0;
let bannerInterval;

async function initBannerSlider() {
    const slider = document.getElementById('bannerSlider');
    const dotsContainer = document.getElementById('sliderDots');
    if(!slider) return;

    try {
        const doc = await db.collection('settings').doc('bannerSlider').get();
        let validSlides = [];
        let duration = 5000;

        if (doc.exists) {
            const data = doc.data();
            const slides = data.slides || [];
            duration = (data.duration || 5) * 1000;
            validSlides = slides.filter(s => s.image);
            
            // Fallback for old data format
            if (validSlides.length === 0 && data.images) {
                validSlides = data.images.map(img => ({ image: img, title: '', subtitle: '' }));
            }
        }

        if (validSlides.length === 0) {
            validSlides = [
                { image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80', title: 'أهلاً بكم في متجر مسعودي', subtitle: 'اكتشف عروضنا الحصرية الآن' }
            ];
        }

        const isHome = document.getElementById('homePage')?.classList.contains('active');
        if (isHome) {
            document.getElementById('bannerSliderContainer').style.display = 'block';
        } else {
            document.getElementById('bannerSliderContainer').style.display = 'none';
        }
        
        slider.innerHTML = validSlides.map(s => `
            <div class="banner-slide">
                <img src="${s.image}" alt="Banner">
                ${(s.title || s.subtitle) ? `
                    <div class="banner-content">
                        ${s.title ? `<h2>${s.title}</h2>` : ''}
                        ${s.subtitle ? `<p>${s.subtitle}</p>` : ''}
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Dots
        dotsContainer.innerHTML = validSlides.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`).join('');
        
        function updateSlider() {
            // In RTL, we move positive to show previous slides, negative to show next? 
            // Actually with display flex, it's safer to use 100 * index.
            const offset = currentBannerIndex * 100;
            slider.style.transform = `translateX(${offset}%)`; // In RTL, positive offset moves to the right which is 'next'
            document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === currentBannerIndex));
        }

        window.goToSlide = (index) => {
            currentBannerIndex = index;
            updateSlider();
        };

        if (bannerInterval) clearInterval(bannerInterval);
        if (validSlides.length > 1) {
            bannerInterval = setInterval(() => {
                currentBannerIndex = (currentBannerIndex + 1) % validSlides.length;
                updateSlider();
            }, duration);
        }
    } catch (error) { 
        console.error("Slider error:", error);
        document.getElementById('bannerSliderContainer').style.display = 'none';
    }
}

// Enhanced Initialization
function startApp() {
    console.log("App Starting...");
    
    try {
        if (typeof fetchProducts === 'function') fetchProducts();
        if (typeof initBannerSlider === 'function') initBannerSlider();
        
        // Removed duplicate onAuthStateChanged listener to prevent conflicts
        // Logic moved to consolidated listener above

        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (typeof setupFilters === 'function') setupFilters();
        if (typeof updateCartUI === 'function') updateCartUI();
        if (typeof updateWishlistUI === 'function') updateWishlistUI();
        if (typeof loadCategoriesMain === 'function') loadCategoriesMain();
        if (typeof loadSiteConfigMain === 'function') loadSiteConfigMain();
        if (typeof loadOffers === 'function') loadOffers();
        if (typeof loadSpecialOffers === 'function') loadSpecialOffers();

        // Hide Splash Screen much faster to avoid artificial delay
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.classList.add('hidden');
                setTimeout(() => splash.remove(), 400); // Fast fade out removal
            }
        }, 100);

    } catch (e) {
        console.error("Initialization error:", e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// fetchProducts consolidated above

async function loadCategoriesMain() {
    const container = document.getElementById('categoryPills');
    if(!container) return;

    try {
        const snap = await db.collection('categories').get();
        window.allCategories = {};
        // Keep the "All" icon
        container.innerHTML = `
            <div class="category-icon-item active" onclick="filterByCategory('all', this)">
                <div class="category-icon-wrapper">
                    <i data-lucide="layout-grid"></i>
                </div>
                <span>الكل</span>
            </div>
        `;

        // Default categories to ensure the wheel is always populated
        const defaultCategoriesMap = {
            'supermarket': { id: 'supermarket', name: 'سوبر ماركت', icon: 'shopping-cart' },
            'restaurant': { id: 'restaurant', name: 'مطاعم', icon: 'utensils' },
            'pharmacy': { id: 'pharmacy', name: 'صيدليات', icon: 'pill' },
            'bakery': { id: 'bakery', name: 'مخابز', icon: 'croissant' },
            'butcher': { id: 'butcher', name: 'لحوم ودواجن', icon: 'beef' },
            'vegetables': { id: 'vegetables', name: 'خضروات وفواكه', icon: 'carrot' },
            'sweets': { id: 'sweets', name: 'حلويات وتسالي', icon: 'ice-cream' },
            'coffee': { id: 'coffee', name: 'مقاهي وبن', icon: 'coffee' },
            'beauty': { id: 'beauty', name: 'عطور وتجميل', icon: 'sparkles' },
            'electronics': { id: 'electronics', name: 'إلكترونيات', icon: 'laptop' },
            'fashion': { id: 'fashion', name: 'أزياء', icon: 'shirt' },
            'toys': { id: 'toys', name: 'ألعاب أطفال', icon: 'gamepad-2' },
            'pets': { id: 'pets', name: 'مستلزمات حيوانات', icon: 'dog' },
            'stationery': { id: 'stationery', name: 'كتب وقرطاسية', icon: 'book-open' },
            'gifts': { id: 'gifts', name: 'هدايا وزهور', icon: 'gift' },
            'sports': { id: 'sports', name: 'أدوات رياضية', icon: 'dumbbell' },
            'car_accessories': { id: 'car_accessories', name: 'مستلزمات سيارات', icon: 'car' },
            'offers': { id: 'offers', name: 'عروض جملة', icon: 'tags' }
        };

        const finalCategories = {};
        
        // Add defaults first (disabled to only show custom categories from control panel)
        /*
        Object.values(defaultCategoriesMap).forEach(cat => {
            finalCategories[cat.id] = cat;
        });
        */

        // Override/add with Firebase data
        if (!snap.empty) {
            snap.forEach(doc => {
                finalCategories[doc.id] = { id: doc.id, ...doc.data() };
            });
        }

        Object.values(finalCategories).forEach(cat => {
            window.allCategories[cat.id] = cat;
            const translation = {
                'electronics': 'إلكترونيات',
                'fashion': 'أزياء',
                'home': 'المنزل',
                'offers': 'عروض جملة'
            };
            let displayName = cat.name;
            if (translation[cat.id] && (displayName === cat.id || /^[a-zA-Z\s]+$/.test(displayName))) {
                displayName = translation[cat.id];
            }

            const pill = document.createElement('div');
            pill.className = 'category-icon-item';
            pill.onclick = () => filterByCategory(cat.id, pill);
            
            let iconHtml = `<i data-lucide="${cat.icon || 'tag'}"></i>`;
            if (cat.image) {
                iconHtml = `<img src="${cat.image}" alt="${displayName}" style="height: 100%; width: auto; object-fit: contain; border-radius: inherit; max-width: 250px;">`;
            }

            pill.innerHTML = `
                <div class="category-icon-wrapper">
                    ${iconHtml}
                </div>
                <span>${displayName}</span>
            `;
            container.appendChild(pill);
        });
        
        if (window.lucide) lucide.createIcons();
        
        // Re-render products to split into sections now that categories are loaded
        if (typeof products !== 'undefined' && products.length > 0) {
            renderProducts(products);
        }
    } catch (err) { console.error("Load Categories Main Error:", err); }
}

window.filterByCategory = (catId, el) => {
    if(!el) return;
    
    // UI Update
    document.querySelectorAll('.category-icon-item').forEach(p => p.classList.remove('active'));
    el.classList.add('active');

    // ★ Set the global filter flag
    window.currentCategoryFilter = catId;

    if (catId === 'all') {
        navigateTo('homePage');
        if (typeof renderStores === 'function') renderStores();
        if (typeof products !== 'undefined' && products.length > 0) {
            renderProducts(products);
        }
    } else {
        navigateTo('categoryPage');
        if (typeof renderCategoryStores === 'function') {
            renderCategoryStores(catId);
        }
    }
};

window.renderCategoryStores = (catId) => {
    const grid = document.getElementById('categoryPageStoresGrid');
    const title = document.getElementById('categoryPageTitle');
    if (!grid || !title) return;

    // Set title
    const translation = {
        'electronics': 'إلكترونيات',
        'fashion': 'أزياء',
        'home': 'المنزل',
        'offers': 'عروض جملة'
    };
    let catName = catId;
    if (window.allCategories && window.allCategories[catId]) {
        catName = window.allCategories[catId].name;
    }
    if (translation[catId] && (catName === catId || /^[a-zA-Z\s]+$/.test(catName))) {
        catName = translation[catId];
    }
    title.textContent = catName || 'المتاجر';

    // Clear grid
    grid.innerHTML = '';

    // Filter merchants based on category
    let filteredMerchants = window.merchants || [];
    if (catId !== 'all') {
        const isOffers = catId === 'offers' || catId.includes('عرض');
        filteredMerchants = filteredMerchants.filter(m => {
            const matchCat = m.category === catId || m.type === catId;
            const hasOffers = isOffers && (m.hasOffers || (m.covers && m.covers.length > 1)); 
            return matchCat || hasOffers;
        });
    }

    if (filteredMerchants.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 100px 20px; color: var(--text-muted);"><h3>لا توجد متاجر في هذا القسم حالياً</h3></div>';
        return;
    }

    // Render store mini cards (like homepage)
    filteredMerchants.forEach(m => {
        const isOpen = isStoreCurrentlyOpen ? isStoreCurrentlyOpen(m) : true;
        const card = document.createElement('div');
        card.className = `store-mini-card fade-in ${!isOpen ? 'store-closed' : ''}`;
        card.onclick = () => openStoreMenu(m.id);
        card.setAttribute('data-store-name', m.name.toLowerCase());
        
        card.innerHTML = `
            <div style="position:relative; margin-bottom: 5px;">
                <img src="${m.logo || 'https://ui-avatars.com/api/?name='+m.name+'&background=ff6b00&color=fff'}" class="mini-card-logo" style="${!isOpen ? 'filter: grayscale(0.8); opacity: 0.7;' : ''}">
                <div style="position:absolute; bottom:6px; left:6px; width:16px; height:16px; background:${isOpen ? '#10b981' : '#ef4444'}; border:3px solid white; border-radius:50%; box-shadow:0 0 15px ${isOpen ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'};"></div>
                ${!isOpen ? `
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.6); color:white; padding:4px 10px; border-radius:10px; font-size:0.65rem; font-weight:900; white-space:nowrap; backdrop-filter:blur(4px);">مغلق حالياً</div>
                ` : ''}
            </div>
            <h3 class="mini-card-name" style="${!isOpen ? 'color:#94a3b8;' : ''}">${m.name}</h3>
            <span class="mini-card-tag">${m.type || 'متجر'}</span>
            <div style="display:flex; align-items:center; gap:4px; color:#fbbf24; font-size:0.8rem; font-weight:1000; margin-top:2px;">
                <i data-lucide="star" style="width:14px; fill:currentColor;"></i>
                <span>4.9</span>
                <span style="color:#94a3b8; font-weight:700; margin-right:4px;">(50+)</span>
            </div>
        `;
        grid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
};

window.filterCategoryStoresLocal = function() {
    const srch = document.getElementById('categoryStoreSearchInput')?.value.trim().toLowerCase();
    const grid = document.getElementById('categoryPageStoresGrid');
    if(!grid) return;
    
    Array.from(grid.children).forEach(card => {
        const name = card.getAttribute('data-store-name') || '';
        if(srch === '' || name.includes(srch)) {
            card.style.display = 'flex'; // store-mini-card is usually flex or block based
        } else {
            card.style.display = 'none';
        }
        
        // Ensure its not breaking grid layouts (display: none works fine for grid children)
    });
};

window.viewAllCategory = (catId) => {
    // ★ Set filter flag FIRST so renderProducts renders in flat unlimited mode
    window.currentCategoryFilter = catId;

    // Find and activate the matching pill (support both search pills and home categories)
    const pills = Array.from(document.querySelectorAll('.category-pill, .category-icon-item'));
    const targetPill = pills.find(pill => {
        const onclickStr = pill.getAttribute('onclick') || (pill.onclick ? pill.onclick.toString() : '');
        return onclickStr.includes(`'${catId}'`) || onclickStr.includes(`"${catId}"`);
    });

    if (targetPill) {
        // Activate pill UI
        document.querySelectorAll('.category-icon-item').forEach(p => p.classList.remove('active'));
        targetPill.classList.add('active');
    }

    // Render ALL products for this category (no limit)
    const filtered = (products || []).filter(p => catId === 'all' || p.category === catId);
    
    // Call renderProducts with forceProducts = true to ensure we see products
    if (typeof renderProducts === 'function') {
        renderProducts(filtered, true);
    }
    
    // Scroll to products section
    const prodSec = document.getElementById('integratedProducts') || document.getElementById('productsGrid');
    if (prodSec) {
        prodSec.scrollIntoView({ behavior: 'smooth' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

function setupFilters() {
    const searchPageInput = document.getElementById('searchPageInput');
    if (searchPageInput) {
        searchPageInput.addEventListener('input', () => {
            if (typeof applySearchPageFilters === 'function') applySearchPageFilters();
        });
    }
}

window.renderSearchProducts = (filtered = products) => {
    const grid = document.getElementById('searchProductsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 100px; color: var(--text-muted);"><h3>لا توجد منتجات تطابق بحثك حالياً</h3></div>';
        return;
    }

    filtered.forEach(p => {

        const card = createProductCardHTML(p);
        grid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
};

window.filterSearchByCategory = (catId, el) => {
    document.querySelectorAll('#searchCategoryPills .category-pill').forEach(p => p.classList.remove('active'));
    if (el) el.classList.add('active');

    window.currentSearchCategoryFilter = catId;
    if (typeof applySearchPageFilters === 'function') applySearchPageFilters();
};

window.applySearchPageFilters = () => {
    const input = document.getElementById('searchPageInput');
    const searchTerm = input ? input.value.toLowerCase().trim() : '';
    const catId = window.currentSearchCategoryFilter || 'all';

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm);
        const matchesCategory = catId === 'all' || p.category === catId;
        return matchesSearch && matchesCategory;
    });

    renderSearchProducts(filtered);
};

window.openSearchPage = () => {
    if (typeof navigateTo === 'function') navigateTo('searchPage');
    
    // Reset search inputs & filter state
    const input = document.getElementById('searchPageInput');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 200);
    }
    window.currentSearchCategoryFilter = 'all';

    // Populate Categories on Search Page
    const pillsContainer = document.getElementById('searchCategoryPills');
    if (pillsContainer && window.allCategories) {
        pillsContainer.innerHTML = `
            <div class="category-pill active" onclick="filterSearchByCategory('all', this)">
                <i data-lucide="layout-grid"></i>
                <span>الكل</span>
            </div>
        `;
        Object.keys(window.allCategories).forEach(catId => {
            const cat = window.allCategories[catId];
            const translation = {
                'electronics': 'إلكترونيات',
                'fashion': 'أزياء',
                'home': 'المنزل',
                'offers': 'عروض جملة'
            };
            const iconMap = {
                'electronics': 'smartphone',
                'fashion': 'shirt',
                'home': 'sofa',
                'offers': 'percent',
                'restaurant': 'utensils',
                'bakery': 'cake',
                'supermarket': 'shopping-cart',
                'veggies': 'apple',
                'meat': 'drumstick',
                'dairy': 'droplet',
                'perfumes': 'sparkles',
                'kitchen': 'chef-hat',
                'health': 'pill',
                'toys': 'gamepad-2',
                'sports': 'dumbbell',
                'books': 'book-open',
                'gifts': 'gift',
                'cleaning': 'spray-can',
                'pets': 'github',
                'general': 'layout-grid',
                'other': 'package'
            };
            
            let displayName = cat.name;
            if (translation[catId] && (displayName === catId || /^[a-zA-Z\s]+$/.test(displayName))) {
                displayName = translation[catId];
            }

            const pill = document.createElement('div');
            pill.className = 'category-pill';
            pill.onclick = () => filterSearchByCategory(catId, pill);
            
            let iconStr = cat.icon || iconMap[catId] || 'tag';
            
            pill.innerHTML = `
                <i data-lucide="${iconStr}"></i>
                <span>${displayName}</span>
            `;
            pillsContainer.appendChild(pill);
        });
        if (window.lucide) lucide.createIcons();
    }

    // Load all products on the search page initially
    renderSearchProducts(products);
};

async function loadSiteConfigMain() {
    try {
        const doc = await db.collection('settings').doc('siteConfig').get();
        if (doc.exists) {
            const data = doc.data();
            
            // Apply Primary Color
            if (data.primaryColor) {
                document.documentElement.style.setProperty('--primary', data.primaryColor);
                // Calculate glow/hover colors
                document.documentElement.style.setProperty('--primary-glow', data.primaryColor + '33');
            }

            // Apply Logo
            if (data.siteLogo) {
                document.querySelectorAll('.brand-icon-wrapper img, .admin-sidebar img, .logo img').forEach(img => {
                    img.src = data.siteLogo;
                });
            }

            // Apply Welcome Texts
            if (data.welcomeTitle) {
                const heroTitle = document.querySelector('.hero h1');
                if (heroTitle) heroTitle.textContent = data.welcomeTitle;
            }
            if (data.welcomeSub) {
                const heroSub = document.querySelector('.hero p');
                if (heroSub) heroSub.textContent = data.welcomeSub;
            }
        }
    } catch (err) { console.error("Load Site Config Error:", err); }
}

async function loadUserProfile(user) {
    if (!user) return;

    // --- Super Admin Special Branding & Access ---
    // Moved to top-level for immediate activation without waiting for Firestore snapshot
    const authEmail = (user.email || '').toLowerCase().trim();
    const isSuperAdmin = authEmail === 'engyhamid860@gmail.com';
    
    console.log("🔑 [TOP-LEVEL] ADMIN CHECK:", { authEmail, isSuperAdmin });
    
    if (isSuperAdmin) {
        console.log("🌟 VIP System: Super Admin Identified (Top-Level) - Activating Features", authEmail);
        const adminBadge = document.getElementById('profileVerifiedBadge');
        const adminLabel = document.getElementById('superAdminBadge');
        const manageDeliveryBtn = document.getElementById('manageDeliveryBtn');
        const merchantEntryBtn = document.getElementById('merchantEntryBtn');
        const adminMenuEntry = document.getElementById('adminMenuEntry');
        const vipCrown = document.getElementById('superAdminCrown');
        const vipAura = document.getElementById('superAdminAura');
        const vipLevel = document.getElementById('vipStatusText');

        if (adminBadge) adminBadge.style.display = 'flex';
        if (adminLabel) adminLabel.style.display = 'flex';
        if (manageDeliveryBtn) manageDeliveryBtn.style.display = 'flex';
        if (merchantEntryBtn) merchantEntryBtn.style.display = 'flex';
        if (adminMenuEntry) {
            adminMenuEntry.style.display = 'flex';
            console.log("✅ [TOP-LEVEL] adminMenuEntry found and shown");
        }
        const manageMerchantsBtn = document.getElementById('manageMerchantsBtn');
        if (manageMerchantsBtn) manageMerchantsBtn.style.display = 'flex';
        if (vipCrown) vipCrown.style.display = 'block';
        if (vipAura) vipAura.style.display = 'block';
        if (vipLevel) vipLevel.style.display = 'block';

        const profileImg = document.getElementById('profileUserImg');
        if (profileImg) profileImg.style.animation = 'imagePulse 2s infinite ease-in-out';
        
        window.isMerchantUser = true; // Set globally for super admin
    }

    // --- Real-time Profile & Wallet Listener ---
    if (window.userProfileUnsub) window.userProfileUnsub();
    
    window.userProfileUnsub = db.collection('users').doc(user.uid).onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            
            // Cache globally for other modules (chatbot, checkout, reviews, recharge)
            window.currentUserData = data;
            
            // 1. Sync User Name in Real-time from Firestore
            if (data.name && document.getElementById('profileUserName')) {
                document.getElementById('profileUserName').textContent = data.name;
            }

            // 2. Sync User Profile & Header Images in Real-time from Firestore
            const firestorePhoto = data.photo || data.photoURL;
            if (firestorePhoto) {
                if (document.getElementById('profileUserImg')) {
                    document.getElementById('profileUserImg').src = firestorePhoto;
                }
                const headerImg = document.getElementById('userImg');
                const headerIcon = document.getElementById('accountTrigger') ? document.getElementById('accountTrigger').querySelector('i') : null;
                if (headerImg) {
                    headerImg.src = firestorePhoto;
                    headerImg.style.display = 'block';
                    if (headerIcon) headerIcon.style.display = 'none';
                }
            }

            // Update Wallet Balance UI
            const balanceEl = document.getElementById('walletBalance');
            if (balanceEl) {
                const bal = data.walletBalance || 0;
                balanceEl.textContent = bal.toLocaleString();
            }

            // Update Loyalty UI
            updateLoyaltyUI(data.points || 0);

            // Update Referral UI
            const refEl = document.getElementById('referralCodeDisplay');
            if (refEl) {
                if (data.referralCode) {
                    refEl.textContent = data.referralCode;
                } else {
                    const newCode = 'MS' + Math.random().toString(36).substring(2, 8).toUpperCase();
                    db.collection('users').doc(user.uid).update({ referralCode: newCode });
                    refEl.textContent = newCode;
                }
            }

            // Update Notification Switches (Persistent & Correct Defaults)
            const settings = data.notificationSettings || { orders: true, offers: true };
            const ordersSwitch = document.getElementById('notifOrders');
            const offersSwitch = document.getElementById('notifOffers');
            if (ordersSwitch) ordersSwitch.checked = settings.orders !== false;
            if (offersSwitch) offersSwitch.checked = settings.offers !== false;
            
            // Store globally for quick access in notify functions
            window.userNotifSettings = settings;

            // Update Merchant Status & Button State
            isMerchantUser = data.isMerchant === true || data.merchantStatus === 'approved';
            if (isMerchantUser) {
                updateMerchantButtonUI('approved');
            } else if (data.merchantStatus === 'pending') {
                updateMerchantButtonUI('pending');
            } else {
                updateMerchantButtonUI('none');
            }

            // Fill profile inputs if they exist (legacy support)
            if (document.getElementById('profilePhone')) document.getElementById('profilePhone').value = data.phone || '';
            if (document.getElementById('profileAddress')) document.getElementById('profileAddress').value = data.address || '';
            
            // Auto-fill checkout form
            const fields = {
                'checkoutName': user.displayName,
                'checkoutPhone': data.phone,
                'checkoutAddress': data.address,
                'latlng': data.latlng
            };
            for (let id in fields) {
                const el = document.getElementById(id);
                if (el && !el.value) el.value = fields[id] || '';
            }
            
            // Fill name input in settings if it exists and is currently empty
            const nameInput = document.getElementById('profileNameInput');
            if (nameInput && !nameInput.value) {
                nameInput.value = data.name || user.displayName || '';
            }

            // --- Super Admin Special Branding & Access ---
            // Use both Auth email and Firestore email for maximum robustness
            const authEmail = (user.email || '').toLowerCase().trim();
            const firestoreEmail = (data.email || '').toLowerCase().trim();
            const isSuperAdmin = authEmail === 'engyhamid860@gmail.com' || firestoreEmail === 'engyhamid860@gmail.com' || user.email === 'engyhamid860@gmail.com';
            
            console.log("🔑 [DEBUG] ADMIN CHECK:", { 
                authEmail, 
                firestoreEmail, 
                userEmail: user.email,
                isSuperAdmin,
                uid: user.uid 
            });
            
            const adminBadge = document.getElementById('profileVerifiedBadge'); // The blue checkmark
            const adminLabel = document.getElementById('superAdminBadge');     // The "General Manager" label
            
            // VIP Exclusive Elements
            const vipCrown = document.getElementById('superAdminCrown');
            const vipAura = document.getElementById('superAdminAura');
            const vipLevel = document.getElementById('vipStatusText');
            const profileHeader = document.getElementById('profileHeader');
            const avatarContainer = document.getElementById('profileAvatarContainer');
            const manageDeliveryBtn = document.getElementById('manageDeliveryBtn');
            const deliveryDashboardBtn = document.getElementById('deliveryDashboardBtn');

            if (isSuperAdmin) {
                console.log("🌟 VIP System: Super Admin Identified - Activating ALL Features", authEmail);
                if (adminBadge) adminBadge.style.display = 'flex';
                if (adminLabel) adminLabel.style.display = 'flex';
                if (manageDeliveryBtn) manageDeliveryBtn.style.display = 'flex';
                
                // Show new merchant and contact shortcuts for super admin
                const merchantEntryBtn = document.getElementById('merchantEntryBtn');
                if (merchantEntryBtn) merchantEntryBtn.style.display = 'flex';
                
                isMerchantUser = true; // Super admin acts as merchant too

                // Specific addition for the floating menu control panel requested by user
                const adminMenuEntry = document.getElementById('adminMenuEntry');
                const manageMerchantsBtn = document.getElementById('manageMerchantsBtn');
                if (adminMenuEntry) {
                    adminMenuEntry.style.display = 'flex';
                    console.log("✅ [DEBUG] adminMenuEntry shown");
                }
                if (manageMerchantsBtn) {
                    manageMerchantsBtn.style.display = 'flex';
                }
                
                // Full VIP Experience Restored
                if (vipCrown) vipCrown.style.display = 'block';
                if (vipAura) vipAura.style.display = 'block';
                if (vipLevel) vipLevel.style.display = 'block';

                // Pulse the actual image
                const profileImg = document.getElementById('profileUserImg');
                if (profileImg) {
                    profileImg.style.animation = 'imagePulse 2s infinite ease-in-out';
                    profileImg.style.border = 'none'; // Ensure no border on image itself
                }
                
                // Premium VIP Background & Avatar Container Styling
                if (profileHeader) {
                    profileHeader.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
                    profileHeader.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.4)';
                }
                if (avatarContainer) {
                    avatarContainer.style.padding = '0';
                    avatarContainer.style.background = 'transparent';
                    avatarContainer.style.boxShadow = 'none';
                }
                
                // Super admin should also have merchant access by default
                isMerchantUser = true;
            } else {
                console.log("ℹ️ VIP System: Regular User Identified - Hiding Effects", authEmail);
                if (adminBadge) adminBadge.style.display = 'none';
                if (adminLabel) adminLabel.style.display = 'none';
                
                // Reset Image Pulse
                const profileImg = document.getElementById('profileUserImg');
                if (profileImg) profileImg.style.animation = 'none';

                // Deactivate VIP Branding
                if (vipCrown) vipCrown.style.display = 'none';
                if (vipAura) vipAura.style.display = 'none';
                if (vipLevel) vipLevel.style.display = 'none';

                // Reset to Default Header & Avatar Styling
                if (profileHeader) {
                    profileHeader.style.background = 'linear-gradient(135deg, #FF512F, #F09819)';
                    profileHeader.style.boxShadow = '0 15px 35px rgba(255, 107, 0, 0.35)';
                }
                if (avatarContainer) {
                    avatarContainer.style.padding = '4px';
                    avatarContainer.style.background = 'white';
                    avatarContainer.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
                }
                if (manageDeliveryBtn) manageDeliveryBtn.style.display = 'none';
            }

            // --- Delivery Agent Logic ---
            if (data.role === 'delivery_partner') {
                if (deliveryDashboardBtn) deliveryDashboardBtn.style.display = 'flex';
            } else {
                if (deliveryDashboardBtn) deliveryDashboardBtn.style.display = 'none';
            }

            // Refresh icons to ensure they render in newly visible elements
            if (typeof lucide !== 'undefined') lucide.createIcons();

            // Toggle container groups based on visibility of their children
            const updateGroup = (groupId) => {
                const group = document.getElementById(groupId);
                if (group) {
                    const children = Array.from(group.children);
                    const hasVisibleChild = children.some(c => c.style.display === 'flex' || c.style.display === 'block');
                    group.style.display = hasVisibleChild ? 'block' : 'none';
                }
            };
            updateGroup('dashboardGroupContainer');
            updateGroup('adminManagementGroupContainer');
        }
    }, err => console.error("Profile Listener Error:", err));
}

// --- Delivery Agent Management ---
window.openManageDeliveryModal = () => {
    document.getElementById('manageDeliveryModal').style.display = 'flex';
    
    // Listen for current delivery partners
    db.collection('users').where('role', '==', 'delivery_partner').onSnapshot(snap => {
        const list = document.getElementById('deliveryAgentsList');
        if (!list) return;
        
        if (snap.empty) {
            list.innerHTML = '<p style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;">لا يوجد مناديب مسجلين حالياً</p>';
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const agent = doc.data();
            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #f8fafc; border-radius: 12px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${agent.photo || 'https://via.placeholder.com/40'}" style="width: 35px; height: 35px; border-radius: 50%;">
                        <div>
                            <p style="margin: 0; font-size: 0.85rem; font-weight: 800; color: #1e293b;">${agent.name || 'مجهول'}</p>
                            <p style="margin: 0; font-size: 0.7rem; color: #64748b;">${agent.email || 'بدون بريد'}</p>
                        </div>
                    </div>
                    <button onclick="revokeDeliveryAgent('${doc.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px;">
                        <i data-lucide="user-minus" style="width: 18px;"></i>
                    </button>
                </div>
            `;
        });
        list.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
};

window.addDeliveryAgent = async () => {
    const emailInput = document.getElementById('deliveryAgentEmailInput');
    const email = emailInput.value.toLowerCase().trim();
    if (!email) return;

    try {
        const snap = await db.collection('users').where('email', '==', email).get();
        if (snap.empty) {
            window.showToast("لم يتم العثور على مستخدم بهذا البريد الإلكتروني ❌");
            return;
        }

        const userId = snap.docs[0].id;
        await db.collection('users').doc(userId).update({ role: 'delivery_partner' });
        window.showToast("تمت إضافة المندوب بنجاح ✅");
        emailInput.value = '';
    } catch (err) {
        console.error("Add Agent Error:", err);
        window.showToast("فشل في إضافة المندوب ❌");
    }
};

window.revokeDeliveryAgent = async (uid) => {
    if (!confirm("هل أنت متأكد من سحب صلاحية المندوب؟")) return;
    try {
        await db.collection('users').doc(uid).update({ role: 'user' });
        window.showToast("تم سحب الصلاحية بنجاح ✅");
    } catch (err) {
        console.error("Revoke Agent Error:", err);
        window.showToast("فشل في سحب الصلاحية ❌");
    }
};

window.loadDeliveryOrders = () => {
    // Load orders that are in 'shipped' or 'confirmed' state for delivery partners to see
    db.collection('orders')
      .where('status', 'in', ['confirmed', 'shipped'])
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        const container = document.getElementById('deliveryOrdersList');
        if (!container) return;

        if (snap.empty) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #94a3b8;"><i data-lucide="package-search" style="width: 48px; height: 48px; margin-bottom: 10px; opacity: 0.3;"></i><p>لا توجد طلبات متاحة للتوصيل حالياً</p></div>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const order = doc.data();
            const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '...';
            html += `
                <div style="background: white; border-radius: 20px; padding: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div>
                            <span style="font-size: 0.7rem; color: #64748b; font-weight: 700; display: block; margin-bottom: 3px;">رقم الطلب: #${doc.id.slice(-6).toUpperCase()}</span>
                            <span style="font-size: 0.95rem; font-weight: 1000; color: #0f172a;">${order.customerName || 'عميل'}</span>
                        </div>
                        <span style="background: #ecfdf5; color: #065f46; padding: 4px 10px; border-radius: 8px; font-size: 0.65rem; font-weight: 800;">${order.status === 'confirmed' ? 'جاهز للشحن' : 'قيد التوصيل'}</span>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 8px; color: #475569; font-size: 0.8rem;">
                            <i data-lucide="map-pin" style="width: 14px;"></i>
                            <span style="font-weight: 700;">${order.shippingAddress || 'لا يوجد عنوان'}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; color: #475569; font-size: 0.8rem;">
                            <i data-lucide="phone" style="width: 14px;"></i>
                            <span style="font-weight: 700;">${order.customerPhone || 'لا يوجد هاتف'}</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px dashed #e2e8f0;">
                        <span style="font-weight: 1000; color: #0f172a; font-size: 1rem;">${order.totalAmount || 0} ج.م</span>
                        <a href="https://wa.me/${order.customerPhone}" target="_blank" style="background: #10b981; color: white; padding: 8px 15px; border-radius: 10px; text-decoration: none; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="message-circle" style="width: 14px;"></i> تواصل
                        </a>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
};

window.saveProfileName = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const nameEl = document.getElementById('profileNameInput');
    if (!nameEl) return;
    const newName = nameEl.value.trim();
    if (!newName) {
        window.showToast("يرجى إدخال اسم صحيح ⚠️");
        return;
    }
    try {
        await db.collection('users').doc(user.uid).update({ 
            name: newName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("🎉 تم تحديث اسمك بنجاح!");
        // Update DOM displays immediately
        if (document.getElementById('profileUserName')) {
            document.getElementById('profileUserName').textContent = newName;
        }
        // Also close the modal after short delay
        setTimeout(() => {
            const settingsModal = document.getElementById('settingsModal');
            if (settingsModal) settingsModal.style.display = 'none';
        }, 1000);
    } catch (err) {
        console.error("Save Name Error:", err);
        window.showToast("حدث خطأ أثناء حفظ الاسم ⚠️");
    }
};

window.updateProfileData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const phone = document.getElementById('profilePhone').value.trim();
    const address = document.getElementById('profileAddress').value.trim();
    const latlng = document.getElementById('profileLatlng').value.trim();

    if (!phone) {
        window.showToast("يرجى إدخال رقم الهاتف للتواصل 📞");
        return;
    }

    try {
        await db.collection('users').doc(user.uid).update({
            phone: phone,
            address: address,
            latlng: latlng,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast("تم تحديث بياناتك بنجاح! ✨");
    } catch (err) {
        console.error("Update Profile Error:", err);
        window.showToast("حدث خطأ أثناء التحديث، حاول مرة أخرى.");
    }
};

// Loyalty UI Helper
function updateLoyaltyUI(points) {
    const levelName = document.getElementById('loyaltyLevelName');
    const pointsVal = document.getElementById('loyaltyPointsValue');
    const progressBar = document.getElementById('loyaltyProgressBar');
    const nextLevelDesc = document.getElementById('loyaltyNextLevelDesc');

    const conf = window.loyaltyConfig;
    const threshold = conf.redeemThreshold || 200;

    if (!levelName) return;

    if (pointsVal) pointsVal.textContent = `${points.toLocaleString()}`;
    
    // Dynamic points progress logic
    const progress = Math.min((points / threshold) * 100, 100);
    if (progressBar) progressBar.style.width = `${progress}%`;

    if (points >= threshold) {
        if (nextLevelDesc) nextLevelDesc.textContent = conf.successMessage || "🎁 مبروك! الشريط ممتلئ، استبدل الآن";
        levelName.innerHTML = `<i data-lucide="gift" style="width: 14px; color: #10b981;"></i> ${conf.levelReady || 'مكافأة جاهزة'}`;
    } else {
        const rem = threshold - points;
        if (nextLevelDesc) nextLevelDesc.textContent = `متبقي ${rem} نقطة لملء الشريط`;
        levelName.innerHTML = `<i data-lucide="star" style="width: 14px; color: #eab308;"></i> ${conf.levelCollecting || 'جمع النقاط'}`;
    }

    const redeemBtn = document.getElementById('redeemPointsBtn');
    if (redeemBtn) {
        if (points >= threshold) {
            redeemBtn.style.display = 'inline-flex';
        } else {
            redeemBtn.style.display = 'none';
        }
    }
    
    if (window.lucide) lucide.createIcons();
}

// Redeem Loyalty Points to Wallet (100 Points = 1 EGP)
window.redeemLoyaltyPoints = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const redeemBtn = document.getElementById('redeemPointsBtn');
    if (redeemBtn) {
        redeemBtn.disabled = true;
        redeemBtn.innerHTML = 'جاري الاستبدال...';
    }

    try {
        const userRef = db.collection('users').doc(user.uid);
        
        await db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) throw new Error("المستخدم غير موجود");
            
            const userData = userSnap.data();
            const points = userData.points || 0;
            
            const confSnap = await transaction.get(db.collection('settings').doc('loyaltyConfig'));
            let conf = { redeemThreshold: 200, redeemValue: 10 };
            if (confSnap.exists) {
                conf = { ...conf, ...confSnap.data() };
            }
            
            const threshold = conf.redeemThreshold || 200;
            const giftValue = conf.redeemValue || 10;
            
            if (points < threshold) {
                throw new Error(`يجب أن تصل للحد الأدنى (${threshold} نقطة) لتفعيل الاستبدال!`);
            }
            
            // Dynamic redemption calculation
            const redeemablePoints = Math.floor(points / threshold) * threshold;
            const egpEarned = (redeemablePoints / threshold) * giftValue;
            const newPoints = points - redeemablePoints;
            const newWallet = (userData.walletBalance || 0) + egpEarned;
            
            transaction.update(userRef, {
                points: newPoints,
                walletBalance: newWallet
            });
            
            const transRef = db.collection('walletTransactions').doc();
            transaction.set(transRef, {
                userId: user.uid,
                amount: egpEarned,
                type: 'recharge',
                description: `استبدال ${redeemablePoints.toLocaleString()} نقطة ولاء برصيد محفظة`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            setTimeout(() => {
                alert(`🎉 مبروك! تم استبدال ${redeemablePoints.toLocaleString()} نقطة بـ ${egpEarned} ج.م في محفظتك بنجاح!`);
            }, 100);
        });
    } catch (err) {
        alert("فشل الاستبدال: " + err.message);
    } finally {
        if (redeemBtn) {
            redeemBtn.disabled = false;
            redeemBtn.innerHTML = '<i data-lucide="refresh-cw" style="width: 8px;"></i> استبدال النقاط';
            if (window.lucide) lucide.createIcons();
        }
    }
};

// Notification Settings
window.saveNotificationSettings = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const orders = document.getElementById('notifOrders').checked;
    const offers = document.getElementById('notifOffers').checked;

    try {
        await db.collection('users').doc(user.uid).update({
            notificationSettings: { orders, offers }
        });
        window.showToast("تم حفظ تفضيلات الإشعارات ✅");
    } catch (e) { console.error(e); }
};

// Referral Logic
window.copyReferralCode = () => {
    const code = document.getElementById('referralCodeDisplay').textContent;
    const refLink = `${window.location.origin}${window.location.pathname}?ref=${code}`;
    
    navigator.clipboard.writeText(refLink).then(() => {
        window.showToast("تم نسخ رابط الدعوة! أرسله لأصدقائك 🎁");
    });
};

// Wallet History
window.openWalletHistory = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const modal = document.getElementById('walletHistoryModal');
    const list = document.getElementById('walletTransactionsList');
    const empty = document.getElementById('emptyWalletHistory');

    modal.style.display = 'flex';
    list.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; padding:20px;">
            ${[1,2,3].map(() => `<div class="skeleton" style="height:70px; border-radius:20px;"></div>`).join('')}
        </div>
    `;
    empty.style.display = 'none';

    try {
        // Try with orderBy first
        let query = db.collection('walletTransactions').where('userId', '==', user.uid);
        let snap;
        let isOrdered = true;
        try {
            snap = await query.orderBy('createdAt', 'desc').limit(50).get();
        } catch (e) {
            console.warn("Firestore OrderBy failed, falling back to client-side sort.");
            snap = await query.limit(100).get();
            isOrdered = false;
        }

        if (snap.empty) {
            list.innerHTML = '';
            empty.style.display = 'block';
            document.getElementById('historyTotalRecharge').textContent = '0 ج.م';
            document.getElementById('historyTotalSpent').textContent = '0 ج.م';
            return;
        }

        let transactions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort in memory if we didn't use orderBy
        if (!isOrdered) {
            transactions.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        }

        // Calculate Stats
        let totalRecharged = 0;
        let totalSpent = 0;
        transactions.forEach(t => {
            if (t.amount > 0) totalRecharged += t.amount;
            else totalSpent += Math.abs(t.amount);
        });

        document.getElementById('historyTotalRecharge').textContent = `${totalRecharged.toLocaleString()} ج.م`;
        document.getElementById('historyTotalSpent').textContent = `${totalSpent.toLocaleString()} ج.م`;

        let html = '';
        let lastDate = '';

        transactions.forEach(t => {
            const dateObj = t.createdAt ? new Date(t.createdAt.seconds * 1000) : new Date();
            const dateStr = dateObj.toLocaleDateString('ar-EG', { day:'numeric', month:'long', year:'numeric' });
            const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' });

            if (dateStr !== lastDate) {
                html += `<div style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; margin: 15px 0 8px; display: flex; align-items: center; gap: 10px;">
                    <span style="flex-shrink: 0;">${dateStr}</span>
                    <div style="flex: 1; height: 1px; background: #f1f5f9;"></div>
                </div>`;
                lastDate = dateStr;
            }

            const isPlus = t.amount > 0;
            const typeInfo = {
                'recharge': { icon: 'arrow-down-left', label: 'إيداع رصيد', color: '#10b981' },
                'purchase': { icon: 'shopping-bag', label: 'عملية شراء', color: '#475569' },
                'referral': { icon: 'gift', label: 'مكافأة إحالة', color: '#f59e0b' },
                'deduction': { icon: 'arrow-up-right', label: 'سحب إداري', color: '#ef4444' }
            };
            const info = typeInfo[t.type] || { icon: 'activity', label: 'معاملة', color: '#64748b' };
            const shortId = t.id ? t.id.substring(0, 8).toUpperCase() : '---';

            html += `
                <div style="background: white; border: 1.5px solid #f8fafc; border-radius: 24px; padding: 18px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 15px rgba(0,0,0,0.02); position: relative; transition: all 0.3s ease;">
                    <div style="display: flex; align-items: center; gap: 18px;">
                        <div style="width: 50px; height: 50px; border-radius: 16px; background: ${isPlus ? '#f0fdf4' : '#f8fafc'}; color: ${isPlus ? '#10b981' : '#475569'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid ${isPlus ? '#dcfce7' : '#e2e8f0'};">
                            <i data-lucide="${info.icon}" style="width: 22px;"></i>
                        </div>
                        <div>
                            <span style="display: block; font-weight: 900; font-size: 0.9rem; color: #0f172a; margin-bottom: 2px;">${t.description || info.label}</span>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 0.65rem; color: #94a3b8; font-weight: 700;">${timeStr}</span>
                                <span style="font-size: 0.6rem; color: #cbd5e1; font-weight: 800; font-family: monospace; background: #f8fafc; padding: 2px 6px; border-radius: 4px;">#${shortId}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align: left;">
                        <span style="display: block; font-weight: 950; font-size: 1.1rem; color: ${isPlus ? '#10b981' : '#0f172a'};">
                            ${isPlus ? '+' : '-'}${Math.abs(t.amount).toLocaleString()} <small style="font-size: 0.65rem; font-weight: 800;">ج.م</small>
                        </span>
                        <span style="font-size: 0.55rem; color: ${isPlus ? '#10b981' : '#94a3b8'}; font-weight: 900; text-transform: uppercase;">${info.label}</span>
                    </div>
                </div>
            `;
        });
        
        list.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Wallet History Error Details:", e);
        let errorMsg = "عذراً، فشل تحميل البيانات";
        if (e.code === 'permission-denied') {
            errorMsg = "خطأ في صلاحيات الوصول (Security Rules)";
        }
        
        list.innerHTML = `
            <div style="text-align:center; padding:40px 20px;">
                <i data-lucide="alert-circle" style="width:40px; color:#ef4444; margin-bottom:15px;"></i>
                <p style="color:#ef4444; font-weight:800; font-size:0.9rem;">${errorMsg}</p>
                <p style="color:#94a3b8; font-size:0.75rem; margin-top:5px;">${e.message || "تأكد من إعدادات Firebase وحاول مجدداً"}</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }
};

window.logout = () => {
    if (confirm("هل أنت متأكد من تسجيل الخروج؟")) {
        auth.signOut().then(() => {
            window.location.reload();
        });
    }
};

// --- Wallet Recharge Functions ---
let storeSettings = { rechargeNumber: '01035528656' };

async function loadStoreSettings() {
    try {
        const doc = await db.collection('settings').doc('store').get();
        if(doc.exists) {
            storeSettings = doc.data();
            const displayEl = document.getElementById('displayRechargeNumber');
            if(displayEl) displayEl.textContent = storeSettings.rechargeNumber;
        }
    } catch(e) { console.error("Error loading settings:", e); }
}
loadStoreSettings();
loadDeliveryConfig();

window.copyRechargeNumber = () => {
    const num = storeSettings.rechargeNumber || '01035528656';
    navigator.clipboard.writeText(num).then(() => {
        alert("✅ تم نسخ الرقم بنجاح");
    });
};

window.openRechargeModal = () => {
    if (!auth.currentUser) {
        openLogin();
        return;
    }
    const userEmail = (auth.currentUser.email || '').toLowerCase().trim();
    if (userEmail === 'engyhamid860@gmail.com') {
        // For super admin: show direct self-recharge modal
        document.getElementById('superAdminRechargeModal').style.display = 'flex';
    } else {
        document.getElementById('rechargeModal').style.display = 'flex';
    }
};

// --- Super Admin Direct Self-Recharge ---
window.superAdminSelfRecharge = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || user.email.toLowerCase().trim() !== 'engyhamid860@gmail.com') {
        window.showToast('⛔ غير مصرح بهذه العملية');
        return;
    }
    const amountEl = document.getElementById('superAdminRechargeAmount');
    const amount = Number(amountEl?.value || 0);
    if (!amount || amount <= 0) {
        window.showToast('يرجى إدخال مبلغ صحيح');
        return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الشحن...'; }
    try {
        const userRef = db.collection('users').doc(user.uid);
        await db.runTransaction(async (t) => {
            const snap = await t.get(userRef);
            const current = snap.data()?.walletBalance || 0;
            t.update(userRef, { walletBalance: current + amount });
        });
        await logWalletTransaction(user.uid, amount, 'recharge', `شحن مباشر بواسطة المدير العام: ${amount} ج.م`);
        window.showToast(`✅ تم إضافة ${amount.toLocaleString()} ج.م للمحفظة بنجاح!`);
        document.getElementById('superAdminRechargeModal').style.display = 'none';
        if (amountEl) amountEl.value = '';
    } catch (err) {
        console.error('Self-Recharge Error:', err);
        window.showToast('❌ فشلت عملية الشحن: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'شحن الرصيد فوراً'; }
    }
};

window.requestRecharge = async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('rechargeAmount').value);
    const senderNumber = document.getElementById('senderNumber').value;
    const user = auth.currentUser;

    if (amount < 10) {
        alert("أقل مبلغ للشحن هو 10 ج.م");
        return;
    }
    if (!senderNumber || senderNumber.length < 10) {
        alert("يرجى إدخال رقم الهاتف الذي قمت بالتحويل منه");
        return;
    }

    try {
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'جاري إرسال الطلب...';

        await db.collection('rechargeRequests').add({
            userId: user.uid,
            userName: (window.currentUserData && window.currentUserData.name) || user.displayName || 'عميل مسعودي',
            userPhone: (window.currentUserData && window.currentUserData.phone) || (await db.collection('users').doc(user.uid).get()).data()?.phone || '---',
            senderPhone: senderNumber,
            amount: amount,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("✅ تم إرسال طلب الشحن بنجاح! سيتم مراجعة الطلب وإضافة الرصيد لمحفظتك خلال دقائق.");
        document.getElementById('rechargeModal').style.display = 'none';
        document.getElementById('rechargeAmount').value = '';
    } catch (err) {
        alert("فشل إرسال الطلب: " + err.message);
    } finally {
        const btn = e.target.querySelector('button');
        btn.disabled = false;
        btn.textContent = 'تأكيد إرسال طلب الشحن';
    }
};


// --- Merchant Features ---
async function renderMerchantProducts() {
    const user = auth.currentUser;
    if (!user) return;
    
    const grid = document.getElementById('merchantProductsGrid');
    const totalCountEl = document.getElementById('merchantTotalProducts');
    if (!grid) return;
    
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;"><div class="skeleton" style="height:150px; width:100%; border-radius:30px;"></div></div>';
    
    try {
        const snap = await db.collection('products')
            .where('merchantId', '==', user.uid)
            .get();
            
        const merchantProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (totalCountEl) totalCountEl.textContent = merchantProducts.length;
        
        if (merchantProducts.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 30px;">
                    <div style="width: 60px; height: 60px; background: #fff; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.03);">
                        <i data-lucide="package-search" style="width: 30px; color: #94a3b8;"></i>
                    </div>
                    <p style="color: #94a3b8; font-size: 0.85rem; font-weight: 800; margin: 0;">لم تقم بإضافة أي منتجات حتى الآن.</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        grid.innerHTML = '';
        merchantProducts.forEach(p => {
            const card = document.createElement('div');
            card.style.cssText = 'background: white; border-radius: 32px; padding: 18px; border: 1.5px solid #f1f5f9; position: relative; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); min-height: 220px; display: flex; flex-direction: column; box-shadow: 0 10px 20px rgba(0,0,0,0.02);';
            card.className = 'merchant-mgmt-card fade-in';
            card.onmouseover = () => card.style.borderColor = 'var(--primary)';
            card.onmouseout = () => card.style.borderColor = '#f1f5f9';
            
            card.innerHTML = `
                <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                    <div style="position: relative;">
                        <img src="${p.image || 'https://via.placeholder.com/80'}" style="width: 80px; height: 80px; border-radius: 22px; object-fit: cover; background: #f8fafc; border: 1px solid #f1f5f9;">
                        <div style="position: absolute; top: -5px; right: -5px; padding: 4px 8px; background: white; border-radius: 10px; font-size: 0.6rem; font-weight: 1000; box-shadow: 0 4px 10px rgba(0,0,0,0.05); color: #64748b; border: 1px solid #f1f5f9;">
                            ID: ${p.id.slice(-4).toUpperCase()}
                        </div>
                    </div>
                    <div style="overflow: hidden; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <h4 style="margin: 0; font-size: 1rem; font-weight: 1000; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Cairo', sans-serif;">${p.name}</h4>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                            <span style="font-size: 1rem; font-weight: 1000; color: var(--primary);">${p.price} <span style="font-size: 0.7rem;">ج.م</span></span>
                        </div>
                        <div style="margin-top: 8px; display: flex; gap: 5px;">
                            <span style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; background: #f8fafc; padding: 3px 10px; border-radius: 50px; border: 1px solid #f1f5f9;">
                                ${(() => {
                                    const translation = {
                                        'electronics': 'إلكترونيات', 'fashion': 'أزياء وملابس', 'home': 'منزل وديكور',
                                        'offers': 'عروض جملة', 'restaurant': 'مطاعم ومأكولات', 'bakery': 'حلويات ومخبوزات',
                                        'supermarket': 'سوبر ماركت', 'veggies': 'خضروات وفواكه', 'meat': 'لحوم ودواجن',
                                        'dairy': 'ألبان وأجبان', 'perfumes': 'عطور وتجميل', 'kitchen': 'مطبخ وأدوات',
                                        'health': 'صحة وعناية', 'toys': 'ألعاب وأطفال', 'sports': 'أدوات رياضية',
                                        'books': 'كتب ومكتبة', 'gifts': 'هدايا وزهور', 'cleaning': 'منظفات',
                                        'pets': 'حيوانات أليفة', 'other': 'منتجات عامة'
                                    };
                                    return (window.allCategories && window.allCategories[p.category]) ? window.allCategories[p.category].name : (translation[p.category] || p.category || 'عام');
                                })()}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: auto;">
                    <button onclick="editMerchantProduct('${p.id}')" style="flex: 2; background: #f8fafc; color: #475569; border: 1.5px solid #e2e8f0; padding: 12px; border-radius: 15px; font-size: 0.8rem; font-weight: 1000; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; font-family: 'Cairo', sans-serif;">
                        <i data-lucide="edit-3" style="width: 16px;"></i>
                        تعديل
                    </button>
                    <button onclick="deleteMerchantProduct('${p.id}')" style="flex: 1; background: #fff1f2; color: #e11d48; border: 1.5px solid #ffe4e6; padding: 12px; border-radius: 15px; font-size: 0.8rem; font-weight: 1000; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.2s;">
                        <i data-lucide="trash-2" style="width: 16px;"></i>
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
        
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        console.error("Merchant Render Error:", err);
        grid.innerHTML = '<p style="text-align:center; padding:20px; color:red;">خطأ أثناء تحميل المنتجات.</p>';
    }
}

window.deleteMerchantProduct = async (id) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج نهائياً؟")) return;
    try {
        await db.collection('products').doc(id).delete();
        showToast("✅ تم حذف المنتج بنجاح", "success");
        renderMerchantProducts();
    } catch (e) {
        alert("خطأ في الحذف: " + e.message);
    }
};

window.editingProductId = null;

window.editMerchantProduct = async (id) => {
    console.log("Edit product:", id);
    try {
        const doc = await db.collection('products').doc(id).get();
        if (!doc.exists) return showToast("⚠️ المنتج غير موجود", "error");
        
        await populateMerchantCategoryDropdown();
        
        const p = doc.data();
        window.editingProductId = id;
        
        // Fill the modal
        document.getElementById('mProdName').value = p.name || '';
        document.getElementById('mProdPrice').value = p.price || '';
        // Mapping legacy Arabic values to English IDs if needed
        const categoryMap = {
            'عروض جملة': 'offers', 'إلكترونيات': 'electronics', 'أزياء': 'fashion', 'أزياء وملابس': 'fashion',
            'منزل': 'home', 'منزل وديكور': 'home', 'عام': 'other', 'منتجات عامة': 'other',
            'مطاعم ومأكولات': 'restaurant', 'حلويات ومخبوزات': 'bakery', 'سوبر ماركت': 'supermarket',
            'خضروات وفواكه': 'veggies', 'لحوم ودواجن': 'meat', 'ألبان وأجبان': 'dairy',
            'عطور وتجميل': 'perfumes', 'مطبخ وأدوات': 'kitchen', 'صحة وعناية': 'health',
            'ألعاب وأطفال': 'toys', 'أدوات رياضية': 'sports', 'كتب ومكتبة': 'books',
            'هدايا وزهور': 'gifts', 'منظفات': 'cleaning', 'حيوانات أليفة': 'pets'
        };
        let catValue = p.category || 'offers';
        if (categoryMap[catValue]) catValue = categoryMap[catValue];
        
        document.getElementById('mProdCategory').value = catValue;
        document.getElementById('mProdDesc').value = p.description || '';
        
        // Show preview if exists
        const preview = document.getElementById('mProdPreview');
        if (p.image) {
            preview.src = p.image;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
        
        // Change Modal title and button
        const modalTitle = document.querySelector('#merchantAddProductModal h3');
        if (modalTitle) modalTitle.textContent = 'تعديل المنتج';
        
        const submitBtn = document.getElementById('mProdSubmitBtn');
        if (submitBtn) submitBtn.textContent = 'حفظ التغييرات';
        
        document.getElementById('merchantAddProductModal').style.display = 'flex';
        
    } catch(err) {
        console.error("Edit fetch error:", err);
        showToast("❌ خطأ في جلب بيانات المنتج", "error");
    }
};

window.addToCartMerchant = (id) => {
    const product = products.find(p => p.id === id);
    if(!product) return;
    
    if (!auth.currentUser) {
        document.getElementById('loginModal').style.display = 'flex';
        return;
    }

    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        // Use merchantPrice for the cart item
        cart.push({ ...product, price: parseFloat(product.merchantPrice), quantity: 1 });
    }
    
    updateCartUI();
    window.showToast("تمت إضافة عرض التاجر للسلة ✅");
};

// Upload Custom Profile Photo to Firebase Storage (with Base64 Fallback)
window.uploadProfilePhoto = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return;

    // Custom loader toast
    const loader = document.createElement('div');
    loader.style.cssText = "position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); background: #1e293b; color: white; padding: 14px 24px; border-radius: 50px; font-weight: 800; font-size: 0.8rem; z-index: 100000; box-shadow: 0 10px 25px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 10px; direction: rtl;";
    loader.innerHTML = '<span class="spin-animation" style="display:inline-block; width:12px; height:12px; border:2.5px solid #fff; border-top-color:transparent; border-radius:50%; animation: spin 1s linear infinite;"></span> جاري رفع صورتك الشخصية...';
    document.body.appendChild(loader);

    // Dynamic spin style
    if (!document.getElementById('profile-spin-style')) {
        const style = document.createElement('style');
        style.id = 'profile-spin-style';
        style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }

    try {
        let photoUrl = '';
        
        // Use our robust uploadFile which now handles Base64 fallback automatically
        photoUrl = await uploadFile(file, `profile_pictures/${user.uid}`);

        // Update Auth
        await user.updateProfile({ photoURL: photoUrl });

        // Update Firestore
        await db.collection('users').doc(user.uid).update({
            photo: photoUrl,
            photoURL: photoUrl,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update local DOM immediately
        const img = document.getElementById('profileUserImg');
        if (img) img.src = photoUrl;

        loader.style.background = "#10b981";
        loader.innerHTML = '🎉 تم تحديث صورتك الشخصية بنجاح!';
        setTimeout(() => loader.remove(), 2500);
    } catch (err) {
        console.error("Profile upload error:", err);
        loader.style.background = "#ef4444";
        loader.innerHTML = '❌ فشل الرفع: ' + err.message;
        setTimeout(() => loader.remove(), 3500);
    }
};

// central atomic loyalty points award helper on receipt/completion
window.awardPointsIfCompleted = async (orderId) => {
    try {
        const orderRef = db.collection('orders').doc(orderId);
        await db.runTransaction(async (transaction) => {
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists) return;
            const orderData = orderSnap.data();
            
            // Prevent double-crediting
            if (orderData.pointsAwarded) return;
            
            // Only reward if status is completed or archived_received
            if (orderData.status !== 'completed' && orderData.status !== 'archived_received') return;
            
            if (orderData.userId) {
                const userRef = db.collection('users').doc(orderData.userId);
                const userSnap = await transaction.get(userRef);
                if (userSnap.exists) {
                    const currentPoints = userSnap.data().points || 0;
                    
                    const conf = window.loyaltyConfig || { earnAmount: 1000, earnPoints: 200 };
                    const earnAmount = conf.earnAmount || 1000;
                    const earnPoints = conf.earnPoints || 200;

                    let multiplier = 1.0;
                    if (currentPoints >= 5000) multiplier = 2.0;
                    else if (currentPoints >= 500) multiplier = 1.5;

                    const earnedPoints = Math.floor(((orderData.total || 0) / earnAmount * earnPoints) * multiplier);
                    transaction.update(userRef, { points: currentPoints + earnedPoints });
                    transaction.update(orderRef, { pointsAwarded: true });
                    console.log(`Successfully credited ${earnedPoints} points to user: ${orderData.userId}`);

                    // --- Fix: Handle Referral Reward for Referrer ---
                    if (orderData.pendingReferralReward && !orderData.referralRewarded) {
                        const { referrerId, amount } = orderData.pendingReferralReward;
                        const referrerRef = db.collection('users').doc(referrerId);
                        const referrerSnap = await transaction.get(referrerRef);
                        
                        if (referrerSnap.exists) {
                            const referrerPoints = referrerSnap.data().points || 0;
                            const rewardAmount = amount || 200; // Default reward if missing
                            transaction.update(referrerRef, { 
                                points: referrerPoints + rewardAmount 
                            });
                            transaction.update(orderRef, { referralRewarded: true });
                            console.log(`Successfully credited ${rewardAmount} referral points to referrer: ${referrerId}`);
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error("Failed to award points safely:", e);
    }
};

// --- Real Product Ratings & Customer Reviews System ---
window.selectedReviewRating = 5; // Default rating score

window.setFormStarRating = (rating) => {
    window.selectedReviewRating = rating;
    document.querySelectorAll('#interactiveStarsContainer .review-star-btn').forEach(star => {
        const starVal = parseInt(star.getAttribute('data-star'));
        if (starVal <= rating) {
            star.style.color = '#F59E0B';
            star.style.fill = '#F59E0B';
        } else {
            star.style.color = '#CBD5E1';
            star.style.fill = 'none';
        }
    });
};

window.loadProductReviews = async (productId) => {
    const listContainer = document.getElementById('reviewsListContainer');
    const formContainer = document.getElementById('addReviewFormContainer');
    const summaryText = document.getElementById('reviewsSummaryText');
    const topStarsContainer = document.getElementById('topProductStarsDisplay');
    const topCountContainer = document.getElementById('topProductCountDisplay');
    
    if (!listContainer) return;
    
    try {
        // Fetch reviews for this product from Firestore
        const snap = await db.collection('reviews')
            .where('productId', '==', productId)
            .get();
        
        const reviews = [];
        snap.forEach(doc => {
            reviews.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort locally by creation date descending to avoid requiring composite index
        reviews.sort((a, b) => {
            const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0) : 0;
            const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0) : 0;
            return timeB - timeA;
        });
        
        const totalReviews = reviews.length;
        let avgRating = 5;
        if (totalReviews > 0) {
            const totalStars = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
            avgRating = parseFloat((totalStars / totalReviews).toFixed(1));
        }
        
        if (summaryText) {
            summaryText.textContent = `${totalReviews} تقييم (${avgRating} من 5)`;
        }
        
        if (topStarsContainer) {
            topStarsContainer.innerHTML = '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating));
        }
        if (topCountContainer) {
            topCountContainer.textContent = `(${avgRating} تقييم العملاء)`;
        }
        
        // Render reviews list
        if (totalReviews === 0) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding:35px 20px; background:#f8fafc; border-radius:18px; border:1px solid #e2e8f0; width:100%;">
                    <i data-lucide="message-square" style="width:36px; height:36px; color:#cbd5e1; margin-bottom:10px;"></i>
                    <p style="color:#64748B; font-size:0.85rem; margin:0; font-weight:700;">لا توجد تقييمات حقيقية لهذا المنتج بعد.</p>
                    <p style="color:#94a3b8; font-size:0.75rem; margin:5px 0 0 0;">كن أول من يشتري المنتج ويشارك رأيه وتقييمه الصادق!</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        } else {
            listContainer.innerHTML = reviews.map(r => {
                const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
                const dateStr = r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'الآن') : 'الآن';
                return `
                    <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:18px; padding:18px; display:flex; gap:12px; align-items:flex-start; transition:all 0.2s;">
                        <img src="${r.userPhoto || 'https://ui-avatars.com/api/?name=U'}" style="width:42px; height:42px; border-radius:12px; object-fit:cover; border:1.5px solid #cbd5e1; flex-shrink:0;">
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:5px;">
                                <strong style="font-size:0.9rem; color:#1e293b; font-weight:800;">${r.userName}</strong>
                                <span style="font-size:0.7rem; color:#94a3b8; font-weight:700;">${dateStr}</span>
                            </div>
                            <div style="color:#F59E0B; font-size:0.8rem; margin-bottom:8px; letter-spacing:1px;">${stars}</div>
                            <p style="color:#475569; font-size:0.85rem; margin:0; line-height:1.6; word-break:break-word;">${r.comment}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Render form container
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
            formContainer.innerHTML = `
                <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; font-weight: 900; color: #1E293B;">أضف تقييمك ورأيك الحقيقي ✍️</h4>
                <form onsubmit="submitProductReview('${productId}', event)" style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="font-size: 0.72rem; font-weight: 800; color: #64748b; display: block; margin-bottom: 4px;">تقييمك بالنجوم:</label>
                        <div style="display: flex; gap: 6px;" id="interactiveStarsContainer">
                            <i data-lucide="star" class="review-star-btn" data-star="1" onclick="setFormStarRating(1)" style="cursor: pointer; color: #F59E0B; fill: #F59E0B; transition: all 0.2s; width:22px; height:22px;"></i>
                            <i data-lucide="star" class="review-star-btn" data-star="2" onclick="setFormStarRating(2)" style="cursor: pointer; color: #F59E0B; fill: #F59E0B; transition: all 0.2s; width:22px; height:22px;"></i>
                            <i data-lucide="star" class="review-star-btn" data-star="3" onclick="setFormStarRating(3)" style="cursor: pointer; color: #F59E0B; fill: #F59E0B; transition: all 0.2s; width:22px; height:22px;"></i>
                            <i data-lucide="star" class="review-star-btn" data-star="4" onclick="setFormStarRating(4)" style="cursor: pointer; color: #F59E0B; fill: #F59E0B; transition: all 0.2s; width:22px; height:22px;"></i>
                            <i data-lucide="star" class="review-star-btn" data-star="5" onclick="setFormStarRating(5)" style="cursor: pointer; color: #F59E0B; fill: #F59E0B; transition: all 0.2s; width:22px; height:22px;"></i>
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 0.72rem; font-weight: 800; color: #64748b; display: block; margin-bottom: 4px;">رأيك أو تعليقك عن المنتج:</label>
                        <textarea id="reviewComment" rows="3" placeholder="اكتب رأيك هنا بكل صراحة وأمانة ليفيد باقي العملاء..." required style="width:100%; padding:10px; border-radius:10px; border:1.5px solid #cbd5e1; outline:none; font-family:'Cairo',sans-serif; font-size:0.8rem; line-height:1.5; resize:none;"></textarea>
                    </div>
                    <button type="submit" class="btn-primary" style="padding:12px; border-radius:12px; font-size:0.8rem; font-weight:800; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow: 0 4px 12px rgba(255, 107, 0, 0.2);">
                        <i data-lucide="send" style="width:14px;"></i> إرسال التقييم
                    </button>
                </form>
            `;
            window.selectedReviewRating = 5; // Reset star count selection
            if (window.lucide) lucide.createIcons();
        } else {
            formContainer.innerHTML = `
                <div style="text-align:center; padding:10px 5px;">
                    <i data-lucide="lock" style="width:28px; height:28px; color:#ef4444; margin-bottom:8px;"></i>
                    <h5 style="margin:0 0 5px 0; font-weight:800; font-size:0.85rem; color:#1e293b;">تقييم المنتج مغلق 🔐</h5>
                    <p style="color:#64748B; font-size:0.72rem; margin-bottom:12px; line-height:1.5;">يرجى تسجيل الدخول أولاً لتتمكن من تقييم المنتج ومشاركة رأيك الحقيقي.</p>
                    <button onclick="document.getElementById('loginModal').style.display='flex'" class="btn-primary" style="padding:10px; border-radius:12px; font-size:0.78rem; font-weight:800; width:100%;">
                        تسجيل الدخول الآن 🔑
                    </button>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    } catch (err) {
        console.error("Error loading reviews:", err);
        if (listContainer) {
            listContainer.innerHTML = `<p style="color:#ef4444; font-size:0.8rem;">خطأ في تحميل التقييمات: ${err.message}</p>`;
        }
    }
};

window.submitProductReview = async (productId, event) => {
    event.preventDefault();
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return alert("يجب تسجيل الدخول أولاً");
    
    const comment = document.getElementById('reviewComment').value.trim();
    if (!comment) return alert("يرجى كتابة تعليقك أولاً");
    
    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'جاري إرسال تقييمك...';
    
    try {
        const rating = window.selectedReviewRating || 5;
        
        // 1. Add review doc
        await db.collection('reviews').add({
            productId: productId,
            userId: currentUser.uid,
            userName: (window.currentUserData && window.currentUserData.name) || currentUser.displayName || 'عميل مسعودي',
            userPhoto: (window.currentUserData && (window.currentUserData.photo || window.currentUserData.photoURL)) || currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName || 'U'}&background=FF6B00&color=fff`,
            rating: rating,
            comment: comment,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 2. Fetch all reviews for this product to recalculate average
        const allReviewsSnap = await db.collection('reviews').where('productId', '==', productId).get();
        let totalStars = 0;
        allReviewsSnap.forEach(doc => {
            totalStars += doc.data().rating || 5;
        });
        const newAvg = parseFloat((totalStars / allReviewsSnap.size).toFixed(1));
        
        // 3. Update average rating in products collection
        await db.collection('products').doc(productId).update({
            rating: newAvg,
            ratingCount: allReviewsSnap.size
        });
        
        // 4. Update the local variable `products` rating if it exists
        if (typeof products !== 'undefined') {
            const localProduct = products.find(p => p.id === productId);
            if (localProduct) {
                localProduct.rating = newAvg;
                localProduct.ratingCount = allReviewsSnap.size;
            }
        }
        
        if (window.showToast) {
            window.showToast("✅ تم إرسال تقييمك بنجاح! شكراً لك.");
        } else {
            alert("✅ تم إرسال تقييمك بنجاح! شكراً لك.");
        }
        
        // 5. Reload reviews list
        loadProductReviews(productId);
        
        // 6. Refresh products rendering on main page
        if (typeof products !== 'undefined' && typeof renderProducts === 'function') {
            renderProducts(products);
        }
    } catch (err) {
        console.error("Error submitting review:", err);
        alert("حدث خطأ أثناء إرسال التقييم: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// --- Dynamic Modern Offer Cards ---
window.offers = [];

async function loadOffers() {
    try {
        const snapshot = await db.collection('offers').orderBy('createdAt', 'desc').get();
        window.offers = [];
        snapshot.forEach(doc => {
            window.offers.push({ id: doc.id, ...doc.data() });
        });
        renderOffers();
    } catch (e) {
        console.error("Error loading offers: ", e);
    }
}

function renderOffers() {
    const container = document.getElementById('offersCardsContainer');
    if (!container) return;
    
    if (window.offers.length === 0) {
        container.style.display = 'none';
    } else {
        container.style.display = 'flex';
    }
    container.innerHTML = '';
    
    window.offers.forEach(offer => {
        const themeClass = offer.theme ? `offer-theme-${offer.theme}` : 'offer-theme-primary';
        const iconName = offer.icon || 'percent';
        
        let customStyle = '';
        if (offer.image) {
            customStyle = `background-image: linear-gradient(to left, rgba(0,0,0,0.4), rgba(0,0,0,0.75)), url('${offer.image}'); background-size: cover; background-position: center; border: none; box-shadow: 0 8px 25px rgba(0,0,0,0.15);`;
        }
        
        const cardHTML = `
            <div class="offer-card ${themeClass}" style="${customStyle}" onclick="event.stopPropagation(); if('${offer.actionLink}') { if(window.viewAllCategory) { window.viewAllCategory('${offer.actionLink}'); } else { const searchInp = document.getElementById('searchInput'); if(searchInp) { searchInp.value = '${offer.actionLink}'; searchInp.dispatchEvent(new Event('input')); } } }">
                ${!offer.image ? `<i data-lucide="${iconName}" class="offer-card-bg-icon"></i>` : ''}
                <div class="offer-card-content">
                    <div class="offer-card-title" ${offer.image ? 'style="color: #fff;"' : ''}>${offer.title || 'عرض حصري!'}</div>
                    <div class="offer-card-subtitle" ${offer.image ? 'style="color: rgba(255,255,255,0.9);"' : ''}>${offer.subtitle || 'لفترة محدودة'}</div>
                </div>
                <div class="offer-card-btn" ${offer.image ? 'style="background: rgba(255,255,255,0.2); backdrop-filter: blur(5px); color: #fff; border: 1px solid rgba(255,255,255,0.3);"' : ''}>
                    ${offer.actionText || 'تسوق الآن'}
                    <i data-lucide="chevron-left" style="width: 14px; height: 14px; ${offer.image ? 'color: #fff;' : ''}"></i>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });

    // Render Discounted Products (Takhfidat)
    const offersProductsContainer = document.getElementById('offersProductsContainer');
    if (offersProductsContainer && window.products) {
        offersProductsContainer.innerHTML = '';
        const discountedProducts = window.products.filter(p => p.discount > 0);
        if (discountedProducts.length === 0) {
            offersProductsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px; font-weight: 700;">لا توجد عروض حالياً</p>';
        } else {
            discountedProducts.forEach(p => {
                const card = createProductCardHTML(p);
                offersProductsContainer.appendChild(card);
            });
        }
    }
    
    if (window.lucide) lucide.createIcons();
}

// ==========================================
// Smart Shopping Lists Logic
// ==========================================
window.shoppingLists = [];
window.activeAddToListProductId = null;
window.isAddToListFromModal = false;

window.loadShoppingLists = async () => {
    const user = auth.currentUser;
    if (user) {
        try {
            const snap = await db.collection('users').doc(user.uid).collection('shoppingLists').get();
            window.shoppingLists = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn("Error fetching lists from Firestore, falling back to local storage:", err);
            loadLocalLists();
        }
    } else {
        loadLocalLists();
    }
    
    // Ensure default lists exist if empty
    if (window.shoppingLists.length === 0) {
        window.shoppingLists = [{ id: 'default_fav', name: 'المفضلة العامة 🛒', items: [] }];
        saveShoppingLists();
    }

    updateShoppingListsUI();
};

function loadLocalLists() {
    try {
        const local = localStorage.getItem('shoppingLists');
        window.shoppingLists = local ? JSON.parse(local) : [];
    } catch(e) {
        window.shoppingLists = [];
    }
}

window.saveShoppingLists = async () => {
    const user = auth.currentUser;
    if (user) {
        try {
            for (const list of window.shoppingLists) {
                await db.collection('users').doc(user.uid).collection('shoppingLists').doc(list.id).set({
                    name: list.name,
                    items: list.items,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (err) {
            console.error("Error saving lists to Firestore:", err);
        }
    }
    localStorage.setItem('shoppingLists', JSON.stringify(window.shoppingLists));
};

window.openAddToListModal = (event, productId) => {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    window.activeAddToListProductId = productId;
    
    const container = document.getElementById('modalListsSelector');
    if (!container) return;

    if (window.shoppingLists.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 10px; color:#64748b;">لا توجد قوائم تسوق حالياً. أنشئ واحدة بالأسفل!</div>`;
    } else {
        container.innerHTML = window.shoppingLists.map(list => {
            const hasProduct = list.items.some(item => item.id === productId);
            return `
                <div class="modal-list-item" onclick="addToList('${list.id}', '${productId}')">
                    <span class="modal-list-item-title">${list.name}</span>
                    <span style="font-size:0.75rem; color:${hasProduct ? 'var(--primary)' : '#94a3b8'}; display:flex; align-items:center; gap:4px;">
                        <i data-lucide="${hasProduct ? 'check-circle' : 'plus'}" style="width:14px; height:14px;"></i>
                        ${hasProduct ? 'مضاف بالفعل' : 'إضافة'}
                    </span>
                </div>
            `;
        }).join('');
    }

    document.getElementById('addToListModal').style.display = 'flex';
    if (window.lucide) lucide.createIcons();
};

window.addToList = (listId, productId) => {
    const list = window.shoppingLists.find(l => l.id === listId);
    if (!list) return;
    
    const product = products.find(p => p.id === productId);
    if (!product) {
        window.showToast("عذراً، لم نتمكن من العثور على المنتج ❌");
        return;
    }

    if (list.items.some(item => item.id === productId)) {
        window.showToast(`المنتج مضاف بالفعل في قائمة "${list.name}"!`);
        document.getElementById('addToListModal').style.display = 'none';
        return;
    }

    list.items.push({
        id: product.id,
        name: product.name,
        image: product.image,
        price: product.discount > 0 ? product.price * (1 - product.discount/100) : product.price
    });

    saveShoppingLists();
    updateShoppingListsUI();
    window.showToast(`تمت إضافة "${product.name}" إلى قائمة "${list.name}" ✅`);
    document.getElementById('addToListModal').style.display = 'none';
};

// Opens the integrated driver portal page
window.openDeliveryDashboard = () => {
    navigateTo('deliveryPage');
    // Small delay to ensure page is visible before initializing
    setTimeout(() => {
        initDriverPortal();
    }, 100);
};

// Initialises the driver portal: checks auth state, role, phone number, then shows the right section
window.initDriverPortal = async () => {
    const user = auth.currentUser;
    if (!user) {
        showDriverLogin();
        // Render the Google sign-in button inside the driver login section
        try {
            if (typeof google !== 'undefined' && google.accounts) {
                google.accounts.id.renderButton(
                    document.getElementById('g_id_signin_driver'),
                    { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ar', width: 280 }
                );
            }
        } catch(e) { console.warn('GSI render failed:', e); }
        return;
    }

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            showDriverLogin();
            return;
        }
        const data = userDoc.data();

        // Check delivery_partner role
        if (data.role !== 'delivery_partner') {
            // Check if driver document already exists for this user in drivers collection
            const existingDriverDoc = await db.collection('drivers').doc(user.uid).get();
            if (existingDriverDoc.exists) {
                console.log("Existing driver found, auto-upgrading role to delivery_partner...");
                await db.collection('users').doc(user.uid).set({ 
                    role: 'delivery_partner',
                    isApproved: true 
                }, { merge: true });
                return initDriverPortal();
            }

            // Check if admin granted permission by email before user first login
            const pendingSnap = await db.collection('pending_drivers').doc(user.email.toLowerCase()).get();
            if (pendingSnap.exists) {
                console.log("Found pending driver permission, upgrading user...");
                await db.collection('users').doc(user.uid).set({ 
                    role: 'delivery_partner',
                    isApproved: true 
                }, { merge: true });
                await db.collection('pending_drivers').doc(user.email.toLowerCase()).delete();
                return initDriverPortal();
            }
            
            // Allow completing registration instead of blocking
            showDriverRegistration();
            return;
        }

        // Check registration data
        if (!data.phone || !data.fullName || !data.vehicle) {
            showDriverRegistration();
            return;
        }

        // All checks passed — show dashboard
        // Set global driver references
        window.currentDriver = user;
        window.driverDocRef = db.collection('drivers').doc(user.uid);

        // Ensure driver doc exists in 'drivers' collection
        const driverDoc = await window.driverDocRef.get();
        if (!driverDoc.exists) {
            await window.driverDocRef.set({
                name: data.fullName || user.displayName || data.name || 'مندوب',
                email: user.email,
                phone: data.phone,
                vehicle: data.vehicle || 'motorcycle',
                area: data.area || 'غير محدد',
                photo: user.photoURL || '',
                online: false,
                totalEarnings: 0,
                totalDues: 0,
                completedOrders: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        showDriverDashboard();
        listenToDriverStatus();
        listenToOrders();

    } catch (err) {
        console.error('Driver init error:', err);
        window.showToast('خطأ في تحميل بوابة المندوبين');
    }
};

window.driverStatusUnsub = null;
window.ordersUnsub = null;
window.currentDriver = null;
window.driverDocRef = null;

function getCurrentUser() {
    if (typeof auth !== 'undefined' && auth && auth.currentUser) return auth.currentUser;
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) return firebase.auth().currentUser;
    if (window.currentDriver) return window.currentDriver;
    return null;
}

function getDriverDocRef() {
    if (window.driverDocRef) return window.driverDocRef;
    const user = getCurrentUser();
    if (user && (db || window.db)) {
        const firestore = db || window.db;
        window.driverDocRef = firestore.collection('drivers').doc(user.uid);
        return window.driverDocRef;
    }
    return null;
}

function showDriverLogin() {

    document.getElementById('driverLoginSection').style.display = 'block';
    document.getElementById('driverWaitingSection').style.display = 'none';
    document.getElementById('driverRegSection').style.display = 'none';
    document.getElementById('driverDashboardSection').style.display = 'none';
}

function showDriverWaiting() {
    document.getElementById('driverLoginSection').style.display = 'none';
    document.getElementById('driverWaitingSection').style.display = 'block';
    document.getElementById('driverRegSection').style.display = 'none';
    document.getElementById('driverDashboardSection').style.display = 'none';
}

function showDriverRegistration() {
    document.getElementById('driverLoginSection').style.display = 'none';
    document.getElementById('driverWaitingSection').style.display = 'none';
    document.getElementById('driverRegSection').style.display = 'block';
    document.getElementById('driverDashboardSection').style.display = 'none';
}

function showDriverDashboard() {
    document.getElementById('driverLoginSection').style.display = 'none';
    document.getElementById('driverWaitingSection').style.display = 'none';
    document.getElementById('driverRegSection').style.display = 'none';
    document.getElementById('driverDashboardSection').style.display = 'block';
    
    // Set profile info
    const user = auth.currentUser;
    if (user) {
        // Shared profile info
        const img = document.getElementById('profileDriverImg');
        const name = document.getElementById('profileDriverName');
        const email = document.getElementById('profileDriverEmail');
        
        // Header info
        const headerImg = document.getElementById('driverImg');
        const headerName = document.getElementById('driverName');

        if (img) img.src = user.photoURL || "";
        if (name) name.textContent = user.displayName;
        if (email) email.textContent = user.email;
        
        if (headerImg) {
            headerImg.src = user.photoURL || "";
            headerImg.style.display = 'block';
        }
        if (headerName) headerName.textContent = user.displayName;
    }
}

window.submitDriverRegistration = async () => {
    const fullName = document.getElementById('driverFullNameInput').value.trim();
    const phone = document.getElementById('driverPhoneInput').value.trim();
    const vehicle = document.getElementById('driverVehicleInput').value;
    const area = document.getElementById('driverAreaInput').value.trim();

    if (!fullName || fullName.length < 5) {
        alert("يرجى إدخال الاسم الكامل بشكل صحيح");
        return;
    }

    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
        alert("يرجى إدخال رقم هاتف مصري صحيح (11 رقم)");
        return;
    }

    if (!area) {
        alert("يرجى تحديد منطقة العمل المفضلة");
        return;
    }

    try {
        const user = auth.currentUser;
        const updateData = { 
            fullName: fullName,
            phone: phone, 
            vehicle: vehicle, 
            area: area,
            role: 'delivery_partner',
            isApproved: true,
            registrationCompleted: true 
        };
        
        await db.collection('users').doc(user.uid).set(updateData, { merge: true });
        
        // Sync with drivers collection
        await db.collection('drivers').doc(user.uid).set({
            name: fullName,
            phone: phone,
            vehicle: vehicle,
            area: area,
            email: user.email,
            photo: user.photoURL || '',
            online: false,
            isApproved: true,
            totalEarnings: 0,
            completedOrders: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        window.showToast("🎉 تم تسجيل بياناتك بنجاح! جاري توجيهك للوحة التحكم.");
        initDriverPortal();
    } catch (err) {
        alert("فشل حفظ البيانات: " + err.message);
    }
};

window.isDriverOnline = false;

function updateDriverStatusUI(isOnline) {
    const badge = document.getElementById('driverStatus');
    const btn = document.getElementById('toggleStatusBtn');
    const dot = document.getElementById('onlineStatusDot');
    const dashStatus = document.getElementById('dashOnlineStatus');
    const dashStatusText = document.getElementById('dashStatusText');

    if (badge) {
        badge.textContent = isOnline ? 'متصل (نشط)' : 'غير متصل (متوقف)';
        badge.className = isOnline ? 'status-badge online' : 'status-badge offline';
    }
    if (btn) {
        btn.style.background = isOnline ? 'var(--primary)' : 'white';
        btn.style.color = isOnline ? 'white' : '#1e293b';
    }
    if (dot) {
        dot.style.background = isOnline ? '#10b981' : '#94a3b8';
    }
    if (dashStatus) {
        dashStatus.style.background = isOnline ? '#f0fdf4' : '#fff1f2';
        dashStatus.style.color = isOnline ? '#16a34a' : '#e11d48';
        dashStatus.style.borderColor = isOnline ? '#dcfce7' : '#ffe4e6';
    }
    if (dashStatusText) {
        dashStatusText.textContent = isOnline ? 'متصل الآن (نشط)' : 'غير نشط (متوقف)';
    }
}

function listenToDriverStatus() {
    if (driverStatusUnsub) driverStatusUnsub();
    const ref = getDriverDocRef();
    if (!ref) return;
    
    driverStatusUnsub = ref.onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        
        window.isDriverOnline = data.online === true;

        updateDriverStatusUI(data.online === true);
        
        if (data.online) {
            // Auto-start GPS tracking when driver is online
            startLocationTracking();
        } else {
            // Stop location watch if offline
            if (typeof locationWatchId !== 'undefined' && locationWatchId && navigator.geolocation) {
                navigator.geolocation.clearWatch(locationWatchId);
                locationWatchId = null;
            }
        }

        // Global stats (all time)
        const totalEarningsVal = document.getElementById('totalDriverEarnings');
        const completedOrdersVal = document.getElementById('totalCompletedOrders');

        if (totalEarningsVal) totalEarningsVal.textContent = (data.totalEarnings || 0) + " ج.م";
        if (completedOrdersVal) completedOrdersVal.textContent = data.completedOrders || 0;
        
        const joinDateEl = document.getElementById('driverJoinDate');
        if (joinDateEl && data.createdAt) {
            try {
                const date = typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt);
                joinDateEl.textContent = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            } catch(e) { joinDateEl.textContent = 'قريباً'; }
        }

        const profilePhone = document.getElementById('profileDriverPhone');
        if (profilePhone) profilePhone.textContent = data.phone || 'غير مسجل';

        const earnEl = document.getElementById('walletEarnings');
        const duesEl = document.getElementById('walletDues');
        if (earnEl) earnEl.textContent = Number(data.totalEarnings || 0).toLocaleString();
        if (duesEl) duesEl.textContent = Number(data.totalDues || 0).toLocaleString();

        // Update Dashboard Summary Card
        const dashVehicle = document.getElementById('dashDriverVehicle');
        const dashArea = document.getElementById('dashDriverArea');
        const dashStatus = document.getElementById('dashOnlineStatus');

        const vehicleLabels = {
            'motorcycle': 'موتوسيكل 🏍️',
            'car': 'سيارة 🚗',
            'bicycle': 'عجلة 🚲',
            'scooter': 'سكوتر 🛴'
        };

        if (dashVehicle) dashVehicle.textContent = vehicleLabels[data.vehicle] || 'غير محدد';
        if (dashArea) dashArea.textContent = data.area || 'غير محدد';

        // Set driver name in dashboard header
        const dashName = document.getElementById('dashDriverName');
        if (dashName) dashName.textContent = 'مرحباً، ' + (data.name || window.currentDriver?.displayName || 'طيار') + ' 👋';
        
        // Update the new Online Status badge
        if (dashStatus) {
            const isOnline = data.online === true;
            dashStatus.style.background = isOnline ? '#f0fdf4' : '#fff1f2';
            dashStatus.style.color = isOnline ? '#16a34a' : '#e11d48';
            dashStatus.style.borderColor = isOnline ? '#dcfce7' : '#ffe4e6';
            dashStatus.innerHTML = `
                <div style="width: 8px; height: 8px; background: ${isOnline ? '#16a34a' : '#e11d48'}; border-radius: 50%; ${isOnline ? 'animation: pulse 2s infinite;' : ''}"></div>
                ${isOnline ? 'متصل الآن' : 'غير متصل (بانتظارك)'}
            `;
        }

        const dashEarnEl = document.getElementById('dashWalletEarnings');
        const dashDuesEl = document.getElementById('dashWalletDues');
        if (dashEarnEl) dashEarnEl.textContent = Number(data.totalEarnings || 0).toLocaleString();
        if (dashDuesEl) dashDuesEl.textContent = Number(data.totalDues || 0).toLocaleString();

        // Update All ID Cards (Dashboard & Profile)
        const idHtml = `
            <div class="id-card-glass">
                <div class="id-card-header">
                    <img src="logo.png" style="height: 25px;">
                    <div class="verified-badge-gold">
                        <i data-lucide="shield-check" style="width: 12px;"></i>
                        <span>Verified Affiliate</span>
                    </div>
                </div>
                <div class="id-card-body">
                    <div class="id-user-shield">
                        <img src="${data.photo || user.photoURL || ''}" onerror="this.src='https://ui-avatars.com/api/?name=Driver&background=fff&color=ff6b00'">
                    </div>
                    <div class="id-details">
                        <h2 style="font-family: Cairo, sans-serif;">${data.name || user.displayName}</h2>
                        <div class="id-field">
                            <label>رقم الهوية الرقمية</label>
                            <span>MAS-${user.uid.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <div class="id-grid">
                            <div class="id-field">
                                <label>المركبة</label>
                                <span>${vehicleLabels[data.vehicle] || 'غير محدد'}</span>
                            </div>
                            <div class="id-field">
                                <label>المنطقة</label>
                                <span>${data.area || 'غير محدد'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="hologram-strip"></div>
            </div>
        `;

        const dashIdContainer = document.getElementById('dashboardIdentityCard');
        const profileIdContainer = document.getElementById('driverIdentityCard');
        
        if (dashIdContainer) dashIdContainer.innerHTML = idHtml;
        if (profileIdContainer) profileIdContainer.innerHTML = idHtml;

        if (window.lucide) lucide.createIcons();

        // Trigger stats and history listener for the driver
        listenToStatsAndHistory(currentDriver.uid);
    });
}

function listenToStatsAndHistory(uid) {
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    
    // Use the existing ordersUnsub or a dedicated one? Dedicated is better for history
    db.collection('orders')
        .where('driverId', '==', uid)
        .onSnapshot(snap => {
            const completed = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(o => o.status === 'archived_received');

            let todayOrders = 0;
            let todayE = 0;
            
            // Render History
            const historyList = document.getElementById('driverHistory');
            const sorted = completed.sort((a,b) => {
                const secA = a.deliveredAt?.seconds || a.deliveredAt?.toMillis?.() / 1000 || 0;
                const secB = b.deliveredAt?.seconds || b.deliveredAt?.toMillis?.() / 1000 || 0;
                return secB - secA;
            });
            
            if (historyList) {
                if (sorted.length === 0) {
                    historyList.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8; font-weight:700;">لا توجد عمليات مكتملة حالياً</div>';
                } else {
                    historyList.innerHTML = sorted.slice(0, 10).map(d => {
                        let timeStr = '---';
                        try {
                            const date = d.deliveredAt?.toDate ? d.deliveredAt.toDate() : new Date(d.deliveredAt);
                            timeStr = date.toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
                        } catch(e) {}
                        
                        return `
                            <div class="history-item" style="background:white; padding:18px; border-radius:20px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; border:1px solid #f1f5f9; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 40px; height: 40px; background: #eef2ff; color: #6366f1; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                        <i data-lucide="check-circle-2" style="width: 20px;"></i>
                                    </div>
                                    <div style="text-align: right;">
                                        <h5 style="font-weight:900; color:#1e293b; margin: 0; font-size: 0.95rem;">طلب #${d.orderNumber || d.id.slice(-5)}</h5>
                                        <p style="font-size:0.75rem; color:#94a3b8; font-weight:700; margin-top: 2px;">${timeStr}</p>
                                    </div>
                                </div>
                                <div style="font-weight:900; color:#10b981; font-size:1rem; background: #ecfdf5; padding: 4px 12px; border-radius: 10px;">+${d.deliveryFee || 15} ج.م</div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // Calculate Today's Stats
            completed.forEach(o => {
                let delivered = null;
                if (o.deliveredAt) {
                    delivered = o.deliveredAt.toDate ? o.deliveredAt.toDate() : new Date(o.deliveredAt);
                } else {
                    // Fallback for pending server timestamps
                    delivered = new Date();
                }
                
                if (delivered && delivered >= startOfToday) {
                    todayOrders++;
                    todayE += parseCurrency(o.deliveryFee || 15);
                }
            });

            const earningsVal = document.getElementById('todayEarnings');
            const ordersVal = document.getElementById('todayOrdersCount');
            if (earningsVal) earningsVal.textContent = todayE;
            if (ordersVal) ordersVal.textContent = todayOrders;
            
            if (window.lucide) lucide.createIcons();
        });
}

window.toggleDriverStatus = async () => {
    try {
        const ref = getDriverDocRef();
        if (!ref) {
            alert("يرجى تسجيل الدخول أولاً كطيار");
            return;
        }
        const doc = await ref.get();
        let currentStatus = false;
        if (doc.exists) {
            currentStatus = doc.data().online === true;
            await ref.update({ online: !currentStatus });
        } else {
            await ref.set({ online: true }, { merge: true });
        }
        const newStatus = !currentStatus;
        window.isDriverOnline = newStatus;
        window.showToast(newStatus ? "أنت الآن متصل وجاهز لاستلام الطلبات 🛵" : "تم إيقاف وضع الاستعداد. ارتاح قليلاً! 👋");
        updateDriverStatusUI(newStatus);
        if (typeof listenToOrders === 'function') listenToOrders();
    } catch (err) {
        console.error('toggleDriverStatus error:', err);
        alert('خطأ في تغيير حالة المندوب: ' + err.message);
    }
};

window.openDailyHistory = async () => {
    const modal = document.getElementById('dailyHistoryModal');
    const list = document.getElementById('dailyHistoryList');
    if (!modal || !list) return;
    
    modal.style.display = 'flex';
    list.innerHTML = '<div style="text-align:center; padding:40px;"><span class="spin" style="display:inline-block; width:30px; height:30px; border:3px solid var(--primary); border-top-color:transparent; border-radius:50%;"></span></div>';
    
    try {
        const snap = await driverDocRef.collection('dailyStats').orderBy('date', 'desc').limit(30).get();
        if (snap.empty) {
            list.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b; font-weight:700;">لا يوجد سجل يومي حتى الآن</div>';
            return;
        }
        
        list.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            const dateStr = doc.id; // YYYY-MM-DD
            return `
                <div style="background:white; border-radius:22px; padding:20px; border:1px solid #f1f5f9; box-shadow:0 4px 15px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:1000; color:#0f172a; font-size:1rem;">📅 يوم ${dateStr}</span>
                        <span style="background:#f0fdf4; color:#16a34a; padding:4px 12px; border-radius:10px; font-size:0.75rem; font-weight:900;">${d.orders || 0} طلبات</span>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div style="background:#f8fafc; padding:12px; border-radius:15px; border:1px solid #f1f5f9;">
                            <span style="display:block; font-size:0.65rem; color:#64748b; font-weight:800; margin-bottom:4px;">صافي الربح</span>
                            <span style="font-weight:950; color:#1e293b;">${d.earnings || 0} ج.م</span>
                        </div>
                        <div style="background:#fff1f2; padding:12px; border-radius:15px; border:1px solid #ffe4e6;">
                            <span style="display:block; font-size:0.65rem; color:#e11d48; font-weight:800; margin-bottom:4px;">عهدة الموقع</span>
                            <span style="font-weight:950; color:#991b1b;">${d.dues || 0} ج.م</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        list.innerHTML = '<div style="text-align:center; padding:40px; color:#ef4444;">عذراً، حدث خطأ في تحميل السجل</div>';
    }
};

function listenToOrders() {
    if (ordersUnsub) ordersUnsub();
    
    ordersUnsub = db.collection('orders')
        .where('status', 'in', ['pending', 'processing', 'shipped', 'completed'])
        .onSnapshot(snapshot => {
            const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // 1. Available Orders (Pending and no driver assigned)
            const available = allOrders.filter(o => o.status === 'pending' && !o.driverId);
            renderAvailableOrders(available);
            
            // 2. Active Orders (Assigned to CURRENT driver)
            const active = allOrders.filter(o => o.driverId === currentDriver.uid && !['archived_received', 'archived_refused', 'cancelled'].includes(o.status));
            renderActiveOrdersForDriver(active);
        });
}

function renderAvailableOrders(orders) {
    const list = document.getElementById('availableOrdersList');
    const empty = document.getElementById('emptyOrdersMsg');
    if (!list) return;

    // Block offline drivers from viewing available orders
    if (!window.isDriverOnline) {
        list.innerHTML = `
            <div style="background: #fff1f2; border: 1.5px dashed #fecaca; border-radius: 24px; padding: 30px 20px; text-align: center; margin-bottom: 20px;">
                <div style="width: 60px; height: 60px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; color: #ef4444;">
                    <i data-lucide="power-off" style="width: 28px; height: 28px;"></i>
                </div>
                <h4 style="font-size: 1.1rem; font-weight: 900; color: #991b1b; margin: 0 0 6px; font-family: 'Cairo', sans-serif;">حسابك غير نشط حالياً (متوقف) ⏸️</h4>
                <p style="font-size: 0.85rem; color: #7f1d1d; font-weight: 700; margin: 0 0 20px; line-height: 1.5; font-family: 'Cairo', sans-serif;">قم بتفعيل حالتك إلى "نشط ومتصل" لتتمكن من رؤية واستقبال الطلبات المتاحة للتوصيل.</p>
                <button onclick="toggleDriverStatus()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 14px 28px; border-radius: 16px; font-size: 0.9rem; font-weight: 900; cursor: pointer; box-shadow: 0 8px 20px rgba(16,185,129,0.3); font-family: 'Cairo', sans-serif;">
                    ⚡ تفعيل الحالة الآن إلى (نشط ومتصل)
                </button>
            </div>
        `;
        if (empty) empty.style.display = 'none';
        if (window.lucide) lucide.createIcons();
        return;
    }

    if (orders.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }

    if (empty) empty.style.display = 'none';
    list.innerHTML = orders.map(o => {
        const items = Array.isArray(o.items) ? o.items : (typeof o.items === 'object' ? Object.values(o.items) : []);
        const itemsCount = items.length;
        
        return `
            <div class="premium-order-card fade-in" style="margin-bottom: 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 38px; height: 38px; background: #fff7ed; color: #f97316; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="zap" style="width: 20px;"></i>
                        </div>
                        <span style="font-weight:950; font-size:1.05rem; color: #1e293b;">طلب متاح #${o.orderNumber || o.id.slice(-5)}</span>
                    </div>
                    <span style="font-size:0.85rem; color:#10b981; font-weight:900; background:#ecfdf5; padding:6px 14px; border-radius:12px;">+${o.deliveryFee} ج.م</span>
                </div>
                
                <div style="background: #f8fafc; border-radius: 18px; padding: 15px; margin-bottom: 20px; border: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 0.85rem; font-weight: 800; margin-bottom: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px;">
                        <i data-lucide="info" style="width: 14px;"></i> تفاصيل الطلب:
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 0.85rem; color: #64748b; font-weight: 700;">عدد الأصناف:</span>
                        <span style="font-size: 0.85rem; color: #1e293b; font-weight: 950;">${itemsCount} صنف</span>
                    </div>
                    
                    <!-- Item Names List -->
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; max-height: 80px; overflow-y: auto; background: rgba(0,0,0,0.02); padding: 8px; border-radius: 10px;">
                        ${items.map(item => `
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #475569; font-weight: 800;">
                                <span>• ${item.name}</span>
                                <span style="color: #94a3b8;">×${item.quantity}</span>
                            </div>
                        `).join('')}
                    </div>

                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 0.85rem; color: #64748b; font-weight: 700;">إجمالي الفاتورة:</span>
                        <span style="font-size: 0.85rem; color: #1e293b; font-weight: 900;">${o.total} ج.م</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 0.85rem; font-weight: 800; margin-top: 10px; margin-bottom: 5px;">
                        <i data-lucide="map-pin" style="width: 14px;"></i> موقع التوصيل:
                    </div>
                    <p style="font-size:0.95rem; color:#334155; font-weight:700; line-height: 1.5; margin: 0;">${o.address}</p>
                </div>

                <button onclick="acceptOrder('${o.id}')" class="btn-primary" style="width:100%; border-radius:18px; font-size:1rem; font-weight: 950; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; box-shadow: 0 10px 20px rgba(255, 107, 0, 0.2);">
                    <i data-lucide="package-check" style="width: 20px;"></i> قبول واستلام الطلب
                </button>
            </div>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

function renderActiveOrdersForDriver(orders) {
    const container = document.getElementById('driverActiveOrderContainer');
    const list = document.getElementById('driverActiveOrdersList');
    if (!container || !list) return;

    if (orders.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    list.innerHTML = orders.map((o, idx) => {
        const designIndex = (idx % 5) + 1;
        const statusSteps = {
            'processing': 1,
            'shipped': 2,
            'completed': 3
        };
        const currentStep = statusSteps[o.status] || 0;
        
        return `
            <div class="active-order-card fade-in" style="margin-bottom: 25px;">
                <div class="order-header-accent">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="package" style="width:18px;"></i>
                        <span>طلب نشط #${o.orderNumber || o.id.slice(-5)}</span>
                    </div>
                    <span style="font-size: 0.75rem; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 8px;">قيد التوصيل</span>
                </div>
                
                <div class="active-order-content">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
                        <div>
                            <h4 style="font-weight:1000; font-size:1.2rem; color:#1e293b; margin: 0 0 5px 0;">${o.customer}</h4>
                            <p style="font-size:0.9rem; color:#64748b; font-weight:700; cursor:pointer; display: flex; align-items: center; gap: 5px;" onclick="openMap('${o.address}', '${o.latlng}', '${o.location}')">
                                <i data-lucide="map-pin" style="width: 14px; color: var(--primary);"></i> ${o.address}
                            </p>
                        </div>
                        <a href="tel:${o.phone}" style="width:50px; height:50px; background:#ecfdf5; border-radius:18px; display:flex; align-items:center; justify-content:center; color:#10b981; text-decoration:none; box-shadow: 0 5px 15px rgba(16, 185, 129, 0.1);">
                            <i data-lucide="phone"></i>
                        </a>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:15px;">
                        <button onclick="openMap('${o.address}', '${o.latlng}', '${o.location}')" style="background:#fff; border:1.5px solid #f1f5f9; border-radius:16px; padding:14px; font-size:0.85rem; font-weight:900; display:flex; align-items:center; justify-content:center; gap:8px;">
                            <i data-lucide="map" style="width:16px; color: #3b82f6;"></i> فتح الخريطة
                        </button>
                        <a href="https://wa.me/2${o.phone}" target="_blank" style="background:#25D366; color:white; border-radius:16px; padding:14px; font-size:0.85rem; font-weight:900; display:flex; align-items:center; justify-content:center; gap:8px; text-decoration:none; box-shadow: 0 8px 18px rgba(37, 211, 102, 0.2);">
                            <i data-lucide="message-square" style="width:16px;"></i> واتساب
                        </a>
                    </div>

                    <!-- Detailed Order Items & Pricing -->
                    <div style="background: white; border: 1.5px solid #f1f5f9; border-radius: 22px; padding: 18px; margin-bottom: 25px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <div style="display: flex; align-items: center; gap: 8px; color: #1e293b; font-size: 0.9rem; font-weight: 1000;">
                                <i data-lucide="shopping-bag" style="width: 16px; color: var(--primary);"></i> تفاصيل المنتجات:
                            </div>
                            <span style="font-size: 0.75rem; background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 50px; font-weight: 800;">
                                ${(o.items || []).length} صنف
                            </span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; max-height: 200px; overflow-y: auto; padding-left: 5px;">
                            ${(o.items || []).map(item => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #f8fafc;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <img src="${item.image || 'https://via.placeholder.com/40'}" style="width: 35px; height: 35px; object-fit: cover; border-radius: 8px; border: 1px solid #f1f5f9;">
                                        <div style="display: flex; flex-direction: column;">
                                            <span style="font-size: 0.82rem; font-weight: 900; color: #334155;">${item.name}</span>
                                            <span style="font-size: 0.7rem; font-weight: 700; color: #64748b;">الكمية: ${item.quantity}</span>
                                        </div>
                                    </div>
                                    <span style="font-size: 0.85rem; font-weight: 950; color: #1e293b;">${(item.price * item.quantity).toLocaleString()} ج.م</span>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div style="background: #f8fafc; border-radius: 14px; padding: 12px; margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #64748b; font-weight: 800;">
                                <span>سعر المنتجات:</span>
                                <span>${(parseCurrency(o.total) - parseCurrency(o.deliveryFee)).toLocaleString()} ج.م</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #64748b; font-weight: 800;">
                                <span>رسوم التوصيل:</span>
                                <span style="color: #10b981;">+${o.deliveryFee} ج.م</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.95rem; color: #1e293b; font-weight: 1000; border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 4px;">
                                <span>الإجمالي النهائي:</span>
                                <span style="color: var(--primary);">${o.total} ج.م</span>
                            </div>
                        </div>
                        
                        <!-- Payment Badge -->
                        <div style="margin-top: 15px; display: flex; align-items: center; gap: 8px; background: ${['cash', 'cod'].includes((o.paymentMethod || '').toLowerCase().trim()) ? '#fef2f2' : '#ecfdf5'}; border: 1px solid ${['cash', 'cod'].includes((o.paymentMethod || '').toLowerCase().trim()) ? '#fee2e2' : '#d1fae5'}; padding: 10px; border-radius: 12px;">
                            <i data-lucide="${['cash', 'cod'].includes((o.paymentMethod || '').toLowerCase().trim()) ? 'banknote' : 'credit-card'}" style="width: 16px; color: ${['cash', 'cod'].includes((o.paymentMethod || '').toLowerCase().trim()) ? '#ef4444' : '#10b981'};"></i>
                            <span style="font-size: 0.8rem; font-weight: 900; color: ${['cash', 'cod'].includes((o.paymentMethod || '').toLowerCase().trim()) ? '#991b1b' : '#065f46'};">
                                طريقة الدفع: ${['cash', 'cod'].includes((o.paymentMethod || '').toLowerCase().trim()) ? 'نقدى عند الاستلام' : 'دفع إلكتروني (تم التحصيل)'}
                            </span>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:12px; background: #f8fafc; padding: 20px; border-radius: 22px; border: 1px solid #f1f5f9;">
                        <p style="font-size:0.85rem; font-weight:1000; color:#475569; margin: 0 0 5px 0; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="refresh-cw" style="width: 14px;"></i> تحديث حالة التوصيل
                        </p>
                        
                        <div style="display:grid; grid-template-columns: 1fr; gap:10px;">
                            <button onclick="updateOrderStatusForDriver('${o.id}', 'shipped')" class="btn-status-step ${currentStep >= 2 ? 'completed' : ''}" ${o.status === 'shipped' || currentStep > 2 ? 'disabled' : ''}>
                                <i data-lucide="bike"></i> في الطريق للعميل
                            </button>
                            
                            <button onclick="updateOrderStatusForDriver('${o.id}', 'completed')" class="btn-status-step ${currentStep >= 3 ? 'completed' : ''}" ${o.status !== 'shipped' ? 'disabled' : ''}>
                                <i data-lucide="check-circle"></i> وصلت لموقع العميل
                            </button>

                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:8px;">
                                <button onclick="updateOrderStatusForDriver('${o.id}', 'archived_received')" class="btn-final success" ${o.status !== 'completed' ? 'disabled' : ''} style="height: 55px; border-radius: 18px;">
                                    تم التسليم ✅
                                </button>
                                <button onclick="updateOrderStatusForDriver('${o.id}', 'archived_refused')" class="btn-final fail" ${o.status !== 'completed' ? 'disabled' : ''} style="height: 55px; border-radius: 18px;">
                                    رفض الاستلام ❌
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

window.acceptOrder = async (orderId) => {
    const user = getCurrentUser();
    if (!user) {
        alert("يرجى تسجيل الدخول أولاً كطيار");
        return;
    }

    // Direct Firestore check to guarantee driver is online before accepting order
    try {
        const ref = getDriverDocRef() || window.db.collection('drivers').doc(user.uid);
        const doc = await ref.get();
        if (!doc.exists || !doc.data().online) {
            alert("⚠️ حسابك غير نشط حالياً (متوقف)! يجب عليك تفعيل زر الاستعداد إلى (نشط ومتصل) أولاً قبل قبول أي طلب.");
            return;
        }
    } catch (e) {
        console.error('Check driver status error before accept:', e);
    }
    try {
        const orderRef = db.collection('orders').doc(orderId);
        const driverName = (window.currentUserData && window.currentUserData.name) || currentDriver.displayName;
        
        await db.runTransaction(async (transaction) => {
            const orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists) throw new Error("الطلب لم يعد متاحاً");
            if (orderDoc.data().driverId) throw new Error("تم قبول هذا الطلب من قبل طيار آخر");
            
            transaction.update(orderRef, {
                driverId: currentDriver.uid,
                driverName: driverName,
                status: 'processing',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        window.showToast("🎉 تم قبول واستلام الطلب بنجاح! توجه للعميل الآن.");
    } catch (err) {
        alert(err.message);
    }
};

window.updateOrderStatusForDriver = async (id, newStatus) => {
    const statusLabels = {
        'shipped': '🛵 في الطريق (مع المندوب)',
        'completed': '📍 وصلت لموقع العميل (وصل الطلب)',
        'archived_received': '✅ تم الاستلام والتسليم بنجاح',
        'archived_refused': '❌ تم رفض استلام الشحنة'
    };
    
    if (!confirm(`⚠️ هل تريد بالفعل تغيير حالة الطلب للعميل إلى: ${statusLabels[newStatus]}؟`)) return;
    
    try {
        const orderRef = db.collection('orders').doc(id);
        const orderDoc = await orderRef.get();
        if (!orderDoc.exists) return alert("الطلب غير موجود!");
        
        const orderData = orderDoc.data();
        const updateData = {
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (newStatus === 'archived_received') {
            updateData.deliveredAt = firebase.firestore.FieldValue.serverTimestamp();
        } else if (newStatus === 'archived_refused') {
            updateData.refusedAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        await orderRef.update(updateData);
        
        if (newStatus === 'archived_received') {
            const fee = parseCurrency(orderData.deliveryFee) || 15;
            const pMethod = (orderData.paymentMethod || '').toLowerCase().trim();
            const isCash = pMethod === 'cash' || pMethod === 'cod';
            const totalVal = parseCurrency(orderData.total);
            const collectionAmount = isCash ? Math.max(0, totalVal - fee) : 0;
            
            console.log(`Settling Wallet: Fee=${fee}, Method=${pMethod}, Total=${totalVal}, Due=${collectionAmount}`);
            
            const today = new Date().toISOString().split('T')[0];
            const dailyDocRef = driverDocRef.collection('dailyStats').doc(today);

            await db.runTransaction(async (transaction) => {
                transaction.update(driverDocRef, {
                    completedOrders: firebase.firestore.FieldValue.increment(1),
                    totalEarnings: firebase.firestore.FieldValue.increment(fee),
                    totalDues: firebase.firestore.FieldValue.increment(collectionAmount)
                });

                transaction.set(dailyDocRef, {
                    earnings: firebase.firestore.FieldValue.increment(fee),
                    dues: firebase.firestore.FieldValue.increment(collectionAmount),
                    orders: firebase.firestore.FieldValue.increment(1),
                    date: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            window.showToast(isCash ? 
                `📌 تم التسليم: ربحت ${fee} ج.م، وعليك للموقع ${collectionAmount} ج.م حصيلة نقدية.` : 
                `🎉 تم التسليم بنجاح! تم إضافة مجهودك (${fee} ج.م) لمحفظتك.`
            );
        } else {
            window.showToast(`👍 تم تحديث حالة الطلب للعميل`);
        }
    } catch(err) {
        alert("حدث خطأ أثناء تحديث حالة الطلب: " + err.message);
    }
};

window.toggleDashboardID = () => {
    const wrapper = document.getElementById('dashboardIDWrapper');
    if (!wrapper) return;
    
    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        wrapper.classList.add('slideUp');
    } else {
        wrapper.style.display = 'none';
    }
};

window.openEditProfile = async () => {
    try {
        const doc = await window.driverDocRef.get();
        if (!doc.exists) return;
        const data = doc.data();
        
        document.getElementById('editDriverFullName').value = data.name || '';
        document.getElementById('editDriverPhone').value = data.phone || '';
        document.getElementById('editDriverVehicle').value = data.vehicle || 'motorcycle';
        document.getElementById('editDriverArea').value = data.area || '';
        
        document.getElementById('editDriverProfileModal').style.display = 'flex';
    } catch(e) { console.error(e); }
};

window.closeEditProfile = () => {
    document.getElementById('editDriverProfileModal').style.display = 'none';
};

window.saveDriverProfile = async () => {
    const btn = document.getElementById('saveProfileBtn');
    const name = document.getElementById('editDriverFullName').value.trim();
    const phone = document.getElementById('editDriverPhone').value.trim();
    const vehicle = document.getElementById('editDriverVehicle').value;
    const area = document.getElementById('editDriverArea').value.trim();

    if (!name || !phone || !area) return alert("يرجى إكمال جميع الحقول");

    btn.disabled = true;
    btn.textContent = "جاري الحفظ...";

    try {
        const user = auth.currentUser;
        // Update user doc
        await db.collection('users').doc(user.uid).update({
            fullName: name,
            phone: phone,
            vehicle: vehicle,
            area: area
        });
        
        // Update driver doc
        await window.driverDocRef.update({
            name: name,
            phone: phone,
            vehicle: vehicle,
            area: area
        });

        window.showToast("✅ تم تحديث ملفك الشخصي بنجاح!");
        closeEditProfile();
    } catch(err) {
        alert("حدث خطأ: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "حفظ التغييرات ✅";
    }
};

window.switchDriverTab = (tabId) => {
    document.querySelectorAll('.driver-tab-content').forEach(t => t.style.display = 'none');
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.style.display = 'block';
        targetTab.classList.add('fade-in');
    }
    
    document.querySelectorAll('.driver-nav-item').forEach(n => n.classList.remove('active'));
    const navItemId = tabId === 'driverOrdersTab' ? 'nav-orders-driver' : 'nav-profile-driver';
    const navItem = document.getElementById(navItemId);
    if (navItem) navItem.classList.add('active');
    
    if (window.lucide) lucide.createIcons();
};

function startLocationTracking() {
    if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);
    
    if (navigator.geolocation) {
        locationWatchId = navigator.geolocation.watchPosition(pos => {
            if (driverDocRef) {
                driverDocRef.update({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    lastLocationUpdate: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(e => console.error("Location update failed:", e));
            }
        }, err => console.warn("Location watch error:", err), {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
        });
    }
}

// Driver Manual / On-Demand GPS Location Update
window.updateDriverLocationGPS = async function() {
    const btn = document.getElementById('driverGpsBtn');
    const text = document.getElementById('driverGpsText');
    if (text) text.textContent = 'جاري تحديد موقعك الجغرافي (GPS)... 🛰️';
    if (btn) btn.disabled = true;

    const user = getCurrentUser();
    if (!user) {
        alert("يرجى تسجيل الدخول أولاً كطيار");
        if (text) text.textContent = 'تحديد وتحديث موقعك تلقائياً (GPS) 📍';
        if (btn) btn.disabled = false;
        return;
    }

    if (!navigator.geolocation) {
        alert('خدمة تحديد الموقع (GPS) غير مدعومة في متصفحك أو جهازك');
        if (text) text.textContent = 'تحديد وتحديث موقعك تلقائياً (GPS) 📍';
        if (btn) btn.disabled = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        
        try {
            const ref = getDriverDocRef() || window.db.collection('drivers').doc(user.uid);
            await ref.set({
                lat: lat,
                lng: lng,
                lastLocationUpdate: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            window.showToast(`تم تحديد وتحديث موقعك الجغرافي بنجاح! 📍 (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`, 'success');
            if (text) text.textContent = `تم تحديد الموقع بنجاح 📍 (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
        } catch (err) {
            console.error('Update GPS location error:', err);
            alert('حدث خطأ أثناء حفظ الموقع في قاعدة البيانات: ' + err.message);
            if (text) text.textContent = 'تحديد وتحديث موقعك تلقائياً (GPS) 📍';
        } finally {
            if (btn) btn.disabled = false;
        }
    }, (err) => {
        console.error('GPS position error:', err);
        let msg = 'تعذر الحصول على موقعك الجغرافي.';
        if (err.code === 1) msg = 'تنبيه: تم رفض إذن تحديد الموقع (GPS). يرجى تفعيل إذن الجغرافيا لهذا الموقع في إعدادات المتصفح/الهاتف.';
        else if (err.code === 2) msg = 'تنبيه: تعذر الاتصال بـ GPS. يرجى تفعيل خدمة الموقع الجغرافي في جهازك.';
        else if (err.code === 3) msg = 'تنبيه: انتهت مهلة تحديد الموقع. حاول مرة أخرى.';
        alert('⚠️ ' + msg);
        if (text) text.textContent = 'تحديد وتحديث موقعك تلقائياً (GPS) 📍';
        if (btn) btn.disabled = false;
    }, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    });
};

window.openMap = (addr, latlng, locationUrl) => {
    let query = latlng;
    if ((!query || query === '') && locationUrl && locationUrl.includes('q=')) {
        try {
            const urlCoords = locationUrl.split('q=')[1].split('&')[0];
            if (urlCoords) query = urlCoords;
        } catch(e) {}
    }
    const finalQuery = (query && query !== '') ? query : addr;
    if (!finalQuery) return alert("الموقع غير متوفر");
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(finalQuery)}`;
    window.open(mapsUrl, '_blank');
};

// ===============================================
// --- Feature: Store-First Storefront ---
// ===============================================
window.merchants = [];

async function loadMerchants() {
    try {
        const snap = await db.collection('merchants').get();
        // Filter ONLY approved merchants so pending/unapproved stores are hidden from public view
        window.merchants = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(m => m.status === 'approved' || m.isApproved === true || m.approved === true);
        renderStores();
    } catch (err) { console.error("Error loading merchants:", err); }
}

window.revokeMerchantRole = async (uid, email) => {
    if (!confirm(`هل أنت متأكد من سحب صلاحية التاجر من ${email}؟`)) return;
    
    try {
        await db.collection('users').doc(uid).update({
            isMerchant: firebase.firestore.FieldValue.delete()
        });
        alert("✅ تم سحب الصلاحية بنجاح");
        openManageMerchantsModal(); // Refresh list
    } catch (err) {
        alert("حدث خطأ: " + err.message);
    }
};

window.updateStoreStatusLabel = (isOpen) => {
    const label = document.getElementById('storeStatusLabel');
    const iconBg = document.getElementById('statusIconBg');
    if (!label || !iconBg) return;
    
    if (isOpen) {
        label.textContent = 'المتجر مفتوح حالياً';
        label.style.color = '#10b981';
        iconBg.style.background = '#ecfdf5';
        iconBg.style.color = '#10b981';
    } else {
        label.textContent = 'المتجر مغلق الآن';
        label.style.color = '#ef4444';
        iconBg.style.background = '#fef2f2';
        iconBg.style.color = '#ef4444';
    }
};

window.isStoreCurrentlyOpen = (m) => {
    // 1. Manual Toggle check
    if (m.isOpen === false) return false;
    
    // 2. Schedule check
    if (!m.workingHours) return true; // If no schedule, assume open (legacy)
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const config = m.workingHours[dayName];
    
    if (!config || !config.isOpen) return false;
    
    // Now compare times
    const nowHours = now.getHours();
    const nowMinutes = now.getMinutes();
    const nowTime = nowHours * 100 + nowMinutes;
    
    const startParts = config.start.split(':');
    const endParts = config.end.split(':');
    const startTime = parseInt(startParts[0]) * 100 + parseInt(startParts[1]);
    const endTime = parseInt(endParts[0]) * 100 + parseInt(endParts[1]);
    
    if (startTime <= endTime) {
        return nowTime >= startTime && nowTime <= endTime;
    } else {
        // Handles night shifts that cross midnight (e.g. 22:00 to 03:00)
        return nowTime >= startTime || nowTime <= endTime;
    }
};

async function loadStoreCategories() {
    const selectElements = [
        document.getElementById('storeCategoryInput'),
        document.getElementById('storeTypeInput')
    ].filter(Boolean);

    if (selectElements.length === 0) return;

    const defaultOptions = [
        { id: 'supermarket', name: 'سوبر ماركت ومواد غذائية 🛒' },
        { id: 'electronics', name: 'إلكترونيات وموبايلات 📱' },
        { id: 'fashion', name: 'ملابس وأزياء 👔' },
        { id: 'pharmacy', name: 'صيدلية ومستلزمات طبية 💊' },
        { id: 'restaurant', name: 'مطعم ومأكولات 🍔' },
        { id: 'general', name: 'عام / متنوعات 📦' }
    ];

    let optionsHTML = '<option value="" disabled selected>اختر نوع النشاط...</option>';

    try {
        const snap = await db.collection('categories').get();
        if (!snap.empty) {
            snap.forEach(doc => {
                const data = doc.data();
                optionsHTML += `<option value="${doc.id}">${data.name || doc.id}</option>`;
            });
        }
    } catch(e) {
        console.warn("Categories fetch fallback:", e);
    }

    // Append default options if not present
    defaultOptions.forEach(opt => {
        if (!optionsHTML.includes(`value="${opt.id}"`)) {
            optionsHTML += `<option value="${opt.id}">${opt.name}</option>`;
        }
    });

    selectElements.forEach(sel => {
        const prev = sel.value;
        sel.innerHTML = optionsHTML;
        if (prev) sel.value = prev;
    });
}

// --- Store Creation & Merchant Page Logic ---
window.openMerchantStoreSettingsModal = async () => {
    await loadStoreCategories();
    
    const modal = document.getElementById('merchantSettingsModal') || document.getElementById('createStoreModal');
    if (!modal) return;
    modal.style.display = 'flex';
    
    const user = getCurrentUser();
    if (!user) return;
    try {
        const snap = await db.collection('merchants').where('ownerUid', '==', user.uid).limit(1).get();
        if (!snap.empty) {
            const data = snap.docs[0].data();
            if (document.getElementById('storeNameInput')) document.getElementById('storeNameInput').value = data.name || '';
            if (document.getElementById('storeTypeInput')) document.getElementById('storeTypeInput').value = data.category || data.type || 'supermarket';
            if (document.getElementById('storeCategoryInput')) document.getElementById('storeCategoryInput').value = data.category || data.type || 'supermarket';
            if (document.getElementById('storeDescInput')) document.getElementById('storeDescInput').value = data.description || '';
            
            // Show previews if images exist
            const logoPreview = document.getElementById('storeLogoPreview');
            if (logoPreview) {
                if (data.logo) {
                    logoPreview.src = data.logo;
                    logoPreview.style.display = 'block';
                } else {
                    logoPreview.style.display = 'none';
                }
            }
            
            // Pre-fill multi-cover preview grid
            const coverGrid = document.getElementById('storeCoverPreviewGrid');
            const covers = data.covers || (data.cover ? [data.cover] : []);
            
            // Initialize pending array with existing URLs
            window.pendingStoreCovers = covers.map(url => ({ type: 'url', data: url }));
            
            if (coverGrid && window.pendingStoreCovers.length > 0) {
                if (typeof renderCoverPreviews === 'function') renderCoverPreviews();
            } else if (coverGrid) {
                coverGrid.style.display = 'none';
                coverGrid.innerHTML = '';
            }
            const isOpen = data.isOpen !== false; // Default to true if undefined
            const statusInput = document.getElementById('storeIsOpenInput');
            if (statusInput) {
                statusInput.checked = isOpen;
                if (typeof updateStoreStatusLabel === 'function') updateStoreStatusLabel(isOpen);
            }
            
            // Populate Working Hours
            if (data.workingHours) {
                const grid = document.getElementById('workingHoursGrid');
                if (grid) {
                    Object.entries(data.workingHours).forEach(([day, config]) => {
                        const row = grid.querySelector(`.working-day-row[data-day="${day}"]`);
                        if (row) {
                            const toggle = row.querySelector('.day-toggle');
                            const start = row.querySelector('.start-time');
                            const end = row.querySelector('.end-time');
                            if (toggle) {
                                toggle.checked = config.isOpen !== false;
                                row.classList.toggle('closed', !toggle.checked);
                            }
                            if (start) start.value = config.start || '09:00';
                            if (end) end.value = config.end || '22:00';
                        }
                    });
                }
            }
            if (document.getElementById('storeCoverPreviewGrid')) {
                document.getElementById('storeCoverPreviewGrid').style.display = 'none';
            }
        }
    } catch(e) {
        console.warn("Error fetching merchant data for settings:", e);
    }
    if (window.lucide) lucide.createIcons();
};

window.saveMyStore = async () => {
    console.log("Starting saveMyStore process...");
    const user = auth.currentUser;
    if (!user) {
        console.error("No user logged in during saveMyStore");
        return alert("يجب تسجيل الدخول أولاً");
    }
    
    // Find button - try more specific selecor if needed
    let btn = document.querySelector('#createStoreModal button[onclick="saveMyStore()"]');
    if (!btn) btn = document.querySelector('button[onclick="saveMyStore()"]');
    const originalText = btn ? btn.innerHTML : '';
    
    try {
        const nameInput = document.getElementById('storeNameInput');
        const typeInput = document.getElementById('storeTypeInput');
        const descInput = document.getElementById('storeDescInput');
        
        if (!nameInput) throw new Error("Could not find storeNameInput");
        
        const name = nameInput.value.trim();
        const categoryId = typeInput ? typeInput.value : 'all';
        const type = typeInput && typeInput.selectedIndex >= 0 ? typeInput.options[typeInput.selectedIndex].text : 'متنوع';
        const desc = descInput ? descInput.value.trim() : '';
        
        const logoFile = document.getElementById('storeLogoFile')?.files[0];
        const coverFiles = window.pendingStoreCovers || [];
        
        const isOpenInput = document.getElementById('storeIsOpenInput');
        const isOpen = isOpenInput ? isOpenInput.checked : true;
        
        if (!name) return alert("يرجى إدخال اسم المتجر");
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" style="width:18px;"></i> جاري النشر...';
            if (window.lucide) lucide.createIcons();
        }
        
        let logoUrl = '';
        
        // Extract Working Hours
        const workingHours = {};
        const hoursGrid = document.getElementById('workingHoursGrid');
        if (hoursGrid) {
            hoursGrid.querySelectorAll('.working-day-row').forEach(row => {
                const day = row.getAttribute('data-day');
                const isOpen = row.querySelector('.day-toggle').checked;
                const start = row.querySelector('.start-time').value;
                const end = row.querySelector('.end-time').value;
                workingHours[day] = { isOpen, start, end };
            });
        }

        console.log("Checking for existing store data for UID:", user.uid);
        const existingSnap = await db.collection('merchants').where('ownerUid', '==', user.uid).limit(1).get();
        const existingData = !existingSnap.empty ? existingSnap.docs[0].data() : null;

        // Run logo upload and cover image uploads concurrently using Promise.all for ultra-fast performance!
        const [uploadedLogo, uploadedCovers] = await Promise.all([
            logoFile ? uploadFile(logoFile, 'merchants/logos') : Promise.resolve(existingData ? existingData.logo : ''),
            coverFiles.length > 0
                ? Promise.all(coverFiles.map(async (item) => item.type === 'file' ? await uploadFile(item.data, 'merchants/covers') : item.data))
                : Promise.resolve(existingData ? (existingData.covers || (existingData.cover ? [existingData.cover] : [])) : [])
        ]);

        logoUrl = uploadedLogo || '';
        let coversArray = uploadedCovers || [];
        const coverUrl = coversArray[0] || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800';

        const isAlreadyApproved = existingData ? (existingData.status === 'approved' || existingData.isApproved === true) : false;

        const storeData = {
            name,
            type,
            category: categoryId,
            logo: logoUrl || '',
            cover: coverUrl,
            covers: coversArray,
            description: desc || '',
            isOpen: isOpen,
            workingHours: workingHours,
            ownerUid: user.uid,
            ownerEmail: user.email || '',
            status: isAlreadyApproved ? 'approved' : 'pending',
            isApproved: isAlreadyApproved,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        console.log("Finalizing Firestore write for store data...");
        if (existingData) {
            await db.collection('merchants').doc(existingSnap.docs[0].id).set(storeData, { merge: true });
            console.log("Store updated successfully");
        } else {
            storeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('merchants').doc(user.uid).set(storeData, { merge: true });
            console.log("New store created successfully");
        }

        // Also update user status doc to sync
        await db.collection('users').doc(user.uid).set({
            merchantStatus: isAlreadyApproved ? 'approved' : 'pending',
            merchantStoreName: name,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        const modal = document.getElementById('createStoreModal');
        if (modal) modal.style.display = 'none';
        
        console.log("Refreshing UI components...");
        await loadMerchants(); 
        await loadMerchantPageForUser(user);
        
        if (isAlreadyApproved) {
            showToast('✅ تم تحديث ونشر متجرك بنجاح!');
        } else {
            showToast('⏳ تم تقديم بيانات متجرك! سيتم مراجعة المتجر ونشره للعملاء بعد الموافقة عليه من لوحة التحكم.');
        }
    } catch(err) {
        console.error("Save Store Critical Error:", err);
        alert("حدث خطأ أثناء حفظ المتجر: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
            if (window.lucide) lucide.createIcons();
        }
    }
};

window.loadMerchantPageForUser = async (user) => {
    if (!user) return;
    const setupBanner = document.getElementById('merchantSetupBanner');
    const existingBanner = document.getElementById('merchantExistingBanner');
    if (!setupBanner || !existingBanner) return;
    
    try {
        const snap = await db.collection('merchants').where('ownerUid', '==', user.uid).limit(1).get();
        if (snap.empty) {
            // New merchant: show setup prompt
            setupBanner.style.display = 'block';
            existingBanner.style.display = 'none';
        } else {
            // Existing merchant: show store details
            const data = snap.docs[0].data();
            setupBanner.style.display = 'none';
            existingBanner.style.display = 'block';
            const nameEl = document.getElementById('myStoreName');
            const typeEl = document.getElementById('myStoreType');
            const logoEl = document.getElementById('myStoreLogo');
            if (nameEl) nameEl.textContent = data.name || '';
            if (typeEl) typeEl.textContent = data.type || '';
            if (logoEl && data.logo) logoEl.src = data.logo;
        }
    } catch(e) { console.error('Error loading merchant page:', e); }
    
    if (window.lucide) lucide.createIcons();
};

function renderStores(skipClear = false) {
    const container = document.getElementById('productsGrid');
    const featuredSec = document.getElementById('featuredStoresSection');
    const featuredContainer = document.getElementById('featuredStoresContainer');
    if(!container) return;
    
    // (Removed erroneous header-minimal toggle here)
    
    // Switch to stores-mini-grid class for the main container
    container.className = 'stores-mini-grid';
    
    const searchVal = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
    const currentCat = window.currentCategoryFilter || 'all';

    let filteredMerchants = window.merchants || [];
    
    if(currentCat !== 'all') {
        const isOffers = currentCat === 'offers' || currentCat.includes('عرض');
        filteredMerchants = filteredMerchants.filter(m => {
            const matchCat = m.category === currentCat || m.type === currentCat;
            const hasOffers = isOffers && (m.hasOffers || m.covers?.length > 1); // Sample logic for offers
            return matchCat || hasOffers;
        });
    }
    
    if(searchVal.length > 0) {
        filteredMerchants = filteredMerchants.filter(m => 
            m.name.toLowerCase().includes(searchVal) || 
            (m.type && m.type.toLowerCase().includes(searchVal))
        );
    }

    const isHome = document.getElementById('homePage')?.classList.contains('active');
    if(isHome && currentCat === 'all' && searchVal.length === 0 && filteredMerchants.length > 3) {
        featuredSec.style.display = 'block';
        featuredContainer.innerHTML = '';
        const featured = filteredMerchants.slice(0, 5);
        featured.forEach((m, idx) => {
            const isOpen = isStoreCurrentlyOpen(m);
            const fCard = document.createElement('div');
            fCard.className = 'featured-card-wrapper';
            
            const covers = m.covers && m.covers.length > 0 ? m.covers : [m.cover || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800'];
            const hasMultiple = covers.length > 1;
            const trackId = `featuredTrack_${m.id}_${idx}`;
            
            let slideshowHtml = `
                <div class="featured-slideshow" onclick="openStoreMenu('${m.id}')">
                    <div id="${trackId}" class="featured-track" style="display: flex; height: 100%; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); width: 100%;">
                        ${covers.map(url => `
                            <div class="featured-slide" style="flex-shrink: 0; width: 100%; height: 100%;">
                                <img src="${url}" onerror="this.src='https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800'" style="${!isOpen ? 'filter: grayscale(1) brightness(0.6);' : ''}">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            fCard.innerHTML = `
                <div class="featured-store-card">
                    ${slideshowHtml}
                    <div class="featured-overlay" onclick="openStoreMenu('${m.id}')">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="background:var(--primary); color:white; font-size:0.65rem; padding:4px 12px; border-radius:50px; font-weight:900; box-shadow: 0 4px 10px rgba(255,107,0,0.3);">متجر مميز</span>
                                <div style="display:flex; align-items:center; gap:3px; color:#fbbf24; font-size:0.8rem; font-weight:1000;">
                                    <i data-lucide="star" style="width:14px; fill:currentColor;"></i>
                                    <span>4.9</span>
                                </div>
                            </div>
                            ${!isOpen ? `
                                <span style="background:#ef4444; color:white; font-size:0.65rem; padding:4px 12px; border-radius:50px; font-weight:900; box-shadow: 0 4px 10px rgba(239,68,68,0.3);">مغلق حالياً</span>
                            ` : ''}
                        </div>
                        <h4 style="margin:0; font-weight:1000; font-size:1.25rem; line-height:1.2; font-family:'Cairo', sans-serif;">${m.name}</h4>
                        <p style="margin:6px 0 0; font-size:0.75rem; opacity:0.9; font-weight:700; display:flex; align-items:center; gap:5px;">
                            <i data-lucide="clock" style="width:12px;"></i> توصيل سريع • 15-25 دقيقة
                        </p>
                    </div>
                </div>
            `;
            featuredContainer.appendChild(fCard);

            // Auto-cycle for featured slideshows if multiple covers
            if (hasMultiple) {
                let currentIdx = 0;
                setInterval(() => {
                    currentIdx = (currentIdx + 1) % covers.length;
                    const track = document.getElementById(trackId);
                    if (track) track.style.transform = `translateX(-${currentIdx * 100}%)`;
                }, 4000 + (idx * 500)); // Stagger starts
            }
        });
    } else {
        featuredSec.style.display = 'none';
    }

    if (!skipClear) container.innerHTML = '';
    if(filteredMerchants.length === 0) {
        if (!skipClear) container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#64748b;"><h4>لا يـوجد متاجر تطابق بحثـك... 🔍</h4></div>`;
        return;
    }

    filteredMerchants.forEach(m => {
        const isOpen = isStoreCurrentlyOpen(m);
        const card = document.createElement('div');
        card.className = `store-mini-card fade-in ${!isOpen ? 'store-closed' : ''}`;
        card.onclick = () => openStoreMenu(m.id);
        
        card.innerHTML = `
            <div style="position:relative; margin-bottom: 5px;">
                <img src="${m.logo || 'https://ui-avatars.com/api/?name='+m.name+'&background=ff6b00&color=fff'}" class="mini-card-logo" style="${!isOpen ? 'filter: grayscale(0.8); opacity: 0.7;' : ''}">
                <div style="position:absolute; bottom:6px; left:6px; width:16px; height:16px; background:${isOpen ? '#10b981' : '#ef4444'}; border:3px solid white; border-radius:50%; box-shadow:0 0 15px ${isOpen ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'};"></div>
                ${!isOpen ? `
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.6); color:white; padding:4px 10px; border-radius:10px; font-size:0.65rem; font-weight:900; white-space:nowrap; backdrop-filter:blur(4px);">مغلق حالياً</div>
                ` : ''}
            </div>
            <h3 class="mini-card-name" style="${!isOpen ? 'color:#94a3b8;' : ''}">${m.name}</h3>
            <span class="mini-card-tag">${m.type || 'متجر'}</span>
            <div style="display:flex; align-items:center; gap:4px; color:#fbbf24; font-size:0.8rem; font-weight:1000; margin-top:2px;">
                <i data-lucide="star" style="width:14px; fill:currentColor;"></i>
                <span>4.9</span>
                <span style="color:#94a3b8; font-weight:700; margin-right:4px;">(50+)</span>
            </div>
        `;
        container.appendChild(card);
    });
    if(window.lucide) lucide.createIcons();
}

window.currentStoreProducts = [];
let slideshowInterval = null;

async function openStoreMenu(merchantId) {
    const m = window.merchants.find(st => st.id === merchantId);
    if(!m) return;

    const banner = document.getElementById('detailStoreBanner');
    const logo = document.getElementById('detailStoreLogo');
    const name = document.getElementById('detailStoreName');
    const type = document.getElementById('detailStoreType');
    const grid = document.getElementById('detailStoreProducts');
    const catRow = document.getElementById('detailStoreCats');
    const searchInput = document.getElementById('detailInternalSearch');

    if(searchInput) searchInput.value = ''; 
    name.textContent = m.name;
    
    const isOpen = isStoreCurrentlyOpen(m);
    
    // Day translation
    const dayMap = {
        'Saturday': 'السبت', 'Sunday': 'الأحد', 'Monday': 'الاثنين', 
        'Tuesday': 'الثلاثاء', 'Wednesday': 'الأربعاء', 'Thursday': 'الخميس', 'Friday': 'الجمعة'
    };
    
    let hoursHTML = '';
    if (m.workingHours) {
        const currentDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = currentDays[new Date().getDay()];
        const todayHours = m.workingHours[todayName];
        
        if (todayHours && todayHours.isOpen) {
            hoursHTML = `<span style="font-size:0.65rem; color:#64748b; font-weight:700;">ساعات العمل اليوم: ${todayHours.start} - ${todayHours.end}</span>`;
        } else {
            hoursHTML = `<span style="font-size:0.65rem; color:#ef4444; font-weight:700;">المتجر مغلق طوال اليوم</span>`;
        }
    }

    type.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span>${m.type || 'متجر منوع • توصيل سريع'}</span>
                <div style="display:flex; align-items:center; gap:4px; background:${isOpen ? '#10b98115' : '#ef444415'}; color:${isOpen ? '#10b981' : '#ef4444'}; padding:3px 10px; border-radius:50px; font-size:0.7rem; font-weight:900; border:1px solid ${isOpen ? '#10b98130' : '#ef444430'};">
                    <div style="width:6px; height:6px; background:currentColor; border-radius:50%; ${isOpen ? 'animation:pulse 2s infinite;' : ''}"></div>
                    ${isOpen ? 'مفتوح للطلبات' : 'مغلق حالياً'}
                </div>
            </div>
            ${hoursHTML}
        </div>
    `;
    logo.src = m.logo || 'https://ui-avatars.com/api/?name='+m.name+'&background=ff6b00&color=fff';
    if (!isOpen) logo.style.filter = 'grayscale(0.8) opacity(0.8)';
    else logo.style.filter = 'none';

    // --- Render Slideshow ---
    if (slideshowInterval) clearInterval(slideshowInterval);
    
    const covers = m.covers && m.covers.length > 0 ? m.covers : [m.cover || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800'];
    const tracks = ['slideshowTrack', 'slideshowTrackModal'];
    const dotsContainers = ['slideshowDots', 'slideshowDotsModal'];
    
    tracks.forEach(trackId => {
        const track = document.getElementById(trackId);
        if (track) {
            track.dataset.currentIndex = 0;
            track.dataset.totalSlides = covers.length;
            track.style.transform = 'translateX(0)';
            track.innerHTML = covers.map(url =>
                `<div style="flex-shrink:0; width:100%; height:100%; position:relative; background:#f0f2f5;">
                    <img src="${url}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800'">
                </div>`
            ).join('');
        }
    });

    dotsContainers.forEach(dotsId => {
        const dotsContainer = document.getElementById(dotsId);
        if (dotsContainer) {
            dotsContainer.innerHTML = covers.map((_, i) => 
                `<div class="slideshow-dot ${i === 0 ? 'active' : ''}" onclick="window.slideshowTo(${i}, true, '${tracks[0]}')"></div>`
            ).join('');
        }
    });

    const navBtns = [
        ['slideshowPrev', 'slideshowNext'],
        ['slideshowPrevModal', 'slideshowNextModal']
    ];
    navBtns.forEach((btns, idx) => {
        const p = document.getElementById(btns[0]);
        const n = document.getElementById(btns[1]);
        if (p) {
            p.style.display = covers.length > 1 ? 'block' : 'none';
            p.onclick = () => window.slideshowMove(-1, true, tracks[0]);
        }
        if (n) {
            n.style.display = covers.length > 1 ? 'block' : 'none';
            n.onclick = () => window.slideshowMove(1, true, tracks[0]);
        }
    });

    // Auto-play only if multiple images
    if (covers.length > 1) {
        slideshowInterval = setInterval(() => {
            window.slideshowMove(1, false, 'slideshowTrack');
        }, 5000);
    }
    
    // Remove old offer banner, it's replaced by slideshow
    const offerBannerContainer = document.getElementById('merchantOfferBannerContainer');
    if (offerBannerContainer) offerBannerContainer.style.display = 'none';

    grid.innerHTML = '<div style="text-align: center; padding: 50px;"><div class="skeleton" style="height:100px; width:100%; border-radius:20px;"></div></div>';
    
    // Navigate to the dedicated page
    navigateTo('storeDetailPage');

    window.currentStoreProducts = products.filter(p => p.merchantId === merchantId || (m.ownerUid && p.merchantId === m.ownerUid));
    const uniqueCats = ['الكل', ...new Set(window.currentStoreProducts.map(p => p.category).filter(Boolean))];
    
    catRow.innerHTML = '';
    const translation = {
        'electronics': 'إلكترونيات',
        'fashion': 'أزياء وملابس',
        'home': 'منزل وديكور',
        'offers': 'عروض جملة',
        'restaurant': 'مطاعم ومأكولات',
        'bakery': 'حلويات ومخبوزات',
        'supermarket': 'سوبر ماركت',
        'veggies': 'خضروات وفواكه',
        'meat': 'لحوم ودواجن',
        'dairy': 'ألبان وأجبان',
        'perfumes': 'عطور وتجميل',
        'kitchen': 'مطبخ وأدوات',
        'health': 'صحة وعناية',
        'toys': 'ألعاب وأطفال',
        'sports': 'أدوات رياضية',
        'books': 'كتب ومكتبة',
        'gifts': 'هدايا وزهور',
        'cleaning': 'منظفات',
        'pets': 'حيوانات أليفة',
        'other': 'منتجات عامة'
    };
    
    uniqueCats.forEach(c => {
        const pill = document.createElement('div');
        pill.className = `menu-category-pill ${c === 'الكل' ? 'active' : ''}`;
        pill.style.borderRadius = "12px";
        
        let displayName = c;
        if (c !== 'الكل') {
            displayName = translation[c] || c;
            // If it's a known ID in window.allCategories, use that name
            if (window.allCategories && window.allCategories[c]) {
                displayName = window.allCategories[c].name;
            }
        }
        
        pill.textContent = displayName;
        pill.onclick = () => {
            document.querySelectorAll('#detailStoreCats .menu-category-pill').forEach(el => el.classList.remove('active'));
            pill.classList.add('active');
            renderDetailStoreProducts(c);
        };
        catRow.appendChild(pill);
    });

    renderDetailStoreProducts('الكل');
}

function renderDetailStoreProducts(category = 'الكل', search = '') {
    const grid = document.getElementById('detailStoreProducts');
    if(!grid) return;

    let filtered = window.currentStoreProducts;
    if(category !== 'الكل') filtered = filtered.filter(p => p.category === category);
    if(search.length > 0) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(search.toLowerCase()) || 
            (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
        );
    }

    grid.innerHTML = '';
    if(filtered.length === 0) {
        grid.innerHTML = '<div style="text-align: center; padding: 60px; color:#64748b; font-weight:700;">لا يـوجد نتائج... 🍱</div>';
        return;
    }

    filtered.forEach(p => {
        const card = createProductCardHTML(p);
        grid.appendChild(card);
    });
    if(window.lucide) lucide.createIcons();
}

function filterDetailMenu() {
    const searchVal = document.getElementById('detailInternalSearch').value.trim();
    const activePill = document.querySelector('#detailStoreCats .menu-category-pill.active');
    const activeCat = activePill ? activePill.textContent : 'الكل';
    renderDetailStoreProducts(activeCat, searchVal);
}

window.closeStoreMenu = () => {
    document.getElementById('storeMenuModal').style.display = 'none';
};

// --- Merchant Platform Logic ---
async function populateMerchantCategoryDropdown() {
    const catSelect = document.getElementById('mProdCategory');
    if (!catSelect) return;
    try {
        const snap = await db.collection('categories').get();
        let optionsHTML = '';
        const dropdownEmojis = {
            'electronics': '📱', 'fashion': '👗', 'home': '🏠', 'offers': '📦',
            'restaurant': '🍔', 'bakery': '🥐', 'supermarket': '🛒', 'veggies': '🍎',
            'meat': '🥩', 'dairy': '🧀', 'perfumes': '💄', 'kitchen': '🍳',
            'health': '💊', 'toys': '🧸', 'sports': '⚽', 'books': '📚',
            'gifts': '🎁', 'cleaning': '🧼', 'pets': '🐾', 'general': '📋', 'other': '🛍️'
        };
        snap.forEach(doc => {
            const data = doc.data();
            const emoji = dropdownEmojis[doc.id] || '🏷️';
            optionsHTML += `<option value="${doc.id}">${data.name} ${emoji}</option>`;
        });
        catSelect.innerHTML = optionsHTML || '<option value="general">عام 📋</option>';
    } catch(e) { console.error("Error loading categories", e); }
}

async function openMerchantAddProductModal() {
    window.editingProductId = null;
    document.getElementById('merchantAddProductForm').reset();
    document.getElementById('mProdPreview').style.display = 'none';
    
    await populateMerchantCategoryDropdown();
    
    const modalTitle = document.querySelector('#merchantAddProductModal h3');
    if (modalTitle) modalTitle.textContent = 'إضافة منتج جديد';
    
    const submitBtn = document.getElementById('mProdSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'حفظ ونشر التعديلات';
    
    document.getElementById('merchantAddProductModal').style.display = 'flex';
}

async function handleMerchantProductSubmit(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const submitBtn = document.getElementById('mProdSubmitBtn');
    const name = document.getElementById('mProdName').value.trim();
    const price = parseFloat(document.getElementById('mProdPrice').value);
    const category = document.getElementById('mProdCategory').value;
    const desc = document.getElementById('mProdDesc').value.trim();
    
    if (!name || isNaN(price)) return showToast("⚠️ يرجى إدخال اسم المنتج وسعره", "warning");

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" style="width:18px;"></i> جاري الحفظ...';
    if (window.lucide) lucide.createIcons();

    try {
        const imageFile = document.getElementById('mProdFile').files[0];
        let imageUrl = '';

        if (window.editingProductId) {
            // Preserving image if not changed
            const existingDoc = await db.collection('products').doc(window.editingProductId).get();
            if (existingDoc.exists) imageUrl = existingDoc.data().image || '';
        }

        if (imageFile) {
            imageUrl = await uploadFile(imageFile, 'products');
        } else if (!window.editingProductId) {
            // New product must have an image
            submitBtn.disabled = false;
            submitBtn.textContent = 'حفظ ونشر التعديلات';
            return showToast("⚠️ يرجى اختيار صورة للمنتج", "warning");
        }

        const productData = {
            name,
            price,
            category,
            description: desc,
            image: imageUrl,
            merchantId: user.uid,
            merchantEmail: user.email || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active',
            isMerchantOnly: true
        };

        if (window.editingProductId) {
            await db.collection('products').doc(window.editingProductId).update(productData);
            showToast('✅ تم تحديث المنتج بنجاح!', 'success');
        } else {
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('products').add(productData);
            showToast('✅ تم إضافة المنتج بنجاح إلى متجرك!', 'success');
        }

        document.getElementById('merchantAddProductModal').style.display = 'none';
        document.getElementById('merchantAddProductForm').reset();
        
        // Refresh UI
        if (typeof fetchProducts === 'function') await fetchProducts();
        if (typeof renderMerchantProducts === 'function') renderMerchantProducts();
        
        window.editingProductId = null;
    } catch (error) {
        console.error('Error adding/updating product:', error);
        showToast('❌ فشل حفظ المنتج: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'حفظ ونشر التعديلات';
    }
}

// --- Merchant Management Logic for Super Admin ---
window.openManageMerchantsModal = async () => {
    document.getElementById('manageMerchantsModal').style.display = 'flex';
    const listDiv = document.getElementById('merchantsList');
    listDiv.innerHTML = '<p style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;">جاري تحميل قائمة التجار...</p>';
    
    try {
        const snap = await db.collection('users').where('isMerchant', '==', true).get();
        if (snap.empty) {
            listDiv.innerHTML = '<p style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;">لا يوجد تجار مسجلين حالياً</p>';
            return;
        }
        
        listDiv.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border-radius: 14px; margin-bottom: 8px; border: 1px solid #f1f5f9;';
            item.innerHTML = `
                <div style="display: flex; flex-direction: column; overflow: hidden; margin-left: 10px;">
                    <span style="font-size: 0.85rem; font-weight: 900; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.name || 'مستخدم بدون اسم'}</span>
                    <span style="font-size: 0.7rem; color: #64748b; font-weight: 700;">${data.email}</span>
                </div>
                <button onclick="revokeMerchantRole('${doc.id}', '${data.email}')" style="background: #fee2e2; color: #ef4444; border: none; padding: 6px 12px; border-radius: 10px; font-size: 0.7rem; font-weight: 900; cursor: pointer;">سحب الصلاحية</button>
            `;
            listDiv.appendChild(item);
        });
    } catch (err) {
        listDiv.innerHTML = `<p style="color:red; font-size: 0.7rem; text-align: center;">خطأ: ${err.message}</p>`;
    }
};

window.addMerchantRole = async () => {
    const email = document.getElementById('merchantEmailInput').value.trim().toLowerCase();
    if (!email) return alert("يرجى إدخال البريد الإلكتروني");
    
    try {
        // Try multiple email fields since Google auth may store email differently
        let userDoc = null;
        
        // Try 'email' field first
        let snap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!snap.empty) userDoc = snap.docs[0];
        
        // Fallback: try 'googleEmail' field
        if (!userDoc) {
            snap = await db.collection('users').where('googleEmail', '==', email).limit(1).get();
            if (!snap.empty) userDoc = snap.docs[0];
        }
        
        // Fallback: try case-insensitive by iterating (last resort)
        if (!userDoc) {
            snap = await db.collection('users').where('email', '==', email.toUpperCase()).limit(1).get();
            if (!snap.empty) userDoc = snap.docs[0];
        }
        
        if (!userDoc) {
            return alert("عذراً، لم يتم العثور على مستخدم بهذا البريد الإلكتروني.\n\nتأكد من:\n1. أن المستخدم قد سجّل الدخول للموقع مرة واحدة على الأقل.\n2. أن البريد الإلكتروني مكتوب بشكل صحيح.");
        }
        
        await db.collection('users').doc(userDoc.id).update({
            isMerchant: true,
            merchantEmail: email,
            merchantSince: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert(`✅ تم منح صلاحية التاجر لـ ${email} بنجاح!\n\nيجب على التاجر إعادة تحميل الصفحة لتظهر له أيقونة المتجر.`);
        document.getElementById('merchantEmailInput').value = '';
        openManageMerchantsModal(); // Refresh list
    } catch (err) {
        alert("حدث خطأ: " + err.message);
    }
};

window.revokeMerchantRole = async (uid, email) => {
    if (!confirm(`هل أنت متأكد من سحب صلاحية التاجر من ${email}؟`)) return;
    
    try {
        await db.collection('users').doc(uid).update({
            isMerchant: firebase.firestore.FieldValue.delete()
        });
        alert("✅ تم سحب الصلاحية بنجاح");
        openManageMerchantsModal(); // Refresh list
    } catch (err) {
        alert("حدث خطأ: " + err.message);
    }
};
window.openMyStoreView = async () => {
    const user = auth.currentUser;
    if (!user) return showToast("يجب تسجيل الدخول أولاً", "error");
    
    try {
        const snap = await db.collection('merchants').where('ownerUid', '==', user.uid).limit(1).get();
        if (snap.empty) {
            showToast("⚠️ يرجى تأسيس متجرك أولاً", "warning");
            openCreateStoreModal();
        } else {
            openStoreMenu(snap.docs[0].id);
        }
    } catch (e) {
        console.error(e);
        showToast("خطأ أثناء فتح المتجر", "error");
    }
};

window.openMerchantRewards = () => {
    const modal = document.getElementById('merchantRewardsModal');
    if (modal) modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
};

// Initial data load
loadMerchants();

// --- Helper: Multi-Cover Preview ---
window.handleMultiCoverPreview = (input) => {
    const grid = document.getElementById('storeCoverPreviewGrid');
    if (!grid) return;
    
    if (!window.pendingStoreCovers) window.pendingStoreCovers = [];
    
    const newFiles = Array.from(input.files);
    newFiles.forEach(file => {
        if (window.pendingStoreCovers.length < 5) {
            window.pendingStoreCovers.push({ type: 'file', data: file });
        }
    });

    input.value = '';
    renderCoverPreviews();
};

window.removePendingCover = (index) => {
    if (window.pendingStoreCovers) {
        window.pendingStoreCovers.splice(index, 1);
        renderCoverPreviews();
    }
};

function renderCoverPreviews() {
    const grid = document.getElementById('storeCoverPreviewGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    const items = window.pendingStoreCovers || [];
    
    if (items.length === 0) {
        grid.style.display = 'none';
        return;
    }
    
    grid.style.display = 'flex';
    items.forEach((item, idx) => {
        const container = document.createElement('div');
        container.style.cssText = 'position: relative; width: 70px; height: 70px; border-radius: 14px; overflow: hidden; border: 2px solid #f1f5f9; box-shadow: 0 4px 10px rgba(0,0,0,0.05); transition: transform 0.2s;';
        container.className = 'preview-item';
        
        const img = document.createElement('img');
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        
        if (item.type === 'file') {
            const reader = new FileReader();
            reader.onload = e => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(item.data);
        } else {
            img.src = item.data; // It's already a URL/Base64 string
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '✕';
        deleteBtn.style.cssText = 'position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; background: rgba(0,0,0,0.6); color: white; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 5;';
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.removePendingCover(idx);
        };
        
        container.appendChild(img);
        container.appendChild(deleteBtn);
        grid.appendChild(container);
    });
}

// --- Helper: Slideshow Navigation ---
window.slideshowMove = (dir, manual = false, trackId = 'slideshowTrack') => {
    const track = document.getElementById(trackId);
    if (!track) return;
    
    if (manual && slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = setInterval(() => window.slideshowMove(1, false, trackId), 7000);
    }

    let index = parseInt(track.dataset.currentIndex || 0);
    let total = parseInt(track.dataset.totalSlides || 1);
    
    index = (index + dir + total) % total;
    window.slideshowTo(index, false, trackId);
};

window.slideshowTo = (index, manual = false, trackId = 'slideshowTrack') => {
    const track = document.getElementById(trackId);
    if (!track) return;

    if (manual && slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = setInterval(() => window.slideshowMove(1, false, trackId), 7000);
    }
    
    track.dataset.currentIndex = index;
    track.style.transform = `translateX(-${index * 100}%)`;

    // Try to sync with Modal track if this is the main one
    if (trackId === 'slideshowTrack') {
        const modalTrack = document.getElementById('slideshowTrackModal');
        if (modalTrack) {
            modalTrack.dataset.currentIndex = index;
            modalTrack.style.transform = `translateX(-${index * 100}%)`;
        }
    } else if (trackId === 'slideshowTrackModal') {
        const mainTrack = document.getElementById('slideshowTrack');
        if (mainTrack) {
            mainTrack.dataset.currentIndex = index;
            mainTrack.style.transform = `translateX(-${index * 100}%)`;
        }
    }
    
    // Update dots for both main and modal containers
    const dotsContainers = ['slideshowDots', 'slideshowDotsModal'];
    dotsContainers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            const dots = container.querySelectorAll('.slideshow-dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        }
    });
};


// --- Special Offers Logic ---
async function loadSpecialOffers() {
    const container = document.getElementById('offersCardsContainer');
    if (!container) return;
    
    try {
        const snap = await db.collection('offers').orderBy('createdAt', 'desc').limit(5).get();
        const section = document.getElementById('specialOffersSection');
        if (snap.empty) {
            if (section) section.style.display = 'none';
            return;
        }
        
        if (section) section.style.display = 'block';
        container.innerHTML = '';
        
        snap.forEach(doc => {
            const offer = doc.data();
            const card = document.createElement('div');
            card.className = 'offer-card-item fade-in';
            card.style.cssText = `
                min-width: 280px;
                height: 160px;
                border-radius: 22px;
                background: ${offer.theme === 'dark' ? '#0f172a' : 'linear-gradient(135deg, #ff6b00, #ff8c00)'};
                color: white;
                padding: 20px;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                position: relative;
                overflow: hidden;
                box-shadow: 0 12px 25px rgba(0,0,0,0.12);
                scroll-snap-align: start;
                cursor: pointer;
                border: 1px solid rgba(255,255,255,0.1);
            `;
            
            if (offer.actionLink && offer.actionLink.startsWith('http')) {
                card.onclick = () => window.open(offer.actionLink, '_blank');
            } else if (offer.actionLink && offer.actionLink !== '') {
                card.onclick = () => {
                    if (typeof openStoreMenu === 'function') openStoreMenu(offer.actionLink);
                };
            } else {
                card.onclick = () => console.log('No action linked');
            }

            card.innerHTML = `
                ${offer.image ? `<img src="${offer.image}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">` : ''}
                <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, transparent 100%); z-index: 1;"></div>
                <div style="position: relative; z-index: 2; width: 100%;">
                    <h4 style="margin: 0; font-size: 1.2rem; font-weight: 1000; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${offer.title}</h4>
                    <p style="margin: 4px 0 12px; font-size: 0.85rem; opacity: 0.95; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,0.3); line-height: 1.4;">${offer.subtitle}</p>
                    ${offer.actionText ? `
                        <div style="display: flex; justify-content: flex-end;">
                            <span style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: white; padding: 6px 16px; border-radius: 12px; font-size: 0.75rem; font-weight: 1000; border: 1.5px solid rgba(255,255,255,0.3);">
                                ${offer.actionText}
                            </span>
                        </div>
                    ` : ''}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Error loading special offers:", err);
    }
}

// --- Shopping Lists UI Logic ---
window.myShoppingLists = JSON.parse(localStorage.getItem('masoudi_shopping_lists')) || [];

window.saveShoppingLists = () => {
    localStorage.setItem('masoudi_shopping_lists', JSON.stringify(window.myShoppingLists));
};

window.renderShoppingLists = () => {
    const container = document.getElementById('shoppingListsContainer');
    const emptyView = document.getElementById('emptyListsView');
    
    if(!container) return;
    
    if(window.myShoppingLists.length === 0) {
        container.style.display = 'none';
        if(emptyView) emptyView.style.display = 'block';
    } else {
        container.style.display = 'flex';
        if(emptyView) emptyView.style.display = 'none';
        
        container.innerHTML = '';
        window.myShoppingLists.forEach(list => {
            const dateStr = list.updatedAt ? new Date(list.updatedAt).toLocaleDateString('ar-EG', {month: 'short', day: 'numeric'}) : 'اليوم';
            const card = document.createElement('div');
            card.style.cssText = 'background: white; border-radius: 28px; padding: 22px; box-shadow: 0 15px 35px rgba(0,0,0,0.03); border: 1.5px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; transition: all 0.3s; cursor: pointer;';
            card.onmouseover = () => { card.style.borderColor='var(--primary)'; card.style.transform='translateY(-3px)'; };
            card.onmouseout = () => { card.style.borderColor='#f1f5f9'; card.style.transform='translateY(0)'; };
            card.onclick = () => window.openShoppingList(list.id);
            
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="background: #fff7ed; width: 55px; height: 55px; border-radius: 18px; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                        <i data-lucide="list-todo" style="width: 28px;"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0 0 6px; font-size: 1.1rem; font-weight: 900; color: #1e293b; font-family: 'Cairo', sans-serif;">${list.name}</h3>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="background: #f1f5f9; color: #64748b; padding: 4px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 800;">تتضمن ${list.items.length} منتجات</span>
                            <span style="color: #cbd5e1; font-size: 0.8rem;">•</span>
                            <span style="color: #94a3b8; font-size: 0.75rem; font-weight: 700;">تحديث ${dateStr}</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="event.stopPropagation(); window.deleteShoppingList('${list.id}')" style="background: #fef2f2; border: 1px solid #fee2e2; width: 38px; height: 38px; border-radius: 12px; cursor: pointer; color: #ef4444; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                        <i data-lucide="trash-2" style="width: 18px;"></i>
                    </button>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; width: 38px; height: 38px; border-radius: 12px; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                        <i data-lucide="chevron-left" style="width: 20px;"></i>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
        if(window.lucide) lucide.createIcons();
    }
};

window.showCreateListModal = () => {
    const modal = document.getElementById('createListModal');
    if (modal) modal.style.display = 'flex';
};

window.handleCreateListSubmit = () => {
    const input = document.getElementById('newListNameInput');
    if(input && input.value.trim() !== '') {
        const newList = {
            id: 'list_' + Date.now(),
            name: input.value.trim(),
            items: [],
            updatedAt: new Date().toISOString()
        };
        window.myShoppingLists.push(newList);
        window.saveShoppingLists();
        window.renderShoppingLists();
        document.getElementById('createListModal').style.display = 'none';
        input.value = '';
        if(window.showToast) window.showToast("تم إنشاء القائمة بنجاح! 🎉");
        
        if(window.currentAddToListProductId) {
            window.openAddToListModal(window.currentAddToListProductId);
        }
    } else {
        if(window.showToast) window.showToast("يرجى إدخال اسم القائمة أولاً", "error");
        else alert("يرجى إدخال اسم القائمة أولاً");
    }
};

window.deleteShoppingList = (listId) => {
    if(confirm("هل أنت متأكد من حذف هذه القائمة بصورة نهائية؟")) {
        window.myShoppingLists = window.myShoppingLists.filter(l => l.id !== listId);
        window.saveShoppingLists();
        window.renderShoppingLists();
    }
};

window.openShoppingList = (listId) => {
    const list = window.myShoppingLists.find(l => l.id === listId);
    if(list) {
        alert("تفاصيل القائمة (" + list.name + "):\\nتحتوي على " + list.items.length + " منتجات.\\n\\nسيتم عرض خيارات ومحتويات القائمة في تحديثات النظام القادمة!");
    }
};

window.currentAddToListProductId = null;
window.openAddToListModal = (productId) => {
    window.currentAddToListProductId = productId;
    const modal = document.getElementById('addToListModal');
    const selector = document.getElementById('modalListsSelector');
    if(modal && selector) {
        selector.innerHTML = '';
        if (window.myShoppingLists.length === 0) {
            selector.innerHTML = '<p style="text-align: center; color: #64748b; font-size: 0.85rem; padding: 20px;">لا يوجد لديك قوائم حالياً.</p>';
        } else {
            window.myShoppingLists.forEach(list => {
                const isSelected = list.items.includes(productId);
                const li = document.createElement('div');
                li.style.cssText = 'padding: 12px 15px; border-radius: 12px; border: 1.5px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s; background: ' + (isSelected ? '#f0fdf4' : 'white') + '; border-color: ' + (isSelected ? '#10b981' : '#e2e8f0');
                li.onclick = () => window.toggleItemInList(list.id, productId, li);
                li.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i data-lucide="list" style="width: 18px; color: ${isSelected ? '#10b981' : '#64748b'};"></i>
                        <span style="font-weight: 800; color: ${isSelected ? '#10b981' : '#1e293b'};">${list.name}</span>
                    </div>
                    ${isSelected ? '<i data-lucide="check" style="width: 18px; color: #10b981;"></i>' : ''}
                `;
                selector.appendChild(li);
            });
            if(window.lucide) lucide.createIcons();
        }
        modal.style.display = 'flex';
    }
};

window.toggleItemInList = (listId, productId, element) => {
    const list = window.myShoppingLists ? window.myShoppingLists.find(l => l.id === listId) : null;
    if(list) {
        const itemIndex = list.items.indexOf(productId);
        if(itemIndex === -1) {
            list.items.push(productId);
            if(window.showToast) window.showToast("تمت اضافة المنتج للقائمة!");
        } else {
            list.items.splice(itemIndex, 1);
            if(window.showToast) window.showToast("تمت ازالة المنتج من القائمة");
        }
        list.updatedAt = new Date().toISOString();
        if (typeof window.saveShoppingLists === 'function') window.saveShoppingLists();
        if (typeof window.renderShoppingLists === 'function') window.renderShoppingLists();
    }
};
// --- Merchant Onboarding & Registration Functions ---
window.updateMerchantButtonUI = function(status) {
    const createBtn = document.getElementById('createStoreBtn');
    const merchantBtn = document.getElementById('merchantEntryBtn');
    const textEl = document.getElementById('createStoreText');
    const subtextEl = document.getElementById('createStoreSubtext');

    if (status === 'approved' || status === true) {
        if (createBtn) createBtn.style.display = 'none';
        if (merchantBtn) merchantBtn.style.display = 'flex';
    } else if (status === 'pending') {
        if (merchantBtn) merchantBtn.style.display = 'none';
        if (createBtn) {
            createBtn.style.display = 'flex';
            if (textEl) textEl.textContent = 'طلب متجرك قيد المراجعة ⏳';
            if (subtextEl) subtextEl.textContent = 'يقوم آدمن الموقع بمراجعة طلبك حالياً للتفعيل';
        }
    } else {
        if (merchantBtn) merchantBtn.style.display = 'none';
        if (createBtn) {
            createBtn.style.display = 'flex';
            if (textEl) textEl.textContent = 'أنشئ متجرك الآن 🏪';
            if (subtextEl) subtextEl.textContent = 'قدّم طلب انضمام كتاجر وابدأ البيع';
        }
    }
};

window.openCreateStoreModal = async function() {
    const user = getCurrentUser();
    if (!user) {
        alert("يرجى تسجيل الدخول أولاً كعميل لتقديم طلب إنشاء متجر");
        return;
    }
    
    // Check if user has a pending merchant request
    let isPending = false;
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().merchantStatus === 'pending') {
            isPending = true;
        }
    } catch(e) { console.warn("Check user merchant status error:", e); }

    const form = document.getElementById('createStoreForm');
    const pendingView = document.getElementById('createStorePendingView');

    if (isPending) {
        if (form) form.style.display = 'none';
        if (pendingView) pendingView.style.display = 'block';
    } else {
        if (form) form.style.display = 'block';
        if (pendingView) pendingView.style.display = 'none';
        
        // Load categories for selector
        await loadStoreCategories();

        // Auto fill available user details
        const ownerInput = document.getElementById('storeOwnerInput');
        const phoneInput = document.getElementById('storePhoneInput');
        if (ownerInput && user.displayName && !ownerInput.value) ownerInput.value = user.displayName;
        if (phoneInput && user.phoneNumber && !phoneInput.value) phoneInput.value = user.phoneNumber;
    }

    const modal = document.getElementById('createStoreModal');
    if (modal) modal.style.display = 'flex';
};

window.submitMerchantApplication = async function(e) {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) {
        alert("يرجى تسجيل الدخول أولاً");
        return;
    }

    const storeName = document.getElementById('storeNameInput')?.value.trim() || '';
    const ownerName = document.getElementById('storeOwnerInput')?.value.trim() || '';
    const phone = document.getElementById('storePhoneInput')?.value.trim() || '';
    const categorySelect = document.getElementById('storeCategoryInput');
    const category = categorySelect ? categorySelect.value : 'supermarket';
    const desc = document.getElementById('storeDescInput')?.value.trim() || '';

    if (!storeName || !ownerName || !phone) {
        alert("يرجى إدخال كافة البيانات الأساسية المطلوبة");
        return;
    }

    if (!category) {
        alert("يرجى اختيار نوع النشاط التجاري لمتجرك");
        return;
    }

    const submitBtn = document.getElementById('submitStoreBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'جاري إرسال الطلب... ⌛';
    }

    try {
        const merchantData = {
            userId: user.uid,
            storeName: storeName,
            name: storeName,
            ownerName: ownerName,
            phone: phone,
            category: category,
            description: desc,
            email: user.email || '',
            photo: user.photoURL || '',
            status: 'pending',
            isApproved: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Save in merchants collection
        await db.collection('merchants').doc(user.uid).set(merchantData, { merge: true });

        // Update user doc
        await db.collection('users').doc(user.uid).set({
            merchantStatus: 'pending',
            merchantStoreName: storeName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Show pending view inside modal
        const form = document.getElementById('createStoreForm');
        const pendingView = document.getElementById('createStorePendingView');
        if (form) form.style.display = 'none';
        if (pendingView) pendingView.style.display = 'block';

        if (typeof window.showToast === 'function') {
            window.showToast("🎉 تم إرسال طلب إنشاء متجرك بنجاح! سيتم مراجعة الطلب من الإدارة والموافقة عليه.");
        } else {
            alert("🎉 تم إرسال طلب إنشاء متجرك بنجاح! سيتم مراجعة الطلب من الإدارة والموافقة عليه.");
        }
        
        updateMerchantButtonUI('pending');
    } catch (err) {
        console.error("Submit merchant application error:", err);
        alert("فشل إرسال الطلب: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'إرسال طلب الانضمام كتاجر 🏁';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.renderShoppingLists();
    }, 500);
});

// End of script

