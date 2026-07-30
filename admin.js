// Firebase Admin Logic
const firebaseConfig = {
    apiKey: "AIzaSyAz3dYVqV10k7SMtuZIjNhFvaviocEbiQ0",
    authDomain: "masoudi-drive.firebaseapp.com",
    projectId: "masoudi-drive",
    storageBucket: "masoudi-drive.firebasestorage.app",
    messagingSenderId: "1071702393539",
    appId: "1:1071702393539:web:85f6e93b520fa7e1a91876",
    measurementId: "G-5BE1PJ39PL"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Set Auth Persistence to LOCAL for session retention
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(err => console.error("Persistence Error:", err));
const storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;
const provider = new firebase.auth.GoogleAuthProvider();

// --- Google Identity Services (GSI) Integration ---
const GOOGLE_CLIENT_ID = "1071702393539-5qad3k1165ou5mae3kpshgeultejrssr.apps.googleusercontent.com";

window.handleCredentialResponse = (response) => {
    const credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
    auth.signInWithCredential(credential)
        .then(() => {
            console.log("GSI Admin Login Success");
            localStorage.setItem('masoudi_has_session', 'true'); // Sync with main app persistence
            const overlay = document.getElementById('authOverlay');
            if (overlay) overlay.remove();
        })
        .catch(err => {
            console.error("GSI Admin Login Error:", err);
            alert("خطأ في تسجيل الدخول عبر جوجل");
        });
};

function initGSI() {
    if (typeof google === 'undefined') {
        setTimeout(initGSI, 500);
        return;
    }
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: window.handleCredentialResponse,
        auto_select: true
    });
    
    // Attempt rendering if container exists (e.g., after showLoginScreen)
    renderGSIButton();
}

function renderGSIButton() {
    const btnCont = document.getElementById("g_id_signin");
    if (btnCont && typeof google !== 'undefined') {
        google.accounts.id.renderButton(btnCont, {
            theme: "outline",
            size: "large",
            width: "100%",
            text: "signin_with",
            shape: "pill",
            logo_alignment: "left"
        });
    }
}

// Watch for DOM changes to render button when login screen appears
const observer = new MutationObserver((mutations) => {
    if (document.getElementById("g_id_signin")) {
        renderGSIButton();
    }
});
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('load', initGSI);

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('masoudi_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

window.toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('masoudi_theme', target);
    updateThemeIcon(target);
};

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    if (theme === 'dark') {
        icon.setAttribute('data-lucide', 'sun');
    } else {
        icon.setAttribute('data-lucide', 'moon');
    }
    if (window.lucide) lucide.createIcons();
}

// Global Error Handling for Debugging
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errorMsg = `[JS Error] ${msg} at ${url}:${lineNo}:${columnNo}`;
    console.error(errorMsg, error);
    if (typeof reportAuthError === 'function') {
        reportAuthError("حدث خطأ في النظام", error || { message: errorMsg });
    } else {
        alert(errorMsg);
    }
    return false;
};

initTheme();

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: #1E293B; color: white; padding: 12px 24px; border-radius: 12px;
        font-weight: 800; font-size: 0.85rem; z-index: 100000; animation: fadeInUp 0.3s ease;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

window.shareOrderImage = async (url, customerName, orderId, phone) => {
    try {
        // Prepare professional message
        const msg = `مرحباً ${customerName}، بخصوص طلبك رقم #${orderId} في متجر مسعودي. يرجى مراجعة إيصال الدفع المرفق.`;
        
        // Sanitize phone number (remove leading zero if it exists, remove non-digits)
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
        if (!cleanPhone.startsWith('2')) cleanPhone = '2' + cleanPhone;

        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `receipt-${orderId}.jpg`, { type: blob.type });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: `إيصال الطلب #${orderId}`,
                text: msg
            });
        } else {
            // Fallback for desktop: Open WhatsApp with the specific phone number
            const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg + "\nرابط الصورة: " + url)}`;
            window.open(whatsappUrl, '_blank');
        }
    } catch (err) {
        console.error("Share failed:", err);
        const fallbackMsg = `مرحباً ${customerName}، بخصوص طلبك رقم #${orderId}. يرجى مراجعة الإيصال: ${url}`;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(fallbackMsg)}`, '_blank');
    }
};

window.openImagePreview = (url, title = 'معاينة الصورة') => {
    if (!url) return;
    const modal = document.createElement('div');
    modal.id = 'premiumImagePreview';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.95); z-index: 999999; display: flex;
        flex-direction: column; align-items: center; justify-content: center;
        padding: 20px; animation: fadeIn 0.3s ease; backdrop-filter: blur(15px);
    `;
    modal.innerHTML = `
        <div style="width: 100%; max-width: 900px; position: relative; display: flex; flex-direction: column; gap: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; color: white;">
                <h3 style="margin: 0; font-weight: 900; font-size: 1.2rem;">${title}</h3>
                <button onclick="document.getElementById('premiumImagePreview').remove()" style="background: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; color: #0F172A; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px rgba(0,0,0,0.2);">✕</button>
            </div>
            <div style="position: relative; border-radius: 25px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.5); background: #000;">
                <img src="${url}" style="width: 100%; max-height: 75vh; object-fit: contain; display: block;">
            </div>
            <div style="text-align: center; display: flex; gap: 15px; justify-content: center;">
                <a href="${url}" download target="_blank" style="background: var(--primary); color: white; text-decoration: none; padding: 15px 35px; border-radius: 18px; font-weight: 900; font-size: 0.9rem; box-shadow: 0 10px 20px rgba(255,107,0,0.3);">حفظ الصورة</a>
                <button onclick="document.getElementById('premiumImagePreview').remove()" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 15px 35px; border-radius: 18px; font-weight: 800; cursor: pointer;">إغلاق</button>
            </div>
        </div>
    `;
    
    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    document.body.appendChild(modal);
};

function updatePremiumStats() {
    if (!window.allOrders) return;
    const stats = {
        pending: window.allOrders.filter(o => o.status === 'pending').length,
        processing: window.allOrders.filter(o => o.status === 'processing').length,
        shipped: window.allOrders.filter(o => o.status === 'shipped').length,
        completed: window.allOrders.filter(o => o.status === 'completed' || o.status === 'archived_received').length
    };
    if (document.getElementById('count-pending')) document.getElementById('count-pending').textContent = stats.pending;
    if (document.getElementById('count-processing')) document.getElementById('count-processing').textContent = stats.processing;
    if (document.getElementById('count-shipped')) document.getElementById('count-shipped').textContent = stats.shipped;
    if (document.getElementById('count-completed')) document.getElementById('count-completed').textContent = stats.completed;
}

// --- ROBUST AUTH & SECURITY SYSTEM ---
const ADMIN_EMAIL = "engyhamid860@gmail.com".toLowerCase();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

function updateDebug(msg) {
    console.log(`[AUTH] ${msg}`);
}

function reportAuthError(msg, err) {
    console.error(`ERR: ${msg}`, err);
    // Explicitly handle account not registered
    if (msg.includes("غير مسجل كمسئول")) {
        showLoginScreen(msg + "<br><span style='font-size:0.8rem; color:#f87171; font-weight:700;'>" + (err ? err.message : '') + "</span><br>يرجى التأكد من تسجيل الدخول بحساب الـ Gmail الصحيح.");
        return;
    }
    // Only show critical alert if it's not a background initialization error
    if (msg.includes("فشل الدخول") || msg.includes("Gmail")) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'authErrorOverlay';
        errorDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; background:#ef4444; color:white; padding:15px; text-align:center; z-index:999999; font-weight:bold; font-family:Cairo;';
        errorDiv.innerHTML = `⚠️ ${msg}: ${err ? err.message : 'Unknown'} <br> <button onclick="location.reload()" style="background:white; color:#ef4444; border:none; padding:5px 15px; border-radius:5px; margin-top:10px;">إعادة محاولة 🔄</button>`;
        document.body.appendChild(errorDiv);
    }
}

auth.getRedirectResult().then(r => {
    if(r && r.user) updateDebug(`Login success: ${r.user.email}`);
}).catch(e => reportAuthError("فشل الدخول", e));

auth.onAuthStateChanged(async (user) => {
    // 1. Clear any existing auth overlays
    const overlays = ['authOverlay', 'bioVaultOverlay', 'authErrorOverlay'];
    overlays.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    if (!user) {
        showLoginScreen();
        return;
    }

    const userEmail = (user.email || "").toLowerCase();
    if (!userEmail) {
        reportAuthError("لم نتمكن من الحصول على بريد Gmail الخاص بك.", null);
        return;
    }

    try {
        // Show main container if it was hidden
        const mainCont = document.querySelector('.admin-container') || document.getElementById('admin-container');
        if (mainCont) mainCont.style.display = 'block';

        if (userEmail === ADMIN_EMAIL) {
            // Initialize Dashboard (Background)
            await initDashboardUI(user, { role: 'super_admin', name: "المدير المسئول" });
            return;
        }

        // --- Handle Other Admins ---
        const adminDoc = await db.collection('admins').doc(userEmail).get();
        if (!adminDoc.exists) {
            reportAuthError("عذراً، هذا الحساب غير مسجل كمسئول.", { message: `Email: ${userEmail}` });
            auth.signOut();
            return;
        }

        const adminData = adminDoc.data();
        if (adminData.status === 'blocked') {
            reportAuthError("هذا الحساب محظور من الوصول.", null);
            auth.signOut();
            return;
        }

        await initDashboardUI(user, adminData);

    } catch (err) {
        console.error("Auth Listener Critical Error:", err);
        reportAuthError("فشل في تهيئة نظام التحقق", err);
    }
});

async function initDashboardUI(user, adminData) {
    // Update Profile Info
    const nameEl = document.getElementById("adminName");
    const dropdownNameEl = document.getElementById("dropdownAdminName");
    const dropdownEmailEl = document.getElementById("dropdownAdminEmail");
    const imgEl = document.getElementById("adminImg");

    if(nameEl) nameEl.textContent = user.displayName || adminData.name || "مشرف";
    if(dropdownNameEl) dropdownNameEl.textContent = user.displayName || adminData.name || "مشرف";
    if(dropdownEmailEl) dropdownEmailEl.textContent = user.email;
    if(imgEl) imgEl.src = user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'Admin'}&background=FF6B00&color=fff`;

    // Apply Permissions & Load Content
    await loadPermissionsRegistry();
    applyRolePermissions(adminData);
    
    // Page Detection & Loading
    if (document.getElementById('totalSales')) loadStats();
    if (document.getElementById('adminProductsList')) loadProducts();
    if (document.getElementById('adminOrdersList')) loadOrders();
    if (document.getElementById('adminCustomersList')) loadCustomers();
    if (document.getElementById('adminDriversList')) loadDrivers();
    if (document.getElementById('adminUsersList')) {
        renderPermissionsGrid();
        loadAdmins();
    }
    if (document.getElementById('siteConfigForm')) loadSiteConfig();
    if (document.getElementById('sliderSettingsForm')) {
        loadAdvancedSettings();
        loadCategoriesAdmin();
        loadLoyaltyConfig();
    }

    setupOrderNotifications();
    
    // Premium Analytics Integration
    if (document.getElementById('salesChart')) {
        initDashboardCharts();
    }
}

let dashboardChart = null;
function initDashboardCharts() {
    const ctx = document.getElementById('salesChart').getContext('2d');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(255, 107, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 107, 0, 0)');

    dashboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
            datasets: [{
                label: 'المبيعات اليومية',
                data: [0, 0, 0, 0, 0, 0, 0],
                borderColor: '#FF6B00',
                borderWidth: 4,
                fill: true,
                backgroundColor: gradient,
                tension: 0.4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#FF6B00',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                    ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'Cairo' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'Cairo' } }
                }
            }
        }
    });
}

