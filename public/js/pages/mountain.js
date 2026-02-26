/**
 * Mountain Page — Núi Danh Vọng (Full Page)
 * Shows milestone timeline + 4 task group cards for current milestone
 */
const MountainPage = {
    _milestones: [],
    _currentMilestone: null,
    _userStars: 0,
    _hasMembership: false,
    _groupLabels: {
        tactics: { icon: '⚔️', label: 'Chiến thuật', color: '#e74c3c', bg: 'linear-gradient(135deg, #fee2e2, #fecaca)' },
        middlegame: { icon: '♟️', label: 'Trung cuộc', color: '#3b82f6', bg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)' },
        endgame: { icon: '🏁', label: 'Tàn cuộc', color: '#10b981', bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' },
        competition: { icon: '🏆', label: 'Thi đấu', color: '#f59e0b', bg: 'linear-gradient(135deg, #fef3c7, #fde68a)' }
    },

    render() {
        return `
        <div class="app-header">
            <div class="header-inner">
                <div class="header-logo">
                    <button class="header-btn" onclick="App.navigate('home')">← Về Bản Đồ</button>
                </div>
                <div class="header-logo"><span class="logo-icon">⛰️</span> Núi Danh Vọng</div>
                <div class="header-actions">
                    <span class="header-stat" id="mtn-stars">⭐ --</span>
                </div>
            </div>
        </div>
        <div class="mountain-container" id="mountain-page">
            <div class="text-center text-muted" style="padding:40px;">Đang tải...</div>
        </div>
        `;
    },

    async init() {
        await this.loadData();
    },

    async loadData() {
        try {
            const data = await API.get('/gamification/milestones');
            this._milestones = data.milestones;
            this._userStars = data.user_stars || 0;

            // Check membership
            try {
                const mem = await API.get('/payment/check-membership');
                this._hasMembership = mem.is_premium;
            } catch (e) { this._hasMembership = false; }

            // Update header stars
            const starsEl = document.getElementById('mtn-stars');
            if (starsEl) starsEl.textContent = `⭐ ${data.user_stars}`;

            // Mark milestones as locked/unlocked based on stars
            this._milestones.forEach((m, i) => {
                const needsMembership = i >= 4; // milestone 5+ needs membership
                m._locked = (this._userStars < m.stars_required) || (needsMembership && !this._hasMembership);
                m._needsMembership = needsMembership && !this._hasMembership;
            });

            // Find current milestone (first non-completed AND unlocked) or first unlocked
            this._currentMilestone = data.milestones.find(m => m.status !== 'completed' && !m._locked) || data.milestones.find(m => !m._locked) || null;

            this.renderPage();
        } catch (err) {
            const page = document.getElementById('mountain-page');
            if (page) page.innerHTML = `<div class="text-center text-muted" style="padding:40px;">Lỗi: ${err.message}</div>`;
        }
    },

    renderPage() {
        const page = document.getElementById('mountain-page');
        if (!page) return;

        page.innerHTML = `
            ${this._renderTimeline()}
            <div id="mtn-milestone-detail">
                ${this._currentMilestone ? '<div class="text-center text-muted" style="padding:40px;">Đang tải nhiệm vụ...</div>' : '<div class="empty-state"><div class="empty-state-icon">🏔️</div><div class="empty-state-text">Chưa có mốc nào. Hãy liên hệ thầy/cô!</div></div>'}
            </div>
        `;

        if (this._currentMilestone) {
            this.loadMilestoneTasks(this._currentMilestone.id);
        }
    },

    _renderTimeline() {
        if (!this._milestones.length) return '';

        return `
        <div class="mtn-timeline-wrap">
            <div class="mtn-timeline">
                ${this._milestones.map((m, i) => {
            const isCurrent = this._currentMilestone && m.id === this._currentMilestone.id;
            const isLocked = m._locked;
            return `
                    <div class="mtn-timeline-step ${m.status} ${isCurrent ? 'current' : ''} ${isLocked ? 'locked' : ''}" 
                         onclick="MountainPage.selectMilestone(${m.id})"
                         style="${isLocked ? 'opacity:0.5;filter:grayscale(0.6);cursor:not-allowed;' : ''}">
                        <div class="mtn-step-icon">${isLocked ? '🔒' : m.icon}</div>
                        <div class="mtn-step-label">${m.title}</div>
                        <div class="mtn-step-stars">⭐ ${m.stars_required}</div>
                        ${m.status === 'completed' ? '<div class="mtn-step-check">✅</div>' : ''}
                        ${isLocked && m._needsMembership ? '<div style="font-size:0.6rem;color:#ffd200;">👑 Membership</div>' : ''}
                        ${isLocked && !m._needsMembership ? '<div style="font-size:0.6rem;color:#ff6b6b;">Chưa đủ sao</div>' : ''}
                        ${isCurrent && !isLocked ? `<div class="mtn-step-progress">${Math.round(m.progress)}%</div>` : ''}
                    </div>
                    ${i < this._milestones.length - 1 ? `<div class="mtn-timeline-line ${m.status === 'completed' ? 'completed' : ''}"></div>` : ''}
                    `;
        }).join('')}
            </div>
        </div>
        `;
    },

    async selectMilestone(milestoneId) {
        const m = this._milestones.find(m => m.id === milestoneId);
        if (!m) return;
        if (m._locked) {
            if (m._needsMembership) {
                Toast.warning('👑 Mốc này yêu cầu Membership! Mua tại Chợ Phiên → 💎 Nạp Tiền');
            } else {
                Toast.warning(`🔒 Cần ${m.stars_required}⭐ để mở mốc này! Bạn có ${this._userStars}⭐`);
            }
            return;
        }
        this._currentMilestone = m;
        this.renderPage();
    },

    async loadMilestoneTasks(milestoneId) {
        const detail = document.getElementById('mtn-milestone-detail');
        if (!detail) return;

        try {
            const data = await API.get(`/gamification/milestones/${milestoneId}/tasks`);
            const groups = data.groups || { tactics: [], middlegame: [], endgame: [], competition: [] };
            const stats = data.groupStats || {};
            const m = this._currentMilestone;

            // Overall stats
            const totalTasks = data.tasks?.length || 0;
            const completedTasks = data.tasks?.filter(t => t.completed).length || 0;
            const overallPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            detail.innerHTML = `
                <div class="mtn-detail-header">
                    <div class="mtn-detail-icon">${m.icon}</div>
                    <div class="mtn-detail-info">
                        <h2 class="mtn-detail-title">${m.title}</h2>
                        ${m.description ? `<div class="mtn-detail-desc">${m.description}</div>` : ''}
                    </div>
                </div>

                <div class="mtn-overall-progress">
                    <div class="mtn-overall-text">
                        <span>📊 Tiến độ chung</span>
                        <span><strong>${completedTasks}/${totalTasks}</strong> nhiệm vụ • <strong>${overallPct}%</strong></span>
                    </div>
                    <div class="mtn-overall-bar">
                        <div class="mtn-overall-fill" style="width:${overallPct}%"></div>
                    </div>
                </div>

                <div class="mtn-groups-grid">
                    ${Object.entries(this._groupLabels).map(([key, info]) => {
                const list = groups[key] || [];
                const gs = stats[key] || { total: 0, completed: 0 };
                const pct = gs.total > 0 ? Math.round((gs.completed / gs.total) * 100) : 0;

                return `
                        <div class="mtn-group-card" style="--group-color:${info.color};">
                            <div class="mtn-group-header">
                                <div class="mtn-group-icon">${info.icon}</div>
                                <div class="mtn-group-info">
                                    <div class="mtn-group-name">${info.label}</div>
                                    <div class="mtn-group-stat">${gs.completed}/${gs.total} hoàn thành</div>
                                </div>
                                <div class="mtn-group-pct" style="color:${info.color}">${pct}%</div>
                            </div>
                            <div class="mtn-group-bar">
                                <div class="mtn-group-bar-fill" style="width:${pct}%;background:${info.color}"></div>
                            </div>
                            <div class="mtn-group-tasks">
                                ${list.length > 0 ? list.map(t => `
                                    <div class="mtn-task-item ${t.completed ? 'completed' : ''}">
                                        <div class="mtn-task-check">${t.completed ? '✅' : '⬜'}</div>
                                        <div class="mtn-task-content">
                                            <div class="mtn-task-title">${t.title}</div>
                                            ${t.description ? `<div class="mtn-task-desc">${t.description}</div>` : ''}
                                            <div class="mtn-task-reward">+${t.stars_reward} ⭐</div>
                                        </div>
                                        <div class="mtn-task-action">
                                            ${t.completed ? '<span class="mtn-task-done-badge">Đã xong</span>' : this._renderTaskAction(t, milestoneId)}
                                        </div>
                                    </div>
                                `).join('') : '<div class="mtn-empty-tasks">Chưa có nhiệm vụ</div>'}
                            </div>
                        </div>
                        `;
            }).join('')}
                </div>
            `;
        } catch (err) {
            detail.innerHTML = `<div class="text-center text-muted" style="padding:40px;">Lỗi: ${err.message}</div>`;
        }
    },

    _renderTaskAction(task, milestoneId) {
        const hasPuzzle = task.puzzle_set_id && task.puzzle_set_id > 0;
        if (hasPuzzle) {
            return `<button class="btn btn-primary btn-sm" onclick="MountainPage.startPuzzleTask(${task.id}, ${task.puzzle_set_id}, '${task.play_mode || 'basic'}')">🧩 Giải Bài</button>`;
        }
        if (task.url) {
            return `<a href="${task.url}" target="_blank" class="btn btn-primary btn-sm">🔗 Mở</a>`;
        }
        return `<button class="btn btn-success btn-sm" onclick="MountainPage.completeTask(${task.id})">✅ Xong</button>`;
    },

    async startPuzzleTask(taskId, puzzleSetId, mode) {
        try {
            const data = await API.get(`/puzzles/sets/${puzzleSetId}`);

            Modal.create({
                id: 'mountain-puzzle-modal',
                title: 'Nhiệm Vụ Leo Núi',
                icon: '⛰️',
                size: 'modal-lg',
                content: '<div id="mountain-cbc-container"></div>'
            });
            Modal.show('mountain-puzzle-modal');

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
                    Modal.hide('mountain-puzzle-modal');
                    if (result.solved) {
                        await this.completeTask(taskId);
                    } else {
                        Toast.info('Hãy thử lại nhé! 💪');
                    }
                },
                containerEl: 'mountain-cbc-container'
            });
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async completeTask(taskId) {
        try {
            const result = await API.post(`/gamification/milestones/${taskId}/complete`);
            this._showRewardPopup(result);
            // Reload data after popup
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
