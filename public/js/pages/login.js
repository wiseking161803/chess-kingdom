/**
 * Login Page
 */
const LoginPage = {
    activeTab: 'login',

    render() {
        return `
        <div class="login-page">
            <div class="login-card">
                <div class="login-logo">
                    <div class="login-logo-icon">♟️</div>
                    <div class="login-logo-text">Vương Quốc Cờ Vua</div>
                    <div class="login-logo-sub">Hành trình chinh phục tri thức cờ vua</div>
                </div>

                <div class="login-tabs">
                    <button class="login-tab active" data-tab="login">Đăng Nhập</button>
                    <button class="login-tab" data-tab="register">Đăng Ký</button>
                </div>

                <div class="login-error" id="login-error"></div>

                <!-- Login Form -->
                <form id="login-form">
                    <div class="form-group">
                        <label class="form-label">📝 Tên đăng nhập</label>
                        <input type="text" class="form-input" id="login-username" placeholder="Nhập tên đăng nhập..." required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label class="form-label">🔒 Mật khẩu</label>
                        <input type="password" class="form-input" id="login-password" placeholder="Nhập mật khẩu..." required autocomplete="current-password">
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width:100%">
                        🚀 Vào Vương Quốc
                    </button>
                </form>

                <!-- Register Form (hidden by default) -->
                <form id="register-form" class="hidden">
                    <div class="form-group">
                        <label class="form-label">📝 Tên đăng nhập</label>
                        <input type="text" class="form-input" id="reg-username" placeholder="Chọn tên đăng nhập..." required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label class="form-label">👤 Tên hiển thị</label>
                        <input type="text" class="form-input" id="reg-display-name" placeholder="Tên của bạn..." required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">🔒 Mật khẩu</label>
                        <input type="password" class="form-input" id="reg-password" placeholder="Tạo mật khẩu (ít nhất 6 ký tự)..." required autocomplete="new-password">
                    </div>
                    <button type="submit" class="btn btn-success btn-lg" style="width:100%">
                        ✨ Đăng Ký Tài Khoản
                    </button>
                </form>
            </div>
        </div>
        `;
    },

    init() {
        // Tab switching
        document.querySelectorAll('.login-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabName = tab.dataset.tab;
                document.getElementById('login-form').classList.toggle('hidden', tabName !== 'login');
                document.getElementById('register-form').classList.toggle('hidden', tabName !== 'register');
                document.getElementById('login-error').classList.remove('visible');
            });
        });

        // Login submit
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = '⏳ Đang đăng nhập...';

            try {
                const result = await API.post('/auth/login', {
                    username: document.getElementById('login-username').value.trim(),
                    password: document.getElementById('login-password').value
                });

                API.token = result.token;
                localStorage.setItem('token', result.token);
                App.user = result.user;
                App.navigate('home');
                Toast.success(`Xin chào, ${result.user.display_name}! 👋`);
            } catch (err) {
                this.showError(err.message);
                btn.disabled = false;
                btn.textContent = '🚀 Vào Vương Quốc';
            }
        });

        // Register submit
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;

            try {
                const result = await API.post('/auth/register', {
                    username: document.getElementById('reg-username').value.trim(),
                    display_name: document.getElementById('reg-display-name').value.trim(),
                    password: document.getElementById('reg-password').value
                });

                Toast.success(result.message);
                // Switch to login tab
                document.querySelector('[data-tab="login"]').click();
            } catch (err) {
                this.showError(err.message);
            }
            btn.disabled = false;
        });
    },

    showError(msg) {
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = msg;
        errorEl.classList.add('visible');
    }
};
