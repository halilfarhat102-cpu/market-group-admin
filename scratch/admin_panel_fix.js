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
    const s = (statusMap && statusMap[o.status]) ? statusMap[o.status] : { label: o.status, icon: 'package', color: '#64748B' };

    panel.innerHTML = `
        <div style="padding:${isMobile ? '20px' : '40px'}; flex:1; overflow-y:auto; overflow-x:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
                <div>
                    <h2 style="margin:0; font-weight:900; font-size:${isMobile ? '1.2rem' : '1.5rem'};">تفاصيل الطلب</h2>
                    <div style="font-size:0.75rem; color:#94A3B8; font-weight:700; margin-top:5px;">بتاريخ: ${o.createdAt ? (typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().toLocaleString('ar-EG', {weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '') : '---'}</div>
                </div>
                <button onclick="closeOrderPanel()" style="background:#F1F5F9; border:none; width:40px; height:40px; border-radius:50%; cursor:pointer; color:#64748B;"><i data-lucide="x"></i></button>
            </div>

            <!-- Customer Hero -->
            <div style="background:linear-gradient(135deg, #FFF1E7 0%, #FFFFFF 100%); padding:${isMobile ? '20px' : '30px'}; border-radius:24px; border:1px solid #FF6B0015; margin-bottom:25px; display:flex; flex-direction:column; gap:15px; align-items:center; text-align:center;">
                <div style="position:relative;">
                    <img src="${o.userPhoto || 'https://ui-avatars.com/api/?name=U'}" style="width:${isMobile ? '80px' : '100px'}; height:${isMobile ? '80px' : '100px'}; border-radius:24px; object-fit:cover; border:5px solid white; box-shadow:0 10px 20px rgba(0,0,0,0.08);">
                    <div style="position:absolute; bottom:-5px; right:-5px; background:#10B981; width:20px; height:20px; border-radius:50%; border:3px solid white;"></div>
                </div>
                <div style="width: 100%;">
                    <div style="font-weight:900; font-size:${isMobile ? '1.3rem' : '1.6rem'}; color:#0F172A;">${o.customer || 'عميل مجهول'}</div>
                    <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px; margin-top:12px;">
                        <a href="tel:${o.phone || ''}" style="background:var(--primary); color:white; padding:8px 16px; border-radius:12px; font-weight:800; font-size:0.8rem; text-decoration:none; display:flex; align-items:center; gap:6px;"><i data-lucide="phone" style="width:14px;"></i> اتصل</a>
                        <a href="${o.location && o.location.startsWith('http') ? o.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address || o.customer || '')}`}" target="_blank" style="background:white; color:#3B82F6; padding:8px 16px; border-radius:12px; border:1px solid #3B82F615; font-weight:800; font-size:0.8rem; text-decoration:none; display:flex; align-items:center; gap:6px;"><i data-lucide="map-pin" style="width:14px;"></i> الخريطة</a>
                        <a href="https://wa.me/2${o.phone || ''}" target="_blank" style="background:#10B98115; color:#10B981; padding:8px 12px; border-radius:12px; border:1px solid #10B98133;"><i data-lucide="message-circle" style="width:18px;"></i></a>
                    </div>
                </div>
            </div>

            <!-- Digital Payment Info -->
            ${(o.paymentMethod === 'vodafone_cash' || o.paymentMethod === 'instapay' || o.paymentProof) ? `
                <div style="background: ${o.status === 'cancelled' ? '#FEF2F2' : '#FFF7ED'}; border: 2px solid ${o.paymentConfirmed ? '#10B981' : (o.status === 'cancelled' ? '#EF4444' : '#F59E0B')}; padding: 20px; border-radius: 24px; margin-bottom: 25px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h4 style="margin: 0; color: #1E293B; font-size: 0.9rem; font-weight: 900;">تفاصيل الدفع الرقمي</h4>
                        <span style="background: ${o.paymentConfirmed ? '#10B981' : (o.status === 'cancelled' ? '#EF4444' : '#F59E0B')}; color: white; font-size: 0.65rem; padding: 4px 10px; border-radius: 50px; font-weight: 900;">
                            ${o.paymentConfirmed ? 'تم تأكيد الدفع ✅' : (o.status === 'cancelled' ? 'تم رفض الدفع ❌' : 'بانتظار التأكيد ⏳')}
                        </span>
                    </div>
                    <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 15px;">
                        <div id="receipt-container-${o.id}" style="position: relative; width: 110px; height: 110px; border-radius: 18px; background: #eee; overflow: hidden; border: 3px solid white; box-shadow: 0 8px 20px rgba(0,0,0,0.1); cursor: pointer;" onclick="const img = this.querySelector('img'); if(img) openImagePreview(img.src, 'إيصال الدفع')">
                            ${o.paymentProof ? 
                                `<img src="${o.paymentProof}" onerror="this.src='https://ui-avatars.com/api/?name=Error&background=FEE2E2&color=EF4444'" style="width: 100%; height: 100%; object-fit: cover;">` : 
                                `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.7rem; text-align:center; padding:5px; font-weight:700;">بانتظار رفع الإيصال...</div>`
                            }
                        </div>
                        <div style="flex:1;">
                            <div style="font-size: 0.8rem; color: #64748B; font-weight: 700; margin-bottom: 4px;">آخر 3 أرقام للمحول:</div>
                            <div style="font-size: 1.4rem; font-weight: 900; color: #1E293B; letter-spacing: 2px;">${o.paymentSenderDigits || '---'}</div>
                            <div style="margin-top: 10px; display: flex; gap: 8px;">
                                <button onclick="const img = document.querySelector('#receipt-container-${o.id} img'); if(img) openImagePreview(img.src)" style="background:#F1F5F9; border:none; padding:5px 10px; border-radius:8px; font-size:0.65rem; font-weight:800; cursor:pointer;">🔍 تكبير</button>
                                <a href="https://wa.me/2${o.phone}?text=${encodeURIComponent('مرحباً ' + o.customer + '، لم يظهر إيصال الدفع لطلبك رقم ' + (o.orderNumber || o.id.substring(0,5)) + '. يرجى إرساله هنا لتأكيد طلبك.')}" target="_blank" style="background:#10B98115; color:#10B981; padding:5px 10px; border-radius:8px; font-size:0.65rem; font-weight:800; text-decoration:none;">💬 اطلبه واتساب</a>
                            </div>
                        </div>
                    </div>
                    ${(!o.paymentConfirmed && o.status !== 'cancelled') ? `
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <button onclick="confirmOrderPayment('${o.id}')" style="background: #10B981; color: white; border: none; padding: 14px; border-radius: 15px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(16,185,129,0.2);">
                                <i data-lucide="check-circle" style="width: 16px;"></i> تأكيد الاستلام
                            </button>
                            <button onclick="updateOrderStatusManual('${o.id}', 'cancelled')" style="background: #EF4444; color: white; border: none; padding: 14px; border-radius: 15px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(239,68,68,0.2);">
                                <i data-lucide="x-circle" style="width: 16px;"></i> لم أستلم المبلغ
                            </button>
                        </div>
                    ` : (o.status === 'cancelled' ? `
                        <div style="background: #FEE2E2; color: #991B1B; padding: 12px; border-radius: 12px; text-align: center; font-weight: 800; font-size: 0.85rem; border: 1px dashed #F87171;">
                            تم إلغاء الطلب لعدم وصول الأموال
                        </div>
                    ` : '')}
                </div>
            ` : ''}

            <!-- Status Manager -->
            <div style="margin-bottom:25px;">
                <label style="display:block; margin-bottom:12px; font-weight:800; color:#64748B; font-size:0.85rem;">تحديث الحالة</label>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
                    ${['pending', 'processing', 'shipped', 'completed'].map(st => {
                        const sm = (statusMap && statusMap[st]) ? statusMap[st] : { label: st, icon: 'package', color: '#64748B' };
                        const active = o.status === st;
                        return `
                            <button onclick="updateOrderStatusManual('${o.id}', '${st}')" style="padding:${isMobile ? '10px' : '15px'}; border-radius:15px; border:2px solid ${active ? sm.color : '#F1F5F9'}; background:${active ? sm.color : 'white'}; color:${active ? 'white' : '#64748B'}; font-weight:900; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:${isMobile ? '0.75rem' : '0.9rem'};">
                                <i data-lucide="${sm.icon}" style="width:${isMobile ? '14px' : '16px'};"></i>
                                ${sm.label}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Items -->
            <div style="margin-bottom:25px;">
                <label style="display:block; margin-bottom:15px; font-weight:800; color:#64748B; font-size:0.85rem;">سلة المشتريات (${(o.items || []).length})</label>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${(o.items || []).map(it => `
                        <div style="display:flex; align-items:center; gap:12px; background:white; padding:12px; border-radius:20px; border:1px solid #F1F5F9;">
                            <img src="${it.image || 'https://via.placeholder.com/60'}" 
                                 onclick="openImagePreview('${it.image}', '${it.name}')"
                                 style="width:${isMobile ? '50px' : '70px'}; height:${isMobile ? '50px' : '70px'}; border-radius:15px; object-fit:cover; cursor:zoom-in; transition: transform 0.2s;">
                            <div style="flex:1;">
                                <div style="font-weight:900; font-size:0.9rem; color:#1E293B;">${it.name || 'منتج'}</div>
                                <div style="font-size:0.75rem; color:#94A3B8; font-weight:700;">الكمية: ${it.quantity || 1}</div>
                            </div>
                            <div style="text-align:left;">
                                <div style="font-weight:900; color:var(--primary); font-size:0.95rem;">${((it.quantity || 1) * (it.price || 0)).toLocaleString()} <small style="font-size:0.6rem;">ج.م</small></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Footer Action -->
        <div style="padding:${isMobile ? '20px' : '30px'}; background:#1E293B; border-radius:30px 30px 0 0; color:white;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <span style="opacity:0.6; font-weight:700; font-size:0.8rem;">الإجمالي</span>
                <span style="font-size:${isMobile ? '1.4rem' : '1.8rem'}; font-weight:900; color:var(--primary);">${(o.total || 0).toLocaleString()} <small style="font-size:0.7rem;">ج.م</small></span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                <button onclick="printThermalReceipt('${o.id}')" style="background:rgba(255,255,255,0.1); color:white; border:none; padding:12px; border-radius:15px; font-weight:900; cursor:pointer; font-size:0.75rem;"><i data-lucide="printer"></i> بون</button>
                <button onclick="downloadAdminInvoice('${o.id}')" style="background:#10B981; color:white; border:none; padding:12px; border-radius:15px; font-weight:900; cursor:pointer; font-size:0.75rem;"><i data-lucide="file-text"></i> PDF</button>
                <button onclick="deleteOrder('${o.id}'); closeOrderPanel();" style="background:#EF4444; color:white; border:none; padding:12px; border-radius:15px; font-weight:900; cursor:pointer; font-size:0.75rem;">حذف</button>
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}
