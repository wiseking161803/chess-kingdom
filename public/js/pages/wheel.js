/**
 * Lucky Wheel Page — Cây Đa May Mắn
 */
const WheelPage = {
    prizes: [],
    spinning: false,
    canvas: null,

    open(totalStars) {
        if (totalStars < 30) {
            Toast.warning('🔒 Cần ít nhất 30 sao để mở khóa Cây Đa May Mắn!');
            return;
        }
        this.loadWheel();
    },

    async loadWheel() {
        try {
            const data = await API.get('/wheel/config');
            this.prizes = data.prizes;

            Modal.create({
                id: 'wheel-modal',
                title: 'Cây Đa May Mắn',
                icon: '🌳',
                content: `
                    <div style="text-align:center;">
                        <div class="text-muted mb-2">Số lượt quay: <strong style="color:var(--primary);">${data.available_spins}</strong></div>
                        <div class="wheel-container">
                            <div class="wheel-pointer"></div>
                            <canvas class="wheel-canvas" id="wheel-canvas" width="300" height="300"></canvas>
                            <div class="wheel-center">🍀</div>
                        </div>
                        <button class="btn btn-accent btn-lg mt-2" id="spin-btn" onclick="WheelPage.spin()" ${data.available_spins <= 0 ? 'disabled' : ''}>
                            🎰 Quay!
                        </button>
                        ${data.available_spins <= 0 ? '<div class="text-small text-muted mt-1">Kiếm thêm sao để nhận lượt quay mới (1 lượt / 1000 ⭐)</div>' : ''}
                    </div>
                `
            });
            Modal.show('wheel-modal');

            // Draw wheel
            setTimeout(() => this.drawWheel(), 100);
        } catch (err) {
            Toast.error(err.message);
        }
    },

    drawWheel() {
        this.canvas = document.getElementById('wheel-canvas');
        if (!this.canvas || this.prizes.length === 0) return;

        const ctx = this.canvas.getContext('2d');
        const W = this.canvas.width;
        const H = this.canvas.height;
        const cx = W / 2;
        const cy = H / 2;
        const radius = W / 2 - 5;
        const sliceAngle = (2 * Math.PI) / this.prizes.length;

        ctx.clearRect(0, 0, W, H);

        this.prizes.forEach((prize, i) => {
            const startAngle = i * sliceAngle - Math.PI / 2;
            const endAngle = startAngle + sliceAngle;

            // Draw slice
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = prize.color || `hsl(${i * (360 / this.prizes.length)}, 70%, 60%)`;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw label
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(startAngle + sliceAngle / 2);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px "Baloo 2", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const label = prize.label.length > 12 ? prize.label.substring(0, 12) + '…' : prize.label;
            ctx.fillText(label, radius * 0.6, 0);
            ctx.restore();
        });
    },

    async spin() {
        if (this.spinning) return;
        this.spinning = true;

        const spinBtn = document.getElementById('spin-btn');
        spinBtn.disabled = true;
        spinBtn.textContent = '⏳ Đang quay...';

        try {
            const result = await API.post('/wheel/spin');

            // Find prize index
            const prizeIndex = this.prizes.findIndex(p => p.id === result.prize.id);
            const sliceAngle = 360 / this.prizes.length;
            const targetAngle = 360 - (prizeIndex * sliceAngle + sliceAngle / 2) + 90;
            const totalRotation = 360 * 5 + targetAngle; // 5 full rotations + target

            // Animate
            this.canvas.style.transform = `rotate(${totalRotation}deg)`;

            // Show result after animation
            setTimeout(() => {
                const rarityEmoji = { common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟡' };

                Celebration.show({
                    icon: rarityEmoji[result.prize.rarity] || '🎁',
                    title: result.prize.label,
                    subtitle: result.message,
                    duration: result.prize.rarity === 'legendary' ? 5000 : 3000
                });

                this.spinning = false;
                spinBtn.textContent = '🎰 Quay!';
                spinBtn.disabled = result.remaining_spins <= 0;

                // Update spin count
                const countEl = document.querySelector('#wheel-modal .text-muted strong');
                if (countEl) countEl.textContent = result.remaining_spins;

                if (typeof HomePage !== 'undefined') HomePage.refreshStats();
            }, 4500);
        } catch (err) {
            Toast.error(err.message);
            this.spinning = false;
            spinBtn.disabled = false;
            spinBtn.textContent = '🎰 Quay!';
        }
    }
};
