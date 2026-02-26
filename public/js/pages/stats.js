/**
 * Stats Page — Student Dashboard with Charts
 * Uses Chart.js for ELO trend, puzzle activity, and accuracy
 */
const StatsPage = {
    charts: [],

    async open() {
        try {
            const [chartData, stats] = await Promise.all([
                API.get('/gamification/stats/chart'),
                API.get('/gamification/stats')
            ]);

            Modal.create({
                id: 'stats-modal',
                title: 'Thống Kê Cá Nhân',
                icon: '📊',
                size: 'modal-xl',
                content: `
                    <div class="stats-dashboard">
                        <!-- Summary Cards -->
                        <div class="stats-summary-row">
                            <div class="stats-card stats-card-elo">
                                <div class="stats-card-icon">♟️</div>
                                <div class="stats-card-value">${stats.current_elo}</div>
                                <div class="stats-card-label">ELO hiện tại</div>
                                <div class="stats-card-sub">Cao nhất: ${stats.peak_elo}</div>
                            </div>
                            <div class="stats-card stats-card-solved">
                                <div class="stats-card-icon">✅</div>
                                <div class="stats-card-value">${stats.puzzles_solved}</div>
                                <div class="stats-card-label">Bài đã giải</div>
                                <div class="stats-card-sub">${chartData.accuracy.attempted > 0 ? Math.round(chartData.accuracy.solved / chartData.accuracy.attempted * 100) : 0}% chính xác</div>
                            </div>
                            <div class="stats-card stats-card-streak">
                                <div class="stats-card-icon">🔥</div>
                                <div class="stats-card-value">${chartData.streak.current}</div>
                                <div class="stats-card-label">Streak hiện tại</div>
                                <div class="stats-card-sub">Kỷ lục: ${chartData.streak.longest} ngày</div>
                            </div>
                            <div class="stats-card stats-card-stars">
                                <div class="stats-card-icon">⭐</div>
                                <div class="stats-card-value">${stats.knowledge_stars}</div>
                                <div class="stats-card-label">Sao Tri Thức</div>
                                <div class="stats-card-sub">Tổng: ${stats.total_stars_earned}</div>
                            </div>
                        </div>

                        <!-- Charts Row -->
                        <div class="stats-charts-row">
                            <div class="stats-chart-card">
                                <div class="stats-chart-title">📈 ELO 30 Ngày</div>
                                <canvas id="stats-elo-chart" height="200"></canvas>
                            </div>
                            <div class="stats-chart-card">
                                <div class="stats-chart-title">📊 Bài Giải / Ngày</div>
                                <canvas id="stats-puzzle-chart" height="200"></canvas>
                            </div>
                        </div>

                        <div class="stats-charts-row">
                            <div class="stats-chart-card stats-chart-small">
                                <div class="stats-chart-title">🎯 Độ Chính Xác</div>
                                <canvas id="stats-accuracy-chart" height="180"></canvas>
                            </div>
                            <div class="stats-chart-card stats-chart-calendar">
                                <div class="stats-chart-title">📅 Lịch Hoạt Động (30 ngày)</div>
                                <div id="stats-streak-calendar" class="streak-calendar"></div>
                            </div>
                        </div>
                    </div>
                `
            });
            Modal.show('stats-modal');

            // Wait for DOM then render charts
            setTimeout(() => this.renderCharts(chartData), 100);
        } catch (err) {
            Toast.error(err.message);
        }
    },

    renderCharts(data) {
        // Destroy old charts
        this.charts.forEach(c => c.destroy());
        this.charts = [];

        const chartColors = {
            primary: '#6C5CE7',
            primaryLight: 'rgba(108, 92, 231, 0.15)',
            success: '#00B894',
            successLight: 'rgba(0, 184, 148, 0.15)',
            danger: '#FF7675',
            accent: '#FDCB6E',
            text: '#2D3436',
            grid: 'rgba(0,0,0,0.05)'
        };

        // 1. ELO Line Chart
        const eloCtx = document.getElementById('stats-elo-chart');
        if (eloCtx && data.elo_history.length > 0) {
            const labels = data.elo_history.map(h => {
                const d = new Date(h.record_date);
                return `${d.getDate()}/${d.getMonth() + 1}`;
            });
            this.charts.push(new Chart(eloCtx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'ELO',
                        data: data.elo_history.map(h => h.elo),
                        borderColor: chartColors.primary,
                        backgroundColor: chartColors.primaryLight,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        borderWidth: 2.5
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: { backgroundColor: '#2D3436', padding: 10, cornerRadius: 8 }
                    },
                    scales: {
                        y: { grid: { color: chartColors.grid }, ticks: { font: { size: 11 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } }
                    }
                }
            }));
        } else if (eloCtx) {
            eloCtx.parentElement.innerHTML += '<div class="stats-empty">Chưa có dữ liệu ELO. Hãy giải puzzle!</div>';
        }

        // 2. Puzzles per Day Bar Chart
        const puzzleCtx = document.getElementById('stats-puzzle-chart');
        if (puzzleCtx && data.daily_puzzles.length > 0) {
            const labels = data.daily_puzzles.map(d => {
                const dt = new Date(d.day);
                return `${dt.getDate()}/${dt.getMonth() + 1}`;
            });
            this.charts.push(new Chart(puzzleCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Bài giải',
                        data: data.daily_puzzles.map(d => d.solved),
                        backgroundColor: chartColors.success,
                        borderRadius: 6,
                        borderSkipped: false,
                        barPercentage: 0.7
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: { backgroundColor: '#2D3436', padding: 10, cornerRadius: 8 }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: chartColors.grid }, ticks: { stepSize: 1, font: { size: 11 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } }
                    }
                }
            }));
        } else if (puzzleCtx) {
            puzzleCtx.parentElement.innerHTML += '<div class="stats-empty">Chưa có dữ liệu.</div>';
        }

        // 3. Accuracy Doughnut
        const accCtx = document.getElementById('stats-accuracy-chart');
        if (accCtx && data.accuracy.attempted > 0) {
            const correct = data.accuracy.solved;
            const wrong = data.accuracy.attempted - data.accuracy.solved;
            this.charts.push(new Chart(accCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Đúng', 'Sai'],
                    datasets: [{
                        data: [correct, wrong],
                        backgroundColor: [chartColors.success, chartColors.danger],
                        borderWidth: 0,
                        cutout: '70%'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 15 } },
                        tooltip: { backgroundColor: '#2D3436', padding: 10, cornerRadius: 8 }
                    }
                },
                plugins: [{
                    id: 'centerText',
                    afterDraw(chart) {
                        const { ctx, width, height } = chart;
                        const pct = data.accuracy.attempted > 0 ? Math.round(correct / data.accuracy.attempted * 100) : 0;
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.font = 'bold 28px Baloo 2';
                        ctx.fillStyle = chartColors.text;
                        ctx.fillText(`${pct}%`, width / 2, height / 2 - 10);
                        ctx.font = '13px Baloo 2';
                        ctx.fillStyle = '#636E72';
                        ctx.fillText('chính xác', width / 2, height / 2 + 18);
                        ctx.restore();
                    }
                }]
            }));
        } else if (accCtx) {
            accCtx.parentElement.innerHTML += '<div class="stats-empty">Chưa có dữ liệu.</div>';
        }

        // 4. Streak Calendar (CSS grid)
        const calEl = document.getElementById('stats-streak-calendar');
        if (calEl) {
            const activeDaysSet = new Set(
                (data.active_days || []).map(d => {
                    const dt = new Date(d);
                    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                })
            );

            let html = '<div class="calendar-grid">';
            const today = new Date();
            for (let i = 29; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const isActive = activeDaysSet.has(key);
                const isToday = i === 0;
                const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
                html += `<div class="calendar-day ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}" title="${dayLabel}">
                    <span class="calendar-day-num">${d.getDate()}</span>
                </div>`;
            }
            html += '</div>';
            calEl.innerHTML = html;
        }
    }
};
