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
    memoryPhase: 'none', // 'memorize' | 'hidden' | 'none'
    memoryTimer: null,
    memoryMistakes: 0,

    // Click-to-move state
    selectedSquare: null,
    legalMoves: [],

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
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            switch (type) {
                case 'move':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(600, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
                    gain.gain.setValueAtTime(0.15, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.1);
                    break;
                case 'capture':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(300, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
                    gain.gain.setValueAtTime(0.2, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.18);
                    break;
                case 'correct':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523, ctx.currentTime);
                    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
                    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
                    gain.gain.setValueAtTime(0.15, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.35);
                    break;
                case 'wrong':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(200, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
                    gain.gain.setValueAtTime(0.12, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.25);
                    break;
                case 'solved':
                    [523, 659, 784, 1047].forEach((freq, i) => {
                        const o = ctx.createOscillator();
                        const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination);
                        o.type = 'sine';
                        o.frequency.value = freq;
                        g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
                        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.2);
                        o.start(ctx.currentTime + i * 0.12);
                        o.stop(ctx.currentTime + i * 0.12 + 0.2);
                    });
                    return; // Multiple oscillators, don't use the default one
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

        this.render();
        this.loadPuzzle();

        // Fix: mark parent modal as containing chessboard for overflow fix
        const container = document.getElementById(this.containerEl);
        if (container) {
            const modalContent = container.closest('.modal-content');
            if (modalContent) modalContent.classList.add('has-chessboard');
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
                            <div class="cbc-actions">
                                ${this.mode !== 'memory' ? `<button class="btn btn-accent btn-sm" onclick="ChessBoardComponent.getHint()">💡 Gợi Ý</button>` : ''}
                                <button class="btn btn-primary btn-sm" onclick="ChessBoardComponent.nextPuzzle()">➡️ Tiếp</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;

        // Start session timer
        this._timerInterval = setInterval(() => this._updateTimer(), 1000);
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

    loadPuzzle() {
        if (!this.pgnSource?.puzzles?.[this.currentPuzzleIdx]) return;
        if (!this.sessionActive) return;

        const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];
        this.game = new Chess(puzzle.fen);
        this.currentMoveIndex = 0;
        this.attempts = 0;
        this.hintsUsed = 0;
        this.startTime = Date.now();
        this.waitingForOpponent = false;
        this.selectedSquare = null;
        this.legalMoves = [];

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

        // Build board with smooth animation
        if (this.board) this.board.destroy();
        this.board = Chessboard('cbc-board', {
            position: puzzle.fen,
            orientation: this.playerColor,
            draggable: true,
            moveSpeed: 150,
            snapbackSpeed: 100,
            snapSpeed: 80,
            appearSpeed: 150,
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
            onDragStart: (source, piece) => this._onDragStart(source, piece),
            onDrop: (source, target) => this._onDrop(source, target),
            onSnapEnd: () => this._onSnapEnd()
        });

        // Setup click-to-move via mousedown on the board element
        this._setupClickToMove();

        window.addEventListener('resize', () => this.board && this.board.resize());

        // MODE-SPECIFIC INIT
        if (this.mode === 'memory') {
            this._startMemoryPhase(puzzle);
        } else {
            this._startNormalPlay(puzzle);
        }
    },

    // ═════════════════════════════════════════
    // BOARD INTERACTION — Drag + Click-to-move
    // Drag: handled by chessboardjs onDragStart/onDrop
    // Click: mousedown on own piece → select, mousedown on target → move
    // ═════════════════════════════════════════
    _onDragStart(source, piece) {
        if (!this.sessionActive) return false;
        if (this.game.game_over()) return false;
        if (this.waitingForOpponent) return false;
        if (this.memoryPhase === 'memorize') return false;

        const currentTurn = this.game.turn();
        const playerSide = this.playerColor === 'white' ? 'w' : 'b';
        if (currentTurn !== playerSide) return false;
        if (playerSide === 'w' && piece.startsWith('b')) return false;
        if (playerSide === 'b' && piece.startsWith('w')) return false;

        // Clear previous selection when starting a new drag
        this._clearHighlights();
        this.selectedSquare = null;
        this.legalMoves = [];
        return true;
    },

    _onDrop(source, target) {
        // Case 1: Piece dropped on same square = select it for click-to-move
        if (source === target) {
            const playerSide = this.playerColor === 'white' ? 'w' : 'b';
            this._clearHighlights();

            if (this.selectedSquare === source) {
                // Deselect
                this.selectedSquare = null;
                this.legalMoves = [];
            } else {
                // Select this piece
                this._selectSquare(source, playerSide);
            }
            return 'snapback';
        }

        // Case 2: Normal drag-to-move
        this._clearHighlights();
        this.selectedSquare = null;
        this.legalMoves = [];
        return this._tryMove(source, target);
    },

    _onSnapEnd() {
        if (this.board) {
            this.board.position(this.game.fen());
        }
    },

    _setupClickToMove() {
        const boardEl = document.getElementById('cbc-board');
        if (!boardEl) return;

        // Remove old listener
        if (this._clickMoveHandler) boardEl.removeEventListener('mousedown', this._clickMoveHandler);
        if (this._clickMoveTouchHandler) boardEl.removeEventListener('touchstart', this._clickMoveTouchHandler);

        // mousedown handler — when a square is clicked and we already have a selected piece
        this._clickMoveHandler = (e) => {
            if (!this.selectedSquare) return;  // No piece selected, let chessboardjs handle it
            if (!this.sessionActive) return;
            if (this.waitingForOpponent) return;

            const sq = this._getSquareFromEvent(e);
            if (!sq) return;
            if (sq === this.selectedSquare) return;  // Will be handled by onDrop

            const playerSide = this.playerColor === 'white' ? 'w' : 'b';
            const piece = this.game.get(sq);

            // If clicking on another own piece, let chessboardjs drag handle it
            // (its onDrop will re-select)
            if (piece && piece.color === playerSide) return;

            // If clicking on a legal target, make the move
            if (this.legalMoves.includes(sq)) {
                e.preventDefault();
                e.stopPropagation();
                const from = this.selectedSquare;
                this._clearHighlights();
                this.selectedSquare = null;
                this.legalMoves = [];
                this._tryMove(from, sq);
            } else {
                // Invalid target, clear selection
                this._clearHighlights();
                this.selectedSquare = null;
                this.legalMoves = [];
            }
        };

        this._clickMoveTouchHandler = (e) => {
            if (!this.selectedSquare) return;
            if (!this.sessionActive) return;

            const touch = e.touches?.[0];
            if (!touch) return;
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const sqEl = el?.closest('[data-square]');
            const sq = sqEl?.getAttribute('data-square');
            if (!sq || sq === this.selectedSquare) return;

            const playerSide = this.playerColor === 'white' ? 'w' : 'b';
            const piece = this.game.get(sq);
            if (piece && piece.color === playerSide) return;

            if (this.legalMoves.includes(sq)) {
                e.preventDefault();
                e.stopPropagation();
                const from = this.selectedSquare;
                this._clearHighlights();
                this.selectedSquare = null;
                this.legalMoves = [];
                this._tryMove(from, sq);
            } else {
                this._clearHighlights();
                this.selectedSquare = null;
                this.legalMoves = [];
            }
        };

        // Use capture phase to intercept before chessboardjs
        boardEl.addEventListener('mousedown', this._clickMoveHandler, true);
        boardEl.addEventListener('touchstart', this._clickMoveTouchHandler, { capture: true, passive: false });
    },

    _getSquareFromEvent(e) {
        const el = e.target?.closest?.('[data-square]');
        return el?.getAttribute('data-square') || null;
    },

    _selectSquare(square, playerSide) {
        this.selectedSquare = square;
        this.legalMoves = this.game.moves({ square: square, verbose: true }).map(m => m.to);

        this._highlightSquare(square, 'cbc-highlight-selected');
        this.legalMoves.forEach(sq => this._highlightSquare(sq, 'cbc-highlight-move'));
    },

    _highlightSquare(square, className) {
        const boardEl = document.getElementById('cbc-board');
        if (!boardEl) return;
        const squareEl = boardEl.querySelector(`[data-square="${square}"]`);
        if (squareEl) squareEl.classList.add(className);
    },

    _clearHighlights() {
        document.querySelectorAll('.cbc-highlight-selected, .cbc-highlight-move').forEach(el => {
            el.classList.remove('cbc-highlight-selected', 'cbc-highlight-move');
        });
    },

    // ═════════════════════════════════════════
    // NORMAL PLAY (Basic, Focus)
    // ═════════════════════════════════════════
    _startNormalPlay(puzzle) {
        if (this.playMode === 'second') {
            this.waitingForOpponent = true;
            this._setStatus('👀 Quan sát nước đi...', 'var(--info)');
            setTimeout(() => {
                this.playOpponentMove();
                this.waitingForOpponent = false;
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

        // Show arrow for OPPONENT's next move (help the user know what happened)
        this._showOpponentArrow();
        this._setStatus('🎯 Quân cờ đã ẩn! Hãy đi nước tiếp theo!', '#8E44AD');
    },

    _setMemoryHidden(hidden) {
        const boardEl = document.getElementById('cbc-board');
        if (!boardEl) return;
        if (hidden) {
            boardEl.classList.add('cbc-pieces-hidden');
        } else {
            boardEl.classList.remove('cbc-pieces-hidden');
        }
    },

    _showOpponentArrow() {
        // Show arrow for the OPPONENT's last move (the move computer just played)
        // This helps user know what happened while pieces are hidden
        const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];

        // If play_mode is 'second', the opponent already played move at index 0
        // Show that move as an arrow
        if (this.currentMoveIndex > 0) {
            const prevNode = this.getMoveNode(puzzle, this.currentMoveIndex - 1);
            if (prevNode) {
                // Reconstruct the move's from/to
                const prevFen = this._getFenAtMoveIndex(puzzle, this.currentMoveIndex - 1);
                if (prevFen) {
                    const tempGame = new Chess(prevFen);
                    try {
                        const result = tempGame.move(prevNode.move);
                        if (result) this._drawArrow(result.from, result.to);
                    } catch (e) { }
                }
            }
        }
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

    _drawArrow(from, to) {
        const arrowLayer = document.getElementById('cbc-arrow-layer');
        const boardEl = document.getElementById('cbc-board');
        if (!arrowLayer || !boardEl) return;

        arrowLayer.innerHTML = '';

        const boardRect = boardEl.getBoundingClientRect();
        const squareSize = boardRect.width / 8;

        const getCenter = (sq) => {
            let col = sq.charCodeAt(0) - 97;
            let row = 8 - parseInt(sq[1]);
            if (this.playerColor === 'black') { col = 7 - col; row = 7 - row; }
            return { x: (col + 0.5) * squareSize, y: (row + 0.5) * squareSize };
        };

        const fromPos = getCenter(from);
        const toPos = getCenter(to);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', boardRect.width);
        svg.setAttribute('height', boardRect.height);
        svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:100;';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'cbc-arrowhead');
        marker.setAttribute('markerWidth', '7');
        marker.setAttribute('markerHeight', '5');
        marker.setAttribute('refX', '6');
        marker.setAttribute('refY', '2.5');
        marker.setAttribute('orient', 'auto');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 7 2.5, 0 5');
        polygon.setAttribute('fill', 'rgba(243, 156, 18, 0.8)');
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromPos.x);
        line.setAttribute('y1', fromPos.y);
        line.setAttribute('x2', toPos.x);
        line.setAttribute('y2', toPos.y);
        line.setAttribute('stroke', 'rgba(243, 156, 18, 0.7)');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-opacity', '0.8');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('marker-end', 'url(#cbc-arrowhead)');
        line.classList.add('cbc-arrow-anim');
        svg.appendChild(line);

        arrowLayer.appendChild(svg);
    },

    _onMemoryMove(solved) {
        if (solved) {
            const arrowLayer = document.getElementById('cbc-arrow-layer');
            if (arrowLayer) arrowLayer.innerHTML = '';
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

    // ═════════════════════════════════════════
    // DRAG HANDLERS
    // ═════════════════════════════════════════
    onDragStart(source, piece) {
        if (!this.sessionActive) return false;
        if (this.game.game_over()) return false;
        if (this.waitingForOpponent) return false;
        if (this.memoryPhase === 'memorize') return false;

        const currentTurn = this.game.turn();
        const playerSide = this.playerColor === 'white' ? 'w' : 'b';
        if (currentTurn !== playerSide) return false;
        if (playerSide === 'w' && piece.startsWith('b')) return false;
        if (playerSide === 'b' && piece.startsWith('w')) return false;
        return true;
    },

    onDrop(source, target) {
        // Clear click-to-move state
        this.selectedSquare = null;
        this.legalMoves = [];
        this._clearHighlights();

        return this._tryMove(source, target);
    },

    _tryMove(source, target) {
        if (this.waitingForOpponent) return 'snapback';
        if (!this.sessionActive) return 'snapback';

        const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];
        const node = this.getMoveNode(puzzle, this.currentMoveIndex);
        if (!node) return 'snapback';

        // Check if it's a capture before making the move
        const targetPiece = this.game.get(target);

        const move = this.game.move({ from: source, to: target, promotion: 'q' });
        if (move === null) return 'snapback';

        this.attempts++;

        const allValidMoves = [node.move, ...(node.alternatives || [])];
        const isCorrect = allValidMoves.includes(move.san);

        if (isCorrect) {
            // Play sound
            this.playSound(move.captured ? 'capture' : 'move');

            // Show variation info
            if (move.san !== node.move && node.alternatives?.includes(move.san)) {
                const varInfo = document.getElementById('cbc-variation-info');
                const varText = document.getElementById('cbc-variation-text');
                if (varInfo && varText) {
                    varText.textContent = `Biến phụ ${move.san} — Đúng!`;
                    varInfo.classList.remove('hidden');
                }
            } else {
                document.getElementById('cbc-variation-info')?.classList.add('hidden');
            }

            this.currentMoveIndex++;
            this.board.position(this.game.fen());

            // Memory mode: handle correct move
            if (this.mode === 'memory') {
                this._onMemoryMove(true);
            }

            if (this.currentMoveIndex >= puzzle.solution_moves.length) {
                this._onPuzzleSolved();
            } else {
                this._setStatus('Đúng rồi! ✅', 'var(--success)');
                this.playSound('correct');
                this.waitingForOpponent = true;
                setTimeout(() => {
                    this.playOpponentMove();
                    this.waitingForOpponent = false;

                    if (this.currentMoveIndex >= puzzle.solution_moves.length) {
                        this._onPuzzleSolved();
                    } else {
                        if (this.mode === 'memory') {
                            // Show arrow for opponent's move that just played
                            this._showOpponentArrow();
                            this._setStatus('🎯 Đến lượt bạn đi!', '#8E44AD');
                        } else {
                            this._setStatus('Đến lượt bạn đi!', '');
                        }
                    }
                }, 500);
            }
        } else {
            // WRONG MOVE
            this.game.undo();
            this.playSound('wrong');

            // Report wrong move for immediate ELO deduction
            this._reportWrongMove();

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

            return 'snapback';
        }

        return undefined;
    },

    // ═════════════════════════════════════════
    // OPPONENT MOVES
    // ═════════════════════════════════════════
    playOpponentMove() {
        const puzzle = this.pgnSource.puzzles[this.currentPuzzleIdx];
        const node = this.getMoveNode(puzzle, this.currentMoveIndex);
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
            this.board.position(this.game.fen());
            this.currentMoveIndex++;
            // Play sound for opponent
            if (moveResult) this.playSound(moveResult.captured ? 'capture' : 'move');
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

        // Submit to backend
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

        // AUTO-ADVANCE to next puzzle after 1.5 seconds (allow ELO popup to show)
        setTimeout(() => {
            if (!this.sessionActive) return;
            this.currentPuzzleIdx++;
            if (this.currentPuzzleIdx >= this.pgnSource.puzzles.length) {
                this._endSession('complete');
            } else {
                this.loadPuzzle();
            }
        }, 1500);
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
        clearInterval(this._timerInterval);
        if (this.memoryTimer) clearInterval(this.memoryTimer);

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
        if (this.onComplete) {
            this.onComplete({
                solved: this.sessionPuzzlesSolved > 0,
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
        const node = this.getMoveNode(puzzle, this.currentMoveIndex);
        if (!node) return;

        this.hintsUsed++;
        const hintEl = document.getElementById('cbc-hints');
        if (hintEl) hintEl.textContent = this.hintsUsed;

        // Apply -10 ELO penalty for using hint
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
                } catch (err) {
                    console.error('Hint penalty error:', err);
                }
            })();
        }

        let hintText = `💡 Gợi ý: ${node.move}`;
        if (node.alternatives?.length > 0) {
            hintText += ` (hoặc: ${node.alternatives.join(', ')})`;
        }
        Toast.info(hintText);
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
        this._clearHighlights();
    }
};
