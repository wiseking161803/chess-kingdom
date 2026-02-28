/**
 * UI/UX Enhancements for Chess Kingdom
 * A1-F2: Avatar, Animations, Daily Login, Progress Trail,
 * Dragon Mood, Rank Celebration, Coin Animation, Touch, Music, SFX
 */

/* ============================================================
   A1: Avatar Selector — Cho trẻ chọn avatar cá nhân hóa
   ============================================================ */
const AvatarSelector = {
    avatars: [
        { id: 'knight', emoji: '🧙‍♂️', name: 'Pháp Sư' },
        { id: 'princess', emoji: '👸', name: 'Công Chúa' },
        { id: 'knight2', emoji: '🤴', name: 'Hoàng Tử' },
        { id: 'cat', emoji: '🐱', name: 'Mèo Con' },
        { id: 'robot', emoji: '🤖', name: 'Robot' },
        { id: 'fox', emoji: '🦊', name: 'Cáo Nhỏ' },
        { id: 'panda', emoji: '🐼', name: 'Gấu Trúc' },
        { id: 'unicorn', emoji: '🦄', name: 'Kỳ Lân' },
        { id: 'dragon_baby', emoji: '🐲', name: 'Rồng Con' },
        { id: 'astronaut', emoji: '🧑‍🚀', name: 'Phi Hành Gia' },
        { id: 'ninja', emoji: '🥷', name: 'Ninja' },
        { id: 'fairy', emoji: '🧚', name: 'Tiên Nữ' },
    ],

    getCurrentAvatar() {
        const saved = localStorage.getItem('ck_avatar');
        return saved || '🧙‍♂️';
    },

    setAvatar(emoji) {
        localStorage.setItem('ck_avatar', emoji);
        // Update all avatar displays
        document.querySelectorAll('.player-body').forEach(el => el.textContent = emoji);
        document.querySelectorAll('.user-avatar').forEach(el => el.textContent = emoji);
    },

    showSelector() {
        const current = this.getCurrentAvatar();
        const grid = this.avatars.map(a => `
            <div class="avatar-option ${a.emoji === current ? 'selected' : ''}" 
                 onclick="AvatarSelector.setAvatar('${a.emoji}'); AvatarSelector.showSelector();"
                 style="cursor:pointer;text-align:center;padding:12px;border-radius:16px;
                        background:${a.emoji === current ? 'linear-gradient(135deg,#6c5ce7,#a855f7)' : 'rgba(255,255,255,0.06)'};
                        border:2px solid ${a.emoji === current ? '#a855f7' : 'transparent'};
                        transition:all 0.3s;min-width:80px;"
                 onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                <div style="font-size:2.5rem;margin-bottom:4px;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.3));">${a.emoji}</div>
                <div style="font-size:0.7rem;font-weight:600;opacity:0.8;">${a.name}</div>
            </div>
        `).join('');

        Modal.create({
            id: 'avatar-selector',
            title: 'Chọn Nhân Vật',
            icon: '🎭',
            content: `
                <div style="text-align:center;margin-bottom:16px;color:rgba(255,255,255,0.6);font-size:0.85rem;">
                    Chọn nhân vật đại diện cho con trên bản đồ!
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">${grid}</div>
            `
        });
        Modal.show('avatar-selector');
    }
};

/* ============================================================
   A2: Ambient Village Animations — Sống động hóa bản đồ
   ============================================================ */
