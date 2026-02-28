/**
 * Tower Page — Tháp Kỳ Vương (Full Page — Tower Climbing System)
 * Each floor = a milestone/rank. Complete tasks + earn stars to climb higher.
 * Uses the same /gamification/milestones API as the old Mountain page.
 */
const TowerPage = {
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
                <div class="header-logo"><span class="logo-icon">🏰</span> Tháp Kỳ Vương</div>
                <div class="header-actions">
                    <span class="header-stat" id="tower-stars">⭐ --</span>
                </div>
            </div>
        </div>
        <div class="tower-climb-container" id="tower-page">
            <div class="text-center text-muted" style="padding:40px;">Đang tải tháp...</div>
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
            const starsEl = document.getElementById('tower-stars');
            if (starsEl) starsEl.textContent = `⭐ ${data.user_stars}`;

            // Mark milestones as locked/unlocked
            this._milestones.forEach((m, i) => {
                const needsMembership = i >= 4;
                m._locked = (this._userStars < m.stars_required) || (needsMembership && !this._hasMembership);
                m._needsMembership = needsMembership && !this._hasMembership;
            });

            // Find current milestone
            this._currentMilestone = data.milestones.find(m => m.status !== 'completed' && !m._locked)
                || data.milestones.find(m => !m._locked) || null;

            this.renderPage();
        } catch (err) {
            const page = document.getElementById('tower-page');
            if (page) page.innerHTML = `<div class="text-center text-muted" style="padding:40px;">Lỗi: ${err.message}</div>`;
        }
    },

    renderPage() {
        const page = document.getElementById('tower-page');
        if (!page) return;

        // Reverse milestones so highest floor is at top
        const reversedMilestones = [...this._milestones].reverse();

        page.innerHTML = `
            <div class="tower-climb-layout">
                <div class="tower-visual">
                    <div class="tower-peak">
                        <div class="tower-peak-icon">👑</div>
                        <div class="tower-peak-label">Đỉnh Tháp</div>
                    </div>
                    <div class="tower-floors">
                        ${reversedMilestones.map((m, idx) => {
            const floorNum = this._milestones.length - idx;
            const isCurrent = this._currentMilestone && m.id === this._currentMilestone.id;
            const isCompleted = m.status === 'completed';
            const isLocked = m._locked;

            let stateClass = '';
            if (isCompleted) stateClass = 'completed';
            else if (isCurrent) stateClass = 'current';
            else if (isLocked) stateClass = 'locked';

            return `
                            <div class="tower-floor-wrapper">
                                <div class="tower-connector ${isCompleted ? 'completed' : ''}"></div>
                                <div class="tower-floor ${stateClass}" 
                                     onclick="TowerPage.selectFloor(${m.id})"
                                     data-floor-id="${m.id}">
                                    <div class="tower-floor-number">T${floorNum}</div>
                                    <div class="tower-floor-icon">${isLocked ? '🔒' : m.icon}</div>
                                    <div class="tower-floor-info">
                                        <div class="tower-floor-name">${m.title}</div>
                                        <div class="tower-floor-stars">⭐ ${m.stars_required} sao</div>
                                        ${isCurrent && !isLocked ? `<div class="tower-floor-progress-text">${Math.round(m.progress)}% hoàn thành</div>` : ''}
                                    </div>
                                    <div class="tower-floor-status">
                                        ${isCompleted ? '<span class="tower-floor-badge tower-floor-badge--done">✅ Đã vượt</span>' : ''}
                                        ${isCurrent && !isLocked ? '<span class="tower-floor-badge tower-floor-badge--current">🏗️ Đang leo</span>' : ''}
                                        ${isLocked && m._needsMembership ? '<span class="tower-floor-badge tower-floor-badge--locked">👑 Membership</span>' : ''}
                                        ${isLocked && !m._needsMembership ? '<span class="tower-floor-badge tower-floor-badge--locked">🔒 Chưa đủ sao</span>' : ''}
                                    </div>
                                    ${isCurrent && !isLocked ? `
                                    <div class="tower-floor-progressbar">
                                        <div class="tower-floor-progressbar-fill" style="width:${Math.round(m.progress)}%"></div>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                            `;
        }).join('')}
                    </div>
                    <div class="tower-base">
                        <div class="tower-base-icon">🏠</div>
                        <div class="tower-base-label">Nền móng</div>
                    </div>
                </div>

                <div class="tower-detail-panel" id="tower-detail">
                    ${this._currentMilestone
                ? '<div class="text-center text-muted" style="padding:40px;">Đang tải nhiệm vụ...</div>'
                : '<div class="tower-detail-empty"><div class="tower-detail-empty-icon">🏰</div><div>Chọn một tầng để xem chi tiết nhiệm vụ</div></div>'}
                </div>
            </div>
        `;

        if (this._currentMilestone) {
            this.loadFloorTasks(this._currentMilestone.id);
        }
    },

    async selectFloor(milestoneId) {
        const m = this._milestones.find(m => m.id === milestoneId);
        if (!m) return;
        if (m._locked) {
            if (m._needsMembership) {
                Toast.warning('👑 Tầng này yêu cầu Membership! Mua tại Chợ Phiên → 💎 Nạp Tiền');
            } else {
                Toast.warning(`🔒 Cần ${m.stars_required}⭐ để mở tầng này! Bạn có ${this._userStars}⭐`);
            }
            return;
        }
        this._currentMilestone = m;

        // Update floor active state visually
        document.querySelectorAll('.tower-floor').forEach(f => {
            f.classList.remove('current');
            if (f.classList.contains('completed')) return;
            f.classList.add('locked');
        });
        const activeFloor = document.querySelector(`[data-floor-id="${milestoneId}"]`);
        if (activeFloor && !activeFloor.classList.contains('completed')) {
            activeFloor.classList.remove('locked');
            activeFloor.classList.add('current');
        }

        this.loadFloorTasks(milestoneId);
    },

    async loadFloorTasks(milestoneId) {
        const detail = document.getElementById('tower-detail');
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
                <div class="tower-detail-header">
                    <div class="tower-detail-icon">${m.icon}</div>
                    <div class="tower-detail-info">
                        <h2 class="tower-detail-title">${m.title}</h2>
                        ${m.description ? `<div class="tower-detail-desc">${m.description}</div>` : ''}
                    </div>
                </div>

                <div class="tower-detail-progress">
                    <div class="tower-detail-progress-text">
                        <span>📊 Tiến độ tầng này</span>
                        <span><strong>${completedTasks}/${totalTasks}</strong> nhiệm vụ • <strong>${overallPct}%</strong></span>
                    </div>
                    <div class="tower-detail-progress-bar">
                        <div class="tower-detail-progress-fill" style="width:${overallPct}%"></div>
                    </div>
                </div>

                <div class="tower-detail-groups">
                    ${Object.entries(this._groupLabels).map(([key, info]) => {
                const list = groups[key] || [];
                const gs = stats[key] || { total: 0, completed: 0 };
                const pct = gs.total > 0 ? Math.round((gs.completed / gs.total) * 100) : 0;

                return `
                        <div class="tower-group-card" style="--group-color:${info.color};">
                            <div class="tower-group-header">
                                <div class="tower-group-icon">${info.icon}</div>
                                <div class="tower-group-info">
                                    <div class="tower-group-name">${info.label}</div>
                                    <div class="tower-group-stat">${gs.completed}/${gs.total} hoàn thành</div>
                                </div>
                                <div class="tower-group-pct" style="color:${info.color}">${pct}%</div>
                            </div>
                            <div class="tower-group-bar">
                                <div class="tower-group-bar-fill" style="width:${pct}%;background:${info.color}"></div>
                            </div>
                            <div class="tower-group-tasks">
                                ${list.length > 0 ? list.map(t => `
                                    <div class="tower-task-item ${t.completed ? 'completed' : ''}">
                                        <div class="tower-task-check">${t.completed ? '✅' : '⬜'}</div>
                                        <div class="tower-task-content">
                                            <div class="tower-task-title">${t.title}</div>
                                            ${t.description ? `<div class="tower-task-desc">${t.description}</div>` : ''}
                                            <div class="tower-task-reward">+${t.stars_reward} ⭐</div>
                                        </div>
                                        <div class="tower-task-action">
                                            ${t.completed ? '<span class="tower-task-done-badge">Đã xong</span>' : this._renderTaskAction(t, milestoneId)}
                                        </div>
                                    </div>
                                `).join('') : '<div class="tower-empty-tasks">Chưa có nhiệm vụ</div>'}
                            </div>
                        </div>
                        `;
            }).join('')}
                </div>
            `;

            // Scroll detail into view on mobile
            if (window.innerWidth < 768) {
                detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (err) {
            detail.innerHTML = `<div class="text-center text-muted" style="padding:40px;">Lỗi: ${err.message}</div>`;
        }
    },

    _renderTaskAction(task, milestoneId) {
        const hasPuzzle = task.puzzle_set_id && task.puzzle_set_id > 0;
        if (hasPuzzle) {
            return `<button class="btn btn-primary btn-sm" onclick="TowerPage.startPuzzleTask(${task.id}, ${task.puzzle_set_id})">🧩 Giải Bài</button>`;
        }
        if (task.url) {
            return `<a href="${task.url}" target="_blank" class="btn btn-primary btn-sm">🔗 Mở</a>`;
        }
        return `<button class="btn btn-success btn-sm" onclick="TowerPage.completeTask(${task.id})">✅ Xong</button>`;
    },

    async startPuzzleTask(taskId, puzzleSetId) {
        try {
            const data = await API.get(`/puzzles/sets/${puzzleSetId}`);
            const solveMode = data.puzzle_set?.solve_mode || 'basic';

            Modal.create({
                id: 'tower-puzzle-modal',
                title: 'Nhiệm Vụ Leo Tháp',
                icon: '🏰',
                size: 'modal-lg',
                content: '<div id="tower-cbc-container"></div>'
            });
            Modal.show('tower-puzzle-modal');

            ChessBoardComponent.mount({
                pgnSource: data,
                mode: solveMode,
                isEloRated: true,
                config: {
                    playerGoesFirst: data.puzzle_set.play_mode !== 'second',
                    memoryTimeSec: 8,
                    maxMistakes: 3
                },
                onComplete: async (result) => {
                    Modal.hide('tower-puzzle-modal');
                    if (result.solved) {
                        await this.completeTask(taskId);
                    } else {
                        Toast.info('Hãy thử lại nhé! 💪');
                    }
                },
                containerEl: 'tower-cbc-container'
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
