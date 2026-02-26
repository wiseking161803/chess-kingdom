/**
 * Garden Page — Vườn Cây / Happy Farm
 * Plant seeds, water them, harvest crops, sell or feed dragons
 */
const GardenPage = {
    _plots: [],
    _seeds: [],
    _harvests: [],
    _selectedSeed: null,
    _refreshTimer: null,

    async open() {
        try {
            const data = await API.get('/garden/plots');
            this._plots = data.plots || [];
            this._seeds = data.seeds || [];

            // Load harvest inventory
            const harvestData = await API.get('/garden/harvest-inventory');
            this._harvests = harvestData.items || [];

            this.renderModal();
            this.startAutoRefresh();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    renderModal() {
        const plotsHTML = this._plots.map(p => this.renderPlot(p)).join('');
        const seedsHTML = this._seeds.length > 0
            ? this._seeds.map(s => `
                <div class="garden-seed-item ${this._selectedSeed === s.item_id ? 'selected' : ''}"
                     onclick="GardenPage.selectSeed(${s.item_id})"
                     title="${s.description}">
                    <span class="seed-icon">${s.icon}</span>
                    <span class="seed-name">${s.name.replace('Hạt ', '')} <span class="seed-qty">x${s.quantity}</span></span>
                </div>
            `).join('')
            : '<div style="text-align:center;opacity:0.5;font-size:0.8rem;padding:8px">Chưa có hạt giống. Mua ở Chợ Phiên!</div>';

        const harvestHTML = this._harvests.length > 0
            ? `<div class="garden-harvest-section">
                <div class="garden-section-title">🧺 Kho Nông Sản</div>
                <div class="garden-harvest-grid">
                    ${this._harvests.map(h => `
                        <div class="harvest-item">
                            <div class="harvest-icon">${h.harvest_icon}</div>
                            <div class="harvest-info">
                                <div class="harvest-name">${h.harvest_name} <span class="harvest-qty">x${h.quantity}</span></div>
                                <div class="harvest-actions">
                                    <button class="harvest-btn sell" onclick="GardenPage.sellHarvest('${h.harvest_name.replace(/'/g, "\\'")}')">💰 ${h.sell_price}xu</button>
                                    <button class="harvest-btn feed" onclick="GardenPage.feedDragon('${h.harvest_name.replace(/'/g, "\\'")}')">🐉 ${h.exp_value}XP${h.fav_element ? ' ⭐' + this.getElemEmoji(h.fav_element) : ''}</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`
            : '';

        // Unlock plot button
        const canUnlock = this._plots.length < 6;
        const unlockCost = 2000 * (this._plots.length + 1);
        const unlockHTML = canUnlock ? `
            <div style="text-align:center;margin-top:12px">
                <button class="garden-unlock-btn" onclick="GardenPage.unlockPlot()">
                    ➕ Mở ô đất (${unlockCost.toLocaleString()} xu)
                </button>
            </div>
        ` : '';

        Modal.create({
            id: 'garden-modal',
            title: '🌾 Vườn Cây — Nông Trại Vui Vẻ',
            icon: '🌱',
            size: 'modal-lg',
            content: `
                <style>
                    .garden-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px; }
                    .garden-plot {
                        background:linear-gradient(180deg,rgba(139,90,43,0.3),rgba(101,67,33,0.5));
                        border:2px solid rgba(139,90,43,0.4);border-radius:12px;padding:12px;min-height:120px;
                        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
                        cursor:pointer;transition:all 0.3s;position:relative;overflow:hidden;
                    }
                    .garden-plot::before {
                        content:'';position:absolute;bottom:0;left:0;right:0;height:40%;
                        background:linear-gradient(0deg,rgba(101,67,33,0.6),transparent);border-radius:0 0 10px 10px;
                    }
                    .garden-plot:hover { transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.2); }
                    .garden-plot.plot-empty { border-style:dashed;opacity:0.7; }
                    .garden-plot.plot-planted { border-color:rgba(46,204,113,0.4);background:linear-gradient(180deg,rgba(46,204,113,0.1),rgba(101,67,33,0.5)); }
                    .garden-plot.plot-watered { border-color:rgba(52,152,219,0.4);background:linear-gradient(180deg,rgba(52,152,219,0.1),rgba(101,67,33,0.5)); }
                    .garden-plot.plot-ready { border-color:rgba(241,196,15,0.6);background:linear-gradient(180deg,rgba(241,196,15,0.15),rgba(101,67,33,0.5));animation:readyPulse 1.5s infinite; }
                    .plot-crop { font-size:2rem;z-index:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
                    .plot-status { font-size:0.7rem;z-index:1;opacity:0.8; }
                    .plot-progress { width:80%;height:4px;background:rgba(255,255,255,0.1);border-radius:4px;z-index:1;overflow:hidden; }
                    .plot-progress-fill { height:100%;border-radius:4px;background:linear-gradient(90deg,#2ecc71,#27ae60);transition:width 0.5s; }
                    .plot-timer { font-size:0.65rem;z-index:1;opacity:0.6; }
                    .plot-action-btn {
                        font-size:0.75rem;padding:4px 12px;border-radius:8px;border:none;cursor:pointer;
                        font-weight:700;z-index:1;font-family:inherit;transition:all 0.2s;
                    }
                    .plot-action-btn:hover { transform:scale(1.05); }
                    .btn-plant { background:linear-gradient(135deg,#2ecc71,#27ae60);color:#fff; }
                    .btn-water { background:linear-gradient(135deg,#3498db,#2980b9);color:#fff; }
                    .btn-harvest { background:linear-gradient(135deg,#f1c40f,#f39c12);color:#000; }
                    @keyframes readyPulse { 0%,100%{box-shadow:0 0 8px rgba(241,196,15,0.3)} 50%{box-shadow:0 0 20px rgba(241,196,15,0.6)} }
                    @keyframes growAnim { 0%{transform:scale(0.5);opacity:0.5} 100%{transform:scale(1);opacity:1} }
                    .plot-growing { animation:growAnim 0.5s ease-out; }

                    .garden-section-title { font-weight:700;font-size:0.85rem;margin-bottom:8px;opacity:0.7; }
                    .garden-seeds-row { display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px; }
                    .garden-seed-item {
                        display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:8px;
                        background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
                        cursor:pointer;font-size:0.8rem;transition:all 0.2s;
                    }
                    .garden-seed-item:hover { background:rgba(46,204,113,0.15); }
                    .garden-seed-item.selected { background:rgba(46,204,113,0.2);border-color:rgba(46,204,113,0.5);box-shadow:0 0 8px rgba(46,204,113,0.3); }
                    .seed-icon { font-size:1.1rem; }
                    .seed-qty { opacity:0.5;font-size:0.7rem; }
                    .seed-name { font-size:0.75rem; }

                    .garden-harvest-grid { display:flex;flex-direction:column;gap:4px; }
                    .harvest-item {
                        display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;
                        background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);
                    }
                    .harvest-icon { font-size:1.3rem; }
                    .harvest-info { flex:1; }
                    .harvest-name { font-weight:600;font-size:0.8rem; }
                    .harvest-qty { opacity:0.5;font-size:0.7rem; }
                    .harvest-actions { display:flex;gap:4px;margin-top:2px; }
                    .harvest-btn {
                        font-size:0.65rem;padding:2px 8px;border-radius:6px;border:none;cursor:pointer;
                        font-weight:600;font-family:inherit;transition:all 0.2s;
                    }
                    .harvest-btn.sell { background:rgba(241,196,15,0.2);color:#f1c40f; }
                    .harvest-btn.feed { background:rgba(46,204,113,0.2);color:#2ecc71; }
                    .harvest-btn:hover { filter:brightness(1.2); }
                    .garden-unlock-btn {
                        background:rgba(255,255,255,0.08);border:2px dashed rgba(255,255,255,0.2);color:rgba(255,255,255,0.6);
                        padding:8px 20px;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:600;font-size:0.85rem;
                        transition:all 0.2s;
                    }
                    .garden-unlock-btn:hover { background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.3);color:#fff; }
                </style>

                <div class="garden-section-title">🌱 Hạt Giống (bấm chọn → bấm ô trống để gieo)</div>
                <div class="garden-seeds-row">${seedsHTML}</div>

                <div class="garden-grid">${plotsHTML}</div>
                ${unlockHTML}
                ${harvestHTML}
            `
        });
        Modal.show('garden-modal');
    },

    renderPlot(p) {
        if (p.status === 'empty') {
            return `<div class="garden-plot plot-empty" onclick="GardenPage.plantSeed(${p.slot})">
                <div class="plot-crop" style="opacity:0.3">🌱</div>
                <div class="plot-status">Ô trống</div>
                <div style="font-size:0.65rem;opacity:0.4">Bấm để gieo hạt</div>
            </div>`;
        }
        if (p.status === 'planted') {
            return `<div class="garden-plot plot-planted" onclick="GardenPage.waterPlot(${p.slot})">
                <div class="plot-crop plot-growing">${p.seed_icon || '🌱'}</div>
                <div class="plot-status">${p.seed_name?.replace('Hạt ', '') || 'Cây'}</div>
                <button class="plot-action-btn btn-water" onclick="event.stopPropagation();GardenPage.waterPlot(${p.slot})">💧 Tưới Nước</button>
            </div>`;
        }
        if (p.status === 'watered') {
            const timerText = p.ready_in_seconds > 0
                ? (p.ready_in_seconds > 3600 ? `${Math.floor(p.ready_in_seconds / 3600)}h${Math.floor((p.ready_in_seconds % 3600) / 60)}m`
                    : p.ready_in_seconds > 60 ? `${Math.floor(p.ready_in_seconds / 60)}m${p.ready_in_seconds % 60}s`
                        : `${p.ready_in_seconds}s`)
                : 'Sắp xong!';
            return `<div class="garden-plot plot-watered">
                <div class="plot-crop">${p.seed_icon || '🌱'}</div>
                <div class="plot-status">Đang mọc...</div>
                <div class="plot-progress"><div class="plot-progress-fill" style="width:${p.progress}%"></div></div>
                <div class="plot-timer">⏱️ ${timerText}</div>
            </div>`;
        }
        if (p.status === 'ready') {
            return `<div class="garden-plot plot-ready" onclick="GardenPage.harvestPlot(${p.slot})">
                <div class="plot-crop" style="font-size:2.5rem">${p.harvest_icon || '🍎'}</div>
                <div class="plot-status" style="color:#f1c40f;font-weight:700">${p.harvest_name || 'Thu hoạch!'}</div>
                <button class="plot-action-btn btn-harvest" onclick="event.stopPropagation();GardenPage.harvestPlot(${p.slot})">🎉 Thu Hoạch</button>
            </div>`;
        }
        return `<div class="garden-plot"><div class="plot-status">?</div></div>`;
    },

    getElemEmoji(elem) {
        const m = { metal: '🪙', wood: '🌿', water: '💧', fire: '🔥', earth: '🪨', light: '✨', dark: '🌑' };
        return m[elem] || '';
    },

    selectSeed(itemId) {
        this._selectedSeed = this._selectedSeed === itemId ? null : itemId;
        this.refreshUI();
    },

    async plantSeed(slot) {
        if (!this._selectedSeed) {
            Toast.warning('Chọn hạt giống trước!');
            return;
        }
        try {
            const result = await API.post('/garden/plant', { slot, seed_item_id: this._selectedSeed });
            Toast.success(result.message);
            this._selectedSeed = null;
            await this.refreshData();
        } catch (e) {
            Toast.error(e.message);
        }
    },

    async waterPlot(slot) {
        try {
            const result = await API.post('/garden/water', { slot });
            Toast.success(result.message);
            await this.refreshData();
        } catch (e) {
            Toast.error(e.message);
        }
    },

    async harvestPlot(slot) {
        try {
            const result = await API.post('/garden/harvest', { slot });
            Toast.success(result.message);
            if (typeof Celebration !== 'undefined') {
                Celebration.show({
                    icon: result.harvest?.icon || '🎉',
                    title: 'Thu Hoạch!',
                    subtitle: result.harvest?.name || '',
                    duration: 2000
                });
            }
            await this.refreshData();
        } catch (e) {
            Toast.error(e.message);
        }
    },

    async sellHarvest(harvestName) {
        try {
            const result = await API.post('/garden/sell', { harvest_name: harvestName, quantity: 1 });
            Toast.success(result.message);
            await this.refreshData();
            if (typeof HomePage !== 'undefined') HomePage.refreshStats();
        } catch (e) {
            Toast.error(e.message);
        }
    },

    async feedDragon(harvestName) {
        // Get user's dragons
        try {
            const dragonData = await API.get('/dragon/me');
            if (!dragonData.dragon && (!dragonData.dragons || dragonData.dragons.length === 0)) {
                Toast.error('Bạn chưa có rồng!');
                return;
            }

            // If multiple dragons, pick the first one, or show a picker
            // For simplicity, get all dragons from formation
            const allDragons = dragonData.dragons || [dragonData.dragon];
            if (allDragons.length === 1) {
                const result = await API.post('/garden/feed-dragon', {
                    harvest_name: harvestName,
                    dragon_id: allDragons[0].id,
                    quantity: 1
                });
                Toast.success(result.message);
                await this.refreshData();
            } else {
                // Show dragon picker
                const dragonBtns = allDragons.filter(d => d).map(d =>
                    `<button onclick="GardenPage.doFeed('${harvestName.replace(/'/g, "\\'")}',${d.id})" style="margin:4px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;cursor:pointer;font-family:inherit">${this.getElemEmoji(d.element)} ${d.name} Lv.${d.level}</button>`
                ).join('');
                Toast.info(`Chọn rồng: ${dragonBtns}`, 10000);
            }
        } catch (e) {
            Toast.error(e.message);
        }
    },

    async doFeed(harvestName, dragonId) {
        try {
            const result = await API.post('/garden/feed-dragon', {
                harvest_name: harvestName,
                dragon_id: dragonId,
                quantity: 1
            });
            Toast.success(result.message);
            await this.refreshData();
        } catch (e) {
            Toast.error(e.message);
        }
    },

    async unlockPlot() {
        try {
            const result = await API.post('/garden/unlock-plot');
            Toast.success(result.message);
            await this.refreshData();
            if (typeof HomePage !== 'undefined') HomePage.refreshStats();
        } catch (e) {
            Toast.error(e.message);
        }
    },

    async refreshData() {
        try {
            const data = await API.get('/garden/plots');
            this._plots = data.plots || [];
            this._seeds = data.seeds || [];
            const harvestData = await API.get('/garden/harvest-inventory');
            this._harvests = harvestData.items || [];
            this.refreshUI();
        } catch (e) { }
    },

    refreshUI() {
        // Update plots grid
        const grid = document.querySelector('#garden-modal .garden-grid');
        if (grid) {
            grid.innerHTML = this._plots.map(p => this.renderPlot(p)).join('');
        }
        // Update seeds
        const seedsRow = document.querySelector('#garden-modal .garden-seeds-row');
        if (seedsRow) {
            seedsRow.innerHTML = this._seeds.length > 0
                ? this._seeds.map(s => `
                    <div class="garden-seed-item ${this._selectedSeed === s.item_id ? 'selected' : ''}"
                         onclick="GardenPage.selectSeed(${s.item_id})" title="${s.description}">
                        <span class="seed-icon">${s.icon}</span>
                        <span class="seed-name">${s.name.replace('Hạt ', '')} <span class="seed-qty">x${s.quantity}</span></span>
                    </div>
                `).join('')
                : '<div style="text-align:center;opacity:0.5;font-size:0.8rem;padding:8px">Chưa có hạt giống. Mua ở Chợ Phiên!</div>';
        }
        // Update harvests
        const harvestSection = document.querySelector('#garden-modal .garden-harvest-section');
        if (harvestSection && this._harvests.length > 0) {
            harvestSection.querySelector('.garden-harvest-grid').innerHTML = this._harvests.map(h => `
                <div class="harvest-item">
                    <div class="harvest-icon">${h.harvest_icon}</div>
                    <div class="harvest-info">
                        <div class="harvest-name">${h.harvest_name} <span class="harvest-qty">x${h.quantity}</span></div>
                        <div class="harvest-actions">
                            <button class="harvest-btn sell" onclick="GardenPage.sellHarvest('${h.harvest_name.replace(/'/g, "\\'")}')">💰 ${h.sell_price}xu</button>
                            <button class="harvest-btn feed" onclick="GardenPage.feedDragon('${h.harvest_name.replace(/'/g, "\\'")}')">🐉 ${h.exp_value}XP${h.fav_element ? ' ⭐' + this.getElemEmoji(h.fav_element) : ''}</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    },

    startAutoRefresh() {
        if (this._refreshTimer) clearInterval(this._refreshTimer);
        this._refreshTimer = setInterval(() => {
            // Only refresh if modal is visible
            if (document.querySelector('#garden-modal')?.style.display !== 'none') {
                this.refreshData();
            } else {
                clearInterval(this._refreshTimer);
            }
        }, 10000);
    }
};