const VillageAmbience = {
    _interval: null,

    start() {
        const map = document.querySelector('.village-map-inner');
        if (!map) return;

        // Inject ambient layer if not exists
        if (!document.getElementById('ambient-layer')) {
            const layer = document.createElement('div');
            layer.id = 'ambient-layer';
            layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;';
            map.appendChild(layer);
        }

        this._spawnClouds();
        this._spawnBirds();
        this._spawnSmoke();

        // Repeat spawning
        this._interval = setInterval(() => {
            if (Math.random() > 0.5) this._spawnBirds();
            if (Math.random() > 0.7) this._spawnClouds();
        }, 8000);
    },

    stop() {
        if (this._interval) clearInterval(this._interval);
    },

    _spawnClouds() {
        const layer = document.getElementById('ambient-layer');
        if (!layer) return;
        for (let i = 0; i < 3; i++) {
            const cloud = document.createElement('div');
            const top = 5 + Math.random() * 20;
            const dur = 30 + Math.random() * 20;
            const size = 40 + Math.random() * 60;
            cloud.textContent = '☁️';
            cloud.style.cssText = `position:absolute;top:${top}%;left:-10%;font-size:${size}px;
                opacity:0.25;animation:cloudDrift ${dur}s linear forwards;animation-delay:${i * 5}s;`;
            layer.appendChild(cloud);
            setTimeout(() => cloud.remove(), (dur + i * 5) * 1000);
        }
    },

    _spawnBirds() {
        const layer = document.getElementById('ambient-layer');
        if (!layer) return;
        const bird = document.createElement('div');
        const top = 10 + Math.random() * 25;
        const dur = 12 + Math.random() * 8;
        bird.textContent = '🐦';
        bird.style.cssText = `position:absolute;top:${top}%;left:-5%;font-size:${16 + Math.random() * 12}px;
            opacity:0.6;animation:birdFly ${dur}s linear forwards;transform:scaleX(-1);`;
        layer.appendChild(bird);
        setTimeout(() => bird.remove(), dur * 1000);
    },

    _spawnSmoke() {
        const layer = document.getElementById('ambient-layer');
        if (!layer) return;
        // Smoke from buildings — subtle rising effect
        const smokePositions = [
            { x: 20, y: 32 }, // school chimney approx
            { x: 50, y: 25 }, // temple area
        ];
        smokePositions.forEach(pos => {
            setInterval(() => {
                const smoke = document.createElement('div');
                smoke.textContent = '💨';
                smoke.style.cssText = `position:absolute;left:${pos.x + (Math.random() - 0.5) * 2}%;
                    top:${pos.y}%;font-size:12px;opacity:0.3;
                    animation:smokeRise 4s ease-out forwards;`;
                layer.appendChild(smoke);
                setTimeout(() => smoke.remove(), 4000);
            }, 3000 + Math.random() * 2000);
        });
    }
};

/* ============================================================
   A3: Daily Login Popup — Chào mừng hàng ngày
   ============================================================ */
const DailyLogin = {
    check() {
        const today = new Date().toDateString();
        const lastLogin = localStorage.getItem('ck_last_login_popup');
        if (lastLogin === today) return;

        localStorage.setItem('ck_last_login_popup', today);

        const user = App.user || {};
        const stats = user.stats || {};
        const hour = new Date().getHours();
        let greeting = 'Chào buổi sáng';
        if (hour >= 12 && hour < 17) greeting = 'Chào buổi chiều';
        else if (hour >= 17) greeting = 'Chào buổi tối';

        const streakEmoji = stats.current_streak > 0 ? '🔥'.repeat(Math.min(stats.current_streak, 5)) : '❄️';

        setTimeout(() => {
            Modal.create({
                id: 'daily-login',
                title: `${greeting}!`,
                icon: hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙',
                content: `
                    <div style="text-align:center;padding:16px 0;">
                        <div style="font-size:4rem;margin-bottom:8px;animation:bounce 0.6s ease-out;">
                            ${AvatarSelector.getCurrentAvatar()}
                        </div>
                        <div style="font-size:1.3rem;font-weight:700;margin-bottom:4px;">
                            ${greeting}, ${user.display_name || 'Hiệp Sĩ'}! 
                        </div>
                        <div style="color:rgba(255,255,255,0.6);margin-bottom:16px;font-size:0.9rem;">
                            Sẵn sàng chinh phục Vương Quốc Cờ Vua hôm nay chưa? 🏰
                        </div>
                        
                        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;">
                            <div style="background:rgba(255,165,0,0.15);border:1px solid rgba(255,165,0,0.3);padding:10px 16px;border-radius:12px;text-align:center;">
                                <div style="font-size:1.5rem;">${streakEmoji}</div>
                                <div style="font-size:0.75rem;font-weight:600;">Chuỗi ${stats.current_streak || 0} ngày</div>
                            </div>
                            <div style="background:rgba(255,215,0,0.15);border:1px solid rgba(255,215,0,0.3);padding:10px 16px;border-radius:12px;text-align:center;">
                                <div style="font-size:1.5rem;">⭐</div>
                                <div style="font-size:0.75rem;font-weight:600;">${stats.knowledge_stars || 0} sao</div>
                            </div>
                            <div style="background:rgba(108,92,231,0.15);border:1px solid rgba(108,92,231,0.3);padding:10px 16px;border-radius:12px;text-align:center;">
                                <div style="font-size:1.5rem;">📊</div>
                                <div style="font-size:0.75rem;font-weight:600;">ELO ${stats.elo || 800}</div>
                            </div>
                        </div>
                        
                        <button class="btn btn-primary" 
                                onclick="Modal.hide('daily-login'); SoundFX.play('fanfare');"
                                style="background:linear-gradient(135deg,#6c5ce7,#a855f7);border:none;color:#fff;
                                       padding:12px 32px;border-radius:16px;font-weight:700;font-size:1rem;
                                       cursor:pointer;font-family:inherit;
                                       animation:pulse 2s ease-in-out infinite;">
                            🚀 Bắt Đầu Thôi!
                        </button>
                    </div>
                `
            });
            Modal.show('daily-login');
        }, 1500);
    }
};

