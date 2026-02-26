/**
 * Hall Page — Đình Làng / Leaderboard — 3 Tabs
 * Tab 1: ELO Rankings + Daily ELO Reward (top 5)
 * Tab 2: Stars Rankings + Daily Stars Reward (top 5)
 * Tab 3: Dragon Arena Rankings + 6-hourly Reward (top 5)
 */
const HallPage = {
    async open() {
        try {
            const [eloData, starsData, arenaData, dailyStatus] = await Promise.all([
                API.get('/leaderboard/elo?limit=20'),
                API.get('/leaderboard/stars?limit=20'),
                API.get('/arena/rankings').catch(() => ({ rankings: [] })),
                API.get('/leaderboard/daily-status').catch(() => ({}))
            ]);

            // Get arena status
            let arenaStatus = {};
            try { arenaStatus = await API.get('/arena/my-status'); } catch (e) { }

            const renderRow = (item, valueLabel) => {
                const medals = ['🥇', '🥈', '🥉'];
                const rankDisplay = item.rank <= 3 ? medals[item.rank - 1] : item.rank;
                return `
                    <li class="leaderboard-row ${item.is_current_user ? 'current-user' : ''}">
                        <span class="leaderboard-rank">${rankDisplay}</span>
                        <span class="user-avatar" style="font-size:0.9rem;width:32px;height:32px;flex-shrink:0;">
                            ${(item.display_name || 'U')[0]}
                        </span>
                        <span class="leaderboard-name">${item.display_name}</span>
                        <span class="leaderboard-score">${valueLabel}</span>
                    </li>
                `;
            };

            const eloHTML = eloData.leaderboard.length > 0
                ? `<ul class="leaderboard-list">${eloData.leaderboard.map(r => renderRow(r, `${r.current_elo} ELO`)).join('')}</ul>`
                : '<div class="empty-state"><div class="empty-state-text">Chưa có dữ liệu</div></div>';

            const starsHTML = starsData.leaderboard.length > 0
                ? `<ul class="leaderboard-list">${starsData.leaderboard.map(r => renderRow(r, `${r.knowledge_stars} ⭐`)).join('')}</ul>`
                : '<div class="empty-state"><div class="empty-state-text">Chưa có dữ liệu</div></div>';

            // Arena rankings
            const ELEM_ICONS = { metal: '🪙', wood: '🌿', water: '💧', fire: '🔥', earth: '🪨', light: '✨', dark: '🌑' };
            const arenaRankings = arenaData.rankings || [];
            const arenaHTML = arenaRankings.length > 0
                ? `<ul class="leaderboard-list">${arenaRankings.map(r => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const rankDisplay = r.rank <= 3 ? medals[r.rank - 1] : r.rank;
                    const elemIcon = ELEM_ICONS[r.main_element] || '🐉';
                    return `
                        <li class="leaderboard-row ${r.is_current_user ? 'current-user' : ''}">
                            <span class="leaderboard-rank">${rankDisplay}</span>
                            <span class="user-avatar" style="font-size:0.9rem;width:32px;height:32px;flex-shrink:0;">
                                ${elemIcon}
                            </span>
                            <span class="leaderboard-name">${r.display_name} ${r.is_bot ? '<span style="font-size:0.6rem;opacity:0.4">🤖</span>' : ''}</span>
                            <span class="leaderboard-score">${r.dragon_count}🐉 Lv.${r.max_level || '?'}</span>
                        </li>
                    `;
                }).join('')}</ul>`
                : '<div class="empty-state"><div class="empty-state-text">Chưa có dữ liệu</div></div>';

            // ELO daily reward banner
            let eloDailyHTML = '';
            if (dailyStatus.in_top5 && !dailyStatus.claimed) {
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                eloDailyHTML = `
                    <div class="daily-reward-banner" id="daily-reward-banner-elo">
                        <span>${medals[dailyStatus.rank - 1]} Bạn đang Top ${dailyStatus.rank} ELO!</span>
                        <button class="btn btn-accent btn-sm" onclick="HallPage.claimDaily()">🎁 Nhận Thưởng</button>
                    </div>
                `;
            } else if (dailyStatus.claimed) {
                eloDailyHTML = `<div class="daily-reward-banner daily-reward-banner--claimed">✅ Đã nhận thưởng ELO hôm nay</div>`;
            }

            // Arena reward banner
            let arenaDailyHTML = '';
            const unclaimed = arenaStatus.unclaimed_rewards;
            if (unclaimed && (unclaimed.tickets > 0 || unclaimed.coins > 0)) {
                arenaDailyHTML = `
                    <div class="daily-reward-banner" id="daily-reward-banner-arena">
                        <span>🏟️ Thưởng Đấu Trường: +${unclaimed.tickets}🎫 +${(unclaimed.coins || 0).toLocaleString()}🪙</span>
                        <button class="btn btn-accent btn-sm" onclick="HallPage.claimArena()">🎁 Nhận</button>
                    </div>
                `;
            }

            Modal.create({
                id: 'hall-modal',
                title: 'Đình Làng — Bảng Xếp Hạng',
                icon: '🏛️',
                size: 'modal-lg',
                content: `
                    <div class="tabs">
                        <button class="tab active" onclick="HallPage.switchTab('elo', this)">📊 ELO</button>
                        <button class="tab" onclick="HallPage.switchTab('stars', this)">⭐ Sao</button>
                        <button class="tab" onclick="HallPage.switchTab('arena', this)">🐉 Đấu Trường</button>
                    </div>

                    <!-- Countdown to next reward -->
                    <div style="text-align:center;padding:8px 12px;background:linear-gradient(135deg,rgba(241,196,15,0.12),rgba(230,126,34,0.12));
                         border:1px solid rgba(241,196,15,0.25);border-radius:10px;margin-bottom:8px;">
                        <div style="font-size:0.72rem;color:rgba(255,255,255,0.6);">⏰ Phát thưởng lúc 6:00 sáng mỗi ngày</div>
                        <div id="hall-countdown" style="font-size:0.85rem;font-weight:700;color:#f1c40f;margin-top:2px;">
                            Đang tính...
                        </div>
                    </div>

                    <div id="hall-elo-tab">
                        <div class="reward-tiers-box">
                            <div class="reward-tiers-title">🏆 Phần Thưởng Hàng Ngày — Top ELO</div>
                            <table class="reward-tiers-table">
                                <tr><td>🥇 Top 1</td><td>5 🎫</td><td>10,000 🪙</td></tr>
                                <tr><td>🥈 Top 2</td><td>3 🎫</td><td>5,000 🪙</td></tr>
                                <tr><td>🥉 Top 3</td><td>2 🎫</td><td>3,000 🪙</td></tr>
                                <tr><td>4️⃣5️⃣ Top 4-5</td><td>1 🎫</td><td>1,000 🪙</td></tr>
                            </table>
                        </div>
                        ${eloDailyHTML}
                        ${eloHTML}
                    </div>

                    <div id="hall-stars-tab" class="hidden">
                        <div class="reward-tiers-box">
                            <div class="reward-tiers-title">🏆 Phần Thưởng Hàng Ngày — Top Sao</div>
                            <table class="reward-tiers-table">
                                <tr><td>🥇 Top 1</td><td>5 🎫</td><td>10,000 🪙</td></tr>
                                <tr><td>🥈 Top 2</td><td>3 🎫</td><td>5,000 🪙</td></tr>
                                <tr><td>🥉 Top 3</td><td>2 🎫</td><td>3,000 🪙</td></tr>
                                <tr><td>4️⃣5️⃣ Top 4-5</td><td>1 🎫</td><td>1,000 🪙</td></tr>
                            </table>
                        </div>
                        ${starsHTML}
                    </div>

                    <div id="hall-arena-tab" class="hidden">
                        <div class="reward-tiers-box">
                            <div class="reward-tiers-title">🏟️ Phần Thưởng Mỗi 6 Giờ — Đấu Trường Rồng</div>
                            <table class="reward-tiers-table">
                                <tr><td>🥇 Top 1</td><td>5 🎫</td><td>15,000 🪙</td></tr>
                                <tr><td>🥈 Top 2</td><td>4 🎫</td><td>10,000 🪙</td></tr>
                                <tr><td>🥉 Top 3</td><td>3 🎫</td><td>8,000 🪙</td></tr>
                                <tr><td>4️⃣ Top 4</td><td>2 🎫</td><td>5,000 🪙</td></tr>
                                <tr><td>5️⃣ Top 5</td><td>2 🎫</td><td>4,000 🪙</td></tr>
                                <tr><td>6-8</td><td>1 🎫</td><td>1.5k-3k 🪙</td></tr>
                                <tr><td>9-10</td><td>—</td><td>500-1k 🪙</td></tr>
                            </table>
                        </div>
                        ${arenaDailyHTML}
                        ${arenaStatus.rank ? `<div style="text-align:center;padding:8px;font-weight:600;opacity:0.6;">Hạng của bạn: #${arenaStatus.rank}</div>` : ''}
                        ${arenaHTML}
                    </div>
                `
            });
            Modal.show('hall-modal');
            this.startCountdown();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    startCountdown() {
        if (this._countdownTimer) clearInterval(this._countdownTimer);
        const update = () => {
            const el = document.getElementById('hall-countdown');
            if (!el) { clearInterval(this._countdownTimer); return; }
            // Next 6:00 AM UTC+7 = 23:00 UTC previous day
            const now = new Date();
            const vnNow = new Date(now.getTime() + 7 * 3600000);
            const target = new Date(vnNow);
            target.setHours(6, 0, 0, 0);
            if (vnNow >= target) target.setDate(target.getDate() + 1);
            const diff = target - vnNow;
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            el.textContent = `Còn ${h} giờ ${m} phút ${s} giây`;
        };
        update();
        this._countdownTimer = setInterval(update, 1000);
    },

    switchTab(tab, btn) {
        document.querySelectorAll('#hall-modal .tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('hall-elo-tab').classList.toggle('hidden', tab !== 'elo');
        document.getElementById('hall-stars-tab').classList.toggle('hidden', tab !== 'stars');
        document.getElementById('hall-arena-tab').classList.toggle('hidden', tab !== 'arena');
    },

    async claimDaily() {
        try {
            const result = await API.post('/leaderboard/claim-daily');
            Toast.success(result.message);
            Celebration.show({
                icon: '🏆',
                title: `Top ${result.rank}!`,
                subtitle: `+${result.tickets_earned} 🎫 +${result.coins_earned} 🪙`,
                duration: 3000
            });
            const banner = document.getElementById('daily-reward-banner-elo');
            if (banner) {
                banner.className = 'daily-reward-banner daily-reward-banner--claimed';
                banner.innerHTML = '✅ Đã nhận thưởng ELO hôm nay';
            }
            if (typeof HomePage !== 'undefined') HomePage.refreshStats();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async claimArena() {
        try {
            const result = await API.post('/arena/claim-rewards');
            Toast.success(result.message);
            Celebration.show({
                icon: '🏟️',
                title: 'Thưởng Đấu Trường!',
                subtitle: `+${result.tickets} 🎫 +${result.coins.toLocaleString()} 🪙`,
                duration: 3000
            });
            const banner = document.getElementById('daily-reward-banner-arena');
            if (banner) {
                banner.className = 'daily-reward-banner daily-reward-banner--claimed';
                banner.innerHTML = '✅ Đã nhận thưởng Đấu Trường';
            }
            if (typeof HomePage !== 'undefined') HomePage.refreshStats();
        } catch (err) {
            Toast.error(err.message);
        }
    }
};
