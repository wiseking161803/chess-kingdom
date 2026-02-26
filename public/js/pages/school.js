/**
 * School Page — Trường Học (Full Page)
 * Shows daily/weekly quests with countdown
 */
const SchoolPage = {
    render() {
        return `
        <div class="app-header">
            <div class="header-inner">
                <div class="header-logo">
                    <button class="header-btn" onclick="App.navigate('home')">← Về Bản Đồ</button>
                </div>
                <div class="header-logo"><span class="logo-icon">🏫</span> Trường Học</div>
                <div class="header-actions">
                    <span class="header-stat" id="school-countdown">⏰ --</span>
                </div>
            </div>
        </div>
        <div class="school-container" id="school-page">
            <div class="text-center text-muted" style="padding:40px;">Đang tải...</div>
        </div>
        `;
    },

    async init() {
        await this.loadData();
    },

    async loadData() {
        try {
            const [daily, weekly] = await Promise.all([
                API.get('/quests/daily'),
                API.get('/quests/weekly')
            ]);

            // Countdown
            const formatCountdown = (seconds) => {
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                return `${h}h ${m}m`;
            };
            const countdownEl = document.getElementById('school-countdown');
            if (countdownEl) countdownEl.textContent = `⏰ ${formatCountdown(daily.countdown_seconds)}`;

            const page = document.getElementById('school-page');
            if (!page) return;

            const dailyCompleted = daily.quests.filter(q => q.completed).length;
            const dailyTotal = daily.quests.length;
            const weeklyCompleted = weekly.quests.filter(q => q.completed).length;
            const weeklyTotal = weekly.quests.length;

            page.innerHTML = `
                <div class="school-tabs">
                    <button class="school-tab active" onclick="SchoolPage.switchTab('daily', this)">
                        📝 Hàng Ngày
                        <span class="school-tab-badge">${dailyCompleted}/${dailyTotal}</span>
                    </button>
                    <button class="school-tab" onclick="SchoolPage.switchTab('weekly', this)">
                        📅 Hàng Tuần
                        <span class="school-tab-badge">${weeklyCompleted}/${weeklyTotal}</span>
                    </button>
                </div>

                <div id="school-daily-tab">
                    ${this._renderQuests(daily.quests, '#FFF3E0')}
                </div>
                <div id="school-weekly-tab" class="hidden">
                    ${this._renderQuests(weekly.quests, '#E3F2FD')}
                </div>
            `;
        } catch (err) {
            const page = document.getElementById('school-page');
            if (page) page.innerHTML = `<div class="text-center text-muted" style="padding:40px;">Lỗi: ${err.message}</div>`;
        }
    },

    _renderQuests(quests, bgColor) {
        if (quests.length === 0) {
            return '<div class="empty-state"><div class="empty-state-icon">😴</div><div class="empty-state-text">Không có nhiệm vụ nào</div></div>';
        }

        return `<div class="school-quests-list">${quests.map(q => {
            const hasPuzzle = q.puzzle_set_id && q.puzzle_set_id > 0;
            return `
            <div class="school-quest-card ${q.completed ? 'completed' : ''}">
                <div class="school-quest-icon" style="background:${q.completed ? 'var(--success-light)' : bgColor}">
                    ${q.completed ? '✅' : (hasPuzzle ? '♟️' : '📝')}
                </div>
                <div class="school-quest-info">
                    <div class="school-quest-title">${q.title}</div>
                    <div class="school-quest-reward">
                        +${q.stars_reward} ⭐
                        ${q.coins_reward > 0 ? `+${q.coins_reward} 🪙` : ''}
                    </div>
                    ${hasPuzzle ? `<div class="text-xs text-muted">Chế độ: ${SchoolPage._modeLabel(q.play_mode)}</div>` : ''}
                </div>
                ${!q.completed ? `
                    <div class="school-quest-action">
                        ${hasPuzzle ? `
                            <button class="btn btn-primary btn-sm" onclick="SchoolPage.startPuzzleQuest(${q.id}, ${q.puzzle_set_id}, '${q.play_mode || 'basic'}')">
                                🧩 Giải Bài
                            </button>
                        ` : `
                            ${q.url ? `<a href="${q.url}" target="_blank" class="btn btn-primary btn-sm">🔗 Mở</a>` : ''}
                            <button class="btn btn-success btn-sm" onclick="SchoolPage.completeQuest(${q.id})">✅ Xong</button>
                        `}
                    </div>
                ` : '<span class="mtn-task-done-badge">Đã xong</span>'}
            </div>
            `;
        }).join('')}</div>`;
    },

    _modeLabel(mode) {
        const labels = { basic: '📋 Cơ Bản', focus: '🎯 Tập Trung', memory: '🧠 Trí Nhớ', opening: '📖 Khai Cuộc' };
        return labels[mode] || '📋 Cơ Bản';
    },

    switchTab(tab, btn) {
        document.querySelectorAll('.school-tab').forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');
        document.getElementById('school-daily-tab').classList.toggle('hidden', tab !== 'daily');
        document.getElementById('school-weekly-tab').classList.toggle('hidden', tab !== 'weekly');
    },

    async startPuzzleQuest(questId, puzzleSetId, mode) {
        try {
            const data = await API.get(`/puzzles/sets/${puzzleSetId}`);

            Modal.create({
                id: 'school-puzzle-modal',
                title: 'Nhiệm Vụ Bài Tập',
                icon: '🧩',
                size: 'modal-lg',
                content: '<div id="school-cbc-container"></div>'
            });
            Modal.show('school-puzzle-modal');

            ChessBoardComponent.mount({
                pgnSource: data,
                mode: mode || 'basic',
                isEloRated: true,
                config: {
                    playerGoesFirst: data.puzzle_set.play_mode !== 'second',
                    memoryTimeSec: 8,
                    maxMistakes: 3
                },
                onComplete: async (result) => {
                    Modal.hide('school-puzzle-modal');
                    if (result.solved) {
                        await this.completeQuest(questId);
                    } else {
                        Toast.info('Hãy thử lại lần sau nhé! 💪');
                    }
                },
                containerEl: 'school-cbc-container'
            });
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async completeQuest(questId) {
        try {
            const result = await API.post(`/quests/${questId}/complete`);
            this._showRewardPopup(result);
            setTimeout(async () => {
                await this.loadData();
                if (typeof HomePage !== 'undefined') HomePage.refreshStats?.();
            }, 2500);
        } catch (err) {
            Toast.error(err.message);
        }
    },

    _showRewardPopup(result) {
        const existing = document.querySelector('.reward-popup');
        if (existing) existing.remove();

        const stars = result.stars_earned || 0;
        const coins = result.coins_earned || 0;

        const popup = document.createElement('div');
        popup.className = 'reward-popup';
        popup.innerHTML = `
            <div class="reward-popup-icon">🎉</div>
            <div class="reward-popup-title">${result.message || 'Hoàn thành!'}</div>
            <div class="reward-popup-items">
                ${stars > 0 ? `<div class="reward-popup-item"><div class="reward-popup-value">+${stars}</div><div class="reward-popup-label">⭐ Sao</div></div>` : ''}
                ${coins > 0 ? `<div class="reward-popup-item"><div class="reward-popup-value">+${coins}</div><div class="reward-popup-label">🪙 Xu</div></div>` : ''}
                ${stars === 0 && coins === 0 ? '<div class="reward-popup-item"><div class="reward-popup-value">✅</div><div class="reward-popup-label">Đã ghi nhận</div></div>' : ''}
            </div>
        `;
        document.body.appendChild(popup);

        setTimeout(() => {
            popup.classList.add('hiding');
            setTimeout(() => popup.remove(), 300);
        }, 2200);
    }
};
