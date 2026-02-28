/**
 * Mountain Page — Núi Danh Vọng (Modal Menu)
 * Shows training options: Puzzle, Woodpecker, Courses
 * (Previously was the Tower modal — swapped content)
 */
const MountainPage = {
    open() {
        Modal.create({
            id: 'mountain-modal',
            title: 'Núi Danh Vọng',
            icon: '⛰️',
            content: `
                <div class="tower-menu">
                    <div class="tower-intro">
                        <p>Chào mừng đến với <strong>Núi Danh Vọng</strong>! Nơi rèn luyện kỹ năng cờ vua với nhiều phương pháp khác nhau.</p>
                    </div>

                    <div class="tower-grid">
                        <!-- Luyện Cờ (Puzzle Training) -->
                        <div class="tower-card tower-card--puzzle" onclick="MountainPage.openPuzzle()">
                            <div class="tower-card-icon">🧩</div>
                            <div class="tower-card-info">
                                <div class="tower-card-title">Luyện Cờ</div>
                                <div class="tower-card-desc">Giải puzzle với 3 chế độ: Cơ Bản, Tập Trung, Trí Nhớ</div>
                            </div>
                            <div class="tower-card-arrow">→</div>
                        </div>

                        <!-- Chim Gõ Kiến -->
                        <div class="tower-card tower-card--woodpecker" onclick="MountainPage.openWoodpecker()">
                            <div class="tower-card-icon">🐦</div>
                            <div class="tower-card-info">
                                <div class="tower-card-title">Chim Gõ Kiến</div>
                                <div class="tower-card-desc">Luyện puzzle theo phương pháp lặp lại ngắt quãng (Woodpecker Method)</div>
                            </div>
                            <div class="tower-card-arrow">→</div>
                        </div>

                        <!-- Khóa Học (coming soon) -->
                        <div class="tower-card tower-card--courses tower-card--coming" onclick="MountainPage.comingSoon()">
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
        Modal.show('mountain-modal');
    },

    openPuzzle() {
        Modal.hide('mountain-modal');
        App.navigate('puzzle');
    },

    openWoodpecker() {
        Modal.hide('mountain-modal');
        window.open('https://gokien.trituetre.com.vn', '_blank');
    },

    comingSoon() {
        Toast.info('📚 Khóa học đang được chuẩn bị, sẽ mở sớm thôi!');
    }
};