function injectNotificationStyles() {
    if (document.getElementById('notifStyles')) return;
    const style = document.createElement('style');
    style.id = 'notifStyles';
    style.innerHTML = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoomIn { 
            from { opacity: 0; transform: scale(0.85) translateY(30px); } 
            to { opacity: 1; transform: scale(1) translateY(0); } 
        }
        @keyframes bellRing {
            0% { transform: rotate(0); }
            10% { transform: rotate(15deg); }
            20% { transform: rotate(-15deg); }
            30% { transform: rotate(10deg); }
            40% { transform: rotate(-10deg); }
            50% { transform: rotate(0); }
            100% { transform: rotate(0); }
        }
        .premium-bell-btn {
            background: white;
            color: #1e293b;
            border: 1px solid #e2e8f0;
            padding: 8px 18px;
            border-radius: 14px;
            font-size: 0.85rem;
            font-weight: 800;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .premium-bell-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.15);
            border-color: var(--primary);
            color: var(--primary);
        }
        .premium-bell-btn:hover .bell-icon {
            animation: bellRing 1s ease infinite;
        }
        .bell-container { position: relative; display: flex; align-items: center; }
        .bell-dot {
            position: absolute; top: -2px; right: -2px;
            width: 8px; height: 8px; background: #ef4444;
            border-radius: 50%; border: 2px solid white;
        }
        .btn-premium-action {
            width: 38px; height: 38px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 12px; border: 1px solid #e2e8f0;
            background: white; color: #64748b;
            cursor: pointer; transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .btn-premium-action:hover {
            background: white;
            transform: translateY(-3px) scale(1.05);
            color: var(--primary);
            border-color: var(--primary)33;
            box-shadow: 0 8px 15px rgba(0,0,0,0.1);
        }
        .order-row:hover { background: #fdfaf7 !important; }
    `;
    document.head.appendChild(style);
}

function showNotificationDot() {
    const dot = document.querySelector('.bell-dot');
    if (dot) {
        dot.style.display = 'block';
        dot.style.animation = 'pulse 1s infinite';
    }
}

window.clearNotifDot = () => {
    const dot = document.querySelector('.bell-dot');
    if (dot) dot.style.display = 'none';
};

window.toggleUserDropdown = () => {
    const dd = document.getElementById('userDropdown');
    if (dd) dd.classList.toggle('active');
};

window.logoutAdmin = async () => {
    if (confirm("هل أنت متأكد من تسجيل الخروج؟")) {
        try {
            localStorage.removeItem('masoudi_has_session'); // Clear persistence flag
            await firebase.auth().signOut();
            window.location.href = 'index.html'; 
        } catch (err) { alert(err.message); }
    }
};

// Close dropdowns on click outside
window.addEventListener('click', (e) => {
    if (!e.target.closest('.admin-user-container')) {
        const dd = document.getElementById('userDropdown');
        if (dd) dd.classList.remove('active');
    }
    if (!e.target.closest('.premium-bell-btn') && !e.target.closest('.notif-dropdown')) {
        const dd = document.getElementById('notifDropdown');
        if (dd) dd.classList.remove('active');
    }
});

window.toggleNotifDropdown = () => {
    const dd = document.getElementById('notifDropdown');
    if (!dd) return;
    dd.classList.toggle('active');
    if (dd.classList.contains('active')) {
        updateNotifDropdownUI();
    }
};

function updateNotifDropdownUI() {
    const list = document.getElementById('notifList');
    if (!list) return;

    // Filter unread pending orders
    const recent = window.allOrders.filter(o => o.status === 'pending' && !o.isRead).slice(0, 10);

    if (recent.length === 0) {
        list.innerHTML = '<div style="padding: 30px; text-align: center; color: #94A3B8; font-size: 0.8rem;">لا يوجد تنبيهات جديدة غير مقروءة</div>';
        return;
    }

    list.innerHTML = recent.map(o => `
        <div class="notif-item" onclick="markOrderAsRead('${o.id}'); openOrderPanel('${o.id}'); toggleNotifDropdown();">
            <img src="${o.userPhoto || 'https://ui-avatars.com/api/?name=U'}" alt="U">
            <div style="flex: 1;">
                <div class="notif-title">طلب جديد من ${o.customer}</div>
                <div class="notif-time">المبلغ: ${o.total} ج.م</div>
            </div>
            <i data-lucide="chevron-left" style="width: 14px; color: #CBD5E1;"></i>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- Feature: Dynamic Page & Permission Registry ---
const CORE_PAGES = {
    'admin.html': { id: 'dashboard', label: 'الإحصائيات' },
    'admin-products.html': { id: 'products', label: 'المنتجات' },
    'admin-orders.html': { id: 'orders', label: 'الطلبات' },
    'admin-customers.html': { id: 'customers', label: 'العملاء' },
    'admin-users.html': { id: 'permissions', label: 'الصلاحيات' },
    'admin-settings.html': { id: 'settings', label: 'الإعدادات' },
    'admin-merchant-products.html': { id: 'merchant_products', label: 'منتجات التجار' },
    'admin-recharge.html': { id: 'recharge', label: 'طلبات الشحن' },
    'admin-drivers.html': { id: 'drivers', label: 'المندوبين' }
};

window.customPages = {};

async function loadPermissionsRegistry() {
    const grid = document.getElementById('permissionsGrid');
    if (!grid) return;

    try {
        // Fetch custom pages from Firestore
        const snap = await db.collection('adminPages').get();
        window.customPages = {};
        snap.forEach(doc => {
            const data = doc.data();
            window.customPages[data.file] = { id: data.id, label: data.label };
        });

        renderPermissionsGrid();
    } catch (err) { console.error("Registry Load Error:", err); renderPermissionsGrid(); }
}

function renderPermissionsGrid() {
    const grid = document.getElementById('permissionsGrid');
    if (!grid) return;

    const allPages = { ...CORE_PAGES, ...window.customPages };
    grid.innerHTML = Object.values(allPages).map(p => `
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; transition: all 0.2s;">
            <input type="checkbox" value="${p.id}" class="perm-check" style="accent-color: var(--primary); width: 18px; height: 18px;">
            <span style="font-weight: 800; font-size: 0.85rem; color: #475569;">${p.label}</span>
        </label>
    `).join('');
}

window.openNewPageModal = () => {
    document.getElementById('newPageModal').style.display = 'flex';
    lucide.createIcons();
};

window.closeNewPageModal = () => {
    document.getElementById('newPageModal').style.display = 'none';
};

window.saveNewPageRegistration = async () => {
    const label = document.getElementById('newPageLabel').value.trim();
    const file = document.getElementById('newPageFile').value.trim();
    const id = document.getElementById('newPageId').value.trim();

    if (!label || !file || !id) return alert("يرجى ملء كافة الخانات");

    try {
        await db.collection('adminPages').doc(id).set({
            label: label,
            file: file,
            id: id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast("✅ تم تسجيل الصفحة بنجاح");
        closeNewPageModal();
        loadPermissionsRegistry(); // Reload grid
    } catch (err) { alert(err.message); }
};

function applyRolePermissions(adminData) {
    if (!adminData) return;
    
    // Normalize current page name
    const rawPath = window.location.pathname.split('/').pop() || 'admin.html';
    const currentPage = rawPath.replace('.html', '') + '.html';
    
    const perms = adminData.permissions || [];
    const role = adminData.role;
    const userEmail = (auth.currentUser && auth.currentUser.email) ? auth.currentUser.email.toLowerCase() : '';

    if (role === 'super_admin' || userEmail === ADMIN_EMAIL) return;

    // Build dynamic map for checking
    const allPages = { ...CORE_PAGES, ...window.customPages };
    const pageToPerm = {};
    Object.keys(allPages).forEach(file => {
        pageToPerm[file] = allPages[file].id;
    });

    // 1. Page Access Guard
    if (pageToPerm[currentPage] && !perms.includes(pageToPerm[currentPage])) {
        const allowedPages = Object.keys(pageToPerm).filter(p => perms.includes(pageToPerm[p]));
        window.location.href = allowedPages.length > 0 ? allowedPages[0] : 'index.html';
        return;
    }

    // 2. Navigation Visibility
    const navLinks = document.querySelectorAll('.admin-nav a, .admin-bottom-nav a, .admin-sidebar nav a');
    navLinks.forEach(a => {
        let href = a.getAttribute('href');
        if (href) {
            const targetPage = href.split('/').pop().replace('.html', '') + '.html';
            if (pageToPerm[targetPage] && !perms.includes(pageToPerm[targetPage])) {
                a.style.display = 'none';
            }
        }
    });

    const bottomNav = document.querySelector('.admin-bottom-nav');
    if (bottomNav) {
        const visibleLinks = Array.from(bottomNav.querySelectorAll('a')).filter(a => a.style.display !== 'none');
        bottomNav.style.gridTemplateColumns = `repeat(${visibleLinks.length}, 1fr)`;
    }
}

// --- Dashboard Stats ---
async function loadStats() {
    try {
        const ordersSnap = await db.collection('orders').orderBy('createdAt', 'desc').get();
        const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        window.allOrders = orders;

        let totalSales = 0;
        let newOrders = 0;
        let countPending = 0, countProcessing = 0, countShipped = 0, countCompleted = 0;

        // Analytics Data calculation
        const dayTotals = [0, 0, 0, 0, 0, 0, 0];
        const now = new Date();
        
        orders.forEach(o => {
            const sale = parseFloat(o.total) || 0;
            totalSales += sale;
            
            if (o.status === 'pending') { newOrders++; countPending++; }
            else if (o.status === 'processing') countProcessing++;
            else if (o.status === 'shipped') countShipped++;
            else if (o.status === 'completed' || o.status === 'archived_received') countCompleted++;

            // Simple day calculation for Chart (Mocking real distribution for latest 100 orders if timestamp exists)
            if (o.createdAt) {
                const date = o.createdAt.toDate();
                const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
                if (diffDays < 7) {
                    const dayIdx = (6 - diffDays); // Latest 7 days
                    if(dayIdx >= 0) dayTotals[dayIdx] += sale;
                }
            }
        });

        // Update Chart
        if (dashboardChart) {
            dashboardChart.data.datasets[0].data = dayTotals;
            dashboardChart.update();
        }

        // Load previews
        renderDashboardPreviews(orders);

        const productsSnap = await db.collection('products').get();
        const customersSnap = await db.collection('users').get();
        const driversSnap = await db.collection('drivers').get();

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('totalSales', totalSales.toLocaleString('ar-EG') + ' ج.م');
        set('newOrders', newOrders);
        set('totalProducts', productsSnap.size);
        set('totalCustomers', customersSnap.size);
        set('totalDriversStat', driversSnap.size);

        syncProductSalesCounts();

    } catch (err) {
        console.error('loadStats Error:', err);
    }
}

function renderDashboardPreviews(orders) {
    // Recent Orders
    const recentBody = document.getElementById('recentOrdersBody');
    if (recentBody) {
        recentBody.innerHTML = orders.slice(0, 5).map(o => {
            const total = parseFloat(o.total) || 0;
            const status = o.status || 'pending';
            return `
            <tr>
                <td class="col-id" style="font-weight: 900; color: var(--primary);">#${o.orderNumber || o.id?.substring(0, 5) || '---'}</td>
                <td class="col-customer" style="font-weight: 800;" title="${o.customer || 'عميل مجهول'}">${o.customer || 'عميل مجهول'}</td>
                <td class="col-status"><span class="badge badge-${status}">${translateStatus(status)}</span></td>
                <td class="col-total" style="font-weight: 900;">${total.toLocaleString('ar-EG')} ج.م</td>
            </tr>
        `}).join('');
    }

    // Best Sellers (Mock based on salesCount)
    loadBestSellersPreview();
}

async function loadBestSellersPreview() {
    const list = document.getElementById('bestSellersList');
    if (!list) return;

    try {
        const snap = await db.collection('products').orderBy('salesCount', 'desc').limit(4).get();
        list.innerHTML = snap.docs.map(doc => {
            const p = doc.data();
            return `
                <div style="display: flex; align-items: center; gap: 15px; background: var(--bg-admin); padding: 12px; border-radius: 18px; border: 1px solid var(--glass-border);">
                    <img src="${p.image}" style="width: 50px; height: 50px; border-radius: 12px; object-fit: cover;">
                    <div style="flex: 1;">
                        <div style="font-weight: 900; font-size: 0.9rem;">${p.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 800;">تم بيع ${p.salesCount || 0} قطعة</div>
                    </div>
                    <div style="font-weight: 950; color: var(--primary);">${p.price.toLocaleString()} ج.م</div>
                </div>
            `;
        }).join('');
    } catch (err) { console.error(err); }
}

function translateStatus(s) {
    const m = { 
        'pending': 'معلق', 
        'processing': 'جاري التحضير', 
        'shipped': 'تم الشحن', 
        'completed': 'تم الاستلام', 
        'archived_received': 'تم الاستلام (مؤرشف)', 
        'archived_refused': 'تم الرفض (مؤرشف)',
        'cancelled': 'ملغي' 
    };
    return m[s] || s || '---';
}

// Sidebar Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.querySelector('.admin-sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.onclick = () => sidebar.classList.toggle('active');
    }
});

// --- Category Management Admin ---
window.previewImage = function(input, previewId) {
    const preview = document.getElementById(previewId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.suggestCategoryInfo = function(val) {
    if(!val) return;
    const slug = val.toLowerCase()
        .replace(/[^\w\u0621-\u064A\s]/gi, '')
        .replace(/\s+/g, '_');
    document.getElementById('catId').value = slug;
};

window.selectIconVisual = function(iconName) {
    document.getElementById('catIcon').value = iconName;
    document.querySelectorAll('.icon-picker-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.icon-picker-btn[data-icon="${iconName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
};

async function loadCategoriesAdmin() {
    const list = document.getElementById('categoriesList');
    if(!list) return;
    list.innerHTML = 'جاري التحميل...';

    try {
        const snap = await db.collection('categories').get();
        list.innerHTML = '';
        snap.forEach(doc => {
            const cat = doc.data();
            const div = document.createElement('div');
            div.style = "background:#f8fafc; padding:15px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; border:1px solid #e2e8f0; gap:10px;";
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; flex:1;">
                    ${cat.image ? 
                        `<img src="${cat.image}" style="width:30px; height:30px; border-radius:6px; object-fit:cover;">` :
                        `<i data-lucide="${cat.icon || 'tag'}" style="width:18px; color:var(--primary);"></i>`
                    }
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:800; font-size:0.9rem;">${cat.name}</span>
                        <small style="color:#64748b; font-size:0.7rem;">${cat.id}</small>
                    </div>
                </div>
                <button onclick="deleteCategory('${doc.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:5px;">
                    <i data-lucide="trash-2" style="width:18px;"></i>
                </button>
            `;
            list.appendChild(div);
        });
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

// --- Category Management Admin ---
window.generateStoreCategories = async (event) => {
    const btn = event.currentTarget;
    if (!confirm("هل تريد توليد فئات المتاجر العامة تلقائياً؟ سيتم إضافة 8 فئات أساسية تشمل السوبر ماركت والمطاعم وغيرها.")) return;

    const categories = [
        { name: "سوبر ماركت", id: "supermarket", icon: "shopping-cart" },
        { name: "مطاعم مأكولات", id: "restaurants", icon: "utensils" },
        { name: "صيدليات وعلاج", id: "pharmacy", icon: "pill" },
        { name: "خضروات وفواكه", id: "groceries", icon: "apple" },
        { name: "لحوم ودواجن", id: "butcher", icon: "beef" },
        { name: "أداوت منزلية", id: "home_tools", icon: "home" },
        { name: "حلويات ومخبوزات", id: "bakery", icon: "cookie" },
        { name: "إلكترونيات وموبايل", id: "electronics", icon: "smartphone" }
    ];

    const originalHTML = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="spin" data-lucide="loader-2" style="width:14px;"></i> جاري التوليد...';
        if (window.lucide) lucide.createIcons();

        const batch = db.batch();
        categories.forEach(cat => {
            const ref = db.collection('categories').doc(cat.id);
            batch.set(ref, {
                ...cat,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        alert("✅ تم توليد فئات المتاجر بنجاح! 🎉");
        loadCategoriesAdmin();
    } catch (err) {
        console.error("Store Generation Error:", err);
        alert("حدث خطأ أثناء التوليد: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        if (window.lucide) lucide.createIcons();
    }
};

document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'addCategoryForm') {
        e.preventDefault();
        const name = document.getElementById('catName').value;
        const id = document.getElementById('catId').value;
        const icon = document.getElementById('catIcon').value;
        const imageFile = document.getElementById('catImageFile').files[0];
        const imageUrl = document.getElementById('catImageUrl').value;

        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = "جاري الحفظ...";

        try {
            let finalImage = imageUrl;
            if (imageFile) {
                finalImage = await uploadFile(imageFile, 'categories');
            }

            const catData = { 
                name, 
                id, 
                icon,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (finalImage) catData.image = finalImage;

            await db.collection('categories').doc(id).set(catData, { merge: true });
            
            e.target.reset();
            document.getElementById('catImagePreview').style.display = 'none';
            alert("تم حفظ الفئة بنجاح! ✨");
            loadCategoriesAdmin();
        } catch (err) { 
            console.error("Add Category Error:", err);
            alert("خطأ أثناء الإضافة: " + err.message); 
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            lucide.createIcons();
        }
    }
});

window.deleteCategory = async (id) => {
    if(!confirm("هل أنت متأكد من حذف هذه الفئة؟")) return;
    try {
        await db.collection('categories').doc(id).delete();
        loadCategoriesAdmin();
    } catch (err) { alert(err.message); }
};

function showLoginScreen(msg) {
    if (document.getElementById('authOverlay')) return;
    
    // Hide main container if it exists
    const mainCont = document.querySelector('.admin-container') || document.getElementById('admin-container');
    if (mainCont) mainCont.style.display = 'none';

    const overlay = document.createElement('div');
    overlay.id = 'authOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        background: radial-gradient(circle at top right, #1e293b, #0f172a);
        font-family: 'Cairo', sans-serif; padding: 20px; z-index: 999999;
    `;

    overlay.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); width: 100%; max-width: 450px; border-radius: 40px; padding: 50px 40px; box-shadow: 0 40px 100px rgba(0,0,0,0.4); text-align: center; position: relative; z-index: 10; animation: zoomIn 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28);">
            <div style="background: linear-gradient(135deg, var(--primary) 0%, #ff8c33 100%); width: 90px; height: 90px; border-radius: 28px; display: flex; align-items: center; justify-content: center; margin: 0 auto 30px; transform: rotate(-10deg); box-shadow: 0 20px 40px rgba(255,107,0,0.3);">
                <i data-lucide="shield-check" style="width: 45px; height: 45px; color: white; transform: rotate(10deg);"></i>
            </div>
            
            <h1 style="color: white; font-size: 2rem; font-weight: 900; margin-bottom: 10px; letter-spacing: -0.5px;">لوحة الإدارة</h1>
            <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin-bottom: 40px;">${msg || "مرحباً بك مجدداً، يرجى تسجيل الدخول للوصول إلى صلاحيات المتجر"}</p>
            
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div id="g_id_signin" style="display: flex; justify-content: center;"></div>
                
                <button onclick="loginAdmin()" style="background: white; color: #0f172a; border: 1px solid #e2e8f0; padding: 18px; border-radius: 20px; font-weight: 900; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; transition: all 0.3s; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                    <img src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" style="width: 24px; height: 24px;">
                    تسجيل الدخول (النافذة المنبثقة)
                </button>
                <a href="index.html" style="color: #64748b; text-decoration: none; font-size: 0.85rem; font-weight: 700; margin-top: 10px; display: inline-block;">العودة للمتجر الرئيسي</a>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons();
}

async function loginAdmin() {
    try {
        // Detect if mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
            await auth.signInWithRedirect(provider);
        } else {
            const result = await auth.signInWithPopup(provider);
            if (result.user) {
                console.log("Popup Login Success");
                // The onAuthStateChanged listener will handle the rest
            }
        }
    } catch (err) {
        if (err.code === 'auth/popup-blocked') {
            alert("يرجى السماح بالنوافذ المنبثقة (Popups) في متصفحك أو حاول الدخول من الموبايل");
        } else {
            reportAuthError("فشل عملية الدخول", err);
        }
    }
}


async function showBiometricPrompt(user) {
    if (document.getElementById('bioVaultOverlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'bioVaultOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(25px);
        display: flex; align-items: center; justify-content: center;
        z-index: 999999; font-family: 'Cairo', sans-serif; transition: all 0.5s ease;
    `;
    
    overlay.innerHTML = `
        <div id="bioCard" style="background: rgba(255,255,255,0.05); padding: 50px; border-radius: 40px; border: 1px solid rgba(255,255,255,0.1); text-align: center; max-width: 450px; width: 90%; animation: zoomIn 0.5s ease;">
            <div id="bioIcon" style="width: 100px; height: 100px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 30px; box-shadow: 0 0 30px var(--primary)66; cursor: pointer;" onclick="triggerBiometric('${user.uid}')">
                <i data-lucide="fingerprint" id="mainLockIcon" style="width: 60px; height: 60px; color: white;"></i>
            </div>
            <h2 id="bioTitle" style="color: white; margin-bottom: 10px;">تأكيد الهوية</h2>
            <p id="bioDesc" style="color: #94a3b8; margin-bottom: 30px;">يرجى استخدام البصمة أو رمز PIN للدخول</p>
            
            <div id="pinSection" style="display: none; margin-bottom: 30px; animation: fadeIn 0.3s ease;">
                <input type="password" id="masterPin" placeholder="أدخل رمز PIN" style="width: 100%; padding: 15px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); color: white; text-align: center; font-size: 1.5rem; letter-spacing: 10px; outline: none; margin-bottom: 15px;">
                <button onclick="verifyPin(event, '${user.email}')" class="btn-primary" style="width: 100%; padding: 15px; border-radius: 15px; background: #10b981;">تأكيد الرمز ✅</button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px;">
                <button id="bioBtn" onclick="triggerBiometric('${user.uid}')" class="btn-primary" style="padding: 15px; border-radius: 15px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i data-lucide="fingerprint" style="width: 20px;"></i> فتح بالبصمة
                </button>
                <div style="display:flex; gap:10px;">
                    <button id="pinToggleBtn" onclick="togglePinView()" style="flex:1; background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 15px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i data-lucide="key" style="width: 18px;"></i> PIN
                    </button>
                    <button id="reRegisterBtn" onclick="reRegisterBiometrics('${user.uid}')" style="display: none; flex:1; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); padding: 15px; border-radius: 15px; font-weight: 800; cursor: pointer; align-items: center; justify-content: center; gap: 8px;">
                        <i data-lucide="refresh-cw" style="width: 18px;"></i> ربط جديد
                    </button>
                    <button onclick="auth.signOut().then(() => window.location.reload())" style="flex:1; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 15px; border-radius: 15px; font-weight: 800; cursor: pointer;">
                        خروج
                    </button>
                </div>
                <button onclick="if(confirm('هل انت متأكد؟ هذا الخيار للمالك فقط في حالات الطوارئ.')) { sessionStorage.setItem('masoudi_bio_verified', 'true'); window.location.reload(); }" style="color: #ff4d4d; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); padding: 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 800; cursor: pointer; margin-top: 15px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i data-lucide="shield-alert" style="width: 16px;"></i> تخطي التحقق (Emergency Bypass)
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons();
    
    // Auto detect hardware
    if (window.PublicKeyCredential) {
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(available => {
            if (!available) {
                togglePinView(true);
                const bioBtn = document.getElementById('bioBtn');
                if (bioBtn) bioBtn.style.display = 'none';
                const bioIcon = document.getElementById('mainLockIcon');
                if (bioIcon) bioIcon.setAttribute('data-lucide', 'shield-alert');
                if (window.lucide) lucide.createIcons();
            } else {
                // Removed auto-trigger to give user control and avoid reload loops
                // setTimeout(() => triggerBiometric(user.uid), 800);
            }
        });
    } else {
        togglePinView(true);
    }
}

window.togglePinView = (force = false) => {
    const pinSection = document.getElementById('pinSection');
    const bioBtn = document.getElementById('bioBtn');
    if (pinSection) {
        if (force || pinSection.style.display === 'none') {
            pinSection.style.display = 'block';
            if (bioBtn) bioBtn.style.display = 'none';
            document.getElementById('masterPin').focus();
        } else {
            pinSection.style.display = 'none';
            if (bioBtn) bioBtn.style.display = 'flex';
        }
    }
};

window.verifyPin = async (e, email) => {
    const pin = document.getElementById('masterPin').value;
    if (!pin) return alert("يرجى إدخال الرمز");
    
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "جاري التحقق...";

    try {
        let savedPin = "1234"; // Default
        
        // Special case for Super Admin hardcoded email
        if (email.toLowerCase() === ADMIN_EMAIL) {
            // Attempt to get custom PIN from settings if it exists, otherwise use 1234
            const configSnap = await db.collection('settings').doc('admin_config').get();
            if (configSnap.exists && configSnap.data().masterPin) {
                savedPin = configSnap.data().masterPin;
            }
        } else {
            const adminDoc = await db.collection('admins').doc(email).get();
            if (adminDoc.exists) {
                savedPin = adminDoc.data().pinCode || "1234";
            }
        }
        
        if (pin === savedPin) {
            sessionStorage.setItem('masoudi_bio_verified', 'true');
            const overlay = document.getElementById('bioVaultOverlay');
            if (overlay) overlay.remove();
        } else {
            alert("⚠️ الرمز غير صحيح! حاول مرة أخرى.");
            btn.disabled = false;
            btn.innerHTML = original;
        }
    } catch (err) {
        console.error("PIN Verification Error:", err);
        // Fallback for emergency
        if (pin === "1234") { // Last ditch default
            sessionStorage.setItem('masoudi_bio_verified', 'true');
            const overlay = document.getElementById('bioVaultOverlay');
            if (overlay) overlay.remove();
        } else {
            alert("خطأ: " + err.message);
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
};

async function triggerBiometric(uid) {
    const iconContainer = document.getElementById('bioIcon');
    const bioDesc = document.getElementById('bioDesc');
    if (iconContainer) iconContainer.style.animation = 'pulse 1s infinite';
    
    console.log("Starting Biometric Trigger for UID:", uid);
    
    try {
        if (!window.PublicKeyCredential) {
            throw new Error("متصفحك لا يدعم التحقق بالبصمة.");
        }
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        const hasRegistered = localStorage.getItem('masoudi_bio_registered');
        
        if (!hasRegistered) {
            const options = {
                publicKey: {
                    challenge: challenge,
                    rp: { name: "Masoudi Admin", id: window.location.hostname },
                    user: {
                        id: Uint8Array.from(uid, c => c.charCodeAt(0)),
                        name: "admin",
                        displayName: "Masoudi Admin"
                    },
                    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
                    timeout: 60000
                }
            };
            await navigator.credentials.create(options);
            localStorage.setItem('masoudi_bio_registered', 'true');
            sessionStorage.setItem('masoudi_bio_verified', 'true');
            const overlay = document.getElementById('bioVaultOverlay');
            if (overlay) overlay.remove();
        } else {
            try {
                await navigator.credentials.get({ 
                    publicKey: { 
                        challenge, 
                        timeout: 60000,
                        userVerification: "required"
                    } 
                });
                sessionStorage.setItem('masoudi_bio_verified', 'true');
                const overlay = document.getElementById('bioVaultOverlay');
                if (overlay) overlay.remove();
            } catch (innerErr) {
                console.warn("Bio verification failed:", innerErr);
                if (iconContainer) iconContainer.style.animation = 'none';
                togglePinView(true);
                const reRegBtn = document.getElementById('reRegisterBtn');
                if (reRegBtn) reRegBtn.style.display = 'flex';
                const bioDesc = document.getElementById('bioDesc');
                if (bioDesc) bioDesc.textContent = "لم نتمكن من التحقق. استخدم الـ PIN أو أعد ربط الجهاز.";
            }
        }
    } catch (err) {
        console.error("Biometric failed:", err);
        togglePinView(true);
        if (iconContainer) iconContainer.style.animation = 'none';
    }
}

window.reRegisterBiometrics = async (uid) => {
    if (!confirm("هل تريد إعادة ربط بصمة هذا الجهاز؟")) return;
    localStorage.removeItem('masoudi_bio_registered');
    triggerBiometric(uid);
};


// --- Products Management ---
async function loadProducts() {
    const list = document.getElementById('adminProductsList');
    if(!list) return;
    list.innerHTML = '<tr><td colspan="6" style="text-align:center;">جاري التحميل...</td></tr>';
    
    try {
        const catSelect = document.getElementById('pCategory');
        if(catSelect) {
            const catSnap = await db.collection('categories').get();
            catSelect.innerHTML = catSnap.docs.map(d => `<option value="${d.id}">${d.data().name}</option>`).join('');
        }

        const snapshot = await db.collection('products').orderBy('updatedAt', 'desc').get();
        list.innerHTML = '';
        
        snapshot.forEach(doc => {
            const p = doc.data();
            if (p.isMerchantOnly) return; // Skip merchant products in general admin list
            
            const stock = p.stock || 0;
            const price = p.price || 0;
            const stockColor = stock > 5 ? '#10B981' : (stock > 0 ? '#F59E0B' : '#EF4444');
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.image || 'https://via.placeholder.com/40'}" 
                             onclick="openImagePreview('${p.image}', '${p.name}')"
                             style="width:40px; height:40px; border-radius:8px; object-fit:cover; cursor:zoom-in; border:1px solid #e2e8f0;">
                        <strong>${p.name || 'بدون اسم'}</strong>
                    </div>
                </td>
                <td>${p.category || 'عام'}</td>
                <td>${price.toLocaleString()} ج.م</td>
                <td style="color:${stockColor}; font-weight:700;">${stock}</td>
                <td><span class="badge" style="background:${stockColor}15; color:${stockColor}">${stock > 0 ? 'متوفر' : 'نفذ'}</span></td>
                <td>
                    <div style="display:flex; gap:10px;">
                        <button onclick="editProduct('${doc.id}')" style="border:none; background:none; cursor:pointer; color:#3b82f6;"><i data-lucide="edit-3" style="width:18px;"></i></button>
                        <button onclick="deleteProduct('${doc.id}')" style="border:none; background:none; cursor:pointer; color:#ef4444;"><i data-lucide="trash-2" style="width:18px;"></i></button>
                    </div>
                </td>
            `;
            list.appendChild(row);
        });
        lucide.createIcons();
    } catch (err) { 
        console.error("Load Products Error:", err); 
        list.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">خطأ في تحميل البيانات</td></tr>`;
    }
}

// --- Orders Management ---
window.refreshOrdersManual = () => {
    // Force re-render from existing memory
    if (document.getElementById('ordersListPremium')) {
        renderOrdersPremium();
        updatePremiumStats();
    }
};

window.exportOrdersToCSV = () => {
    if (!window.allOrders || window.allOrders.length === 0) return alert("لا توجد بيانات لتصديرها");
    const headers = ["ID", "Customer", "Phone", "Total", "Status", "Date"];
    const rows = window.allOrders.map(o => [
        o.orderNumber || o.id,
        `"${o.customer}"`,
        o.phone,
        o.total,
        o.status,
        o.createdAt ? (typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().toLocaleDateString() : '') : ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `masoudi_orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
};

const statusMap = {
    pending: { label: 'انتظار التأكيد ⏳', color: '#F59E0B', icon: 'clock', bg: '#FFF7ED' },
    processing: { label: 'قيد التجهيز 🛠️', color: '#6366F1', icon: 'package', bg: '#EEF2FF' },
    shipped: { label: 'جاري التوصيل 🚚', color: '#3B82F6', icon: 'truck', bg: '#EFF6FF' },
    completed: { label: 'تم التسليم ✅', color: '#10B981', icon: 'check-circle', bg: '#ECFDF5' },
    cancelled: { label: 'تم الإلغاء ❌', color: '#EF4444', icon: 'x-circle', bg: '#FEF2F2' },
    archived_received: { label: 'استلم من العميل ✅', color: '#10B981', icon: 'check-circle', bg: '#ECFDF5' },
    archived_refused: { label: 'رفض من العميل ❌', color: '#EF4444', icon: 'x-circle', bg: '#FEF2F2' }
};

const paymentMap = {
    'cod': { label: 'كاش 💵', color: '#64748B', bg: '#F1F5F9' },
    'wallet': { label: 'محفظة 👛', color: '#FF6B00', bg: '#FFF1E7' },
    'vodafone_cash': { label: 'فودافون 📱', color: '#EF4444', bg: '#FEF2F2' },
    'instapay': { label: 'انستا باي 💎', color: '#10B981', bg: '#ECFDF5' }
};


let ordersUnsub = null;
async function loadOrders() {
    const list = document.getElementById('adminOrdersList') || document.getElementById('ordersListPremium') || document.getElementById('list-pending');
    if(!list) return;
    
    // If listener already exists, don't create another one
    if (ordersUnsub) return;

    if (document.getElementById('ordersListPremium')) {
        // Show skeletons for premium view
        document.getElementById('ordersListPremium').innerHTML = `
            <tr><td colspan="7"><div class="skeleton" style="height: 60px; margin: 10px;"></div></td></tr>
            <tr><td colspan="7"><div class="skeleton" style="height: 60px; margin: 10px;"></div></td></tr>
            <tr><td colspan="7"><div class="skeleton" style="height: 60px; margin: 10px;"></div></td></tr>
        `;
    } else {
        list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 50px;">' +
            '<div class="spin" style="width:30px; height:30px; border:3px solid var(--primary); border-top-color:transparent; border-radius:50%; margin:0 auto 10px;"></div>' +
            'جاري تحميل الطلبات بسرعة...</td></tr>';
    }

    try {
        // Real-time listener with limit for performance
        ordersUnsub = db.collection('orders')
            .orderBy('createdAt', 'desc')
            .limit(100) // Optimization: Load last 100 orders
            .onSnapshot(snapshot => {
                window.allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Update UI based on current view
                if (document.getElementById('ordersListPremium') || document.getElementById('adminOrdersList')) {
                    renderOrdersPremium();
                    updatePremiumStats();
                } else if (document.getElementById('list-pending')) {
                    renderOrdersKanban();
                    updateDailySnapshot();
                }
            }, err => {
                console.error("Orders Listener Error:", err);
            });
    } catch (err) { 
        console.error("Admin Load Error:", err);
    }
}

function updatePremiumStats() {
    const stats = { pending: 0, processing: 0, shipped: 0, completed: 0 };
    window.allOrders.forEach(o => {
        if (o.status === 'completed' || o.status === 'archived_received') {
            stats.completed++;
        } else if (stats[o.status] !== undefined) {
            stats[o.status]++;
        }
    });

    if (document.getElementById('count-pending')) document.getElementById('count-pending').textContent = stats.pending;
    if (document.getElementById('count-processing')) document.getElementById('count-processing').textContent = stats.processing;
    if (document.getElementById('count-shipped')) document.getElementById('count-shipped').textContent = stats.shipped;
    if (document.getElementById('count-completed')) document.getElementById('count-completed').textContent = stats.completed;
}

let currentStatusFilter = 'all';
window.setStatusFilter = (status, btn) => {
    currentStatusFilter = status;
    document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderOrdersPremium();
};

window.filterOrders = () => renderOrdersPremium();

function renderOrdersPremium() {
    // Support both element IDs used across different pages
    const list = document.getElementById('ordersListPremium') || document.getElementById('adminOrdersList');
    if (!list) return;

    const searchTerm = (document.getElementById('orderSearch')?.value || '').toLowerCase().trim();
    let filtered = window.allOrders || [];

    // Apply Status Filter
    if (currentStatusFilter !== 'all') {
        filtered = filtered.filter(o => o.status === currentStatusFilter);
    }

    if (searchTerm) {
        filtered = filtered.filter(o => {
            const searchVal = searchTerm.replace('#', '');
            return (o.customer || '').toLowerCase().includes(searchTerm) ||
                   (o.phone?.toString() || '').includes(searchTerm) ||
                   (o.orderNumber?.toString() || '').includes(searchVal) ||
                   (o.id || '').toLowerCase().includes(searchVal);
        });
    }

    if (filtered.length === 0) {
        list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:50px; color:#64748B; font-weight:700;">لا يوجد طلبات تطابق بحثك</td></tr>';
        return;
    }

    try {
        list.innerHTML = filtered.map(o => {
            try {
                const dateObj = o.createdAt ? (typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate() : new Date(o.createdAt)) : null;
                const timeStr = dateObj ? dateObj.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '---';
                const dateStr = dateObj ? dateObj.toLocaleDateString('ar-EG', {month:'short', day:'numeric'}) : '---';
                
                const s = (statusMap && statusMap[o.status]) ? statusMap[o.status] : (statusMap ? statusMap.pending : { label: 'جديد', color: '#6366F1', bg: '#EEF2FF' });
                const isMobile = window.innerWidth < 768;
                
                const itemsList = (o.items || []).map(it => it.name || 'منتج').join('، ');
                
                return `
                    <tr class="order-row" onclick="openOrderPanel('${o.id}')">
                        <td style="font-weight:900; color:#1E293B;">#${o.orderNumber || o.id.substring(0,5)}</td>
                        <td style="max-width: 200px;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <img src="${o.userPhoto || 'https://ui-avatars.com/api/?name=U'}" style="width:35px; height:35px; border-radius:10px; object-fit:cover;">
                                <div style="min-width:0; flex:1;">
                                    <div style="font-weight:800; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:5px;">
                                        ${o.customer || 'عميل مجهول'}
                                        ${(o.paymentMethod !== 'cod' && !o.paymentConfirmed) ? 
                                            (o.paymentProof ? 
                                                '<i data-lucide="image" style="width:14px; color:#10B981;" title="الإيصال جاهز"></i>' : 
                                                '<i data-lucide="alert-circle" style="width:14px; color:#F59E0B;" title="بانتظار الإيصال (واتساب)"></i>'
                                            ) : ''
                                        }
                                    </div>
                                    <div style="font-size:0.75rem; color:#64748B; font-weight:700;">${o.phone || '---'}</div>
                                </div>
                            </div>
                        </td>
                        <td class="desktop-only" style="font-size:0.8rem; color:#64748B; font-weight:700; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${itemsList}</td>
                        <td>
                            <span style="background:${(paymentMap[o.paymentMethod] || paymentMap.cod).bg}; color:${(paymentMap[o.paymentMethod] || paymentMap.cod).color}; padding:4px 10px; border-radius:10px; font-size:0.7rem; font-weight:800; border:1px solid ${(paymentMap[o.paymentMethod] || paymentMap.cod).color}20;">
                                ${(paymentMap[o.paymentMethod] || paymentMap.cod).label}
                            </span>
                        </td>
                        <td style="font-weight:900; color:var(--primary);">${(o.total || 0).toLocaleString()} <small style="font-size:0.6rem;">ج.م</small></td>
                        <td>
                            <span class="status-badge" style="background:${s.bg || '#F1F5F9'}; color:${s.color || '#64748B'}; border:1px solid ${s.color || '#64748B'}20; padding:4px 10px; border-radius:50px; font-size:0.7rem; font-weight:900; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
                                <span style="width:6px; height:6px; border-radius:50%; background:${s.color || '#64748B'}; ${o.status === 'pending' ? 'box-shadow: 0 0 8px '+s.color : ''}"></span>
                                ${s.label || '---'}
                            </span>
                        </td>
                        <td class="desktop-only" style="font-size:0.75rem; color:#94A3B8; font-weight:800; line-height:1.4;">
                            <div>${dateStr}</div>
<div style="font-size:0.65rem; opacity:0.7;">${timeStr}</div>
                        </td>
                        <td>
                            <div style="display:flex; gap:6px;">
                                <button class="btn-premium-action" onclick="event.stopPropagation(); printThermalReceipt('${o.id}')"><i data-lucide="printer" style="width:14px;"></i></button>
                                <button class="btn-premium-action" style="color:#10B981; background:#ECFDF5;" onclick="event.stopPropagation(); downloadAdminInvoice('${o.id}')"><i data-lucide="file-text" style="width:14px;"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            } catch (innerErr) {
                console.warn("Row render error:", innerErr, o);
                return '<tr><td colspan="7">خطأ في عرض الصف</td></tr>';
            }
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) {
        console.error("RenderOrders Error:", err);
    }
}

let activeOrderListener = null;

window.openOrderPanel = async (id) => {
    const panel = document.getElementById('orderPanel');
    const overlay = document.getElementById('panelOverlay');
    if (!panel) return;

    // Cleanup previous listener
    if (activeOrderListener) activeOrderListener();

    // Set up real-time listener for THIS order
    activeOrderListener = db.collection('orders').doc(id).onSnapshot(doc => {
        if (!doc.exists) return;
        const o = doc.data();
        o.id = doc.id;
        renderOrderPanelContent(o);
    });

    panel.classList.add('active');
    overlay.style.display = 'block';
};

function renderOrderPanelContent(o) {
    const panel = document.getElementById('orderPanel');
    const isMobile = window.innerWidth <= 1024;
    const sm = (typeof statusMap !== 'undefined' && statusMap[o.status]) ? statusMap[o.status] : { label: o.status || 'معلق', icon: 'package', color: '#64748B' };

    panel.innerHTML = `
        <style>
            .premium-order-panel {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: var(--bg-admin, #f8fafc);
                color: var(--text-main, #1e293b);
                font-family: 'Cairo', sans-serif;
            }
            .pop-header {
                padding: 30px;
                background: linear-gradient(135deg, var(--primary, #FF6B00) 0%, #ff9533 100%);
                color: white;
                border-radius: 0 0 35px 35px;
                box-shadow: 0 10px 30px rgba(255,107,0,0.25);
                position: relative;
                overflow: hidden;
                flex-shrink: 0;
            }
            .pop-header::before {
                content: '';
                position: absolute;
                top: -50%;
                right: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%);
                transform: rotate(45deg);
                pointer-events: none;
            }
            .pop-close {
                background: rgba(255,255,255,0.2);
                border: none;
                width: 42px;
                height: 42px;
                border-radius: 50%;
                color: white;
                cursor: pointer;
                backdrop-filter: blur(8px);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .pop-close:hover {
                background: white;
                color: var(--primary, #FF6B00);
                transform: rotate(90deg) scale(1.1);
            }
            .pop-body {
                padding: 25px;
                flex: 1;
                overflow-y: auto;
            }
            .pop-card {
                background: var(--card-bg, #fff);
                border: 1px solid var(--glass-border, #e2e8f0);
                border-radius: 24px;
                padding: 25px;
                margin-bottom: 20px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.03);
                transition: transform 0.3s, box-shadow 0.3s;
            }
            .pop-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 25px rgba(0,0,0,0.06);
            }
            .pop-customer-img {
                width: 90px;
                height: 90px;
                border-radius: 28px;
                border: 4px solid var(--primary, #FF6B00);
                padding: 3px;
                background: white;
                object-fit: cover;
                box-shadow: 0 8px 20px rgba(255,107,0,0.2);
            }
            .pop-btn {
                background: var(--primary, #FF6B00);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 14px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-size: 0.9rem;
            }
            .pop-btn:hover {
                transform: scale(1.04);
                box-shadow: 0 8px 20px rgba(255,107,0,0.3);
            }
            .pop-btn-outline {
                background: transparent;
                border: 2px solid var(--primary, #FF6B00);
                color: var(--primary, #FF6B00);
            }
            .pop-btn-outline:hover {
                background: var(--primary, #FF6B00);
                color: white;
            }
            .status-btn {
                padding: 14px;
                border-radius: 16px;
                border: 2px solid #F1F5F9;
                background: #F8FAFC;
                color: #64748B;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                gap: 8px;
                justify-content: center;
                font-size: 0.85rem;
            }
            .status-btn.active {
                border-color: var(--active-color);
                background: var(--active-color);
                color: white;
                box-shadow: 0 8px 20px rgba(0,0,0,0.15);
                transform: translateY(-2px);
            }
            .item-row {
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 15px;
                border-radius: 18px;
                background: #F8FAFC;
                margin-bottom: 12px;
                border: 1px solid #F1F5F9;
                transition: background 0.3s;
            }
            .item-row:hover {
                background: #fff;
                border-color: var(--primary, #FF6B00);
            }
            .item-img {
                width: 65px;
                height: 65px;
                border-radius: 14px;
                object-fit: cover;
                box-shadow: 0 4px 10px rgba(0,0,0,0.08);
                cursor: pointer;
            }
            .pop-footer {
                padding: 30px;
                background: var(--card-bg, #fff);
                border-top: 1px solid var(--glass-border, #e2e8f0);
                border-radius: 35px 35px 0 0;
                box-shadow: 0 -10px 30px rgba(0,0,0,0.04);
                flex-shrink: 0;
            }
            .dark-mode .premium-order-panel {
                background: #0f172a;
                color: #f8fafc;
            }
            .dark-mode .pop-card, .dark-mode .pop-footer {
                background: #1e293b;
                border-color: #334155;
            }
            .dark-mode .item-row {
                background: #0f172a;
                border-color: #334155;
            }
            .dark-mode .item-row:hover {
                background: #1e293b;
            }
            .dark-mode .status-btn {
                background: #0f172a;
                border-color: #334155;
                color: #94a3b8;
            }
        </style>
        <div class="premium-order-panel">
            <div class="pop-header">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; position:relative; z-index:2;">
                    <div>
                        <h2 style="margin:0; font-weight:900; font-size:1.8rem; letter-spacing:-0.5px;">طلب #${o.orderNumber || o.id.substring(0,5)}</h2>
                        <div style="font-size:0.9rem; opacity:0.95; font-weight:800; margin-top:8px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="clock" style="width:16px;"></i>
                            ${o.createdAt ? (typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().toLocaleString('ar-EG', {weekday:'long', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '') : 'غير محدد'}
                        </div>
                    </div>
                    <button class="pop-close" onclick="closeOrderPanel()"><i data-lucide="x"></i></button>
                </div>
            </div>

            <div class="pop-body">
                <!-- Customer Info -->
                <div class="pop-card" style="display:flex; flex-direction:column; align-items:center; text-align:center; position:relative; overflow:hidden;">
                    <div style="position:absolute; top:0; left:0; width:100%; height:70px; background:linear-gradient(to bottom, var(--primary, #FF6B00)22, transparent);"></div>
                    <img src="${o.userPhoto || 'https://ui-avatars.com/api/?name='+encodeURIComponent(o.customer || 'U')+'&background=random&color=fff'}" class="pop-customer-img" style="position:relative; z-index:1;">
                    <h3 style="margin:15px 0 5px 0; font-weight:900; font-size:1.4rem;">${o.customer || 'عميل مجهول'}</h3>
                    <div style="display:flex; gap:12px; margin-top:15px; flex-wrap:wrap; justify-content:center; width:100%;">
                        <a href="tel:${o.phone || ''}" class="pop-btn" style="text-decoration:none; flex:1; min-width:110px;"><i data-lucide="phone" style="width:18px;"></i> اتصال</a>
                        <a href="https://wa.me/2${(o.phone || '').replace(/\D/g,'')}" target="_blank" class="pop-btn" style="background:#10B981; text-decoration:none; flex:1; min-width:110px;"><i data-lucide="message-circle" style="width:18px;"></i> واتساب</a>
                        <a href="${o.location && o.location.startsWith('http') ? o.location : 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(o.address || o.customer || '')}" target="_blank" class="pop-btn pop-btn-outline" style="text-decoration:none; flex:1; min-width:110px;"><i data-lucide="map-pin" style="width:18px;"></i> الخريطة</a>
                    </div>
                </div>

                <!-- Status Manager -->
                <div class="pop-card">
                    <h4 style="margin:0 0 18px 0; color:var(--text-muted, #64748b); font-weight:900; font-size:0.95rem; display:flex; align-items:center; gap:8px;">
                        <i data-lucide="activity" style="width:18px; color:var(--primary, #FF6B00);"></i> تحديث الحالة
                    </h4>
                    ${(o.status === 'completed' || o.status === 'cancelled' || o.status === 'archived_received' || o.status === 'archived_refused') ? `
                        <div style="background:#F8FAFC; border:2px dashed #E2E8F0; color:#475569; padding:20px; border-radius:18px; text-align:center; font-weight:900; display:flex; flex-direction:column; align-items:center; gap:10px;">
                            <i data-lucide="lock" style="width:24px; color:#94a3b8;"></i> 
                            الطلب مكتمل ولا يمكن تعديل حالته مجدداً
                        </div>
                    ` : `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            ${['pending', 'processing', 'shipped', 'completed'].map(st => {
                                const _sm = (typeof statusMap !== 'undefined' && statusMap[st]) ? statusMap[st] : { label: st, icon: 'package', color: '#64748B' };
                                const active = o.status === st;
                                return `<button onclick="updateOrderStatusManual('${o.id}', '${st}')" class="status-btn ${active ? 'active' : ''}" style="--active-color: ${_sm.color};"><i data-lucide="${_sm.icon}" style="width:18px;"></i> ${_sm.label}</button>`;
                            }).join('')}
                        </div>
                    `}
                </div>

                <!-- Digital Payment Info -->
                ${(o.paymentMethod === 'vodafone_cash' || o.paymentMethod === 'instapay' || o.paymentProof) ? `
                    <div class="pop-card" style="border:2px solid ${o.paymentConfirmed ? '#10B981' : (o.status === 'cancelled' ? '#EF4444' : '#F59E0B')}; background: ${o.paymentConfirmed ? '#F0FDF4' : (o.status === 'cancelled' ? '#FEF2F2' : '#FFFBEB')};">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <h4 style="margin:0; font-weight:900; color:#1E293B;">تفاصيل الدفع</h4>
                            <span style="background:${o.paymentConfirmed ? '#10B981' : (o.status === 'cancelled' ? '#EF4444' : '#F59E0B')}; color:white; padding:6px 14px; border-radius:12px; font-size:0.8rem; font-weight:900; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                                ${o.paymentConfirmed ? 'مؤكد ✅' : (o.status === 'cancelled' ? 'مرفوض ❌' : 'بانتظار التأكيد ⏳')}
                            </span>
                        </div>
                        <div style="display:flex; gap:18px; align-items:center;">
                            <div style="position:relative; width:90px; height:90px; border-radius:18px; background:white; border:3px solid white; box-shadow:0 8px 20px rgba(0,0,0,0.08); overflow:hidden; flex-shrink:0;">
                                ${o.paymentProof ? 
                                    `<img src="${o.paymentProof}" onclick="openImagePreview('${o.paymentProof}')" style="width:100%; height:100%; object-fit:cover; cursor:zoom-in;">` : 
                                    `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.7rem; text-align:center; font-weight:800; padding:5px;">لا يوجد إيصال</div>`
                                }
                            </div>
                            <div style="flex:1;">
                                <div style="font-size:0.85rem; color:#64748B; font-weight:800;">آخر أرقام المحول:</div>
                                <div style="font-size:1.6rem; font-weight:900; color:#1E293B; letter-spacing:2px; margin-top:2px;">${o.paymentSenderDigits || '---'}</div>
                                ${(!o.paymentConfirmed && o.status !== 'cancelled') ? `
                                    <div style="margin-top:12px; display:flex; gap:10px;">
                                        <button onclick="confirmOrderPayment('${o.id}')" class="pop-btn" style="background:#10B981; padding:8px 16px; font-size:0.85rem; flex:1;"><i data-lucide="check"></i> تأكيد</button>
                                        <button onclick="updateOrderStatusManual('${o.id}', 'cancelled')" class="pop-btn" style="background:#EF4444; padding:8px 16px; font-size:0.85rem; flex:1;"><i data-lucide="x"></i> رفض</button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                ` : ''}

                <!-- Items List -->
                <div class="pop-card" style="background:transparent; border:none; box-shadow:none; padding:0;">
                    <h4 style="margin:0 0 15px 0; color:var(--text-muted, #64748b); font-weight:900; font-size:0.95rem; display:flex; align-items:center; gap:8px;">
                        <i data-lucide="shopping-bag" style="width:18px; color:var(--primary, #FF6B00);"></i> سلة المشتريات (${(o.items || []).length})
                    </h4>
                    ${(o.items || []).map(it => `
                        <div class="item-row">
                            <img src="${it.image || 'https://via.placeholder.com/60'}" class="item-img" onclick="openImagePreview('${it.image}')">
                            <div style="flex:1;">
                                <div style="font-weight:900; font-size:1rem; color:var(--text-main, #1e293b);">${it.name || 'منتج'}</div>
                                <div style="font-size:0.85rem; color:var(--text-muted, #94a3b8); font-weight:800; margin-top:4px;">الكمية: ${it.quantity || 1}</div>
                            </div>
                            <div style="text-align:left;">
                                <div style="font-weight:900; color:var(--primary, #FF6B00); font-size:1.2rem;">
                                    ${((it.quantity || 1) * (it.price || 0)).toLocaleString()} <small style="font-size:0.75rem;">ج.م</small>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Footer Action -->
            <div class="pop-footer">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-weight:800; color:var(--text-muted, #64748b); font-size:0.95rem;">
                    <span>إجمالي المنتجات</span>
                    <span style="color:var(--text-main, #1e293b);">${(o.total - (o.deliveryFee || 0)).toLocaleString()} ج.م</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:18px; font-weight:800; color:var(--text-muted, #64748b); font-size:0.95rem;">
                    <span>رسوم التوصيل</span>
                    <span style="color:#10B981;">+ ${(o.deliveryFee || 0).toLocaleString()} ج.م</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-top:2px dashed var(--glass-border, #e2e8f0); padding-top:20px; margin-bottom:25px; align-items:center;">
                    <span style="font-weight:900; font-size:1.2rem; color:var(--text-main, #1e293b);">الإجمالي النهائي</span>
                    <span style="font-weight:900; font-size:1.8rem; color:var(--primary, #FF6B00);">${(o.total || 0).toLocaleString()} <small style="font-size:0.9rem;">ج.م</small></span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
                    <button onclick="printThermalReceipt('${o.id}')" class="pop-btn" style="background:#F8FAFC; color:#1E293B; border:2px solid #E2E8F0;"><i data-lucide="printer"></i> بون</button>
                    <button onclick="downloadAdminInvoice('${o.id}')" class="pop-btn" style="background:#10B981;"><i data-lucide="file-text"></i> PDF</button>
                    <button onclick="deleteOrder('${o.id}'); closeOrderPanel();" class="pop-btn" style="background:#EF4444;"><i data-lucide="trash-2"></i> حذف</button>
                </div>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.closeOrderPanel = () => {
    if (activeOrderListener) activeOrderListener();
    activeOrderListener = null;
    document.getElementById('orderPanel').classList.remove('active');
    document.getElementById('panelOverlay').style.display = 'none';
}

window.confirmOrderPayment = async (id) => {
    if(!confirm("هل أنت متأكد من استلام المبلغ بالكامل؟ سيتم إخطار العميل فوراً.")) return;
    try {
        await db.collection('orders').doc(id).update({
            paymentConfirmed: true,
            status: 'processing',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast("✅ تم تأكيد الدفع بنجاح");
        
        // Refresh appropriate view
        if (document.getElementById('orderPanel').classList.contains('active')) {
            openOrderPanel(id);
        } else if (document.getElementById('orderDetailsModal').style.display === 'flex') {
            viewOrder(id);
        }
    } catch (err) {
        alert("خطأ في التأكيد: " + err.message);
    }
};

window.filterOrdersKanban = () => {
    renderOrdersKanban();
};

function renderOrdersKanban() {
    const statuses = ['pending', 'processing', 'shipped', 'completed'];
    const searchTerm = (document.getElementById('masterSearch')?.value || '').toLowerCase();

    statuses.forEach(status => {
        const column = document.getElementById(`list-${status}`);
        const countBadge = document.getElementById(`count-${status}`);
        if (!column) return;

        let filtered = window.allOrders.filter(o => (o.status || 'pending') === status);

        if (searchTerm) {
            filtered = filtered.filter(o => 
                (o.customer || '').toLowerCase().includes(searchTerm) ||
                (o.phone || '').includes(searchTerm) ||
                (o.orderNumber?.toString() || '').includes(searchTerm)
            );
        }

        countBadge.textContent = filtered.length;
        column.innerHTML = filtered.map(o => {
            const time = o.createdAt ? (typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '') : '';
            const itemsPreview = (o.items || []).slice(0, 3).map(it => `
                <img src="${it.image}" class="item-thumb" title="${it.name}">
            `).join('');

            return `
                <div class="order-card-premium" onclick="openOrderDrawer('${o.id}')">
                    <div class="card-header">
                        <span class="order-id">#${o.orderNumber || o.id.substring(0,5)}</span>
                        <span class="order-time">${time}</span>
                    </div>
                    <div class="customer-mini">
                        <img src="${o.userPhoto || 'https://ui-avatars.com/api/?name=U'}" alt="User">
                        <span>${o.customer || 'عميل مجهول'}</span>
                    </div>
                    <div class="order-items-preview">
                        ${itemsPreview}
                        ${o.items?.length > 3 ? `<span style="font-size:0.6rem; margin-top:10px; color:#A0AEC0;">+${o.items.length - 3}</span>` : ''}
                    </div>
                    <div class="card-footer">
                        <span class="order-total">${(o.total || 0).toLocaleString()} ج.م</span>
                        <div style="display:flex; gap:5px;">
                            ${o.note ? '<i data-lucide="message-square" style="width:14px; color:#FF6B00;"></i>' : ''}
                            ${o.location ? '<i data-lucide="map-pin" style="width:14px; color:#3B82F6;"></i>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    });
    lucide.createIcons();
}

window.openOrderDrawer = async (id) => {
    const o = window.allOrders.find(order => order.id === id);
    if (!o) return;

    const drawer = document.getElementById('orderDrawer');
    const overlay = document.getElementById('drawerOverlay');
    
    drawer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
            <h2 style="margin:0; font-weight:900;">تفاصيل الطلب</h2>
            <button onclick="closeOrderDrawer()" style="background:none; border:none; cursor:pointer; color:#718096;"><i data-lucide="x" style="width:30px;"></i></button>
        </div>

        <div style="background:#F7FAFC; padding:25px; border-radius:24px; margin-bottom:30px; display:flex; align-items:center; gap:20px; border:1px solid #E2E8F0;">
            <img src="${o.userPhoto || 'https://ui-avatars.com/api/?name=U'}" style="width:70px; height:70px; border-radius:20px; object-fit:cover; border:4px solid white;">
            <div style="flex:1;">
                <div style="font-weight:900; font-size:1.3rem; color:#1A202C;">${o.customer}</div>
                <div style="display:flex; gap:10px; margin-top:5px;">
                    <a href="tel:${o.phone}" style="color:var(--primary); font-weight:800; text-decoration:none;"><i data-lucide="phone" style="width:14px;"></i> ${o.phone}</a>
                    <a href="https://wa.me/2${o.phone}" target="_blank" style="color:#10B981;"><i data-lucide="message-circle" style="width:18px;"></i></a>
                </div>
            </div>
        </div>

        <div style="margin-bottom:30px;">
            <label style="font-size:0.8rem; color:#A0AEC0; font-weight:800; display:block; margin-bottom:15px;">إدارة حالة الطلب</label>
            
            ${(o.paymentMethod === 'vodafone_cash' || o.paymentMethod === 'instapay' || o.paymentProof) ? `
                <!-- Digital Payment Specific Actions -->
                <div style="background: #FFF7ED; padding: 15px; border-radius: 20px; border: 1px solid #FFEDD5; margin-bottom: 15px;">
                    <p style="font-size: 0.75rem; font-weight: 800; color: #C2410C; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="shield-check" style="width:14px;"></i> إجراءات التحقق من الدفع الرقمي
                    </p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button onclick="updateOrderStatusManual('${o.id}', 'processing')" style="padding:12px; border-radius:15px; border:none; background:#10B981; color:white; font-weight:900; cursor:pointer; font-size:0.8rem;">✅ تأكيد استلام المبلغ</button>
                        <button onclick="updateOrderStatusManual('${o.id}', 'cancelled')" style="padding:12px; border-radius:15px; border:none; background:#EF4444; color:white; font-weight:900; cursor:pointer; font-size:0.8rem;">❌ لم أستلم المبلغ</button>
                    </div>
                </div>
            ` : ''}

            ${(o.status === 'completed' || o.status === 'cancelled' || o.status === 'archived_received' || o.status === 'archived_refused') ? `
                <div style="background:#F7FAFC; border:1px solid #E2E8F0; color:#718096; padding:15px; border-radius:15px; text-align:center; font-weight:800; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <i data-lucide="lock" style="width:16px; color:#a0aec0;"></i> الطلب مغلق ولا يمكن تعديل حالته مجدداً
                </div>
            ` : `
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
                    <button onclick="updateOrderStatusManual('${o.id}', 'pending')" style="padding:12px; border-radius:15px; border:2px solid #E2E8F0; background:${o.status === 'pending' ? 'var(--primary)' : 'white'}; color:${o.status === 'pending' ? 'white' : '#718096'}; font-weight:800; cursor:pointer;">⏳ انتظار</button>
                    <button onclick="updateOrderStatusManual('${o.id}', 'processing')" style="padding:12px; border-radius:15px; border:2px solid #E2E8F0; background:${o.status === 'processing' ? '#6366F1' : 'white'}; color:${o.status === 'processing' ? 'white' : '#718096'}; font-weight:800; cursor:pointer;">⚙️ تجهيز</button>
                    <button onclick="updateOrderStatusManual('${o.id}', 'shipped')" style="padding:12px; border-radius:15px; border:2px solid #E2E8F0; background:${o.status === 'shipped' ? '#3B82F6' : 'white'}; color:${o.status === 'shipped' ? 'white' : '#718096'}; font-weight:800; cursor:pointer;">🚚 شحن</button>
                    <button onclick="updateOrderStatusManual('${o.id}', 'completed')" style="padding:12px; border-radius:15px; border:2px solid #E2E8F0; background:${o.status === 'completed' ? '#10B981' : 'white'}; color:${o.status === 'completed' ? 'white' : '#718096'}; font-weight:800; cursor:pointer;">✅ وصل</button>
                    <button onclick="updateOrderStatusManual('${o.id}', 'cancelled')" style="padding:12px; grid-column: span 2; border-radius:15px; border:2px solid #FEE2E2; background:${o.status === 'cancelled' ? '#EF4444' : 'white'}; color:${o.status === 'cancelled' ? 'white' : '#EF4444'}; font-weight:800; cursor:pointer;">❌ إلغاء الطلب</button>
                </div>
            `}
        </div>

        <div style="flex:1; overflow-y:auto; margin-bottom:20px;">
            <label style="font-size:0.8rem; color:#A0AEC0; font-weight:800; display:block; margin-bottom:15px;">المنتجات</label>
            ${(o.items || []).map(it => `
                <div style="display:flex; align-items:center; gap:15px; background:white; padding:12px; border-radius:18px; border:1px solid #F1F5F9; margin-bottom:12px;">
                    <img src="${it.image}" style="width:50px; height:50px; border-radius:12px; object-fit:cover;">
                    <div style="flex:1;">
                        <div style="font-weight:800; font-size:0.9rem;">${it.name}</div>
                        <div style="color:#A0AEC0; font-size:0.8rem;">${it.quantity} × ${it.price} ج.م</div>
                    </div>
                    <div style="font-weight:900; color:var(--primary);">${(it.quantity * it.price).toLocaleString()}</div>
                </div>
            `).join('')}
        </div>

        <div style="background:#1A202C; padding:30px; border-radius:24px; color:white;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="opacity:0.6;">إجمالي المبلغ</span>
                <span style="font-size:1.6rem; font-weight:900; color:var(--primary);">${(o.total || 0).toLocaleString()} ج.م</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:20px;">
                <button onclick="printThermalReceipt('${o.id}')" style="background:rgba(255,255,255,0.1); color:white; border:none; padding:15px; border-radius:15px; font-weight:800; cursor:pointer;">🖨️ طباعة بون</button>
                <button onclick="deleteOrder('${o.id}'); closeOrderDrawer();" style="background:#EF4444; color:white; border:none; padding:15px; border-radius:15px; font-weight:800; cursor:pointer;">🗑️ حذف</button>
            </div>
        </div>
    `;

    drawer.classList.add('active');
    overlay.style.display = 'block';
    lucide.createIcons();
}

window.closeOrderDrawer = () => {
    document.getElementById('orderDrawer').classList.remove('active');
    document.getElementById('drawerOverlay').style.display = 'none';
}

function updateDailySnapshot() {
    const snapshotEl = document.getElementById('dailySnapshot');
    if (!snapshotEl) return;

    const today = new Date().toLocaleDateString('ar-EG');
    const todayOrders = window.allOrders.filter(o => {
        const d = o.createdAt ? (typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().toLocaleDateString('ar-EG') : new Date(o.createdAt).toLocaleDateString('ar-EG')) : '';
        return d === today;
    });

    const stats = [
        { label: 'طلبات اليوم', val: todayOrders.length, color: '#ff6b00', icon: 'shopping-bag' },
        { label: 'قيد التجهيز', val: window.allOrders.filter(o => o.status === 'processing').length, color: '#6366f1', icon: 'package' },
        { label: 'في الشحن', val: window.allOrders.filter(o => o.status === 'shipped').length, color: '#3b82f6', icon: 'truck' },
        { label: 'بانتظار التأكيد', val: window.allOrders.filter(o => o.status === 'pending').length, color: '#f59e0b', icon: 'clock' }
    ];

    snapshotEl.innerHTML = stats.map(s => `
        <div class="admin-card" style="background:white; padding:15px; border-radius:15px; display:flex; align-items:center; gap:15px; box-shadow:var(--shadow-sm); border-right:4px solid ${s.color};">
            <div style="background:${s.color}15; color:${s.color}; padding:10px; border-radius:12px;"><i data-lucide="${s.icon}" style="width:20px;"></i></div>
            <div>
                <div style="font-size:0.75rem; color:gray;">${s.label}</div>
                <div style="font-size:1.2rem; font-weight:900;">${s.val}</div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

window.toggleAllOrders = (checked) => {
    document.querySelectorAll('.order-check').forEach(c => c.checked = checked);
    updateBulkBar();
};

window.updateBulkBar = () => {
    const checked = document.querySelectorAll('.order-check:checked');
    const bar = document.getElementById('bulkActionsBar');
    const count = document.getElementById('selectedCount');
    if (checked.length > 0) {
        bar.style.display = 'flex';
        count.textContent = checked.length;
    } else {
        bar.style.display = 'none';
    }
};

window.cancelSelection = () => {
    document.getElementById('selectAllOrders').checked = false;
    window.toggleAllOrders(false);
};

window.applyBulkAction = async () => {
    const status = document.getElementById('bulkStatus').value;
    if (!status) return alert("يرجى اختيار الحالة أولاً");
    
    const checked = document.querySelectorAll('.order-check:checked');
    const ids = Array.from(checked).map(c => c.value);
    
    if (!confirm(`هل أنت متأكد من تحديث ${ids.length} طلبات إلى حالة "${status}"؟`)) return;

    try {
        const batch = db.batch();
        ids.forEach(id => {
            let updateData = { 
                status, 
                updatedAt: firebase.firestore.FieldValue.serverTimestamp() 
            };
            if (status === 'cancelled' || status === 'archived_refused') {
                updateData.rejectionMessage = "يجب دفع مصاريف التوصيل";
                updateData.rejectionReason = "refused_delivery";
            }

            batch.update(db.collection('orders').doc(id), updateData);
        });

        await batch.commit();
        alert("تم تحديث الطلبات بنجاح! ✨");
        window.location.reload();
    } catch (err) { alert(err.message); }
};

window.currentStatusFilter = 'all';

window.filterOrders = () => {
    renderOrdersUI();
};

window.setStatusFilter = (status, el) => {
    window.currentStatusFilter = status;
    document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    renderOrdersUI();
};

window.refreshOrdersManual = () => {
    renderOrdersUI();
    updateDailySnapshot();
    showToast("🔄 تم تحديث البيانات");
};

function renderOrdersUI() {
    const list = document.getElementById('adminOrdersList');
    if(!list) return;

    const searchTerm = (document.getElementById('orderSearch')?.value || '').toLowerCase();
    
    let filtered = window.allOrders || [];

    // Apply Status Filter
    if (window.currentStatusFilter !== 'all') {
        filtered = filtered.filter(o => o.status === window.currentStatusFilter);
    }

    // Apply Search Filter
    if (searchTerm) {
        filtered = filtered.filter(o => 
            (o.customer || '').toLowerCase().includes(searchTerm) ||
            (o.phone || '').includes(searchTerm) ||
            (o.orderNumber?.toString() || '').includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 50px; color: gray;">لا توجد طلبات تطابق بحثك</td></tr>';
        return;
    }

    list.innerHTML = filtered.map(o => {
        const date = o.createdAt ? (typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().toLocaleDateString('ar-EG') : new Date(o.createdAt).toLocaleDateString('ar-EG')) : '...';
        const total = o.total || 0;
        const status = o.status || 'pending';
        
        const statusMap = {
            'pending': { label: 'جديد 🆕', color: '#ff6b00' },
            'processing': { label: 'تجهيز 📦', color: '#6366f1' },
            'shipped': { label: 'شحن 🚚', color: '#3b82f6' },
            'completed': { label: 'وصل ✅', color: '#10b981' },
            'cancelled': { label: 'ملغي ❌', color: '#ef4444' },
            'archived_received': { label: 'تم الاستلام 📦', color: '#10b981' },
            'archived_refused': { label: 'تم الرفض ❌', color: '#ef4444' }
        };

        const s = statusMap[status] || statusMap['pending'];

        // Enhanced Items Preview (Handle both images and names)
        const itemsPreview = (o.items || []).slice(0, 3).map(it => {
            if (it.image) {
                return `<img src="${it.image}" style="width:30px; height:30px; border-radius:8px; object-fit:cover; margin-left:-10px; border:2px solid white; box-shadow:0 4px 8px rgba(0,0,0,0.1);" title="${it.name}">`;
            } else {
                return `<span style="font-size:0.7rem; color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:6px; margin-left:5px; border:1px solid #e2e8f0;">${it.name || 'منتج'}</span>`;
            }
        }).join('');

        return `
            <tr class="order-row" onclick="if(event.target.type !== 'checkbox' && !event.target.closest('button') && !event.target.closest('a') && !event.target.closest('select')) openOrderPanel('${o.id}')">
                <td class="col-check" onclick="event.stopPropagation()">
                    <input type="checkbox" class="order-check" value="${o.id}" onchange="updateBulkBar()">
                </td>
                <td class="col-id">
                    <span style="font-weight:900; color:#1e293b; background:#f1f5f9; padding:5px 12px; border-radius:8px; font-size:0.85rem;">
                        #${o.orderNumber || o.id.substring(0,5)}
                    </span>
                    ${o.note ? `<div title="${o.note}" style="margin-top:5px; color:#f59e0b; font-size:0.7rem;"><i data-lucide="message-circle" style="width:12px;"></i> ملاحظة</div>` : ''}
                </td>
                <td class="col-customer">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${o.userPhoto || 'https://ui-avatars.com/api/?name=User'}" style="width:45px; height:45px; border-radius:12px; object-fit:cover; border:2px solid #f1f5f9;">
                        <div>
                            <div style="font-weight:800; color:#1e293b; font-size:0.95rem;">${o.customer || 'عميل مجهول'}</div>
                            <div style="font-size:0.75rem; color:#64748b; font-weight:700; display:flex; align-items:center; gap:5px;">
                                ${o.phone || 'بدون رقم'} 
                                ${o.phone ? `<a href="https://wa.me/${o.phone.replace(/\D/g, '')}" target="_blank" style="color:#10b981;"><i data-lucide="message-square" style="width:14px;"></i></a>` : ''}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="col-items desktop-only">
                    <div style="display:flex; align-items:center; flex-wrap:wrap; gap:5px;">
                        ${itemsPreview}
                        ${o.items?.length > 3 ? `<span style="font-size:0.65rem; color:#94a3b8; font-weight:800;">+${o.items.length - 3} أخرى</span>` : ''}
                    </div>
                </td>
                <td class="col-total">
                    <div style="font-weight:900; color:var(--primary); font-size:1.1rem;">${total.toLocaleString()}</div>
                    <div style="font-size:0.65rem; color:#94a3b8; font-weight:800;">جنيهاً مصرياً</div>
                </td>
                <td class="col-status">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <div style="background:${s.color}; color: white; padding: 6px 14px; border-radius: 50px; font-weight: 900; font-size: 0.8rem; min-width: 100px; text-align: center; box-shadow: 0 4px 12px ${s.color}33;">
                            ${s.label}
                        </div>
                        <div style="font-size:0.65rem; color:#94a3b8; font-weight:700;">${date}</div>
                        ${o.eta ? `<div style="font-size:0.65rem; color:#3b82f6; font-weight:800; background:#eff6ff; padding:2px 8px; border-radius:4px; margin-top:2px;">🚚 ${o.eta}</div>` : ''}
                    </div>
                </td>
                <td class="col-actions">
                    <div style="display:flex; align-items:center; gap:8px; justify-content: center;">
                        <button onclick="openOrderPanel('${o.id}')" class="btn-premium-action" title="عرض التفاصيل"><i data-lucide="eye" style="width:18px;"></i></button>
                        <button onclick="downloadAdminInvoice('${o.id}')" class="btn-premium-action" style="color:#10b981; background:#ecfdf5;" title="تحميل فاتورة PDF"><i data-lucide="file-text" style="width:18px;"></i></button>
                        
                        <div style="position:relative; display:inline-block;" class="mobile-hide">
                            ${(status === 'completed' || status === 'cancelled' || status === 'archived_received' || status === 'archived_refused') ? `
                                <span style="font-size:0.75rem; font-weight:900; color:#64748b; background:#f1f5f9; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0; display:inline-flex; align-items:center; gap:4px;">
                                    <i data-lucide="lock" style="width:12px;"></i> مغلق
                                </span>
                            ` : `
                                <select onchange="updateOrderStatusManual('${o.id}', this.value)" style="padding:8px 12px; border-radius:10px; font-size:0.75rem; border:1px solid #e2e8f0; background:white; cursor:pointer; font-weight:800; color:#1e293b; outline:none; appearance: none; -webkit-appearance: none;">
                                    <option value="pending" ${status === 'pending' ? 'selected' : ''}>⏳ جديد</option>
                                    <option value="processing" ${status === 'processing' ? 'selected' : ''}>⚙️ تجهيز</option>
                                    <option value="shipped" ${status === 'shipped' ? 'selected' : ''}>🚚 شحن</option>
                                    <option value="completed" ${status === 'completed' ? 'selected' : ''}>✅ وصل</option>
                                </select>
                            `}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

let adminChatUnsub = null;

window.viewOrder = async (id) => {
    const doc = await db.collection('orders').doc(id).get();
    const o = doc.data();
    const content = document.getElementById('orderContent');
    const summary = document.getElementById('orderSummary');
    if(!content || !summary) return;

    content.innerHTML = o.items.map(item => `
        <div style="display:flex; gap:15px; align-items:center; margin-bottom:12px; background:#F8FAFC; padding:10px; border-radius:10px;">
            <img src="${item.image}" style="width:50px; height:50px; border-radius:5px; object-fit:cover;">
            <div style="flex:1;">
                <h5 style="font-size:0.9rem;">${item.name}</h5>
                <div style="font-size:0.8rem; color:gray;">${item.quantity} × ${item.price.toLocaleString()} ج.م</div>
            </div>
            <div style="font-weight:700;">${(item.price * item.quantity).toLocaleString()} ج.م</div>
        </div>
    `).join('');

    summary.innerHTML = `
        <div style="background:var(--primary-light); padding:12px; border-radius:10px; margin-bottom:15px; display:flex; align-items:center; gap:10px;">
            <img src="${o.userPhoto}" style="width:40px; height:40px; border-radius:50%;">
            <div><strong>${o.customer}</strong><br><small>${o.userEmail}</small></div>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>الهاتف:</span> <strong>${o.phone}</strong></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span>العنوان:</span> 
            <div style="text-align:left;">
                <strong>${o.address}</strong>
                ${o.location ? `<br><a href="${o.location}" target="_blank" style="color:#3b82f6; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px; margin-top:5px; text-decoration:none;">
                    <i data-lucide="map-pin" style="width:14px;"></i> فتح في خرائط جوجل
                </a>` : ''}
            </div>
        </div>

        <div style="margin: 15px 0; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
            <label style="font-size:0.75rem; color:#64748b; display:block; margin-bottom:5px;">موعد التسليم المتوقع</label>
            <input type="text" id="orderEta" placeholder="مثلاً: اليوم 6 مساءً" value="${o.eta || ''}" onchange="updateOrderField('${o.id}', 'eta', this.value)" style="width:100%; padding:10px; border-radius:10px; border:1px solid #cbd5e1; font-size:0.9rem; font-weight:700;">
        </div>
        
        <hr style="border:0; border-top:1px solid #EEE; margin:15px 0;">
        <h4 style="margin-bottom:10px; font-size:1rem;">💬 المحادثة المباشرة</h4>
        <div id="adminChatBox" style="height:150px; overflow-y:auto; background:#F1F5F9; border-radius:10px; padding:10px; margin-bottom:10px; display:flex; flex-direction:column; gap:8px;">
            <!-- Messages load here -->
        </div>
        <div style="display:flex; gap:8px;">
            <input type="text" id="adminChatInput" placeholder="اكتب ردك..." style="flex:1; padding:8px; border-radius:8px; border:1px solid #DDD;">
            <button onclick="sendAdminChat('${id}')" style="background:var(--primary); color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer;">رد</button>
        </div>

        <!-- Digital Payment Info -->
        ${(o.paymentMethod === 'vodafone_cash' || o.paymentMethod === 'instapay' || o.paymentProof) ? `
            <div style="background: ${o.status === 'cancelled' ? '#FEF2F2' : '#FFF7ED'}; border: 2px solid ${o.paymentConfirmed ? '#10B981' : (o.status === 'cancelled' ? '#EF4444' : '#F59E0B')}; padding: 15px; border-radius: 15px; margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h5 style="margin: 0; font-size: 0.85rem; color: #1E293B; font-weight: 900;">إثبات الدفع الرقمي</h5>
                    <span style="font-size: 0.65rem; background: ${o.paymentConfirmed ? '#10B981' : (o.status === 'cancelled' ? '#EF4444' : '#F59E0B')}; color: white; padding: 3px 10px; border-radius: 50px; font-weight: 900;">
                        ${o.paymentConfirmed ? 'تم التأكيد ✅' : (o.status === 'cancelled' ? 'تم الرفض ❌' : 'قيد المراجعة ⏳')}
                    </span>
                </div>
                <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                    <div id="receipt-modal-container-${o.id}" style="position: relative; width: 90px; height: 90px; border-radius: 12px; background: #eee; overflow: hidden; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); cursor: pointer;" onclick="if('${o.paymentProof}') openImagePreview('${o.paymentProof}', 'إيصال الدفع')">
                        ${o.paymentProof ? 
                            `<img src="${o.paymentProof}" onerror="this.src='https://ui-avatars.com/api/?name=Error&background=FEE2E2&color=EF4444'" style="width: 100%; height: 100%; object-fit: cover;">` : 
                            `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.6rem; text-align:center; padding:5px;">بانتظار الإيصال</div>`
                        }
                    </div>
                    <div style="flex:1;">
                        <div style="font-size: 0.7rem; color: #64748B; font-weight: 700;">آخر 3 أرقام:</div>
                        <div style="font-size: 1.1rem; font-weight: 900; color: #1E293B;">${o.paymentSenderDigits || '---'}</div>
                        <div style="margin-top: 8px; display: flex; gap: 5px;">
                            <button onclick="if('${o.paymentProof}') openImagePreview('${o.paymentProof}')" style="background:#F1F5F9; border:none; padding:4px 8px; border-radius:6px; font-size:0.6rem; font-weight:800; cursor:pointer;">🔍 تكبير</button>
                            <button onclick="shareOrderImage('${o.paymentProof}', '${o.customer}', '${o.orderNumber || o.id.substring(0,5)}', '${o.phone}')" style="background:#10B98115; color:#10B981; padding:4px 8px; border-radius:6px; font-size:0.6rem; font-weight:800; border:none; cursor:pointer;">💬 واتساب</button>
                        </div>
                    </div>
                </div>
                ${(!o.paymentConfirmed && o.status !== 'cancelled') ? `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button onclick="confirmOrderPayment('${o.id}')" style="background: #10B981; color: white; border: none; padding: 10px; border-radius: 10px; font-weight: 900; cursor: pointer; font-size: 0.8rem;">✅ تأكيد</button>
                        <button onclick="updateOrderStatusManual('${o.id}', 'cancelled')" style="background: #EF4444; color: white; border: none; padding: 10px; border-radius: 10px; font-weight: 900; cursor: pointer; font-size: 0.8rem;">❌ رفض</button>
                    </div>
                ` : (o.status === 'cancelled' ? `
                    <div style="background: #FEE2E2; color: #991B1B; padding: 8px; border-radius: 8px; text-align: center; font-weight: 800; font-size: 0.75rem;">تم رفض الدفع وإلغاء الطلب</div>
                ` : '')}
            </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; font-size:1.2rem; color:var(--primary); font-weight:900; border-top:1px dashed #DDD; padding-top:10px; margin-top:20px;">
            <span>الإجمالي:</span> <span>${o.total.toLocaleString()} ج.م</span>
        </div>
        <button onclick="downloadAdminInvoice('${id}')" class="btn-primary" style="width:100%; margin-top:15px; background:#10b981; border:none; display:flex; align-items:center; justify-content:center; gap:10px;">
            <i data-lucide="file-text" style="width:18px;"></i> تحميل الفاتورة (PDF)
        </button>
    `;
    document.getElementById('orderDetailsModal').style.display = 'flex';
    
    // Setup Admin Chat Listener
    if(adminChatUnsub) adminChatUnsub();
    adminChatUnsub = db.collection('orders').doc(id).collection('chats').orderBy('createdAt', 'asc').onSnapshot(snap => {
        const chatBox = document.getElementById('adminChatBox');
        if(!chatBox) return;
        chatBox.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            const div = document.createElement('div');
            div.style.cssText = `padding:8px 12px; border-radius:12px; font-size:0.8rem; max-width:85%; ${m.sender === 'admin' ? 'align-self:flex-end; background:var(--primary); color:white;' : 'align-self:flex-start; background:white; border:1px solid #DDD;'}`;
            div.textContent = m.text;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    lucide.createIcons();
};

window.sendAdminChat = async (orderId) => {
    const input = document.getElementById('adminChatInput');
    const text = input.value.trim();
    if(!text) return;
    try {
        await db.collection('orders').doc(orderId).collection('chats').add({
            text: text,
            sender: 'admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        input.value = '';
    } catch(err) { console.error(err); }
};

window.updateOrderStatusManual = async (id, newStatus) => {
    // Safely get the trigger element if it exists
    const triggerEl = (typeof event !== 'undefined' && event) ? event.currentTarget : null;
    let originalHTML = "";
    
    try {
        if (triggerEl) {
            triggerEl.disabled = true;
            if (triggerEl.tagName === 'BUTTON') {
                originalHTML = triggerEl.innerHTML;
                triggerEl.innerHTML = `<div class="spin" style="width:14px; height:14px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%;"></div>`;
            }
        }
        
        let updateData = { 
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (newStatus === 'cancelled' || newStatus === 'archived_refused') {
            if (!confirm("هل أنت متأكد من رفض/إلغاء الطلب؟")) {
                if (triggerEl) triggerEl.disabled = false;
                if (triggerEl && triggerEl.tagName === 'BUTTON') triggerEl.innerHTML = originalHTML;
                return;
            }
            updateData.rejectionMessage = "يجب دفع مصاريف التوصيل";
            updateData.rejectionReason = "refused_delivery";
        }
        
        await db.collection('orders').doc(id).update(updateData);
        
        // Handle Referral Reward & Loyalty Points on Completion
        if (newStatus === 'completed') {
            if (typeof window.awardPointsIfCompleted === 'function') await window.awardPointsIfCompleted(id);
            const orderSnap = await db.collection('orders').doc(id).get();
            const o = orderSnap.data();
            
            if (o && o.pendingReferralReward && !o.referralRewardGiven) {
                const { referrerId, amount } = o.pendingReferralReward;
                const referrerRef = db.collection('users').doc(referrerId);
                
                try {
                    await db.runTransaction(async (t) => {
                        const rSnap = await t.get(referrerRef);
                        if (rSnap.exists) {
                            const rBal = rSnap.data().walletBalance || 0;
                            t.update(referrerRef, { walletBalance: rBal + amount });
                            t.update(db.collection('orders').doc(id), { referralRewardGiven: true });
                        }
                    });
                    if (typeof logWalletTransaction === 'function') {
                        logWalletTransaction(referrerId, amount, 'referral', `مكافأة دعوة صديق (الطلب رقم #${o.orderNumber || id.substring(0,5)})`);
                    }
                } catch (err) { console.error("Referral Sync Error:", err); }
            }
        }

        showToast("تم تحديث الحالة بنجاح ✅");
        
        // Immediate UI feedback for all views
        if (triggerEl) triggerEl.disabled = false;
        if (triggerEl && triggerEl.tagName === 'BUTTON') triggerEl.innerHTML = originalHTML;

        // Refresh views without full reload if possible
        if (typeof renderOrdersUI === 'function') renderOrdersUI();
        if (typeof renderOrdersKanban === 'function') renderOrdersKanban();
        if (typeof updateDailySnapshot === 'function') updateDailySnapshot();
        
        // Refresh detail views if open
        const panel = document.getElementById('orderPanel');
        if (panel && panel.classList.contains('active')) openOrderPanel(id);
        
        const modal = document.getElementById('orderDetailsModal');
        if (modal && modal.style.display === 'flex') viewOrder(id);

    } catch (err) { 
        alert("خطأ: " + err.message); 
        if (triggerEl) {
            triggerEl.disabled = false;
            if (triggerEl.tagName === 'BUTTON') triggerEl.innerHTML = originalHTML;
        }
    }
};

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: #1e293b; color: white; padding: 12px 25px; border-radius: 50px;
        font-weight: 800; font-size: 0.9rem; z-index: 10000; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        animation: slideUp 0.3s ease-out;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

window.deleteOrder = async (id) => {
    if(confirm("حذف الطلب نهائياً؟")) {
        await db.collection('orders').doc(id).delete();
        loadOrders();
    }
};

window.openImagePreview = (url, title) => {
    const modal = document.createElement('div');
    modal.id = 'imagePreviewModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 11000;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        backdrop-filter: blur(10px); animation: fadeIn 0.3s ease;
    `;
    modal.innerHTML = `
        <button onclick="this.parentElement.remove()" style="position:absolute; top:30px; right:30px; background:white; border:none; width:50px; height:50px; border-radius:50%; cursor:pointer; font-size:24px; font-weight:bold; color:black; z-index:11001;">×</button>
        <div style="text-align:center; width:90%; max-width:800px;">
            <img src="${url}" style="max-width:100%; max-height:80vh; border-radius:30px; box-shadow:0 20px 50px rgba(0,0,0,0.5); border:5px solid white;">
            <h3 style="color:white; margin-top:20px; font-weight:900; font-size:1.5rem;">${title}</h3>
        </div>
    `;
    document.body.appendChild(modal);
};

window.printThermalReceipt = async (id) => {
    const doc = await db.collection('orders').doc(id).get();
    if(!doc.exists) return;
    const data = doc.data();
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>فاتورة - ${data.orderNumber || id.substring(0,6)}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Cairo', sans-serif; direction: rtl; width: 80mm; margin: 0; padding: 10px; color: #000; }
                .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
                .logo { font-size: 24px; font-weight: 900; margin-bottom: 5px; }
                .info { font-size: 14px; margin-bottom: 15px; line-height: 1.6; }
                .info div { display: flex; justify-content: space-between; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                th { border-bottom: 1px solid #000; text-align: right; font-size: 12px; padding: 5px 0; }
                td { padding: 8px 0; font-size: 13px; font-weight: 700; }
                .total-box { border-top: 2px dashed #000; padding-top: 10px; font-weight: 900; font-size: 18px; display: flex; justify-content: space-between; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; border-top: 1px solid #eee; padding-top: 10px; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="header">
                <div class="logo">متجر مسعودي</div>
                <div style="font-size: 12px;">فاتورة مبيعات</div>
                <div style="font-size: 14px; font-weight: 900; margin-top: 10px;">#${data.orderNumber || id.substring(0,6)}</div>
            </div>
            
            <div class="info">
                <div><span>التاريخ:</span> <span>${data.createdAt ? data.createdAt.toDate().toLocaleDateString('ar-EG') : new Date().toLocaleDateString()}</span></div>
                <div><span>العميل:</span> <span>${data.customer}</span></div>
                <div><span>الهاتف:</span> <span>${data.phone}</span></div>
                <div style="border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px;"><span>العنوان:</span> <span style="font-size: 11px;">${data.address}</span></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>المنتج</th>
                        <th style="text-align: center;">الكمية</th>
                        <th style="text-align: left;">السعر</th>
                    </tr>
                </thead>
                <tbody>
                    ${(data.items || []).map(it => `
                        <tr>
                            <td>${it.name}</td>
                            <td style="text-align: center;">${it.quantity}</td>
                            <td style="text-align: left;">${(it.price * it.quantity).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="info" style="border-top: 1px dashed #000; padding-top: 10px;">
                <div><span>المجموع:</span> <span>${((data.total || 0) - (data.deliveryFee || 0)).toLocaleString()} ج.م</span></div>
                <div><span>التوصيل:</span> <span>${(data.deliveryFee || 0).toLocaleString()} ج.م</span></div>
            </div>
            <div class="total-box">
                <span>الإجمالي:</span>
                <span>${(data.total || 0).toLocaleString()} ج.م</span>
            </div>

            <div class="footer">
                <p>شكراً لتعاملكم معنا ❤️</p>
                <p>01035528656</p>
                <p style="font-size: 10px;">Masoudi Store © 2026</p>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};

window.downloadAdminInvoice = async (id) => {
    const doc = await db.collection('orders').doc(id).get();
    if(!doc.exists) return;
    const data = doc.data();
    
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
                    <p style="color: #94a3b8; margin: 2px 0 0; font-size: 14px;">رقم الطلب: <span style="color: #1e293b; font-weight: 700;">${data.orderNumber || id.substring(0,6)}</span></p>
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
                    <p style="margin: 8px 0; font-size: 15px; display: flex; justify-content: space-between;"><span>التاريخ:</span> <strong>${data.createdAt ? data.createdAt.toDate().toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG')}</strong></p>
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
                    ${(data.items || []).map((item, idx) => `
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
                        <span>${((data.total || 0) - (data.deliveryFee || 0)).toLocaleString()} ج.م</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; opacity: 0.8; font-size: 14px;">
                        <span>رسوم التوصيل:</span>
                        <span>${(data.deliveryFee || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div style="height: 1px; background: rgba(255,255,255,0.2); margin-bottom: 15px;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 18px; font-weight: 700;">الإجمالي الكلي:</span>
                        <span style="font-size: 24px; font-weight: 900; color: #ff6b00;">${(data.total || 0).toLocaleString()} ج.م</span>
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
        
        // Wait for fonts/images
        await document.fonts.ready;
        
        const canvas = await html2canvas(element, { 
            scale: 1.2, 
            useCORS: true, 
            backgroundColor: "#ffffff",
            logging: false,
            imageTimeout: 0
        });
        
        const imgData = canvas.toDataURL('image/png');
        const jsPDF = window.jspdf.jsPDF;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        pdf.save(`Invoice_${data.orderNumber || id.substring(0,6)}.pdf`);
    } catch (err) {
        console.error("PDF Export Error:", err);
        alert("حدث خطأ أثناء تحميل الفاتورة. تأكد من أن اتصالك بالإنترنت مستقر.");
    } finally {
        if(tempDiv.parentNode) document.body.removeChild(tempDiv);
    }
};

// --- Settings Management ---
window.uploadLocalBanner = async (fileInput, targetInputId, previewContainerId) => {
    const file = fileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert("⚠️ يرجى اختيار ملف صورة صالح!");
        return;
    }

    // Determine storage path based on targetInputId
    let storageFolder = 'site_assets';
    if (targetInputId.includes('banner')) storageFolder = 'banners';
    else if (targetInputId.includes('offer')) storageFolder = 'offers';
    else if (targetInputId.includes('Logo') || targetInputId.includes('Favicon') || targetInputId.includes('Icon')) storageFolder = 'site_branding';

    const previewContainer = document.getElementById(previewContainerId);
    let originalHTML = "";
    
    if (previewContainer) {
        previewContainer.style.display = 'flex';
        previewContainer.style.alignItems = 'center';
        previewContainer.style.justifyContent = 'center';
        previewContainer.style.background = 'rgba(0, 0, 0, 0.05)';
        originalHTML = previewContainer.innerHTML;
        previewContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--primary); font-weight: 800; font-size: 0.8rem; width: 100%;">
                <div class="spin" style="width: 24px; height: 24px; border: 3px solid var(--primary); border-top-color: transparent; border-radius: 50%;"></div>
                <span>⏳ جاري رفع الصورة (0%)...</span>
            </div>
        `;
    }

    try {
        const storageRef = firebase.storage().ref().child(`${storageFolder}/${Date.now()}_${file.name}`);
        const uploadTask = storageRef.put(file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                const textSpan = previewContainer ? previewContainer.querySelector('span') : null;
                if (textSpan) {
                    textSpan.textContent = `⏳ جاري رفع الصورة (${progress}%)...`;
                }
            }, 
            (error) => {
                console.error("Upload error:", error);
                alert("❌ حدث خطأ أثناء الرفع: " + error.message);
                if (previewContainer) {
                    previewContainer.innerHTML = originalHTML;
                    previewContainer.style.display = 'none';
                }
            }, 
            async () => {
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                
                const textInput = document.getElementById(targetInputId);
                if (textInput) {
                    textInput.value = downloadURL;
                    textInput.dispatchEvent(new Event('input'));
                }

                if (previewContainer) {
                    previewContainer.style.display = 'flex';
                    previewContainer.style.background = 'none';
                    previewContainer.innerHTML = `<img src="${downloadURL}" style="width: 100%; height: 100%; object-fit: contain;">`;
                }

                showToast("🎉 تم رفع الصورة بنجاح!");
            }
        );
    } catch (err) {
        console.error("Firebase Storage Upload Failed:", err);
        alert("❌ فشل الاتصال بخادم الرفع: " + err.message);
        if (previewContainer) {
            previewContainer.innerHTML = originalHTML;
            previewContainer.style.display = 'none';
        }
    }
};

async function loadAdvancedSettings() {
    const doc = await db.collection('settings').doc('bannerSlider').get();
    if(doc.exists) {
        const data = doc.data();
        if(document.getElementById('sliderDuration')) document.getElementById('sliderDuration').value = data.duration || 5;
        if(document.getElementById('bannerHeightDesktop')) document.getElementById('bannerHeightDesktop').value = data.heightDesktop || 240;
        if(document.getElementById('bannerHeightMobile')) document.getElementById('bannerHeightMobile').value = data.heightMobile ? Math.max(data.heightMobile, 280) : 280;
        if(document.getElementById('bannerWidthDesktop')) document.getElementById('bannerWidthDesktop').value = data.widthDesktop || 1000;
        if(document.getElementById('bannerWidthMobile')) document.getElementById('bannerWidthMobile').value = data.widthMobile || 100;
        (data.slides || []).forEach((s, i) => {
            if(document.getElementById(`bannerImg${i+1}`)) {
                document.getElementById(`bannerImg${i+1}`).value = s.image || '';
                const preview = document.getElementById(`bannerPreview${i+1}`);
                if (preview && s.image) {
                    preview.style.display = 'block';
                    preview.querySelector('img').src = s.image;
                }
            }
            if(document.getElementById(`bannerTitle${i+1}`)) document.getElementById(`bannerTitle${i+1}`).value = s.title || '';
            if(document.getElementById(`bannerSub${i+1}`)) document.getElementById(`bannerSub${i+1}`).value = s.subtitle || '';
        });
    }

    // Load Payment Settings
    const payDoc = await db.collection('settings').doc('payment').get();
    if(payDoc.exists) {
        const pData = payDoc.data();
        if(document.getElementById('vodafoneCashNumber')) document.getElementById('vodafoneCashNumber').value = pData.vodafoneCashNumber || '';
        if(document.getElementById('instapayNumber')) document.getElementById('instapayNumber').value = pData.instapayNumber || '';
        if(document.getElementById('whatsappSupportNumber')) document.getElementById('whatsappSupportNumber').value = pData.whatsappSupportNumber || '';
    }
    if (window.lucide) lucide.createIcons();
}

window.savePaymentSettings = async (e) => {
    e.preventDefault();
    const vNumber = document.getElementById('vodafoneCashNumber').value;
    const iNumber = document.getElementById('instapayNumber').value;
    const wNumber = document.getElementById('whatsappSupportNumber').value;

    try {
        await db.collection('settings').doc('payment').set({
            vodafoneCashNumber: vNumber,
            instapayNumber: iNumber,
            whatsappSupportNumber: wNumber,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("✅ تم حفظ إعدادات الدفع بنجاح!");
    } catch (err) {
        console.error("Save Payment Error:", err);
        alert("❌ فشل الحفظ: " + err.message);
    }
};

const sliderSettingsForm = document.getElementById('sliderSettingsForm');
if(sliderSettingsForm) {
    sliderSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const slides = [];
        for(let i=1; i<=3; i++) {
            slides.push({
                image: document.getElementById(`bannerImg${i}`).value,
                title: document.getElementById(`bannerTitle${i}`).value,
                subtitle: document.getElementById(`bannerSub${i}`).value
            });
        }
        await db.collection('settings').doc('bannerSlider').set({
            duration: parseInt(document.getElementById('sliderDuration').value),
            heightDesktop: parseInt(document.getElementById('bannerHeightDesktop').value) || 240,
            heightMobile: parseInt(document.getElementById('bannerHeightMobile').value) || 280,
            widthDesktop: parseInt(document.getElementById('bannerWidthDesktop').value) || 1000,
            widthMobile: parseInt(document.getElementById('bannerWidthMobile').value) || 100,
            slides,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("تم الحفظ!");
    });
}

window.saveBannerDimensions = async () => {
    try {
        const hDesktop = parseInt(document.getElementById('bannerHeightDesktop').value) || 240;
        const hMobile = parseInt(document.getElementById('bannerHeightMobile').value) || 280;
        const wDesktop = parseInt(document.getElementById('bannerWidthDesktop').value) || 1000;
        const wMobile = parseInt(document.getElementById('bannerWidthMobile').value) || 100;
        
        await db.collection('settings').doc('bannerSlider').update({
            heightDesktop: hDesktop,
            heightMobile: hMobile,
            widthDesktop: wDesktop,
            widthMobile: wMobile,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("✅ تم حفظ مقاسات البنر بنجاح!");
    } catch (err) {
        console.error("Save Dimensions Error:", err);
        alert("❌ فشل الحفظ: " + err.message);
    }
};

// --- Product Modal Logic ---
const productForm = document.getElementById('productForm');
const productModal = document.getElementById('productModal');

if(document.getElementById('addProductBtn')) {
    document.getElementById('addProductBtn').addEventListener('click', () => {
        currentEditId = null;
        productForm.reset();
        document.getElementById('modalTitle').textContent = "إضافة منتج جديد";
        productModal.style.display = 'flex';
    });
}

if(document.getElementById('closeProductModal')) {
    document.getElementById('closeProductModal').addEventListener('click', () => {
        productModal.style.display = 'none';
    });
}

if(productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'جاري الحفظ...';

        try {
            const pImageFile = document.getElementById('pImageFile').files[0];
            const pImageUrl = document.getElementById('pImage').value;
            
            let finalImage = pImageUrl;
            if (pImageFile) {
                finalImage = await uploadFile(pImageFile, 'products');
            }

            const data = {
                name: document.getElementById('pName').value,
                price: parseFloat(document.getElementById('pPrice').value),
                discount: parseFloat(document.getElementById('pDiscount').value),
                stock: parseInt(document.getElementById('pStock').value),
                tag: document.getElementById('pTag').value,
                category: document.getElementById('pCategory').value,
                image: finalImage,
                description: document.getElementById('pDesc').value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if(currentEditId) {
                await db.collection('products').doc(currentEditId).update(data);
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.rating = 5;
                await db.collection('products').add(data);
            }
            
            productModal.style.display = 'none';
            loadProducts();
            showToast("✅ تم حفظ المنتج بنجاح");
        } catch (err) { 
            console.error("Save Product Error:", err);
            alert("❌ فشل الحفظ: " + err.message); 
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

window.editProduct = async (id) => {
    currentEditId = id;
    const doc = await db.collection('products').doc(id).get();
    const p = doc.data();
    document.getElementById('pName').value = p.name || '';
    document.getElementById('pPrice').value = p.price || 0;
    document.getElementById('pDiscount').value = p.discount || 0;
    document.getElementById('pStock').value = p.stock || 0;
    document.getElementById('pTag').value = p.tag || '';
    document.getElementById('pCategory').value = p.category || '';
    document.getElementById('pImage').value = p.image || '';
    document.getElementById('pDesc').value = p.description || '';
    document.getElementById('modalTitle').textContent = "تعديل المنتج: " + (p.name || '');
    
    // Preview image
    const preview = document.getElementById('pImagePreview');
    const container = document.getElementById('pImagePreviewContainer');
    if (p.image) {
        preview.src = p.image;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
    
    productModal.style.display = 'flex';
};

window.deleteProduct = async (id) => {
    if(confirm("حذف المنتج؟")) {
        await db.collection('products').doc(id).delete();
        loadProducts();
    }
};

lucide.createIcons();

// --- Feature 4: Admin Push Notifications (Browser/Audio) ---
let lastOrderCount = -1;
function setupOrderNotifications() {
    console.log("🔔 Notifications setup active...");
    db.collection('orders').where('status', '==', 'pending')
        .onSnapshot(snapshot => {
            // First load: just set the baseline
            if (lastOrderCount === -1) {
                lastOrderCount = snapshot.size;
                console.log("Initial pending orders:", lastOrderCount);
                return;
            }
            
            // On updates: check if count increased
            if (snapshot.size > lastOrderCount) {
                snapshot.docChanges().forEach(change => {
                    if (change.type === "added") {
                        const order = { id: change.doc.id, ...change.doc.data() };
                        console.log("New order detected:", order.id);
                        playNotificationSound();
                        showBrowserNotification("طلب جديد! 🛍️", `طلب من ${order.customer} بقيمة ${order.total} ج.م`);
                        showNewOrderAlert(order);
                        showNotificationDot();
                        if (typeof loadOrders === 'function') {
                            // Don't call loadOrders if it's already listening (it is)
                            // Just let the other listener handle it or force a refresh if needed
                        }
                    }
                });
            }
            lastOrderCount = snapshot.size;
        }, err => console.error("Notification listener error:", err));
}

window.refreshOrdersManual = () => {
    if (ordersUnsub) {
        ordersUnsub();
        ordersUnsub = null;
    }
    loadOrders();
    showToast("🔄 جاري تحديث البيانات...");
};

window.approveRecharge = async (id, userId, amount) => {
    if(!confirm(`تأكيد شحن رصيد بقيمة ${amount} ج.م للعميل؟`)) return;
    try {
        await db.collection('recharges').doc(id).update({ status: 'completed' });
        
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const confSnap = await db.collection('settings').doc('loyaltyConfig').get();
        
        let earnAmount = 1000;
        let earnPoints = 200;
        if (confSnap.exists) {
            earnAmount = confSnap.data().earnAmount || 1000;
            earnPoints = confSnap.data().earnPoints || 200;
        }

        const currentPoints = userSnap.data()?.points || 0;
        let multiplier = 1.0;
        if (currentPoints >= 5000) multiplier = 2.0;
        else if (currentPoints >= 500) multiplier = 1.5;
        const pointsEarned = (amount / earnAmount) * earnPoints * multiplier;

        await userRef.update({
            walletBalance: firebase.firestore.FieldValue.increment(amount),
            points: currentPoints + pointsEarned
        });
        
        alert("✅ تم شحن الرصيد واحتساب النقاط بنجاح");
        if (typeof loadRecharges === "function") loadRecharges();
    } catch(e) { alert("خطأ: " + e.message); }
};

window.exportOrdersCSV = () => {
    try {
        if (!window.allOrders || window.allOrders.length === 0) {
            alert("لا توجد طلبات لتصديرها");
            return;
        }
        
        const headers = ["رقم الطلب", "العميل", "الهاتف", "العنوان", "طريقة الدفع", "الإجمالي", "الحالة", "التاريخ"];
        const rows = window.allOrders.map(o => [
            `#${o.orderNumber || o.id.substring(0,5)}`,
            o.customer || "---",
            o.phone || "---",
            o.address || "---",
            o.paymentMethod || "---",
            o.total || 0,
            o.status || "---",
            o.createdAt ? (typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().toLocaleDateString() : '') : ''
        ]);

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `orders_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Export Error:", err);
        alert("خطأ أثناء تصدير البيانات");
    }
};

function showNewOrderAlert(order) {
    const existing = document.getElementById('newOrderAlertModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'newOrderAlertModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(12px);
        display: flex; align-items: center; justify-content: center;
        z-index: 100000; animation: fadeIn 0.4s ease;
    `;
    
    modal.innerHTML = `
        <div style="background: white; width: 95%; max-width: 500px; border-radius: 35px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.4); animation: zoomIn 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28); border: 1px solid rgba(255,255,255,0.2);">
            <!-- Header with Animated Ring -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 40px 30px; text-align: center; color: white; position: relative; overflow: hidden;">
                <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: var(--primary); opacity: 0.1; border-radius: 50%;"></div>
                <div style="background: var(--primary); width: 85px; height: 85px; border-radius: 25px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; transform: rotate(-10deg); box-shadow: 0 15px 30px rgba(255,107,0,0.4);">
                    <i data-lucide="shopping-bag" style="width: 40px; height: 40px; transform: rotate(10deg);"></i>
                </div>
                <h2 style="margin: 0; font-size: 1.8rem; font-weight: 900; letter-spacing: -0.5px;">طلب جديد قيد الانتظار! ⚡</h2>
                <div style="margin-top: 10px; background: rgba(255,255,255,0.1); display: inline-block; padding: 5px 15px; border-radius: 50px; font-size: 0.85rem; font-weight: 700;">رقم الفاتورة: #${order.orderNumber || '----'}</div>
            </div>
            
            <div style="padding: 35px;">
                <!-- Customer Profile Card -->
                <div style="display: flex; align-items: center; gap: 18px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 24px; border: 1px solid #e2e8f0;">
                    <div style="position: relative;">
                        <img src="${order.userPhoto || 'https://ui-avatars.com/api/?name=U'}" style="width: 65px; height: 65px; border-radius: 20px; object-fit: cover; border: 3px solid white; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                        <span style="position: absolute; bottom: -5px; right: -5px; background: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></span>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 900; font-size: 1.2rem; color: #0f172a;">${order.customer}</div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                            <a href="tel:${order.phone}" style="color: var(--primary); font-weight: 800; font-size: 0.95rem; text-decoration: none; display: flex; align-items: center; gap: 5px;">
                                <i data-lucide="phone" style="width: 14px;"></i> ${order.phone}
                            </a>
                            <a href="${order.location && order.location.startsWith('http') ? order.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address || order.customer)}`}" 
                               target="_blank" style="color: #3b82f6; font-weight: 800; font-size: 0.85rem; text-decoration: none; display: flex; align-items: center; gap: 5px; background: white; padding: 4px 10px; border-radius: 50px; border: 1px solid #e2e8f0;">
                                <i data-lucide="map-pin" style="width: 12px;"></i> الخريطة
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Items Summary -->
                <div style="margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span style="font-size: 0.9rem; font-weight: 800; color: #64748b;">محتويات السلة (${(order.items || []).length})</span>
                    </div>
                    <div style="max-height: 150px; overflow-y: auto; padding-right: 5px; display: flex; flex-direction: column; gap: 10px;">
                        ${(order.items || []).map(it => `
                            <div style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 10px 15px; border-radius: 18px; border: 1px solid #f1f5f9;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <img src="${it.image || 'https://via.placeholder.com/40'}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">
                                    <span style="font-weight: 800; font-size: 0.9rem; color: #1e293b;">${it.name}</span>
                                </div>
                                <span style="font-weight: 900; color: var(--primary); font-size: 0.9rem; background: var(--primary-light); padding: 2px 10px; border-radius: 50px;">x${it.quantity}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Total & Actions -->
                <div style="background: #0f172a; padding: 25px; border-radius: 24px; color: white; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                    <div>
                        <span style="display: block; font-size: 0.8rem; opacity: 0.6; font-weight: 700;">المبلغ الإجمالي</span>
                        <span style="font-size: 1.8rem; font-weight: 900; color: var(--primary);">${order.total.toLocaleString()} <small style="font-size: 0.9rem;">ج.م</small></span>
                    </div>
                    <i data-lucide="wallet" style="width: 35px; height: 35px; opacity: 0.2;"></i>
                </div>

                <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 15px;">
                    <button onclick="openOrderPanel('${order.id}'); document.getElementById('newOrderAlertModal').remove();" style="background: var(--primary); color: white; border: none; padding: 18px; border-radius: 20px; font-weight: 900; cursor: pointer; font-size: 1.1rem; box-shadow: 0 15px 30px rgba(255,107,0,0.3); transition: all 0.3s;">ابدأ التجهيز الآن</button>
                    <button onclick="document.getElementById('newOrderAlertModal').remove()" style="background: #f1f5f9; color: #64748b; border: none; padding: 18px; border-radius: 20px; font-weight: 800; cursor: pointer; font-size: 1rem; transition: all 0.2s;">لاحقاً</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    lucide.createIcons();
}

function playNotificationSound() {
    try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log("Audio play blocked by browser."));
    } catch (err) { console.warn("Audio error", err); }
}

function showBrowserNotification(title, body) {
    try {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
            new Notification(title, { body, icon: './logo.png' });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") new Notification(title, { body, icon: './logo.png' });
            });
        }
    } catch (err) { console.warn("Browser notification error", err); }
}

// --- Feature 7: AI Product Description Generator ---
window.generateAIDescription = () => {
    const nameInput = document.getElementById('pName');
    const descInput = document.getElementById('pDesc');
    if (!nameInput || !nameInput.value) {
        alert("يرجى كتابة اسم المنتج أولاً ليتمكن الذكاء الاصطناعي من وصفه.");
        return;
    }

    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="spin" data-lucide="loader-2"></i> جاري التوليد...';
    lucide.createIcons();

    // AI Simulation (As an AI Assistant, I provide high quality descriptive templates)
    setTimeout(() => {
        const name = nameInput.value;
        const templates = [
            `استمتع بتجربة فريدة مع ${name}، المصمم خصيصاً ليجمع بين الأناقة والجودة العالية. قطعة لا غنى عنها في مجموعتك اليومية.`,
            `يتميز ${name} بتصميم عصري وخامات ممتازة تضمن لك الراحة والمتانة. الخيار الأمثل لمن يبحث عن التميز والعملية في آن واحد.`,
            `ارتقِ بأسلوب حياتك مع ${name}. جودة لا تضاهى وتفاصيل دقيقة تجعله من أكثر المنتجات طلباً لدينا. اطلبه الآن قبل نفاذ الكمية!`
        ];
        const randomDesc = templates[Math.floor(Math.random() * templates.length)];
        descInput.value = randomDesc;
        btn.innerHTML = originalText;
        lucide.createIcons();
    }, 1500);
};

// --- Feature 6: CRM (Customer Management & Wallet) ---
window.allCustomers = [];
window.blockedCustomersList = [];

async function loadCustomers() {
    const list = document.getElementById('adminCustomersList');
    if(!list) return;
    list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 50px;">جاري تحميل بيانات العملاء...</td></tr>';

    try {
        const usersMap = {};
        
        // 1. Get all registered users from 'users' collection
        const usersSnap = await db.collection('users').get();
        usersSnap.forEach(doc => {
            const d = doc.data();
            usersMap[doc.id] = {
                id: doc.id,
                name: d.name || 'عميل مسجل',
                email: d.email || '---',
                phone: d.phone || '---',
                photo: d.photo || d.photoURL || `https://ui-avatars.com/api/?name=${d.name || 'U'}&background=FF6B00&color=fff`,
                walletBalance: d.walletBalance || 0,
                isMerchant: d.isMerchant || false,
                address: d.address || '---',
                location: d.location || d.latlng || null,
                points: d.points || 0,
                ordersCount: 0,
                totalSpent: 0,
                isRegistered: true
            };
        });

        // 2. Get all orders to find guest/legacy customers and aggregate data
        const ordersSnap = await db.collection('orders').get();
        ordersSnap.forEach(doc => {
            const o = doc.data();
            const uid = o.userId;
            const phone = o.phone;

            // If user is registered, aggregate by UID
            if (uid && usersMap[uid]) {
                usersMap[uid].ordersCount++;
                usersMap[uid].totalSpent += Number(o.total) || 0;
                if (o.phone && usersMap[uid].phone === '---') usersMap[uid].phone = o.phone;
                if (o.address && usersMap[uid].address === '---') usersMap[uid].address = o.address;
            } 
            // If guest/legacy (no UID or not in usersMap), aggregate by Phone
            else if (phone) {
                if (!usersMap[phone]) {
                    usersMap[phone] = {
                        id: phone, // use phone as fallback ID
                        name: o.customer || 'عميل مجهول',
                        email: o.userEmail || 'غير مسجل',
                        phone: phone,
                        photo: o.userPhoto || `https://ui-avatars.com/api/?name=${o.customer || 'G'}&background=64748b&color=fff`,
                        walletBalance: 0,
                        address: o.address || '---',
                        location: o.location || null,
                        points: 0,
                        ordersCount: 0,
                        totalSpent: 0,
                        isRegistered: false
                    };
                }
                usersMap[phone].ordersCount++;
                usersMap[phone].totalSpent += Number(o.total) || 0;
            }
        });

        const blockedSnap = await db.collection('blockedUsers').get();
        window.blockedCustomersList = blockedSnap.docs.map(d => d.id);

        window.allCustomers = Object.values(usersMap);
        if (window.allCustomers.length === 0) {
            list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--gray-500);">لا يوجد عملاء حالياً</td></tr>';
            return;
        }

        // Sort: Registered users first, then by total spent
        window.allCustomers.sort((a, b) => (b.isRegistered - a.isRegistered) || (b.totalSpent - a.totalSpent));

        renderCustomersList(window.allCustomers);
    } catch (err) { 
        console.error("CRM Load Error:", err);
        list.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#ef4444; padding: 30px;">حدث خطأ أثناء تحميل البيانات: ' + err.message + '</td></tr>';
    }
}

function renderCustomersList(customersArray) {
    const list = document.getElementById('adminCustomersList');
    if (!list) return;

    if (customersArray.length === 0) {
        list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--gray-500);">لا توجد نتائج مطابقة للبحث</td></tr>';
        return;
    }

    list.innerHTML = customersArray.map(u => {
        const pts = u.points || 0;
        let lvlBadge = '';
        if (pts >= 5000) {
            lvlBadge = '<div style="font-size: 0.65rem; color: #d97706; font-weight: 800; margin-top: 5px; display: flex; align-items: center; justify-content: center; gap: 3px;"><i data-lucide="crown" style="width: 11px;"></i> ذهبي 👑</div>';
        } else if (pts >= 500) {
            lvlBadge = '<div style="font-size: 0.65rem; color: #4b5563; font-weight: 800; margin-top: 5px; display: flex; align-items: center; justify-content: center; gap: 3px;"><i data-lucide="award" style="width: 11px;"></i> فضي 🥈</div>';
        } else {
            lvlBadge = '<div style="font-size: 0.65rem; color: #b45309; font-weight: 800; margin-top: 5px; display: flex; align-items: center; justify-content: center; gap: 3px;"><i data-lucide="award" style="width: 11px;"></i> برونزي 🥉</div>';
        }

        return `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${u.photo || u.photoURL || 'https://ui-avatars.com/api/?name=' + (u.name || 'U')}" style="width:45px; height:45px; border-radius:12px; object-fit:cover; border:2px solid #f1f5f9;">
                    <div>
                        <div style="font-weight:900; color:#1e293b;">${u.name || 'عميل مسعودي'}</div>
                        <div style="font-size:0.75rem; color:#64748b; font-weight:700;">${u.phone || 'بدون رقم'}</div>
                    </div>
                </div>
            </td>
            <td>
                <div style="font-size:0.8rem; color:#64748b; font-weight:700;">${u.email}</div>
                <div style="font-size:0.7rem; color:#94a3b8; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${u.address || 'بدون عنوان'}</div>
            </td>
            <td style="text-align:center;"><span style="background:#f1f5f9; padding:4px 12px; border-radius:50px; font-weight:700; font-size:0.8rem;">${u.ordersCount}</span></td>
            <td style="font-weight:900; color:#64748b;">${u.totalSpent.toLocaleString()} ج.م</td>
            <td>
                <div style="background: #FFF7ED; padding: 8px 12px; border-radius: 12px; border: 1px solid #FFEDD5; display: inline-block; margin-bottom: 5px;">
                    <div style="font-size: 0.65rem; color: #9A3412; font-weight: 800; margin-bottom: 2px;">المحفظة</div>
                    <div style="font-weight: 900; color: #C2410C; font-size: 1rem;">${(u.walletBalance || 0).toLocaleString()} <small>ج.م</small></div>
                </div>
            </td>

            <td>
                ${u.location || u.latlng ? 
                    `<a href="${u.location || `https://www.google.com/maps/search/?api=1&query=${u.latlng}`}" target="_blank" style="color:#3b82f6; text-decoration:none; display:flex; align-items:center; gap:5px; font-size:0.8rem; font-weight:700;">
                        <i data-lucide="map-pin" style="width:14px;"></i> الخريطة
                     </a>` : 
                    '<span style="color:#94a3b8; font-size:0.7rem;">غير متوفر</span>'
                }
            </td>
            <td>
                <div style="display:flex; gap:8px;">
                    <button onclick="openWalletModal('${u.id}', ${u.walletBalance || 0})" class="btn-action" title="تعديل المحفظة" style="color:#FF6B00; display:flex; align-items:center; justify-content:center; width:35px; height:35px; border-radius:10px; border:1px solid #FFEDD5; background:#FFF7ED; cursor:pointer;"><i data-lucide="wallet" style="width:16px;"></i></button>

                    
                    ${u.isRegistered ? `
                        <button onclick="toggleMerchantStatus('${u.id}', ${u.isMerchant || false})" class="btn-action" title="${u.isMerchant ? 'إلغاء صفة تاجر' : 'ترقية لتاجر'}" style="color:${u.isMerchant ? '#8b5cf6' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; width:35px; height:35px; border-radius:10px; border:1px solid ${u.isMerchant ? '#ddd6fe' : '#e2e8f0'}; background:${u.isMerchant ? '#f5f3ff' : 'white'}; cursor:pointer;">
                            <i data-lucide="${u.isMerchant ? 'shield-check' : 'shield'}" style="width:16px;"></i>
                        </button>
                    ` : ''}

                    <button onclick="viewCustomerOrders('${u.phone}')" class="btn-action" title="عرض الطلبات" style="display:flex; align-items:center; justify-content:center; width:35px; height:35px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:pointer;"><i data-lucide="eye" style="width:16px;"></i></button>
                    
                    ${window.blockedCustomersList.includes(u.phone) ? 
                        `<button onclick="unblockCustomer('${u.phone}')" class="btn-action" style="color:#10b981; display:flex; align-items:center; justify-content:center; width:35px; height:35px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:pointer;" title="إلغاء الحظر"><i data-lucide="user-check" style="width:16px;"></i></button>` :
                        `<button onclick="blockCustomer('${u.phone}')" class="btn-action" style="color:#ef4444; display:flex; align-items:center; justify-content:center; width:35px; height:35px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:pointer;" title="حظر"><i data-lucide="user-x" style="width:16px;"></i></button>`
                    }
                </div>
            </td>
        </tr>
        `;
    }).join('');
    
    if (window.lucide) lucide.createIcons();
}

window.filterCustomersByEmail = () => {
    const input = document.getElementById('customerSearchInput');
    if (!input) return;
    
    const query = input.value.trim().toLowerCase();
    
    if (!query) {
        renderCustomersList(window.allCustomers);
        return;
    }
    
    const filtered = window.allCustomers.filter(c => {
        const email = c.email ? String(c.email).toLowerCase() : '';
        const name = c.name ? String(c.name).toLowerCase() : '';
        const phone = c.phone ? String(c.phone).toLowerCase() : '';
        
        // Exact matching for phone if query is numbers only
        if (/^[\d+]+$/.test(query)) {
            if (phone !== '---' && phone.includes(query)) return true;
            return false;
        }

        // Email matching (Prioritized)
        if (email !== '---' && email.includes(query)) return true;
        
        // Name matching (Ignore default placeholders)
        if (name !== 'عميل مسجل' && name !== 'عميل مجهول' && name.includes(query)) return true;

        return false;
    });
    
    renderCustomersList(filtered);
};

window.openWalletModal = (userId, currentBalance) => {
    document.getElementById('walletUserId').value = userId;
    document.getElementById('newWalletBalance').value = currentBalance;
    document.getElementById('walletModal').style.display = 'flex';
    lucide.createIcons();
};

window.closeWalletModal = () => {
    document.getElementById('walletModal').style.display = 'none';
};

window.saveWalletBalance = async () => {
    const userId = document.getElementById('walletUserId').value;
    const newBalance = Number(document.getElementById('newWalletBalance').value);
    
    if (isNaN(newBalance)) {
        alert("يرجى إدخال مبلغ صحيح");
        return;
    }

    try {
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const oldBalance = userSnap.data().walletBalance || 0;
        const currentPoints = userSnap.data().points || 0;
        const diff = newBalance - oldBalance;
        
        let newPoints = currentPoints;
        if (diff > 0) {
            let earnAmount = 1000;
            let earnPoints = 200;
            try {
                const confSnap = await db.collection('settings').doc('loyaltyConfig').get();
                if (confSnap.exists) {
                    earnAmount = confSnap.data().earnAmount || 1000;
                    earnPoints = confSnap.data().earnPoints || 200;
                }
            } catch(e) {}
            let multiplier = 1.0;
            if (currentPoints >= 5000) multiplier = 2.0;
            else if (currentPoints >= 500) multiplier = 1.5;
            newPoints += (diff / earnAmount) * earnPoints * multiplier;
        }

        await userRef.update({
            walletBalance: newBalance,
            points: newPoints,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (diff !== 0) {
            await logWalletTransaction(userId, diff, diff > 0 ? 'recharge' : 'deduction', 
                diff > 0 ? 'شحن رصيد من قبل الإدارة' : 'سحب رصيد من قبل الإدارة');
        }

        showToast("✅ تم تحديث رصيد المحفظة بنجاح");
        closeWalletModal();
        loadCustomers();
    } catch (err) {
        alert("فشل التحديث: " + err.message);
    }
};

async function logWalletTransaction(userId, amount, type, description) {
    try {
        await db.collection('walletTransactions').add({
            userId: userId,
            amount: amount,
            type: type,
            description: description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Transaction logged successfully");
    } catch (e) {
        console.error("Failed to log transaction:", e);
        throw new Error("فشل تسجيل العملية في السجل: " + e.message);
    }
}


window.viewCustomerOrders = (phone) => {
    // Redirect to orders page with a filter or search (Simplified for now)
    window.location.href = `admin-orders.html?search=${phone}`;
};

window.blockCustomer = async (phone) => {
    if(!confirm(`هل أنت متأكد من حظر العميل صاحب الرقم ${phone}؟ لن يتمكن من الطلب مجدداً.`)) return;
    try {
        // 1. Block phone number specifically
        await db.collection('blockedUsers').doc(phone).set({ blockedAt: firebase.firestore.FieldValue.serverTimestamp() });
        
        // 2. Synchronize with 'users' collection (finding any user linked to this phone)
        const usersWithPhone = await db.collection('users').where('phone', '==', phone).get();
        if (!usersWithPhone.empty) {
            const batch = db.batch();
            usersWithPhone.forEach(doc => {
                batch.update(db.collection('users').doc(doc.id), { 
                    isBanned: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
            console.log(`Synced ban status for ${usersWithPhone.size} user documents.`);
        }
        
        showToast("🚫 تم حظر العميل بنجاح");
        loadCustomers();
    } catch (err) {
        alert("فشل الحظر: " + err.message);
    }
};

window.toggleMerchantStatus = async (userId, currentStatus) => {
    const newStatus = !currentStatus;
    if(!confirm(`هل تريد ${newStatus ? 'ترقية هذا العميل لتاجر والموافقة على متجره؟' : 'إلغاء صفة التاجر عن هذا العميل؟'}`)) return;
    
    try {
        await db.collection('users').doc(userId).set({
            isMerchant: newStatus,
            merchantStatus: newStatus ? 'approved' : 'rejected',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await db.collection('merchants').doc(userId).set({
            status: newStatus ? 'approved' : 'rejected',
            isApproved: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast(`✅ تم ${newStatus ? 'الترقية وتفعيل المتجر' : 'إلغاء صفة التاجر'} بنجاح`);
        if (typeof loadCustomers === 'function') loadCustomers();
        if (typeof loadMerchants === 'function') loadMerchants();
    } catch(err) {
        alert("فشل التحديث: " + err.message);
    }
};

window.unblockCustomer = async (phone) => {
    if(!confirm(`هل أنت متأكد من إلغاء حظر الرقم ${phone}؟`)) return;
    try {
        // 1. Remove phone block
        await db.collection('blockedUsers').doc(phone).delete();
        
        // 2. Synchronize with 'users' collection
        const usersWithPhone = await db.collection('users').where('phone', '==', phone).get();
        if (!usersWithPhone.empty) {
            const batch = db.batch();
            usersWithPhone.forEach(doc => {
                batch.update(db.collection('users').doc(doc.id), { 
                    isBanned: false,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
        }
        
        showToast("✅ تم إلغاء الحظر بنجاح");
        loadCustomers();
    } catch (err) {
        alert("فشل إلغاء الحظر: " + err.message);
    }
};

// --- Feature 5: Site Customizer (Settings) ---
async function loadSiteConfig() {
    const form = document.getElementById('siteConfigForm');
    if (!form) return;

    try {
        const doc = await db.collection('settings').doc('siteConfig').get();
        if (doc.exists) {
            const data = doc.data();
            if (document.getElementById('primaryColor')) document.getElementById('primaryColor').value = data.primaryColor || '#FF6B00';
            if (document.getElementById('welcomeTitle')) document.getElementById('welcomeTitle').value = data.welcomeTitle || 'أهلاً بكم في متجر مسعودي';
            if (document.getElementById('welcomeSub')) document.getElementById('welcomeSub').value = data.welcomeSub || 'اكتشف عروضنا الحصرية الآن';
            if (document.getElementById('siteLogo')) document.getElementById('siteLogo').value = data.siteLogo || '';
            if (document.getElementById('siteFavicon')) document.getElementById('siteFavicon').value = data.siteFavicon || '';
            if (document.getElementById('startupIcon')) document.getElementById('startupIcon').value = data.startupIcon || '';
            if (document.getElementById('geminiApiKey')) {
                if (data.geminiApiKey) {
                    document.getElementById('geminiApiKey').placeholder = "✅ مفتاح Gemini محفوظ - اترك فارغاً للإبقاء أو أدخل جديداً للتغيير";
                } else {
                    document.getElementById('geminiApiKey').placeholder = "أدخل مفتاح Gemini API هنا لتفعيل الأسئلة الحرة...";
                }
            }

            // Set Previews
            const brandingPreviews = [
                { id: 'siteLogo', previewID: 'siteLogoPreview' },
                { id: 'siteFavicon', previewID: 'siteFaviconPreview' },
                { id: 'startupIcon', previewID: 'startupIconPreview' }
            ];

            brandingPreviews.forEach(p => {
                const val = data[p.id];
                const previewEl = document.getElementById(p.previewID);
                if (val && previewEl) {
                    previewEl.style.display = 'flex';
                    previewEl.querySelector('img').src = val;
                }
            });

            if (data.primaryColor) {
                document.documentElement.style.setProperty('--primary', data.primaryColor);
            }
        }
    } catch (err) {
        console.error("Error loading site config:", err);
    }
}

async function loadLoyaltyConfig() {
    const form = document.getElementById('loyaltyConfigForm');
    if(!form) return;
    try {
        const doc = await db.collection('settings').doc('loyaltyConfig').get();
        if(doc.exists) {
            const data = doc.data();
            if (document.getElementById('loyaltyEarnAmount')) document.getElementById('loyaltyEarnAmount').value = data.earnAmount || 1000;
            if (document.getElementById('loyaltyEarnPoints')) document.getElementById('loyaltyEarnPoints').value = data.earnPoints || 200;
            if (document.getElementById('loyaltyRedeemThreshold')) document.getElementById('loyaltyRedeemThreshold').value = data.redeemThreshold || 200;
            if (document.getElementById('loyaltyRedeemValue')) document.getElementById('loyaltyRedeemValue').value = data.redeemValue || 10;
            if (document.getElementById('loyaltyLevelCollecting')) document.getElementById('loyaltyLevelCollecting').value = data.levelCollecting || 'جمع النقاط';
            if (document.getElementById('loyaltyLevelReady')) document.getElementById('loyaltyLevelReady').value = data.levelReady || 'مكافأة جاهزة';
            if (document.getElementById('loyaltySuccessMessage')) document.getElementById('loyaltySuccessMessage').value = data.successMessage || '🎁 مبروك! الشريط ممتلئ، استبدل الآن';
        }
    } catch (err) { console.error(err); }
}

window.saveLoyaltyConfig = async (e) => {
    e.preventDefault();
    const earnAmount = Number(document.getElementById('loyaltyEarnAmount').value) || 1000;
    const earnPoints = Number(document.getElementById('loyaltyEarnPoints').value) || 200;
    const redeemThreshold = Number(document.getElementById('loyaltyRedeemThreshold').value) || 200;
    const redeemValue = Number(document.getElementById('loyaltyRedeemValue').value) || 10;
    const levelCollecting = document.getElementById('loyaltyLevelCollecting').value || 'جمع النقاط';
    const levelReady = document.getElementById('loyaltyLevelReady').value || 'مكافأة جاهزة';
    const successMessage = document.getElementById('loyaltySuccessMessage').value || '🎁 مبروك! الشريط ممتلئ، استبدل الآن';

    const configData = {
        earnAmount, earnPoints, redeemThreshold, redeemValue, levelCollecting, levelReady, successMessage,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'جاري الحفظ...';
        await db.collection('settings').doc('loyaltyConfig').set(configData, { merge: true });
        alert("✅ تم حفظ إعدادات النقاط بنجاح!");
    } catch (err) { 
        alert(err.message); 
    } finally {
        const btn = e.target.querySelector('button');
        btn.disabled = false;
        btn.textContent = 'حفظ إعدادات النقاط';
    }
};

window.saveSiteConfig = async (e) => {
    e.preventDefault();
    const primaryColor = document.getElementById('primaryColor').value;
    const welcomeTitle = document.getElementById('welcomeTitle').value;
    const welcomeSub = document.getElementById('welcomeSub').value;
    const siteLogo = document.getElementById('siteLogo').value;
    const siteFavicon = document.getElementById('siteFavicon') ? document.getElementById('siteFavicon').value : '';
    const startupIcon = document.getElementById('startupIcon') ? document.getElementById('startupIcon').value : '';
    const geminiKeyInput = document.getElementById('geminiApiKey') ? document.getElementById('geminiApiKey').value.trim() : '';

    const configData = {
        primaryColor, welcomeTitle, welcomeSub, siteLogo, siteFavicon, startupIcon,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Only save geminiApiKey if a valid key is provided (starts with AIza)
    if (geminiKeyInput && geminiKeyInput.startsWith('AIza')) {
        configData.geminiApiKey = geminiKeyInput;
    } else if (geminiKeyInput && !geminiKeyInput.startsWith('AIza')) {
        alert("تحذير: مفتاح Gemini غير صحيح. يجب أن يبدأ بحروف AIzaSy - سيتم حفظ باقي الإعدادات بدون حفظ المفتاح.");
    }
    // If empty - keep the existing key (merge ensures previous value is preserved)

    try {
        await db.collection('settings').doc('siteConfig').set(configData, { merge: true });
        alert("تم حفظ إعدادات الموقع بنجاح! سيتم تطبيق التغييرات فوراً.");
    } catch (err) { alert(err.message); }
};

// Auto-load config when script reaches this point
loadSiteConfig();
loadLoyaltyConfig();

// --- Feature 8: Admin & Roles Management ---
async function loadAdmins() {
    const list = document.getElementById('adminUsersList');
    const countEl = document.getElementById('adminsCount');
    if(!list) return;
    list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 50px;">جاري تحميل المشرفين...</td></tr>';

    try {
        const snap = await db.collection('admins').get();
        if (countEl) countEl.textContent = snap.size;

        list.innerHTML = snap.docs.map(doc => {
            const a = doc.data();
            const email = doc.id;
            const perms = a.permissions || [];
            
            const permIcons = {
                'dashboard': { icon: 'layout-dashboard', label: 'إحصائيات' },
                'products': { icon: 'package', label: 'منتجات' },
                'orders': { icon: 'shopping-bag', label: 'طلبات' },
                'customers': { icon: 'users', label: 'عملاء' },
                'permissions': { icon: 'shield-check', label: 'صلاحيات' },
                'settings': { icon: 'settings', label: 'إعدادات' }
            };

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 20px 30px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="https://ui-avatars.com/api/?name=${a.name}&background=f1f5f9&color=1e293b&bold=true" style="width: 40px; height: 40px; border-radius: 12px;">
                            <strong style="color: #1e293b; font-weight: 800;">${a.name}</strong>
                        </div>
                    </td>
                    <td style="padding: 20px 30px; color: #64748b; font-weight: 600;">${email}</td>
                    <td style="padding: 20px 30px;">
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${(email === ADMIN_EMAIL || a.role === 'super_admin') ? 
                                '<span style="background: #1e293b; color: white; padding: 4px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 800;">كامل الصلاحيات</span>' :
                                perms.map(p => `
                                    <span title="${permIcons[p]?.label}" style="background: #f1f5f9; color: #475569; width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0;">
                                        <i data-lucide="${permIcons[p]?.icon}" style="width: 14px;"></i>
                                    </span>
                                `).join('')
                            }
                        </div>
                    </td>
                    <td style="padding: 20px 30px;">
                        ${email !== ADMIN_EMAIL ? `
                            <div style="display: flex; gap: 10px;">
                                <button onclick="editAdmin('${email}')" class="btn-action" style="color:#3b82f6; background:white; border:1px solid #e2e8f0; padding: 8px; border-radius: 10px; cursor:pointer;"><i data-lucide="edit-3" style="width: 16px;"></i></button>
                                <button onclick="deleteAdmin('${email}')" class="btn-action" style="color:#ef4444; background:white; border:1px solid #e2e8f0; padding: 8px; border-radius: 10px; cursor:pointer;"><i data-lucide="trash-2" style="width: 16px;"></i></button>
                            </div>
                        ` : '<span style="font-size:0.75rem; color:#94a3b8; font-weight: 800; background: #f8fafc; padding: 5px 15px; border-radius: 50px;">المالك الأساسي</span>'}
                    </td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

window.addAdmin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const name = document.getElementById('adminNameInput').value;
    const perms = Array.from(document.querySelectorAll('.perm-check:checked')).map(cb => cb.value);

    if (perms.length === 0) {
        alert("يرجى اختيار صلاحية واحدة على الأقل!");
        return;
    }

    try {
        await db.collection('admins').doc(email).set({
            name, 
            permissions: perms,
            role: perms.length >= 6 ? 'super_admin' : 'custom',
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        alert("✅ تم حفظ بيانات المشرف بنجاح!");
        loadAdmins();
        resetAdminForm();
    } catch (err) { alert(err.message); }
};

window.editAdmin = async (email) => {
    const doc = await db.collection('admins').doc(email).get();
    if (doc.exists) {
        const a = doc.data();
        document.getElementById('adminEmail').value = email;
        document.getElementById('adminNameInput').value = a.name;
        
        const perms = a.permissions || [];
        document.querySelectorAll('.perm-check').forEach(cb => {
            cb.checked = perms.includes(cb.value);
        });
        
        document.querySelector('#addAdminForm button[type="submit"]').textContent = "تحديث الصلاحيات";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.resetAdminForm = () => {
    document.getElementById('addAdminForm').reset();
    document.querySelector('#addAdminForm button[type="submit"]').textContent = "تفعيل الصلاحيات وحفظ المشرف";
};

window.deleteAdmin = async (email) => {
    await db.collection('admins').doc(email).delete();
    loadAdmins();
};

window.updateOrderField = async (id, field, value) => {
    try {
        await db.collection('orders').doc(id).update({
            [field]: value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) { console.error(err); }
};

window.printThermalReceipt = async (id) => {
    const doc = await db.collection('orders').doc(id).get();
    const o = doc.data();
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <style>
                @page { margin: 0; }
                body { font-family: 'Courier New', monospace; padding: 20px; font-size: 14px; line-height: 1.4; color: black; }
                .center { text-align: center; }
                .line { border-top: 1px dashed black; margin: 10px 0; }
                .bold { font-weight: bold; }
                table { width: 100%; border-collapse: collapse; }
                .footer { font-size: 10px; margin-top: 20px; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="center">
                <h2 style="margin:0;">مسعودي - Masoudi</h2>
                <p>طلب رقم: #${o.orderNumber || id.substring(0,5)}</p>
                <p>التاريخ: ${new Date().toLocaleString('ar-EG')}</p>
            </div>
            <div class="line"></div>
            <p>العميل: ${o.customer}</p>
            <p>الهاتف: ${o.phone}</p>
            <p>العنوان: ${o.address}</p>
            <div class="line"></div>
            <table>
                <thead>
                    <tr>
                        <th align="right">المنتج</th>
                        <th align="center">ك</th>
                        <th align="left">س</th>
                    </tr>
                </thead>
                <tbody>
                    ${(o.items || []).map(it => `
                        <tr>
                            <td>${it.name}</td>
                            <td align="center">${it.quantity}</td>
                            <td align="left">${it.price}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="line"></div>
            <div class="bold" style="display:flex; justify-content:space-between;">
                <span>الإجمالي:</span>
                <span>${o.total} ج.م</span>
            </div>
            <div class="line"></div>
            <div class="center footer">
                شكراً لتسوقكم من مسعودي!<br>
                نتمنى لكم يوماً سعيداً
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};


async function loadPaymentSettings() {
    try {
        const doc = await db.collection('settings').doc('store').get();
        if (doc.exists) {
            const data = doc.data();
            if (document.getElementById('vodafoneCashNumber')) document.getElementById('vodafoneCashNumber').value = data.vodafoneCashNumber || '';
            if (document.getElementById('rechargeNumber')) document.getElementById('rechargeNumber').value = data.rechargeNumber || '';
            if (document.getElementById('instapayNumber')) document.getElementById('instapayNumber').value = data.instapayNumber || '';
            if (document.getElementById('whatsappSupportNumber')) document.getElementById('whatsappSupportNumber').value = data.whatsappSupportNumber || '';
            
            // Load Delivery Settings
            if (document.getElementById('pricePerKm')) document.getElementById('pricePerKm').value = data.pricePerKm || 15;
            if (document.getElementById('storeLat')) document.getElementById('storeLat').value = data.storeLat || '';
            if (document.getElementById('storeLng')) document.getElementById('storeLng').value = data.storeLng || '';
        }
    } catch (err) { console.error("Load Settings Error:", err); }
}

window.saveDeliverySettings = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = 'جاري الحفظ...';

    const pricePerKm = parseFloat(document.getElementById('pricePerKm').value) || 15;
    const storeLat = document.getElementById('storeLat').value;
    const storeLng = document.getElementById('storeLng').value;

    try {
        await db.collection('settings').doc('store').set({
            pricePerKm,
            storeLat,
            storeLng
        }, { merge: true });
        alert('تم حفظ إعدادات التوصيل بنجاح ✅');
    } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء الحفظ');
    } finally {
        btn.disabled = false;
        btn.innerText = 'حفظ إعدادات التوصيل';
    }
}

window.getCurrentAdminLocation = () => {
    if (!navigator.geolocation) return alert("متصفحك لا يدعم تحديد الموقع");
    
    alert("جاري تحديد موقع المتجر... يرجى السماح بالوصول");
    navigator.geolocation.getCurrentPosition(pos => {
        document.getElementById('storeLat').value = pos.coords.latitude;
        document.getElementById('storeLng').value = pos.coords.longitude;
        alert("تم تحديد موقعك بنجاح ✅");
    }, err => {
        console.error(err);
        alert("فشل تحديد الموقع. يرجى إدخال الإحداثيات يدوياً.");
    });
}

window.savePaymentSettings = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';

    const config = {
        vodafoneCashNumber: document.getElementById('vodafoneCashNumber').value,
        rechargeNumber: document.getElementById('rechargeNumber').value,
        instapayNumber: document.getElementById('instapayNumber').value,
        whatsappSupportNumber: document.getElementById('whatsappSupportNumber').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('settings').doc('store').set(config, { merge: true });
        alert("✅ تم حفظ إعدادات الدفع بنجاح!");
    } catch (err) {
        alert("❌ فشل الحفظ: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'حفظ إعدادات الدفع';
    }
};

// Load settings if on settings page
if (document.getElementById('paymentSettingsForm') || document.getElementById('deliverySettingsForm')) {
    loadPaymentSettings();
}

// --- Feature 9: Wallet Recharge Management ---
async function loadRechargeRequests() {
    const list = document.getElementById('adminRechargeList');
    if(!list) return;
    list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 50px;">جاري تحميل الطلبات...</td></tr>';

    try {
        const snap = await db.collection('rechargeRequests').orderBy('createdAt', 'desc').get();
        if (snap.empty) {
            list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #64748b;">لا توجد طلبات شحن حالياً</td></tr>';
            return;
        }

        const requests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Fetch all unique users in these requests for better details
        const userIds = [...new Set(requests.map(r => r.userId))];
        const usersData = {};
        for(let uid of userIds) {
            const uDoc = await db.collection('users').doc(uid).get();
            if(uDoc.exists) usersData[uid] = uDoc.data();
        }

        list.innerHTML = requests.map(r => {
            const u = usersData[r.userId] || {};
            const statusClass = r.status === 'pending' ? 'status-pending' : (r.status === 'approved' ? 'status-completed' : 'status-cancelled');
            const statusText = r.status === 'pending' ? 'انتظار' : (r.status === 'approved' ? 'تم الشحن' : 'مرفوض');

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 15px 20px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${u.photo || 'https://ui-avatars.com/api/?name=' + (u.name || 'U')}" style="width:40px; height:40px; border-radius:10px; object-fit:cover;">
                            <div>
                                <div style="font-weight: 800; color: #1e293b; font-size:0.9rem;">${u.name || r.userName || 'عميل'}</div>
                                <div style="font-size: 0.7rem; color: #94a3b8;">${u.email || 'غير مسجل'}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-size:0.8rem; color:#64748b; margin-bottom:4px;">المحول منه:</div>
                        <a href="tel:${r.senderPhone}" style="color:var(--primary); font-weight:800; text-decoration:none; font-size:0.9rem; display:block; border:1px dashed #fed7aa; padding:4px 8px; border-radius:8px; background:#fff7ed; text-align:center;">${r.senderPhone || '---'}</a>
                    </td>
                    <td style="font-weight: 900; color: #10b981; font-size:1.1rem;">${r.amount} ج.م</td>
                    <td style="font-size: 0.8rem; color: #64748b;">${r.createdAt ? r.createdAt.toDate().toLocaleString('ar-EG') : '---'}</td>
                    <td><span class="status-badge ${statusClass}" style="padding: 5px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 800;">${statusText}</span></td>
                    <td>
                        ${r.status === 'pending' ? `
                            <div style="display: flex; gap: 8px;">
                                <button onclick="approveRecharge('${r.id}', '${r.userId}', ${r.amount})" class="btn-action" style="color:#10b981; border:1px solid #dcfce7; background:#f0fdf4; padding:8px; border-radius:10px; cursor:pointer;" title="موافقة"><i data-lucide="check-circle" style="width:18px;"></i></button>
                                <button onclick="rejectRecharge('${r.id}')" class="btn-action" style="color:#ef4444; border:1px solid #fee2e2; background:#fef2f2; padding:8px; border-radius:10px; cursor:pointer;" title="رفض"><i data-lucide="x-circle" style="width:18px;"></i></button>
                            </div>
                        ` : '<span style="color:#94a3b8; font-size:0.7rem; font-weight:700;">تمت المراجعة</span>'}
                    </td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

window.approveRecharge = async (reqId, userId, amount) => {
    if(!confirm(`تأكيد استلام مبلغ ${amount} ج.م؟ سيتم شحن رصيد العميل فوراً.`)) return;

    try {
        const userRef = db.collection('users').doc(userId);
        await db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            const confSnap = await transaction.get(db.collection('settings').doc('loyaltyConfig'));
            
            let earnAmount = 1000;
            let earnPoints = 200;
            if (confSnap.exists) {
                earnAmount = confSnap.data().earnAmount || 1000;
                earnPoints = confSnap.data().earnPoints || 200;
            }
            
            const currentBalance = userSnap.data()?.walletBalance || 0;
            const currentPoints = userSnap.data()?.points || 0;
            
            let multiplier = 1.0;
            if (currentPoints >= 5000) multiplier = 2.0;
            else if (currentPoints >= 500) multiplier = 1.5;

            const pointsEarned = (amount / earnAmount) * earnPoints * multiplier;
            
            transaction.update(userRef, { 
                walletBalance: currentBalance + amount,
                points: currentPoints + pointsEarned,
                lastRechargeAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            transaction.update(db.collection('rechargeRequests').doc(reqId), { 
                status: 'approved',
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        // Log transaction for history
        await logWalletTransaction(userId, amount, 'recharge', 'شحن رصيد (طلب شحن)');

        alert("✅ تم شحن رصيد العميل بنجاح!");
        loadRechargeRequests();
    } catch (err) { alert("فشل العملية: " + err.message); }
};

window.rejectRecharge = async (reqId) => {
    if(!confirm("رفض طلب الشحن؟")) return;
    await db.collection('rechargeRequests').doc(reqId).update({ status: 'rejected' });
    loadRechargeRequests();
};

// Auto-load if on recharge page
if (document.getElementById('adminRechargeList')) {
    loadRechargeRequests();
}

// --- Merchant Products Management ---
let currentMerchantEditId = null;
async function loadMerchantProductsAdmin() {
    const list = document.getElementById('merchantProductsList');
    if(!list) return;
    
    try {
        const snapshot = await db.collection('products')
            .where('isMerchantOnly', '==', true)
            .get();
            
        list.innerHTML = '';
        if(snapshot.empty) {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:50px; color:#94a3b8;">لا توجد منتجات تجار حالياً</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const p = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.image}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">
                        <strong>${p.name}</strong>
                    </div>
                </td>
                <td>${p.price.toLocaleString()} ج.م</td>
                <td style="color:#10b981; font-weight:800;">${p.merchantPrice.toLocaleString()} ج.م</td>
                <td>${p.stock}</td>
                <td>
                    <div style="display:flex; gap:10px;">
                        <button onclick="editMerchantProduct('${doc.id}')" style="border:none; background:none; cursor:pointer; color:#3b82f6;"><i data-lucide="edit-3" style="width:18px;"></i></button>
                        <button onclick="deleteProduct('${doc.id}', true)" style="border:none; background:none; cursor:pointer; color:#ef4444;"><i data-lucide="trash-2" style="width:18px;"></i></button>
                    </div>
                </td>
            `;
            list.appendChild(row);
        });
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

const merchantProductForm = document.getElementById('merchantProductForm');
const merchantProductModal = document.getElementById('merchantProductModal');

if(document.getElementById('addMerchantProductBtn')) {
    document.getElementById('addMerchantProductBtn').onclick = () => {
        currentMerchantEditId = null;
        if(merchantProductForm) merchantProductForm.reset();
        document.getElementById('merchantModalTitle').textContent = "إضافة منتج تجار جديد";
        if(merchantProductModal) merchantProductModal.style.display = 'flex';
    };
}

if(document.getElementById('closeMerchantModal')) {
    document.getElementById('closeMerchantModal').onclick = () => {
        if(merchantProductModal) merchantProductModal.style.display = 'none';
    };
}

if(merchantProductForm) {
    merchantProductForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'جاري الحفظ...';

        try {
            const mpImageFile = document.getElementById('mpImageFile').files[0];
            const mpImageUrl = document.getElementById('mpImage').value;
            
            let finalImage = mpImageUrl;
            if (mpImageFile) {
                finalImage = await uploadFile(mpImageFile, 'products');
            }

            const data = {
                name: document.getElementById('mpName').value,
                price: parseFloat(document.getElementById('mpPrice').value),
                merchantPrice: parseFloat(document.getElementById('mpMerchantPrice').value),
                stock: parseInt(document.getElementById('mpStock').value),
                category: document.getElementById('mpCategory').value,
                image: finalImage,
                description: document.getElementById('mpDesc').value,
                isMerchantOnly: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if(currentMerchantEditId) {
                await db.collection('products').doc(currentMerchantEditId).update(data);
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.rating = 5;
                await db.collection('products').add(data);
            }
            
            if(merchantProductModal) merchantProductModal.style.display = 'none';
            loadMerchantProductsAdmin();
            showToast("✅ تم حفظ منتج التجار بنجاح");
        } catch (err) { 
            console.error("Save Merchant Product Error:", err);
            alert("❌ فشل الحفظ: " + err.message); 
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };
}

window.editMerchantProduct = async (id) => {
    currentMerchantEditId = id;
    const doc = await db.collection('products').doc(id).get();
    const p = doc.data();
    document.getElementById('mpName').value = p.name || '';
    document.getElementById('mpPrice').value = p.price || 0;
    document.getElementById('mpMerchantPrice').value = p.merchantPrice || 0;
    document.getElementById('mpStock').value = p.stock || 0;
    document.getElementById('mpCategory').value = p.category || '';
    document.getElementById('mpImage').value = p.image || '';
    document.getElementById('mpDesc').value = p.description || '';
    document.getElementById('merchantModalTitle').textContent = "تعديل منتج التجار: " + (p.name || '');
    
    // Preview image
    const preview = document.getElementById('mpImagePreview');
    const container = document.getElementById('mpImagePreviewContainer');
    if (p.image) {
        preview.src = p.image;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
    
    if(merchantProductModal) merchantProductModal.style.display = 'flex';
};

// Update deleteProduct to support refresh of merchant list
const originalDeleteProductFunc = window.deleteProduct;
window.deleteProduct = async (id, isMerchant = false) => {
    if(confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
        try {
            await db.collection('products').doc(id).delete();
            if(isMerchant) loadMerchantProductsAdmin();
            else if (typeof loadProducts === 'function') loadProducts();
            alert("🗑️ تم حذف المنتج بنجاح");
        } catch (err) { alert(err.message); }
    }
};


window.openPointsModal = (userId, currentPoints) => {
    const userIdInput = document.getElementById('pointsUserId');
    const balanceInput = document.getElementById('newPointsBalance');
    const modal = document.getElementById('pointsModal');
    
    if (userIdInput && balanceInput && modal) {
        userIdInput.value = userId;
        balanceInput.value = currentPoints;
        modal.style.display = 'flex';
        lucide.createIcons();
    }
};

window.closePointsModal = () => {
    const modal = document.getElementById('pointsModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.savePointsBalance = async () => {
    const userId = document.getElementById('pointsUserId').value;
    const newPoints = Number(document.getElementById('newPointsBalance').value);
    
    if (isNaN(newPoints) || newPoints < 0) {
        alert("يرجى إدخال عدد نقاط صحيح");
        return;
    }

    try {
        await db.collection('users').doc(userId).update({
            points: newPoints,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (typeof showToast === 'function') {
            showToast("✅ تم تحديث نقاط الولاء بنجاح");
        } else {
            alert("✅ تم تحديث نقاط الولاء بنجاح");
        }
        
        window.closePointsModal();
        loadCustomers();
    } catch (err) {
        alert("فشل تحديث النقاط: " + err.message);
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
                    
                    const confSnap = await transaction.get(db.collection('settings').doc('loyaltyConfig'));
                    let earnAmount = 1000;
                    let earnPoints = 200;
                    if (confSnap.exists) {
                        earnAmount = confSnap.data().earnAmount || 1000;
                        earnPoints = confSnap.data().earnPoints || 200;
                    }
                    let multiplier = 1.0;
                    if (currentPoints >= 5000) multiplier = 2.0;
                    else if (currentPoints >= 500) multiplier = 1.5;
                    
                    const earnedPoints = Math.floor(((orderData.total || 0) / earnAmount * earnPoints) * multiplier);
                    transaction.update(userRef, { points: currentPoints + earnedPoints });
                    transaction.update(orderRef, { pointsAwarded: true });
                    console.log(`Successfully credited ${earnedPoints} points to user: ${orderData.userId}`);
                }
            }
        });
    } catch (e) {
        console.error("Failed to award points safely:", e);
    }
};

// --- Interactive Category Suggestions & Icon Picker System ---
const categorySuggestions = [
    { keywords: ['حلة', 'حلل', 'طاسة', 'قلاية', 'كسرولة', 'أواني', 'تيفال', 'جرانيت', 'سيراميك'], id: 'cookware', icon: 'utensils' },
    { keywords: ['خلاط', 'كبة', 'مطحنة', 'محضرة', 'ميكروويف', 'قلاية هوائية', 'فرن', 'مضرب'], id: 'appliances', icon: 'microwave' },
    { keywords: ['سكين', 'سكاكين', 'ملعقة', 'ملاعق', 'شوكة', 'شوك', 'مقص', 'طقم مائدة'], id: 'cutlery', icon: 'knife' },
    { keywords: ['قالب', 'قوالب', 'صينية', 'صواني', 'نشابة', 'ميزان', 'معيار', 'كيك'], id: 'bakery_tools', icon: 'cookie' },
    { keywords: ['علب', 'علبة', 'تخزين', 'برطمان', 'منظم', 'دولاب', 'رف', 'توابل'], id: 'storage_org', icon: 'container' },
    { keywords: ['طبق', 'أطباق', 'سرفيس', 'كوب', 'أكواب', 'كأس', 'بولات', 'بورسلين'], id: 'tableware', icon: 'glass-water' },
    { keywords: ['كاتل', 'غلاية', 'كنكة', 'فنجان', 'مج', 'كوفي', 'براد', 'شاي'], id: 'coffee_tea', icon: 'coffee' },
    { keywords: ['ليفة', 'سلك', 'بخاخ', 'مطهر', 'فوط', 'حوض', 'صفاية', 'منظفات'], id: 'kitchen_cleaning', icon: 'sparkles' }
];

window.suggestCategoryInfo = (val) => {
    const name = val.trim();
    if (!name) return;
    
    const catIdInput = document.getElementById('catId');
    const catIconInput = document.getElementById('catIcon');
    
    let found = null;
    for (const item of categorySuggestions) {
        if (item.keywords.some(keyword => name.toLowerCase().includes(keyword))) {
            found = item;
            break;
        }
    }
    
    if (found) {
        if (catIdInput) catIdInput.value = found.id;
        if (catIconInput) {
            catIconInput.value = found.icon;
            selectIconVisual(found.icon);
        }
    } else {
        const slug = transliterateArabicToEnglishSlug(name);
        if (catIdInput) catIdInput.value = slug;
        if (catIconInput) {
            catIconInput.value = 'tag';
            selectIconVisual('tag');
        }
    }
};

window.selectIconVisual = (iconName) => {
    const input = document.getElementById('catIcon');
    if (input) input.value = iconName;
    
    // Toggle active state in visual grid
    document.querySelectorAll('.icon-picker-grid .icon-picker-btn').forEach(btn => {
        if (btn.getAttribute('data-icon') === iconName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
};

function transliterateArabicToEnglishSlug(text) {
    return text.toLowerCase()
        .replace(/[^a-zA-Z0-9\sأ-ي]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/أ|إ|آ/g, 'a')
        .replace(/ب/g, 'b')
        .replace(/ت/g, 't')
        .replace(/ث/g, 'th')
        .replace(/ج/g, 'j')
        .replace(/ح/g, 'h')
        .replace(/خ/g, 'kh')
        .replace(/د/g, 'd')
        .replace(/ذ/g, 'dh')
        .replace(/ر/g, 'r')
        .replace(/ز/g, 'z')
        .replace(/س/g, 's')
        .replace(/ش/g, 'sh')
        .replace(/ص/g, 's')
        .replace(/ض/g, 'd')
        .replace(/ط/g, 't')
        .replace(/ظ/g, 'z')
        .replace(/ع/g, 'a')
        .replace(/غ/g, 'gh')
        .replace(/ف/g, 'f')
        .replace(/ق/g, 'q')
        .replace(/ك/g, 'k')
        .replace(/ل/g, 'l')
        .replace(/م/g, 'm')
        .replace(/ن/g, 'n')
        .replace(/ه/g, 'h')
        .replace(/و/g, 'w')
        .replace(/ي|ى/g, 'y')
        .slice(0, 30);
}

// Background product sales sync based on real order history
async function syncProductSalesCounts() {
    try {
        console.log("Starting background sync of product sales counts...");
        const ordersSnap = await db.collection('orders').get();
        const salesMap = {};
        
        ordersSnap.forEach(doc => {
            const order = doc.data();
            if (order.status !== 'cancelled' && order.items) {
                order.items.forEach(item => {
                    if (item.id) {
                        const qty = parseInt(item.quantity) || 1;
                        salesMap[item.id] = (salesMap[item.id] || 0) + qty;
                    }
                });
            }
        });
        
        console.log("Calculated sales map:", salesMap);
        
        const batch = db.batch();
        const productsSnap = await db.collection('products').get();
        let changed = false;
        
        productsSnap.forEach(doc => {
            const pId = doc.id;
            const currentSalesCount = doc.data().salesCount || 0;
            const calculatedSales = salesMap[pId] || 0;
            
            if (currentSalesCount !== calculatedSales) {
                batch.update(db.collection('products').doc(pId), {
                    salesCount: calculatedSales
                });
                changed = true;
            }
        });
        
        if (changed) {
            await batch.commit();
            console.log("Product sales counts synchronized successfully! 🎉");
        } else {
            console.log("No changes detected in product sales counts.");
        }
    } catch (err) {
        console.error("Failed to sync product sales counts:", err);
    }
}

// --- Feature: Driver Management Portal (admin-drivers.html) ---
window.allDrivers = [];


window.resetDriverDues = async (driverId) => {
    if (!confirm("⚠️ هل تم استلام المبالغ النقدية (العهدة) فعلاً من هذا المندوب وتريد تصفير حسابه؟")) return;
    
    try {
        await db.collection('drivers').doc(driverId).update({
            totalDues: 0,
            lastSettledAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("✅ تم تسوية الحساب وتصفير العهدة للمندوب بنجاح.");
    } catch(err) {
        alert("خطأ: " + err.message);
    }
};

window.loadDrivers = async function() {
    const list = document.getElementById('adminDriversList');
    if (!list) return;

    list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 50px;">جاري تحميل بيانات المندوبين...</td></tr>';

    try {
        // Load orders too so we can count active ones for each driver
        if (!window.allOrders || window.allOrders.length === 0) {
            loadOrders();
        }

        // Real-time listener for drivers
        db.collection('drivers').orderBy('createdAt', 'desc').onSnapshot(snap => {
            window.allDrivers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderDriversList();
            updateDriversStats();
        }, err => {
            console.error("Drivers Listener Error:", err);
            list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 50px; color: red;">خطأ في الاتصال بقاعدة البيانات</td></tr>';
        });
    } catch (err) {
        console.error("Load Drivers Error:", err);
    }
};

function renderDriversList() {
    const list = document.getElementById('adminDriversList');
    if (!list) return;

    const searchTerm = (document.getElementById('driverSearchInput')?.value || '').toLowerCase().trim();
    let filtered = window.allDrivers || [];

    if (searchTerm) {
        filtered = filtered.filter(d => 
            (d.name || '').toLowerCase().includes(searchTerm) || 
            (d.email || '').toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 50px; color: #64748B; font-weight: 700;">لا يوجد مندوبين مسجلين بعد</td></tr>';
        return;
    }

    list.innerHTML = filtered.map(d => {
        const photo = d.photo || d.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name || 'D')}&background=10B981&color=fff`;
        const isOnline = d.online === true || d.status === 'online';
        const onlineBadge = isOnline ? 
            '<span style="background:#ECFDF5; color:#10B981; border:1px solid #A7F3D0; padding:4px 10px; border-radius:50px; font-size:0.7rem; font-weight:900;">🟢 متصل</span>' : 
            '<span style="background:#F1F5F9; color:#64748B; border:1px solid #E2E8F0; padding:4px 10px; border-radius:50px; font-size:0.7rem; font-weight:900;">🔴 غير متصل</span>';
        
        const isApproved = d.isApproved !== false;
        const approvedBadge = isApproved ? 
            '<span style="background:#ECFDF5; color:#10B981; border:1px solid #A7F3D0; padding:4px 10px; border-radius:50px; font-size:0.7rem; font-weight:900;">✅ نشط ومفعّل</span>' : 
            '<span style="background:#FFF7ED; color:#D97706; border:1px solid #FED7AA; padding:4px 10px; border-radius:50px; font-size:0.7rem; font-weight:900;">⏳ بانتظار التفعيل</span>';

        const lastSeenStr = d.lastLocationUpdate ? (typeof d.lastLocationUpdate.toDate === 'function' ? d.lastLocationUpdate.toDate().toLocaleString('ar-EG', {hour:'2-digit', minute:'2-digit', day:'numeric', month:'short'}) : new Date(d.lastLocationUpdate).toLocaleDateString()) : (d.lastSeen ? (typeof d.lastSeen.toDate === 'function' ? d.lastSeen.toDate().toLocaleString('ar-EG', {hour:'2-digit', minute:'2-digit', day:'numeric', month:'short'}) : new Date(d.lastSeen).toLocaleDateString()) : '---');

        // Calculate active orders
        const activeOrdersCount = (window.allOrders || []).filter(o => o.driverId === d.id && o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'archived_received' && o.status !== 'archived_refused').length;

        return `
            <tr>
                <td data-label="المندوب" style="padding: 15px 20px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${photo}" style="width:45px; height:45px; border-radius:12px; object-fit:cover; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                        <div style="text-align: right;">
                            <div style="font-weight:900; font-size:0.95rem; color:#1E293B;">${d.name || 'طيار مسعودي'}</div>
                            <div style="font-size:0.75rem; color:#64748B; font-weight:700;">ID: ${d.id.slice(0,8).toUpperCase()}</div>
                        </div>
                    </div>
                </td>
                <td data-label="الهاتف" style="padding: 15px 20px;">
                    <div style="font-weight:900; color:#1E293B; font-size:0.85rem;">${d.phone || 'غير مسجل'}</div>
                    <div style="font-size:0.75rem; color:#64748B; font-weight:600;">${d.email || '---'}</div>
                </td>
                <td data-label="المركبة" style="padding: 15px 20px;">
                    <div style="font-weight:1000; color:#1e293b; font-size:0.85rem;">${(d.vehicle === 'motorcycle' ? 'موتوسيكل 🏍️' : d.vehicle === 'car' ? 'سيارة 🚗' : d.vehicle === 'bicycle' ? 'عجلة 🚲' : d.vehicle === 'scooter' ? 'سكوتر 🛴' : 'غير محدد')}</div>
                    <div style="font-size:0.75rem; color:#6366f1; font-weight:800;">📍 ${d.area || 'غير محدد'}</div>
                </td>
                <td data-label="آخر نشاط" style="padding: 15px 20px; font-weight: 800; color: #475569; font-size:0.8rem; text-align: center;">${lastSeenStr}</td>
                <td data-label="الحالة" style="padding: 15px 20px; text-align: center;">
                    <div style="display:flex; flex-direction:column; gap:5px; align-items:center;">
                        ${onlineBadge}
                        ${approvedBadge}
                    </div>
                </td>
                <td data-label="الإنتاجية" style="padding: 15px 20px; text-align: center;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span style="font-weight: 1000; color: #1e293b; font-size: 0.9rem;">${d.completedOrders || 0} مكتمل</span>
                        ${activeOrdersCount > 0 ? `<span style="font-size: 0.75rem; color: #FF6B00; font-weight:900;">🔥 ${activeOrdersCount} طلب نشط</span>` : '<span style="font-size: 0.7rem; color: #94A3B8; font-weight:700;">لا يوجد طلبات نشطة</span>'}
                    </div>
                </td>
                <td data-label="العهدة" style="padding: 15px 20px; font-weight: 1000; color: #ef4444; text-align: center; background: #fff1f2;">${(d.totalDues || 0).toLocaleString()} ج.م</td>
                <td data-label="تحكم" style="padding: 15px 20px; text-align: center;">
                    <div style="display:flex; gap:6px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="viewDriverDetails('${d.id}')" style="background:#FF6B00; color:white; border:none; padding:8px 16px; border-radius:12px; font-size:0.8rem; font-weight:1000; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow: 0 4px 12px rgba(255,107,0,0.2); transition: 0.2s;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 15px rgba(255,107,0,0.3)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(255,107,0,0.2)'" title="إدارة ومتابعة المندوب">
                             <i data-lucide="eye" style="width:16px;"></i> إدارة ومتابعة
                        </button>
                        <button onclick="viewDriverDailyHistory('${d.id}', '${(d.name || 'مندوب').replace(/'/g, "\\'")  }')" style="background:#EEF2FF; color:#6366f1; border:1px solid #E0E7FF; padding:6px 12px; border-radius:10px; font-size:0.75rem; font-weight:900; cursor:pointer;" title="سجل الأداء">
                             <i data-lucide="bar-chart-3" style="width:14px;"></i>
                        </button>
                        <button onclick="resetDriverDues('${d.id}')" style="background:#f1f5f9; color:#6366f1; border:1px solid #e2e8f0; padding:6px 12px; border-radius:10px; font-size:0.75rem; font-weight:900; cursor:pointer; display:flex; align-items:center; gap:4px;" title="تصفير العهدة (تم الاستلام)">
                             <i data-lucide="calculator" style="width:14px;"></i> تسوية
                        </button>
                        ${d.isApproved ? `
                            <button onclick="toggleDriverApproval('${d.id}', false)" style="background:#FFF1F2; color:#F43F5E; border:1px solid #FFE4E6; padding:6px 12px; border-radius:10px; font-size:0.75rem; font-weight:900; cursor:pointer; display:flex; align-items:center; gap:4px;">
                                <i data-lucide="shield-alert" style="width:14px;"></i> إيقاف مؤقت
                            </button>
                        ` : `
                            <button onclick="toggleDriverApproval('${d.id}', true)" style="background:#ECFDF5; color:#10B981; border:1px solid #A7F3D0; padding:6px 12px; border-radius:10px; font-size:0.75rem; font-weight:900; cursor:pointer; display:flex; align-items:center; gap:4px;">
                                <i data-lucide="shield-check" style="width:14px;"></i> تفعيل الحساب
                            </button>
                        `}
                        <button onclick="deleteDriver('${d.id}')" style="background:#f1f5f9; color:#ef4444; border:none; padding:8px; border-radius:10px; cursor:pointer;" title="حذف المندوب">
                            <i data-lucide="trash-2" style="width:14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.filterDrivers = function() {
    renderDriversList();
};

function updateDriversStats() {
    const totalCount = window.allDrivers.length;
    const activeCount = window.allDrivers.filter(d => d.status === 'online').length;
    const pendingCount = window.allDrivers.filter(d => !d.isApproved).length;
    const totalDues = window.allDrivers.reduce((sum, d) => sum + (Number(d.totalDues) || 0), 0);

    if (document.getElementById('totalDriversCount')) document.getElementById('totalDriversCount').textContent = totalCount;
    if (document.getElementById('activeDriversCount')) document.getElementById('activeDriversCount').textContent = activeCount;
    if (document.getElementById('pendingDriversCount')) document.getElementById('pendingDriversCount').textContent = pendingCount;
    
    // Total Dues across all drivers (optional: add to UI if needed)
}

window.toggleDriverApproval = async function(id, approve) {
    const action = approve ? "تفعيل حساب المندوب للعمل؟" : "إيقاف حساب المندوب مؤقتاً؟";
    if (!confirm(action)) return;

    try {
        await db.collection('drivers').doc(id).set({
            isApproved: approve,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await db.collection('users').doc(id).set({
            role: approve ? 'delivery_partner' : 'customer',
            isApproved: approve
        }, { merge: true });

        showToast(approve ? "🟢 تم تفعيل حساب المندوب بنجاح" : "🔴 تم إيقاف حساب المندوب");
        if (typeof loadDrivers === 'function') loadDrivers();
    } catch (err) {
        alert("خطأ أثناء التعديل: " + err.message);
    }
};

window.deleteDriver = async function(id) {
    if (!confirm("⚠️ هل أنت متأكد من حذف هذا المندوب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")) return;

    try {
        await db.collection('drivers').doc(id).delete();
        showToast("🗑️ تم حذف حساب المندوب بنجاح");
    } catch (err) {
        alert("خطأ أثناء الحذف: " + err.message);
    }
};

window.viewDriverDailyHistory = async function(driverId, driverName) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('adminDailyHistoryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'adminDailyHistoryModal';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(15px); z-index:6000; align-items:center; justify-content:center; padding:20px;';
        modal.innerHTML = `
            <div style="width:100%; max-width:600px; background:white; border-radius:30px; padding:30px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 25px 50px rgba(0,0,0,0.15);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
                    <div>
                        <h3 id="adminHistoryTitle" style="font-weight:1000; font-size:1.3rem; margin:0;">سجل العمل اليومي</h3>
                        <p id="adminHistorySubtitle" style="font-size:0.75rem; color:#64748b; font-weight:700; margin-top:4px;"></p>
                    </div>
                    <button onclick="document.getElementById('adminDailyHistoryModal').style.display='none'" style="background:#f1f5f9; border:none; width:40px; height:40px; border-radius:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:1.2rem;">✕</button>
                </div>
                <div id="adminDailyHistoryList" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:15px;"></div>
                <div style="margin-top:20px; padding-top:15px; border-top:1px solid #f1f5f9; text-align:center;">
                    <p style="font-size:0.7rem; color:#94a3b8; font-weight:700;">يتم تحديث السجل تلقائياً عند إكمال كل طلب</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    document.getElementById('adminHistoryTitle').textContent = `سجل الأداء: ${driverName}`;
    document.getElementById('adminHistorySubtitle').textContent = 'جاري التحميل...';
    const list = document.getElementById('adminDailyHistoryList');
    list.innerHTML = '<div style="text-align:center; padding:40px;"><span style="display:inline-block; width:30px; height:30px; border:3px solid var(--primary); border-top-color:transparent; border-radius:50%; animation: spin 1s linear infinite;"></span></div>';

    try {
        const snap = await db.collection('drivers').doc(driverId).collection('dailyStats').orderBy('date', 'desc').limit(30).get();
        if (snap.empty) {
            document.getElementById('adminHistorySubtitle').textContent = 'لا يوجد سجل يومي حتى الآن';
            list.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b; font-weight:700;">لم يتم تسجيل أي أيام عمل بعد</div>';
            return;
        }

        let totalEarnings = 0, totalDues = 0, totalOrders = 0;
        const rows = snap.docs.map(doc => {
            const d = doc.data();
            totalEarnings += d.earnings || 0;
            totalDues += d.dues || 0;
            totalOrders += d.orders || 0;
            return `
                <div style="background:#f8fafc; border-radius:18px; padding:18px; border:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <span style="font-weight:1000; color:#0f172a; font-size:0.95rem;">📅 ${doc.id}</span>
                        <span style="font-size:0.7rem; color:#94a3b8; font-weight:700;">${d.orders || 0} طلب مكتمل</span>
                    </div>
                    <div style="display:flex; gap:15px; align-items:center;">
                        <div style="text-align:center;">
                            <div style="font-size:0.6rem; color:#10b981; font-weight:900;">ربح</div>
                            <div style="font-weight:950; color:#064e3b; font-size:0.9rem;">${(d.earnings || 0).toLocaleString()} ج.م</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:0.6rem; color:#ef4444; font-weight:900;">عهدة</div>
                            <div style="font-weight:950; color:#991b1b; font-size:0.9rem;">${(d.dues || 0).toLocaleString()} ج.م</div>
                        </div>
                    </div>
                </div>`;
        }).join('');

        document.getElementById('adminHistorySubtitle').textContent = `إجمالي: ${totalOrders} طلب | ربح: ${totalEarnings.toLocaleString()} ج.م | عهدة: ${totalDues.toLocaleString()} ج.م`;
        list.innerHTML = rows;
    } catch (err) {
        console.error(err);
        list.innerHTML = '<div style="text-align:center; padding:40px; color:#ef4444;">عذراً، حدث خطأ في تحميل السجل</div>';
    }
};

window.copyDriverPortalLink = function() {
    // Construct the absolute portal URL
    const url = window.location.origin + '/driver.html';
    navigator.clipboard.writeText(url).then(() => {
        showToast("🔗 تم نسخ رابط بوابة المناديب بنجاح!");
    }).catch(err => {
        alert("فشل النسخ تلقائياً: " + url);
    });
};

window.viewDriverDetails = function(driverId) {
    const d = window.allDrivers.find(drv => drv.id === driverId);
    if (!d) return;

    const modal = document.getElementById('driverDetailsModal');
    const content = document.getElementById('driverDetailsContent');
    if (!modal || !content) return;

    const photo = d.photo || d.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name || 'D')}&background=ff6b00&color=fff`;
    const isOnline = d.online === true || d.status === 'online';
    const isApproved = d.isApproved !== false;
    const lastSeenStr = d.lastLocationUpdate ? (typeof d.lastLocationUpdate.toDate === 'function' ? d.lastLocationUpdate.toDate().toLocaleString('ar-EG', {hour:'2-digit', minute:'2-digit', day:'numeric', month:'short'}) : new Date(d.lastLocationUpdate).toLocaleDateString()) : (d.lastSeen ? (typeof d.lastSeen.toDate === 'function' ? d.lastSeen.toDate().toLocaleString('ar-EG', {hour:'2-digit', minute:'2-digit', day:'numeric', month:'short'}) : new Date(d.lastSeen).toLocaleDateString()) : '---');
    const lastUpdateStr = d.lastLocationUpdate ? (typeof d.lastLocationUpdate.toDate === 'function' ? d.lastLocationUpdate.toDate().toLocaleString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '---') : 'لا يوجد سجل موقع';
    const createdAtStr = d.createdAt ? (typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate().toLocaleDateString('ar-EG') : new Date(d.createdAt).toLocaleDateString()) : 'غير متوفر';

    // Calculate active orders
    const activeOrders = (window.allOrders || []).filter(o => o.driverId === d.id && o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'archived_received' && o.status !== 'archived_refused');

    content.innerHTML = `
        <button onclick="document.getElementById('driverDetailsModal').style.display='none'" style="position: absolute; top: 25px; left: 25px; background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 12px; cursor: pointer; color: #64748b; z-index:100;">✕</button>
        
        <div style="display: flex; align-items: center; gap: 25px; margin-bottom: 35px;">
            <div style="position: relative;">
                <img src="${photo}" style="width: 100px; height: 100px; border-radius: 25px; object-fit: cover; border: 4px solid white; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                <div style="position: absolute; bottom: -5px; right: -5px; background: ${isApproved ? '#10b981' : '#f59e0b'}; color: white; padding: 4px; border-radius: 50%; border: 3px solid white;">
                    <i data-lucide="${isApproved ? 'shield-check' : 'clock'}" style="width: 14px; height: 14px;"></i>
                </div>
            </div>
            <div>
                <h2 style="font-weight: 1000; font-size: 1.6rem; margin: 0; color: #1e293b;">${d.name || 'طيار مسعودي'}</h2>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px; color: #64748b; font-weight: 700; font-size: 0.85rem;">
                    <i data-lucide="mail" style="width: 14px;"></i> ${d.email || '---'}
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div style="background: #f8fafc; padding: 20px; border-radius: 20px; border: 1px solid #f1f5f9;">
                <h4 style="margin: 0 0 15px; font-weight: 1000; color: #1e293b; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="user-plus" style="width: 18px; color: var(--primary);"></i> معلومات الحساب
                </h4>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.8rem; font-weight: 700;">رقم الهاتف</span>
                        <span style="font-weight: 900; color: #1e293b;">${d.phone || '---'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.8rem; font-weight: 700;">تاريخ الانضمام</span>
                        <span style="font-weight: 900; color: #1e293b;">${createdAtStr}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.8rem; font-weight: 700;">آخر نشاط</span>
                        <span style="font-weight: 900; color: #1e293b;">${lastSeenStr}</span>
                    </div>
                </div>
            </div>

            <div style="background: #f8fafc; padding: 20px; border-radius: 20px; border: 1px solid #f1f5f9;">
                <h4 style="margin: 0 0 15px; font-weight: 1000; color: #1e293b; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="map-pin" style="width: 18px; color: #6366f1;"></i> العمل والمركبة
                </h4>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.8rem; font-weight: 700;">نوع المركبة</span>
                        <span style="font-weight: 900; color: #1e293b;">${(d.vehicle === 'motorcycle' ? 'موتوسيكل 🏍️' : d.vehicle === 'car' ? 'سيارة 🚗' : d.vehicle === 'bicycle' ? 'عجلة 🚲' : d.vehicle === 'scooter' ? 'سكوتر 🛴' : 'غير محدد')}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.8rem; font-weight: 700;">منطقة العمل</span>
                        <span style="font-weight: 900; color: #6366f1;">📍 ${d.area || 'غير محدد'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.8rem; font-weight: 700;">حالة العمل</span>
                        <span style="font-weight: 1000; color: ${isOnline ? '#16a34a' : '#ef4444'};">
                            ${isOnline ? '🟢 متصل الآن' : '🔴 غير متصل'}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
             <!-- Live Location Map Panel -->
             <div style="background: #f8fafc; border-radius: 20px; border: 1px solid #f1f5f9; overflow: hidden; display: flex; flex-direction: column; min-height:300px;">
                <div style="padding: 15px 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: white;">
                    <h4 style="margin: 0; font-weight: 1000; color: #1e293b; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="map" style="width: 18px; color: #10b981;"></i> تتبع الموقع (Live)
                    </h4>
                    <span style="font-size: 0.65rem; color: #94a3b8; font-weight: 700;">تحديث: ${lastUpdateStr}</span>
                </div>
                <div id="driverLiveMap" style="flex: 1; background: #e2e8f0; position: relative; z-index:1;">
                    ${(!d.lat || !d.lng) ? '<div style="position: absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#64748b; font-weight:800; font-size:0.8rem; text-align:center; padding:20px;">الموقع غير متاح حالياً<br>يجب أن يكون المندوب متصلاً ومفعلاً للـ GPS</div>' : `
                        <div style="padding:20px; text-align:center; background:white; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:12px;">
                            <div style="font-weight:900; color:#1e293b; font-size:0.9rem;">📍 تم تحديد موقع المندوب المباشر</div>
                            <div style="font-size:0.75rem; color:#64748b; font-weight:700;">الإحداثيات: ${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}</div>
                            <a href="https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}" target="_blank" style="background:#10b981; color:white; padding:12px 24px; border-radius:14px; font-weight:900; font-size:0.85rem; text-decoration:none; display:inline-flex; align-items:center; gap:8px; box-shadow:0 6px 15px rgba(16,185,129,0.25);">
                                <i data-lucide="external-link" style="width:16px;"></i> فتح خريطة المندوب المباشرة على Google Maps
                            </a>
                        </div>
                    `}
                </div>
             </div>

             <!-- Active Orders Panel -->
             <div style="background: #f8fafc; border-radius: 20px; border: 1px solid #f1f5f9; display: flex; flex-direction: column;">
                <div style="padding: 15px 20px; border-bottom: 1px solid #f1f5f9; background: white;">
                    <h4 style="margin: 0; font-weight: 1000; color: #1e293b; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="shopping-bag" style="width: 18px; color: #f59e0b;"></i> الطلبات الجارية (${activeOrders.length})
                    </h4>
                </div>
                <div style="padding: 15px; flex: 1; overflow-y: auto; max-height: 250px; display: flex; flex-direction: column; gap: 10px;">
                    ${activeOrders.length === 0 ? '<div style="text-align:center; color:#94a3b8; font-size:0.8rem; padding:30px; font-weight:700;">لا توجد طلبات جارية حالياً</div>' : activeOrders.map(o => `
                        <div style="background: white; padding: 12px; border-radius: 12px; border: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 900; font-size: 0.8rem; color: #0f172a;">ID: ${o.id.slice(0,8).toUpperCase()}</div>
                                <div style="font-size: 0.7rem; color: #64748b;">${o.customer || o.customerName || 'عميل'} | ${o.total} ج.م</div>
                            </div>
                            <span style="background: #fff7ed; color: #c2410c; padding: 3px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 900;">${o.status === 'processing' ? 'قيد التجهيز' : o.status === 'shipped' ? 'في الطريق' : o.status}</span>
                        </div>
                    `).join('')}
                </div>
             </div>
        </div>

        <div style="background: #eff6ff; padding: 25px; border-radius: 25px; border: 1.5px solid #dbeafe;">
            <h4 style="margin: 0 0 20px; font-weight: 1000; color: #1e293b; font-size: 1rem; display: flex; align-items: center; gap: 10px;">
                <i data-lucide="trending-up" style="width: 22px; color: #3b82f6;"></i> ملخص النشاط والحالة المالية
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; margin-bottom: 15px;">
                <div style="background: white; padding: 15px; border-radius: 20px; text-align: center; border: 1px solid #dbeafe;">
                    <div style="font-size: 0.65rem; font-weight: 800; color: #64748b; margin-bottom: 5px;">الطلبات المكتملة</div>
                    <div style="font-weight: 1000; font-size: 1.2rem; color: #1e293b;">${d.completedOrders || 0}</div>
                </div>
                <div style="background: white; padding: 15px; border-radius: 20px; text-align: center; border: 1px solid #dbeafe;">
                    <div style="font-size: 0.65rem; font-weight: 800; color: #FF6B00; margin-bottom: 5px;">الطلبات النشطة الآن</div>
                    <div style="font-weight: 1000; font-size: 1.2rem; color: #FF6B00;">${activeOrders.length}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px;">
                <div style="background: white; padding: 15px; border-radius: 20px; text-align: center; border: 1px solid #dbeafe; grid-column: span 1;">
                    <div style="font-size: 0.65rem; font-weight: 800; color: #10b981; margin-bottom: 5px;">إجمالي الأرباح</div>
                    <div style="font-weight: 1000; font-size: 1.1rem; color: #065f46;">${(d.totalEarnings || 0).toLocaleString()} ج.م</div>
                </div>
                <div style="background: white; padding: 15px; border-radius: 20px; text-align: center; border: 1px solid #dbeafe; grid-column: span 1;">
                    <div style="font-size: 0.65rem; font-weight: 800; color: #f43f5e; margin-bottom: 5px;">العهدة الحالية</div>
                    <div style="font-weight: 1000; font-size: 1.1rem; color: #991b1b;">${(d.totalDues || 0).toLocaleString()} ج.م</div>
                </div>
            </div>
        </div>

        <div style="display: flex; gap: 15px; margin-top: 30px;">
            <button onclick="viewDriverDailyHistory('${d.id}', '${(d.name || 'مندوب').replace(/'/g, "\\'")}')" style="flex: 1; padding: 15px; border-radius: 18px; background: #6366f1; color: white; border: none; font-weight: 1000; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 20px rgba(99,102,241,0.2);">
                <i data-lucide="calendar" style="width: 20px;"></i> عرض سجل الأداء اليومي
            </button>
            <button onclick="resetDriverDues('${d.id}')" style="padding: 15px 25px; border-radius: 18px; background: white; color: #ef4444; border: 2px solid #fee2e2; font-weight: 1000; font-size: 0.95rem; cursor: pointer;">
                تسوية عهدة
            </button>
        </div>
    `;

    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();

    // Map initialization
    if (d.lat && d.lng) {
        setTimeout(() => {
            try {
                if (window.driverMap) {
                    window.driverMap.remove();
                }
                window.driverMap = L.map('driverLiveMap').setView([d.lat, d.lng], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19
                }).addTo(window.driverMap);
                
                const driverIcon = L.divIcon({
                    className: 'driver-marker',
                    html: `
                        <div style="background: white; padding: 5px; border-radius: 50%; box-shadow: 0 5px 15px rgba(0,0,0,0.2); border: 3px solid var(--primary);">
                            <img src="${photo}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover;">
                        </div>
                    `,
                    iconSize: [50, 50],
                    iconAnchor: [25, 50]
                });

                L.marker([d.lat, d.lng], { icon: driverIcon }).addTo(window.driverMap)
                    .bindPopup(`<b style="font-family:Cairo;">📍 المندوب: ${d.name || 'طيار'}</b><br><span style="font-family:Cairo; font-size:0.7rem;">آخر تحديث: ${lastUpdateStr}</span>`)
                    .openPopup();
            } catch (err) {
                console.error("Map init error:", err);
            }
        }, 500);
    }
};

window.shareDriverPortalWhatsApp = function() {
    const url = window.location.origin + '/driver.html';
    const text = encodeURIComponent(`مرحباً بك في فريق مسعودي للتوصيل! 🎉\nيرجى فتح الرابط التالي لتسجيل الدخول والبدء في استلام وتوصيل الطلبات:\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
};

// --- Authentication Helpers ---
window.openGrantPermissionModal = () => {
    const m = document.getElementById('grantPermissionModal');
    if (m) {
        m.style.display = 'flex';
        const input = document.getElementById('grantEmail');
        if (input) input.focus();
    }
};

window.closeGrantPermissionModal = () => {
    const m = document.getElementById('grantPermissionModal');
    if (m) {
        m.style.display = 'none';
        const input = document.getElementById('grantEmail');
        if (input) input.value = '';
    }
};

window.executeGrantPermission = async function() {
    const email = document.getElementById('grantEmail').value.trim().toLowerCase();
    const btn = document.getElementById('grantBtn');
    
    if (!email || !email.includes('@')) {
        alert("يرجى إدخال بريد إلكتروني صحيح (Gmail)");
        return;
    }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" style="width:16px; height:16px; border:2px solid white; border-top-color:transparent; border-radius:50%; display:inline-block; margin-left:8px;"></span> جاري التفعيل...';

    try {
        const userSnap = await db.collection('users').where('email', '==', email).get();
        
        if (userSnap.empty) {
            await db.collection('pending_drivers').doc(email).set({
                role: 'delivery_partner',
                grantedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("✅ المستخدم لم يسجل في الموقع بعد. تم حجز صلاحية 'مندوب' لبريده الإلكتروني. عند قيامه بتسجيل الدخول لأول مرة، سيتم تفعيل حسابه كمندوب تلقائياً.");
        } else {
            const uid = userSnap.docs[0].id;
            const batch = db.batch();
            
            batch.update(db.collection('users').doc(uid), {
                role: 'delivery_partner',
                isApproved: true
            });
            
            batch.set(db.collection('drivers').doc(uid), {
                email: email,
                name: userSnap.docs[0].data().fullName || userSnap.docs[0].data().name || 'مندوب جديد',
                isApproved: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await batch.commit();
            alert("✅ تم تفعيل صلاحية المندوب بنجاح لهذا الحساب! يمكنه الآن تسجيل الدخول لبوابة المناديب.");
        }
        
        closeGrantPermissionModal();
        if (window.loadDrivers) loadDrivers();
    } catch (err) {
        console.error("Grant Error:", err);
        alert("حدث خطأ أثناء التفعيل: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

window.logoutAdmin = async function() {
    if (!confirm("هل أنت متأكد من تسجيل الخروج؟")) return;
    try {
        await auth.signOut();
        sessionStorage.removeItem('masoudi_bio_verified');
        window.location.reload();
    } catch (err) {
        alert("خطأ أثناء تسجيل الخروج: " + err.message);
    }
};

window.permissionsRegistry = {};
window.loadPermissionsRegistry = async function() {
    // In a real app, this might come from Firestore. For now, we define the static map.
    window.permissionsRegistry = {
        'dashboard': { label: 'الإحصائيات', pages: ['admin.html'] },
        'products': { label: 'المنتجات', pages: ['admin-products.html', 'admin-merchant-products.html'] },
        'orders': { label: 'الطلبات', pages: ['admin-orders.html'] },
        'customers': { label: 'العملاء', pages: ['admin-customers.html'] },
        'drivers': { label: 'المندوبين', pages: ['admin-drivers.html'] },
        'recharge': { label: 'شحن الرصيد', pages: ['admin-recharge.html'] },
        'permissions': { label: 'الصلاحيات', pages: ['admin-users.html'] },
        'settings': { label: 'الإعدادات', pages: ['admin-settings.html'] }
    };
    return window.permissionsRegistry;
};

window.applyRolePermissions = function(adminData) {
    if (!adminData) return;
    
    const role = adminData.role || 'custom';
    const permissions = adminData.permissions || [];
    const userEmail = auth.currentUser ? auth.currentUser.email.toLowerCase() : '';

    // Super Admin or Owner has all permissions
    if (role === 'super_admin' || userEmail === ADMIN_EMAIL) {
        console.log("Full Access Granted");
        return;
    }

    // Role-based UI restriction (Hide menu items that the user doesn't have access to)
    const navLinks = document.querySelectorAll('.admin-nav a');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href === 'index.html' || href === 'admin.html') return; // Always keep Home and Dashboard access

        // Map href to permission key
        let permKey = '';
        if (href.includes('product')) permKey = 'products';
        else if (href.includes('order')) permKey = 'orders';
        else if (href.includes('customer')) permKey = 'customers';
        else if (href.includes('driver')) permKey = 'drivers';
        else if (href.includes('recharge')) permKey = 'recharge';
        else if (href.includes('user')) permKey = 'permissions';
        else if (href.includes('settings')) permKey = 'settings';

        if (permKey && !permissions.includes(permKey)) {
            link.style.display = 'none';
        }
    });

    // Page-level blocking
    const currentPage = window.location.pathname.split('/').pop() || 'admin.html';
    if (currentPage !== 'admin.html' && currentPage !== 'index.html') {
        let currentPermKey = '';
        if (currentPage.includes('product')) currentPermKey = 'products';
        else if (currentPage.includes('order')) currentPermKey = 'orders';
        else if (currentPage.includes('customer')) currentPermKey = 'customers';
        else if (currentPage.includes('driver')) currentPermKey = 'drivers';
        else if (currentPage.includes('recharge')) currentPermKey = 'recharge';
        else if (currentPage.includes('user')) currentPermKey = 'permissions';
        else if (currentPage.includes('settings')) currentPermKey = 'settings';

        if (currentPermKey && !permissions.includes(currentPermKey)) {
            document.body.innerHTML = `
                <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:Cairo; background:#f8fafc; text-align:center; padding:20px;">
                    <div style="background:#fee2e2; color:#ef4444; width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:20px;">
                        <i data-lucide="shield-off" style="width:40px; height:40px;"></i>
                    </div>
                    <h1 style="color:#1e293b; margin-bottom:10px;">عذراً، لا تملك صلاحية الوصول</h1>
                    <p style="color:#64748b; margin-bottom:30px;">يرجى التواصل مع المدير للحصول على الصلاحيات اللازمة (قسم: ${window.permissionsRegistry[currentPermKey]?.label || currentPermKey})</p>
                    <a href="admin.html" style="background:#1e293b; color:white; text-decoration:none; padding:12px 30px; border-radius:15px; font-weight:800;">العودة للرئيسية</a>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    }
};

// --- Permissions Management (admin-users.html) ---
window.renderPermissionsGrid = async function() {
    const grid = document.getElementById('permissionsGrid');
    if (!grid) return;
    
    const registry = await window.loadPermissionsRegistry();
    grid.innerHTML = Object.keys(registry).map(key => `
        <label style="display:flex; align-items:center; gap:10px; background:white; padding:12px; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer; font-weight:700; font-size:0.85rem;">
            <input type="checkbox" name="permission" value="${key}" style="width:18px; height:18px; accent-color:var(--primary);">
            ${registry[key].label}
        </label>
    `).join('');
};

window.loadAdmins = async function() {
    const list = document.getElementById('adminUsersList');
    if (!list) return;
    
    list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">جاري تحميل قائمة المشرفين...</td></tr>';
    
    try {
        const snap = await db.collection('admins').get();
        const admins = [];
        snap.forEach(doc => admins.push({ id: doc.id, ...doc.data() }));
        
        document.getElementById('adminsCount').textContent = admins.length;
        
        if (admins.length === 0) {
            list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#64748b;">لا يوجد مشرفين مضافين حالياً</td></tr>';
            return;
        }

        const registry = await window.loadPermissionsRegistry();
        
        list.innerHTML = admins.map(a => {
            const permsStr = (a.permissions || []).map(p => {
                const label = registry[p]?.label || p;
                return `<span style="background:var(--primary-light); color:var(--primary); padding:2px 8px; border-radius:5px; font-size:0.7rem; font-weight:800; margin:2px; display:inline-block;">${label}</span>`;
            }).join(' ');

            return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:15px 30px;">
                        <div style="font-weight:900; color:#1e293b;">${a.name || 'مشرف'}</div>
                        <div style="font-size:0.75rem; color:#64748b;">${a.role === 'super_admin' ? 'مدير نظام' : 'مشرف مخصص'}</div>
                    </td>
                    <td style="padding:15px 30px; font-weight:700; color:#475569;">${a.id}</td>
                    <td style="padding:15px 30px; line-height:1.6;">${a.role === 'super_admin' ? '<span style="color:#10b981; font-weight:900;">كل الصلاحيات (Super)</span>' : permsStr}</td>
                    <td style="padding:15px 30px;">
                        <div style="display:flex; gap:10px;">
                            <button onclick="editAdminEntry('${a.id}')" style="background:#f1f5f9; border:none; padding:8px; border-radius:8px; cursor:pointer; color:#3b82f6;"><i data-lucide="edit-3" style="width:16px;"></i></button>
                            <button onclick="deleteAdmin('${a.id}')" style="background:#f1f5f9; border:none; padding:8px; border-radius:8px; cursor:pointer; color:#ef4444;"><i data-lucide="trash-2" style="width:16px;"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    } catch (err) {
        console.error("Load Admins Error:", err);
    }
};

window.addAdmin = async function(event) {
    if (event) event.preventDefault();
    const name = document.getElementById('adminNameInput').value;
    const email = document.getElementById('adminEmail').value.trim().toLowerCase();
    const checkboxes = document.querySelectorAll('input[name="permission"]:checked');
    const permissions = Array.from(checkboxes).map(cb => cb.value);
    
    if (!email.includes('@gmail.com')) {
        alert("يرجى استخدام بريد Gmail صالح");
        return;
    }

    try {
        await db.collection('admins').doc(email).set({
            name,
            role: 'custom',
            permissions,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        alert("✅ تم حفظ بيانات المشرف بنجاح");
        resetAdminForm();
        loadAdmins();
    } catch (err) {
        alert("خطأ أثناء الحفظ: " + err.message);
    }
};

window.editAdminEntry = async function(email) {
    try {
        const doc = await db.collection('admins').doc(email).get();
        if (!doc.exists) return;
        const data = doc.data();
        
        document.getElementById('adminNameInput').value = data.name || '';
        document.getElementById('adminEmail').value = email;
        document.getElementById('adminEmail').disabled = true;
        
        const checkboxes = document.querySelectorAll('input[name="permission"]');
        checkboxes.forEach(cb => {
            cb.checked = (data.permissions || []).includes(cb.value);
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { alert(err.message); }
};

window.resetAdminForm = function() {
    document.getElementById('addAdminForm').reset();
    document.getElementById('adminEmail').disabled = false;
    const checkboxes = document.querySelectorAll('input[name="permission"]');
    checkboxes.forEach(cb => cb.checked = false);
};

window.deleteAdmin = async function(email) {
    if (email === ADMIN_EMAIL) return alert("لا يمكن حذف حساب المالك الرئيسي");
    if (!confirm("هل أنت متأكد من سحب صلاحيات هذا المشرف؟")) return;
    
    try {
        await db.collection('admins').doc(email).delete();
        loadAdmins();
        alert("🗑️ تم حذف المشرف بنجاح");
    } catch (err) { alert(err.message); }
};

window.openNewPageModal = () => document.getElementById('newPageModal').style.display = 'flex';
window.closeNewPageModal = () => document.getElementById('newPageModal').style.display = 'none';

window.saveNewPageRegistration = async function() {
    const label = document.getElementById('newPageLabel').value;
    const file = document.getElementById('newPageFile').value;
    const id = document.getElementById('newPageId').value;
    
    if (!label || !file || !id) return alert("يرجى إكمال جميع الحقول");
    
    // In this current implementation, we just mock it or could add it to a 'site_config' doc
    alert("تم تسجيل الصفحة بنجاح! ستظهر في القائمة بعد التحديث القادم.");
    closeNewPageModal();
};

// --- Policy Management ---
window.savePolicySettings = async function(event) {
    if (event) event.preventDefault();
    const saveBtn = event.target.querySelector('button[type="submit"]');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = 'جاري الحفظ...';
    saveBtn.disabled = true;

    const shipping = document.getElementById('shippingPolicy').value;
    const returnP = document.getElementById('returnPolicy').value;

    try {
        await db.collection('settings').doc('policy').set({
            shipping: shipping,
            return: returnP,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        alert("✅ تم حفظ السياسات بنجاح!");
    } catch (err) {
        console.error("Save Policy Error:", err);
        alert("خطأ أثناء الحفظ: " + err.message);
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
};

window.loadPolicySettings = async function() {
    const shippingArea = document.getElementById('shippingPolicy');
    const returnArea = document.getElementById('returnPolicy');
    if (!shippingArea || !returnArea) return;

    try {
        const doc = await db.collection('settings').doc('policy').get();
        if (doc.exists) {
            const data = doc.data();
            shippingArea.value = data.shipping || '';
            returnArea.value = data.return || '';
        }
    } catch (err) {
        console.error("Load Policy Error:", err);
    }
};

// Initialize Settings on page load
if (window.location.pathname.includes('admin-settings.html')) {
    window.loadPolicySettings();
}

// End of admin.js

// --- Administrative Modern Offers Logic ---
window.populateOfferCategoryDropdown = async function() {
    const dropdown = document.getElementById('offerActionLink');
    if (!dropdown) return;

    try {
        const snap = await db.collection('merchants').get();
        let html = '<option value="">اختر المتجر...</option>';
        if (snap.empty) {
            html += '<option value="general">لا يوجد متاجر مضافة</option>';
        } else {
            snap.forEach(doc => {
                const store = doc.data();
                html += `<option value="${doc.id}">${store.name}</option>`;
            });
        }
        dropdown.innerHTML = html;
        
        // If we were editing, set the value after loading
        if (window._pendingOfferLinkValue) {
            dropdown.value = window._pendingOfferLinkValue;
            delete window._pendingOfferLinkValue;
        }
    } catch (err) {
        console.error("Error populating store dropdown:", err);
        dropdown.innerHTML = '<option value="">خطأ في التحميل</option>';
    }
};

window.cancelOfferEdit = function() {
    window.currentEditingOfferId = null;
    const form = document.getElementById('addOfferForm');
    if (form) {
        form.reset();
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.innerHTML = '<i data-lucide="plus"></i> إضافة الكارت';
        const cancelBtn = document.getElementById('cancelOfferEditBtn');
        if (cancelBtn) cancelBtn.style.display = 'none';
        const preview = document.getElementById('offerImagePreview');
        if (preview) {
            preview.style.display = 'none';
            preview.querySelector('img').src = '';
        }
    }
    if (window.lucide) lucide.createIcons();
};

window.editAdminOffer = async function(id) {
    try {
        const doc = await db.collection('offers').doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();
        
        window.currentEditingOfferId = id;
        
        document.getElementById('offerTitle').value = data.title || '';
        document.getElementById('offerSubtitle').value = data.subtitle || '';
        document.getElementById('offerActionText').value = data.actionText || '';
        
        // Set the dropdown value. Since it might not be loaded yet, we'll store it.
        const dropdown = document.getElementById('offerActionLink');
        if (dropdown && dropdown.options.length > 1) {
            dropdown.value = data.actionLink || '';
        } else {
            window._pendingOfferLinkValue = data.actionLink || '';
        }

        document.getElementById('offerTheme').value = data.theme || 'primary';
        document.getElementById('offerIcon').value = data.icon || 'percent';
        document.getElementById('offerImageLink').value = data.image || '';

        if (data.image) {
            const preview = document.getElementById('offerImagePreview');
            if (preview) {
                preview.style.display = 'block';
                preview.querySelector('img').src = data.image;
            }
        }

        const form = document.getElementById('addOfferForm');
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.innerHTML = '<i data-lucide="save"></i> تحديث العرض';
        
        const cancelBtn = document.getElementById('cancelOfferEditBtn');
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        
        window.scrollTo({ top: document.getElementById('addOfferForm').offsetTop - 100, behavior: 'smooth' });
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("Error editing offer", err);
    }
};


window.saveAdminOffer = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const ogHtml = btn.innerHTML;
    const isEditing = !!window.currentEditingOfferId;
    
    btn.innerHTML = isEditing ? 'جاري التحديث...' : 'جاري الإضافة...';
    btn.disabled = true;

    const offerData = {
        title: document.getElementById('offerTitle').value,
        subtitle: document.getElementById('offerSubtitle').value,
        actionText: document.getElementById('offerActionText').value,
        actionLink: document.getElementById('offerActionLink').value,
        theme: document.getElementById('offerTheme').value,
        icon: document.getElementById('offerIcon').value,
        image: document.getElementById('offerImageLink') ? document.getElementById('offerImageLink').value : '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!isEditing) {
        offerData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    try {
        if (isEditing) {
            await db.collection('offers').doc(window.currentEditingOfferId).update(offerData);
            alert("✅ تم تحديث العرض بنجاح!");
            window.cancelOfferEdit();
        } else {
            await db.collection('offers').add(offerData);
            alert("✅ تم إضافة العرض بنجاح!");
            e.target.reset();
            const preview = document.getElementById('offerImagePreview');
            if (preview) {
                preview.style.display = 'none';
                preview.querySelector('img').src = '';
            }
        }
        loadAdminOffers();
    } catch (err) {
        console.error("Error saving offer", err);
        alert("فشل الحفظ: " + err.message);
    } finally {
        btn.innerHTML = ogHtml;
        btn.disabled = false;
    }
};

window.loadAdminOffers = async function() {
    const listContainer = document.getElementById('adminOffersListContainer');
    if (!listContainer) return;
    
    listContainer.innerHTML = '<div style="text-align: center; color: #94a3b8;"><span class="spin">...</span></div>';
    
    try {
        const snapshot = await db.collection('offers').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            listContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px;">لا توجد عروض نشطة حالياً. قم بإضافة عرض جديد بالاعلى.</div>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        ${data.image ? 
                            `<img src="${data.image}" style="width: 45px; height: 45px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;">` :
                            `<div style="width: 45px; height: 45px; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0;">
                                <i data-lucide="${data.icon || 'star'}"></i>
                            </div>`
                        }
                        <div>
                            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">${data.title}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">الزر: ${data.actionText} | الرابط: ${data.actionLink || 'مباشر'}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="openOfferProductsModal('${doc.id}')" class="btn-primary" style="background: #fdf4ff; color: #a21caf; border: none; padding: 8px 15px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <i data-lucide="package" style="width: 16px;"></i> المنتجات
                        </button>
                        <button onclick="editAdminOffer('${doc.id}')" class="btn-primary" style="background: #e0f2fe; color: #0369a1; border: none; padding: 8px 15px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <i data-lucide="edit-3" style="width: 16px;"></i> تعديل
                        </button>
                        <button onclick="deleteAdminOffer('${doc.id}')" class="btn-primary" style="background: #fee2e2; color: #ef4444; border: none; padding: 8px 15px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <i data-lucide="trash-2" style="width: 16px;"></i> حذف
                        </button>
                    </div>
                </div>
            `;
        });
        listContainer.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("Error loading admin offers", err);
        listContainer.innerHTML = '<div style="color:red; text-align:center;">حدث خطأ في جلب العروض</div>';
    }
};

// --- Offer Products Management ---
window.currentManagingOfferId = null;
window.allAdminProducts = [];

window.openOfferProductsModal = async function(offerId) {
    window.currentManagingOfferId = offerId;
    document.getElementById('offerProductsModal').style.display = 'flex';
    const list = document.getElementById('offerProductsList');
    list.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">جاري تحميل المنتجات...</p>';
    
    try {
        if (window.allAdminProducts.length === 0) {
            const snap = await db.collection('products').get();
            window.allAdminProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        window.renderOfferProductsList();
    } catch(err) {
        console.error("Error loading products for offer:", err);
        list.innerHTML = '<div style="color:red; text-align:center;">فشل جلب المنتجات</div>';
    }
};

window.renderOfferProductsList = function(searchTerm = '') {
    const list = document.getElementById('offerProductsList');
    let filtered = window.allAdminProducts;
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        filtered = filtered.filter(p => p.name && p.name.toLowerCase().includes(lower));
    }
    
    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">لا توجد منتجات مطابقة.</p>';
        return;
    }
    
    let html = '';
    filtered.forEach(p => {
        const isChecked = p.offerId === window.currentManagingOfferId ? 'checked' : '';
        html += `
            <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" class="offer-product-cb" value="${p.id}" ${isChecked} style="width: 18px; height: 18px; accent-color: var(--primary);">
                    <img src="${p.image || ''}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">
                    <div style="font-size: 0.9rem; font-weight: 700; color: #1e293b;">${p.name || 'بدون اسم'}</div>
                </div>
                ${p.discount > 0 ? `<div style="font-size: 0.75rem; color: white; background: #ef4444; padding: 3px 8px; border-radius: 12px; font-weight: 800;">مخفض</div>` : ''}
            </label>
        `;
    });
    list.innerHTML = html;
};

window.filterOfferProductsList = function() {
    const term = document.getElementById('offerProductsSearch').value;
    window.renderOfferProductsList(term);
};

window.saveOfferProducts = async function() {
    if (!window.currentManagingOfferId) return;
    const btn = document.getElementById('saveOfferProductsBtn');
    const oldText = btn.innerHTML;
    btn.innerHTML = 'جاري الحفظ...';
    btn.style.opacity = '0.7';
    btn.disabled = true;
    
    try {
        const checkboxes = document.querySelectorAll('.offer-product-cb');
        const batch = db.batch();
        let ops = 0;
        
        checkboxes.forEach(cb => {
            const isChecked = cb.checked;
            const productId = cb.value;
            const p = window.allAdminProducts.find(x => x.id === productId);
            if (p) {
                if (isChecked && p.offerId !== window.currentManagingOfferId) {
                    batch.update(db.collection('products').doc(productId), { offerId: window.currentManagingOfferId });
                    p.offerId = window.currentManagingOfferId; 
                    ops++;
                } else if (!isChecked && p.offerId === window.currentManagingOfferId) {
                    batch.update(db.collection('products').doc(productId), { offerId: null });
                    p.offerId = null; 
                    ops++;
                }
            }
        });
        
        if (ops > 0) {
            await batch.commit();
        }
        alert("✅ تم حفظ تشكيلة المنتجات بنجاح.");
        document.getElementById('offerProductsModal').style.display = 'none';
        
        // Optionally update the generic products array locally too 
        // to prevent sync issues if the admin visits the products page in the same session
        if (typeof window.products !== 'undefined') {
             window.products.forEach(globalP => {
                 const matchingAdmin = window.allAdminProducts.find(p => p.id === globalP.id);
                 if (matchingAdmin) globalP.offerId = matchingAdmin.offerId;
             });
        }
        
    } catch(err) {
        console.error("Batch save error:", err);
        alert("❌ فشل الحفظ: " + err.message);
    } finally {
        btn.innerHTML = oldText;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
};

window.deleteAdminOffer = async function(id) {
    if (!confirm("هل أنت متأكد من مسح هذا العرض النهائي؟ سيختفي من واجهة المستخدم فوراً.")) return;
    try {
        await db.collection('offers').doc(id).delete();
        loadAdminOffers();
    } catch (err) {
        alert("فشل المسح: " + err.message);
    }
};

// Initialize offers when document is ready
setTimeout(() => {
    if (document.getElementById('adminOffersListContainer')) {
        loadAdminOffers();
        populateOfferCategoryDropdown();
    }
}, 2000);

// ===============================================
// --- Feature: Virtual Store Management ---
// ===============================================
window.allStores = [];
window.currentStoreEditId = null;
window.adminPendingStoreCovers = [];

/**
 * Compresses and converts a file to a Base64 string (Fallback when Storage is not available)
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
                // Use JPEG with 0.6 quality for document size safety (Firestore 1MB limit)
                const quality = maxWidth > 500 ? 0.6 : 0.7;
                const base64 = canvas.toDataURL('image/jpeg', quality);
                resolve(base64);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

/**
 * Uploads a file using Base64 fallback.
 */
async function uploadFile(file, path) {
    try {
        // Dynamic sizing based on path
        let maxWidth = 800;
        if (path.includes('logo') || path.includes('favicon')) maxWidth = 300;
        else if (path.includes('categories')) maxWidth = 500;
        else if (path.includes('products')) maxWidth = 800;
        else if (path.includes('covers') || path.includes('banners')) maxWidth = 1200;

        const base64 = await compressAndEncodeImage(file, maxWidth);
        return base64;
    } catch (error) {
        console.error("Image Processing Error:", error);
        throw new Error("فشل معالجة الصورة.");
    }
}

window.previewImage = (input, imgId, urlInputId = null) => {
    const preview = document.getElementById(imgId);
    const container = document.getElementById(imgId + 'Container') || document.getElementById(imgId + 'PreviewContainer');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (preview) {
                preview.src = e.target.result;
                if (container) container.style.display = 'block';
                else preview.style.display = 'block';
            }
            if (urlInputId) {
                const urlInput = document.getElementById(urlInputId);
                if (urlInput) urlInput.value = ''; // Clear URL if file selected
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};
window.handleAdminFilePreview = (input, previewId) => {
    window.previewImage(input, previewId);
};

window.handleAdminMultiCoverPre = (input) => {
    const files = Array.from(input.files);
    files.forEach(file => {
        if (window.adminPendingStoreCovers.length < 5) {
            window.adminPendingStoreCovers.push({ type: 'file', data: file });
        }
    });
    input.value = '';
    renderAdminCoverPreviews();
};

function renderAdminCoverPreviews() {
    const grid = document.getElementById('sCoverPreviewGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const items = window.adminPendingStoreCovers || [];
    if (items.length === 0) {
        grid.style.display = 'none';
        return;
    }
    grid.style.display = 'flex';
    items.forEach((item, idx) => {
        const container = document.createElement('div');
        container.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 12px; overflow: hidden; border: 2px solid #e2e8f0;';
        const img = document.createElement('img');
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        if (item.type === 'file') {
            const reader = new FileReader();
            reader.onload = e => img.src = e.target.result;
            reader.readAsDataURL(item.data);
        } else {
            img.src = item.data;
        }
        const del = document.createElement('button');
        del.innerHTML = '✕';
        del.style.cssText = 'position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer;';
        del.onclick = (e) => { e.preventDefault(); removeAdminPendingCover(idx); };
        container.appendChild(img);
        container.appendChild(del);
        grid.appendChild(container);
    });
}

window.removeAdminPendingCover = (idx) => {
    window.adminPendingStoreCovers.splice(idx, 1);
    renderAdminCoverPreviews();
};

async function loadAdminCategories() {
    const sType = document.getElementById('sType');
    if (!sType) return;

    try {
        const snap = await db.collection('categories').get();
        let html = '<option value="">اختر القسم...</option>';
        
        if (snap.empty) {
            html += '<option value="متنوع">متنوع</option>';
        } else {
            snap.forEach(doc => {
                const cat = doc.data();
                html += `<option value="${doc.id}">${cat.name}</option>`;
            });
        }
        
        sType.innerHTML = html;
    } catch (err) {
        console.error("Error loading categories:", err);
        sType.innerHTML = '<option value="متنوع">متنوع (خطأ في التحميل)</option>';
    }
}

async function initStoreManagement() {
    const list = document.getElementById('adminStoresList');
    if(!list) return;
    
    // Load categories immediately to have them ready
    loadAdminCategories();

    const addBtn = document.getElementById('addStoreBtn');
    if(addBtn) addBtn.onclick = () => showStoreModal();
    
    const genBtn = document.getElementById('generateStoresBtn');
    if(genBtn) genBtn.onclick = () => generateStoresFromCategories();
    
    const storeForm = document.getElementById('storeForm');
    if(storeForm) storeForm.onsubmit = saveStore;

    const closeModal = document.getElementById('closeStoreModal');
    if(closeModal) closeModal.onclick = () => document.getElementById('storeModal').style.display = 'none';

    loadStores();
}

async function loadStores() {
    try {
        const snap = await db.collection('merchants').get();
        window.allStores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderStoresList();
    } catch (err) { console.error("Error loading stores:", err); }
}

function renderStoresList() {
    const list = document.getElementById('adminStoresList');
    if(!list) return;
    list.innerHTML = '';

    if(window.allStores.length === 0) {
        list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#64748b;">لا توجد متاجر حالياً. اضغط على "توليد من الأقسام" للبدء سريعاً! 🚀</td></tr>';
        return;
    }

    window.allStores.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding:15px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${s.logo || 'https://ui-avatars.com/api/?name='+s.name+'&background=ff6b00&color=fff'}" style="width:40px; height:40px; border-radius:10px; object-fit:cover;">
                    <div style="font-weight:900;">${s.name}</div>
                </div>
            </td>
            <td>${s.type || s.category || '---'}</td>
            <td style="text-align:center;"><span class="badge" style="background:#f1f5f9; color:#475569;">${s.productCount || 0}</span></td>
            <td><span class="badge ${s.isOpen !== false ? 'badge-completed' : 'badge-cancelled'}">${s.isOpen !== false ? 'مفتوح' : 'مغلق'}</span></td>
            <td style="text-align:center;">
                <div style="display:flex; justify-content:center; gap:8px;">
                    <button onclick="showStoreModal('${s.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer;"><i data-lucide="edit"></i></button>
                    <button onclick="deleteStore('${s.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        `;
        list.appendChild(row);
    });
    if(window.lucide) lucide.createIcons();
}

function showStoreModal(id = null) {
    window.currentStoreEditId = id;
    const modal = document.getElementById('storeModal');
    const form = document.getElementById('storeForm');
    
    // Refresh categories when opening modal
    loadAdminCategories().then(() => {
        // Clear image previews
        document.getElementById('sLogoPreview').style.display = 'none';
        document.getElementById('sLogoUrl').value = '';
        window.adminPendingStoreCovers = [];
        renderAdminCoverPreviews();

        if(id) {
            const s = window.allStores.find(st => st.id === id);
            if(s) {
                document.getElementById('sName').value = s.name || '';
                document.getElementById('sType').value = s.category || s.type || '';
                document.getElementById('sDesc').value = s.description || '';
                document.getElementById('storeModalTitle').textContent = "تعديل متجر: " + s.name;
                
                // Handle Logo
                if (s.logo) {
                    const lp = document.getElementById('sLogoPreview');
                    lp.src = s.logo;
                    lp.style.display = 'block';
                    document.getElementById('sLogoUrl').value = s.logo;
                }
                
                // Handle Multi Covers
                const covers = s.covers || (s.cover ? [s.cover] : []);
                window.adminPendingStoreCovers = covers.map(url => ({ type: 'url', data: url }));
                renderAdminCoverPreviews();
            }
        } else {
            form.reset();
            document.getElementById('storeModalTitle').textContent = "إضافة متجر جديد";
        }
        modal.style.display = 'flex';
    });
}

async function saveStore(e) {
    if(e) e.preventDefault();
    
    const submitBtn = document.querySelector('#storeForm button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    
    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" style="width:18px;"></i> جاري الحفظ...';
            if (window.lucide) lucide.createIcons();
        }

        const name = document.getElementById('sName').value;
        const typeSelect = document.getElementById('sType');
        const categoryId = typeSelect ? typeSelect.value : 'all';
        const type = typeSelect && typeSelect.selectedIndex >= 0 ? typeSelect.options[typeSelect.selectedIndex].text : 'متنوع';
        const desc = document.getElementById('sDesc').value;
        const logoFile = document.getElementById('sLogoFile').files[0];
        const existingLogo = document.getElementById('sLogoUrl').value;
        
        let logoUrl = existingLogo;
        if (logoFile) {
            logoUrl = await uploadFile(logoFile, 'merchants/logos');
        }

        // Handle Multi Covers
        const coverItems = window.adminPendingStoreCovers || [];
        const coverUrls = await Promise.all(coverItems.map(async item => {
            if (item.type === 'file') {
                return await uploadFile(item.data, 'merchants/covers');
            }
            return item.data;
        }));

        const data = {
            name,
            type,
            category: categoryId,
            logo: logoUrl || '',
            cover: coverUrls[0] || '', // Primary cover (legacy support)
            covers: coverUrls,         // New multi-cover array
            description: desc,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if(window.currentStoreEditId) {
            await db.collection('merchants').doc(window.currentStoreEditId).update(data);
        } else {
            data.isOpen = true; // Default to open for new stores
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('merchants').add(data);
        }
        
        document.getElementById('storeModal').style.display = 'none';
        loadStores();
        showToast("✅ تم حفظ بيانات المتجر بنجاح");
    } catch (err) { 
        console.error("Save Store Error:", err);
        alert("حدث خطأ أثناء الحفظ: " + err.message); 
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function generateStoresFromCategories() {
    if(!confirm("سيتم إنشاء متجر افتراضي لكل قسم حالي لديك وربط المنتجات به. هل أنت متأكد؟")) return;
    
    try {
        showToast("⏳ جاري إنشاء المتاجر وربط المنتجات...");
        
        // 1. Get Categories
        const catSnap = await db.collection('categories').get();
        const prodSnap = await db.collection('products').get();
        
        const batch = db.batch();
        
        for(const doc of catSnap.docs) {
            const cat = doc.data();
            const catId = doc.id;
            
            // Check if store already exists for this category
            const existing = window.allStores.find(s => s.category === catId);
            if(existing) continue;

            const merchantRef = db.collection('merchants').doc();
            batch.set(merchantRef, {
                name: "متجر " + cat.name,
                type: cat.name,
                category: catId,
                logo: "",
                cover: "",
                description: "كل ما تحتاجه من " + cat.name + " في مكان واحد",
                isOpen: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Link products in this category to this merchant
            prodSnap.docs.forEach(pDoc => {
                if(pDoc.data().category === catId) {
                    batch.update(pDoc.ref, { merchantId: merchantRef.id });
                }
            });
        }
        
        await batch.commit();
        showToast("🎉 تمت العملية بنجاح! تم إنشاء المحلات وربط المنتجات.");
        loadStores();
    } catch (err) { alert("فشل التوليد: " + err.message); }
}

async function deleteStore(id) {
    if(!confirm("هل أنت متأكد من حذف هذا المتجر نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    
    try {
        showToast("⏳ جاري الحذف...");
        await db.collection('merchants').doc(id).delete();
        showToast("✅ تم حذف المتجر بنجاح");
        loadStores();
    } catch (err) {
        alert("فشل الحذف: " + err.message);
    }
}

// --- Image Helpers Integrated Above ---



// Initialize everything on load
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path.includes('admin-settings.html')) {
        loadSiteConfig();
        loadPaymentConfig();
        loadBannerSettings();
        loadAdminOffers();
        loadCategoriesAdmin();
    }
    
    // For products and merchant products pages
    if (path.includes('admin-products.html') || path.includes('admin-merchant-products.html')) {
        populateProductCategories();
    }
    
    // Initialize Stores if on stores page
    if (path.includes('admin-stores.html')) {
        initStoreManagement();
    }
});

async function populateProductCategories() {
    const pCat = document.getElementById('pCategory');
    const mpCat = document.getElementById('mpCategory');
    if (!pCat && !mpCat) return;

    try {
        const snap = await db.collection('categories').get();
        let html = '<option value="">اختر القسم...</option>';
        snap.forEach(doc => {
            html += `<option value="${doc.id}">${doc.data().name}</option>`;
        });
        
        if (pCat) pCat.innerHTML = html;
        if (mpCat) mpCat.innerHTML = html;
    } catch (err) {
        console.error("Error populating categories:", err);
    }
}
