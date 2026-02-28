/**
 * Admin Dashboard Page
 */
const AdminPage = {
    render() {
        return `
        <div class="app-header">
            <div class="header-inner">
                <div class="header-logo">
                    <button class="header-btn" onclick="App.navigate('home')">← Về Bản Đồ</button>
                </div>
                <div class="header-logo"><span class="logo-icon">⚙️</span> Quản Trị</div>
                <div class="header-actions">
                    <button class="header-btn" onclick="App.logout()">🚪 Đăng Xuất</button>
                </div>
            </div>
        </div>

        <div class="admin-container">
            <div class="tabs mb-3">
                <button class="tab active" onclick="AdminPage.switchTab('users', this)">👥 Học Viên</button>
                <button class="tab" onclick="AdminPage.switchTab('puzzles', this)">♟️ Puzzle</button>
                <button class="tab" onclick="AdminPage.switchTab('milestones', this)">⛰️ Milestones</button>
                <button class="tab" onclick="AdminPage.switchTab('quests', this)">📝 Nhiệm Vụ</button>
                <button class="tab" onclick="AdminPage.switchTab('requests', this)">📋 Yêu Cầu</button>
                <button class="tab" onclick="AdminPage.switchTab('rewards', this)">🎁 Trao Thưởng</button>
                <button class="tab" onclick="AdminPage.switchTab('payments', this)">💰 Thanh Toán</button>
            </div>

            <div id="admin-content">Đang tải...</div>
        </div>
        `;
    },

    async init() {
        if (App.user?.role !== 'admin') {
            App.navigate('home');
            return;
        }
        await this.switchTab('users', document.querySelector('.tab.active'));
    },

    async switchTab(tab, btn) {
        document.querySelectorAll('.admin-container > .tabs .tab').forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');

        const container = document.getElementById('admin-content');
        container.innerHTML = '<div class="text-center text-muted">Đang tải...</div>';

        switch (tab) {
            case 'users': await this.loadUsers(container); break;
            case 'puzzles': await this.loadPuzzles(container); break;
            case 'milestones': await this.loadMilestones(container); break;
            case 'quests': await this.loadQuests(container); break;
            case 'requests': await this.loadRequests(container); break;
            case 'rewards': this.loadRewards(container); break;
            case 'payments': await this.loadPayments(container); break;
        }
    },

    // ============ USERS ============
    async loadUsers(container) {
        try {
            const data = await API.get('/admin/users');
            const pending = data.users.filter(u => u.status === 'pending');
            const active = data.users.filter(u => u.status !== 'pending');

            container.innerHTML = `
                <div class="flex gap-2 mb-3" style="justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <h3>👥 Quản Lý Học Viên (${data.users.length})</h3>
                    <button class="btn btn-primary btn-sm" onclick="AdminPage.showCreateUser()">➕ Tạo Mới</button>
                </div>

                ${pending.length > 0 ? `
                    <div class="card mb-3">
                        <div class="card-header" style="background:#FFF8E1;">⏳ Đang chờ duyệt (${pending.length})</div>
                        <div class="card-body" style="padding:0;">
                            <table class="admin-table">
                                <thead><tr><th>Tên</th><th>Username</th><th>Ngày ĐK</th><th></th></tr></thead>
                                <tbody>${pending.map(u => `
                                    <tr>
                                        <td><strong>${u.display_name}</strong></td>
                                        <td>${u.username}</td>
                                        <td>${new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                                        <td>
                                            <button class="btn btn-success btn-sm" onclick="AdminPage.approveUser(${u.id})">✅ Duyệt</button>
                                        </td>
                                    </tr>
                                `).join('')}</tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}

                <div class="card">
                    <div class="card-body" style="padding:0;overflow-x:auto;">
                        <table class="admin-table">
                            <thead><tr><th>Tên</th><th>Username</th><th>Rank</th><th>⭐</th><th>🪙</th><th>ELO</th><th>Trạng Thái</th><th></th></tr></thead>
                            <tbody>${active.map(u => `
                                <tr>
                                    <td><strong style="cursor:pointer;color:var(--primary);text-decoration:underline;" onclick="AdminPage.showUserStats(${u.id})">${u.display_name}</strong></td>
                                    <td>${u.username}</td>
                                    <td class="text-small">${u.current_rank || '-'}</td>
                                    <td>${u.knowledge_stars || 0}</td>
                                    <td>${u.chess_coins || 0}</td>
                                    <td>${u.current_elo || 800}</td>
                                    <td><span class="status-badge status-${u.status}">${u.status}</span></td>
                                    <td>
                                        ${u.role !== 'admin' ? `<button class="btn btn-danger btn-sm" onclick="AdminPage.deleteUser(${u.id},'${u.display_name}')">🗑️</button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}</tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (err) {
            container.innerHTML = `<div class="text-center text-muted">Lỗi: ${err.message}</div>`;
        }
    },

    async showUserStats(userId) {
        try {
            const data = await API.get(`/admin/users/${userId}/stats`);
            const u = data.user;
            const ss = data.sessionStats;
            const totalMin = Math.floor(ss.total_time / 60);
            const totalSec = ss.total_time % 60;
            const totalAccuracy = (ss.total_solved + ss.total_failed) > 0
                ? Math.round((ss.total_solved / (ss.total_solved + ss.total_failed)) * 100) : 0;

            const setRows = (data.setProgress || []).filter(s => s.solved_count > 0).map(s => {
                const pct = s.puzzle_count > 0 ? Math.round((s.solved_count / s.puzzle_count) * 100) : 0;
                const setMin = Math.floor(s.set_time / 60);
                const setSec = s.set_time % 60;
                const modeLabel = s.solve_mode === 'focus' ? '🎯' : s.solve_mode === 'memory' ? '🧠' : '📋';
                return `<tr>
                    <td>${modeLabel} ${s.name}</td>
                    <td>${s.solved_count}/${s.puzzle_count} (${pct}%)</td>
                    <td>${setMin}:${String(setSec).padStart(2, '0')}</td>
                </tr>`;
            }).join('');

            const sessionRows = (data.recentSessions || []).map(s => {
                const d = new Date(s.created_at).toLocaleDateString('vi-VN');
                const sm = Math.floor(s.total_time_seconds / 60);
                const sss = s.total_time_seconds % 60;
                const modeLabel = s.mode === 'focus' ? '🎯' : s.mode === 'memory' ? '🧠' : '📋';
                return `<tr>
                    <td class="text-small">${d}</td>
                    <td>${modeLabel}</td>
                    <td>${s.set_name || '-'}</td>
                    <td>✅${s.puzzles_solved} ❌${s.puzzles_failed}</td>
                    <td>${sm}:${String(sss).padStart(2, '0')}</td>
                    <td style="color:${(s.elo_change || 0) >= 0 ? 'var(--success)' : 'var(--danger)'}">${(s.elo_change || 0) >= 0 ? '+' : ''}${s.elo_change || 0}</td>
                </tr>`;
            }).join('');

            Modal.create({
                id: 'user-stats-modal',
                title: `📊 Thống Kê — ${u.display_name}`,
                icon: '📊',
                size: 'modal-lg',
                content: `
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
                        <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:12px;">
                            <div style="font-size:1.5rem;font-weight:700;">${totalMin}:${String(totalSec).padStart(2, '0')}</div>
                            <div class="text-small text-muted">⏱️ Tổng thời gian</div>
                        </div>
                        <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:12px;">
                            <div style="font-size:1.5rem;font-weight:700;">${ss.total_sessions}</div>
                            <div class="text-small text-muted">📝 Phiên làm bài</div>
                        </div>
                        <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:12px;">
                            <div style="font-size:1.5rem;font-weight:700;color:var(--success);">${ss.total_solved}</div>
                            <div class="text-small text-muted">✅ Bài giải đúng</div>
                        </div>
                        <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:12px;">
                            <div style="font-size:1.5rem;font-weight:700;">${totalAccuracy}%</div>
                            <div class="text-small text-muted">🎯 Độ chính xác</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
                        <div style="text-align:center;padding:8px;background:var(--bg-secondary);border-radius:8px;">
                            <div style="font-weight:600;">🔥 ${u.current_streak || 0} ngày</div>
                            <div class="text-small text-muted">Streak hiện tại</div>
                        </div>
                        <div style="text-align:center;padding:8px;background:var(--bg-secondary);border-radius:8px;">
                            <div style="font-weight:600;">🏆 ${u.longest_streak || 0} ngày</div>
                            <div class="text-small text-muted">Streak dài nhất</div>
                        </div>
                        <div style="text-align:center;padding:8px;background:var(--bg-secondary);border-radius:8px;">
                            <div style="font-weight:600;">♟️ ${u.current_elo || 800}</div>
                            <div class="text-small text-muted">ELO</div>
                        </div>
                    </div>

                    ${setRows ? `
                    <h4 style="margin-bottom:8px;">📚 Tiến độ các bộ puzzle</h4>
                    <table class="admin-table" style="margin-bottom:20px;">
                        <thead><tr><th>Bộ puzzle</th><th>Tiến độ</th><th>Thời gian</th></tr></thead>
                        <tbody>${setRows}</tbody>
                    </table>` : ''}

                    ${sessionRows ? `
                    <h4 style="margin-bottom:8px;">📋 10 phiên gần nhất</h4>
                    <table class="admin-table">
                        <thead><tr><th>Ngày</th><th>Mode</th><th>Set</th><th>Kết quả</th><th>Thời gian</th><th>Elo</th></tr></thead>
                        <tbody>${sessionRows}</tbody>
                    </table>` : ''}

                    <div style="text-align:center;margin-top:16px;">
                        <button class="btn btn-primary" onclick="Modal.hide('user-stats-modal')">✅ Đóng</button>
                    </div>
                `
            });
            Modal.show('user-stats-modal');
        } catch (err) {
            Toast.error('Lỗi lấy thống kê: ' + err.message);
        }
    },

    showCreateUser() {
        Modal.create({
            id: 'create-user-modal',
            title: 'Tạo Học Viên Mới',
            icon: '➕',
            content: `
                <form id="create-user-form">
                    <div class="form-group">
                        <label class="form-label">Tên đăng nhập</label>
                        <input type="text" class="form-input" id="new-username" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tên hiển thị</label>
                        <input type="text" class="form-input" id="new-display-name" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mật khẩu</label>
                        <input type="text" class="form-input" id="new-password" value="chess123" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">✅ Tạo Tài Khoản</button>
                </form>
            `
        });
        Modal.show('create-user-modal');

        document.getElementById('create-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const result = await API.post('/admin/users', {
                    username: document.getElementById('new-username').value.trim(),
                    display_name: document.getElementById('new-display-name').value.trim(),
                    password: document.getElementById('new-password').value
                });
                Toast.success(result.message);
                Modal.hide('create-user-modal');
                this.switchTab('users');
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async approveUser(userId) {
        try {
            await API.put(`/admin/users/${userId}/approve`);
            Toast.success('Đã phê duyệt!');
            this.switchTab('users');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async deleteUser(userId, name) {
        if (!confirm(`Xóa tài khoản "${name}"?`)) return;
        try {
            await API.delete(`/admin/users/${userId}`);
            Toast.success('Đã xóa!');
            this.switchTab('users');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    // ============ PUZZLES ============
    _puzzleGroupFilter: '',
    _puzzleSearch: '',

    async loadPuzzles(container) {
        try {
            const data = await API.get('/puzzles/sets');
            let groups = [];
            try { const gData = await API.get('/puzzles/groups'); groups = gData.groups || []; } catch (e) { }

            const sets = data.puzzle_sets;

            // Filter
            let filtered = sets;
            if (this._puzzleGroupFilter) {
                if (this._puzzleGroupFilter === '__none__') {
                    filtered = filtered.filter(s => !s.group_name);
                } else {
                    filtered = filtered.filter(s => s.group_name === this._puzzleGroupFilter);
                }
            }
            if (this._puzzleSearch) {
                const q = this._puzzleSearch.toLowerCase();
                filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
            }

            // Group sets
            const grouped = {};
            filtered.forEach(s => {
                const g = s.group_name || '__none__';
                if (!grouped[g]) grouped[g] = [];
                grouped[g].push(s);
            });

            const modeLabels = { basic: '📋 Cơ Bản', focus: '🎯 Tập Trung', memory: '🧠 Trí Nhớ', opening: '📖 Khai Cuộc' };
            const playLabels = { first: '🏁 Đi trước', second: '⏳ Đi sau' };

            const renderCard = (s) => {
                return `
                    <div class="shop-card" style="position:relative;">
                        <div class="shop-card-icon">♟️</div>
                        <div class="shop-card-body">
                            <div class="shop-card-name">
                                <span style="background:var(--primary);color:#fff;padding:1px 6px;border-radius:6px;font-size:0.7rem;margin-right:6px;">ID: ${s.id}</span>${s.name}
                            </div>
                            <div class="text-small text-muted">${s.puzzle_count} bài • ${s.difficulty}</div>
                            <div class="text-xs" style="margin-top:4px;color:var(--primary);">${playLabels[s.play_mode] || '🏁 Đi trước'} • ${modeLabels[s.solve_mode] || '📋 Cơ Bản'}</div>
                            ${s.group_name ? `<div class="text-xs mt-1"><span style="background:rgba(108,92,231,0.15);padding:2px 8px;border-radius:10px;font-weight:600;">📁 ${s.group_name}</span></div>` : ''}
                            <div class="text-xs text-muted mt-1">${new Date(s.created_at).toLocaleDateString('vi-VN')}</div>
                            <div style="display:flex;gap:6px;margin-top:8px;">
                                <button class="btn btn-outline btn-sm" onclick="AdminPage.showEditPuzzleSet(${s.id})">✏️ Sửa</button>
                                <button class="btn btn-danger btn-sm" onclick="AdminPage.deletePuzzleSet(${s.id})">🗑️</button>
                            </div>
                        </div>
                    </div>`;
            };

            const groupSections = Object.entries(grouped).map(([gName, gSets]) => {
                const label = gName === '__none__' ? '📦 Chưa phân nhóm' : `📁 ${gName}`;
                return `
                    <div class="admin-group-section" style="margin-bottom:16px;">
                        <div class="admin-group-header">
                            <span>${label}</span>
                            <span class="admin-group-count">${gSets.length} bộ</span>
                        </div>
                        <div class="shop-grid" style="padding:12px;">${gSets.map(renderCard).join('')}</div>
                    </div>`;
            }).join('');

            container.innerHTML = `
                <div class="flex gap-2 mb-3" style="justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <h3>♟️ Quản Lý Bài Tập (${sets.length})</h3>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-outline btn-sm" onclick="AdminPage.showCreateGroup()">📁 Tạo Nhóm</button>
                        <button class="btn btn-primary btn-sm" onclick="AdminPage.showUploadPGN()">📂 Upload PGN</button>
                    </div>
                </div>
                <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                    <select class="form-select" style="max-width:200px;" onchange="AdminPage._puzzleGroupFilter=this.value;AdminPage.loadPuzzles(document.getElementById('admin-content'))">
                        <option value="">Tất cả nhóm</option>
                        ${groups.map(g => `<option value="${g}" ${this._puzzleGroupFilter === g ? 'selected' : ''}>📁 ${g}</option>`).join('')}
                        <option value="__none__" ${this._puzzleGroupFilter === '__none__' ? 'selected' : ''}>📦 Chưa phân nhóm</option>
                    </select>
                    <input type="text" class="form-input" style="max-width:250px;" placeholder="🔍 Tìm kiếm..." value="${this._puzzleSearch}" 
                        onkeyup="AdminPage._puzzleSearch=this.value;clearTimeout(AdminPage._searchTimer);AdminPage._searchTimer=setTimeout(()=>AdminPage.loadPuzzles(document.getElementById('admin-content')),300)">
                </div>
                ${groupSections || '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">Chưa có bộ puzzle nào</div></div>'}
            `;
        } catch (err) {
            container.innerHTML = `<div class="text-center text-muted">Lỗi: ${err.message}</div>`;
        }
    },

    showCreateGroup() {
        Modal.create({
            id: 'create-group-modal',
            title: 'Tạo Nhóm Puzzle',
            icon: '📁',
            content: `
                <form id="create-group-form">
                    <div class="form-group">
                        <label class="form-label">Tên nhóm</label>
                        <input type="text" class="form-input" id="group-name" required placeholder="VD: Chiến thuật cơ bản, Tàn cuộc, Khai cuộc...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Gán cho các puzzle (chọn nhiều)</label>
                        <div id="group-puzzle-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px;">
                            Đang tải...
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">✅ Tạo & Gán</button>
                </form>
            `
        });
        Modal.show('create-group-modal');

        // Load puzzle list for selection
        (async () => {
            try {
                const data = await API.get('/puzzles/sets');
                const listEl = document.getElementById('group-puzzle-list');
                if (listEl) {
                    listEl.innerHTML = data.puzzle_sets.map(s => `
                        <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
                            <input type="checkbox" value="${s.id}" class="group-puzzle-cb">
                            <span><strong>ID ${s.id}</strong> — ${s.name} ${s.group_name ? `(📁 ${s.group_name})` : ''}</span>
                        </label>
                    `).join('');
                }
            } catch (e) { }
        })();

        document.getElementById('create-group-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupName = document.getElementById('group-name').value.trim();
            if (!groupName) return;

            const checked = [...document.querySelectorAll('.group-puzzle-cb:checked')].map(cb => cb.value);
            try {
                for (const id of checked) {
                    await API.put(`/puzzles/sets/${id}`, { group_name: groupName });
                }
                Toast.success(`Đã tạo nhóm "${groupName}" và gán ${checked.length} bộ puzzle!`);
                Modal.hide('create-group-modal');
                this.switchTab('puzzles');
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async showEditPuzzleSet(setId) {
        try {
            const data = await API.get('/puzzles/sets');
            const s = data.puzzle_sets.find(p => p.id === setId);
            if (!s) return Toast.error('Không tìm thấy!');

            let groups = [];
            try { const gData = await API.get('/puzzles/groups'); groups = gData.groups || []; } catch (e) { }

            Modal.create({
                id: 'edit-puzzle-modal',
                title: `✏️ Sửa Puzzle #${s.id}`,
                icon: '♟️',
                content: `
                    <form id="edit-puzzle-form">
                        <div class="form-group">
                            <label class="form-label">Tên</label>
                            <input type="text" class="form-input" id="ep-name" value="${s.name}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mô tả</label>
                            <input type="text" class="form-input" id="ep-desc" value="${s.description || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nhóm</label>
                            <div style="display:flex;gap:8px;">
                                <select class="form-select" id="ep-group" style="flex:1;">
                                    <option value="">-- Không nhóm --</option>
                                    ${groups.map(g => `<option value="${g}" ${s.group_name === g ? 'selected' : ''}>${g}</option>`).join('')}
                                </select>
                                <input type="text" class="form-input" id="ep-group-new" placeholder="Hoặc nhóm mới..." style="flex:1;">
                            </div>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <div class="form-group" style="flex:1;">
                                <label class="form-label">Độ khó</label>
                                <select class="form-select" id="ep-diff">
                                    <option value="beginner" ${s.difficulty === 'beginner' ? 'selected' : ''}>Người mới</option>
                                    <option value="intermediate" ${s.difficulty === 'intermediate' ? 'selected' : ''}>Trung bình</option>
                                    <option value="advanced" ${s.difficulty === 'advanced' ? 'selected' : ''}>Nâng cao</option>
                                    <option value="expert" ${s.difficulty === 'expert' ? 'selected' : ''}>Chuyên gia</option>
                                </select>
                            </div>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <div class="form-group" style="flex:1;">
                                <label class="form-label">Chế độ chơi</label>
                                <select class="form-select" id="ep-play">
                                    <option value="first" ${s.play_mode === 'first' ? 'selected' : ''}>🏁 Đi trước</option>
                                    <option value="second" ${s.play_mode === 'second' ? 'selected' : ''}>⏳ Đi sau</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex:1;">
                                <label class="form-label">Chế độ giải</label>
                                <select class="form-select" id="ep-solve">
                                    <option value="basic" ${s.solve_mode === 'basic' ? 'selected' : ''}>📋 Cơ Bản</option>
                                    <option value="focus" ${s.solve_mode === 'focus' ? 'selected' : ''}>🎯 Tập Trung</option>
                                    <option value="memory" ${s.solve_mode === 'memory' ? 'selected' : ''}>🧠 Trí Nhớ</option>
                                    <option value="opening" ${s.solve_mode === 'opening' ? 'selected' : ''}>📖 Khai Cuộc</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width:100%;">💾 Lưu</button>
                    </form>
                `
            });
            Modal.show('edit-puzzle-modal');

            document.getElementById('edit-puzzle-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const newGroup = document.getElementById('ep-group-new').value.trim();
                const groupVal = newGroup || document.getElementById('ep-group').value || '';
                try {
                    await API.put(`/puzzles/sets/${setId}`, {
                        name: document.getElementById('ep-name').value,
                        description: document.getElementById('ep-desc').value,
                        difficulty: document.getElementById('ep-diff').value,
                        play_mode: document.getElementById('ep-play').value,
                        solve_mode: document.getElementById('ep-solve').value,
                        group_name: groupVal
                    });
                    Toast.success('Đã cập nhật!');
                    Modal.hide('edit-puzzle-modal');
                    this.switchTab('puzzles');
                } catch (err) {
                    Toast.error(err.message);
                }
            });
        } catch (err) {
            Toast.error(err.message);
        }
    },

    showUploadPGN() {
        // Fetch existing groups for the group dropdown
        (async () => {
            let groups = [];
            try { const gData = await API.get('/puzzles/groups'); groups = gData.groups || []; } catch (e) { }

            Modal.create({
                id: 'upload-pgn-modal',
                title: 'Upload Bộ Puzzle PGN',
                icon: '📂',
                content: `
                    <form id="upload-pgn-form">
                        <div class="form-group">
                            <label class="form-label">Tên bộ puzzle</label>
                            <input type="text" class="form-input" id="pgn-name" placeholder="VD: Bài tập chiến thuật cơ bản" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mô tả</label>
                            <input type="text" class="form-input" id="pgn-desc" placeholder="Mô tả ngắn...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">📁 Nhóm</label>
                            <div style="display:flex;gap:8px;">
                                <select class="form-select" id="pgn-group" style="flex:1;">
                                    <option value="">-- Không nhóm --</option>
                                    ${groups.map(g => `<option value="${g}">${g}</option>`).join('')}
                                </select>
                                <input type="text" class="form-input" id="pgn-group-new" placeholder="Hoặc nhóm mới..." style="flex:1;">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Độ khó</label>
                            <select class="form-select" id="pgn-difficulty">
                                <option value="beginner">Người mới</option>
                                <option value="intermediate">Trung bình</option>
                                <option value="advanced">Nâng cao</option>
                                <option value="expert">Chuyên gia</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">♟️ Chế độ chơi</label>
                            <select class="form-select" id="pgn-play-mode">
                                <option value="first">🏁 Người chơi đi trước (mặc định)</option>
                                <option value="second">⏳ Người chơi đi sau (đối thủ đi nước 1)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">🎮 Chế độ giải</label>
                            <select class="form-select" id="pgn-solve-mode">
                                <option value="basic">📋 Cơ Bản — Giải bình thường</option>
                                <option value="focus">🎯 Tập Trung — Không gợi ý</option>
                                <option value="memory">🧠 Trí Nhớ — Ẩn quân sau vài giây</option>
                                <option value="opening">📖 Khai Cuộc — Luyện khai cuộc</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">File PGN</label>
                            <input type="file" class="form-input" id="pgn-file" accept=".pgn" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width:100%;">📤 Upload & Tạo</button>
                    </form>
                `
            });
            Modal.show('upload-pgn-modal');

            document.getElementById('upload-pgn-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.textContent = '⏳ Đang xử lý...';

                try {
                    const newGroup = document.getElementById('pgn-group-new').value.trim();
                    const groupVal = newGroup || document.getElementById('pgn-group').value || '';

                    const formData = new FormData();
                    formData.append('name', document.getElementById('pgn-name').value);
                    formData.append('description', document.getElementById('pgn-desc').value);
                    formData.append('difficulty', document.getElementById('pgn-difficulty').value);
                    formData.append('play_mode', document.getElementById('pgn-play-mode').value);
                    formData.append('solve_mode', document.getElementById('pgn-solve-mode').value);
                    formData.append('group_name', groupVal);
                    formData.append('pgn_file', document.getElementById('pgn-file').files[0]);

                    const result = await API.upload('/puzzles/sets', formData);
                    Toast.success(result.message);
                    Modal.hide('upload-pgn-modal');
                    this.switchTab('puzzles');
                } catch (err) {
                    Toast.error(err.message);
                    btn.disabled = false;
                    btn.textContent = '📤 Upload & Tạo';
                }
            });
        })();
    },

    async deletePuzzleSet(setId) {
        if (!confirm('Xóa bộ puzzle này?')) return;
        try {
            await API.delete(`/puzzles/sets/${setId}`);
            Toast.success('Đã xóa!');
            this.switchTab('puzzles');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    // ============ MILESTONES ============
    _groupLabels: {
        tactics: { icon: '⚔️', label: 'Chiến thuật' },
        middlegame: { icon: '♟️', label: 'Trung cuộc' },
        endgame: { icon: '🏁', label: 'Tàn cuộc' },
        competition: { icon: '🏆', label: 'Thi đấu' }
    },

    async loadMilestones(container) {
        try {
            const data = await API.get('/gamification/milestones');

            container.innerHTML = `
                <div class="flex gap-2 mb-3" style="justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <h3>⛰️ Quản Lý Milestones & Nhiệm Vụ</h3>
                    <button class="btn btn-primary btn-sm" onclick="AdminPage.showCreateMilestone()">➕ Thêm Milestone</button>
                </div>
                <div id="admin-milestones-list">
                    ${data.milestones.map((m, idx) => `
                        <div class="admin-ms-card" id="admin-ms-${m.id}">
                            <div class="admin-ms-header" onclick="AdminPage.toggleMilestone(${m.id})">
                                <div class="admin-ms-header-left">
                                    <span class="admin-ms-icon">${m.icon}</span>
                                    <div>
                                        <div class="admin-ms-title">${m.title}</div>
                                        <div class="admin-ms-meta">${m.description || ''} • ⭐ ${m.stars_required} sao • Thứ tự: ${m.sort_order}</div>
                                    </div>
                                </div>
                                <div class="admin-ms-header-right">
                                    <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();AdminPage.editMilestone(${m.id},'${m.title.replace(/'/g, "\\'")}','${(m.description || '').replace(/'/g, "\\'")}',${m.stars_required},'${m.icon}',${m.sort_order})">✏️</button>
                                    <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();AdminPage.deleteMilestone(${m.id})">🗑️</button>
                                    <span class="admin-ms-chevron" id="chevron-${m.id}">▶</span>
                                </div>
                            </div>
                            <div class="admin-ms-body hidden" id="ms-body-${m.id}">
                                <div class="text-center text-muted" style="padding:16px;">Đang tải...</div>
                            </div>
                        </div>
                    `).join('')}
                    ${data.milestones.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">Chưa có milestone nào</div></div>' : ''}
                </div>
            `;
        } catch (err) {
            container.innerHTML = `<div class="text-center text-muted">Lỗi: ${err.message}</div>`;
        }
    },

    async toggleMilestone(milestoneId) {
        const body = document.getElementById(`ms-body-${milestoneId}`);
        const chevron = document.getElementById(`chevron-${milestoneId}`);
        if (!body) return;

        if (body.classList.contains('hidden')) {
            body.classList.remove('hidden');
            chevron.textContent = '▼';
            await this.loadMilestoneTasks(milestoneId);
        } else {
            body.classList.add('hidden');
            chevron.textContent = '▶';
        }
    },

    async loadMilestoneTasks(milestoneId) {
        const body = document.getElementById(`ms-body-${milestoneId}`);
        if (!body) return;

        try {
            const data = await API.get(`/gamification/milestones/${milestoneId}/tasks`);
            const groups = data.groups || { tactics: [], middlegame: [], endgame: [], competition: [] };

            body.innerHTML = `
                <div class="admin-ms-groups">
                    ${Object.entries(this._groupLabels).map(([key, info]) => {
                const list = groups[key] || [];
                return `
                            <div class="admin-group-section">
                                <div class="admin-group-header">
                                    <span>${info.icon} ${info.label}</span>
                                    <span class="admin-group-count">${list.length} nhiệm vụ</span>
                                </div>
                                <div class="admin-group-tasks">
                                    ${list.map(t => `
                                        <div class="admin-task-row">
                                            <div class="admin-task-info">
                                                <span class="admin-task-title">${t.title}</span>
                                                ${t.description ? `<span class="admin-task-desc">${t.description}</span>` : ''}
                                                <span class="admin-task-meta">
                                                    +${t.stars_reward} ⭐
                                                    ${t.puzzle_set_id ? ' • 🧩 Puzzle Set #' + t.puzzle_set_id : ''}
                                                    ${t.url ? ' • 🔗 Link' : ''}
                                                </span>
                                            </div>
                                            <div class="admin-task-actions">
                                                <button class="btn btn-outline btn-sm" onclick="AdminPage.editTask(${t.id}, ${milestoneId}, '${(t.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${(t.description || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${t.task_type || 'manual'}', ${t.stars_reward || 0}, ${t.sort_order || 0}, ${t.puzzle_set_id || 'null'}, '${t.url || ''}', '${t.task_group || 'tactics'}')">✏️</button>
                                                <button class="btn btn-danger btn-sm" onclick="AdminPage.deleteTask(${t.id}, ${milestoneId})">🗑️</button>
                                            </div>
                                        </div>
                                    `).join('')}
                                    ${list.length === 0 ? '<div class="text-small text-muted" style="padding:8px 12px;">Chưa có nhiệm vụ</div>' : ''}
                                </div>
                                <button class="btn btn-outline btn-sm admin-add-task-btn" onclick="AdminPage.showAddTask(${milestoneId}, '${key}')">
                                    ➕ Thêm nhiệm vụ ${info.label}
                                </button>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        } catch (err) {
            body.innerHTML = `<div class="text-center text-muted" style="padding:16px;">Lỗi: ${err.message}</div>`;
        }
    },

    showAddTask(milestoneId, taskGroup) {
        const groupInfo = this._groupLabels[taskGroup];
        Modal.create({
            id: 'add-task-modal',
            title: `➕ Thêm ${groupInfo.icon} ${groupInfo.label}`,
            icon: '📋',
            content: `
                <form id="add-task-form">
                    <div class="form-group">
                        <label class="form-label">Tên nhiệm vụ</label>
                        <input type="text" class="form-input" id="task-title" required placeholder="VD: Giải 20 bài chiến thuật">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mô tả</label>
                        <input type="text" class="form-input" id="task-desc" placeholder="Mô tả chi tiết (tùy chọn)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Loại</label>
                        <select class="form-select" id="task-type" onchange="document.getElementById('task-puzzle-group').classList.toggle('hidden', this.value!=='puzzle_set');document.getElementById('task-url-group').classList.toggle('hidden', this.value!=='external_link')">
                            <option value="manual">📝 Thủ công (admin xác nhận)</option>
                            <option value="puzzle_set">🧩 Bộ Puzzle</option>
                            <option value="external_link">🔗 Link ngoài</option>
                        </select>
                    </div>
                    <div class="form-group hidden" id="task-puzzle-group">
                        <label class="form-label">Puzzle Set ID</label>
                        <input type="number" class="form-input" id="task-puzzle-set-id" min="1">
                    </div>
                    <div class="form-group hidden" id="task-url-group">
                        <label class="form-label">URL</label>
                        <input type="url" class="form-input" id="task-url" placeholder="https://...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sao thưởng</label>
                        <input type="number" class="form-input" id="task-stars" value="1" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thứ tự</label>
                        <input type="number" class="form-input" id="task-sort" value="0" min="0">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">✅ Tạo Nhiệm Vụ</button>
                </form>
            `
        });
        Modal.show('add-task-modal');

        document.getElementById('add-task-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const taskType = document.getElementById('task-type').value;
                await API.post(`/gamification/admin/milestones/${milestoneId}/tasks`, {
                    task_group: taskGroup,
                    title: document.getElementById('task-title').value,
                    description: document.getElementById('task-desc').value || null,
                    task_type: taskType,
                    puzzle_set_id: taskType === 'puzzle_set' ? parseInt(document.getElementById('task-puzzle-set-id').value) || null : null,
                    url: taskType === 'external_link' ? document.getElementById('task-url').value || null : null,
                    stars_reward: parseInt(document.getElementById('task-stars').value) || 0,
                    sort_order: parseInt(document.getElementById('task-sort').value) || 0
                });
                Toast.success('Đã tạo nhiệm vụ!');
                Modal.hide('add-task-modal');
                await this.loadMilestoneTasks(milestoneId);
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    editTask(taskId, milestoneId, title, description, taskType, starsReward, sortOrder, puzzleSetId, url, taskGroup) {
        const groupInfo = this._groupLabels[taskGroup] || { icon: '⚔️', label: 'Chiến thuật' };
        Modal.create({
            id: 'edit-task-modal',
            title: `✏️ Sửa ${groupInfo.icon} ${groupInfo.label}`,
            icon: '📋',
            content: `
                <form id="edit-task-form">
                    <div class="form-group">
                        <label class="form-label">Tên nhiệm vụ</label>
                        <input type="text" class="form-input" id="et-title" value="${title}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mô tả</label>
                        <input type="text" class="form-input" id="et-desc" value="${description}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Nhóm</label>
                        <select class="form-select" id="et-group">
                            ${Object.entries(this._groupLabels).map(([key, info]) =>
                `<option value="${key}" ${key === taskGroup ? 'selected' : ''}>${info.icon} ${info.label}</option>`
            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Loại</label>
                        <select class="form-select" id="et-type" onchange="document.getElementById('et-puzzle-group').classList.toggle('hidden', this.value!=='puzzle_set');document.getElementById('et-url-group').classList.toggle('hidden', this.value!=='external_link')">
                            <option value="manual" ${taskType === 'manual' ? 'selected' : ''}>📝 Thủ công</option>
                            <option value="puzzle_set" ${taskType === 'puzzle_set' ? 'selected' : ''}>🧩 Bộ Puzzle</option>
                            <option value="external_link" ${taskType === 'external_link' ? 'selected' : ''}>🔗 Link ngoài</option>
                        </select>
                    </div>
                    <div class="form-group ${taskType !== 'puzzle_set' ? 'hidden' : ''}" id="et-puzzle-group">
                        <label class="form-label">Puzzle Set ID</label>
                        <input type="number" class="form-input" id="et-puzzle-set-id" value="${puzzleSetId || ''}" min="1">
                    </div>
                    <div class="form-group ${taskType !== 'external_link' ? 'hidden' : ''}" id="et-url-group">
                        <label class="form-label">URL</label>
                        <input type="url" class="form-input" id="et-url" value="${url || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sao thưởng</label>
                        <input type="number" class="form-input" id="et-stars" value="${starsReward}" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thứ tự</label>
                        <input type="number" class="form-input" id="et-sort" value="${sortOrder}" min="0">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">💾 Lưu</button>
                </form>
            `
        });
        Modal.show('edit-task-modal');

        document.getElementById('edit-task-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const editTaskType = document.getElementById('et-type').value;
                await API.put(`/gamification/admin/tasks/${taskId}`, {
                    task_group: document.getElementById('et-group').value,
                    title: document.getElementById('et-title').value,
                    description: document.getElementById('et-desc').value || null,
                    task_type: editTaskType,
                    puzzle_set_id: editTaskType === 'puzzle_set' ? parseInt(document.getElementById('et-puzzle-set-id').value) || null : null,
                    url: editTaskType === 'external_link' ? document.getElementById('et-url').value || null : null,
                    stars_reward: parseInt(document.getElementById('et-stars').value) || 0,
                    sort_order: parseInt(document.getElementById('et-sort').value) || 0
                });
                Toast.success('Đã cập nhật!');
                Modal.hide('edit-task-modal');
                await this.loadMilestoneTasks(milestoneId);
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async deleteTask(taskId, milestoneId) {
        if (!confirm('Xóa nhiệm vụ này?')) return;
        try {
            await API.delete(`/gamification/admin/tasks/${taskId}`);
            Toast.success('Đã xóa!');
            await this.loadMilestoneTasks(milestoneId);
        } catch (err) {
            Toast.error(err.message);
        }
    },

    showCreateMilestone() {
        Modal.create({
            id: 'create-milestone-modal',
            title: 'Thêm Milestone',
            icon: '➕',
            content: `
                <form id="create-milestone-form">
                    <div class="form-group">
                        <label class="form-label">Tên</label>
                        <input type="text" class="form-input" id="ms-title" required placeholder="VD: Cấp 1 — Tân Binh">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mô tả</label>
                        <input type="text" class="form-input" id="ms-desc" placeholder="Mô tả ngắn">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sao cần thiết</label>
                        <input type="number" class="form-input" id="ms-stars" value="0" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Icon (emoji)</label>
                        <input type="text" class="form-input" id="ms-icon" value="⭐">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thứ tự</label>
                        <input type="number" class="form-input" id="ms-order" value="0" min="0">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">✅ Tạo</button>
                </form>
            `
        });
        Modal.show('create-milestone-modal');

        document.getElementById('create-milestone-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.post('/gamification/admin/milestones', {
                    title: document.getElementById('ms-title').value,
                    description: document.getElementById('ms-desc').value,
                    stars_required: parseInt(document.getElementById('ms-stars').value),
                    icon: document.getElementById('ms-icon').value,
                    sort_order: parseInt(document.getElementById('ms-order').value)
                });
                Toast.success('Đã tạo milestone!');
                Modal.hide('create-milestone-modal');
                this.switchTab('milestones');
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    editMilestone(id, title, desc, stars, icon, order) {
        Modal.create({
            id: 'edit-milestone-modal',
            title: 'Sửa Milestone',
            icon: '✏️',
            content: `
                <form id="edit-milestone-form">
                    <div class="form-group">
                        <label class="form-label">Tên</label>
                        <input type="text" class="form-input" id="ems-title" value="${title}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mô tả</label>
                        <input type="text" class="form-input" id="ems-desc" value="${desc}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sao cần thiết</label>
                        <input type="number" class="form-input" id="ems-stars" value="${stars}" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Icon</label>
                        <input type="text" class="form-input" id="ems-icon" value="${icon}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thứ tự</label>
                        <input type="number" class="form-input" id="ems-order" value="${order}" min="0">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">💾 Lưu</button>
                </form>
            `
        });
        Modal.show('edit-milestone-modal');

        document.getElementById('edit-milestone-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.put(`/gamification/admin/milestones/${id}`, {
                    title: document.getElementById('ems-title').value,
                    description: document.getElementById('ems-desc').value,
                    stars_required: parseInt(document.getElementById('ems-stars').value),
                    icon: document.getElementById('ems-icon').value,
                    sort_order: parseInt(document.getElementById('ems-order').value)
                });
                Toast.success('Đã cập nhật!');
                Modal.hide('edit-milestone-modal');
                this.switchTab('milestones');
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async deleteMilestone(id) {
        if (!confirm('Xóa milestone này?')) return;
        try {
            await API.delete(`/gamification/admin/milestones/${id}`);
            Toast.success('Đã xóa!');
            this.switchTab('milestones');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    // ============ QUESTS ============
    async loadQuests(container) {
        try {
            const data = await API.get('/quests/admin/all');
            const daysVN = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
            const dailyQuests = data.quests.filter(q => q.type === 'daily');
            const weeklyQuests = data.quests.filter(q => q.type === 'weekly');

            const renderQuestCard = (q) => `
                <div class="admin-task-row">
                    <div class="admin-task-info">
                        <div class="admin-task-title">
                            ${q.puzzle_set_id ? '🧩' : q.url ? '🔗' : '📝'} ${q.title}
                        </div>
                        <div class="admin-task-meta">
                            ${q.day_of_week ? `📅 ${daysVN[q.day_of_week]}` : '📅 Mỗi tuần'}
                            • ⭐ ${q.stars_reward} sao
                            ${q.coins_reward ? ` • 🪙 ${q.coins_reward} xu` : ''}
                            ${q.puzzle_set_id ? ` • 🧩 Puzzle ID: ${q.puzzle_set_id}` : ''}
                            ${q.url ? ` • 🔗 Link` : ''}
                        </div>
                    </div>
                    <div class="admin-task-actions">
                        <button class="btn btn-outline btn-sm" onclick="AdminPage.editQuest(${q.id}, '${(q.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${q.type}', ${q.day_of_week || 'null'}, ${q.stars_reward || 0}, ${q.coins_reward || 0}, ${q.puzzle_set_id || 'null'}, '${q.url || ''}')">✏️</button>
                        <button class="btn btn-danger btn-sm" onclick="AdminPage.deleteQuest(${q.id})">🗑️</button>
                    </div>
                </div>
            `;

            container.innerHTML = `
                <div class="flex gap-2 mb-3" style="justify-content:space-between;align-items:center;flex-wrap:wrap;">
                    <h3>📝 Quản Lý Nhiệm Vụ Trường Học</h3>
                    <button class="btn btn-primary btn-sm" onclick="AdminPage.showCreateQuest()">➕ Thêm Nhiệm Vụ</button>
                </div>

                <div class="admin-ms-groups">
                    <div class="admin-group-section" style="border-color:#FF9F43;">
                        <div class="admin-group-header" style="background:#FFF3E0;">
                            <span>📝 Nhiệm Vụ Hàng Ngày</span>
                            <span class="admin-group-count">${dailyQuests.length} nhiệm vụ</span>
                        </div>
                        <div class="admin-group-tasks">
                            ${dailyQuests.length > 0 ? dailyQuests.map(renderQuestCard).join('') : '<div class="text-center text-muted" style="padding:12px;">Chưa có nhiệm vụ hàng ngày</div>'}
                        </div>
                        <button class="btn btn-outline admin-add-task-btn" onclick="AdminPage.showCreateQuest('daily')">➕ Thêm nhiệm vụ hàng ngày</button>
                    </div>

                    <div class="admin-group-section" style="border-color:#6C9EFF;">
                        <div class="admin-group-header" style="background:#E3F2FD;">
                            <span>📅 Nhiệm Vụ Hàng Tuần</span>
                            <span class="admin-group-count">${weeklyQuests.length} nhiệm vụ</span>
                        </div>
                        <div class="admin-group-tasks">
                            ${weeklyQuests.length > 0 ? weeklyQuests.map(renderQuestCard).join('') : '<div class="text-center text-muted" style="padding:12px;">Chưa có nhiệm vụ hàng tuần</div>'}
                        </div>
                        <button class="btn btn-outline admin-add-task-btn" onclick="AdminPage.showCreateQuest('weekly')">➕ Thêm nhiệm vụ hàng tuần</button>
                    </div>
                </div>
            `;
        } catch (err) {
            container.innerHTML = `<div class="text-center text-muted">Lỗi: ${err.message}</div>`;
        }
    },

    showCreateQuest(defaultType) {
        const isDaily = defaultType !== 'weekly';
        Modal.create({
            id: 'create-quest-modal',
            title: 'Tạo Nhiệm Vụ',
            icon: '➕',
            content: `
                <form id="create-quest-form">
                    <div class="form-group">
                        <label class="form-label">Loại</label>
                        <select class="form-select" id="quest-type">
                            <option value="daily" ${isDaily ? 'selected' : ''}>📝 Hàng ngày</option>
                            <option value="weekly" ${!isDaily ? 'selected' : ''}>📅 Hàng tuần</option>
                        </select>
                    </div>
                    <div class="form-group ${!isDaily ? 'hidden' : ''}" id="quest-day-group">
                        <label class="form-label">Ngày trong tuần</label>
                        <select class="form-select" id="quest-day">
                            <option value="1">Thứ 2</option>
                            <option value="2">Thứ 3</option>
                            <option value="3">Thứ 4</option>
                            <option value="4">Thứ 5</option>
                            <option value="5">Thứ 6</option>
                            <option value="6">Thứ 7</option>
                            <option value="7">Chủ nhật</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tên nhiệm vụ</label>
                        <input type="text" class="form-input" id="quest-title" placeholder="VD: Giải 5 bài puzzles" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">🧩 Puzzle Set ID (để trống nếu không phải puzzle)</label>
                        <input type="number" class="form-input" id="quest-puzzle-set" placeholder="Xem ID ở tab Puzzle">
                    </div>
                    <div class="form-group">
                        <label class="form-label">URL liên kết (tùy chọn)</label>
                        <input type="url" class="form-input" id="quest-url" placeholder="https://...">
                    </div>
                    <div style="display:flex;gap:10px;">
                        <div class="form-group" style="flex:1;">
                            <label class="form-label">⭐ Sao thưởng</label>
                            <input type="number" class="form-input" id="quest-reward" value="1" min="0">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label class="form-label">🪙 Xu thưởng</label>
                            <input type="number" class="form-input" id="quest-coins" value="0" min="0">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">✅ Tạo Nhiệm Vụ</button>
                </form>
            `
        });
        Modal.show('create-quest-modal');

        document.getElementById('quest-type').addEventListener('change', (e) => {
            document.getElementById('quest-day-group').classList.toggle('hidden', e.target.value === 'weekly');
        });

        document.getElementById('create-quest-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const type = document.getElementById('quest-type').value;
                const puzzleSetId = document.getElementById('quest-puzzle-set').value;
                await API.post('/quests/admin', {
                    type,
                    day_of_week: type === 'daily' ? parseInt(document.getElementById('quest-day').value) : null,
                    title: document.getElementById('quest-title').value,
                    url: document.getElementById('quest-url').value || null,
                    stars_reward: parseInt(document.getElementById('quest-reward').value) || 0,
                    coins_reward: parseInt(document.getElementById('quest-coins').value) || 0,
                    puzzle_set_id: puzzleSetId ? parseInt(puzzleSetId) : null
                });
                Toast.success('Đã tạo nhiệm vụ!');
                Modal.hide('create-quest-modal');
                this.switchTab('quests');
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    editQuest(questId, title, type, dayOfWeek, starsReward, coinsReward, puzzleSetId, url) {
        const daysVN = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật' };
        const isDaily = type === 'daily';
        Modal.create({
            id: 'edit-quest-modal',
            title: '✏️ Sửa Nhiệm Vụ',
            icon: '📋',
            content: `
                <form id="edit-quest-form">
                    <div class="form-group">
                        <label class="form-label">Loại</label>
                        <select class="form-select" id="eq-type">
                            <option value="daily" ${isDaily ? 'selected' : ''}>📝 Hàng ngày</option>
                            <option value="weekly" ${!isDaily ? 'selected' : ''}>📅 Hàng tuần</option>
                        </select>
                    </div>
                    <div class="form-group ${!isDaily ? 'hidden' : ''}" id="eq-day-group">
                        <label class="form-label">Ngày trong tuần</label>
                        <select class="form-select" id="eq-day">
                            ${[1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}" ${d === dayOfWeek ? 'selected' : ''}>${daysVN[d]}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tên nhiệm vụ</label>
                        <input type="text" class="form-input" id="eq-title" value="${title}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">🧩 Puzzle Set ID</label>
                        <input type="number" class="form-input" id="eq-puzzle-set" value="${puzzleSetId || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">URL liên kết</label>
                        <input type="url" class="form-input" id="eq-url" value="${url || ''}">
                    </div>
                    <div style="display:flex;gap:10px;">
                        <div class="form-group" style="flex:1;">
                            <label class="form-label">⭐ Sao thưởng</label>
                            <input type="number" class="form-input" id="eq-stars" value="${starsReward}" min="0">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label class="form-label">🪙 Xu thưởng</label>
                            <input type="number" class="form-input" id="eq-coins" value="${coinsReward}" min="0">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">💾 Lưu</button>
                </form>
            `
        });
        Modal.show('edit-quest-modal');

        document.getElementById('eq-type').addEventListener('change', (e) => {
            document.getElementById('eq-day-group').classList.toggle('hidden', e.target.value === 'weekly');
        });

        document.getElementById('edit-quest-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const eqType = document.getElementById('eq-type').value;
                const eqPuzzleSetId = document.getElementById('eq-puzzle-set').value;
                await API.put(`/quests/admin/${questId}`, {
                    type: eqType,
                    day_of_week: eqType === 'daily' ? parseInt(document.getElementById('eq-day').value) : null,
                    title: document.getElementById('eq-title').value,
                    url: document.getElementById('eq-url').value || null,
                    stars_reward: parseInt(document.getElementById('eq-stars').value) || 0,
                    coins_reward: parseInt(document.getElementById('eq-coins').value) || 0,
                    puzzle_set_id: eqPuzzleSetId ? parseInt(eqPuzzleSetId) : null
                });
                Toast.success('Đã cập nhật!');
                Modal.hide('edit-quest-modal');
                this.switchTab('quests');
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async deleteQuest(id) {
        if (!confirm('Xóa nhiệm vụ này?')) return;
        try {
            await API.delete(`/quests/admin/${id}`);
            Toast.success('Đã xóa!');
            this.switchTab('quests');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    // ============ LEVEL-UP REQUESTS ============
    async loadRequests(container) {
        try {
            const data = await API.get('/admin/level-up-requests');

            container.innerHTML = `
                <h3 class="mb-3">📋 Yêu Cầu Thăng Cấp</h3>
                ${data.requests.length > 0 ? `
                    <div class="card">
                        <div class="card-body" style="padding:0;">
                            <table class="admin-table">
                                <thead><tr><th>Học Viên</th><th>Cấp Bậc Yêu Cầu</th><th>Ngày</th><th></th></tr></thead>
                                <tbody>${data.requests.map(r => `
                                    <tr>
                                        <td><strong>${r.display_name}</strong></td>
                                        <td>${r.requested_milestone}</td>
                                        <td>${new Date(r.created_at).toLocaleDateString('vi-VN')}</td>
                                        <td>
                                            <button class="btn btn-success btn-sm" onclick="AdminPage.approveRequest(${r.id})">✅</button>
                                            <button class="btn btn-danger btn-sm" onclick="AdminPage.denyRequest(${r.id})">❌</button>
                                        </td>
                                    </tr>
                                `).join('')}</tbody>
                            </table>
                        </div>
                    </div>
                ` : '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">Không có yêu cầu nào</div></div>'}
            `;
        } catch (err) {
            container.innerHTML = `<div class="text-center text-muted">Lỗi: ${err.message}</div>`;
        }
    },

    async approveRequest(id) {
        try {
            const result = await API.put(`/admin/level-up-requests/${id}/approve`);
            Toast.success(result.message);
            this.switchTab('requests');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async denyRequest(id) {
        try {
            await API.put(`/admin/level-up-requests/${id}/deny`);
            Toast.success('Đã từ chối');
            this.switchTab('requests');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    // ============ MANUAL REWARDS ============
    async loadRewards(container) {
        try {
            const [usersRes, historyRes] = await Promise.all([
                API.get('/admin/users'),
                API.get('/admin/award-history')
            ]);
            const users = usersRes.users || [];
            const history = historyRes.history || [];

            const userOptions = users.map(u =>
                `<option value="${u.id}">${u.display_name} (@${u.username}) — ID: ${u.id}</option>`
            ).join('');

            const historyRows = history.length > 0 ? history.map(h => {
                const d = new Date(h.created_at);
                const dateStr = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                const icon = h.currency_type === 'stars' ? '⭐' : h.currency_type === 'tickets' ? '🎫' : '🪙';
                return `<tr>
                    <td>${h.display_name}</td>
                    <td>${h.amount > 0 ? '+' : ''}${h.amount} ${icon}</td>
                    <td>${h.description || '—'}</td>
                    <td>${dateStr}</td>
                </tr>`;
            }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-light);">Chưa có lịch sử</td></tr>';

            container.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
                    <div>
                        <h3 class="mb-3">🎁 Trao Thưởng</h3>
                        <div class="card">
                            <div class="card-body">
                                <form id="reward-form">
                                    <div class="form-group">
                                        <label class="form-label">Chọn Học Viên</label>
                                        <input type="text" class="form-input" id="reward-user-search" placeholder="🔍 Tìm tên học viên..." style="margin-bottom:8px;">
                                        <select class="form-select" id="reward-user-id" required size="5" style="height:auto;">
                                            ${userOptions}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Loại</label>
                                        <select class="form-select" id="reward-type">
                                            <option value="stars">⭐ Sao</option>
                                            <option value="coins">🪙 Xu</option>
                                            <option value="tickets">🎫 Phiếu Bé Ngoan</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Số lượng</label>
                                        <input type="number" class="form-input" id="reward-amount" required min="1" value="1">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Lý do (tùy chọn)</label>
                                        <input type="text" class="form-input" id="reward-reason" placeholder="VD: Thưởng thêm vì chăm chỉ">
                                    </div>
                                    <button type="submit" class="btn btn-success" style="width:100%;">🎁 Trao Thưởng</button>
                                </form>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 class="mb-3">📋 Lịch Sử Trao Thưởng</h3>
                        <div class="card">
                            <div class="card-body" style="max-height:400px;overflow-y:auto;">
                                <table class="data-table" style="font-size:0.85rem;">
                                    <thead><tr><th>Học viên</th><th>Số lượng</th><th>Lý do</th><th>Thời gian</th></tr></thead>
                                    <tbody>${historyRows}</tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Search filter
            document.getElementById('reward-user-search').addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase();
                const select = document.getElementById('reward-user-id');
                Array.from(select.options).forEach(opt => {
                    opt.style.display = opt.textContent.toLowerCase().includes(q) ? '' : 'none';
                });
            });

            // Submit form
            document.getElementById('reward-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const result = await API.post('/admin/award', {
                        user_id: parseInt(document.getElementById('reward-user-id').value),
                        currency_type: document.getElementById('reward-type').value,
                        amount: parseInt(document.getElementById('reward-amount').value),
                        description: document.getElementById('reward-reason').value
                    });
                    Toast.success(result.message);
                    this.loadRewards(container);
                } catch (err) {
                    Toast.error(err.message);
                }
            });
        } catch (err) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">Lỗi tải dữ liệu</div></div>`;
        }
    },

    // ============ PAYMENTS ============
    async loadPayments(container) {
        try {
            const data = await API.get('/payment/pending');
            container.innerHTML = `
                <h3>💰 Đơn Thanh Toán Đang Chờ</h3>
                ${data.orders.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">Không có đơn nào đang chờ</div></div>' : `
                <div style="overflow-x:auto;">
                    <table class="admin-table">
                        <thead><tr>
                            <th>#</th><th>Học Viên</th><th>Sản Phẩm</th><th>Số Tiền</th><th>Ngày</th><th></th>
                        </tr></thead>
                        <tbody>${data.orders.map(o => `
                            <tr>
                                <td><strong>#${o.id}</strong></td>
                                <td>${o.display_name} <span class="text-small text-muted">(${o.username})</span></td>
                                <td>${o.product_name}</td>
                                <td style="color:#ffd200;font-weight:700;">${o.amount_vnd.toLocaleString()}đ</td>
                                <td class="text-small">${new Date(o.created_at).toLocaleString('vi-VN')}</td>
                                <td>
                                    <button class="btn btn-success btn-sm" onclick="AdminPage.confirmPayment(${o.id})">✅ Xác Nhận</button>
                                    <button class="btn btn-danger btn-sm" onclick="AdminPage.rejectPayment(${o.id})">❌ Từ Chối</button>
                                </td>
                            </tr>
                        `).join('')}</tbody>
                    </table>
                </div>`}
            `;
        } catch (err) {
            container.innerHTML = '<div class="text-center text-muted">Lỗi tải đơn hàng</div>';
        }
    },

    async confirmPayment(orderId) {
        if (!confirm(`Xác nhận đơn #${orderId}? Phần thưởng sẽ được trao ngay.`)) return;
        try {
            const result = await API.put(`/payment/${orderId}/confirm`);
            Toast.success(result.message);
            this.switchTab('payments');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async rejectPayment(orderId) {
        if (!confirm(`Từ chối đơn #${orderId}?`)) return;
        try {
            const result = await API.put(`/payment/${orderId}/reject`);
            Toast.success(result.message);
            this.switchTab('payments');
        } catch (err) {
            Toast.error(err.message);
        }
    }
};
