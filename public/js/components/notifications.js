/**
 * Notifications — Toast notifications and celebrations
 */
const Toast = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'success', duration = 3000) {
        this.init();
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || '📢'}</span>
            <span class="toast-message">${message}</span>
        `;
        this.container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error', 5000); },
    warning(msg) { this.show(msg, 'warning'); },
    info(msg) { this.show(msg, 'info'); },
};

/**
 * Celebration overlay for rank-ups and achievements
 */
const Celebration = {
    show({ icon, title, subtitle, duration = 3000 }) {
        const overlay = document.createElement('div');
        overlay.className = 'celebration-overlay';
        overlay.innerHTML = `
            <div class="celebration-content">
                <div class="celebration-icon">${icon}</div>
                <div class="celebration-title">${title}</div>
                <div class="celebration-subtitle">${subtitle}</div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Add confetti particles
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: ${Math.random() * 10 + 5}px;
                height: ${Math.random() * 10 + 5}px;
                background: hsl(${Math.random() * 360}, 80%, 60%);
                left: ${Math.random() * 100}%;
                top: -20px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                animation: confettiFall ${Math.random() * 2 + 2}s ease-in forwards;
                animation-delay: ${Math.random() * 0.5}s;
            `;
            overlay.appendChild(particle);
        }

        // Add confetti animation if not exists
        if (!document.getElementById('confetti-style')) {
            const style = document.createElement('style');
            style.id = 'confetti-style';
            style.textContent = `
                @keyframes confettiFall {
                    to {
                        top: 100%;
                        transform: rotate(${Math.random() * 720}deg) translateX(${Math.random() * 200 - 100}px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        requestAnimationFrame(() => overlay.classList.add('active'));

        setTimeout(() => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 400);
        }, duration);

        overlay.addEventListener('click', () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 400);
        });
    }
};
