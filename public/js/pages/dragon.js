/**
 * Dragon Page — Hang Rồng / Dragon Den
 * Multi-dragon support with element system and formation management
 */
const DragonPage = {
    dragonData: null,
    selectedDragonIdx: 0,
    _pendingFormation: {},

    async open() {
        try {
            const data = await API.get('/dragon/me');
            this.dragonData = data;

            if (!data.dragon) {
                this.showHatchModal();
                return;
            }

            this.showDragonDen(data);
        } catch (err) {
            Toast.error(err.message);
        }
    },

    showHatchModal() {
        Modal.create({
            id: 'dragon-hatch-modal',
            title: 'Hang Rồng',
            icon: '🐉',
            content: `
                <div style="text-align:center;padding:20px;">
                    <div class="dragon-egg">🥚</div>
                    <h3 style="margin:16px 0;">Bạn tìm thấy một quả trứng rồng!</h3>
                    <p style="color:var(--text-secondary);">Đặt tên cho rồng con của bạn nhé!</p>
                    <input type="text" id="dragon-name-input" class="form-input"
                           placeholder="Nhập tên rồng..." value="Rồng Con"
                           style="max-width:300px;margin:16px auto;text-align:center;" />
                    <br>
                    <button class="btn btn-primary btn-lg" onclick="DragonPage.hatch()"
                            style="margin-top:12px;">
                        🐣 Ấp Trứng!
                    </button>
                </div>
                <style>
                    .dragon-egg {
                        font-size: 5rem;
                        animation: eggBounce 1s ease-in-out infinite;
                    }
                    @keyframes eggBounce {
                        0%,100% { transform: rotate(-8deg) translateY(0); }
                        25% { transform: rotate(8deg) translateY(-10px); }
                        50% { transform: rotate(-5deg) translateY(0); }
                        75% { transform: rotate(5deg) translateY(-5px); }
                    }
                </style>
            `
        });
        Modal.show('dragon-hatch-modal');
    },

    async hatch() {
        const name = document.getElementById('dragon-name-input')?.value || 'Rồng Con';
        try {
            const result = await API.post('/dragon/create', { name });
            Modal.hide('dragon-hatch-modal');

            Celebration.show({
                icon: '🐉',
                title: '🎉 Rồng đã nở!',
                subtitle: `${name} — ${result.element_name}!`,
                duration: 3000
            });

            setTimeout(() => this.open(), 1500);
        } catch (err) {
            Toast.error(err.message);
        }
    },

    // Element emoji for CSS-based dragon visuals
    elementDragonIcon(element) {
        const icons = {
            metal: '🤖', wood: '🌿', water: '🐳', fire: '🔥', earth: '🗿',
            light: '✨', dark: '🌑'
        };
        return icons[element] || '🐉';
    },

    dragonImage(element) {
        return `/img/dragons/dragon_${element || 'fire'}.png`;
    },

    elementGradient(element) {
        const grads = {
            metal: 'linear-gradient(135deg, #C0C0C0, #95A5A6, #7F8C8D)',
            wood: 'linear-gradient(135deg, #2ECC71, #27AE60, #1ABC9C)',
            water: 'linear-gradient(135deg, #3498DB, #2980B9, #1ABC9C)',
            fire: 'linear-gradient(135deg, #E74C3C, #C0392B, #E67E22)',
            earth: 'linear-gradient(135deg, #D4A574, #B8860B, #8B7355)',
            light: 'linear-gradient(135deg, #F1C40F, #FFD700, #FFA500)',
            dark: 'linear-gradient(135deg, #8E44AD, #6C3483, #2C3E50)'
        };
        return grads[element] || grads.fire;
    },

    async showDragonDen(data) {
        const dragons = data.dragons || [data.dragon];
        const d = dragons[this.selectedDragonIdx] || dragons[0];
        const equipped = (data.equipped_by_dragon || {})[d.id] || {};
        const formations = data.formations || [];
        const elementNames = data.element_names || {};
        const elementColors = data.element_colors || {};
        const activeBuffs = data.active_buffs || [];
        const expPct = Math.round((d.exp / (d.exp_needed || 1)) * 100);
        const maxHp = d.total_hp || d.hp || 0;
        const currentHp = d.current_hp || 0;
        const hpPct = maxHp > 0 ? Math.round((currentHp / maxHp) * 100) : 0;
        const ec = elementColors[d.element] || '#666';

        // Parse active buffs
        const hasAttBuff = activeBuffs.find(b => b.buff_type === 'att_boost_100');
        const hasDefBuff = activeBuffs.find(b => b.buff_type === 'def_boost_50');
        const getBuffRemain = (buff) => {
            if (!buff) return '';
            const remain = Math.max(0, Math.ceil((new Date(buff.expires_at) - Date.now()) / 3600000));
            return `${remain}h`;
        };

        let regenHtml = '';
        if (currentHp < maxHp && d.last_regen_at) {
            const lastRegen = new Date(d.last_regen_at).getTime();
            const nextRegen = lastRegen + 60000;
            const remainMs = nextRegen - Date.now();
            const regenAmt = Math.max(1, Math.floor((d.hp || maxHp) * 0.01));
            if (remainMs > 0) {
                const remainSec = Math.ceil(remainMs / 1000);
                regenHtml = `<div style="font-size:0.65rem;color:#2ecc71;margin-top:2px">⏱️ +${regenAmt} HP sau ${remainSec}s (1%/phút)</div>`;
            } else {
                regenHtml = `<div style="font-size:0.65rem;color:#2ecc71;margin-top:2px">⏱️ Tự hồi 1% HP mỗi phút</div>`;
            }
        }

        // Equipment bonuses from backend
        const eqB = d.eq_bonuses || { hp: 0, att: 0, def: 0, spd: 0, crit_rate: 0, crit_dmg: 0 };
        const totalAtt = d.total_att || d.att || 0;
        const totalDef = d.total_def || d.def_stat || 0;
        const totalSpd = d.total_spd || d.spd || 5;
        const totalCrit = parseFloat(d.total_crit_rate || d.crit_rate || 5);
        const totalCDmg = parseFloat(d.total_crit_dmg || d.crit_dmg || 150);
        const attBuffVal = hasAttBuff ? Math.floor(totalAtt * 0.5) : 0;
        const defBuffVal = hasDefBuff ? Math.floor(totalDef * 0.5) : 0;

        const fmtStat = (total, base, bonus) => {
            if (bonus <= 0) return `<b>${total}</b>`;
            return `<b>${total}</b> <span style="font-size:0.6rem;opacity:0.7">(${base}<span style="color:#2ecc71">+${bonus}</span>)</span>`;
        };
        const fmtStatPct = (total, base, bonus) => {
            if (bonus <= 0) return `<b>${total}%</b>`;
            return `<b>${total}%</b> <span style="font-size:0.6rem;opacity:0.7">(${base}<span style="color:#2ecc71">+${bonus}</span>)</span>`;
        };

        const hpBonus = eqB.hp;
        const attBonus = eqB.att + attBuffVal;
        const defBonus = eqB.def + defBuffVal;
        const spdBonus = eqB.spd;
        const critBonus = eqB.crit_rate;
        const cdmgBonus = eqB.crit_dmg;

        // Compact stats bar
        const miniStats = [
            { icon: '⚔️', val: fmtStat(totalAtt + attBuffVal, d.att || 0, attBonus), c: '#e67e22' },
            { icon: '🛡️', val: fmtStat(totalDef + defBuffVal, d.def_stat || 0, defBonus), c: '#3498db' },
            { icon: '💨', val: fmtStat(totalSpd, d.spd || 5, spdBonus), c: '#2ecc71' },
            { icon: '🎯', val: fmtStatPct(totalCrit.toFixed(1), parseFloat(d.crit_rate || 5).toFixed(1), critBonus > 0 ? critBonus.toFixed(1) : 0), c: '#9b59b6' },
            { icon: '💥', val: fmtStatPct(totalCDmg.toFixed(1), parseFloat(d.crit_dmg || 150).toFixed(1), cdmgBonus > 0 ? cdmgBonus.toFixed(1) : 0), c: '#e91e63' }
        ];
        const statsBarHTML = miniStats.map(s => `<div style="display:flex;align-items:center;gap:4px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.06);font-size:0.85rem">
            <span style="color:${s.c}">${s.icon}</span> ${s.val}
        </div>`).join('');

        // Equipment slots (2x3 grid)
        const eqSlots = [
            { key: 'hat', icon: '🎩', label: 'Mũ' }, { key: 'glasses', icon: '👓', label: 'Kính' },
            { key: 'sword', icon: '⚔️', label: 'Vũ khí' }, { key: 'armor', icon: '🛡️', label: 'Giáp' },
            { key: 'pants', icon: '👖', label: 'Quần' }, { key: 'shoes', icon: '👟', label: 'Giày' }
        ];
        const eqGridHTML = eqSlots.map(s => {
            const eq = equipped[s.key];
            const rc = eq ? this.rarityColor(eq.rarity) : 'rgba(100,100,100,0.3)';
            const rarityBg = eq ? `radial-gradient(circle at 50% 30%, ${rc}15, transparent 70%)` : 'none';
            return `<div onclick="DragonPage.showSlotEquipment('${s.key}')" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 4px;border-radius:10px;background:${eq ? `rgba(255,255,255,0.06)` : 'rgba(255,255,255,0.02)'};background-image:${rarityBg};border:2px ${eq ? 'solid' : 'dashed'} ${eq ? rc : 'rgba(255,215,0,0.35)'};cursor:pointer;transition:all 0.2s;position:relative;box-shadow:${eq ? `0 0 6px ${rc}30` : '0 0 4px rgba(255,215,0,0.08)'}" id="eq-grid-${s.key}" title="${eq ? `${eq.name}\n${this.getStatsList(eq).join(' · ')}` : s.label + ' - Trống'}">
                <div style="font-size:1.1rem;filter:${eq ? 'none' : 'grayscale(0.8) opacity(0.3)'}">${eq ? eq.icon : s.icon}</div>
                <div style="font-size:0.42rem;${eq ? `color:${rc};font-weight:600` : 'opacity:0.3'};margin-top:1px;text-align:center;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${eq ? eq.name : s.label}</div>
                ${eq && eq.star_level > 0 ? `<div style="position:absolute;bottom:1px;font-size:0.4rem;color:#FFD700">${this.starDisplay(eq.star_level)}</div>` : ''}
            </div>`;
        }).join('');

        // Buff icons (compact)
        let buffHTML = '';
        if (hasAttBuff || hasDefBuff) {
            buffHTML = `<div style="display:flex;gap:4px;margin-top:6px">
                ${hasAttBuff ? `<div style="padding:3px 8px;border-radius:6px;background:rgba(230,126,34,0.2);border:1px solid rgba(230,126,34,0.3);font-size:0.62rem;color:#e67e22">🔥 ATT+50% · ${getBuffRemain(hasAttBuff)}</div>` : ''}
                ${hasDefBuff ? `<div style="padding:3px 8px;border-radius:6px;background:rgba(52,152,219,0.2);border:1px solid rgba(52,152,219,0.3);font-size:0.62rem;color:#3498db">🛡️ DEF+50% · ${getBuffRemain(hasDefBuff)}</div>` : ''}
            </div>`;
        }

        // Dragon roster (horizontal scroll at bottom)
        const rosterHTML = dragons.map((dr, idx) => {
            const sel = idx === this.selectedDragonIdx;
            const drEc = elementColors[dr.element] || '#666';
            const drMaxHp = dr.total_hp || dr.hp || 0;
            const drHp = drMaxHp > 0 ? Math.round(((dr.current_hp || 0) / drMaxHp) * 100) : 0;
            return `<div onclick="DragonPage.selectDragon(${idx})" style="flex-shrink:0;width:72px;padding:6px 4px;border-radius:10px;cursor:pointer;text-align:center;border:2px solid ${sel ? drEc : 'transparent'};background:${sel ? `${drEc}18` : 'rgba(255,255,255,0.04)'};transition:all 0.2s;position:relative${sel ? ';box-shadow:0 0 12px ' + drEc + '30' : ''}">
                <img src="${this.dragonImage(dr.element)}" style="width:38px;height:38px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
                <div style="font-size:0.58rem;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${dr.name}</div>
                <div style="font-size:0.5rem;color:${drEc}">${elementNames[dr.element] || dr.element} Lv.${dr.level}</div>
                <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:2px;overflow:hidden"><div style="height:100%;width:${drHp}%;background:${drHp < 30 ? '#e74c3c' : '#2ecc71'};border-radius:2px"></div></div>
            </div>`;
        }).join('');

        // Formation HTML
        const formationHTML = this.renderFormationUI(dragons, formations, elementColors, elementNames);

        // Hero image (use _hero version if exists, fallback to regular)
        const heroImg = `/img/dragons/dragon_${d.element}_hero.png`;
        const fallbackImg = this.dragonImage(d.element);

        Modal.create({
            id: 'dragon-den-modal',
            title: `🐉 Hang Rồng`,
            icon: '',
            size: 'large',
            content: `
                <div style="display:flex;flex-direction:column;gap:0">
                    <!-- HERO SECTION: Dragon image + Stats overlay -->
                    <div style="position:relative;border-radius:16px;overflow:hidden;margin-bottom:8px;background:${this.elementGradient(d.element)};min-height:180px">
                        <!-- Large dragon image -->
                        <div class="dragon-display" style="display:flex;justify-content:center;align-items:center;padding:10px 0;position:relative;">
                            <img src="${heroImg}" onerror="this.src='${fallbackImg}';this.style.height='140px'" style="height:160px;object-fit:contain;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.5));animation:dragonFloat 3s ease-in-out infinite;cursor:pointer" onclick="DragonEffects.petDragon(this)" title="Vuốt ve rồng! 🐉">
                        </div>
                        <!-- Name + Level overlay -->
                        <div style="position:absolute;bottom:0;left:0;right:0;padding:8px 12px;background:linear-gradient(transparent,rgba(0,0,0,0.7))">
                            <div style="display:flex;align-items:end;justify-content:space-between">
                                <div>
                                    <div style="font-size:1.1rem;font-weight:800;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.5);display:inline">${d.name}</div>
                                    <span onclick="DragonPage.renameDragon(${d.id}, '${d.name.replace(/'/g, "\\'")}')" style="cursor:pointer;font-size:0.7rem;opacity:0.7;margin-left:4px;vertical-align:middle" title="Đổi tên rồng">✏️</span>
                                    <div style="font-size:0.7rem;color:rgba(255,255,255,0.85)">Lv.${d.level} · <span style="color:${ec}">${elementNames[d.element] || d.element}</span></div>
                                </div>
                                <div style="text-align:right">
                                    <div style="font-size:0.6rem;opacity:0.7;color:#fff">EXP</div>
                                    <div style="width:80px;height:5px;background:rgba(0,0,0,0.4);border-radius:3px;overflow:hidden"><div style="height:100%;width:${expPct}%;background:rgba(255,255,255,0.8);border-radius:3px"></div></div>
                                    <div style="font-size:0.5rem;color:rgba(255,255,255,0.6)">${d.exp}/${d.exp_needed || '?'} (${expPct}%)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- HP BAR -->
                    <div style="padding:4px 8px;border-radius:8px;background:rgba(255,255,255,0.04);margin-bottom:6px">
                        <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:2px">
                            <span>❤️ HP ${hpBonus > 0 ? `<span style="font-size:0.68rem;opacity:0.6">(${d.hp}<span style="color:#2ecc71">+${hpBonus}</span>)</span>` : ''}</span>
                            <span style="font-weight:700;color:${hpPct < 30 ? '#e74c3c' : hpPct < 60 ? '#f39c12' : '#2ecc71'}">${currentHp}/${maxHp}</span>
                        </div>
                        <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
                            <div style="height:100%;width:${hpPct}%;background:${hpPct < 30 ? '#e74c3c' : hpPct < 60 ? '#f39c12' : '#2ecc71'};border-radius:3px;transition:width 0.5s"></div>
                        </div>
                        ${regenHtml}
                        ${DragonEffects.renderMoodBubble(d)}
                    </div>

                    <!-- STATS BAR -->
                    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">${statsBarHTML}</div>
                    ${buffHTML}

                    <!-- EQUIPMENT GRID (6 columns, compact) -->
                    <div style="margin:6px 0">
                        <div style="font-size:0.8rem;font-weight:600;opacity:0.5;margin-bottom:4px">⚔️ Trang Bị <span style="font-weight:400;font-size:0.68rem">(nhấn để chọn)</span></div>
                        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px">${eqGridHTML}</div>
                        <div id="eq-slot-detail" style="margin-top:6px"></div>
                    </div>

                    <!-- TABS -->
                    <div class="dd-tabs" style="display:flex;gap:6px;margin:8px 0;flex-wrap:wrap">
                        <div class="tab active" onclick="DragonPage.switchTab('feed', this)" style="flex:1;text-align:center;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:0.9rem;font-weight:700;background:linear-gradient(135deg,rgba(230,126,34,0.25),rgba(230,126,34,0.1));border:2.5px solid rgba(230,126,34,0.6);color:#e67e22;transition:all 0.2s;box-shadow:0 0 8px rgba(230,126,34,0.15)">🍖 Cho Ăn</div>
                        <div class="tab" onclick="DragonPage.switchTab('formation', this)" style="flex:1;text-align:center;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:0.9rem;font-weight:700;background:rgba(255,255,255,0.06);border:2.5px solid rgba(255,255,255,0.3);color:rgba(255,255,255,0.7);transition:all 0.2s">🏰 Đội Hình</div>
                        <div class="tab" onclick="DragonPage.switchTab('merge', this)" style="flex:1;text-align:center;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:0.9rem;font-weight:700;background:rgba(255,255,255,0.06);border:2.5px solid rgba(255,255,255,0.3);color:rgba(255,255,255,0.7);transition:all 0.2s">✨ Ghép Sao</div>
                        <div class="tab" onclick="DragonPage.switchTab('eggs', this)" style="flex:1;text-align:center;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:0.9rem;font-weight:700;background:rgba(255,255,255,0.06);border:2.5px solid rgba(255,255,255,0.3);color:rgba(255,255,255,0.7);transition:all 0.2s">🥚 Trứng</div>
                    </div>

                    <!-- Tab: Feed -->
                    <div id="dragon-tab-feed" class="hidden">
                        <div id="dragon-food-list"><div style="text-align:center;padding:12px;opacity:0.4">Đang tải...</div></div>
                    </div>

                    <!-- Tab: Formation -->
                    <div id="dragon-tab-formation" class="hidden">${formationHTML}</div>

                    <!-- Tab: Merge -->
                    <div id="dragon-tab-merge" class="hidden">
                        <div id="dragon-merge-list"><div style="text-align:center;padding:12px;opacity:0.4">Đang tải...</div></div>
                    </div>

                    <!-- Tab: Eggs -->
                    <div id="dragon-tab-eggs" class="hidden">
                        <div id="dragon-eggs-list"><div style="text-align:center;padding:12px;opacity:0.4">Đang tải...</div></div>
                    </div>

                    <!-- Tab: Evolve -->
                    <div id="dragon-tab-evolve" class="hidden">
                        <div style="text-align:center;padding:20px;opacity:0.4">🔮 Tính năng Tiến Hóa sắp ra mắt!</div>
                    </div>

                    <!-- DRAGON ROSTER (bottom horizontal scroll) -->
                    <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px">
                        <div style="font-size:0.62rem;opacity:0.4;margin-bottom:4px">🐲 Đàn Rồng (${dragons.length})</div>
                        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch">
                            ${rosterHTML}
                        </div>
                    </div>
                </div>

                <style>
                    @keyframes dragonFloat {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-8px); }
                    }
                </style>
            `
        });
        Modal.show('dragon-den-modal');
    },

    selectDragon(idx) {
        this.selectedDragonIdx = idx;
        Modal.hide('dragon-den-modal');
        this.showDragonDen(this.dragonData);
    },

    renderFormationUI(dragons, formations, elementColors, elementNames) {
        const formSlots = [];
        for (let i = 0; i < 5; i++) {
            const f = formations.find(ff => ff.slot === i);
            const dr = f ? dragons.find(dd => dd.id === f.dragon_id) : null;
            const pos = i < 2 ? 'front' : 'back';
            formSlots.push({ slot: i, dragon: dr, position: f?.position || pos, dragon_id: f?.dragon_id });
        }

        // Store for drag-drop
        this._formSlots = formSlots;

        let html = '<div style="font-size:0.72rem;color:rgba(255,255,255,0.5);margin-bottom:6px">Kéo rồng vào ô để xếp đội hình. Nhấn ✕ để bỏ.</div>';

        // Formation grid
        html += '<div style="display:flex;gap:12px;margin-bottom:10px">';

        // Front column
        html += '<div style="flex:1"><div style="font-size:0.65rem;font-weight:600;color:#e74c3c;margin-bottom:4px;text-align:center">⚔️ TIỀN PHONG</div>';
        for (let i = 0; i < 2; i++) {
            const s = formSlots[i];
            html += this._renderFormSlot(s, i, elementColors, elementNames);
        }
        html += '</div>';

        // Back column
        html += '<div style="flex:1"><div style="font-size:0.65rem;font-weight:600;color:#3498db;margin-bottom:4px;text-align:center">🛡️ HẬU VỆ</div>';
        for (let i = 2; i < 5; i++) {
            const s = formSlots[i];
            html += this._renderFormSlot(s, i, elementColors, elementNames);
        }
        html += '</div>';
        html += '</div>';

        // Dragon roster (draggable)
        const usedIds = formSlots.filter(s => s.dragon_id).map(s => s.dragon_id);
        const available = dragons.filter(dr => !usedIds.includes(dr.id));

        html += '<div style="font-size:0.65rem;font-weight:600;margin-bottom:4px;opacity:0.6">🐉 Rồng chưa xếp (' + available.length + ')</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;padding:4px;background:rgba(255,255,255,0.02);border-radius:8px">';

        if (available.length === 0) {
            html += '<div style="width:100%;text-align:center;font-size:0.7rem;opacity:0.3;padding:12px">Tất cả rồng đã xếp đội hình</div>';
        } else {
            for (const dr of available) {
                const ec = elementColors[dr.element] || '#666';
                html += `<div draggable="true" ondragstart="DragonPage._dragStart(event, ${dr.id})" 
                    style="display:flex;align-items:center;gap:4px;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid ${ec}40;cursor:grab;font-size:0.7rem;transition:all 0.2s;flex-shrink:0"
                    onmousedown="this.style.cursor='grabbing'" onmouseup="this.style.cursor='grab'">
                    <img src="${DragonPage.dragonImage(dr.element)}" style="width:22px;height:22px;object-fit:contain">
                    <span style="font-weight:600;white-space:nowrap">${dr.name}</span>
                    <span style="font-size:0.55rem;color:${ec}">Lv.${dr.level}</span>
                </div>`;
            }
        }
        html += '</div>';

        html += `<button class="btn btn-primary btn-sm" onclick="DragonPage.saveFormation()" style="width:100%;margin-top:8px">💾 Lưu Đội Hình</button>`;

        return html;
    },

    _renderFormSlot(s, i, elementColors, elementNames) {
        const pos = i < 2 ? 'front' : 'back';
        const bgColor = i < 2 ? 'rgba(231,76,60,0.08)' : 'rgba(52,152,219,0.08)';
        const borderColor = s.dragon ? (elementColors[s.dragon.element] || '#666') : 'rgba(255,255,255,0.1)';

        return `<div ondragover="event.preventDefault();this.style.borderColor='#FFD700';this.style.background='rgba(255,215,0,0.1)'" 
            ondragleave="this.style.borderColor='${borderColor}';this.style.background='${bgColor}'" 
            ondrop="DragonPage._dropToSlot(event, ${i}, '${pos}')" 
            style="padding:6px 8px;background:${bgColor};border:2px dashed ${borderColor};border-radius:8px;margin-bottom:4px;min-height:40px;transition:all 0.2s;display:flex;align-items:center;gap:6px">
            ${s.dragon ? `
                <img src="${DragonPage.dragonImage(s.dragon.element)}" style="width:28px;height:28px;object-fit:contain">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.dragon.name}</div>
                    <div style="font-size:0.55rem;color:${elementColors[s.dragon.element] || '#666'}">${elementNames[s.dragon.element] || s.dragon.element} Lv.${s.dragon.level}</div>
                </div>
                <button onclick="DragonPage._removeFromSlot(${i})" style="width:20px;height:20px;border-radius:50%;border:none;background:rgba(255,50,50,0.2);color:#e74c3c;cursor:pointer;font-size:0.6rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
            ` : `<div style="flex:1;text-align:center;font-size:0.65rem;opacity:0.3">Kéo rồng vào đây</div>`}
        </div>`;
    },

    _dragStart(e, dragonId) {
        e.dataTransfer.setData('text/plain', dragonId);
        e.dataTransfer.effectAllowed = 'move';
    },

    _dropToSlot(e, slotIdx, position) {
        e.preventDefault();
        const dragonId = parseInt(e.dataTransfer.getData('text/plain'));
        if (!dragonId) return;

        // Remove from old slot if already placed
        if (this._formSlots) {
            for (const s of this._formSlots) {
                if (s.dragon_id === dragonId && s.slot !== slotIdx) {
                    delete this._pendingFormation[s.slot];
                    // Also remove from dragonData formations
                    if (this.dragonData?.formations) {
                        this.dragonData.formations = this.dragonData.formations.filter(f => f.slot !== s.slot);
                    }
                }
            }
        }

        this._pendingFormation[slotIdx] = { slot: slotIdx, dragon_id: dragonId, position };
        // Merge pending into dragonData formations for re-render
        if (this.dragonData) {
            if (!this.dragonData.formations) this.dragonData.formations = [];
            this.dragonData.formations = this.dragonData.formations.filter(f => f.slot !== slotIdx);
            this.dragonData.formations.push({ slot: slotIdx, dragon_id: dragonId, position });
        }
        // Re-render and switch to formation tab
        this.showDragonDen(this.dragonData);
        setTimeout(() => {
            DragonPage.switchTab('formation', document.querySelector('.dd-tabs .tab:nth-child(2)'));
        }, 50);
    },

    _removeFromSlot(slotIdx) {
        delete this._pendingFormation[slotIdx];
        // Also remove from existing formations for re-render
        if (this.dragonData?.formations) {
            this.dragonData.formations = this.dragonData.formations.filter(f => f.slot !== slotIdx);
        }
        this.showDragonDen(this.dragonData);
        setTimeout(() => {
            DragonPage.switchTab('formation', document.querySelector('.dd-tabs .tab:nth-child(2)'));
        }, 50);
    },

    setFormSlot(slot, dragonId, position) {
        if (dragonId) {
            this._pendingFormation[slot] = { slot, dragon_id: parseInt(dragonId), position };
        } else {
            delete this._pendingFormation[slot];
        }
    },

    async saveFormation() {
        const existing = this.dragonData?.formations || [];
        const merged = {};
        for (const f of existing) {
            merged[f.slot] = { slot: f.slot, dragon_id: f.dragon_id, position: f.position };
        }
        Object.assign(merged, this._pendingFormation);

        const formation = Object.values(merged).filter(f => f.dragon_id);
        if (formation.length === 0) {
            Toast.error('Chọn ít nhất 1 rồng!');
            return;
        }

        try {
            const result = await API.post('/dragon/set-formation', { formation });
            Toast.success(result.message);
            this._pendingFormation = {};
            Modal.hide('dragon-den-modal');
            this.open();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async loadEquipmentList() {
        try {
            const data = await API.get('/dragon/equipment');
            const container = document.getElementById('dragon-equip-list');
            if (!container) return;

            if (data.equipment.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚔️</div><div class="empty-state-text">Chưa có trang bị. Hãy đến Ao Ước Nguyện để gacha!</div></div>';
                return;
            }

            const slotOrder = ['hat', 'glasses', 'sword', 'armor', 'pants', 'shoes'];
            const slotNames = { hat: '🎩 Mũ/Nón', glasses: '👓 Kính', sword: '⚔️ Vũ Khí', armor: '🛡️ Giáp', pants: '👖 Quần', shoes: '👟 Giày' };
            const bySlot = {};
            for (const eq of data.equipment) {
                if (!bySlot[eq.slot]) bySlot[eq.slot] = [];
                bySlot[eq.slot].push(eq);
            }

            // Show 6 slot categories as clickable cards
            let html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px">';
            for (const slot of slotOrder) {
                const items = bySlot[slot] || [];
                const count = items.length;
                const equipped = items.filter(e => e.is_equipped).length;
                html += `<div onclick="DragonPage._toggleSlot('${slot}')" style="cursor:pointer;text-align:center;padding:10px 6px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);transition:all 0.2s" id="eq-slot-btn-${slot}">
                    <div style="font-size:1.4rem;margin-bottom:2px">${slotNames[slot]?.split(' ')[0] || '📦'}</div>
                    <div style="font-size:0.7rem;font-weight:600">${slotNames[slot]?.split(' ').slice(1).join(' ') || slot}</div>
                    <div style="font-size:0.6rem;opacity:0.5;margin-top:2px">${count} món${equipped > 0 ? ` · ${equipped} đang mặc` : ''}</div>
                </div>`;
            }
            html += '</div>';

            // Hidden item lists per slot
            for (const slot of slotOrder) {
                const items = bySlot[slot] || [];
                html += `<div id="eq-slot-list-${slot}" style="display:none;margin-bottom:8px">
                    <div style="font-size:0.72rem;font-weight:600;margin-bottom:4px;opacity:0.7">${slotNames[slot]} (${items.length})</div>`;
                if (items.length === 0) {
                    html += '<div style="font-size:0.75rem;opacity:0.4;padding:8px;text-align:center">Chưa có đồ</div>';
                } else {
                    html += '<div style="display:flex;flex-direction:column;gap:3px">';
                    for (const eq of items) {
                        const rc = this.rarityColor(eq.rarity);
                        const starHtml = eq.star_level > 0 ? ` <span style="color:#FFD700;font-size:0.6rem">${this.starDisplay(eq.star_level)}</span>` : '';
                        html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,0.04);border-left:3px solid ${rc}">
                            <span style="font-size:1.1rem">${eq.icon}</span>
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:600;font-size:0.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${eq.name}${starHtml}</div>
                                <div style="font-size:0.6rem;opacity:0.5">${this.getStatsList(eq).join(' · ')}</div>
                            </div>
                            <button class="btn ${eq.is_equipped ? 'btn-secondary' : 'btn-primary'} btn-sm" style="padding:4px 10px;font-size:0.7rem;white-space:nowrap"
                                    onclick="DragonPage.${eq.is_equipped ? 'unequip' : 'equip'}(${eq.user_equip_id})">
                                ${eq.is_equipped ? '❌ Tháo' : '✅ Mặc'}
                            </button>
                        </div>`;
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
            container.innerHTML = html;
        } catch (err) {
            Toast.error(err.message);
        }
    },

    _toggleSlot(slot) {
        const list = document.getElementById('eq-slot-list-' + slot);
        const btn = document.getElementById('eq-slot-btn-' + slot);
        if (!list) return;
        const showing = list.style.display !== 'none';
        // Hide all
        document.querySelectorAll('[id^="eq-slot-list-"]').forEach(el => el.style.display = 'none');
        document.querySelectorAll('[id^="eq-slot-btn-"]').forEach(el => {
            el.style.borderColor = 'rgba(255,255,255,0.08)';
            el.style.background = 'rgba(255,255,255,0.04)';
        });
        if (!showing) {
            list.style.display = 'block';
            if (btn) {
                btn.style.borderColor = 'rgba(100,150,255,0.4)';
                btn.style.background = 'rgba(100,150,255,0.1)';
            }
        }
    },

    // Show equipment list for a specific slot (called when clicking an equipment grid box)
    _activeSlot: null,
    async showSlotEquipment(slot) {
        const detail = document.getElementById('eq-slot-detail');
        if (!detail) return;
        if (this._activeSlot === slot) {
            detail.innerHTML = '';
            this._activeSlot = null;
            document.querySelectorAll('[id^="eq-grid-"]').forEach(el => el.style.boxShadow = 'none');
            return;
        }
        this._activeSlot = slot;
        document.querySelectorAll('[id^="eq-grid-"]').forEach(el => el.style.boxShadow = 'none');
        const activeBox = document.getElementById('eq-grid-' + slot);
        if (activeBox) activeBox.style.boxShadow = '0 0 8px rgba(100,150,255,0.5)';
        detail.innerHTML = '<div style="text-align:center;padding:8px;opacity:0.4;font-size:0.7rem">Đang tải...</div>';
        try {
            const data = await API.get('/dragon/equipment');
            const slotNames = { hat: '🎩 Mũ/Nón', glasses: '👓 Kính', sword: '⚔️ Vũ Khí', armor: '🛡️ Giáp', pants: '👖 Quần', shoes: '👟 Giày' };
            const items = (data.equipment || []).filter(e => e.slot === slot);
            if (items.length === 0) {
                detail.innerHTML = `<div style="padding:10px;text-align:center;font-size:0.72rem;opacity:0.4;border-radius:8px;background:rgba(255,255,255,0.03)">${slotNames[slot] || slot} — Chưa có. Hãy gacha!</div>`;
                return;
            }
            const rarityOrder = { mythic: 5, legendary: 4, epic: 3, rare: 2, common: 1 };
            items.sort((a, b) => {
                if (a.is_equipped && !b.is_equipped) return -1;
                if (!a.is_equipped && b.is_equipped) return 1;
                return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
            });
            let html = `<div style="font-size:0.68rem;font-weight:600;margin-bottom:4px;opacity:0.6">${slotNames[slot]} (${items.length})</div>`;
            html += '<div style="display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto">';
            for (const eq of items) {
                const rc = this.rarityColor(eq.rarity);
                const starHtml = eq.star_level > 0 ? ` <span style="color:#FFD700;font-size:0.55rem">${this.starDisplay(eq.star_level)}</span>` : '';
                html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;background:${eq.is_equipped ? 'rgba(46,204,113,0.08)' : 'rgba(255,255,255,0.03)'};border-left:3px solid ${rc}">
                    <span style="font-size:1rem">${eq.icon}</span>
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:600;font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${eq.name}${starHtml} <span style="font-size:0.55rem;color:${rc}">${this.rarityLabel(eq.rarity)}</span></div>
                        <div style="font-size:0.55rem;opacity:0.5">${this.getStatsList(eq).join(' · ')}</div>
                    </div>
                    <button class="btn ${eq.is_equipped ? 'btn-secondary' : 'btn-primary'} btn-sm" style="padding:3px 8px;font-size:0.65rem;white-space:nowrap"
                            onclick="DragonPage.${eq.is_equipped ? 'unequip' : 'equip'}(${eq.user_equip_id})">
                        ${eq.is_equipped ? '❌ Tháo' : '✅ Mặc'}
                    </button>
                </div>`;
            }
            html += '</div>';
            detail.innerHTML = html;
        } catch (err) {
            detail.innerHTML = '<div style="color:#e74c3c;font-size:0.7rem;padding:8px">Lỗi tải trang bị</div>';
        }
    },

    async loadMergeList() {
        try {
            const data = await API.get('/dragon/equipment');
            const container = document.getElementById('dragon-merge-list');
            if (!container) return;

            if (data.equipment.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-text">Chưa có trang bị để ghép.</div></div>';
                return;
            }

            const groups = {};
            for (const eq of data.equipment) {
                const key = `${eq.equip_id}_${eq.star_level}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(eq);
            }

            let html = '<div style="font-size:0.7rem;color:rgba(255,255,255,0.5);margin-bottom:6px;">💡 2 giống nhau + cùng sao → ghép = +1⭐ (+50% chỉ số)</div>';
            let hasMergeable = false;

            for (const [key, items] of Object.entries(groups)) {
                if (items.length >= 2 && items[0].star_level < 9) {
                    hasMergeable = true;
                    const eq = items[0];
                    const rc = this.rarityColor(eq.rarity);
                    const starHtml = eq.star_level > 0 ? ` ${this.starDisplay(eq.star_level)}` : ' ☆0';
                    const unequipped = items.filter(i => !i.is_equipped);
                    const target = items[0];
                    const material = unequipped.find(i => i.user_equip_id !== target.user_equip_id) || items[1];

                    html += `<div class="equip-card" style="border-left:4px solid ${rc};">
                        <div class="equip-card-icon">${eq.icon}</div>
                        <div class="equip-card-info">
                            <div class="equip-card-name">${eq.name}${starHtml}</div>
                            <div class="equip-card-stats">${this.getStatsList(eq).join(' · ')}</div>
                            <div class="equip-card-rarity" style="color:${rc};">×${items.length} · ${this.rarityLabel(eq.rarity)}</div>
                        </div>
                        ${material.is_equipped ? `<span style="font-size:0.65rem;color:#e74c3c;">Tháo trước</span>` :
                            `<button class="btn btn-accent btn-sm" onclick="DragonPage.merge(${target.user_equip_id}, ${material.user_equip_id})">✨ Ghép</button>`}
                    </div>`;
                }
            }

            if (!hasMergeable) {
                html += '<div class="empty-state" style="padding:12px;"><div class="empty-state-text" style="font-size:0.8rem;">Cần 2 trang bị giống + cùng sao</div></div>';
            }

            html += `<div style="margin-top:8px;padding:6px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:0.65rem;color:rgba(255,255,255,0.4);">
                ⭐×1→5 (Vàng) → 🌟×1→5 (Đỏ). Mỗi sao +50%</div>`;

            container.innerHTML = html;
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async loadFoodList() {
        try {
            const data = await API.get('/dragon/food');
            const container = document.getElementById('dragon-food-list');
            if (!container) return;
            if (data.food.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🍖</div><div class="empty-state-text">Hãy mua thức ăn ở Chợ!</div></div>';
                return;
            }
            container.innerHTML = data.food.map(f => `
                <div class="equip-card">
                    <div class="equip-card-icon">${f.icon_url || '🍖'}</div>
                    <div class="equip-card-info">
                        <div class="equip-card-name">${f.name}</div>
                        <div class="equip-card-stats">${f.description}</div>
                        <div class="text-small text-muted">Còn: ${f.quantity}</div>
                    </div>
                    <button class="btn btn-accent btn-sm" onclick="DragonPage.feed(${f.item_id})">🍖 Cho Ăn</button>
                </div>
            `).join('');
        } catch (err) { Toast.error(err.message); }
    },

    async equip(userEquipId) {
        try {
            const dragon = this.dragonData?.dragons?.[this.selectedDragonIdx || 0];
            const dragonId = dragon?.id;
            const result = await API.post('/dragon/equip', { user_equip_id: userEquipId, dragon_id: dragonId });
            Toast.success(result.message);
            Modal.hide('dragon-den-modal');
            this.open();
        } catch (err) { Toast.error(err.message); }
    },

    async unequip(userEquipId) {
        try {
            const result = await API.post('/dragon/unequip', { user_equip_id: userEquipId });
            Toast.success(result.message);
            Modal.hide('dragon-den-modal');
            this.open();
        } catch (err) { Toast.error(err.message); }
    },

    async feed(itemId) {
        try {
            const dragon = this.dragonData?.dragons?.[this.selectedDragonIdx || 0];
            const result = await API.post('/dragon/feed', { item_id: itemId, dragon_id: dragon?.id });
            Toast.success(result.message);
            if (result.leveled_up) {
                DragonEffects.showEvolution(dragon?.name || 'Rồng', result.new_level);
            }
            Modal.hide('dragon-den-modal');
            this.open();
        } catch (err) { Toast.error(err.message); }
    },

    async merge(targetId, materialId) {
        if (!confirm('✨ Ghép 2 trang bị? Nguyên liệu sẽ mất!')) return;
        try {
            const result = await API.post('/dragon/merge', { target_id: targetId, material_id: materialId });
            Toast.success(result.message);
            Celebration.show({ icon: '✨', title: '⭐ Ghép Thành Công!', subtitle: result.message, duration: 2500 });
            Modal.hide('dragon-den-modal');
            this.open();
        } catch (err) { Toast.error(err.message); }
    },

    switchTab(tab, btn) {
        const tabColors = {
            equip: { bg: 'linear-gradient(135deg,rgba(230,126,34,0.25),rgba(230,126,34,0.1))', border: 'rgba(230,126,34,0.4)', color: '#e67e22' },
            formation: { bg: 'linear-gradient(135deg,rgba(52,152,219,0.25),rgba(52,152,219,0.1))', border: 'rgba(52,152,219,0.4)', color: '#3498db' },
            merge: { bg: 'linear-gradient(135deg,rgba(155,89,182,0.25),rgba(155,89,182,0.1))', border: 'rgba(155,89,182,0.4)', color: '#9b59b6' },
            feed: { bg: 'linear-gradient(135deg,rgba(46,204,113,0.25),rgba(46,204,113,0.1))', border: 'rgba(46,204,113,0.4)', color: '#2ecc71' },
            eggs: { bg: 'linear-gradient(135deg,rgba(241,196,15,0.25),rgba(241,196,15,0.1))', border: 'rgba(241,196,15,0.4)', color: '#f1c40f' },
            evolve: { bg: 'linear-gradient(135deg,rgba(231,76,60,0.25),rgba(231,76,60,0.1))', border: 'rgba(231,76,60,0.4)', color: '#e74c3c' }
        };
        document.querySelectorAll('#dragon-den-modal .dd-tabs .tab').forEach(t => {
            t.classList.remove('active');
            t.style.background = 'rgba(255,255,255,0.04)';
            t.style.borderColor = 'rgba(255,255,255,0.15)';
            t.style.color = '';
            t.style.boxShadow = 'none';
        });
        btn.classList.add('active');
        const tc = tabColors[tab];
        if (tc) {
            btn.style.background = tc.bg;
            btn.style.borderColor = tc.border;
            btn.style.color = tc.color;
            btn.style.boxShadow = `0 0 10px ${tc.border}`;
        }
        ['equip', 'merge', 'formation', 'feed', 'eggs', 'evolve'].forEach(t => {
            const el = document.getElementById('dragon-tab-' + t);
            if (el) el.classList.toggle('hidden', tab !== t);
        });
        if (tab === 'feed') this.loadFoodList();
        if (tab === 'equip') this.loadEquipmentList();
        if (tab === 'merge') this.loadMergeList();
        if (tab === 'eggs') this.loadEggs();
    },

    async loadEggs() {
        const container = document.getElementById('dragon-eggs-list');
        if (!container) return;
        try {
            const data = await API.get('/dragon/eggs');
            let html = '';

            if (data.eggs.length === 0) {
                html = `<div style="text-align:center;padding:20px;">
                    <div style="font-size:3rem;margin-bottom:8px;">🥚</div>
                    <div style="color:rgba(255,255,255,0.5);margin-bottom:16px;">Chưa có trứng nào đang ấp</div>
                </div>`;
            } else {
                html = data.eggs.map(egg => {
                    const remainMs = egg.remaining_ms;
                    const hours = Math.floor(remainMs / 3600000);
                    const mins = Math.floor((remainMs % 3600000) / 60000);
                    const timeStr = egg.ready ? '✅ Sẵn sàng nở!' : `⏳ Còn ${hours}h ${mins}p`;
                    return `
                    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.05);border-radius:10px;margin-bottom:6px;">
                        <div style="font-size:2.5rem;animation:eggBounce 1.5s ease-in-out infinite;">🥚</div>
                        <div style="flex:1;">
                            <div style="font-weight:600;">${egg.name || 'Trứng Rồng'}</div>
                            <div style="font-size:0.8rem;color:${egg.ready ? '#2ecc71' : '#f39c12'};">${timeStr}</div>
                        </div>
                        <div style="display:flex;gap:4px;">
                            ${egg.ready ? `<button class="btn btn-primary btn-sm" onclick="DragonPage.hatchEgg(${egg.id}, false)">🐣 Ấp Nở</button>` :
                            `<button class="btn btn-accent btn-sm" onclick="DragonPage.hatchEgg(${egg.id}, true)" ${data.has_instant_hatch ? '' : 'disabled'} title="${data.has_instant_hatch ? 'Dùng Lửa Phượng Hoàng' : 'Cần mua Lửa Phượng Hoàng'}">🔥 Nở Ngay</button>`}
                        </div>
                    </div>`;
                }).join('');
            }

            // Buy egg button
            html += `<div style="text-align:center;margin-top:12px;">
                <button class="btn btn-primary" onclick="DragonPage.buyEgg()" style="background:linear-gradient(135deg,#f7971e,#ffd200);color:#000;font-weight:700;padding:10px 24px;border:none;border-radius:10px;cursor:pointer;">
                    🥚 Mua Trứng Rồng (1.000.000 🪙)
                </button>
                <div style="font-size:0.7rem;color:rgba(255,255,255,0.4);margin-top:6px;">Ấp 24h → nở rồng nguyên tố ngẫu nhiên!</div>
            </div>`;

            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = '<div style="color:#e74c3c;">Lỗi tải trứng</div>';
        }
    },

    async hatchEgg(eggId, useInstant) {
        try {
            const result = await API.post('/dragon/hatch-egg', { egg_id: eggId, use_instant: useInstant });
            Toast.success(result.message);
            Celebration.show({ icon: '🐉', title: '🐣 Rồng Đã Nở!', subtitle: result.element_name, duration: 3000 });
            Modal.hide('dragon-den-modal');
            setTimeout(() => this.open(), 1000);
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async buyEgg() {
        const name = prompt('🥚 Đặt tên cho trứng rồng:', 'Trứng Rồng');
        if (name === null) return;
        try {
            const result = await API.post('/dragon/buy-egg', { name: name || 'Trứng Rồng' });
            Toast.success(result.message);
            this.loadEggs();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    getStatsList(eq) {
        const m = 1 + (eq.star_level || 0) * 0.5;
        const s = [];
        if (eq.hp_bonus) s.push(`+${Math.floor(eq.hp_bonus * m)} HP`);
        if (eq.att_bonus) s.push(`+${Math.floor(eq.att_bonus * m)} ATT`);
        if (eq.def_bonus) s.push(`+${Math.floor(eq.def_bonus * m)} DEF`);
        if (eq.crit_rate_bonus > 0) s.push(`+${(eq.crit_rate_bonus * m).toFixed(1)}% Crit`);
        if (eq.crit_dmg_bonus > 0) s.push(`+${(eq.crit_dmg_bonus * m).toFixed(1)}% CritDMG`);
        if (eq.spd_bonus > 0) s.push(`+${Math.floor(eq.spd_bonus * m)} SPD`);
        return s;
    },

    starDisplay(sl) {
        if (sl <= 0) return '';
        if (sl <= 5) return '<span style="color:#f1c40f;">' + '⭐'.repeat(sl) + '</span>';
        return '<span style="color:#f1c40f;">' + '⭐'.repeat(5) + '</span><span style="color:#e74c3c;">' + '🌟'.repeat(sl - 5) + '</span>';
    },

    rarityColor(r) { if (r === 'mythic') return '#FF1493'; return { common: '#9E9E9E', rare: '#2196F3', epic: '#9C27B0', legendary: '#FF9800' }[r] || '#666'; },
    rarityLabel(r) { if (r === 'mythic') return 'Thần Thoại'; return { common: '🟢 Thường', rare: '🔵 Hiếm', epic: '🟣 Huyền Thoại', legendary: '🟡 Thần Thoại' }[r] || r; },
    slotLabel(s) { return { hat: '🎩', sword: '⚔️', armor: '🛡️', pants: '👖', glasses: '👓', shoes: '👟' }[s] || s; },

    async renameDragon(dragonId, currentName) {
        const newName = prompt(`✏️ Đổi tên rồng\n\nTên hiện tại: ${currentName}\nNhập tên mới (2-20 ký tự):`, currentName);
        if (!newName || newName.trim() === currentName) return;
        try {
            const result = await API.post('/dragons/rename', { dragon_id: dragonId, new_name: newName.trim() });
            Toast.success(result.message);
            // Reopen dragon den to reflect changes
            Modal.hide('dragon-den-modal');
            setTimeout(() => this.open(), 300);
        } catch (e) {
            Toast.error(e.message || 'Lỗi đổi tên');
        }
    }
};
