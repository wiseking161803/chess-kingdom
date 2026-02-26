/**
 * Shop Page — Chợ Phiên + Nạp Tiền
 */
const ShopPage = {
    open(totalStars) {
        if (totalStars < 50) {
            Toast.warning('🔒 Cần ít nhất 50 sao để mở khóa Chợ Phiên!');
            return;
        }
        this.loadShop();
    },

    async loadShop() {
        try {
            const data = await API.get('/shop/items');

            const itemsHTML = data.items.map(item => {
                const limitBadge = item.daily_limit ? `<span class="shop-limit-badge">📅 ${item.daily_limit}/ngày</span>`
                    : item.weekly_limit ? `<span class="shop-limit-badge">📆 ${item.weekly_limit}/tuần</span>`
                        : '';
                return `
                <div class="shop-card">
                    <div class="shop-card-icon">${item.icon_url || '🎁'}</div>
                    <div class="shop-card-body">
                        <div class="shop-card-name">${item.name} ${limitBadge}</div>
                        <div class="text-small text-muted">${item.description || ''}</div>
                        <div class="shop-card-price">${item.cost.toLocaleString()} ${item.cost_type === 'coins' ? '🪙' : '⭐'}</div>
                        ${item.owned_quantity > 0 ? `<div class="text-xs text-muted">Đã có: ${item.owned_quantity}</div>` : ''}
                        <button class="btn btn-primary btn-sm mt-1" onclick="ShopPage.buy(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.cost})"
                            ${(item.cost_type === 'coins' && data.balance.coins < item.cost) || (item.cost_type === 'stars' && data.balance.stars < item.cost) ? 'disabled' : ''}>
                            🛒 Mua
                        </button>
                    </div>
                </div>
            `}).join('');

            Modal.create({
                id: 'shop-modal',
                title: 'Chợ Phiên',
                icon: '🏪',
                size: 'modal-lg',
                content: `
                    <div style="display:flex;gap:16px;margin-bottom:16px;justify-content:center;flex-wrap:wrap;">
                        <div class="stat-badge" style="background:var(--bg-main);color:var(--text-primary);">
                            ⭐ ${data.balance.stars} sao
                        </div>
                        <div class="stat-badge" style="background:var(--bg-main);color:var(--text-primary);">
                            🪙 ${data.balance.coins.toLocaleString()} xu
                        </div>
                    </div>

                    <div class="tabs">
                        <button class="tab active" onclick="ShopPage.switchTab('shop', this)">🛒 Cửa Tiệm</button>
                        <button class="tab" onclick="ShopPage.switchTab('premium', this)">💎 Nạp Tiền</button>
                        <button class="tab" onclick="ShopPage.switchTab('inventory', this)">🎒 Kho Đồ</button>
                    </div>

                    <div id="shop-tab">
                        <div class="shop-grid">${itemsHTML}</div>
                    </div>
                    <div id="premium-tab" class="hidden">
                        <div id="premium-content">Đang tải...</div>
                    </div>
                    <div id="inventory-tab" class="hidden">
                        <div id="inventory-content">Đang tải...</div>
                    </div>
                `
            });
            Modal.show('shop-modal');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async buy(itemId, itemName, cost) {
        if (!confirm(`Bạn có chắc muốn mua ${itemName}?`)) return;

        try {
            const result = await API.post('/shop/purchase', { item_id: itemId });
            Toast.success(result.message);
            Celebration.show({
                icon: '🛒',
                title: 'Mua thành công!',
                subtitle: itemName,
                duration: 2000
            });
            Modal.hide('shop-modal');
            this.loadShop();
            if (typeof HomePage !== 'undefined') HomePage.refreshStats();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    switchTab(tab, btn) {
        document.querySelectorAll('#shop-modal .tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('shop-tab').classList.toggle('hidden', tab !== 'shop');
        document.getElementById('premium-tab').classList.toggle('hidden', tab !== 'premium');
        document.getElementById('inventory-tab').classList.toggle('hidden', tab !== 'inventory');

        if (tab === 'inventory') this.loadInventory();
        if (tab === 'premium') this.loadPremium();
    },

    async loadPremium() {
        try {
            const data = await API.get('/payment/products');
            const container = document.getElementById('premium-content');

            const typeLabels = {
                membership: { icon: '👑', title: 'Hộ Chiếu Vương Quốc', color: '#ffd200' },
                monthly_card: { icon: '🃏', title: 'Thẻ Tháng', color: '#4ecdc4' },
                coins: { icon: '💰', title: 'Mua Xu', color: '#ff6b6b' }
            };

            let html = '';
            let lastType = '';
            for (const p of data.products) {
                if (p.type !== lastType) {
                    const meta = typeLabels[p.type] || { icon: '📦', title: p.type, color: '#aaa' };
                    html += `<div style="margin-top:16px;font-size:1.1rem;font-weight:700;color:${meta.color};">${meta.icon} ${meta.title}</div>`;
                    lastType = p.type;
                }
                const bonus = p.type === 'coins' && p.coins > p.price ? ` <span style="color:#4ecdc4;font-size:0.8rem;">(+${Math.round((p.coins / p.price - 1) * 100)}%)</span>` : '';
                html += `
                <div class="shop-card" style="border-left:3px solid ${typeLabels[p.type]?.color || '#aaa'};">
                    <div class="shop-card-body" style="width:100%;">
                        <div class="shop-card-name" style="font-size:1rem;">${p.name}${bonus}</div>
                        <div class="text-small text-muted">${p.desc}</div>
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
                            <div style="font-weight:700;color:${typeLabels[p.type]?.color || '#ffd200'};font-size:1.1rem;">${p.price.toLocaleString()}đ</div>
                            <button class="btn btn-primary btn-sm" onclick="ShopPage.buyPremium('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price})">
                                💎 Mua
                            </button>
                        </div>
                    </div>
                </div>`;
            }

            container.innerHTML = html || '<div class="empty-state"><div class="empty-state-icon">💎</div><div class="empty-state-text">Không có sản phẩm</div></div>';
        } catch (err) {
            document.getElementById('premium-content').innerHTML = '<div style="color:#e74c3c;">Lỗi tải sản phẩm</div>';
        }
    },

    async buyPremium(productId, productName, price) {
        if (!confirm(`Bạn muốn mua ${productName} (${price.toLocaleString()}đ)?\n\nSau khi xác nhận, bạn sẽ được chuyển đến trang thanh toán.`)) return;

        try {
            const result = await API.post('/payment/create-order', { product_id: productId });
            Modal.hide('shop-modal');
            // Navigate to payment page (use location.href to avoid popup blockers)
            window.location.href = `/payment.html?order_id=${result.order_id}&product=${encodeURIComponent(productName)}&amount=${price}&uid=${App.user?.id || ''}`;
            Toast.success(`Đã tạo đơn hàng #${result.order_id}. Chuyển khoản và gửi ảnh qua Zalo!`);
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async loadInventory() {
        try {
            const data = await API.get('/shop/inventory');
            const container = document.getElementById('inventory-content');

            if (data.inventory.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎒</div><div class="empty-state-text">Kho đồ trống</div></div>';
                return;
            }

            container.innerHTML = data.inventory.map(item => `
                <div class="quest-card">
                    <div class="quest-icon" style="font-size:2rem;background:var(--bg-main);">${item.icon_url || '🎁'}</div>
                    <div class="quest-info">
                        <div class="quest-title">${item.name}</div>
                        <div class="text-small text-muted">${item.description || ''}</div>
                    </div>
                    <div class="stat-badge" style="background:var(--bg-main);color:var(--text-primary);">
                        x${item.quantity}
                    </div>
                </div>
            `).join('');
        } catch (err) {
            Toast.error(err.message);
        }
    }
};