/* ============================================================
   A4: Progress Trail — Thanh tiến trình mở khu vực
   ============================================================ */
const ProgressTrail = {
    milestones: [
        { stars: 0, name: 'Bắt đầu', icon: '🏠', unlocks: 'Tháp Kỳ Vương' },
        { stars: 50, name: 'Thương Nhân', icon: '🏪', unlocks: 'Chợ Phiên' },
        { stars: 200, name: 'Nông Dân', icon: '🌾', unlocks: 'Vườn Cây' },
        { stars: 600, name: 'Hiệp Sĩ Rồng', icon: '🐉', unlocks: 'Hang Rồng' },
        { stars: 1000, name: 'Pháp Sư', icon: '🌳', unlocks: 'Cây Đa + Ao Ước Nguyện' },
    ],

    render(currentStars) {
        const nextMilestone = this.milestones.find(m => m.stars > currentStars);
        if (!nextMilestone) return ''; // All unlocked

        const prevMilestoneStars = this.milestones
            .filter(m => m.stars <= currentStars)
            .reduce((max, m) => Math.max(max, m.stars), 0);

        const range = nextMilestone.stars - prevMilestoneStars;
        const progress = currentStars - prevMilestoneStars;
        const pct = Math.min(Math.round((progress / range) * 100), 100);

        return `
            <div class="progress-trail" onclick="ProgressTrail.showDetail()" style="cursor:pointer;">
                <div class="progress-trail-label">
                    <span>${nextMilestone.icon} ${nextMilestone.unlocks}</span>
                    <span>⭐ ${currentStars}/${nextMilestone.stars}</span>
                </div>
                <div class="progress-trail-bar">
                    <div class="progress-trail-fill" style="width:${pct}%;"></div>
                    <div class="progress-trail-glow" style="left:${pct}%;"></div>
                </div>
            </div>
        `;
    },

    showDetail() {
        const userStars = App.user?.stats?.total_stars_earned || 0;
        const html = this.milestones.map(m => {
            const done = userStars >= m.stars;
            return `
                <div style="display:flex;align-items:center;gap:12px;padding:10px;
                            background:${done ? 'rgba(46,204,113,0.12)' : 'rgba(255,255,255,0.04)'};
                            border-radius:12px;border:1px solid ${done ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.08)'};">
                    <div style="font-size:2rem;filter:${done ? 'none' : 'grayscale(1) opacity(0.4)'};">${m.icon}</div>
                    <div style="flex:1;">
                        <div style="font-weight:700;font-size:0.9rem;">${m.name}</div>
                        <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);">Mở: ${m.unlocks}</div>
                    </div>
                    <div style="font-weight:600;font-size:0.85rem;color:${done ? '#2ecc71' : '#e74c3c'};">
                        ${done ? '✅' : `🔒 ${m.stars}⭐`}
                    </div>
                </div>
            `;
        }).join('');

        Modal.create({
            id: 'progress-detail',
            title: 'Hành Trình Khám Phá',
            icon: '🗺️',
            content: `<div style="display:grid;gap:8px;">${html}</div>`
        });
        Modal.show('progress-detail');
    }
};

/* ============================================================
   B1: Dragon Evolution Animation
   ============================================================ */
