/**
 * ARQUIVO: frontend/static/js/modules/auth/auth.js
 * Módulo de Autenticação - Captura Windows no Servidor - COM DEBUG
 */

const AuthModule = (function() {
    'use strict';

    // ===================================================================================================
    // CONFIGURAÇÃO DE DEBUG
    // ===================================================================================================
    const DEBUG = true; // ← Controle manual de debug (pode vir do servidor depois)
    
    function debugLog(message, data = null) {
        if (DEBUG) {
            console.log(`🔧 AUTH DEBUG: ${message}`, data ? data : '');
        }
    }

    function debugError(message, error = null) {
        if (DEBUG) {
            console.error(`❌ AUTH DEBUG: ${message}`, error ? error : '');
        }
    }

    // ===================================================================================================
    // ESTADO INTERNO DO MÓDULO
    // ===================================================================================================
    let context = null;
    let authToken = null;
    let authConfig = null;

    // ===================================================================================================
    // APIs ESPECÍFICAS DO MÓDULO
    // ===================================================================================================
    const api = {
        async getAuthInfo() {
            const response = await fetch('/api/auth/info');
            return response.json();
        },

        async authenticateWindows() {
            const response = await fetch('/api/auth/windows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Erro ${response.status}`);
            }
            
            return response.json();
        },

        async getCurrentUser() {
            if (!authToken) {
                throw new Error('Token não disponível');
            }
            
            const response = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Erro ${response.status}`);
            }
            
            return response.json();
        },

        async logout() {
            const response = await fetch('/api/auth/logout', { 
                method: 'POST',
                headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
            });
            return response.json();
        },

        async testWindowsCapture() {
            const response = await fetch('/api/auth/test-windows');
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
        debugError('showError chamado', message);
        console.error('❌ Auth Error:', message);
        alert('Erro de Autenticação:\n\n' + message);
    }

    function showMessage(message) {
        debugLog('showMessage chamado', message);
        console.log('ℹ️ Auth Info:', message);
    }

    // ===================================================================================================
    // CONTROLE DE INTERFACE E PERFIS
    // ===================================================================================================
    function setUserDisplay(name) {
        debugLog('setUserDisplay chamado', { name });
        const userNameEl = getElement('userName');
        if (userNameEl) {
            userNameEl.textContent = name || '';
            debugLog('Nome do usuário atualizado na interface', name);
        } else {
            debugError('Elemento userName não encontrado');
        }
    }

    function applyProfileBasedUI(profile) {
        debugLog('applyProfileBasedUI chamado', { profile });
        
        /**
         * Controla visibilidade baseada no perfil:
         * - USUARIO (só fiscal): Botão "Cadastros" oculto
         * - ADMIN (administrador ou ambos): Botão "Cadastros" visível
         */
        
        // Controla botão "Cadastros" na navegação principal
        const cadastrosButton = document.querySelector('.tablink[data-tab="cadastros"]');
        debugLog('Botão cadastros encontrado?', !!cadastrosButton);
        
        if (cadastrosButton) {
            if (profile === 'ADMIN') {
                cadastrosButton.style.display = ''; // Visível para admins
                cadastrosButton.disabled = false;
                debugLog('✅ Botão Cadastros VISÍVEL (perfil ADMIN)');
                console.log('✅ Botão Cadastros VISÍVEL (perfil ADMIN)');
            } else {
                cadastrosButton.style.display = 'none'; // Oculto para usuários
                cadastrosButton.disabled = true;
                debugLog('❌ Botão Cadastros OCULTO (perfil USUARIO)');
                console.log('❌ Botão Cadastros OCULTO (perfil USUARIO)');
                
                // Se está na aba cadastros, volta para início
                const cadastrosTab = getElement('tab-cadastros');
                if (cadastrosTab && cadastrosTab.classList.contains('active')) {
                    if (typeof window.setTab === 'function') {
                        window.setTab('consultas');
                        debugLog('Redirecionado da aba cadastros para consultas');
                    }
                }
            }
        } else {
            debugError('Botão cadastros não encontrado no DOM!');
        }
        
        debugLog(`🎯 Perfil ${profile} aplicado na interface`);
        console.log(`🎯 Perfil ${profile} aplicado na interface`);
    }

    function updateContextualInfo(userContext) {
        debugLog('updateContextualInfo chamado', userContext);
        
        /**
         * Atualiza informações contextuais na interface
         */
        
        // Atualiza nome do usuário
        debugLog('Atualizando nome do usuário', userContext?.nome);
        setUserDisplay(userContext?.nome || '');
        
        // Aplica perfil na UI
        if (userContext?.profile) {
            debugLog('Aplicando perfil na UI', userContext.profile);
            applyProfileBasedUI(userContext.profile);
        } else {
            debugError('userContext.profile não encontrado!', userContext);
        }
        
        // Atualiza título se necessário
        const subTitle = getElement('subTitle');
        if (subTitle && userContext?.profile) {
            const profileText = userContext.profile === 'ADMIN' ? 'Administrador' : 'Usuário';
            subTitle.textContent = `Fiscalização SUB/SSUB/MIS - ${profileText}`;
            debugLog('Título atualizado', profileText);
        }
        
        // Log para debug
        const contextInfo = {
            nome: userContext?.nome,
            profile: userContext?.profile,
            isFiscal: userContext?.isFiscal,
            isAdmin: userContext?.isAdmin
        };
        debugLog('🔄 Interface atualizada', contextInfo);
        console.log('🔄 Interface atualizada:', contextInfo);
    }

    // ===================================================================================================
    // OPERAÇÕES DE AUTENTICAÇÃO
    // ===================================================================================================
    async function performAuthentication() {
        try {
            debugLog('🚀 Iniciando autenticação Windows via servidor...');
            console.log('🚀 Iniciando autenticação Windows via servidor...');
            
            // 1. Obtém configurações do servidor
            debugLog('📡 Obtendo configurações do servidor...');
            authConfig = await api.getAuthInfo();
            debugLog('✅ Configuração recebida', {
                auth_mode: authConfig.auth_mode,
                auth_field: authConfig.auth_field,
                windows_user: authConfig.windows_info?.username,
                computer: authConfig.windows_info?.computer
            });
            
            // 2. Autentica via servidor (que captura credenciais Windows)
            debugLog('🔐 Autenticando via servidor...');
            const authResult = await api.authenticateWindows();
            debugLog('✅ Autenticação bem-sucedida', {
                profile: authResult.profile,
                nome: authResult.user?.nome,
                message: authResult.message,
                full_result: authResult
            });
            
            // 3. Armazena token e contexto
            authToken = authResult.token;
            context = authResult.user;
            
            debugLog('📝 Token e contexto armazenados', {
                token_length: authToken?.length,
                context: context
            });
            
            // 4. Atualiza interface
            debugLog('🖥️ Atualizando interface...');
            updateContextualInfo(context);
            
            debugLog('✅ Processo de autenticação concluído com sucesso');
            console.log('✅ Processo de autenticação concluído com sucesso');
            return context;
            
        } catch (error) {
            debugError('❌ FALHA na autenticação', error);
            console.error('❌ FALHA na autenticação:', error);
            showError(error.message + '\n\nVerifique se:\n1. Você está cadastrado no sistema como Fiscal ou Administrador\n2. O servidor consegue capturar suas credenciais Windows\n3. A rede permite conexão com o servidor');
            return null;
        }
    }

    async function performLogout() {
        try {
            debugLog('👋 Realizando logout...');
            console.log('👋 Realizando logout...');
            
            if (authToken) {
                await api.logout();
            }
            
            // Limpa estado local
            authToken = null;
            context = null;
            authConfig = null;
            
            debugLog('✅ Logout realizado, recarregando página...');
            console.log('✅ Logout realizado, recarregando página...');
            
            // Recarrega página para estado inicial
            location.reload();
            
        } catch (error) {
            debugError('❌ Erro no logout', error);
            console.error('❌ Erro no logout:', error);
            // Força reload mesmo com erro
            location.reload();
        }
    }

    async function checkAuthStatus() {
        try {
            debugLog('🔍 Verificando status de autenticação...');
            
            if (!authToken || !context) {
                debugLog('Token ou contexto não disponível, tentando autenticação');
                // Tenta autenticação automática
                return await performAuthentication();
            }
            
            debugLog('Token disponível, verificando validade...');
            // Verifica se token ainda é válido
            const userInfo = await api.getCurrentUser();
            
            if (userInfo && userInfo.user) {
                context = userInfo.user;
                debugLog('Token válido, atualizando contexto', context);
                updateContextualInfo(context);
                return context;
            }
            
            debugLog('Token inválido, tentando nova autenticação');
            // Token inválido, tenta nova autenticação
            authToken = null;
            context = null;
            return await performAuthentication();
            
        } catch (error) {
            debugError('❌ Erro ao verificar status de auth', error);
            console.error('❌ Erro ao verificar status de auth:', error);
            // Tenta autenticação do zero
            authToken = null;
            context = null;
            return await performAuthentication();
        }
    }

    // ===================================================================================================
    // EVENT LISTENERS - SIMPLIFICADO
    // ===================================================================================================
    function bindEvents() {
        debugLog('🔗 Configurando event listeners...');
        
        // Botão de logout
        const btnLogout = getElement('btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', performLogout);
            debugLog('Event listener logout configurado');
        }
        
        // Remove modal de login (não é mais necessário)
        const loginModal = getElement('loginModal');
        if (loginModal) {
            loginModal.style.display = 'none';
            loginModal.remove();
            debugLog('🗑️ Modal de login removido (autenticação automática via servidor)');
            console.log('🗑️ Modal de login removido (autenticação automática via servidor)');
        }
    }

    // ===================================================================================================
    // FUNÇÕES DE TESTE E DEBUG
    // ===================================================================================================
    async function testWindowsCapture() {
        try {
            debugLog('🧪 Testando captura Windows no servidor...');
            console.log('🧪 Testando captura Windows no servidor...');
            const result = await api.testWindowsCapture();
            debugLog('✅ Teste bem-sucedido', result);
            console.log('✅ Teste bem-sucedido:', result);
            return result;
        } catch (error) {
            debugError('❌ Erro no teste', error);
            console.error('❌ Erro no teste:', error);
            throw error;
        }
    }

    // ===================================================================================================
    // INTERFACE PÚBLICA
    // ===================================================================================================
    return {
        // Inicialização
        async init() {
            debugLog('🔧 Inicializando AuthModule (Windows no servidor)...');
            console.log('🔧 Inicializando AuthModule (Windows no servidor)...');
            bindEvents();
            const result = await checkAuthStatus();
            debugLog('Init concluído', { authenticated: !!result });
            return result;
        },

        // Métodos de autenticação
        async authenticate() {
            return await performAuthentication();
        },

        async logout() {
            return await performLogout();
        },

        async checkAuth() {
            return await checkAuthStatus();
        },

        // Getters de estado
        isAuthenticated() {
            const result = context !== null && authToken !== null;
            debugLog('isAuthenticated', result);
            return result;
        },

        getCurrentUser() {
            debugLog('getCurrentUser', context);
            return context;
        },

        getAuthMode() {
            return 'windows_server';
        },

        getContext() {
            return context;
        },

        getProfile() {
            const profile = context?.profile || null;
            debugLog('getProfile', profile);
            return profile;
        },

        // Verificações de perfil
        isAdmin() {
            const result = context?.profile === 'ADMIN';
            debugLog('isAdmin', result);
            return result;
        },

        isFiscal() {
            const result = context?.isFiscal === true;
            debugLog('isFiscal', result);
            return result;
        },

        // Controle de interface
        setUserDisplay(name) {
            setUserDisplay(name);
        },

        applyProfileUI(profile) {
            debugLog('applyProfileUI chamado externamente', profile);
            applyProfileBasedUI(profile);
        },

        // Callbacks para outros módulos
        onAuthSuccess(callback) {
            window.onAuthSuccess = callback;
        },

        onPostAuthInit(callback) {
            window.onPostAuthInit = callback;
        },

        // Funções de teste
        async testWindows() {
            return await testWindowsCapture();
        },

        // Informações de debug
        getAuthConfig() {
            return authConfig;
        },

        getToken() {
            return authToken;
        },

        // === FUNÇÕES DE DEBUG ESPECÍFICAS ===
        debugState() {
            return {
                context,
                authToken: authToken ? `${authToken.substring(0, 20)}...` : null,
                authConfig,
                isAuthenticated: this.isAuthenticated(),
                profile: this.getProfile()
            };
        },

        forceUpdateUI() {
            debugLog('forceUpdateUI chamado manualmente');
            if (context) {
                updateContextualInfo(context);
            }
        },

        // Funções de compatibilidade
        applyDesembarcanteLock() {
            // Mantido para compatibilidade
            const el = getElement('fDesCNome');
            if (el && context) {
                el.value = context.nome || '';
                el.readOnly = true;
                el.setAttribute('aria-readonly', 'true');
                debugLog('applyDesembarcanteLock aplicado', context.nome);
            }
        }
    };
})();

// Exporta o módulo (compatível com diferentes sistemas de módulos)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthModule;
} else if (typeof window !== 'undefined') {
    window.AuthModule = AuthModule;
}