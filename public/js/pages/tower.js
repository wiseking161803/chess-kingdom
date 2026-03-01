/**
 * Tower Page — Tháp Kỳ Vương (Full Page — 18-Floor Tower Climbing System)
 * Each floor = a milestone/rank. Complete tasks + earn stars to climb higher.
 * Floor 1 open by default. Floor 2-4: need stars. Floor 5+: need stars + membership.
 * Uses the /gamification/milestones API.
 */
const TowerPage = {
    _milestones: [],
    _currentMilestone: null,
    _userStars: 0,
    _userRankLevel: 0,
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
            this._userRankLevel = data.user_rank_level || 0;

            // Check membership
            try {
                const mem = await API.get('/payment/check-membership');
                this._hasMembership = mem.is_premium;
            } catch (e) { this._hasMembership = false; }

            // Update header stars
            const starsEl = document.getElementById('tower-stars');
            if (starsEl) starsEl.textContent = `⭐ ${data.user_stars}`;

            // Mark milestones lock state
            this._milestones.forEach((m, i) => {
                const needsMembership = m.sort_order >= 4;
                const hasEnoughStars = this._userStars >= m.stars_required;
                const isUnlocked = m.sort_order <= this._userRankLevel;

                m._isUnlocked = isUnlocked;
                m._canPromote = !isUnlocked && hasEnoughStars && !(needsMembership && !this._hasMembership);
                m._locked = !isUnlocked && !m._canPromote;
                m._needsMembership = needsMembership && !this._hasMembership;
                m._needsMoreStars = !hasEnoughStars;
            });

            // Find current milestone (the floor user is working on)
            this._currentMilestone = this._milestones.find(m => m._isUnlocked && m.status !== 'completed')
                || this._milestones.find(m => m._isUnlocked) || null;

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
            const isUnlocked = m._isUnlocked;
            const canPromote = m._canPromote;
            const isLocked = m._locked;

            let stateClass = '';
            if (isCompleted) stateClass = 'completed';
            else if (isCurrent) stateClass = 'current';
            else if (canPromote) stateClass = 'promotable';
            else if (isLocked) stateClass = 'locked';

            // Format stars
            const starsStr = m.stars_required >= 1000
                ? (m.stars_required / 1000).toFixed(m.stars_required % 1000 === 0 ? 0 : 1) + 'K'
                : m.stars_required;

            return `
                            <div class="tower-floor-wrapper">
                                <div class="tower-connector ${isCompleted || isUnlocked ? 'completed' : ''}"></div>
                                <div class="tower-floor ${stateClass}" 
                                     onclick="TowerPage.selectFloor(${m.id})"
                                     data-floor-id="${m.id}">
                                    <div class="tower-floor-number">T${floorNum}</div>
                                    <div class="tower-floor-icon">${isLocked ? '🔒' : m.icon}</div>
                                    <div class="tower-floor-info">
                                        <div class="tower-floor-name">${m.title}</div>
                                        <div class="tower-floor-stars">⭐ ${starsStr} sao</div>
                                        ${isCurrent && isUnlocked ? `<div class="tower-floor-progress-text">${Math.round(m.progress)}% hoàn thành</div>` : ''}
                                    </div>
                                    <div class="tower-floor-status">
                                        ${isCompleted ? '<span class="tower-floor-badge tower-floor-badge--done">✅ Đã vượt</span>' : ''}
                                        ${isCurrent && isUnlocked ? '<span class="tower-floor-badge tower-floor-badge--current">🏗️ Đang leo</span>' : ''}
                                        ${canPromote ? '<span class="tower-floor-badge tower-floor-badge--promote">🎯 Sẵn sàng!</span>' : ''}
                                        ${isLocked && m._needsMembership ? '<span class="tower-floor-badge tower-floor-badge--locked">👑 Membership</span>' : ''}
                                        ${isLocked && !m._needsMembership && m._needsMoreStars ? '<span class="tower-floor-badge tower-floor-badge--locked">🔒 Chưa đủ sao</span>' : ''}
                                    </div>
                                    ${isCurrent && isUnlocked ? `
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

        // If promotable — show level-up option in detail panel
        if (m._canPromote) {
            this._currentMilestone = m;
            this._showPromotePanel(m);

            // Update floor active state visually
            document.querySelectorAll('.tower-floor').forEach(f => {
                if (!f.classList.contains('completed') && !f.classList.contains('promotable')) {
                    f.classList.remove('current');
                }
            });
            return;
        }

        if (m._locked) {
            if (m._needsMembership) {
                Toast.warning('👑 Tầng này yêu cầu Membership! Mua tại Chợ Phiên → 💎 Nạp Tiền');
            } else {
                Toast.warning(`🔒 Cần ${m.stars_required.toLocaleString()}⭐ để mở tầng này! Bạn có ${this._userStars.toLocaleString()}⭐`);
            }
            return;
        }

        this._currentMilestone = m;

        // Update floor active state visually
        document.querySelectorAll('.tower-floor').forEach(f => {
            f.classList.remove('current');
            if (f.classList.contains('completed') || f.classList.contains('promotable')) return;
            if (!f.classList.contains('locked')) f.classList.add('locked');
        });
        const activeFloor = document.querySelector(`[data-floor-id="${milestoneId}"]`);
        if (activeFloor && !activeFloor.classList.contains('completed')) {
            activeFloor.classList.remove('locked');
            activeFloor.classList.add('current');
        }

        this.loadFloorTasks(milestoneId);
    },

    _showPromotePanel(m) {
        const detail = document.getElementById('tower-detail');
        if (!detail) return;

        const floorNum = m.sort_order + 1;
        detail.innerHTML = `
            <div class="tower-promote-panel">
                <div class="tower-promote-glow"></div>
                <div class="tower-promote-icon">${m.icon}</div>
                <h2 class="tower-promote-title">${m.title}</h2>
                <div class="tower-promote-floor">Tầng ${floorNum}</div>
                <div class="tower-promote-desc">${m.description || ''}</div>
                <div class="tower-promote-req">
                    <div class="tower-promote-req-item tower-promote-req-ok">
                        ✅ ${m.stars_required.toLocaleString()} ⭐ — Đủ sao!
                    </div>
                    ${m.sort_order >= 4 ? `
                    <div class="tower-promote-req-item ${this._hasMembership ? 'tower-promote-req-ok' : 'tower-promote-req-fail'}">
                        ${this._hasMembership ? '✅' : '❌'} 👑 Membership — ${this._hasMembership ? 'Đã có!' : 'Chưa có'}
                    </div>
                    ` : ''}
                </div>
                <button class="tower-promote-btn" onclick="TowerPage.requestLevelUp(${m.sort_order})">
                    🎯 Yêu Cầu Thăng Cấp
                </button>
            </div>
        `;

        if (window.innerWidth < 768) {
            detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    async requestLevelUp(targetFloor) {
        try {
            const btn = document.querySelector('.tower-promote-btn');
            if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang xử lý...'; }

            const result = await API.post('/gamification/request-levelup', { target_floor: targetFloor });

            if (result.success) {
                // Show epic ceremony!
                this._showLevelUpCeremony(result);
            }
        } catch (err) {
            const errorData = err;
            // Check if story completion is needed
            if (errorData.needs_story) {
                Toast.warning(errorData.error || errorData.message);
                // Offer to open story
                setTimeout(() => {
                    if (confirm('Bạn muốn mở truyện ngay không?')) {
                        this.openStory(errorData.chapter_id);
                    }
                }, 500);
            } else {
                Toast.error(err.message || err.error || 'Lỗi thăng cấp');
            }
            const btn = document.querySelector('.tower-promote-btn');
            if (btn) { btn.disabled = false; btn.textContent = '🎯 Yêu Cầu Thăng Cấp'; }
        }
    },

    openStory(chapterId) {
        StoryViewer.open(chapterId, {
            onComplete: () => {
                // Reload tower data after story ends
                this.loadData();
            }
        });
    },

    _showLevelUpCeremony(result) {
        const existing = document.getElementById('levelup-ceremony');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'levelup-ceremony';
        overlay.className = 'levelup-ceremony';
        overlay.innerHTML = `
            <div class="levelup-particles">
                ${Array.from({ length: 30 }, (_, i) => `<div class="levelup-particle" style="--i:${i};--x:${Math.random() * 100}vw;--d:${Math.random() * 3 + 2}s;--s:${Math.random() * 0.5 + 0.5}"></div>`).join('')}
            </div>
            <div class="levelup-content">
                <div class="levelup-badge-ring">
                    <div class="levelup-badge">${result.icon || '🏰'}</div>
                </div>
                <div class="levelup-label">⚡ THĂNG CẤP ⚡</div>
                <div class="levelup-rank">${result.new_rank}</div>
                <div class="levelup-floor">Tầng ${result.new_level + 1}</div>
                <div class="levelup-message">${result.message}</div>
                <button class="levelup-ok-btn" onclick="TowerPage._dismissCeremony()">✨ Tiếp Tục ✨</button>
            </div>
        `;
        document.body.appendChild(overlay);

        // Auto dismiss after 6 seconds
        setTimeout(() => this._dismissCeremony(), 6000);
    },

    _dismissCeremony() {
        const overlay = document.getElementById('levelup-ceremony');
        if (overlay) {
            overlay.classList.add('levelup-fadeout');
            setTimeout(() => overlay.remove(), 500);
        }
        // Reload tower data
        this.loadData();
        if (typeof HomePage !== 'undefined') HomePage.refreshStats?.();
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
                    <button class="btn btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:0.8rem;font-weight:700;cursor:pointer;flex-shrink:0" onclick="TowerPage.openStory(${m.sort_order + 1})">
                        📖 Xem Truyện
                    </button>
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

            ChessBoardComponent.mount({
                pgnSource: data,
                mode: solveMode,
                isEloRated: true,
                fullscreen: true,
                theme: data.puzzle_set?.theme || null,
                config: {
                    playerGoesFirst: data.puzzle_set.play_mode !== 'second',
                    memoryTimeSec: 8,
                    maxMistakes: 3
                },
                onComplete: async (result) => {
                    if (result.solved) {
                        await this.completeTask(taskId);
                    } else if (result.puzzlesSolved > 0) {
                        Toast.info('Hãy thử lại nhé! 💪');
                    }
                },
                containerEl: 'cbc-container'
            });
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async completeTask(taskId) {
        try {
            const result = await API.post(`/gamification/milestones/${taskId}/complete`);
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