const DragonEffects = {
    showEvolution(dragonName, newLevel) {
        const overlay = document.createElement('div');
        overlay.className = 'celebration-overlay';
        overlay.innerHTML = `
            <div class="celebration-content" style="position:relative;">
                <div style="font-size:6rem;animation:dragonEvolve 1.5s ease-out;filter:drop-shadow(0 0 30px #ffd200);">
                    🐉
                </div>
                <div class="celebration-title" style="background:linear-gradient(90deg,#ffd200,#ff6b6b);
                     -webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:1.8rem;">
                    TIẾN HÓA!
                </div>
                <div class="celebration-subtitle">${dragonName} → Lv.${newLevel}</div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Sparkle particles
        for (let i = 0; i < 80; i++) {
            const p = document.createElement('div');
            const hue = Math.random() * 60 + 30; // gold-orange
            p.style.cssText = `position:absolute;width:${4 + Math.random() * 8}px;height:${4 + Math.random() * 8}px;
                background:hsl(${hue},100%,60%);border-radius:50%;left:50%;top:50%;
                animation:evolveParticle ${1 + Math.random() * 1.5}s ease-out forwards;
                --dx:${(Math.random() - 0.5) * 300}px;--dy:${(Math.random() - 0.5) * 300}px;`;
            overlay.appendChild(p);
        }

        SoundFX.play('fanfare');
        requestAnimationFrame(() => overlay.classList.add('active'));

        setTimeout(() => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 500);
        }, 3500);
    },

    /* B2: Dragon Mood System */
    getMoodEmoji(dragon) {
        if (!dragon) return '😴';
        const hp = dragon.current_hp || 0;
        const maxHp = dragon.total_hp || dragon.hp || 1;
        const ratio = hp / maxHp;

        if (ratio <= 0) return '💀';
        if (ratio < 0.2) return '😰';
        if (ratio < 0.5) return '😟';
        if (ratio < 0.8) return '😊';
        return '😄';
    },

    getMoodText(dragon) {
        if (!dragon) return 'Đang ngủ...';
        const hp = dragon.current_hp || 0;
        const maxHp = dragon.total_hp || dragon.hp || 1;
        const ratio = hp / maxHp;

        if (ratio <= 0) return 'Kiệt sức rồi! Cần hồi phục...';
        if (ratio < 0.2) return 'Mệt quá... cho ăn đi!';
        if (ratio < 0.5) return 'Hơi đói bụng...';
        if (ratio < 0.8) return 'Khỏe mạnh!';
        return 'Tràn đầy năng lượng! 💪';
    },

    renderMoodBubble(dragon) {
        const mood = this.getMoodEmoji(dragon);
        const text = this.getMoodText(dragon);
        return `
            <div class="dragon-mood-bubble" style="display:flex;align-items:center;gap:8px;
                 padding:6px 12px;background:rgba(255,255,255,0.06);border-radius:12px;
                 border:1px solid rgba(255,255,255,0.1);margin-top:4px;">
                <span style="font-size:1.3rem;animation:moodBounce 2s ease-in-out infinite;">${mood}</span>
                <span style="font-size:0.75rem;color:rgba(255,255,255,0.6);">${text}</span>
            </div>
        `;
    },

    /* B3: Dragon Mini-Game — Tap to pet */
    _petCount: 0,
    _lastPetTime: 0,

    petDragon(dragonEl) {
        const now = Date.now();
        if (now - this._lastPetTime < 300) return;
        this._lastPetTime = now;
        this._petCount++;

        // Heart animation
        const heart = document.createElement('div');
        heart.textContent = ['❤️', '💕', '💖', '✨', '🌟'][Math.floor(Math.random() * 5)];
        heart.style.cssText = `position:absolute;font-size:1.5rem;pointer-events:none;
            left:${30 + Math.random() * 40}%;top:20%;
            animation:heartFloat 1s ease-out forwards;z-index:10;`;
        const parent = dragonEl.closest('.dragon-display') || dragonEl.parentElement;
        if (parent) { parent.style.position = 'relative'; parent.appendChild(heart); }
        setTimeout(() => heart.remove(), 1000);

        // Bounce the dragon
        if (dragonEl) {
            dragonEl.style.animation = 'none';
            requestAnimationFrame(() => {
                dragonEl.style.animation = 'dragonPet 0.4s ease-out';
            });
        }

        SoundFX.play('chime');

        // Milestone feedback
        if (this._petCount % 10 === 0) {
            Toast.success(`🐉 Rồng rất vui! Đã vuốt ${this._petCount} lần ❤️`);
        }
    }
};

/* ============================================================
   C1: Rank Progress Bar — Enhanced rank display
   ============================================================ */
const RankProgress = {
    ranks: [
        { name: 'Tân Binh Trí Tuệ', elo: 0, icon: '🥉', color: '#cd7f32' },
        { name: 'Kỳ Thủ Đồng', elo: 900, icon: '🥈', color: '#c0c0c0' },
        { name: 'Kỳ Thủ Bạc', elo: 1000, icon: '🥇', color: '#ffd700' },
        { name: 'Kỳ Thủ Vàng', elo: 1200, icon: '👑', color: '#ff6b00' },
        { name: 'Chiến Tướng', elo: 1400, icon: '⚔️', color: '#e74c3c' },
        { name: 'Đại Sư', elo: 1600, icon: '🏆', color: '#9b59b6' },
    ],

    render(elo) {
        const current = [...this.ranks].reverse().find(r => elo >= r.elo) || this.ranks[0];
        const nextIdx = this.ranks.indexOf(current) + 1;
        const next = this.ranks[nextIdx] || null;

        if (!next) return ''; // Max rank

        const range = next.elo - current.elo;
        const progress = elo - current.elo;
        const pct = Math.min(Math.round((progress / range) * 100), 100);

        return `
            <div class="rank-progress-bar" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
                 border-radius:12px;padding:8px 12px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:0.8rem;font-weight:700;color:${current.color};">
                        ${current.icon} ${current.name}
                    </span>
                    <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);">
                        → ${next.icon} ${next.name}
                    </span>
                </div>
                <div style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;position:relative;">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${current.color},${next.color});
                         border-radius:4px;transition:width 1s ease;"></div>
                </div>
                <div style="text-align:center;font-size:0.7rem;color:rgba(255,255,255,0.4);margin-top:2px;">
                    ${elo} / ${next.elo} ELO (${100 - pct}% còn lại)
                </div>
            </div>
        `;
    },

    showLevelUp(newRank) {
        Celebration.show({
            icon: newRank.icon || '🏆',
            title: '🎉 THĂNG HẠNG!',
            subtitle: `Chúc mừng! Bạn đạt hạng ${newRank.name || newRank}!`,
            duration: 4000
        });
        SoundFX.play('levelup');
    }
};

/* ============================================================
   C2: Achievement Badges Showcase
   ============================================================ */
const BadgeShowcase = {
    async show() {
        try {
            const data = await API.get('/achievements');
            this._data = data;
            this._renderModal(data, 'stars');
        } catch (err) {
            Toast.error(err.message || 'Lỗi tải thành tích');
        }
    },

    _renderModal(data, activeTab) {
        const tabs = [
            { key: 'stars', icon: '⭐', label: 'Sao', stat: `${(data.stats.total_stars || 0).toLocaleString()} ⭐` },
            { key: 'elo', icon: '📊', label: 'ELO', stat: `${data.stats.elo || 800} ELO` },
            { key: 'streak', icon: '🔥', label: 'Streak', stat: `${data.stats.best_streak || 0} ngày` },
        ];

        const tabHTML = tabs.map(t => `
            <div onclick="BadgeShowcase._switchTab('${t.key}')" 
                 style="flex:1;text-align:center;padding:10px 8px;border-radius:12px;cursor:pointer;transition:all 0.2s;
                        background:${t.key === activeTab ? 'linear-gradient(135deg,rgba(108,92,231,0.3),rgba(168,85,247,0.2))' : 'rgba(255,255,255,0.04)'};
                        border:2px solid ${t.key === activeTab ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.08)'};">
                <div style="font-size:1.3rem;">${t.icon}</div>
                <div style="font-size:0.75rem;font-weight:700;">${t.label}</div>
                <div style="font-size:0.65rem;color:rgba(255,255,255,0.5);">${t.stat}</div>
            </div>
        `).join('');

        const milestones = data.milestones[activeTab] || [];
        const listHTML = milestones.map(m => {
            const bg = m.claimed ? 'rgba(46,204,113,0.08)' : m.claimable ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)';
            const border = m.claimed ? 'rgba(46,204,113,0.25)' : m.claimable ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.06)';
            return `
                <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;
                            background:${bg};border:1px solid ${border};transition:all 0.2s;
                            ${m.claimable ? 'animation:pulse 2s ease-in-out infinite;cursor:pointer;' : ''}"
                     ${m.claimable ? `onclick="BadgeShowcase._claim('${m.key}')"` : ''}>
                    <div style="font-size:1.8rem;filter:${m.reached ? 'none' : 'grayscale(1) opacity(0.3)'};">
                        ${m.icon}
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;font-size:0.85rem;">${m.label}</div>
                        <div style="font-size:0.68rem;color:rgba(255,255,255,0.5);margin-top:1px;">${m.rewards_text}</div>
                        ${!m.reached ? `
                            <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;margin-top:4px;">
                                <div style="height:100%;width:${m.progress}%;background:linear-gradient(90deg,#6c5ce7,#a855f7);border-radius:2px;"></div>
                            </div>
                            <div style="font-size:0.6rem;color:rgba(255,255,255,0.3);margin-top:1px;">${m.progress}%</div>
                        ` : ''}
                    </div>
                    <div style="font-size:0.8rem;flex-shrink:0;">
                        ${m.claimed ? '<span style="color:#2ecc71;">✅</span>' :
                    m.claimable ? '<button class="btn btn-accent btn-sm" style="padding:4px 12px;font-size:0.7rem;animation:pulse 2s infinite;">🎁 Nhận</button>' :
                        `<span style="opacity:0.3;">🔒</span>`}
                    </div>
                </div>
            `;
        }).join('');

        // Count claimable
        const totalClaimable = Object.values(data.milestones).flat().filter(m => m.claimable).length;
        const claimBadge = totalClaimable > 0 ? `<span style="background:#e74c3c;color:#fff;font-size:0.6rem;padding:1px 6px;border-radius:8px;margin-left:4px;">${totalClaimable}</span>` : '';

        Modal.create({
            id: 'achievement-modal',
            title: `Thành Tích ${claimBadge}`,
            icon: '🏅',
            size: 'modal-lg',
            content: `
                <div style="display:flex;gap:6px;margin-bottom:12px;">${tabHTML}</div>
                <div style="display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto;padding-right:4px;" id="achievement-list">
                    ${listHTML}
                </div>
            `
        });
        Modal.show('achievement-modal');
    },

    _switchTab(tab) {
        if (!this._data) return;
        Modal.hide('achievement-modal');
        this._renderModal(this._data, tab);
    },

    async _claim(key) {
        try {
            const result = await API.post('/achievements/claim', { milestone_key: key });
            Toast.success(result.message);
            Celebration.show({ icon: '🎉', title: 'Nhận Thưởng!', subtitle: result.message, duration: 3500 });
            SoundFX.play('fanfare');
            if (typeof CoinAnimation !== 'undefined') CoinAnimation.fly(1000);
            // Refresh
            Modal.hide('achievement-modal');
            setTimeout(() => this.show(), 500);
            if (typeof HomePage !== 'undefined') HomePage.refreshStats();
        } catch (err) {
            Toast.error(err.message || 'Lỗi nhận thưởng');
        }
    }
};

/* ============================================================
   C3: Weekly Challenge Board
   ============================================================ */
const WeeklyChallenge = {
    render() {
        const stats = App.user?.stats || {};
        const weeklyPuzzles = stats.weekly_puzzles || 0;
        const target = 50;
        const pct = Math.min(Math.round((weeklyPuzzles / target) * 100), 100);
        const daysLeft = 7 - new Date().getDay();

        return `
            <div class="weekly-challenge" onclick="WeeklyChallenge.showDetail()" style="cursor:pointer;
                 background:linear-gradient(135deg,rgba(231,76,60,0.15),rgba(241,196,15,0.15));
                 border:1px solid rgba(231,76,60,0.3);border-radius:12px;padding:10px 14px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-weight:700;font-size:0.8rem;">🏆 Thách Đố Tuần</span>
                    <span style="font-size:0.7rem;color:rgba(255,255,255,0.5);">⏰ Còn ${daysLeft} ngày</span>
                </div>
                <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin-bottom:6px;">
                    Giải ${target} puzzle → 🥚 Trứng Rồng Hiếm
                </div>
                <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#e74c3c,#f1c40f);border-radius:3px;transition:width 1s;"></div>
                </div>
                <div style="font-size:0.65rem;color:rgba(255,255,255,0.4);margin-top:2px;text-align:right;">
                    ${weeklyPuzzles}/${target}
                </div>
            </div>
        `;
    },

    showDetail() {
        Toast.info('🏆 Giải 50 puzzle trong tuần để nhận Trứng Rồng Hiếm!');
    }
};

/* ============================================================
   D1: Animated Coin Reward — Xu bay vào header
   ============================================================ */
const CoinAnimation = {
    fly(amount, sourceEl) {
        const header = document.getElementById('header-coins');
        if (!header) return;

        const headerRect = header.getBoundingClientRect();
        const sourceRect = sourceEl ? sourceEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 };

        // Create flying coins
        const count = Math.min(Math.max(Math.ceil(amount / 100), 3), 12);
        for (let i = 0; i < count; i++) {
            const coin = document.createElement('div');
            coin.textContent = '🪙';
            coin.style.cssText = `position:fixed;z-index:9999;font-size:1.2rem;pointer-events:none;
                left:${sourceRect.left + Math.random() * 40 - 20}px;
                top:${sourceRect.top + Math.random() * 40 - 20}px;
                transition:all ${0.6 + Math.random() * 0.4}s cubic-bezier(0.4,0,0.2,1);
                opacity:1;`;
            document.body.appendChild(coin);

            // Animate to header
            requestAnimationFrame(() => {
                setTimeout(() => {
                    coin.style.left = headerRect.left + 'px';
                    coin.style.top = headerRect.top + 'px';
                    coin.style.opacity = '0';
                    coin.style.transform = 'scale(0.3)';
                }, i * 80);
            });

            setTimeout(() => {
                coin.remove();
                // Bump header number
                if (i === count - 1 && header) {
                    header.style.animation = 'none';
                    requestAnimationFrame(() => {
                        header.style.animation = 'coinBump 0.3s ease-out';
                    });
                }
            }, 1200 + i * 80);
        }

        SoundFX.play('coin');
    },

    starFly(amount, sourceEl) {
        const header = document.getElementById('header-stars');
        if (!header) return;

        const headerRect = header.getBoundingClientRect();
        const sourceRect = sourceEl ? sourceEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 };

        for (let i = 0; i < Math.min(amount, 8); i++) {
            const star = document.createElement('div');
            star.textContent = '⭐';
            star.style.cssText = `position:fixed;z-index:9999;font-size:1rem;pointer-events:none;
                left:${sourceRect.left}px;top:${sourceRect.top}px;
                transition:all ${0.5 + Math.random() * 0.3}s cubic-bezier(0.4,0,0.2,1);opacity:1;`;
            document.body.appendChild(star);

            requestAnimationFrame(() => {
                setTimeout(() => {
                    star.style.left = headerRect.left + 'px';
                    star.style.top = headerRect.top + 'px';
                    star.style.opacity = '0';
                    star.style.transform = 'scale(0.3)';
                }, i * 100);
            });

            setTimeout(() => star.remove(), 1200 + i * 100);
        }
    }
};

/* ============================================================
   D2: Shop Preview Effects
   ============================================================ */
// Injected via CSS — hover effects on shop cards (see CSS additions below)

/* ============================================================
   E1-E3: Touch Enhancements — Larger targets, gestures, haptics
   ============================================================ */
const TouchEnhance = {
    init() {
        // E1: Add ripple effect on touch
        document.addEventListener('click', (e) => {
            const building = e.target.closest('.building');
            if (!building) return;

            const ripple = document.createElement('div');
            ripple.className = 'touch-ripple';
            const rect = building.getBoundingClientRect();
            ripple.style.left = (e.clientX - rect.left) + 'px';
            ripple.style.top = (e.clientY - rect.top) + 'px';
            building.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });

        // E3: Haptic feedback
        if ('vibrate' in navigator) {
            document.addEventListener('click', (e) => {
                if (e.target.closest('.building') || e.target.closest('.btn') || e.target.closest('button')) {
                    navigator.vibrate(15);
                }
            });
        }
    },

    // E2: Swipe support for modals with tabs
    enableSwipe(container, onLeft, onRight) {
        let startX = 0;
        container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            const diff = e.changedTouches[0].clientX - startX;
            if (Math.abs(diff) > 60) {
                if (diff > 0 && onRight) onRight();
                if (diff < 0 && onLeft) onLeft();
            }
        }, { passive: true });
    }
};

/* ============================================================
   F1: Background Music — Ambient RPG music using Web Audio
   ============================================================ */
const BGMusic = {
    _ctx: null,
    _playing: false,
    _gainNode: null,
    _sources: [],
    _enabled: localStorage.getItem('ck_bgm') !== 'off',

    toggle() {
        this._enabled = !this._enabled;
        localStorage.setItem('ck_bgm', this._enabled ? 'on' : 'off');
        if (this._enabled) this.start();
        else this.stop();
        return this._enabled;
    },

    start() {
        if (!this._enabled || this._playing) return;
        try {
            this._ctx = this._ctx || new (window.AudioContext || window.webkitAudioContext)();
            this._gainNode = this._ctx.createGain();
            this._gainNode.gain.setValueAtTime(0.06, this._ctx.currentTime);
            this._gainNode.connect(this._ctx.destination);

            this._playing = true;
            this._playMelody();
        } catch (e) { /* Audio not supported */ }
    },

    stop() {
        this._playing = false;
        this._sources.forEach(s => { try { s.stop(); } catch (e) { } });
        this._sources = [];
    },

    setVolume(vol) {
        if (this._gainNode) this._gainNode.gain.setValueAtTime(vol, this._ctx.currentTime);
    },

    _playMelody() {
        if (!this._playing || !this._ctx) return;

        // Gentle pentatonic melody — looping ambient
        const notes = [261, 293, 329, 392, 440, 392, 329, 293, 261, 220, 261, 329, 392, 440, 523, 440, 392, 329];
        const tempo = 0.8; // seconds per note
        let time = this._ctx.currentTime;

        notes.forEach((freq, i) => {
            const osc = this._ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time + i * tempo);

            const noteGain = this._ctx.createGain();
            noteGain.gain.setValueAtTime(0, time + i * tempo);
            noteGain.gain.linearRampToValueAtTime(0.15, time + i * tempo + 0.1);
            noteGain.gain.linearRampToValueAtTime(0, time + i * tempo + tempo * 0.9);

            osc.connect(noteGain).connect(this._gainNode);
            osc.start(time + i * tempo);
            osc.stop(time + (i + 1) * tempo);
            this._sources.push(osc);
        });

        // Loop
        const totalDuration = notes.length * tempo * 1000;
        setTimeout(() => {
            if (this._playing) this._playMelody();
        }, totalDuration);
    }
};

/* ============================================================
   F2: Sound Effects — Enhanced SFX library
   ============================================================ */
const SoundFX = {
    _ctx: null,
    _enabled: localStorage.getItem('ck_sfx') !== 'off',

    _getCtx() {
        if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        return this._ctx;
    },

    play(type) {
        if (!this._enabled) return;
        try {
            const ctx = this._getCtx();
            const now = ctx.currentTime;
            const gain = ctx.createGain();
            gain.connect(ctx.destination);

            switch (type) {
                case 'fanfare': {
                    // Triumphant fanfare — ascending major chord
                    [523, 659, 784, 1047].forEach((freq, i) => {
                        const o = ctx.createOscillator();
                        o.type = 'triangle';
                        o.frequency.setValueAtTime(freq, now + i * 0.15);
                        const g = ctx.createGain();
                        g.gain.setValueAtTime(0.12, now + i * 0.15);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2 + i * 0.15);
                        o.connect(g).connect(ctx.destination);
                        o.start(now + i * 0.15);
                        o.stop(now + 1.5 + i * 0.15);
                    });
                    break;
                }
                case 'levelup': {
                    // Level up — ascending arpeggio with shimmer
                    [440, 554, 659, 880, 1047, 1319].forEach((freq, i) => {
                        const o = ctx.createOscillator();
                        o.type = 'sine';
                        o.frequency.setValueAtTime(freq, now + i * 0.1);
                        const g = ctx.createGain();
                        g.gain.setValueAtTime(0.1, now + i * 0.1);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 0.8 + i * 0.1);
                        o.connect(g).connect(ctx.destination);
                        o.start(now + i * 0.1);
                        o.stop(now + 1.0 + i * 0.1);
                    });
                    break;
                }
                case 'error': {
                    // Error buzz — low frequency double beep
                    [200, 150].forEach((freq, i) => {
                        const o = ctx.createOscillator();
                        o.type = 'square';
                        o.frequency.setValueAtTime(freq, now + i * 0.15);
                        const g = ctx.createGain();
                        g.gain.setValueAtTime(0.05, now + i * 0.15);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15 + i * 0.15);
                        o.connect(g).connect(ctx.destination);
                        o.start(now + i * 0.15);
                        o.stop(now + 0.3 + i * 0.15);
                    });
                    break;
                }
                case 'complete': {
                    // Puzzle complete jingle — cheerful
                    [523, 659, 784, 1047, 784, 1047].forEach((freq, i) => {
                        const o = ctx.createOscillator();
                        o.type = 'sine';
                        o.frequency.setValueAtTime(freq, now + i * 0.08);
                        const g = ctx.createGain();
                        g.gain.setValueAtTime(0.08, now + i * 0.08);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + i * 0.08);
                        o.connect(g).connect(ctx.destination);
                        o.start(now + i * 0.08);
                        o.stop(now + 0.6 + i * 0.08);
                    });
                    break;
                }
                case 'coin': {
                    // Coin collect — bright ascending
                    [1047, 1319, 1568].forEach((freq, i) => {
                        const o = ctx.createOscillator();
                        o.type = 'square';
                        o.frequency.setValueAtTime(freq, now + i * 0.05);
                        const g = ctx.createGain();
                        g.gain.setValueAtTime(0.04, now + i * 0.05);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2 + i * 0.05);
                        o.connect(g).connect(ctx.destination);
                        o.start(now + i * 0.05);
                        o.stop(now + 0.3 + i * 0.05);
                    });
                    break;
                }
                case 'chime': {
                    const o = ctx.createOscillator();
                    o.type = 'sine';
                    o.frequency.setValueAtTime(880, now);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                    o.connect(gain);
                    o.start(now);
                    o.stop(now + 0.5);
                    break;
                }
            }
        } catch (e) { /* Audio not available */ }
    }
};
