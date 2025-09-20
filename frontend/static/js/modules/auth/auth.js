/**
 * Módulo de Autenticação
 * Localização: frontend/static/js/modules/auth/auth.js
 * 
 * Responsabilidades:
 * - Gerenciamento de login/logout
 * - Controle de sessão de usuário
 * - Modal de login manual
 * - Configurações de autenticação Windows/Manual
 * - Controle de contexto do usuário
 */

const AuthModule = (function() {
    'use strict';

    // ===================================================================================================
    // ESTADO INTERNO DO MÓDULO
    // ===================================================================================================
    let context = null;
    let authMode = 'manual'; // 'windows' ou 'manual'
    let loginModal = null;

    // ===================================================================================================
    // APIs ESPECÍFICAS DO MÓDULO
    // ===================================================================================================
    const api = {
        async me() {
            const response = await fetch('/api/me');
            return response.json();
        },

        async loginManual(nome) {
            const response = await fetch('/api/login-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome })
            });
            return response.json();
        },

        async logout() {
            const response = await fetch('/api/logout', { method: 'POST' });
            return response.json();
        }
    };

    // ===================================================================================================
    // UTILITÁRIOS
    // ===================================================================================================
    function getElement(id) {
        return document.getElementById(id);
    }

    function showError(message) {
        const msgEl = getElement('loginMsg');
        if (msgEl) msgEl.textContent = message;
    }

    function clearError() {
        const msgEl = getElement('loginMsg');
        if (msgEl) msgEl.textContent = '';
    }

    // ===================================================================================================
    // CONTROLE DE INTERFACE
    // ===================================================================================================
    function setUserDisplay(name) {
        const userNameEl = getElement('userName');
        if (userNameEl) userNameEl.textContent = name || '';
    }

    function refreshUserPhoto() {
        const img = getElement('userPhoto');
        if (!img) return;
        
        img.onerror = () => { img.style.display = 'none'; };
        img.onload = () => { img.style.display = 'inline-block'; };
        img.src = '/api/me/photo?t=' + Date.now();
    }

    function showLoginModal() {
        if (loginModal) {
            loginModal.classList.remove('hidden');
        }
    }

    function hideLoginModal() {
        if (loginModal) {
            loginModal.classList.add('hidden');
        }
    }

    function applyDesembarcanteLock() {
        const el = getElement('fDesCNome');
        if (!el) return;

        if (isWindowsAuth()) {
            const nomeLogado = (context && (context.nome || context.fiscalNome)) || '';
            if (nomeLogado) el.value = nomeLogado;
            el.readOnly = true;
            el.setAttribute('aria-readonly', 'true');
        } else {
            el.readOnly = false;
            el.removeAttribute('aria-readonly');
            if (!el.value) el.placeholder = 'Digite o nome conforme cadastro';
        }
    }

    // ===================================================================================================
    // VERIFICAÇÕES E ESTADOS
    // ===================================================================================================
    function isWindowsAuth() {
        return authMode === 'windows';
    }

    function isAuthenticated() {
        return context !== null;
    }

    function getCurrentUser() {
        return context;
    }

    function getAuthMode() {
        return authMode;
    }

    // ===================================================================================================
    // OPERAÇÕES DE AUTENTICAÇÃO
    // ===================================================================================================
    async function performLogin() {
        const nomeInput = getElement('loginNome');
        if (!nomeInput) return;

        const nome = nomeInput.value.trim();
        if (!nome) {
            showError('Informe seu nome');
            return;
        }

        try {
            clearError();
            const result = await api.loginManual(nome);
            
            if (result.error) {
                showError(result.error);
                return;
            }

            hideLoginModal();
            
            // Chama callback de sucesso se definido
            if (typeof window.onAuthSuccess === 'function') {
                await window.onAuthSuccess();
            }

        } catch (error) {
            showError('Erro na autenticação: ' + error.message);
        }
    }

    async function performLogout() {
        try {
            await api.logout();
            location.reload();
        } catch (error) {
            console.error('Erro no logout:', error);
            location.reload(); // Força reload mesmo com erro
        }
    }

    async function checkAuthStatus() {
        try {
            const result = await api.me();
            
            if (result.mode === 'manual' && result.error) {
                // Precisa fazer login manual
                showLoginModal();
                return null;
            }
            
            if (result.mode === 'windows' && result.error) {
                // Usuário Windows não cadastrado
                document.body.innerHTML = '<div style="padding:20px;color:#b00">Usuário Windows não cadastrado na lista de fiscais. Contate o administrador.</div>';
                return null;
            }
            
            if (result.me) {
                authMode = result.mode || 'manual';
                context = result.me;
                setUserDisplay(context?.nome || '');
                applyDesembarcanteLock();
                
                // Atualiza foto após um pequeno delay
                setTimeout(refreshUserPhoto, 150);
                
                return context;
            }
            
            return null;
            
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            showLoginModal();
            return null;
        }
    }

    async function bootAfterAuth() {
        const userContext = await checkAuthStatus();
        if (!userContext) return false;

        // Chama callback de inicialização pós-auth se definido
        if (typeof window.onPostAuthInit === 'function') {
            await window.onPostAuthInit();
        }

        return true;
    }

    // ===================================================================================================
    // EVENT LISTENERS
    // ===================================================================================================
    function bindEvents() {
        // Modal de login
        loginModal = getElement('loginModal');
        
        // Botão de login
        const btnLogin = getElement('btnLogin');
        if (btnLogin) {
            btnLogin.addEventListener('click', performLogin);
        }

        // Enter no campo de nome para fazer login
        const loginNome = getElement('loginNome');
        if (loginNome) {
            loginNome.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    performLogin();
                }
            });
        }

        // Botão de logout
        const btnLogout = getElement('btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', performLogout);
        }
    }

    // ===================================================================================================
    // INTERFACE PÚBLICA
    // ===================================================================================================
    return {
        // Inicialização
        async init() {
            bindEvents();
            return await checkAuthStatus();
        },

        // Métodos de autenticação
        async login(nome) {
            if (nome) {
                const nomeInput = getElement('loginNome');
                if (nomeInput) nomeInput.value = nome;
            }
            return await performLogin();
        },

        async logout() {
            return await performLogout();
        },

        async checkAuth() {
            return await checkAuthStatus();
        },

        async bootAfterAuth() {
            return await bootAfterAuth();
        },

        // Getters de estado
        isAuthenticated() {
            return isAuthenticated();
        },

        getCurrentUser() {
            return getCurrentUser();
        },

        getAuthMode() {
            return getAuthMode();
        },

        isWindowsAuth() {
            return isWindowsAuth();
        },

        getContext() {
            return context;
        },

        // Controle de interface
        showLoginModal() {
            showLoginModal();
        },

        hideLoginModal() {
            hideLoginModal();
        },

        setUserDisplay(name) {
            setUserDisplay(name);
        },

        refreshUserPhoto() {
            refreshUserPhoto();
        },

        applyDesembarcanteLock() {
            applyDesembarcanteLock();
        },

        // Setters para callbacks externos
        onAuthSuccess(callback) {
            window.onAuthSuccess = callback;
        },

        onPostAuthInit(callback) {
            window.onPostAuthInit = callback;
        }
    };
})();

// Exporta o módulo (compatível com diferentes sistemas de módulos)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthModule;
} else if (typeof window !== 'undefined') {
    window.AuthModule = AuthModule;
}