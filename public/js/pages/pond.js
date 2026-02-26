/**
 * Pond Page — Ao Ước Nguyện / Gacha
 */
const PondPage = {
    _pendingPrizes: [],
    _flippedCount: 0,

    async open() {
        try {
            const [dragonData, poolData] = await Promise.all([
                API.get('/dragon/me'),
                API.get('/dragon/gacha/pool')
            ]);

            const tickets = dragonData.tickets || 0;
            const hasDragon = !!dragonData.dragon;

            // Group pool by rarity for preview
            const rarityInfo = {
                common: { label: '🟢 Thường', color: '#9E9E9E', pct: '64%' },
                rare: { label: '🔵 Hiếm', color: '#2196F3', pct: '30%' },
                epic: { label: '🟣 Sử Thi', color: '#9C27B0', pct: '5%' },
                legendary: { label: '🟡 Huyền Thoại', color: '#FF9800', pct: '0.9%' },
                mythic: { label: '🔴 Thần Thoại', color: '#FF1493', pct: '0.1%' }
            };

            const poolHTML = poolData.pool.map(item => {
                const r = rarityInfo[item.rarity];
                const stats = [];
                if (item.hp_bonus) stats.push(`+${item.hp_bonus} HP`);
                if (item.att_bonus) stats.push(`+${item.att_bonus} ATT`);
                if (item.def_bonus) stats.push(`+${item.def_bonus} DEF`);
                if (item.crit_rate_bonus > 0) stats.push(`+${item.crit_rate_bonus}% Crit`);
                if (item.crit_dmg_bonus > 0) stats.push(`+${item.crit_dmg_bonus}% CritDMG`);
                return `
                    <div class="gacha-pool-item" style="border-left:3px solid ${r.color};">
                        <span class="gacha-pool-icon">${item.icon}</span>
                        <div class="gacha-pool-info">
                            <div class="gacha-pool-name">${item.name}</div>
                            <div class="gacha-pool-stats">${stats.join(', ')}</div>
                        </div>
                        <span class="gacha-pool-rarity" style="color:${r.color};">${r.label}</span>
                    </div>
                `;
            }).join('');

            Modal.create({
                id: 'pond-modal',
                title: 'Ao Ước Nguyện',
                icon: '🪷',
                size: 'modal-lg',
                content: `
                    <div class="gacha-container">
                        <div class="gacha-hero">
                            <div class="gacha-lotus">🪷</div>
                            <div class="gacha-subtitle">Thả phiếu bé ngoan vào ao sen để nhận trang bị rồng!</div>
                        </div>

                        <div class="gacha-balance">
                            <div class="stat-badge" style="background:var(--bg-main);color:var(--text-primary);font-size:1.1rem;">
                                🎫 <span id="gacha-tickets">${tickets}</span> Phiếu Bé Ngoan
                            </div>
                        </div>

                        ${!hasDragon ? `
                            <div class="gacha-warning">
                                <div>⚠️ Bạn cần vào <strong>Hang Rồng</strong> để nhận rồng trước khi gacha!</div>
                            </div>
                        ` : ''}

                        <div id="gacha-result" class="gacha-result hidden"></div>

                        <div class="gacha-actions" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                            <button class="btn btn-accent btn-lg gacha-btn" id="gacha-pull-btn"
                                onclick="PondPage.pull(false)"
                                ${tickets < 1 || !hasDragon ? 'disabled' : ''}>
                                🌸 Ước Nguyện (1 🎫)
                            </button>
                            <button class="btn btn-lg gacha-btn" id="gacha-multi-btn"
                                onclick="PondPage.pull(true)"
                                style="background:linear-gradient(135deg,#FF9800,#FF5722);color:#fff;border:none;font-weight:700;"
                                ${tickets < 10 || !hasDragon ? 'disabled' : ''}>
                                ⭐ x10 Ước Nguyện (10 🎫) — Chắc chắn Sử Thi!
                            </button>
                        </div>

                        <div class="gacha-rates" style="margin-top:24px;">
                            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;">
                                ${Object.values(rarityInfo).map(r => `
                                    <span style="color:${r.color};font-weight:600;">${r.label} ${r.pct}</span>
                                `).join('|')}
                            </div>
                            <div style="text-align:center;font-size:0.75rem;color:rgba(255,255,255,0.4);">x10 pull chắc chắn nhận trang bị Sử Thi 🟣</div>
                        </div>

                        <div class="tabs" style="margin-top:8px;">
                            <button class="tab active" onclick="PondPage.switchTab('pool', this)">📦 Pool Trang Bị</button>
                        </div>
                        <div id="gacha-pool-tab">
                            <div class="gacha-pool-list">${poolHTML}</div>
                        </div>
                    </div>
                `
            });
            Modal.show('pond-modal');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async pull(multi) {
        const btn = multi ? document.getElementById('gacha-multi-btn') : document.getElementById('gacha-pull-btn');
        const resultEl = document.getElementById('gacha-result');
        if (!btn || !resultEl) return;

        btn.disabled = true;
        btn.textContent = '✨ Đang ước nguyện...';

        resultEl.classList.remove('hidden');
        resultEl.innerHTML = `
            <div class="gacha-animation">
                <div class="gacha-spin-lotus">🪷</div>
                <div style="margin-top:12px;color:var(--text-secondary);">Ao sen đang lắng nghe lời nguyện...</div>
            </div>
        `;

        try {
            const result = await API.post('/dragon/gacha', { multi });

            const rarityColors = { common: '#9E9E9E', rare: '#2196F3', epic: '#9C27B0', legendary: '#FF9800', mythic: '#FF1493' };
            const rarityGlows = {
                common: 'rgba(158,158,158,0.25)',
                rare: 'rgba(33,150,243,0.35)',
                epic: 'rgba(156,39,176,0.45)',
                legendary: 'rgba(255,152,0,0.55)',
                mythic: 'rgba(255,20,147,0.65)'
            };

            await new Promise(r => setTimeout(r, 1200));

            const prizes = multi && result.prizes ? result.prizes : [result.prize];
            const isMulti = prizes.length > 1;

            // Build card HTML
            const cardsHTML = prizes.map((p, i) => {
                const color = rarityColors[p.rarity] || '#9E9E9E';
                const glow = rarityGlows[p.rarity] || 'rgba(100,100,100,0.3)';
                const isSpecial = ['epic', 'legendary', 'mythic'].includes(p.rarity);
                const stats = [];
                if (p.hp_bonus) stats.push(`+${p.hp_bonus} HP`);
                if (p.att_bonus) stats.push(`+${p.att_bonus} ATT`);
                if (p.def_bonus) stats.push(`+${p.def_bonus} DEF`);
                if (p.spd_bonus) stats.push(`+${p.spd_bonus} SPD`);
                if (p.crit_rate_bonus > 0) stats.push(`+${p.crit_rate_bonus}% Crit`);
                if (p.crit_dmg_bonus > 0) stats.push(`+${p.crit_dmg_bonus}% CritDMG`);

                return `<div class="gacha-card" onclick="PondPage.flipCard(${i})" style="perspective:600px;cursor:pointer;${isMulti ? '' : 'width:160px;margin:0 auto'}">
                    <div class="gacha-card-inner" id="gacha-card-${i}" style="position:relative;width:100%;${isMulti ? 'height:140px' : 'height:220px'};transition:transform 0.6s;transform-style:preserve-3d">
                        <div style="position:absolute;inset:0;backface-visibility:hidden;border-radius:12px;background:linear-gradient(145deg,#1a1a2e,#16213e,#0f3460);border:2px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;flex-direction:column;box-shadow:0 4px 15px rgba(0,0,0,0.4)">
                            <div style="font-size:${isMulti ? '2rem' : '3rem'};animation:cardPulse 1.5s ease-in-out infinite">❓</div>
                            <div style="font-size:0.55rem;opacity:0.4;margin-top:4px">Nhấn để lật</div>
                        </div>
                        <div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);border-radius:12px;background:linear-gradient(145deg,rgba(20,20,35,0.95),rgba(30,30,50,0.95));border:2px solid ${color};display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;box-shadow:0 0 20px ${glow},0 0 40px ${glow};overflow:hidden">
                            ${isSpecial ? `<div style="position:absolute;inset:0;pointer-events:none;overflow:hidden">
                                ${Array.from({ length: 6 }).map(() => `<div style="position:absolute;width:3px;height:3px;background:${color};border-radius:50%;animation:sparkle ${(1 + Math.random() * 2).toFixed(1)}s ease-in-out infinite ${(Math.random() * 2).toFixed(1)}s;left:${(Math.random() * 100).toFixed(0)}%;top:${(Math.random() * 100).toFixed(0)}%"></div>`).join('')}
                            </div>` : ''}
                            <div style="font-size:${isMulti ? '1.6rem' : '2.8rem'}">${p.icon}</div>
                            <div style="font-size:${isMulti ? '0.6rem' : '0.9rem'};font-weight:700;text-align:center;padding:0 4px;max-width:95%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${p.name}</div>
                            <div style="font-size:${isMulti ? '0.5rem' : '0.7rem'};color:${color};font-weight:600">${p.rarity_label}</div>
                            <div style="font-size:${isMulti ? '0.45rem' : '0.6rem'};color:rgba(255,255,255,0.5);text-align:center">${stats.join(' · ')}</div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            resultEl.innerHTML = `
                <div style="margin-bottom:8px;text-align:center;font-size:1rem;font-weight:700">${isMulti ? '⭐ x10 Ước Nguyện!' : '🌸 Ước Nguyện!'}</div>
                <div style="text-align:center;font-size:0.65rem;opacity:0.5;margin-bottom:8px">Nhấn vào thẻ để lật!</div>
                <div style="display:${isMulti ? 'grid' : 'flex'};${isMulti ? 'grid-template-columns:repeat(5,1fr);gap:6px;max-width:550px;margin:0 auto' : 'justify-content:center'}">${cardsHTML}</div>
                <div style="text-align:center;margin-top:10px">
                    <button class="btn btn-sm" onclick="PondPage.flipAll()" style="font-size:0.7rem;padding:5px 16px;opacity:0.6">Lật tất cả</button>
                </div>
                <style>
                    @keyframes cardPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
                    @keyframes sparkle { 0%,100% { opacity:0; transform:scale(0); } 50% { opacity:1; transform:scale(1.5); } }
                    .gacha-card-inner.flipped { transform: rotateY(180deg) !important; }
                </style>
            `;

            this._pendingPrizes = prizes;
            this._flippedCount = 0;

            // Auto-flip remaining after 8s
            setTimeout(() => this.flipAll(), 8000);

            // Update ticket count
            const ticketEl = document.getElementById('gacha-tickets');
            if (ticketEl) ticketEl.textContent = result.remaining_tickets;

            const singleBtn = document.getElementById('gacha-pull-btn');
            const multiBtn = document.getElementById('gacha-multi-btn');
            if (singleBtn) { singleBtn.disabled = result.remaining_tickets < 1; singleBtn.textContent = '🌸 Ước Nguyện (1 🎫)'; }
            if (multiBtn) { multiBtn.disabled = result.remaining_tickets < 10; multiBtn.textContent = '⭐ x10 Ước Nguyện (10 🎫) — Chắc chắn Sử Thi!'; }

            Toast.success(result.message);
        } catch (err) {
            resultEl.innerHTML = '';
            resultEl.classList.add('hidden');
            btn.disabled = false;
            btn.textContent = multi ? '⭐ x10 Ước Nguyện (10 🎫) — Chắc chắn Sử Thi!' : '🌸 Ước Nguyện (1 🎫)';
            Toast.error(err.message);
        }
    },

    flipCard(idx) {
        const cardInner = document.getElementById(`gacha-card-${idx}`);
        if (!cardInner || cardInner.classList.contains('flipped')) return;

        cardInner.classList.add('flipped');
        this._flippedCount = (this._flippedCount || 0) + 1;

        // Celebrate special rarity cards
        const prize = this._pendingPrizes?.[idx];
        if (prize && ['epic', 'legendary', 'mythic'].includes(prize.rarity)) {
            const rarityColors = { epic: '#9C27B0', legendary: '#FF9800', mythic: '#FF1493' };
            const titles = { mythic: '🌟 THẦN THOẠI!', legendary: '✨ HUYỀN THOẠI!', epic: '🟣 SỬ THI!' };
            setTimeout(() => {
                Celebration.show({
                    icon: prize.icon,
                    title: titles[prize.rarity],
                    subtitle: prize.name,
                    duration: 2500
                });
            }, 400);
        }
    },

    flipAll() {
        const prizes = this._pendingPrizes || [];
        prizes.forEach((_, i) => {
            setTimeout(() => this.flipCard(i), i * 150);
        });
    },

    switchTab(tab, btn) {
        // Only one tab for now
    }
};
