/**
 * StoryViewer — Visual Novel Engine for "Huyền Thoại Bàn Cờ Đại Việt"
 * Displays story scenes with backgrounds, characters, dialogues, and choices.
 * Integrates with tower milestones and ChessBoardComponent for puzzle scenes.
 */
const StoryViewer = {
    _overlay: null,
    _chapter: null,
    _sceneIndex: 0,
    _dialogueIndex: 0,
    _currentScene: null,
    _playerName: 'Kỳ Thủ',
    _onComplete: null,
    _isAnimating: false,
    _chapterData: {},
    _isAdmin: false,

    /**
     * Open a chapter story
     * @param {number} chapterId - Chapter number (1-18)
     * @param {object} options - { onComplete: Function }
     */
    async open(chapterId, options = {}) {
        this._onComplete = options.onComplete || null;
        this._playerName = App.user?.display_name || App.user?.full_name || 'Kỳ Thủ';
        this._sceneIndex = 0;
        this._dialogueIndex = 0;
        this._isAdmin = App.user?.role === 'admin';

        try {
            // Load chapter data
            if (!this._chapterData[chapterId]) {
                const resp = await fetch(`/data/chapters/ch${chapterId}.json`);
                if (!resp.ok) throw new Error('Chưa có nội dung chương này');
                this._chapterData[chapterId] = await resp.json();
            }
            this._chapter = this._chapterData[chapterId];

            // Check progress from backend (daily gate + streak)
            let startScene = 0;
            try {
                const progress = await API.get(`/gamification/story/progress/${chapterId}`);
                this._storyProgress = progress;
                startScene = progress.next_scene || 0;

                // If all scenes completed, show "already done" message
                if (startScene >= this._chapter.scenes.length) {
                    Toast.info('📖 Bạn đã hoàn thành chương này rồi! ✅');
                    return;
                }

                // Gate: can't view next scene
                if (!progress.can_view_next && startScene > 0) {
                    Toast.warning(`📖 ${progress.gate_reason}`);
                    return;
                }
            } catch (e) {
                // API unavailable — allow offline reading from scene 0
            }

            this._createOverlay();
            this._playScene(startScene);
        } catch (err) {
            Toast.warning(`📖 ${err.message}`);
        }
    },

    _createOverlay() {
        // Remove existing
        if (this._overlay) this._overlay.remove();

        const overlay = document.createElement('div');
        overlay.className = 'story-overlay';
        overlay.id = 'story-overlay';
        overlay.innerHTML = `
            <div class="story-bg" id="story-bg"></div>
            <div class="story-chars" id="story-chars"></div>
            <div class="story-vfx" id="story-vfx"></div>
            <div class="story-textbox" id="story-textbox">
                <div class="story-speaker" id="story-speaker"></div>
                <div class="story-text" id="story-text"></div>
                <div class="story-tap-hint" id="story-tap-hint">▼ Nhấn để tiếp tục</div>
            </div>
            <div class="story-choices" id="story-choices"></div>
            ${this._isAdmin ? '<button class="story-skip-btn" onclick="StoryViewer.skip()">⏭ Bỏ qua</button>' : ''}
            <div class="story-chapter-title" id="story-chapter-title"></div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add('story-active');
        this._overlay = overlay;

        // Audio controls
        if (typeof StoryAudio !== 'undefined') {
            const audioControls = StoryAudio.createControlsUI();
            overlay.appendChild(audioControls);
            StoryAudio.init();
            // Start BGM with chapter mood
            const mood = this._chapter.bgm_mood || 'mystical';
            StoryAudio.startBGM(mood);
        }

        // Click/tap to advance
        overlay.addEventListener('click', (e) => {
            if (e.target.closest('.story-choices') || e.target.closest('.story-skip-btn') ||
                e.target.closest('.story-puzzle-btn') || e.target.closest('#story-audio-controls')) return;
            this._advance();
        });

        // Show chapter title
        this._showChapterTitle();
    },

    _showChapterTitle() {
        const el = document.getElementById('story-chapter-title');
        if (!el || !this._chapter) return;

        const ch = this._chapter;
        el.innerHTML = `
            <div class="story-chapter-icon">${ch.icon || '📖'}</div>
            <div class="story-chapter-label">Chương ${ch.chapter_id}</div>
            <div class="story-chapter-name">${ch.title}</div>
            <div class="story-chapter-era">${ch.era || ''}</div>
        `;
        el.classList.add('visible');

        setTimeout(() => {
            el.classList.remove('visible');
            el.classList.add('hidden');
        }, 3000);
    },

    _playScene(idx) {
        if (!this._chapter || idx >= this._chapter.scenes.length) {
            this._endChapter();
            return;
        }

        this._sceneIndex = idx;
        this._dialogueIndex = 0;
        this._currentScene = this._chapter.scenes[idx];

        // Save scene progress to backend
        this._saveSceneProgress(this._chapter.chapter_id, idx);

        // Daily gate: after saving, if this isn't the first scene and
        // user already viewed one scene today, stop here and show message
        // (Backend will handle the gate; this is a client-side UX guard)
        const scene = this._currentScene;

        // Apply background
        const bg = document.getElementById('story-bg');
        if (bg && scene.background) {
            // Use gradient colors as fallback, images when available
            const bgMap = {
                classroom_chess: 'linear-gradient(180deg, #2c1810 0%, #4a2c1a 50%, #6b3a20 100%)',
                mythical_sea_mountain: 'linear-gradient(180deg, #0a1628 0%, #1a3a5c 40%, #2d6a4f 70%, #40916c 100%)',
                dark_forest: 'linear-gradient(180deg, #0d1117 0%, #1a2332 40%, #2d3a2e 70%, #1a2332 100%)',
                boss_arena_forest: 'linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 30%, #4a1942 60%, #1a0a2e 100%)',
                golden_light: 'linear-gradient(180deg, #ffd700 0%, #ffed4a 30%, #fff5cc 60%, #ffd700 100%)',
                reunion: 'linear-gradient(180deg, #1a3066 0%, #2d5498 30%, #4a90d9 60%, #87ceeb 100%)',
                hundred_eggs: 'linear-gradient(180deg, #ffecd2 0%, #fcb69f 30%, #ff8a65 60%, #e64a19 100%)'
            };
            bg.style.background = bgMap[scene.background] || bgMap.classroom_chess;

            if (scene.background_image) {
                bg.style.backgroundImage = `url(${scene.background_image})`;
                bg.style.backgroundSize = 'cover';
                bg.style.backgroundPosition = 'center';
            }
        }

        // Apply VFX
        const vfx = document.getElementById('story-vfx');
        if (vfx) {
            vfx.innerHTML = '';
            if (scene.vfx === 'sparkle') {
                vfx.innerHTML = Array.from({ length: 15 }, (_, i) =>
                    `<div class="story-sparkle" style="--i:${i};--x:${Math.random() * 100}%;--y:${Math.random() * 100}%;--d:${Math.random() * 3 + 1}s"></div>`
                ).join('');
            } else if (scene.vfx === 'dark') {
                vfx.innerHTML = '<div class="story-vfx-dark"></div>';
            } else if (scene.vfx === 'shake') {
                this._overlay?.classList.add('story-shake');
                setTimeout(() => this._overlay?.classList.remove('story-shake'), 500);
            }
        }

        // Show characters
        this._updateCharacters(scene.characters || []);

        // Change BGM mood based on scene
        if (typeof StoryAudio !== 'undefined' && scene.bgm_mood) {
            StoryAudio.changeMood(scene.bgm_mood);
        }

        // Play first dialogue
        this._showDialogue();
    },

    _updateCharacters(chars) {
        const el = document.getElementById('story-chars');
        if (!el) return;

        const charIcons = {
            su_phu: { icon: '🧙‍♂️', name: 'Sư Phụ Bạch Tượng', color: '#e0e0e0' },
            lac_long_quan: { icon: '🐉', name: 'Lạc Long Quân', color: '#4fc3f7' },
            au_co: { icon: '🧚', name: 'Âu Cơ', color: '#f48fb1' },
            moc_tinh: { icon: '🌳', name: 'Mộc Tinh', color: '#66bb6a' },
            tieu_long: { icon: '🐲', name: 'Tiểu Long', color: '#ffb74d' },
            narrator: { icon: '', name: 'Người kể chuyện', color: '#90a4ae' }
        };

        el.innerHTML = chars.map(c => {
            const info = charIcons[c.id] || { icon: '👤', name: c.id, color: '#ccc' };
            const pos = c.position === 'left' ? 'story-char-left' :
                c.position === 'right' ? 'story-char-right' : 'story-char-center';
            const emotion = c.emotion || 'neutral';

            return `
                <div class="story-char ${pos}" data-char="${c.id}" data-emotion="${emotion}">
                    <div class="story-char-sprite">${info.icon}</div>
                    <div class="story-char-glow" style="--glow-color:${info.color}"></div>
                </div>
            `;
        }).join('');
    },

    _showDialogue() {
        const scene = this._currentScene;
        if (!scene) return;

        const dialogues = scene.dialogues || [];

        // Check if we've finished all dialogues
        if (this._dialogueIndex >= dialogues.length) {
            // Check for choices
            if (scene.choices && scene.choices.length > 0) {
                this._showChoices(scene.choices);
                return;
            }
            // Check for puzzle trigger
            if (scene.puzzle_set_id) {
                this._triggerPuzzle(scene);
                return;
            }
            // Move to next scene
            this._playScene(this._sceneIndex + 1);
            return;
        }

        const d = dialogues[this._dialogueIndex];
        this._isAnimating = true;

        // Update characters if specified
        if (d.characters) {
            this._updateCharacters(d.characters);
        }

        // Highlight speaking character
        document.querySelectorAll('.story-char').forEach(el => {
            el.classList.remove('speaking');
            if (el.dataset.char === d.char) {
                el.classList.add('speaking');
                if (d.emotion) el.dataset.emotion = d.emotion;
            }
        });

        // Update speaker name
        const speakerEl = document.getElementById('story-speaker');
        const charNames = {
            su_phu: 'Sư Phụ Bạch Tượng',
            lac_long_quan: 'Lạc Long Quân',
            au_co: 'Âu Cơ',
            moc_tinh: 'Mộc Tinh',
            tieu_long: 'Tiểu Long',
            narrator: ''
        };
        const charColors = {
            su_phu: '#e0e0e0', lac_long_quan: '#4fc3f7', au_co: '#f48fb1',
            moc_tinh: '#66bb6a', tieu_long: '#ffb74d', narrator: '#90a4ae'
        };
        if (speakerEl) {
            const name = charNames[d.char] || d.char || '';
            speakerEl.textContent = name;
            speakerEl.style.color = charColors[d.char] || '#fff';
            speakerEl.style.display = name ? 'block' : 'none';
        }

        // Typewriter effect for text
        const textEl = document.getElementById('story-text');
        const hintEl = document.getElementById('story-tap-hint');
        if (textEl) {
            // Replace {player} with actual name
            const rawText = (d.text || '').replace(/\{player\}/g, this._playerName);
            textEl.textContent = '';
            hintEl.style.opacity = '0';

            let i = 0;
            const typeSpeed = 25;
            const typeInterval = setInterval(() => {
                if (i < rawText.length) {
                    textEl.textContent += rawText[i];
                    i++;
                } else {
                    clearInterval(typeInterval);
                    this._isAnimating = false;
                    hintEl.style.opacity = '1';
                }
            }, typeSpeed);

            // Store interval to cancel on skip
            this._typeInterval = typeInterval;
            this._fullText = rawText;

            // TTS narration
            if (typeof StoryAudio !== 'undefined') {
                StoryAudio.speak(rawText, d.char || 'narrator');
            }
        }

        // Apply scene VFX if dialogue has it
        if (d.vfx === 'shake') {
            this._overlay?.classList.add('story-shake');
            setTimeout(() => this._overlay?.classList.remove('story-shake'), 500);
        }
    },

    _advance() {
        if (this._isAnimating) {
            // Only admin can skip typewriter animation
            if (!this._isAdmin) return;
            // Skip typewriter — show full text immediately
            clearInterval(this._typeInterval);
            const textEl = document.getElementById('story-text');
            const hintEl = document.getElementById('story-tap-hint');
            if (textEl) textEl.textContent = this._fullText || '';
            if (hintEl) hintEl.style.opacity = '1';
            this._isAnimating = false;
            return;
        }

        this._dialogueIndex++;
        // Stop current TTS when advancing
        if (typeof StoryAudio !== 'undefined') {
            StoryAudio.stopTTS();
            StoryAudio.playSfx('page_turn');
        }
        this._showDialogue();
    },

    _showChoices(choices) {
        const el = document.getElementById('story-choices');
        if (!el) return;

        const textbox = document.getElementById('story-textbox');
        if (textbox) textbox.style.display = 'none';

        el.innerHTML = choices.map((c, i) => `
            <button class="story-choice-btn" onclick="StoryViewer._selectChoice(${i})">
                ${c.text.replace(/\{player\}/g, this._playerName)}
            </button>
        `).join('');
        el.style.display = 'flex';
    },

    _selectChoice(idx) {
        const scene = this._currentScene;
        const choice = scene.choices[idx];
        const choicesEl = document.getElementById('story-choices');
        const textbox = document.getElementById('story-textbox');

        if (choicesEl) choicesEl.style.display = 'none';
        if (textbox) textbox.style.display = 'block';

        // If choice has response dialogues, play them before next scene
        if (choice.response) {
            this._currentScene = {
                ...this._currentScene,
                dialogues: Array.isArray(choice.response) ? choice.response : [choice.response],
                choices: null
            };
            this._dialogueIndex = 0;
            this._showDialogue();
        } else {
            // Go to next scene (or specified scene)
            const nextIdx = choice.next_scene !== undefined ? choice.next_scene : this._sceneIndex + 1;
            this._playScene(nextIdx);
        }
    },

    _triggerPuzzle(scene) {
        const textbox = document.getElementById('story-textbox');
        if (textbox) textbox.style.display = 'none';

        // SFX for puzzle start
        if (typeof StoryAudio !== 'undefined') {
            StoryAudio.stopTTS();
            StoryAudio.playSfx('puzzle_start');
        }

        const choicesEl = document.getElementById('story-choices');
        if (choicesEl) {
            choicesEl.innerHTML = `
                <div class="story-puzzle-intro">
                    <div class="story-puzzle-icon">🧩</div>
                    <div class="story-puzzle-label">${scene.puzzle_intro || 'Giải thế cờ để tiếp tục!'}</div>
                    <button class="story-puzzle-btn" onclick="StoryViewer._startPuzzle(${scene.puzzle_set_id})">
                        ⚔️ Bắt Đầu Trận Đấu
                    </button>
                </div>
            `;
            choicesEl.style.display = 'flex';
        }
    },

    async _startPuzzle(puzzleSetId) {
        if (!puzzleSetId) {
            Toast.warning('🧩 Chưa có puzzle gán cho cảnh này!');
            this._playScene(this._sceneIndex + 1);
            return;
        }

        try {
            // Hide story overlay (but keep it in DOM)
            if (this._overlay) this._overlay.style.display = 'none';

            const data = await API.get(`/puzzles/sets/${puzzleSetId}`);
            const solveMode = data.puzzle_set?.solve_mode || 'basic';

            // Store data for retry reference
            this._currentPuzzleData = data;
            this._currentPuzzleSetId = puzzleSetId;

            ChessBoardComponent.mount({
                pgnSource: data,
                mode: solveMode,
                isEloRated: true,
                fullscreen: true,
                startFromZero: true, // Story mode: always start from puzzle 0
                theme: data.puzzle_set?.theme || null,
                config: {
                    playerGoesFirst: data.puzzle_set.play_mode !== 'second',
                    memoryTimeSec: 8,
                    maxMistakes: 3
                },
                onComplete: (result) => {
                    // Show story overlay again
                    if (this._overlay) this._overlay.style.display = '';
                    document.body.classList.remove('cbc-no-scroll');
                    const choicesEl = document.getElementById('story-choices');

                    // Check if user solved all puzzles
                    const totalPuzzles = data.puzzles?.length || 1;
                    const puzzlesSolved = result.puzzlesSolved || 0;
                    const allSolved = puzzlesSolved >= totalPuzzles;

                    if (allSolved) {
                        // SUCCESS — advance to next scene
                        if (choicesEl) choicesEl.style.display = 'none';
                        const textbox = document.getElementById('story-textbox');
                        if (textbox) textbox.style.display = 'block';
                        Toast.success('🎉 Xuất sắc! Tiếp tục câu chuyện...');
                        this._playScene(this._sceneIndex + 1);
                    } else {
                        // NOT COMPLETED — show retry prompt
                        if (choicesEl) {
                            choicesEl.innerHTML = `
                                <div class="story-puzzle-intro">
                                    <div class="story-puzzle-icon">🧩</div>
                                    <div class="story-puzzle-label">Bạn cần giải hết tất cả puzzle để tiếp tục! (${puzzlesSolved}/${totalPuzzles})</div>
                                    <button class="story-puzzle-btn" onclick="StoryViewer._startPuzzle(${puzzleSetId})">
                                        🔄 Thử Lại
                                    </button>
                                </div>
                            `;
                            choicesEl.style.display = 'flex';
                        }
                    }
                },
                containerEl: 'cbc-container'
            });

            // CRITICAL: Fix z-index + skip start screen (already confirmed from story)
            setTimeout(() => {
                // Bump CBC fullscreen overlay above story
                const cbcOverlay = document.getElementById('cbc-fullscreen-overlay');
                if (cbcOverlay) cbcOverlay.style.zIndex = '999999';

                // Also bump start overlay if it exists
                const startOverlay = document.getElementById('cbc-start-overlay');
                if (startOverlay) startOverlay.style.zIndex = '9999999';

                // Auto-click the start button — skip start screen since user already pressed "Bắt Đầu Trận Đấu" in story
                // This directly calls _startFromOverlay which removes start screen and calls loadPuzzle
                ChessBoardComponent._startFromOverlay();
            }, 100);

        } catch (err) {
            Toast.error(err.message || 'Lỗi tải puzzle');
            if (this._overlay) this._overlay.style.display = '';
        }
    },

    _endChapter() {
        // Show rewards screen
        const ch = this._chapter;
        if (!ch) { this.close(); return; }

        const vfx = document.getElementById('story-vfx');
        if (vfx) {
            vfx.innerHTML = Array.from({ length: 20 }, (_, i) =>
                `<div class="story-sparkle" style="--i:${i};--x:${Math.random() * 100}%;--y:${Math.random() * 100}%;--d:${Math.random() * 3 + 1}s"></div>`
            ).join('');
        }

        const textbox = document.getElementById('story-textbox');
        if (textbox) textbox.style.display = 'none';

        const choicesEl = document.getElementById('story-choices');
        if (choicesEl) {
            const rewards = ch.rewards || {};
            choicesEl.innerHTML = `
                <div class="story-end-screen">
                    <div class="story-end-icon">${ch.icon || '📖'}</div>
                    <div class="story-end-label">Hoàn Thành Chương ${ch.chapter_id}</div>
                    <div class="story-end-title">${ch.title}</div>
                    ${rewards.stars ? `<div class="story-end-reward">⭐ +${rewards.stars} Sao</div>` : ''}
                    ${rewards.item ? `<div class="story-end-reward">${rewards.item_icon || '🎁'} ${rewards.item}</div>` : ''}
                    ${rewards.collection ? `<div class="story-end-reward">📜 Mở khóa: ${rewards.collection}</div>` : ''}
                    <button class="story-end-btn" onclick="StoryViewer.close()">
                        ✨ Tiếp Tục Hành Trình ✨
                    </button>
                </div>
            `;
            choicesEl.style.display = 'flex';
        }

        // Save progress
        this._saveProgress(ch.chapter_id);
    },

    async _saveProgress(chapterId) {
        try {
            await API.post('/gamification/story/complete', { chapter_id: chapterId });
        } catch (e) {
            // Silently fail — progress saving is optional
        }
    },

    async _saveSceneProgress(chapterId, sceneIndex) {
        try {
            await API.post('/gamification/story/scene-complete', {
                chapter_id: chapterId,
                scene_index: sceneIndex
            });
        } catch (e) {
            // If server rejects (daily limit), show message but allow reading current scene
            if (e.status === 429) {
                // Will be handled on next scene transition
            }
        }
    },

    skip() {
        if (confirm('Bạn có muốn bỏ qua chương truyện này?')) {
            this.close();
        }
    },

    close() {
        if (this._typeInterval) clearInterval(this._typeInterval);

        // Stop all audio
        if (typeof StoryAudio !== 'undefined') {
            StoryAudio.destroy();
        }

        if (this._overlay) {
            this._overlay.classList.add('story-fadeout');
            setTimeout(() => {
                this._overlay?.remove();
                this._overlay = null;
            }, 400);
        }
        document.body.classList.remove('story-active');
        this._chapter = null;
        this._currentScene = null;

        if (this._onComplete) {
            this._onComplete();
            this._onComplete = null;
        }
    }
};
