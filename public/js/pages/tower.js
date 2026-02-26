/**
 * Tower Page — Tháp Kỳ Vương Feature Hub
 * Shows a modal with available features: Chim Gõ Kiến, future courses, etc.
 */
const TowerPage = {
    open() {
        Modal.create({
            id: 'tower-modal',
            title: 'Tháp Kỳ Vương',
            icon: '🏰',
            content: `
                <div class="tower-menu">
                    <div class="tower-intro">
                        <p>Chào mừng đến với <strong>Tháp Kỳ Vương</strong>! Nơi rèn luyện kỹ năng cờ vua với nhiều phương pháp khác nhau.</p>
                    </div>

                    <div class="tower-grid">
                        <!-- Luyện Cờ (Puzzle Training) -->
                        <div class="tower-card tower-card--puzzle" onclick="TowerPage.openPuzzle()">
                            <div class="tower-card-icon">🧩</div>
                            <div class="tower-card-info">
                                <div class="tower-card-title">Luyện Cờ</div>
                                <div class="tower-card-desc">Giải puzzle với 3 chế độ: Cơ Bản, Tập Trung, Trí Nhớ</div>
                            </div>
                            <div class="tower-card-arrow">→</div>
                        </div>

                        <!-- Chim Gõ Kiến -->
                        <div class="tower-card tower-card--woodpecker" onclick="TowerPage.openWoodpecker()">
                            <div class="tower-card-icon">🐦</div>
                            <div class="tower-card-info">
                                <div class="tower-card-title">Chim Gõ Kiến</div>
                                <div class="tower-card-desc">Luyện puzzle theo phương pháp lặp lại ngắt quãng (Woodpecker Method)</div>
                            </div>
                            <div class="tower-card-arrow">→</div>
                        </div>

                        <!-- Khóa Học (coming soon) -->
                        <div class="tower-card tower-card--courses tower-card--coming" onclick="TowerPage.comingSoon()">
                            <div class="tower-card-icon">📚</div>
                            <div class="tower-card-info">
                                <div class="tower-card-title">Khóa Học</div>
                                <div class="tower-card-desc">Học khai cuộc, chiến thuật và tàn cuộc có hệ thống</div>
                            </div>
                            <div class="tower-card-badge">Sắp ra mắt</div>
                        </div>
                    </div>
                </div>
            `
        });
        Modal.show('tower-modal');
    },

    openPuzzle() {
        Modal.hide('tower-modal');
        App.navigate('puzzle');
    },

    openWoodpecker() {
        Modal.hide('tower-modal');
        window.open('https://gokien.trituetre.com.vn', '_blank');
    },

    comingSoon() {
        Toast.info('📚 Khóa học đang được chuẩn bị, sẽ mở sớm thôi!');
    }
};
