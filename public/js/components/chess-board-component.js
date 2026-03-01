/**
 * ChessBoardComponent — Reusable chess board with 4 game modes
 *
 * Props:
 *   pgnSource   — { puzzle_set: {...}, puzzles: [...] }
 *   mode        — 'basic' | 'focus' | 'memory' | 'opening'
 *   isEloRated  — boolean
 *   config      — { playerGoesFirst, memoryTimeSec, maxMistakes }
 *   onComplete  — callback({ solved, stats })
 *   containerEl — DOM id to render into
 */
const ChessBoardComponent = {
    // ═════════════════════════════════════════
    // BOARD THEMES — Inspired by chessworld.io
    // Each theme: background image + board colors + border
    // ═════════════════════════════════════════
    BOARD_THEMES: {
        candy_land: {
            name: '🍭 Candy Land',
            desc: 'Vùng đất kẹo ngọt',
            light: '#f0e6ff', dark: '#c9a0dc',
            border: '#e879a0',
            bg: '/img/themes/candy_land.png',
            wrapperBg: 'linear-gradient(135deg, #fce4ec, #f3e5f5)'
        },
        enchanted_forest: {
            name: '🌳 Rừng Ma Thuật',
            desc: 'Khu rừng phép thuật',
            light: '#e8f5e9', dark: '#66bb6a',
            border: '#388e3c',
            bg: '/img/themes/enchanted_forest.png',
            wrapperBg: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)'
        },
        ocean_adventure: {
            name: '🐠 Đại Dương',
            desc: 'Phiêu lưu dưới biển',
            light: '#e0f7fa', dark: '#4dd0e1',
            border: '#00838f',
            bg: '/img/themes/ocean_adventure.png',
            wrapperBg: 'linear-gradient(135deg, #e0f7fa, #b2ebf2)'
        },
        space_galaxy: {
            name: '🚀 Vũ Trụ',
            desc: 'Khám phá thiên hà',
            light: '#e8eaf6', dark: '#7c4dff',
            border: '#4527a0',
            bg: '/img/themes/space_galaxy.png',
            wrapperBg: 'linear-gradient(135deg, #1a1a2e, #16213e)'
        },
        medieval_castle: {
            name: '🏰 Lâu Đài',
            desc: 'Vương quốc trung cổ',
            light: '#fff8e1', dark: '#ffb74d',
            border: '#e65100',
            bg: '/img/themes/medieval_castle.png',
            wrapperBg: 'linear-gradient(135deg, #fff8e1, #ffe0b2)'
        },
        classic: {
            name: '♟️ Cổ Điển',
            desc: 'Bàn cờ truyền thống',
            light: '#f0d9b5', dark: '#b58863',
            border: '#8b6914',
            bg: null,
            wrapperBg: 'linear-gradient(135deg, #2c1f14, #1a1410)'
        }
    },
    currentTheme: null,

    // Piece image preload cache
    _pieceImagesLoaded: false,

    // ═════════════════════════════════════════
    // STATE
    // ═════════════════════════════════════════
    board: null,
    game: null,
    pgnSource: null,
    mode: 'basic',
    isEloRated: false,
    config: {},
    onComplete: null,
    containerEl: null,

    // Current puzzle state
    currentPuzzleIdx: 0,
    currentMoveIndex: 0,
    attempts: 0,
    hintsUsed: 0,
    startTime: null,
    playerColor: 'white',
    playMode: 'first',
    waitingForOpponent: false,

    // Session state (Focus/Memory)
    sessionActive: false,
    sessionPuzzlesSolved: 0,
    sessionPuzzlesFailed: 0,
    sessionTotalTime: 0,
    sessionEloChange: 0,
    sessionStartTime: null,

    // Memory mode state
    memoryPhase: 'none',
    memoryTimer: null,
    memoryMistakes: 0,

    // Click-to-move state
    selectedSquare: null,
    legalMoves: [],

    // Variation state (Basic mode only)
    _variationStack: [],
    _isInVariation: false,
    _isAutoPlaying: false,
    _variationsDone: false,

    // Retry logic: track mistakes
    _madeWrongMove: false,

    // Focus mode: deferred solve queue (only submit on successful completion)
    _focusSolveQueue: [],

    // Audio context
    audioCtx: null,

    // ═════════════════════════════════════════
    // SOUND EFFECTS (Web Audio API)
    // ═════════════════════════════════════════
    _getAudioCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioCtx;
    },

    playSound(type) {
        try {
            const ctx = this._getAudioCtx();
            if (ctx.state === 'suspended') ctx.resume();
            const t = ctx.currentTime;

            switch (type) {
                case 'move': {
                    // Soft wooden "tok" - sine sweep + filtered noise
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(420, t);
                    osc.frequency.exponentialRampToValueAtTime(280, t + 0.08);
                    gain.gain.setValueAtTime(0.15, t);
                    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
                    osc.start(t); osc.stop(t + 0.1);
                    // Noise burst
                    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
                    const data = buf.getChannelData(0);
                    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
                    const noise = ctx.createBufferSource();
                    const nGain = ctx.createGain();
                    noise.buffer = buf;
                    noise.connect(nGain); nGain.connect(ctx.destination);
                    nGain.gain.setValueAtTime(0.08, t);
                    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                    noise.start(t); noise.stop(t + 0.05);
                    break;
                }
                case 'capture': {
                    // Deep resonant thud
                    const osc = ctx.createOscillator();
                    const osc2 = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const gain2 = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc2.connect(gain2); gain2.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(300, t);
                    osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);
                    gain.gain.setValueAtTime(0.2, t);
                    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(600, t);
                    osc2.frequency.exponentialRampToValueAtTime(240, t + 0.1);
                    gain2.gain.setValueAtTime(0.08, t);
                    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
                    osc.start(t); osc.stop(t + 0.2);
                    osc2.start(t); osc2.stop(t + 0.12);
                    break;
                }
                case 'correct': {
                    // Ascending pentatonic bell chime: C5→E5→G5→C6
                    [523, 659, 784, 1047].forEach((freq, i) => {
                        const o = ctx.createOscillator();
                        const o2 = ctx.createOscillator();
                        const g = ctx.createGain();
                        o.connect(g); o2.connect(g); g.connect(ctx.destination);
                        o.type = 'sine'; o.frequency.value = freq;
                        o2.type = 'sine'; o2.frequency.value = freq * 1.003; // slight detune
                        g.gain.setValueAtTime(0.12, t + i * 0.1);
                        g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.25);
                        o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.25);
                        o2.start(t + i * 0.1); o2.stop(t + i * 0.1 + 0.25);
                    });
                    return;
                }
                case 'wrong': {
                    // Gentle descending tone
                    const o1 = ctx.createOscillator();
                    const g1 = ctx.createGain();
                    o1.connect(g1); g1.connect(ctx.destination);
                    o1.type = 'sine';
                    o1.frequency.setValueAtTime(440, t);
                    o1.frequency.exponentialRampToValueAtTime(349, t + 0.15);
                    g1.gain.setValueAtTime(0.12, t);
                    g1.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
                    o1.start(t); o1.stop(t + 0.2);
                    const o2 = ctx.createOscillator();
                    const g2 = ctx.createGain();
                    o2.connect(g2); g2.connect(ctx.destination);
                    o2.type = 'sine';
                    o2.frequency.setValueAtTime(370, t + 0.15);
                    o2.frequency.exponentialRampToValueAtTime(293, t + 0.3);
                    g2.gain.setValueAtTime(0.1, t + 0.15);
                    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
                    o2.start(t + 0.15); o2.stop(t + 0.35);
                    break;
                }
                case 'solved': {
                    [523, 659, 784, 1047].forEach((freq, i) => {
                        const o = ctx.createOscillator();
                        const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination);
                        o.type = 'sine'; o.frequency.value = freq;
                        g.gain.setValueAtTime(0.12, t + i * 0.12);
                        g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.2);
                        o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.2);
                    });
                    return;
                }
                case 'variation_enter': {
                    // Quick ascending ding
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination);
                    o.type = 'sine';
                    o.frequency.setValueAtTime(600, t);
                    o.frequency.exponentialRampToValueAtTime(900, t + 0.1);
                    g.gain.setValueAtTime(0.1, t);
                    g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
                    o.start(t); o.stop(t + 0.15);
                    break;
                }
            }
        } catch (e) { /* Audio not supported */ }
    },

    // ═════════════════════════════════════════
    // ELO CALCULATION
    // ═════════════════════════════════════════
    calculateElo(playerElo, puzzleRating, solved) {
        if (!puzzleRating) return solved ? 1 : 0;
        const K = 32;
        const expected = 1 / (1 + Math.pow(10, (puzzleRating - playerElo) / 400));
        if (solved) {
            // Win: only 1/4 of normal gain
            return Math.round(K * (1 - expected) / 4);
        } else {
            // Loss: full penalty
            return Math.round(K * (0 - expected));
        }
    },

    // ═════════════════════════════════════════
    // BOARD SKINS
    // ═════════════════════════════════════════
    applySkin(themeKey) {
        const theme = this.BOARD_THEMES[themeKey];
        if (!theme) return;
        this.currentTheme = themeKey;
        localStorage.setItem('chess_board_theme', themeKey);

        // Apply wrapper background
        const wrapper = document.querySelector('.cbc-wrapper');
        if (wrapper) {
            wrapper.style.background = theme.wrapperBg;
            // Set background image if theme has one
            if (theme.bg) {
                wrapper.classList.add('cbc-themed');
                wrapper.style.setProperty('--theme-bg', `url("${theme.bg}")`);
            } else {
                wrapper.classList.remove('cbc-themed');
                wrapper.style.removeProperty('--theme-bg');
            }
            wrapper.style.setProperty('--board-border', theme.border);
        }

        // Generate custom SVG checkerboard pattern
        const cgBoard = document.querySelector('#cbc-board cg-board');
        if (cgBoard) {
            const rows = [];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if ((r + c) % 2 === 1) {
                        rows.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="${theme.dark}"/>`);
                    }
                }
            }
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect width="8" height="8" fill="${theme.light}"/>${rows.join('')}</svg>`;
            const dataUrl = 'data:image/svg+xml;base64,' + btoa(svg);
            cgBoard.style.backgroundColor = theme.light;
            cgBoard.style.backgroundImage = `url("${dataUrl}")`;
        }
    },

    _applyCurrentSkin() {
        // Priority: puzzle set theme > user saved theme > default
        const themeKey = this._puzzleTheme || localStorage.getItem('chess_board_theme') || 'enchanted_forest';
        this.applySkin(themeKey);
    },

    showSkinSelector() {
        const items = Object.entries(this.BOARD_THEMES).map(([key, theme]) => {
            const isActive = this.currentTheme === key;
            const bgStyle = theme.bg
                ? `background-image:url('${theme.bg}');background-size:cover;background-position:center;`
                : `background:${theme.wrapperBg};`;
            return `
            <div class="cbc-theme-option ${isActive ? 'active' : ''}" onclick="ChessBoardComponent.applySkin('${key}'); ChessBoardComponent.showSkinSelector();">
                <div class="cbc-theme-preview" style="${bgStyle}">
                    <div class="cbc-theme-mini-board" style="display:grid;grid-template-columns:repeat(4,1fr);width:32px;height:32px;border-radius:3px;overflow:hidden;border:2px solid ${theme.border};">
                        <div style="background:${theme.light}"></div>
                        <div style="background:${theme.dark}"></div>
                        <div style="background:${theme.dark}"></div>
                        <div style="background:${theme.light}"></div>
                        <div style="background:${theme.dark}"></div>
                        <div style="background:${theme.light}"></div>
                        <div style="background:${theme.light}"></div>
                        <div style="background:${theme.dark}"></div>
                    </div>
                </div>
                <div class="cbc-theme-info">
                    <div style="font-weight:600;font-size:0.9rem;">${theme.name}</div>
                    <div class="text-small text-muted">${theme.desc}</div>
                </div>
                ${isActive ? '<div class="cbc-theme-check">✅</div>' : ''}
            </div>`;
        }).join('');

        Modal.create({
            id: 'cbc-skin-modal',
            title: '🎨 Chọn Theme Bàn Cờ',
            icon: '🎨',
            content: `<div class="cbc-theme-list">${items}</div>
                <button class="btn btn-primary btn-sm" style="width:100%;margin-top:12px;" onclick="Modal.hide('cbc-skin-modal')">✅ Đóng</button>`
        });
        Modal.show('cbc-skin-modal');
    },

    _preloadPieceImages() {
        // Chessground uses CSS background-image for pieces — no preload needed
        this._pieceImagesLoaded = true;
    },

    // Helper: get legal moves as chessground Dests map
    _getLegalDests() {
        const dests = new Map();
        const moves = this.game.moves({ verbose: true });
        moves.forEach(m => {
            if (!dests.has(m.from)) dests.set(m.from, []);
            dests.get(m.from).push(m.to);
        });
        return dests;
    },

    // Helper: convert chess.js FEN pieces to chessground pieces map
    _fenToPieces(fen) {
        // Chessground reads pieces from FEN automatically via cg.set({fen})
        // No manual conversion needed
    },

    // ═════════════════════════════════════════
    // INITIALIZATION
    // ═════════════════════════════════════════
    mount(options) {
        this.pgnSource = options.pgnSource;
        this.mode = options.mode || 'basic';
        this.isEloRated = options.isEloRated || false;
        this.config = Object.assign({
            playerGoesFirst: true,
            memoryTimeSec: 8,
            maxMistakes: 3
        }, options.config || {});
        this.onComplete = options.onComplete || null;
        this.containerEl = options.containerEl || 'cbc-container';
        this._fullscreen = options.fullscreen !== false; // Default: fullscreen ON
        this._puzzleTheme = options.theme || this.pgnSource?.puzzle_set?.theme || null;

        this.playMode = this.pgnSource?.puzzle_set?.play_mode || 'first';
        if (this.config.playerGoesFirst === false) this.playMode = 'second';

        // Reset session
        this.sessionActive = true;
        this.sessionPuzzlesSolved = 0;
        this.sessionPuzzlesFailed = 0;
        this.sessionTotalTime = 0;
        this.sessionEloChange = 0;
        this.sessionStartTime = Date.now();
        this.memoryMistakes = 0;
        this.selectedSquare = null;
        this.legalMoves = [];

        // Reset variation state
        this._variationStack = [];
        this._isInVariation = false;
        this._isAutoPlaying = false;
        this._variationsDone = false;
        this._madeWrongMove = false;
        this._focusSolveQueue = [];

        // Preload piece images
        this._preloadPieceImages();

        // Focus mode or startFromZero: ALWAYS start from puzzle 1
        if (this.mode === 'focus' || options.startFromZero) {
            this.currentPuzzleIdx = 0;
        } else {
            // Find first unsolved puzzle
            this.currentPuzzleIdx = 0;
            if (this.pgnSource?.puzzles) {
                for (let i = 0; i < this.pgnSource.puzzles.length; i++) {
                    if (!this.pgnSource.puzzles[i].user_progress?.solved) {
                        this.currentPuzzleIdx = i;
                        break;
                    }
                }
            }
        }

        // In fullscreen mode, create a full-screen overlay container
        if (this._fullscreen) {
            this._createFullscreenOverlay();
        }

        this.render();
        this._showStartScreen();

        // Apply skin after board is rendered
        setTimeout(() => this._applyCurrentSkin(), 100);

        // Fix: mark parent modal as containing chessboard for overflow fix
        const container = document.getElementById(this.containerEl);
        if (container) {
            const modalContent = container.closest('.modal-content');
            if (modalContent) modalContent.classList.add('has-chessboard');
        }
    },

    _createFullscreenOverlay() {
        // Remove existing
        const existing = document.getElementById('cbc-fullscreen-overlay');
        if (existing) existing.remove();

        // Create full-screen overlay
        const overlay = document.createElement('div');
        overlay.id = 'cbc-fullscreen-overlay';
        overlay.className = 'cbc-fullscreen-overlay';

        // Close button
        overlay.innerHTML = `
            <button class="cbc-fs-close" onclick="ChessBoardComponent._exitFullscreen()">×</button>
            <div id="cbc-fs-container" class="cbc-fs-container"></div>
        `;
        document.body.appendChild(overlay);
        document.body.classList.add('cbc-no-scroll');
        this.containerEl = 'cbc-fs-container';
    },

    _exitFullscreen() {
        // End session and clean up
        this.sessionActive = false;
        clearInterval(this._timerInterval);
        if (this.memoryTimer) clearInterval(this.memoryTimer);
        document.body.classList.remove('cbc-memory-hidden');
        document.body.classList.remove('cbc-no-scroll');

        const overlay = document.getElementById('cbc-fullscreen-overlay');
        if (overlay) overlay.remove();
        const startOverlay = document.getElementById('cbc-start-overlay');
        if (startOverlay) startOverlay.remove();

        if (this.board) { this.board.destroy(); this.board = null; }

        if (this.onComplete) {
            this.onComplete({
                solved: false,
                puzzlesSolved: this.sessionPuzzlesSolved,
                puzzlesFailed: this.sessionPuzzlesFailed,
                eloChange: this.sessionEloChange,
                totalTime: Math.round((Date.now() - this.sessionStartTime) / 1000)
            });
        }
    },

    // ═════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════
    render() {
        const container = document.getElementById(this.containerEl);
        if (!container) return;

        const modeLabels = {
            basic: '📋 Cơ Bản',
            focus: '🎯 Tập Trung',
            memory: '🧠 Trí Nhớ',
            opening: '📖 Khai Cuộc'
        };
        const modeColors = {
            basic: 'var(--primary)',
            focus: '#E74C3C',
            memory: '#8E44AD',
            opening: '#27AE60'
        };

        container.innerHTML = `
        <div class="cbc-wrapper">
            <div class="cbc-session-bar" id="cbc-session-bar">
                <div class="cbc-mode-badge" style="background:${modeColors[this.mode]}">
                    ${modeLabels[this.mode]}
                </div>
                <div class="cbc-session-stats">
                    <span id="cbc-solved-count">✅ 0</span>
                    <span id="cbc-timer">⏱️ 0:00</span>
                    ${this.mode === 'memory' ? `<span id="cbc-memory-mistakes">❌ 0/${this.config.maxMistakes}</span>` : ''}
                    ${this.mode === 'focus' ? `<span class="cbc-focus-warning">⚠️ Sai 1 lần = Dừng!</span>` : ''}
                </div>
            </div>

            <div class="cbc-layout">
                <div class="cbc-board-area">
                    <div class="cbc-arrow-layer" id="cbc-arrow-layer"></div>
                    <div id="cbc-board" style="width:100%;"></div>
                </div>

                <div class="cbc-info-panel">
                    <div class="card">
                        <div class="card-header">
                            🧩 Bài <span id="cbc-puzzle-num">1</span> / <span id="cbc-puzzle-total">1</span>
                            <span id="cbc-color-badge" style="margin-left:auto;font-size:0.85rem;"></span>
                        </div>
                        <div class="card-body">
                            <div id="cbc-status" class="cbc-status">Đang tải...</div>
                            <div id="cbc-variation-info" class="cbc-variation-info hidden">
                                📝 <span id="cbc-variation-text"></span>
                            </div>
                            <div class="cbc-meta">
                                <div class="text-small text-muted">Gợi ý: <span id="cbc-hints">0</span></div>
                            </div>
                            <div id="cbc-comment" class="cbc-comment hidden"></div>
                            <div class="cbc-actions">
                                ${this.mode !== 'memory' ? `<button class="btn btn-accent btn-sm" onclick="ChessBoardComponent.getHint()">💡 Gợi Ý</button>` : ''}
                                <button class="btn btn-outline btn-sm" onclick="ChessBoardComponent.showSkinSelector()">🎨</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;

        // Timer started when user clicks Start
    },

    /**
     * Show Start screen overlay before puzzle begins
     */
    _showStartScreen() {
        const modeDescriptions = {
            basic: '📋 Giải puzzle bình thường. Tính thời gian và độ chính xác.',
            focus: '🔥 <strong>Sai 1 nước = Kết thúc ngay!</strong> Khi thử lại phải bắt đầu từ bài đầu tiên.',
            memory: '🧠 Xem thế cờ <strong>8 giây</strong> → Quân cờ ẩn → Nước đi máy hiện <strong>mũi tên</strong>. Sai 3 lần thì dừng.',
            opening: '📖 Luyện tập các khai cuộc phổ biến.'
        };
        const modeLabels = { basic: '📋 Cơ Bản', focus: '🎯 Tập Trung', memory: '🧠 Trí Nhớ', opening: '📖 Khai Cuộc' };
        const modeColors = { basic: 'var(--primary)', focus: '#E74C3C', memory: '#8E44AD', opening: '#27AE60' };
        const totalPuzzles = this.pgnSource?.puzzles?.length || 0;
        const setName = this.pgnSource?.puzzle_set?.name || 'Bộ puzzle';

        const container = document.getElementById(this.containerEl);
        if (!container) return;

        // Show start overlay as FIXED overlay — avoids parent height issues
        const overlay = document.createElement('div');
        overlay.id = 'cbc-start-overlay';
        overlay.style.cssText = `
            position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
            background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);
            display:flex;align-items:center;justify-content:center;
        `;
        overlay.innerHTML = `
            <div style="text-align:center;color:#fff;padding:32px;max-width:400px;">
                <div style="font-size:3rem;margin-bottom:12px;">${this.mode === 'focus' ? '🎯' : this.mode === 'memory' ? '🧠' : '♟️'}</div>
                <div style="font-size:1.4rem;font-weight:700;margin-bottom:8px;">${setName}</div>
                <div style="font-size:0.95rem;margin-bottom:12px;color:rgba(255,255,255,0.8);">${totalPuzzles} bài tập</div>
                <div style="
                    background:${modeColors[this.mode]};padding:8px 16px;border-radius:20px;
                    display:inline-block;font-weight:600;font-size:0.9rem;margin-bottom:16px;
                ">${modeLabels[this.mode]}</div>
                <div style="font-size:0.85rem;color:rgba(255,255,255,0.85);margin-bottom:24px;line-height:1.5;">
                    ${modeDescriptions[this.mode] || ''}
                </div>
                <button onclick="ChessBoardComponent._startFromOverlay()" style="
                    background:linear-gradient(135deg, ${modeColors[this.mode]}, #6C5CE7);color:#fff;
                    border:none;padding:14px 48px;border-radius:12px;font-size:1.1rem;font-weight:700;
                    cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.3);
                    transition:transform 0.2s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    🚀 Bắt Đầu
                </button>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    _startFromOverlay() {
        const overlay = document.getElementById('cbc-start-overlay');
        if (overlay) overlay.remove();

        // Now start the session timer and load puzzle
        this.sessionStartTime = Date.now();
        this._timerInterval = setInterval(() => this._updateTimer(), 1000);
        try {
            this.loadPuzzle();
        } catch (e) {
            console.error('loadPuzzle error:', e);
        }
    },

    _updateTimer() {
        const el = document.getElementById('cbc-timer');
        if (!el) { clearInterval(this._timerInterval); return; }
        const secs = Math.round((Date.now() - this.sessionStartTime) / 1000);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        el.textContent = `⏱️ ${m}:${s.toString().padStart(2, '0')}`;
    },

    // ═════════════════════════════════════════
    // PUZZLE LOADING
    // ═════════════════════════════════════════
    getMoveNode(puzzle, index) {
        const moves = puzzle.solution_moves;
        if (index >= moves.length) return null;
        const node = moves[index];
        if (typeof node === 'string') return { move: node, alternatives: [] };
        return node;
    },

    detectPlayerColor(fen) {
        const fenTurn = fen.includes(' b ') ? 'black' : 'white';
        if (this.playMode === 'first') return fenTurn;
        return fenTurn === 'white' ? 'black' : 'white';
    },

    // Helper: normalize solution node — handles both string "Qf1+" and object {move:"Qf1+"}
    _getNode(movesArray, index) {
        const raw = movesArray?.[index];
        if (!raw) return null;
        return typeof raw === 'string' ? { move: raw } : raw;
    },

    loadPuzzle() {
        if (!this.pgnSource?.puzzles?.[this.currentPuzzleIdx]) return;
        if (!this.sessionActive) return;

        const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];

        // Normalize solution_moves: convert string nodes to objects { move: "..." }
        // DB stores as flat strings ["Qf1+","Bxf1"] but code expects objects with .move property
        if (puzzle.solution_moves && Array.isArray(puzzle.solution_moves)) {
            puzzle.solution_moves = puzzle.solution_moves.map(node =>
                typeof node === 'string' ? { move: node } : node
            );
        }

        this.game = new Chess(puzzle.fen);
        this.currentMoveIndex = 0;
        this.attempts = 0;
        this.hintsUsed = 0;
        this.startTime = Date.now();
        this.waitingForOpponent = false;
        this.selectedSquare = null;
        this.legalMoves = [];
        this._madeWrongMove = false;
        this._variationStack = [];
        this._isInVariation = false;
        this._isAutoPlaying = false;
        this._currentAutoShapes = [];
        this.lastOpponentMove = null; // Reset to avoid stale arrows from previous puzzle

        this.playerColor = this.detectPlayerColor(puzzle.fen);

        // Update UI
        const numEl = document.getElementById('cbc-puzzle-num');
        const totalEl = document.getElementById('cbc-puzzle-total');
        if (numEl) numEl.textContent = this.currentPuzzleIdx + 1;
        if (totalEl) totalEl.textContent = this.pgnSource.puzzles.length;

        const hintEl = document.getElementById('cbc-hints');
        if (hintEl) hintEl.textContent = '0';

        const colorBadge = document.getElementById('cbc-color-badge');
        if (colorBadge) {
            const emoji = this.playerColor === 'black' ? '⬛' : '⬜';
            colorBadge.textContent = `${emoji} ${this.playerColor === 'black' ? 'Đen' : 'Trắng'}`;
        }

        const varInfo = document.getElementById('cbc-variation-info');
        if (varInfo) varInfo.classList.add('hidden');

        document.querySelectorAll('.cbc-star').forEach(s => s.classList.remove('earned'));

        const solvedEl = document.getElementById('cbc-solved-count');
        if (solvedEl) solvedEl.textContent = `✅ ${this.sessionPuzzlesSolved}`;

        // Clear arrows & memory CSS
        const arrowLayer = document.getElementById('cbc-arrow-layer');
        if (arrowLayer) arrowLayer.innerHTML = '';
        this._setMemoryHidden(false);

        // Build chessground board
        const boardEl = document.getElementById('cbc-board');
        if (!boardEl) return;

        const playerSide = this.playerColor === 'white' ? 'w' : 'b';
        const turnColor = this.game.turn() === 'w' ? 'white' : 'black';
        const canMove = turnColor === this.playerColor;

        if (this.board) this.board.destroy();
        boardEl.innerHTML = ''; // Clear previous board

        this.board = Chessground(boardEl, {
            fen: puzzle.fen,
            orientation: this.playerColor,
            turnColor: turnColor,
            movable: {
                free: false,
                color: this.playerColor,
                dests: canMove ? this._getLegalDests() : new Map(),
                showDests: this.mode !== 'memory', // Hide legal move dots in memory mode
                events: {
                    after: (orig, dest) => this._onPlayerMove(orig, dest)
                }
            },
            draggable: {
                enabled: true,
                showGhost: true
            },
            selectable: {
                enabled: true
            },
            highlight: {
                lastMove: true,
                check: true
            },
            animation: {
                enabled: true,
                duration: 150
            },
            drawable: {
                enabled: false,
                visible: true,
                autoShapes: [],
                brushes: {
                    purple: { key: 'purple', color: '#8e44ad', opacity: 0.8, lineWidth: 10 }
                }
            },
            premovable: {
                enabled: false
            },
            coordinates: true
        });

        // Apply skin after board is ready
        setTimeout(() => this._applyCurrentSkin(), 50);

        // MODE-SPECIFIC INIT
        if (this.mode === 'memory') {
            this._startMemoryPhase(puzzle);
        } else {
            this._startNormalPlay(puzzle);
        }
    },

    // ═════════════════════════════════════════
    // BOARD INTERACTION — Chessground handles drag + click natively
    // This callback fires AFTER chessground has already moved the piece visually
    // ═════════════════════════════════════════
    _onPlayerMove(orig, dest) {
        if (!this.sessionActive) return;
        if (this.waitingForOpponent) return;
        if (this._isAutoPlaying) return;
        // Chessground already moved piece visually; now validate with chess.js
        this._tryMove(orig, dest);
    },

    // Update chessground board state from chess.js
    _updateBoard() {
        if (!this.board) return;
        const turnColor = this.game.turn() === 'w' ? 'white' : 'black';
        const canMove = turnColor === this.playerColor;
        this.board.set({
            fen: this.game.fen(),
            turnColor: turnColor,
            check: this.game.in_check() ? turnColor : false,
            movable: {
                color: this.playerColor,
                dests: canMove ? this._getLegalDests() : new Map()
            }
        });
    },

    // Disable board interaction temporarily
    _lockBoard() {
        if (!this.board) return;
        this.board.set({ movable: { color: undefined, dests: new Map() } });
    },

    // Re-enable board interaction for player
    _unlockBoard() {
        if (!this.board) return;
        const turnColor = this.game.turn() === 'w' ? 'white' : 'black';
        const canMove = turnColor === this.playerColor;
        this.board.set({
            movable: { color: this.playerColor, dests: canMove ? this._getLegalDests() : new Map() }
        });
    },


    // ═════════════════════════════════════════
    // NORMAL PLAY (Basic, Focus)
    // ═════════════════════════════════════════
    _startNormalPlay(puzzle) {
        if (this.playMode === 'second') {
            this.waitingForOpponent = true;
            this._lockBoard();
            this._setStatus('👀 Quan sát nước đi...', 'var(--info)');
            setTimeout(() => {
                this.playOpponentMove();
                this.waitingForOpponent = false;
                this._unlockBoard();
                this._setStatus('Đến lượt bạn đi!', '');
            }, 800);
        } else {
            this._setStatus('Đến lượt bạn đi!', '');
        }
    },

    // ═════════════════════════════════════════
    // MEMORY MODE
    // ═════════════════════════════════════════
    _startMemoryPhase(puzzle) {
        this.memoryPhase = 'memorize';
        this._lockBoard(); // Prevent moves during memorization
        this._clearAnnotations(); // Clear any leftover annotations from previous puzzle

        // If second mode, play opponent move first
        if (this.playMode === 'second') {
            this.playOpponentMove();
        }

        let timeLeft = this.config.memoryTimeSec;
        this._setStatus(`🧠 Ghi nhớ thế cờ! Còn ${timeLeft}s...`, '#8E44AD');

        this.memoryTimer = setInterval(() => {
            timeLeft--;
            this._setStatus(`🧠 Ghi nhớ thế cờ! Còn ${timeLeft}s...`, '#8E44AD');

            if (timeLeft <= 0) {
                clearInterval(this.memoryTimer);
                this._hideBoard();
            }
        }, 1000);
    },

    _hideBoard() {
        this.memoryPhase = 'hidden';
        // Hide pieces visually but keep board interactive
        this._setMemoryHidden(true);
        this._unlockBoard(); // Allow moves now (pieces are hidden)

        // Show arrow for OPPONENT's next move (help the user know what happened)
        this._showOpponentArrow();
        this._setStatus('🎯 Quân cờ đã ẩn! Hãy đi nước tiếp theo!', '#8E44AD');
    },

    _setMemoryHidden(hidden) {
        const boardEl = document.getElementById('cbc-board');
        if (!boardEl) return;
        if (hidden) {
            boardEl.classList.add('cbc-pieces-hidden');
            document.body.classList.add('cbc-memory-hidden');
        } else {
            boardEl.classList.remove('cbc-pieces-hidden');
            document.body.classList.remove('cbc-memory-hidden');
        }
    },

    _showOpponentArrow() {
        // Show arrow for the OPPONENT's last move
        this._clearAnnotations();

        if (this.lastOpponentMove) {
            this._drawArrow(this.lastOpponentMove.from, this.lastOpponentMove.to, 'rgba(142, 68, 173, 0.85)');
        } else if (this.currentMoveIndex > 0) {
            const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];
            const prevNode = this.getMoveNode(puzzle, this.currentMoveIndex - 1);
            if (prevNode) {
                const prevFen = this._getFenAtMoveIndex(puzzle, this.currentMoveIndex - 1);
                if (prevFen) {
                    const tempGame = new Chess(prevFen);
                    try {
                        const result = tempGame.move(prevNode.move);
                        if (result) this._drawArrow(result.from, result.to, 'rgba(142, 68, 173, 0.85)');
                    } catch (e) { }
                }
            }
        }
    },

    // Flash/glow effect using chessground drawable (used in memory mode)
    _flashMoveSquares(from, to) {
        if (!this.board) return;
        // Temporarily show squares as highlighted, then clear after 2.5s
        const shapes = [
            { orig: from, brush: 'green' },
            { orig: to, brush: 'green' }
        ];
        this._currentAutoShapes = shapes;
        this.board.set({ drawable: { autoShapes: shapes } });
        setTimeout(() => {
            this._currentAutoShapes = [];
            if (this.board) this.board.set({ drawable: { autoShapes: [] } });
        }, 2500);
    },

    _getFenAtMoveIndex(puzzle, targetIdx) {
        // Replay moves to get FEN at a specific index
        const tempGame = new Chess(puzzle.fen);
        for (let i = 0; i < targetIdx; i++) {
            const node = this.getMoveNode(puzzle, i);
            if (!node) return null;
            try { tempGame.move(node.move); } catch (e) { return null; }
        }
        return tempGame.fen();
    },

    _drawArrow(from, to, color) {
        // Use chessground native drawable API
        if (!this.board) return;
        const brush = color === 'rgba(46, 204, 113, 0.8)' ? 'green' :
            color === 'rgba(46, 204, 113, 0.5)' ? 'green' :
                color === 'rgba(142, 68, 173, 0.85)' ? 'purple' : 'yellow';
        // Get current shapes and add new one
        const currentShapes = this._currentAutoShapes || [];
        currentShapes.push({ orig: from, dest: to, brush: brush });
        this._currentAutoShapes = currentShapes;
        this.board.set({ drawable: { autoShapes: currentShapes } });
    },

    _drawSquareHighlight(square, color) {
        // Use chessground native drawable API
        if (!this.board) return;
        const brush = color === 'rgba(46, 204, 113, 0.5)' ? 'green' :
            color === 'rgba(235, 97, 80, 0.45)' ? 'red' : 'yellow';
        const currentShapes = this._currentAutoShapes || [];
        currentShapes.push({ orig: square, brush: brush });
        this._currentAutoShapes = currentShapes;
        this.board.set({ drawable: { autoShapes: currentShapes } });
    },

    _clearAnnotations() {
        this._currentAutoShapes = [];
        if (this.board) {
            this.board.set({ drawable: { autoShapes: [] } });
        }
        // Also clear legacy arrow layer if present
        const arrowLayer = document.getElementById('cbc-arrow-layer');
        if (arrowLayer) arrowLayer.innerHTML = '';
    },

    /**
     * Draw all annotations (arrows + highlights) from a move node
     */
    drawAnnotations(moveNode) {
        this._clearAnnotations();
        if (!moveNode) return;
        const shapes = [];
        if (moveNode.arrows) {
            moveNode.arrows.forEach(a => {
                const brush = a.color === 'green' ? 'green' : a.color === 'red' ? 'red' : 'yellow';
                shapes.push({ orig: a.from, dest: a.to, brush: brush });
            });
        }
        if (moveNode.highlights) {
            moveNode.highlights.forEach(h => {
                const brush = h.color === 'green' ? 'green' : h.color === 'red' ? 'red' : 'yellow';
                shapes.push({ orig: h.square, brush: brush });
            });
        }
        this._currentAutoShapes = shapes;
        if (this.board) {
            this.board.set({ drawable: { autoShapes: shapes } });
        }
    },

    /**
     * Show comment in the comment panel
     */
    _showMoveComment(moveNode) {
        const el = document.getElementById('cbc-comment');
        if (!el) return;
        if (moveNode?.comment) {
            el.textContent = `💬 ${moveNode.comment}`;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    },

    _onMemoryMove(solved) {
        if (solved) {
            this._clearAnnotations();
        } else {
            this.memoryMistakes++;
            const el = document.getElementById('cbc-memory-mistakes');
            if (el) el.textContent = `❌ ${this.memoryMistakes}/${this.config.maxMistakes}`;

            if (this.memoryMistakes >= this.config.maxMistakes) {
                this._endSession('memory_fail');
                return;
            }
        }
    },



    _tryMove(source, target) {
        if (this.waitingForOpponent) { this._updateBoard(); return; }
        if (!this.sessionActive) { this._updateBoard(); return; }
        if (this._isAutoPlaying) { this._updateBoard(); return; }

        const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];
        const currentMoves = this._isInVariation ? this._variationStack[this._variationStack.length - 1]?.variationMoves : puzzle.solution_moves;
        let node = currentMoves?.[this.currentMoveIndex];
        if (!node) { this._updateBoard(); return; }
        // Handle both string and object format solution nodes
        if (typeof node === 'string') node = { move: node };

        const move = this.game.move({ from: source, to: target, promotion: 'q' });
        if (move === null) { this._updateBoard(); return; }

        this.attempts++;
        this._clearAnnotations();

        // Normalize SAN for comparison: strip +, #, !, ?
        const normalize = (san) => san ? san.replace(/[+#!?]/g, '').trim() : '';
        const playerSan = normalize(move.san);
        const mainlineSan = normalize(node.move);


        // Check mainline match
        if (playerSan === mainlineSan) {
            this.playSound(move.captured ? 'capture' : 'move');
            document.getElementById('cbc-variation-info')?.classList.add('hidden');

            // Show annotations from this move node
            if (node.arrows?.length || node.highlights?.length) {
                this.drawAnnotations(node);
            }
            this._showMoveComment(node);

            // Flash player's move squares in memory mode
            if (this.mode === 'memory' && this.memoryPhase === 'hidden') {
                this._flashMoveSquares(source, target);
            }

            this.currentMoveIndex++;
            this._updateBoard();

            if (this.mode === 'memory') this._onMemoryMove(true);

            if (this.currentMoveIndex >= currentMoves.length) {
                if (this._isInVariation) {
                    this._exitVariation();
                } else {
                    this._onPuzzleSolved();
                }
            } else {
                this._setStatus('Đúng rồi! ✅', 'var(--success)');
                this.playSound('correct');
                this.waitingForOpponent = true;
                this._lockBoard();
                setTimeout(() => {
                    this.playOpponentMove();
                    this.waitingForOpponent = false;
                    this._unlockBoard();
                    if (this.currentMoveIndex >= currentMoves.length) {
                        if (this._isInVariation) this._exitVariation();
                        else this._onPuzzleSolved();
                    } else {
                        if (this.mode === 'memory') {
                            this._showOpponentArrow();
                            this._setStatus('🎯 Đến lượt bạn đi!', '#8E44AD');
                        } else {
                            this._setStatus('Đến lượt bạn đi!', '');
                        }
                    }
                }, 500);
            }
            return undefined;
        }

        // Check variations (Basic + Focus modes get full variation interaction)
        if ((this.mode === 'basic' || this.mode === 'focus') && node.variations?.length > 0) {
            for (const variation of node.variations) {
                if (variation.length > 0 && normalize(variation[0].move) === playerSan) {
                    const firstVarNode = variation[0];
                    const isBadMove = firstVarNode.nags?.some(n => n === 2 || n === 4);

                    if (isBadMove) {
                        // BAD variation: show refutation auto-play
                        this.playSound('wrong');
                        this._setStatus('❌ Đây là nước sai lầm!', '#E74C3C');
                        this._reportWrongMove();
                        this._madeWrongMove = true;

                        // Auto-play bad variation
                        this._autoPlayBadVariation(variation, this.game.fen());
                        return undefined;
                    } else {
                        // GOOD variation: acknowledge and let player continue in it
                        this.playSound(move.captured ? 'capture' : 'move');
                        this._setStatus('✅ Nước cũng hay! Đi tiếp biến phụ...', '#27AE60');
                        this.playSound('variation_enter');

                        const varInfo = document.getElementById('cbc-variation-info');
                        const varText = document.getElementById('cbc-variation-text');
                        if (varInfo && varText) {
                            varText.textContent = `Biến phụ: ${move.san}`;
                            varInfo.classList.remove('hidden');
                        }

                        // Push current context to stack
                        this._variationStack.push({
                            moves: currentMoves,
                            moveIndex: this.currentMoveIndex,
                            fen: this.game.fen(),
                            variationMoves: variation,
                            isPlayerVariation: true
                        });
                        this._isInVariation = true;
                        this.currentMoveIndex = 1; // Skip first move (player already played it)
                        this._updateBoard();

                        // Show annotations
                        if (firstVarNode.arrows?.length || firstVarNode.highlights?.length) {
                            this.drawAnnotations(firstVarNode);
                        }
                        this._showMoveComment(firstVarNode);

                        // Continue variation: play opponent's next move if any
                        if (variation.length > 1) {
                            this.waitingForOpponent = true;
                            this._lockBoard();
                            setTimeout(() => {
                                this.playOpponentMove();
                                this.waitingForOpponent = false;
                                this._unlockBoard();
                                if (this.currentMoveIndex >= variation.length) {
                                    this._exitVariation();
                                } else {
                                    this._setStatus('Đến lượt bạn đi (biến phụ)!', '#27AE60');
                                }
                            }, 500);
                        } else {
                            this._exitVariation();
                        }
                        return undefined;
                    }
                }
            }
        }

        // Check flat alternatives (backward compat for Focus/Memory)
        const allValidMoves = [node.move, ...(node.alternatives || [])];
        const isAltCorrect = allValidMoves.some(m => normalize(m) === playerSan);

        if (isAltCorrect) {
            this.playSound(move.captured ? 'capture' : 'move');
            const varInfo = document.getElementById('cbc-variation-info');
            const varText = document.getElementById('cbc-variation-text');
            if (varInfo && varText) {
                varText.textContent = `Biến phụ ${move.san} — Đúng!`;
                varInfo.classList.remove('hidden');
            }
            this.currentMoveIndex++;
            this._updateBoard();
            if (this.mode === 'memory') this._onMemoryMove(true);
            if (this.currentMoveIndex >= currentMoves.length) {
                this._onPuzzleSolved();
            } else {
                this._setStatus('Đúng rồi! ✅', 'var(--success)');
                this.playSound('correct');
                this.waitingForOpponent = true;
                this._lockBoard();
                setTimeout(() => {
                    this.playOpponentMove();
                    this.waitingForOpponent = false;
                    this._unlockBoard();
                    if (this.currentMoveIndex >= currentMoves.length) {
                        this._onPuzzleSolved();
                    } else {
                        this._setStatus('Đến lượt bạn đi!', '');
                    }
                }, 500);
            }
            return undefined;
        }

        // WRONG MOVE — no match anywhere
        this.game.undo();
        this._updateBoard(); // Resync board after undo
        this.playSound('wrong');
        this._reportWrongMove();
        this._madeWrongMove = true;

        if (this.mode === 'memory') {
            this._onMemoryMove(false);
            this._setStatus('Sai rồi! Thử lại nhé ❌', '#E74C3C');
        } else if (this.mode === 'focus') {
            this.sessionPuzzlesFailed++;
            this._setStatus('❌ Sai! Phiên Tập Trung kết thúc.', '#E74C3C');
            setTimeout(() => this._endSession('focus_fail'), 1200);
        } else {
            this._setStatus('Sai rồi, thử lại! ❌', 'var(--danger)');
            setTimeout(() => this._setStatus('Đến lượt bạn đi!', ''), 1500);
        }
    },

    /**
     * Auto-play a bad variation (refutation) at 2s/move, then restore
     */
    _autoPlayBadVariation(variation, restoreFen) {
        // restoreFen = FEN after player's wrong move (game.fen() at call time)
        // Save the FEN BEFORE the player's wrong move for restoration
        const tempGame = new Chess(restoreFen);
        try { tempGame.undo(); } catch (e) { }
        const beforePlayerFen = tempGame.fen();

        this._isAutoPlaying = true;
        this._lockBoard();
        const varInfo = document.getElementById('cbc-variation-info');
        const varText = document.getElementById('cbc-variation-text');
        if (varInfo && varText) {
            varText.textContent = 'Xem phản bác nước sai...';
            varInfo.classList.remove('hidden');
        }

        let idx = 1; // First move already played by player
        const playNext = () => {
            if (idx >= variation.length || !this.sessionActive) {
                // Done: restore position to before player's wrong move
                this._isAutoPlaying = false;
                this.game.load(beforePlayerFen);
                this._updateBoard();
                this._unlockBoard();
                this._setStatus('↩ Quay lại tìm nước hay hơn!', '#3498db');
                if (varInfo) varInfo.classList.add('hidden');
                this._clearAnnotations();
                setTimeout(() => this._setStatus('Đến lượt bạn đi!', ''), 2000);
                return;
            }
            const vNode = variation[idx];
            try {
                const result = this.game.move(vNode.move);
                if (result) {
                    this._updateBoard();
                    this.playSound(result.captured ? 'capture' : 'move');
                    this._showMoveComment(vNode);
                }
            } catch (e) { }
            idx++;
            setTimeout(playNext, 2000);
        };
        setTimeout(playNext, 1500);
    },

    /**
     * Exit current variation and return to mainline
     */
    _exitVariation() {
        if (this._variationStack.length === 0) {
            this._isInVariation = false;
            this._onPuzzleSolved();
            return;
        }

        const ctx = this._variationStack.pop();
        this._isInVariation = this._variationStack.length > 0;

        // Restore chess position to before the variation
        const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];
        const restoreFen = this._getFenAtMoveIndex(puzzle, ctx.moveIndex);
        if (restoreFen) {
            this.game.load(restoreFen);
            this._updateBoard();
        }

        this.currentMoveIndex = ctx.moveIndex;
        this._setStatus('↩ Quay lại biến chính!', '#3498db');
        this._clearAnnotations();
        document.getElementById('cbc-variation-info')?.classList.add('hidden');
        document.getElementById('cbc-comment')?.classList.add('hidden');

        setTimeout(() => this._setStatus('Đến lượt bạn đi!', ''), 1500);
    },

    // ═════════════════════════════════════════
    // OPPONENT MOVES
    // ═════════════════════════════════════════
    playOpponentMove() {
        const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];

        // If in a variation, use variation moves instead of mainline
        let currentMoves;
        if (this._isInVariation && this._variationStack.length > 0) {
            const ctx = this._variationStack[this._variationStack.length - 1];
            currentMoves = ctx.variationMoves;
        } else {
            currentMoves = puzzle.solution_moves;
        }

        if (this.currentMoveIndex >= currentMoves.length) return;

        const node = typeof currentMoves[this.currentMoveIndex] === 'string'
            ? { move: currentMoves[this.currentMoveIndex], alternatives: [] }
            : currentMoves[this.currentMoveIndex];
        if (!node) return;

        if (node.alternatives?.length > 0) {
            const varInfo = document.getElementById('cbc-variation-info');
            const varText = document.getElementById('cbc-variation-text');
            if (varInfo && varText) {
                varText.textContent = `Đối thủ có biến phụ: ${node.alternatives.join(', ')}`;
                varInfo.classList.remove('hidden');
            }
        } else {
            document.getElementById('cbc-variation-info')?.classList.add('hidden');
        }

        try {
            const moveResult = this.game.move(node.move);
            this._updateBoard();
            this.currentMoveIndex++;
            // Store opponent move for arrow display in memory mode
            if (moveResult) {
                this.lastOpponentMove = { from: moveResult.from, to: moveResult.to };
                this.playSound(moveResult.captured ? 'capture' : 'move');
            }
        } catch (e) {
            console.error('Opponent move error:', e, node.move);
        }
    },

    // ═════════════════════════════════════════
    // PUZZLE SOLVED — AUTO-ADVANCE AFTER 1s
    // ═════════════════════════════════════════
    async _onPuzzleSolved() {
        const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];
        const timeSeconds = Math.round((Date.now() - this.startTime) / 1000);
        this.sessionPuzzlesSolved++;
        this.sessionTotalTime += timeSeconds;

        this.playSound('solved');
        this._setStatus('🎉 Tuyệt vời! Bạn đã giải đúng!', 'var(--success)');

        const solvedEl = document.getElementById('cbc-solved-count');
        if (solvedEl) solvedEl.textContent = `✅ ${this.sessionPuzzlesSolved}`;

        // Focus mode: DEFER all solve submissions until session completes successfully
        if (this.mode === 'focus') {
            this._focusSolveQueue.push({
                puzzle_set_id: this.pgnSource.puzzle_set.id,
                puzzle_index: puzzle.puzzle_index,
                solved: true,
                attempts: this.attempts,
                hints_used: this.hintsUsed,
                time_seconds: timeSeconds,
                mode: this.mode,
                is_elo_rated: this.isEloRated
            });
        } else {
            // Non-focus modes: submit immediately
            try {
                const result = await API.post('/puzzles/solve', {
                    puzzle_set_id: this.pgnSource.puzzle_set.id,
                    puzzle_index: puzzle.puzzle_index,
                    solved: true,
                    attempts: this.attempts,
                    hints_used: this.hintsUsed,
                    time_seconds: timeSeconds,
                    mode: this.mode,
                    is_elo_rated: this.isEloRated
                });

                if (result.elo_change !== undefined) {
                    this.sessionEloChange += result.elo_change;
                    this._showEloPopup(result.elo_change);
                }
            } catch (err) {
                console.error('Solve error:', err);
            }
        }

        // Check if mistakes were made — if so, must re-solve cleanly (non-focus only)
        if (this._madeWrongMove && this.mode !== 'focus') {
            this._setStatus('↩ Giải lại lần nữa cho đúng hết nhé!', '#e67e22');
            setTimeout(() => {
                if (!this.sessionActive) return;
                this._madeWrongMove = false;
                this.loadPuzzle();
            }, 2000);
        } else {
            // AUTO-ADVANCE to next puzzle after 1.5 seconds
            setTimeout(() => {
                if (!this.sessionActive) return;
                this.currentPuzzleIdx++;
                if (this.currentPuzzleIdx >= this.pgnSource.puzzles.length) {
                    this._endSession('complete');
                } else {
                    this.loadPuzzle();
                }
            }, 1500);
        }
    },

    _showEloPopup(change) {
        const existing = document.querySelector('.cbc-elo-popup');
        if (existing) existing.remove();

        const isPositive = change >= 0;
        const popup = document.createElement('div');
        popup.className = 'cbc-elo-popup';
        popup.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 10000; font-size: 2rem; font-weight: 800;
            color: ${isPositive ? '#10b981' : '#ef4444'};
            text-shadow: 0 2px 8px rgba(0,0,0,0.3);
            animation: cbc-elo-float 1.5s ease forwards;
            pointer-events: none;
        `;
        popup.textContent = `${isPositive ? '+' : ''}${change} Elo`;
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 1500);
    },

    async _reportWrongMove() {
        if (!this.isEloRated) return;
        const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];
        try {
            const result = await API.post('/puzzles/solve', {
                puzzle_set_id: this.pgnSource.puzzle_set.id,
                puzzle_index: puzzle.puzzle_index,
                solved: false,
                attempts: 1,
                hints_used: 0,
                time_seconds: 0,
                mode: this.mode,
                is_elo_rated: true
            });
            if (result.elo_change !== undefined && result.elo_change !== 0) {
                this.sessionEloChange += result.elo_change;
                this._showEloPopup(result.elo_change);
            }
        } catch (err) {
            console.error('Report wrong move error:', err);
        }
    },

    // ═════════════════════════════════════════
    // SESSION END
    // ═════════════════════════════════════════
    _endSession(reason) {
        this.sessionActive = false;
        this._sessionEndReason = reason; // Track for _fireComplete
        clearInterval(this._timerInterval);
        if (this.memoryTimer) clearInterval(this.memoryTimer);
        document.body.classList.remove('cbc-memory-hidden');

        // Focus mode: flush or discard deferred solve queue
        if (this.mode === 'focus') {
            if (reason === 'complete') {
                // Session successful — submit ALL queued solves now
                this._focusSolveQueue.forEach(async (data) => {
                    try {
                        const result = await API.post('/puzzles/solve', data);
                        if (result.elo_change !== undefined) {
                            this.sessionEloChange += result.elo_change;
                        }
                    } catch (err) { console.error('Focus solve flush error:', err); }
                });
            } else {
                // Session failed — discard queue, nothing gets saved
                console.log(`🎯 Focus session failed (${reason}): discarded ${this._focusSolveQueue.length} queued solves`);
            }
            this._focusSolveQueue = [];
        }

        const totalTime = Math.round((Date.now() - this.sessionStartTime) / 1000);
        const totalPuzzles = this.sessionPuzzlesSolved + this.sessionPuzzlesFailed;
        const accuracy = totalPuzzles > 0 ? Math.round((this.sessionPuzzlesSolved / totalPuzzles) * 100) : 0;

        let reasonText = '';
        let reasonIcon = '';
        switch (reason) {
            case 'focus_fail':
                reasonText = 'Bạn đã sai 1 bài! Phiên Tập Trung kết thúc.';
                reasonIcon = '🎯';
                break;
            case 'memory_fail':
                reasonText = `Bạn đã sai ${this.config.maxMistakes} lần! Phiên Trí Nhớ kết thúc.`;
                reasonIcon = '🧠';
                break;
            case 'complete':
                reasonText = 'Chúc mừng! Bạn đã hoàn thành tất cả bài tập!';
                reasonIcon = '🏆';
                break;
            default:
                reasonText = 'Phiên đã kết thúc.';
                reasonIcon = '📋';
        }

        const m = Math.floor(totalTime / 60);
        const s = totalTime % 60;

        Modal.create({
            id: 'cbc-session-summary',
            title: 'Kết Quả Phiên Làm Bài',
            icon: reasonIcon,
            content: `
                <div class="cbc-summary">
                    <div class="cbc-summary-reason">${reasonText}</div>
                    <div class="cbc-summary-grid">
                        <div class="cbc-summary-item">
                            <div class="cbc-summary-value">${this.sessionPuzzlesSolved}</div>
                            <div class="cbc-summary-label">Bài giải đúng</div>
                        </div>
                        <div class="cbc-summary-item">
                            <div class="cbc-summary-value">${accuracy}%</div>
                            <div class="cbc-summary-label">Độ chính xác</div>
                        </div>
                        <div class="cbc-summary-item">
                            <div class="cbc-summary-value">${m}:${s.toString().padStart(2, '0')}</div>
                            <div class="cbc-summary-label">Thời gian</div>
                        </div>
                        <div class="cbc-summary-item">
                            <div class="cbc-summary-value" style="color:${this.sessionEloChange >= 0 ? 'var(--success)' : 'var(--danger)'}">
                                ${this.sessionEloChange >= 0 ? '+' : ''}${this.sessionEloChange}
                            </div>
                            <div class="cbc-summary-label">Elo</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:20px;justify-content:center;">
                        <button class="btn btn-primary" onclick="Modal.hide('cbc-session-summary'); ChessBoardComponent._fireComplete();">✅ Hoàn Tất</button>
                    </div>
                </div>
            `
        });
        Modal.show('cbc-session-summary');

        this._saveSession(totalTime, accuracy);
    },

    async _saveSession(totalTime, accuracy) {
        try {
            await API.post('/puzzles/sessions/end', {
                puzzle_set_id: this.pgnSource.puzzle_set.id,
                mode: this.mode,
                puzzles_solved: this.sessionPuzzlesSolved,
                puzzles_failed: this.sessionPuzzlesFailed,
                total_time_seconds: totalTime,
                accuracy: accuracy,
                elo_change: this.sessionEloChange
            });
        } catch (e) { console.error('Save session error:', e); }
    },

    _fireComplete() {
        // Clean up fullscreen overlay
        document.body.classList.remove('cbc-no-scroll');
        const fsOverlay = document.getElementById('cbc-fullscreen-overlay');
        if (fsOverlay) fsOverlay.remove();

        if (this.onComplete) {
            // Only mark as solved if session completed successfully (not focus_fail/memory_fail)
            const isComplete = this._sessionEndReason === 'complete';
            this.onComplete({
                solved: isComplete && this.sessionPuzzlesSolved > 0,
                puzzlesSolved: this.sessionPuzzlesSolved,
                puzzlesFailed: this.sessionPuzzlesFailed,
                eloChange: this.sessionEloChange,
                totalTime: Math.round((Date.now() - this.sessionStartTime) / 1000)
            });
        }
    },

    restartSession() {
        this.mount({
            pgnSource: this.pgnSource,
            mode: this.mode,
            isEloRated: this.isEloRated,
            config: this.config,
            onComplete: this.onComplete,
            containerEl: this.containerEl
        });
    },

    // ═════════════════════════════════════════
    // ACTIONS
    // ═════════════════════════════════════════
    getHint() {
        const puzzle = this.pgnSource?.puzzles?.[this.currentPuzzleIdx];
        const currentMoves = this._isInVariation ? this._variationStack[this._variationStack.length - 1]?.variationMoves : puzzle?.solution_moves;
        let node = currentMoves?.[this.currentMoveIndex];
        if (!node) return;
        if (typeof node === 'string') node = { move: node };

        this.hintsUsed++;
        const hintEl = document.getElementById('cbc-hints');
        if (hintEl) hintEl.textContent = this.hintsUsed;

        // ELO penalty
        if (this.isEloRated) {
            Toast.error('⚠️ Dùng gợi ý: -10 ELO');
            (async () => {
                try {
                    const result = await API.post('/puzzles/hint-penalty', {
                        puzzle_set_id: this.pgnSource.puzzle_set.id,
                        puzzle_index: puzzle.puzzle_index
                    });
                    if (result.elo_change !== undefined) {
                        this.sessionEloChange += result.elo_change;
                        this._showEloPopup(result.elo_change);
                    }
                } catch (err) { console.error('Hint penalty error:', err); }
            })();
        }

        // Progressive hints
        if (this.hintsUsed === 1) {
            // Hint 1: Highlight source square
            const tempGame = new Chess(this.game.fen());
            try {
                const result = tempGame.move(node.move);
                if (result) {
                    this._clearAnnotations();
                    this._drawSquareHighlight(result.from, 'rgba(46, 204, 113, 0.5)');
                    Toast.info('💡 Gợi ý: quân cần di chuyển được tô sáng!');
                }
            } catch (e) { Toast.info(`💡 Gợi ý: ${node.move}`); }
        } else if (this.hintsUsed === 2) {
            // Hint 2: Draw arrow from source to target
            const tempGame = new Chess(this.game.fen());
            try {
                const result = tempGame.move(node.move);
                if (result) {
                    this._clearAnnotations();
                    this._drawArrow(result.from, result.to, 'rgba(46, 204, 113, 0.8)');
                    Toast.info('💡 Gợi ý: xem mũi tên!');
                }
            } catch (e) { Toast.info(`💡 Gợi ý: ${node.move}`); }
        } else {
            // Hint 3+: Show SAN text
            let hintText = `💡 Gợi ý: ${node.move}`;
            if (node.alternatives?.length > 0) {
                hintText += ` (hoặc: ${node.alternatives.join(', ')})`;
            }
            Toast.info(hintText);
        }
    },

    resetPuzzle() {
        if (this.memoryTimer) clearInterval(this.memoryTimer);
        this.memoryMistakes = 0;
        const el = document.getElementById('cbc-memory-mistakes');
        if (el) el.textContent = `❌ 0/${this.config.maxMistakes}`;
        this.loadPuzzle();
    },

    nextPuzzle() {
        if (!this.pgnSource || !this.sessionActive) return;
        if (this.memoryTimer) clearInterval(this.memoryTimer);
        this.memoryMistakes = 0;

        this.currentPuzzleIdx++;
        if (this.currentPuzzleIdx >= this.pgnSource.puzzles.length) {
            this._endSession('complete');
            return;
        }
        this.loadPuzzle();
    },

    // ═════════════════════════════════════════
    // UTILITIES
    // ═════════════════════════════════════════
    _setStatus(text, color) {
        const el = document.getElementById('cbc-status');
        if (el) {
            el.textContent = text;
            el.style.color = color || '';
        }
    },

    destroy() {
        if (this.board) { this.board.destroy(); this.board = null; }
        if (this._timerInterval) clearInterval(this._timerInterval);
        if (this.memoryTimer) clearInterval(this.memoryTimer);
        this.sessionActive = false;
        this._clearAnnotations();
        document.body.classList.remove('cbc-memory-hidden');
        document.body.classList.remove('cbc-no-scroll');

        const fsOverlay = document.getElementById('cbc-fullscreen-overlay');
        if (fsOverlay) fsOverlay.remove();
    }
};
