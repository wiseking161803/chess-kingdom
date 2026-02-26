/**
 * Puzzle Page — Chess puzzle solving interface
 * Now uses ChessBoardComponent for all puzzle solving
 * with mode selection: Basic, Focus, Memory
 */
const PuzzlePage = {
    selectedMode: 'basic',

    render() {
        return `
        <div class="app-header">
            <div class="header-inner">
                <div class="header-logo">
                    <button class="header-btn" onclick="App.navigate('home')">← Về Bản Đồ</button>
                </div>
                <div class="header-logo"><span class="logo-icon">♟️</span> Luyện Cờ</div>
                <div class="header-stats">
                    <div class="stat-badge"><span class="stat-icon">⭐</span><span id="puzzle-stars-count">0</span></div>
                    <div class="stat-badge"><span class="stat-icon">📊</span><span id="puzzle-elo">800</span></div>
                </div>
            </div>
        </div>

        <div class="puzzle-container">
            <div id="puzzle-sets-view">
                <h2 style="margin-bottom:16px;">📚 Các Bộ Bài Tập</h2>
                <div id="puzzle-sets-list" class="shop-grid">
                    <div class="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <div class="empty-state-text">Đang tải...</div>
                    </div>
                </div>
            </div>

            <div id="puzzle-mode-select-view" class="hidden">
                <div style="max-width:600px;margin:0 auto;padding:16px;">
                    <button class="btn btn-outline btn-sm" onclick="PuzzlePage.backToSets()" style="margin-bottom:16px;">
                        ← Quay lại
                    </button>
                    <div class="card">
                        <div class="card-header">🎮 Chọn Chế Độ Chơi</div>
                        <div class="card-body">
                            <div id="puzzle-set-name" style="font-size:1.2rem;font-weight:700;margin-bottom:16px;"></div>
                            <div class="cbc-mode-selector">
                                <button class="cbc-mode-btn active" onclick="PuzzlePage.selectMode('basic', this)">
                                    📋 Cơ Bản
                                </button>
                                <button class="cbc-mode-btn cbc-mode-btn--focus" onclick="PuzzlePage.selectMode('focus', this)">
                                    🎯 Tập Trung
                                </button>
                                <button class="cbc-mode-btn cbc-mode-btn--memory" onclick="PuzzlePage.selectMode('memory', this)">
                                    🧠 Trí Nhớ
                                </button>
                            </div>
                            <div id="mode-description" class="text-muted" style="margin-bottom:16px;font-size:0.9rem;">
                                Giải puzzle bình thường. Tính thời gian và độ chính xác.
                            </div>
                            <div style="display:flex;gap:8px;">
                                <label class="text-small" style="display:flex;align-items:center;gap:4px;">
                                    <input type="checkbox" id="elo-rated-check" checked>
                                    📊 Tính Elo
                                </label>
                            </div>
                            <button class="btn btn-primary" style="width:100%;margin-top:20px;" onclick="PuzzlePage.startWithMode()">
                                🚀 Bắt Đầu!
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="puzzle-solve-view" class="hidden">
                <div style="margin-bottom:8px;padding:0 16px;">
                    <button class="btn btn-outline btn-sm" onclick="PuzzlePage.backToSets()">
                        📚 Chọn Bộ Khác
                    </button>
                </div>
                <div id="cbc-container"></div>
            </div>
        </div>
        `;
    },

    async init() {
        await this.loadSets();
        this.updateHeaderStats();
    },

    async updateHeaderStats() {
        try {
            const data = await API.get('/gamification/stats');
            document.getElementById('puzzle-stars-count').textContent = data.knowledge_stars;
            document.getElementById('puzzle-elo').textContent = data.current_elo;
        } catch (e) { }
    },

    async loadSets() {
        try {
            const data = await API.get('/puzzles/sets');
            const container = document.getElementById('puzzle-sets-list');

            if (data.puzzle_sets.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="grid-column:1/-1;">
                        <div class="empty-state-icon">📦</div>
                        <div class="empty-state-text">Chưa có bài tập nào.</div>
                        <div class="text-muted text-small mt-1">Admin cần upload file PGN để tạo bài tập.</div>
                    </div>
                `;
                return;
            }

            container.innerHTML = data.puzzle_sets.map(set => {
                const modeLabel = set.play_mode === 'second' ? '⏳ Người chơi đi sau' : '🏁 Người chơi đi trước';
                return `
                <div class="shop-card" onclick="PuzzlePage.selectSet(${set.id})" style="cursor:pointer">
                    <div class="shop-card-icon">♟️</div>
                    <div class="shop-card-body">
                        <div class="shop-card-name">${set.name}</div>
                        <div class="text-small text-muted">${set.description || set.difficulty}</div>
                        <div class="text-xs" style="margin-top:4px;color:var(--primary);">${modeLabel}</div>
                        <div style="margin-top:8px;">
                            <div class="milestone-progress-bar">
                                <div class="milestone-progress-fill" style="width:${set.completion_pct}%"></div>
                            </div>
                            <div class="text-xs text-muted mt-1">${set.user_solved}/${set.puzzle_count} đã giải</div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async selectSet(setId) {
        try {
            const data = await API.get(`/puzzles/sets/${setId}`);
            this._pendingSet = data;
            this.selectedMode = 'basic';

            document.getElementById('puzzle-sets-view').classList.add('hidden');
            document.getElementById('puzzle-mode-select-view').classList.remove('hidden');
            document.getElementById('puzzle-solve-view').classList.add('hidden');

            const nameEl = document.getElementById('puzzle-set-name');
            if (nameEl) nameEl.textContent = `📚 ${data.puzzle_set.name} (${data.puzzles.length} bài)`;

            // Reset mode buttons
            document.querySelectorAll('.cbc-mode-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.cbc-mode-btn')?.classList.add('active');
            this._updateModeDescription('basic');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    selectMode(mode, btn) {
        this.selectedMode = mode;
        document.querySelectorAll('.cbc-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._updateModeDescription(mode);
    },

    _updateModeDescription(mode) {
        const descriptions = {
            basic: 'Giải puzzle bình thường. Tính thời gian và độ chính xác.',
            focus: '🔥 Sai 1 bài là dừng ngay phiên! Thử thách sự tập trung.',
            memory: '🧠 Xem thế cờ 8 giây → Quân cờ ẩn → Nhìn mũi tên để đi. Sai 3 lần thì dừng.'
        };
        const el = document.getElementById('mode-description');
        if (el) el.textContent = descriptions[mode] || '';
    },

    startWithMode() {
        if (!this._pendingSet) return;

        const isEloRated = document.getElementById('elo-rated-check')?.checked !== false;

        document.getElementById('puzzle-mode-select-view').classList.add('hidden');
        document.getElementById('puzzle-solve-view').classList.remove('hidden');

        ChessBoardComponent.mount({
            pgnSource: this._pendingSet,
            mode: this.selectedMode,
            isEloRated: isEloRated,
            config: {
                playerGoesFirst: this._pendingSet.puzzle_set.play_mode !== 'second',
                memoryTimeSec: 8,
                maxMistakes: 3
            },
            onComplete: (result) => {
                this.updateHeaderStats();
            },
            containerEl: 'cbc-container'
        });
    },

    backToSets() {
        ChessBoardComponent.destroy();
        document.getElementById('puzzle-sets-view').classList.remove('hidden');
        document.getElementById('puzzle-mode-select-view').classList.add('hidden');
        document.getElementById('puzzle-solve-view').classList.add('hidden');
        this.loadSets();
        this.updateHeaderStats();
    }
};
