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
                const catMap = (cat) => {
                    if (['dragon_food', 'buff'].includes(cat)) return 'dragon_food';
                    if (['seed', 'garden'].includes(cat)) return 'garden';
                    if (['dragon_egg', 'special'].includes(cat)) return 'special';
                    return cat || 'other';
                };
                return `
                <div class="shop-card" data-category="${catMap(item.category)}">
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
                    </div>

                    <div id="shop-tab">
                        <div id="shop-category-tabs" style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
                            <button class="btn btn-sm active" onclick="ShopPage.filterCategory('all', this)" style="font-size:0.78rem;padding:6px 12px;border-radius:8px;font-weight:600;background:linear-gradient(135deg,rgba(108,92,231,0.3),rgba(168,85,247,0.2));border:2px solid rgba(168,85,247,0.5);color:#a855f7">📦 Tất cả</button>
                            <button class="btn btn-sm" onclick="ShopPage.filterCategory('dragon_food', this)" style="font-size:0.78rem;padding:6px 12px;border-radius:8px;font-weight:600;background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.12)">🍖 Rồng</button>
                            <button class="btn btn-sm" onclick="ShopPage.filterCategory('garden', this)" style="font-size:0.78rem;padding:6px 12px;border-radius:8px;font-weight:600;background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.12)">🌱 Hạt giống</button>
                            <button class="btn btn-sm" onclick="ShopPage.filterCategory('special', this)" style="font-size:0.78rem;padding:6px 12px;border-radius:8px;font-weight:600;background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.12)">✨ Đặc biệt</button>
                        </div>
                        <div class="shop-grid" id="shop-items-grid">${itemsHTML}</div>
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
        document.querySelectorAll('#shop-modal .tabs .tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        ['shop-tab', 'premium-tab', 'inventory-tab'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', id !== tab + '-tab');
        });
        if (tab === 'premium') this.loadPremium();
        if (tab === 'inventory') this.loadInventory();
    },

    filterCategory(category, btn) {
        // Update button styles
        document.querySelectorAll('#shop-category-tabs button').forEach(b => {
            b.style.background = 'rgba(255,255,255,0.04)';
            b.style.borderColor = 'rgba(255,255,255,0.12)';
            b.style.color = '';
            b.classList.remove('active');
        });
        btn.style.background = 'linear-gradient(135deg,rgba(108,92,231,0.3),rgba(168,85,247,0.2))';
        btn.style.borderColor = 'rgba(168,85,247,0.5)';
        btn.style.color = '#a855f7';
        btn.classList.add('active');

        // Filter items
        document.querySelectorAll('#shop-items-grid .shop-card').forEach(card => {
            if (category === 'all') {
                card.style.display = '';
            } else {
                card.style.display = card.dataset.category === category ? '' : 'none';
            }
        });
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
            let html = '';

            const totalItems = (data.inventory?.length || 0) + (data.eggs?.length || 0) + (data.equipment?.length || 0);
            if (totalItems === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎒</div><div class="empty-state-text">Kho đồ trống</div></div>';
                return;
            }

            // === DRAGON EGGS ===
            if (data.eggs && data.eggs.length > 0) {
                html += `<div style="margin-bottom:12px">
                    <div style="font-size:0.85rem;font-weight:700;margin-bottom:6px;color:#f39c12">🥚 Trứng Rồng (${data.eggs.length})</div>`;
                for (const egg of data.eggs) {
                    const ready = egg.ready;
                    const mins = Math.floor(egg.time_left / 60);
                    const hrs = Math.floor(mins / 60);
                    const timeStr = ready ? '✅ Sẵn sàng nở!' : `⏳ Còn ${hrs}h ${mins % 60}m`;
                    html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(243,156,18,0.08);border:1.5px solid rgba(243,156,18,0.25);margin-bottom:6px">
                        <div style="font-size:1.8rem">🥚</div>
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:700;font-size:0.85rem">${egg.name || 'Trứng Rồng'}</div>
                            <div style="font-size:0.72rem;color:${ready ? '#2ecc71' : '#f39c12'}">${timeStr}</div>
                        </div>
                        ${ready ? `<button class="btn btn-primary btn-sm" onclick="window.location.href='/dragon.html'" style="font-size:0.75rem;padding:5px 10px;white-space:nowrap">🐣 Nở</button>` : ''}
                    </div>`;
                }
                html += '</div>';
            }

            // === UNEQUIPPED EQUIPMENT ===
            if (data.equipment && data.equipment.length > 0) {
                const rarityColors = { common: '#9E9E9E', rare: '#2196F3', epic: '#9C27B0', legendary: '#FF9800', mythic: '#FF1493' };
                const rarityNames = { common: 'Thường', rare: 'Hiếm', epic: 'Sử Thi', legendary: 'Huyền Thoại', mythic: 'Thần Thoại' };
                html += `<div style="margin-bottom:12px">
                    <div style="font-size:0.85rem;font-weight:700;margin-bottom:6px;color:#9b59b6">⚔️ Trang Bị Chưa Đeo (${data.equipment.length})</div>`;
                for (const eq of data.equipment) {
                    const rc = rarityColors[eq.rarity] || '#666';
                    html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(155,89,182,0.06);border:1.5px solid ${rc}40;margin-bottom:6px">
                        <div style="font-size:1.6rem">${eq.icon || '⚔️'}</div>
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:700;font-size:0.85rem;color:${rc}">${eq.name}</div>
                            <div style="font-size:0.7rem;opacity:0.6">${rarityNames[eq.rarity] || eq.rarity} · ${eq.slot || ''}</div>
                        </div>
                        <button class="btn btn-sm" onclick="window.location.href='/dragon.html'" style="font-size:0.72rem;padding:4px 8px;background:${rc}20;border:1px solid ${rc}50;color:${rc}">Trang bị</button>
                    </div>`;
                }
                html += '</div>';
            }

            // === CONSUMABLE ITEMS ===
            if (data.inventory && data.inventory.length > 0) {
                html += `<div style="margin-bottom:12px">
                    <div style="font-size:0.85rem;font-weight:700;margin-bottom:6px;color:#3498db">🎒 Vật Phẩm (${data.inventory.length})</div>`;
                for (const item of data.inventory) {
                    html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(52,152,219,0.06);border:1.5px solid rgba(52,152,219,0.2);margin-bottom:6px">
                        <div style="font-size:1.6rem">${item.icon_url || '🎁'}</div>
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:700;font-size:0.85rem">${item.name}</div>
                            <div style="font-size:0.7rem;opacity:0.5">${item.description || item.category || ''}</div>
                        </div>
                        <div style="font-weight:700;font-size:0.9rem;color:#3498db">x${item.quantity}</div>
                    </div>`;
                }
                html += '</div>';
            }

            container.innerHTML = html;
        } catch (err) {
            Toast.error(err.message);
        }
    }
};
