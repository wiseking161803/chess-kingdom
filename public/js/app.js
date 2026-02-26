/**
 * Chess Kingdom — Main SPA Application
 * Version: 1.0.0
 */
const App = {
    user: null,
    currentPage: null,

    /**
     * Pages registry — maps route names to page modules
     */
    pages: {
        login: LoginPage,
        home: HomePage,
        puzzle: PuzzlePage,
        mountain: MountainPage,
        school: SchoolPage,
        admin: AdminPage
    },

    /**
     * Initialize the application
     */
    async init() {
        // Restore token from localStorage
        const token = localStorage.getItem('token');
        if (token) {
            API.token = token;
            try {
                const data = await API.get('/auth/me');
                this.user = data.user;
                this.navigate('home');
            } catch (err) {
                // Token expired or invalid
                localStorage.removeItem('token');
                API.token = null;
                this.navigate('login');
            }
        } else {
            this.navigate('login');
        }

        // Hide loading screen
        setTimeout(() => {
            const loading = document.querySelector('.loading-screen');
            if (loading) loading.classList.add('hidden');
        }, 500);
    },

    /**
     * Navigate to a page
     */
    navigate(pageName) {
        const page = this.pages[pageName];
        if (!page) {
            console.error(`Page not found: ${pageName}`);
            return;
        }

        // Auth guard
        if (pageName !== 'login' && !this.user) {
            return this.navigate('login');
        }

        // Admin guard
        if (pageName === 'admin' && this.user?.role !== 'admin') {
            Toast.error('Bạn không có quyền truy cập');
            return this.navigate('home');
        }

        this.currentPage = pageName;

        // Render page
        const app = document.getElementById('app');
        app.innerHTML = page.render();

        // Initialize page logic
        if (page.init) {
            page.init();
        }

        // Scroll to top
        window.scrollTo(0, 0);
    },

    /**
     * Logout
     */
    async logout() {
        try {
            await API.post('/auth/logout');
        } catch (e) {
            // Ignore
        }
        this.user = null;
        API.token = null;
        localStorage.removeItem('token');
        this.navigate('login');
        Toast.info('Đã đăng xuất');
    },

    /**
     * Format numbers with commas
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
};

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
