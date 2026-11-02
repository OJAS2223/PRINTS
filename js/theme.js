// ============================================================================
// FILE: js/theme.js
// Ojas Portal & Tools Studio - Universal Day/Night Theme Controller & Palette
// ============================================================================

if (window.tailwind) {
    window.tailwind.config = {
        darkMode: 'class',
        theme: {
            extend: {
                colors: { 
                    royal: { 
                        50: '#eef2ff', 
                        100: '#e0e7ff', 
                        300: '#a5b4fc', 
                        400: '#818cf8', 
                        500: '#6366f1', 
                        600: '#4f46e5', 
                        700: '#4338ca',
                        900: '#1e1b4b' 
                    },
                    dark: { 
                        700: '#1e293b', 
                        800: '#151e32', 
                        900: '#0f172a', 
                        950: '#070b14' 
                    }
                },
                boxShadow: {
                    'glow': '0 0 20px rgba(79, 70, 229, 0.35)',
                    'vip-glow': '0 0 25px rgba(99, 102, 241, 0.45)',
                    'card': '0 10px 30px -5px rgba(15, 23, 42, 0.08)',
                    'a4': '0 15px 35px -5px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
                }
            }
        }
    };
}

window.initTheme = function() {
    var saved = localStorage.getItem('ojas_theme');
    var isDark = saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    window.updateThemeToggleIcons(isDark);
};

window.toggleTheme = function() {
    var isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('ojas_theme', isDark ? 'dark' : 'light');
    window.updateThemeToggleIcons(isDark);
};

window.updateThemeToggleIcons = function(isDark) {
    var btns = document.querySelectorAll('.theme-toggle-btn');
    btns.forEach(function(btn) {
        btn.innerHTML = isDark 
            ? '<i class="fa-solid fa-sun text-amber-400 text-xs md:text-sm"></i>' 
            : '<i class="fa-solid fa-moon text-royal-300 text-xs md:text-sm"></i>';
        btn.title = isDark ? 'Switch to Day (Light) Mode' : 'Switch to Night (Dark) Mode';
    });
};

window.initTheme();
document.addEventListener('DOMContentLoaded', window.initTheme);
