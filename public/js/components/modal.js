/**
 * Modal Component — Reusable modal system
 */
const Modal = {
    activeModal: null,

    show(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('active');
        this.activeModal = id;
        document.body.style.overflow = 'hidden';
    },

    hide(id) {
        const modal = document.getElementById(id || this.activeModal);
        if (!modal) return;
        modal.classList.remove('active');
        this.activeModal = null;
        document.body.style.overflow = '';
    },

    create({ id, title, icon, content, size = '', onClose }) {
        // Remove existing
        const existing = document.getElementById(id);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content ${size}">
                <div class="modal-header">
                    <div class="modal-title">${icon ? `<span>${icon}</span>` : ''} ${title}</div>
                    <button class="modal-close" data-close="${id}">&times;</button>
                </div>
                <div class="modal-body">${content}</div>
            </div>
        `;

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hide(id);
        });

        // Close button
        modal.querySelector('.modal-close').addEventListener('click', () => {
            this.hide(id);
            if (onClose) onClose();
        });

        document.body.appendChild(modal);
        return modal;
    }
};

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && Modal.activeModal) {
        Modal.hide();
    }
});
