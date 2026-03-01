/**
 * StoryAudio — Background Music + TTS Engine for Story Viewer
 * Uses Web Audio API for ambient music synthesis & Web Speech API for narration
 */
const StoryAudio = {
    // State
    _audioCtx: null,
    _bgmNodes: [],
    _bgmGain: null,
    _masterGain: null,
    _isPlaying: false,
    _bgmMuted: false,
    _ttsMuted: false,
    _ttsVoice: null,
    _ttsRate: 0.95,
    _currentUtterance: null,
    _bgmVolume: 0.25,
    _sfxEnabled: true,

    // ══════════════════════════════════════
    // INIT
    // ══════════════════════════════════════
    init() {
        if (this._audioCtx) return;
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Master gain
        this._masterGain = this._audioCtx.createGain();
        this._masterGain.gain.value = 1.0;
        this._masterGain.connect(this._audioCtx.destination);

        // BGM gain
        this._bgmGain = this._audioCtx.createGain();
        this._bgmGain.gain.value = this._bgmVolume;
        this._bgmGain.connect(this._masterGain);

        // Pre-select Vietnamese TTS voice
        this._selectVietnameseVoice();
        // Voices might load async
        if ('speechSynthesis' in window) {
            speechSynthesis.onvoiceschanged = () => this._selectVietnameseVoice();
        }
    },

    _selectVietnameseVoice() {
        if (!('speechSynthesis' in window)) return;
        const voices = speechSynthesis.getVoices();
        // Prefer Vietnamese voice
        this._ttsVoice = voices.find(v => v.lang.startsWith('vi')) ||
            voices.find(v => v.lang === 'vi-VN') ||
            voices.find(v => v.name.toLowerCase().includes('viet')) ||
            null;
    },

    // ══════════════════════════════════════
    // BACKGROUND MUSIC — Ambient Synthesizer
    // ══════════════════════════════════════
    startBGM(mood = 'mystical') {
        if (this._isPlaying) this.stopBGM();
        if (!this._audioCtx) this.init();
        if (this._audioCtx.state === 'suspended') this._audioCtx.resume();

        this._isPlaying = true;
        const ctx = this._audioCtx;

        // Mood-based chord progressions (frequencies in Hz)
        const moods = {
            mystical: {
                chords: [
                    [130.81, 196.00, 261.63, 329.63],  // C  - Am feel
                    [146.83, 220.00, 293.66, 369.99],  // D  - Dm feel
                    [123.47, 185.00, 246.94, 311.13],  // B  - Em feel
                    [110.00, 164.81, 220.00, 277.18],  // A  - Am
                ],
                tempo: 8000, // ms per chord
                type: 'sine',
                filterFreq: 800,
            },
            epic: {
                chords: [
                    [130.81, 164.81, 196.00, 261.63],  // C major
                    [146.83, 174.61, 220.00, 293.66],  // D minor
                    [164.81, 196.00, 246.94, 329.63],  // E minor
                    [174.61, 220.00, 261.63, 349.23],  // F major
                ],
                tempo: 6000,
                type: 'triangle',
                filterFreq: 1200,
            },
            peaceful: {
                chords: [
                    [130.81, 196.00, 261.63, 392.00],  // C
                    [110.00, 164.81, 220.00, 329.63],  // Am
                    [174.61, 220.00, 261.63, 349.23],  // F
                    [146.83, 196.00, 246.94, 392.00],  // G
                ],
                tempo: 10000,
                type: 'sine',
                filterFreq: 600,
            },
            dark: {
                chords: [
                    [110.00, 130.81, 164.81, 220.00],  // Am dark
                    [103.83, 123.47, 155.56, 207.65],  // Ab dim
                    [116.54, 138.59, 174.61, 233.08],  // Bb
                    [98.00, 123.47, 146.83, 196.00],   // G dark
                ],
                tempo: 9000,
                type: 'sine',
                filterFreq: 500,
            }
        };

        const bgm = moods[mood] || moods.mystical;
        let chordIdx = 0;

        // Low-pass filter for dreamy sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = bgm.filterFreq;
        filter.Q.value = 2;
        filter.connect(this._bgmGain);

        // Reverb using convolver (simple)
        const convolver = ctx.createConvolver();
        const reverbLen = ctx.sampleRate * 2;
        const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = reverbBuf.getChannelData(ch);
            for (let i = 0; i < reverbLen; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLen, 2.5);
            }
        }
        convolver.buffer = reverbBuf;
        convolver.connect(filter);

        // Dry signal
        const dryGain = ctx.createGain();
        dryGain.gain.value = 0.6;
        dryGain.connect(filter);

        // Wet signal (reverb)
        const wetGain = ctx.createGain();
        wetGain.gain.value = 0.4;
        wetGain.connect(convolver);

        this._bgmFilter = filter;
        this._bgmDry = dryGain;
        this._bgmWet = wetGain;

        const playChord = () => {
            if (!this._isPlaying) return;

            const freqs = bgm.chords[chordIdx % bgm.chords.length];
            chordIdx++;

            freqs.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                osc.type = bgm.type;
                osc.frequency.value = freq;

                // Slight detune for richness
                osc.detune.value = (Math.random() - 0.5) * 8;

                const env = ctx.createGain();
                env.gain.value = 0;

                // ADSR envelope
                const now = ctx.currentTime;
                const attackTime = 1.5;
                const sustainTime = bgm.tempo / 1000 - 3;
                const releaseTime = 1.5;

                env.gain.setValueAtTime(0, now);
                env.gain.linearRampToValueAtTime(0.15 / freqs.length, now + attackTime);
                env.gain.setValueAtTime(0.15 / freqs.length, now + attackTime + sustainTime);
                env.gain.linearRampToValueAtTime(0, now + attackTime + sustainTime + releaseTime);

                osc.connect(env);
                env.connect(dryGain);
                env.connect(wetGain);

                osc.start(now + i * 0.1); // Stagger entries slightly
                osc.stop(now + attackTime + sustainTime + releaseTime + 0.1);

                this._bgmNodes.push(osc);
            });

            // Add a sub-bass note
            const subOsc = ctx.createOscillator();
            subOsc.type = 'sine';
            subOsc.frequency.value = freqs[0] / 2;
            const subEnv = ctx.createGain();
            subEnv.gain.value = 0;
            const now = ctx.currentTime;
            subEnv.gain.setValueAtTime(0, now);
            subEnv.gain.linearRampToValueAtTime(0.08, now + 2);
            subEnv.gain.setValueAtTime(0.08, now + bgm.tempo / 1000 - 2);
            subEnv.gain.linearRampToValueAtTime(0, now + bgm.tempo / 1000);
            subOsc.connect(subEnv);
            subEnv.connect(dryGain);
            subOsc.start(now);
            subOsc.stop(now + bgm.tempo / 1000 + 0.1);
            this._bgmNodes.push(subOsc);

            // Schedule next chord
            this._bgmTimer = setTimeout(playChord, bgm.tempo);
        };

        playChord();
    },

    stopBGM() {
        this._isPlaying = false;
        if (this._bgmTimer) clearTimeout(this._bgmTimer);

        // Fade out
        if (this._bgmGain && this._audioCtx) {
            const now = this._audioCtx.currentTime;
            this._bgmGain.gain.setValueAtTime(this._bgmGain.gain.value, now);
            this._bgmGain.gain.linearRampToValueAtTime(0, now + 1);

            setTimeout(() => {
                this._bgmNodes.forEach(n => { try { n.stop(); } catch (e) { } });
                this._bgmNodes = [];
                if (this._bgmGain) this._bgmGain.gain.value = this._bgmVolume;
            }, 1100);
        }
    },

    setBGMVolume(vol) {
        this._bgmVolume = Math.max(0, Math.min(1, vol));
        if (this._bgmGain) {
            this._bgmGain.gain.value = this._bgmMuted ? 0 : this._bgmVolume;
        }
    },

    toggleBGM() {
        this._bgmMuted = !this._bgmMuted;
        if (this._bgmGain) {
            this._bgmGain.gain.value = this._bgmMuted ? 0 : this._bgmVolume;
        }
        return !this._bgmMuted;
    },

    // Change mood dynamically (e.g., when scene changes)
    changeMood(mood) {
        if (this._isPlaying) {
            this.stopBGM();
            setTimeout(() => this.startBGM(mood), 1200);
        }
    },

    // ══════════════════════════════════════
    // TEXT-TO-SPEECH (TTS)
    // ══════════════════════════════════════
    speak(text, charId = 'narrator') {
        if (this._ttsMuted) return;
        if (!('speechSynthesis' in window)) return;

        // Cancel previous speech
        this.stopTTS();

        // Clean text for reading
        const cleanText = text
            .replace(/\{player\}/g, 'bạn')
            .replace(/[🎯⚔️🏰🐉🧙‍♂️🧚🌳🐲📖🎉🧩✅❌💡⬛⬜🔄🚀🎨💪⚡🌟🗡️🛡️♟️👑🃏]/g, '')
            .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'vi-VN';
        utterance.rate = this._ttsRate;
        utterance.pitch = this._getCharPitch(charId);
        utterance.volume = 0.9;

        if (this._ttsVoice) {
            utterance.voice = this._ttsVoice;
        }

        // Slightly lower BGM volume during speech
        if (this._bgmGain && this._audioCtx && !this._bgmMuted) {
            const now = this._audioCtx.currentTime;
            this._bgmGain.gain.setValueAtTime(this._bgmGain.gain.value, now);
            this._bgmGain.gain.linearRampToValueAtTime(this._bgmVolume * 0.4, now + 0.3);
        }

        utterance.onend = () => {
            this._currentUtterance = null;
            // Restore BGM volume
            if (this._bgmGain && this._audioCtx && !this._bgmMuted) {
                const now = this._audioCtx.currentTime;
                this._bgmGain.gain.setValueAtTime(this._bgmGain.gain.value, now);
                this._bgmGain.gain.linearRampToValueAtTime(this._bgmVolume, now + 0.5);
            }
        };

        this._currentUtterance = utterance;
        speechSynthesis.speak(utterance);
    },

    _getCharPitch(charId) {
        // Different pitch for different characters
        const pitches = {
            su_phu: 0.85,       // Deep, wise
            lac_long_quan: 0.75, // Very deep, godly
            au_co: 1.3,         // Higher, feminine
            moc_tinh: 0.7,      // Very deep, monstrous
            tieu_long: 1.1,     // Young, energetic
            narrator: 1.0,      // Neutral
        };
        return pitches[charId] || 1.0;
    },

    stopTTS() {
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
        }
        this._currentUtterance = null;
    },

    toggleTTS() {
        this._ttsMuted = !this._ttsMuted;
        if (this._ttsMuted) this.stopTTS();
        return !this._ttsMuted;
    },

    setTTSRate(rate) {
        this._ttsRate = Math.max(0.5, Math.min(2.0, rate));
    },

    // ══════════════════════════════════════
    // SOUND EFFECTS
    // ══════════════════════════════════════
    playSfx(type) {
        if (!this._audioCtx || !this._sfxEnabled) return;
        if (this._audioCtx.state === 'suspended') this._audioCtx.resume();

        const ctx = this._audioCtx;
        const now = ctx.currentTime;

        if (type === 'page_turn') {
            // Soft whoosh
            const noise = ctx.createBufferSource();
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
            }
            noise.buffer = buf;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.05, now);
            noiseGain.gain.linearRampToValueAtTime(0, now + 0.3);
            const hpf = ctx.createBiquadFilter();
            hpf.type = 'highpass';
            hpf.frequency.value = 2000;
            noise.connect(hpf);
            hpf.connect(noiseGain);
            noiseGain.connect(this._masterGain);
            noise.start(now);
            noise.stop(now + 0.3);
        } else if (type === 'choice') {
            // Soft chime
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 880;
            const env = ctx.createGain();
            env.gain.setValueAtTime(0.1, now);
            env.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.connect(env);
            env.connect(this._masterGain);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'puzzle_start') {
            // Rising tone
            [523, 659, 784].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0, now + i * 0.15);
                env.gain.linearRampToValueAtTime(0.08, now + i * 0.15 + 0.05);
                env.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.3);
                osc.connect(env);
                env.connect(this._masterGain);
                osc.start(now + i * 0.15);
                osc.stop(now + i * 0.15 + 0.35);
            });
        } else if (type === 'chapter_complete') {
            // Victory fanfare
            [523, 659, 784, 1047].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0, now + i * 0.2);
                env.gain.linearRampToValueAtTime(0.12, now + i * 0.2 + 0.05);
                env.gain.linearRampToValueAtTime(0.06, now + i * 0.2 + 0.5);
                env.gain.linearRampToValueAtTime(0, now + i * 0.2 + 1.0);
                osc.connect(env);
                env.connect(this._masterGain);
                osc.start(now + i * 0.2);
                osc.stop(now + i * 0.2 + 1.1);
            });
        }
    },

    // ══════════════════════════════════════
    // UI CONTROLS
    // ══════════════════════════════════════
    createControlsUI() {
        // Remove existing
        document.getElementById('story-audio-controls')?.remove();

        const el = document.createElement('div');
        el.id = 'story-audio-controls';
        el.innerHTML = `
            <button class="story-audio-btn" id="story-bgm-toggle" onclick="StoryAudio._toggleBGMUI()" title="Nhạc nền">
                🎵
            </button>
            <button class="story-audio-btn" id="story-tts-toggle" onclick="StoryAudio._toggleTTSUI()" title="Giọng đọc">
                🗣️
            </button>
            <input type="range" class="story-volume-slider" id="story-bgm-volume" 
                min="0" max="100" value="25" 
                oninput="StoryAudio.setBGMVolume(this.value/100)"
                title="Âm lượng nhạc nền">
        `;
        return el;
    },

    _toggleBGMUI() {
        const on = this.toggleBGM();
        const btn = document.getElementById('story-bgm-toggle');
        if (btn) {
            btn.textContent = on ? '🎵' : '🔇';
            btn.classList.toggle('muted', !on);
        }
    },

    _toggleTTSUI() {
        const on = this.toggleTTS();
        const btn = document.getElementById('story-tts-toggle');
        if (btn) {
            btn.textContent = on ? '🗣️' : '🤐';
            btn.classList.toggle('muted', !on);
        }
    },

    // ══════════════════════════════════════
    // CLEANUP
    // ══════════════════════════════════════
    destroy() {
        this.stopBGM();
        this.stopTTS();
        if (this._bgmTimer) clearTimeout(this._bgmTimer);
        this._bgmNodes.forEach(n => { try { n.stop(); } catch (e) { } });
        this._bgmNodes = [];
        document.getElementById('story-audio-controls')?.remove();
    }
};
