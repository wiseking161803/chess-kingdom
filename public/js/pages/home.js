/**
 * Home Page — Village Map
 * Uses user's custom background.jpg (2752x1536, ~16:9)
 * Path-based character movement along dirt roads
 */
const HomePage = {
    isMoving: false,

    // Waypoints along dirt roads (% of image)
    waypoints: {
        // Road junctions
        J_center: { x: 42, y: 48 },   // center cross near pond
        J_topMid: { x: 38, y: 30 },   // upper path junction
        J_topRight: { x: 55, y: 25 },   // path near temple top
        J_right: { x: 62, y: 42 },   // right side of temple
        J_botRight: { x: 65, y: 58 },   // lower-right path
        J_botLeft: { x: 30, y: 58 },   // lower-left near school
        J_left: { x: 22, y: 42 },   // left path
        J_topLeft: { x: 25, y: 28 },   // upper-left near tower
        J_farRight: { x: 78, y: 50 },   // far-right toward market/tree
        J_farLeft: { x: 12, y: 48 },   // far-left toward cave
        J_bottom: { x: 42, y: 72 },   // bottom center

        // Building endpoints
        B_puzzle: { x: 28, y: 18 },   // Blue tower
        B_school: { x: 18, y: 38 },   // Red school
        B_hall: { x: 48, y: 30 },   // Golden temple
        B_market: { x: 76, y: 47 },   // Market stalls
        B_tree: { x: 88, y: 72 },   // Magic tree
        B_mountain: { x: 88, y: 19 },   // Purple mountain
        B_dragon: { x: 6, y: 55 },   // Dragon cave
        B_pond: { x: 42, y: 65 },   // Wishing pond
        B_world: { x: 50, y: 17 },   // World map
        B_garden: { x: 48, y: 85 },  // Garden farm
    },

    edges: [
        // Central ring
        ['J_center', 'J_topMid'], ['J_center', 'J_right'],
        ['J_center', 'J_botLeft'], ['J_center', 'J_left'],
        ['J_center', 'J_bottom'],

        // Top connections
        ['J_topMid', 'J_topLeft'], ['J_topMid', 'J_topRight'],
        ['J_topRight', 'J_right'],

        // Right side
        ['J_right', 'J_botRight'], ['J_right', 'J_farRight'],

        // Left side
        ['J_left', 'J_topLeft'], ['J_left', 'J_botLeft'],
        ['J_left', 'J_farLeft'],

        // Bottom
        ['J_botLeft', 'J_bottom'], ['J_botRight', 'J_bottom'],

        // Buildings
        ['J_topLeft', 'B_puzzle'],
        ['J_left', 'B_school'],
        ['J_topRight', 'B_hall'], ['J_topMid', 'B_hall'],
        ['J_farRight', 'B_market'],
        ['J_farRight', 'B_tree'],
        ['J_topRight', 'B_mountain'],
        ['J_farLeft', 'B_dragon'],
        ['J_center', 'B_pond'],
        ['J_bottom', 'B_garden'],
    ],

    currentWaypoint: 'J_bottom',

    getGraph() {
        const graph = {};
        for (const wp of Object.keys(this.waypoints)) graph[wp] = [];
        for (const [a, b] of this.edges) {
            graph[a].push(b);
            graph[b].push(a);
        }
        return graph;
    },

    findPath(start, end) {
        if (start === end) return [end];
        const graph = this.getGraph();
        const visited = new Set([start]);
        const queue = [[start, [start]]];
        while (queue.length) {
            const [node, path] = queue.shift();
            for (const neighbor of (graph[node] || [])) {
                if (visited.has(neighbor)) continue;
                const newPath = [...path, neighbor];
                if (neighbor === end) return newPath;
                visited.add(neighbor);
                queue.push([neighbor, newPath]);
            }
        }
        return [start, end];
    },

    render() {
        const user = App.user || {};
        const stats = user.stats || {};
        const totalStars = stats.total_stars_earned || 0;

        return `
        <div class="app-header">
            <div class="header-inner">
                <button class="sidebar-toggle" onclick="HomePage.toggleSidebar()" aria-label="Menu">☰</button>
                <div class="header-logo">
                    <span class="logo-icon">♟️</span>
                    Vương Quốc Cờ Vua
                </div>
                <div class="header-stats">
                    <div class="stat-badge" title="Sao Tri Thức">
                        <span class="stat-icon">⭐</span>
                        <span id="header-stars">${stats.knowledge_stars || 0}</span>
                    </div>
                    <div class="stat-badge" title="Xu Cờ">
                        <span class="stat-icon">🪙</span>
                        <span id="header-coins">${stats.chess_coins || 0}</span>
                    </div>
                    <div class="stat-badge" title="ELO Rating">
                        <span class="stat-icon">📊</span>
                        <span id="header-elo">${stats.elo || 800}</span>
                    </div>
                    <div class="stat-badge" title="Chuỗi ngày">
                        <span class="stat-icon">🔥</span>
                        <span id="header-streak">${stats.current_streak || 0}</span>
                    </div>
                </div>
                <div class="header-user">
                    <div class="user-info">
                        <div class="user-name">${user.display_name || 'Hiệp Sĩ'}</div>
                        <div class="user-rank">${user.current_rank || 'Tân Binh Trí Tuệ'}</div>
                    </div>
                    <div class="user-avatar" onclick="event.stopPropagation(); AvatarSelector.showSelector();" title="Đổi nhân vật">${AvatarSelector.getCurrentAvatar()}</div>
                </div>
                <div class="header-actions">
                    <button class="header-btn header-btn-badge" onclick="BadgeShowcase.show()" title="Thành tích">🏅</button>
                    <button class="header-btn" onclick="StatsPage.open()">📊</button>
                    ${user.role === 'admin' ? '<button class="header-btn" onclick="App.navigate(\'admin\')">⚙️ Admin</button>' : ''}
                    <button class="header-btn" onclick="App.logout()">🚪</button>
                </div>
            </div>
        </div>

        <!-- Mobile Sidebar -->
        <div class="sidebar-overlay" id="sidebar-overlay" onclick="HomePage.toggleSidebar()"></div>
        <div class="sidebar-drawer" id="sidebar-drawer">
            <div class="sidebar-header">
                <div class="sidebar-avatar" onclick="AvatarSelector.showSelector(); HomePage.toggleSidebar();">${AvatarSelector.getCurrentAvatar()}</div>
                <div class="sidebar-user-name">${user.display_name || 'Hiệp Sĩ'}</div>
                <div class="sidebar-user-rank">${user.current_rank || 'Tân Binh Trí Tuệ'}</div>
                <button class="sidebar-close" onclick="HomePage.toggleSidebar()">✕</button>
            </div>
            <div class="sidebar-stats">
                <div class="sidebar-stat"><span class="sidebar-stat-icon">⭐</span><span class="sidebar-stat-label">Sao Tri Thức</span><span class="sidebar-stat-value" id="sidebar-stars">${stats.knowledge_stars || 0}</span></div>
                <div class="sidebar-stat"><span class="sidebar-stat-icon">🪙</span><span class="sidebar-stat-label">Xu Cờ</span><span class="sidebar-stat-value" id="sidebar-coins">${stats.chess_coins || 0}</span></div>
                <div class="sidebar-stat"><span class="sidebar-stat-icon">📊</span><span class="sidebar-stat-label">ELO Rating</span><span class="sidebar-stat-value" id="sidebar-elo">${stats.elo || 800}</span></div>
                <div class="sidebar-stat"><span class="sidebar-stat-icon">🔥</span><span class="sidebar-stat-label">Chuỗi ngày</span><span class="sidebar-stat-value" id="sidebar-streak">${stats.current_streak || 0}</span></div>
            </div>
            <div class="sidebar-actions">
                <button class="sidebar-action-btn" onclick="BadgeShowcase.show(); HomePage.toggleSidebar();">🏅 Thành tích</button>
                <button class="sidebar-action-btn" onclick="StatsPage.open(); HomePage.toggleSidebar();">📊 Thống kê</button>
                <button class="sidebar-action-btn" onclick="HomePage.openInventory(); HomePage.toggleSidebar();">🎒 Kho đồ</button>
                ${user.role === 'admin' ? '<button class="sidebar-action-btn" onclick="App.navigate(\'admin\'); HomePage.toggleSidebar();">⚙️ Admin</button>' : ''}
                <button class="sidebar-action-btn sidebar-action-btn--danger" onclick="App.logout();">🚪 Đăng xuất</button>
            </div>
        </div>

        <div class="village-map" id="village-map">
          <div class="village-map-inner">
            <img class="village-bg" src="/img/map/village-bg.jpg" alt="Village map" draggable="false" />

            <!-- Tháp Kỳ Vương — Blue Tower (upper-left) -->
            <div class="building" data-id="puzzle" data-sound="chime" style="left:28%;top:18%;--glow-color:#6C9EFF;"
                 onclick="HomePage.goToBuilding('B_puzzle', function(){ App.navigate('tower'); })">
                <div class="building-particles particles--sparkles"><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i></div>
                <div class="building-label">
                    <span class="label-icon">🏰</span>
                    <span class="label-text">Tháp Kỳ Vương</span>
                </div>
            </div>

            <!-- Trường Học — Red School (left) -->
            <div class="building" data-id="school" data-sound="bell" style="left:18%;top:38%;--glow-color:#FF6B8A;"
                 onclick="HomePage.goToBuilding('B_school', function(){ App.navigate('school'); })">
                <div class="building-particles particles--butterflies"><i class="p">🦋</i><i class="p">🦋</i><i class="p">🦋</i><i class="p">🦋</i><i class="p">🦋</i><i class="p">🦋</i></div>
                <div class="building-label">
                    <span class="label-icon">🏫</span>
                    <span class="label-text">Trường Học</span>
                </div>
            </div>

            <!-- Đình Làng — Golden Temple (center-top) -->
            <div class="building building--large" data-id="hall" data-sound="gong" style="left:48%;top:30%;--glow-color:#FFD700;"
                 onclick="HomePage.goToBuilding('B_hall', function(){ HallPage.open(); })">
                <div class="building-particles particles--golden"><i class="p">⭐</i><i class="p">⭐</i><i class="p">⭐</i><i class="p">⭐</i><i class="p">⭐</i><i class="p">⭐</i></div>
                <div class="building-label building-label--gold">
                    <span class="label-icon">🏛️</span>
                    <span class="label-text">Đình Làng</span>
                </div>
            </div>

            <!-- Chợ Phiên — Market (right) -->
            <div class="building ${totalStars < 100 ? 'building--locked' : ''}" data-id="market" data-sound="coin" style="left:76%;top:47%;--glow-color:#FF9F43;"
                 onclick="HomePage.goToBuilding('B_market', function(){ ShopPage.open(${totalStars}); }, ${totalStars < 100})">
                <div class="building-particles particles--coins"><i class="p">🪙</i><i class="p">🪙</i><i class="p">🪙</i><i class="p">🪙</i><i class="p">🪙</i><i class="p">🪙</i></div>
                <div class="building-label">
                    <span class="label-icon">🏪</span>
                    <span class="label-text">Chợ Phiên</span>
                    ${totalStars < 100 ? '<span class="lock-badge">🔒 100⭐</span>' : ''}
                </div>
            </div>

            <!-- Cây Đa — Magic Tree (lower-right) -->
            <div class="building ${totalStars < 1000 ? 'building--locked' : ''}" data-id="tree" data-sound="wind" style="left:88%;top:72%;--glow-color:#7FFF00;"
                 onclick="HomePage.goToBuilding('B_tree', function(){ WheelPage.open(${totalStars}); }, ${totalStars < 1000})">
                <div class="building-particles particles--fireflies"><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i></div>
                <div class="building-label building-label--green">
                    <span class="label-icon">🌳</span>
                    <span class="label-text">Cây Đa May Mắn</span>
                    ${totalStars < 1000 ? '<span class="lock-badge">🔒 1000⭐</span>' : ''}
                </div>
            </div>

            <!-- Núi Danh Vọng — Mountain (top-right) -->
            <div class="building" data-id="mountain" data-sound="whistle" style="left:88%;top:19%;--glow-color:#B088FF;"
                 onclick="HomePage.goToBuilding('B_mountain', function(){ MountainPage.open(); })">
                <div class="building-particles particles--snow"><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i></div>
                <div class="building-label building-label--purple">
                    <span class="label-icon">⛰️</span>
                    <span class="label-text">Núi Danh Vọng</span>
                </div>
            </div>

            <!-- Hang Rồng — Dragon Cave (far-left) -->
            <div class="building ${totalStars < 600 ? 'building--locked' : ''}" data-id="dragon" data-sound="rumble" style="left:6%;top:55%;--glow-color:#FF4500;"
                 onclick="HomePage.goToBuilding('B_dragon', function(){ DragonPage.open(); }, ${totalStars < 600})">
                <div class="building-particles particles--embers"><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i></div>
                <div class="building-label building-label--dark">
                    <span class="label-icon">🐉</span>
                    <span class="label-text">Hang Rồng</span>
                    ${totalStars < 600 ? '<span class="lock-badge">🔒 600⭐</span>' : ''}
                </div>
            </div>

            <!-- Ao Ước Nguyện — Wishing Pond (center) -->
            <div class="building ${totalStars < 1000 ? 'building--locked' : ''}" data-id="pond" data-sound="chime" style="left:42%;top:65%;--glow-color:#E91E63;"
                 onclick="HomePage.goToBuilding('B_pond', function(){ PondPage.open(); }, ${totalStars < 1000})">
                <div class="building-particles particles--sparkles"><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i></div>
                <div class="building-label building-label--pink">
                    <span class="label-icon">🪷</span>
                    <span class="label-text">Ao Ước Nguyện</span>
                    ${totalStars < 1000 ? '<span class="lock-badge">🔒 1000⭐</span>' : ''}
                </div>
            </div>

            <!-- Vườn Cây — Garden Farm (below pond) -->
            <div class="building ${totalStars < 200 ? 'building--locked' : ''}" data-id="garden" data-sound="chime" style="left:48%;top:85%;--glow-color:#27ae60;"
                 onclick="HomePage.goToBuilding('B_garden', function(){ GardenPage.open(); }, ${totalStars < 200})">
                <div class="building-particles particles--butterflies"><i class="p">🌱</i><i class="p">🌿</i><i class="p">🍃</i><i class="p">🌱</i><i class="p">🌿</i><i class="p">🍃</i></div>
                <div class="building-label building-label--green">
                    <span class="label-icon">🌾</span>
                    <span class="label-text">Vườn Cây</span>
                    ${totalStars < 200 ? '<span class="lock-badge">🔒 200⭐</span>' : ''}
                </div>
            </div>

            <!-- Ra Thế Giới — World Map (center-top field) -->
            <div class="building" data-id="world" data-sound="wind" style="left:50%;top:17%;--glow-color:#3498DB;"
                 onclick="window.location.href='/world'">
                <img src="/img/map/world_portal.png" class="building-landmark" alt="Portal" style="width:90px;height:90px;object-fit:contain;margin:-20px auto 0;display:block;filter:drop-shadow(0 0 12px rgba(52,152,219,0.5));animation:portalFloat 3s ease-in-out infinite;">
                <div class="building-particles particles--sparkles"><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i><i class="p"></i></div>
                <div class="building-label building-label--blue">
                    <span class="label-icon">🌍</span>
                    <span class="label-text">Ra Thế Giới</span>
                </div>
            </div>

            <!-- Player Character -->
            <div class="player-character" id="player-char" style="left:42%;top:72%;">
                <div class="player-shadow"></div>
                <div class="player-body">${AvatarSelector.getCurrentAvatar()}</div>
                <div class="player-name">${user.display_name || 'Hiệp Sĩ'}</div>
            </div>

            <!-- Floating Buttons -->
            <div style="position:fixed;bottom:20px;right:20px;z-index:100;display:flex;flex-direction:column;gap:8px;">
                <button onclick="HomePage.openInventory()" style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#8B5CF6,#6D28D9);border:3px solid rgba(255,255,255,0.3);font-size:1.5rem;cursor:pointer;box-shadow:0 4px 20px rgba(139,92,246,0.4);transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">🎒</button>
            </div>
            <!-- Music & SFX Controls -->
            <div class="music-controls">
                <button class="music-btn ${BGMusic._enabled ? 'active' : ''}" onclick="const on=BGMusic.toggle(); this.classList.toggle('active',on); this.textContent=on?'🎵':'🔇';" title="Nhạc nền">${BGMusic._enabled ? '🎵' : '🔇'}</button>
            </div>
          </div>
        </div>
        `;
    },

    init() {
        this.refreshStats();
        this.currentWaypoint = 'J_bottom';
        this.initSounds();

        // A2: Start ambient village animations
        VillageAmbience.start();

        // A3: Daily login popup
        DailyLogin.check();

        // E1-E3: Touch enhancements
        TouchEnhance.init();

        // F1: Start background music (user gesture required)
        document.addEventListener('click', () => BGMusic.start(), { once: true });

        // Load active buffs overlay
        this.loadBuffOverlay();
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar-drawer');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && overlay) {
            sidebar.classList.toggle('sidebar-open');
            overlay.classList.toggle('sidebar-open');
        }
    },

    async loadBuffOverlay() {
        try {
            const data = await API.get('/dragon/inventory');
            const buffs = data.active_buffs || [];
            let container = document.getElementById('buff-overlay');
            if (!container) {
                container = document.createElement('div');
                container.id = 'buff-overlay';
                container.style.cssText = 'position:fixed;top:60px;right:10px;z-index:900;display:flex;flex-direction:column;gap:4px;pointer-events:none;';
                document.body.appendChild(container);
            }
            if (buffs.length === 0) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = buffs.map(b => {
                const exp = new Date(b.expires_at);
                const remain = Math.max(0, Math.ceil((exp - Date.now()) / 60000));
                const hrs = Math.floor(remain / 60);
                const mins = remain % 60;
                const label = b.buff_type === 'att_boost_100' ? '⚔️ ATT+100%'
                    : b.buff_type === 'def_boost_50' ? '🛡️ DEF+50%'
                        : b.buff_type;
                const color = b.buff_type.includes('att') ? '#e74c3c' : '#2ecc71';
                return `<div style="pointer-events:auto;background:rgba(0,0,0,0.75);border:1.5px solid ${color};border-radius:8px;padding:4px 10px;font-size:0.72rem;color:#fff;backdrop-filter:blur(6px);display:flex;align-items:center;gap:6px;animation:fadeIn 0.3s">
                    <span style="font-weight:700;color:${color}">${label}</span>
                    <span style="opacity:0.7;font-size:0.65rem">${hrs}h${mins}m</span>
                </div>`;
            }).join('');

            // Auto-refresh every 60s
            if (this._buffTimer) clearTimeout(this._buffTimer);
            this._buffTimer = setTimeout(() => this.loadBuffOverlay(), 60000);
        } catch (e) { /* silently skip */ }
    },

    goToBuilding(targetWP, callback, isLocked) {
        if (this.isMoving) return;
        if (isLocked) {
            Toast.info('🔒 Khu vực này chưa mở khóa. Hãy thu thập thêm sao!');
            return;
        }

        const path = this.findPath(this.currentWaypoint, targetWP);
        if (path.length <= 1) { callback(); return; }

        this.isMoving = true;
        const char = document.getElementById('player-char');
        if (!char) { callback(); return; }

        char.classList.add('player--walking');

        let step = 1;
        const walkStep = () => {
            if (step >= path.length) {
                char.classList.remove('player--walking');
                this.isMoving = false;
                this.currentWaypoint = targetWP;
                const buildingEl = document.querySelector(`[data-id]`);
                setTimeout(() => callback(), 350);
                return;
            }

            const wp = this.waypoints[path[step]];
            const prevWp = this.waypoints[path[step - 1]];
            const dx = wp.x - prevWp.x;
            const dist = Math.sqrt(dx * dx + Math.pow(wp.y - prevWp.y, 2));
            const duration = Math.max(150, dist * 12);

            if (dx < -2) char.classList.add('player--flip');
            else if (dx > 2) char.classList.remove('player--flip');

            char.style.transition = `left ${duration}ms linear, top ${duration}ms linear`;
            char.style.left = wp.x + '%';
            char.style.top = wp.y + '%';

            step++;
            setTimeout(walkStep, duration);
        };

        walkStep();
    },

    async refreshStats() {
        try {
            const data = await API.get('/auth/me');
            App.user = data.user;
            const s = data.user.stats;
            const el = (id) => document.getElementById(id);
            if (el('header-stars')) el('header-stars').textContent = s.knowledge_stars;
            if (el('header-coins')) el('header-coins').textContent = s.chess_coins;
            if (el('header-elo')) el('header-elo').textContent = s.elo;
            if (el('header-streak')) el('header-streak').textContent = s.current_streak;
            // Also update sidebar stats
            if (el('sidebar-stars')) el('sidebar-stars').textContent = s.knowledge_stars;
            if (el('sidebar-coins')) el('sidebar-coins').textContent = s.chess_coins;
            if (el('sidebar-elo')) el('sidebar-elo').textContent = s.elo;
            if (el('sidebar-streak')) el('sidebar-streak').textContent = s.current_streak;
        } catch (err) { }
    },

    async openInventory() {
        try {
            const data = await API.get('/shop/inventory');

            // Active buffs
            let buffHtml = '';
            try {
                const dragonData = await API.get('/dragon/inventory');
                const buffs = dragonData.active_buffs || [];
                if (buffs.length > 0) {
                    buffHtml = '<div style="margin-bottom:12px;padding:8px;background:rgba(46,204,113,0.15);border:1px solid rgba(46,204,113,0.3);border-radius:8px;font-size:0.8rem;">' +
                        '<div style="font-weight:600;margin-bottom:4px;">🛡️ Buff đang hoạt động:</div>' +
                        buffs.map(b => {
                            const exp = new Date(b.expires_at);
                            const remain = Math.max(0, Math.ceil((exp - Date.now()) / 3600000));
                            const label = b.buff_type === 'att_boost_100' ? '⚔️ +100% ATT' : b.buff_type === 'def_boost_50' ? '🛡️ +50% DEF' : b.buff_type;
                            return `<div>${label} — còn ${remain}h</div>`;
                        }).join('') + '</div>';
                }
            } catch (e) { }

            let html = buffHtml;
            const totalItems = (data.inventory?.length || 0) + (data.eggs?.length || 0) + (data.equipment?.length || 0);

            if (totalItems === 0) {
                html += '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.4);">📦 Kho đồ trống. Hãy mua vật phẩm ở Chợ Phiên!</div>';
            } else {
                // === DRAGON EGGS (collapsible) ===
                if (data.eggs && data.eggs.length > 0) {
                    html += `<div style="margin-bottom:10px">
                        <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.inv-arrow').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'" style="font-size:0.85rem;font-weight:700;color:#f39c12;cursor:pointer;padding:6px 0;display:flex;align-items:center;gap:6px;user-select:none">
                            <span class="inv-arrow">▼</span> 🥚 Trứng Rồng (${data.eggs.length})
                        </div>
                        <div>`;
                    for (const egg of data.eggs) {
                        const ready = egg.ready;
                        const mins = Math.floor(egg.time_left / 60);
                        const hrs = Math.floor(mins / 60);
                        const timeStr = ready ? '✅ Sẵn sàng nở!' : `⏳ Còn ${hrs}h ${mins % 60}m`;
                        html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(243,156,18,0.08);border:1.5px solid rgba(243,156,18,0.25);margin-bottom:5px">
                            <div style="font-size:1.5rem">🥚</div>
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:700;font-size:0.8rem">${egg.name || 'Trứng Rồng'}</div>
                                <div style="font-size:0.7rem;color:${ready ? '#2ecc71' : '#f39c12'}">${timeStr}</div>
                            </div>
                            ${ready ? `<button class="btn btn-primary btn-sm" onclick="Modal.hide('inventory-modal');DragonPage.open();setTimeout(()=>DragonPage.switchTab&&DragonPage.switchTab('eggs'),500)" style="font-size:0.7rem;padding:4px 8px;white-space:nowrap">🐣 Nở</button>` : ''}
                        </div>`;
                    }
                    html += '</div></div>';
                }

                // === EQUIPMENT (collapsible) ===
                if (data.equipment && data.equipment.length > 0) {
                    const rc_ = { common: '#9E9E9E', rare: '#2196F3', epic: '#9C27B0', legendary: '#FF9800', mythic: '#FF1493' };
                    const rn_ = { common: 'Thường', rare: 'Hiếm', epic: 'Sử Thi', legendary: 'Huyền Thoại', mythic: 'Thần Thoại' };
                    html += `<div style="margin-bottom:10px">
                        <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.inv-arrow').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'" style="font-size:0.85rem;font-weight:700;color:#9b59b6;cursor:pointer;padding:6px 0;display:flex;align-items:center;gap:6px;user-select:none">
                            <span class="inv-arrow">▼</span> ⚔️ Trang Bị Chưa Đeo (${data.equipment.length})
                        </div>
                        <div>`;
                    for (const eq of data.equipment) {
                        const rc = rc_[eq.rarity] || '#666';
                        html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(155,89,182,0.06);border:1.5px solid ${rc}40;margin-bottom:5px">
                            <div style="font-size:1.4rem">${eq.icon || '⚔️'}</div>
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:700;font-size:0.8rem;color:${rc}">${eq.name}</div>
                                <div style="font-size:0.65rem;opacity:0.6">${rn_[eq.rarity] || eq.rarity} · ${eq.slot || ''}</div>
                            </div>
                            <button class="btn btn-sm" onclick="Modal.hide('inventory-modal');DragonPage.open()" style="font-size:0.68rem;padding:3px 7px;background:${rc}20;border:1px solid ${rc}50;color:${rc}">Trang bị</button>
                        </div>`;
                    }
                    html += '</div></div>';
                }

                // === CONSUMABLE ITEMS (collapsible) ===
                if (data.inventory && data.inventory.length > 0) {
                    html += `<div style="margin-bottom:10px">
                        <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.inv-arrow').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'" style="font-size:0.85rem;font-weight:700;color:#3498db;cursor:pointer;padding:6px 0;display:flex;align-items:center;gap:6px;user-select:none">
                            <span class="inv-arrow">▼</span> 🎒 Vật Phẩm (${data.inventory.length})
                        </div>
                        <div>`;
                    for (const item of data.inventory) {
                        const usable = ['dragon_food', 'dragon_potion', 'dragon_buff'].includes(item.category);
                        html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(52,152,219,0.06);border:1.5px solid rgba(52,152,219,0.2);margin-bottom:5px">
                            <div style="font-size:1.4rem">${item.icon_url || '🎁'}</div>
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:700;font-size:0.8rem">${item.name}</div>
                                <div style="font-size:0.65rem;opacity:0.5">${item.description || ''}</div>
                            </div>
                            <div style="font-size:0.75rem;font-weight:700;color:#3498db;margin-right:4px">x${item.quantity}</div>
                            ${usable ? `<button class="btn btn-primary btn-sm" onclick="Modal.hide('inventory-modal');DragonPage.open()" style="font-size:0.68rem;padding:3px 7px">Dùng</button>` : ''}
                        </div>`;
                    }
                    html += '</div></div>';
                }
            }

            Modal.create({
                id: 'inventory-modal',
                title: '🎒 Kho Đồ',
                icon: '🎒',
                content: `<div style="max-height:400px;overflow-y:auto;">${html}</div>`
            });
            Modal.show('inventory-modal');
        } catch (err) {
            Toast.error(err.message || 'Lỗi tải kho đồ');
        }
    },

    async useItem(itemId) {
        try {
            const result = await API.post('/dragon/use-item', { item_id: itemId });
            Toast.success(result.message);
            Modal.hide('inventory-modal');
            this.openInventory(); // Refresh
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async goToPond(totalStars) {
        if (totalStars < 1500) {
            Toast.warning('🔒 Cần 1500⭐ để mở Ao Ước Nguyện!');
            return;
        }
        // Check membership
        try {
            const mem = await API.get('/payment/check-membership');
            if (!mem.is_premium) {
                Modal.create({
                    id: 'membership-modal',
                    title: 'Membership Cần Thiết',
                    icon: '👑',
                    content: `
                        <div style="text-align:center;padding:20px;">
                            <div style="font-size:4rem;margin-bottom:16px;">👑</div>
                            <h2 style="color:#ffd200;margin-bottom:8px;">Cần Membership để tiếp tục!</h2>
                            <p style="color:rgba(255,255,255,0.6);margin-bottom:24px;">
                                Bạn đã hoàn thành hành trình miễn phí tới 1000⭐!<br>
                                Để tiếp tục khám phá các khu vực cao hơn, hãy nâng cấp tài khoản.
                            </p>
                            <div style="display:flex;flex-direction:column;gap:8px;max-width:300px;margin:0 auto;">
                                <div style="background:rgba(255,210,0,0.1);border:1px solid rgba(255,210,0,0.3);border-radius:8px;padding:12px;">
                                    <div style="font-weight:700;color:#ffd200;">Hộ Chiếu Tháng</div>
                                    <div style="color:#aaa;font-size:0.85rem;">250.000đ/tháng</div>
                                </div>
                                <div style="background:rgba(78,205,196,0.1);border:1px solid rgba(78,205,196,0.3);border-radius:8px;padding:12px;">
                                    <div style="font-weight:700;color:#4ecdc4;">Hộ Chiếu Năm</div>
                                    <div style="color:#aaa;font-size:0.85rem;">2.000.000đ/năm</div>
                                </div>
                                <div style="background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.3);border-radius:8px;padding:12px;">
                                    <div style="font-weight:700;color:#ff6b6b;">Hộ Chiếu Trọn Đời</div>
                                    <div style="color:#aaa;font-size:0.85rem;">5.000.000đ — Mở vĩnh viễn</div>
                                </div>
                            </div>
                            <button class="btn btn-primary mt-2" style="background:linear-gradient(135deg,#f7971e,#ffd200);color:#000;font-weight:700;padding:12px 32px;font-size:1rem;border-radius:12px;border:none;cursor:pointer;"
                                onclick="Modal.hide('membership-modal'); ShopPage.loadShop(); setTimeout(()=>ShopPage.switchTab('premium', document.querySelector('#shop-modal .tab:nth-child(2)')), 300);">
                                💎 Xem Gói Nạp
                            </button>
                        </div>
                    `
                });
                Modal.show('membership-modal');
                return;
            }
            // Premium user — open pond
            this.goToBuilding('B_pond', function () { PondPage.open(); });
        } catch (err) {
            // If API fails, still allow access
            this.goToBuilding('B_pond', function () { PondPage.open(); });
        }
    },

    showDragonCave() {
        Modal.create({
            id: 'dragon-modal',
            title: 'Hang Rồng',
            icon: '🐉',
            content: `
                <div class="locked-content">
                    <div class="locked-icon">🐉</div>
                    <div class="locked-title">Sắp Ra Mắt!</div>
                    <div class="locked-desc">
                        Hang Rồng sẽ mở cửa khi bạn đạt đủ sao.<br>
                        Bạn sẽ được nuôi rồng, cho rồng ăn, và nhận kỹ năng đặc biệt!
                    </div>
                    <div style="margin-top:24px;font-size:3rem;animation:dragonFloat 2s ease-in-out infinite;">🥚</div>
                </div>
                <style>
                    @keyframes dragonFloat {
                        0%,100% { transform: translateY(0) rotate(-5deg); }
                        50% { transform: translateY(-10px) rotate(5deg); }
                    }
                </style>
            `
        });
        Modal.show('dragon-modal');
    },

    /* ======== Sound Manager ======== */
    _audioCtx: null,
    _lastSoundTime: 0,

    initSounds() {
        const buildings = document.querySelectorAll('.building[data-sound]');
        buildings.forEach(b => {
            const handler = () => {
                const now = Date.now();
                if (now - this._lastSoundTime < 500) return;
                this._lastSoundTime = now;
                this.playSound(b.dataset.sound);
            };
            b.addEventListener('mouseenter', handler);
            b.addEventListener('touchstart', handler, { passive: true });
        });
    },

    _getAudioCtx() {
        if (!this._audioCtx) {
            this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this._audioCtx;
    },

    playSound(type) {
        try {
            const ctx = this._getAudioCtx();
            const vol = 0.12;
            const now = ctx.currentTime;
            const gain = ctx.createGain();
            gain.connect(ctx.destination);

            switch (type) {
                case 'chime': {
                    // Crystal chime — two high notes
                    [880, 1320].forEach((freq, i) => {
                        const o = ctx.createOscillator();
                        o.type = 'sine';
                        o.frequency.setValueAtTime(freq, now + i * 0.08);
                        const g = ctx.createGain();
                        g.gain.setValueAtTime(vol, now + i * 0.08);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + i * 0.08);
                        o.connect(g).connect(ctx.destination);
                        o.start(now + i * 0.08);
                        o.stop(now + 0.6 + i * 0.08);
                    });
                    break;
                }
                case 'bell': {
                    // Soft bell
                    const o = ctx.createOscillator();
                    o.type = 'sine';
                    o.frequency.setValueAtTime(660, now);
                    gain.gain.setValueAtTime(vol, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    o.connect(gain);
                    o.start(now);
                    o.stop(now + 0.7);
                    break;
                }
                case 'gong': {
                    // Deep gong
                    const o = ctx.createOscillator();
                    o.type = 'triangle';
                    o.frequency.setValueAtTime(180, now);
                    o.frequency.exponentialRampToValueAtTime(120, now + 0.8);
                    gain.gain.setValueAtTime(vol * 1.5, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
                    o.connect(gain);
                    o.start(now);
                    o.stop(now + 1.1);
                    break;
                }
                case 'coin': {
                    // Coin jingle — quick ascending notes
                    [1047, 1319, 1568].forEach((freq, i) => {
                        const o = ctx.createOscillator();
                        o.type = 'square';
                        o.frequency.setValueAtTime(freq, now + i * 0.06);
                        const g = ctx.createGain();
                        g.gain.setValueAtTime(vol * 0.6, now + i * 0.06);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25 + i * 0.06);
                        o.connect(g).connect(ctx.destination);
                        o.start(now + i * 0.06);
                        o.stop(now + 0.35 + i * 0.06);
                    });
                    break;
                }
                case 'wind': {
                    // Nature wind — filtered noise
                    const bufferSize = ctx.sampleRate * 0.6;
                    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                    const noise = ctx.createBufferSource();
                    noise.buffer = buffer;
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(600, now);
                    filter.Q.setValueAtTime(1, now);
                    gain.gain.setValueAtTime(vol * 0.5, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    noise.connect(filter).connect(gain);
                    noise.start(now);
                    noise.stop(now + 0.6);
                    break;
                }
                case 'whistle': {
                    // Mountain wind whistle
                    const o = ctx.createOscillator();
                    o.type = 'sine';
                    o.frequency.setValueAtTime(800, now);
                    o.frequency.linearRampToValueAtTime(1200, now + 0.2);
                    o.frequency.linearRampToValueAtTime(900, now + 0.5);
                    gain.gain.setValueAtTime(vol * 0.5, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    o.connect(gain);
                    o.start(now);
                    o.stop(now + 0.7);
                    break;
                }
                case 'rumble': {
                    // Dragon rumble — low frequency
                    const o = ctx.createOscillator();
                    o.type = 'sawtooth';
                    o.frequency.setValueAtTime(60, now);
                    o.frequency.exponentialRampToValueAtTime(40, now + 0.6);
                    gain.gain.setValueAtTime(vol, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
                    o.connect(gain);
                    o.start(now);
                    o.stop(now + 0.8);
                    break;
                }
            }
        } catch (e) {
            // Audio not supported or blocked — silently ignore
        }
    }
};
