/**
 * ARQUIVO: frontend/static/js/modules/auth/auth.js
 * PSWEB - Módulo de Autenticação - SEM TOKENS
 * PASSO 2: ADICIONADA inicialização da variável global USERNAME
 * PASSO 3: USAR USERNAME GLOBAL PARA AUTENTICAÇÃO E DEFINIÇÃO DE PERFIL
 */

(() => {
    'use strict';

    const MODULE_NAME = 'AuthModule';

    // ===================================================================================================
    // CONFIGURAÇÃO DE DEBUG
    // ===================================================================================================
    let DEBUG_CONFIG = {
        DEBUG: false,
        DEBUG_AUTH: false
    };

    function debugLog(message, data = null) {
        if (DEBUG_CONFIG.DEBUG_AUTH) {
            console.log(`🔐 [${MODULE_NAME} DEBUG] ${message}`, data || '');
        }
    }

    function debugError(message, error = null) {
        if (DEBUG_CONFIG.DEBUG_AUTH) {
            console.error(`❌ [${MODULE_NAME} ERROR] ${message}`, error || '');
        }
        console.error(`❌ ${MODULE_NAME}: ${message}`, error || '');
    }

    // ===================================================================================================
    // ESTADO (SEM TOKENS)
    // ===================================================================================================
    let context = null;  // REMOVIDO: authToken
    let authConfig = null;
    let isInitialized = false;
    let onAuthSuccessCallback = null;

    // ===================================================================================================
    // API SEM TOKENS - PASSO 3: MODIFICADA para usar USERNAME global
    // ===================================================================================================
    const api = {
        async getAuthInfo() {
            const response = await fetch('/api/auth/info');
            return response.json();
        },

        async initUsername() {
            // PASSO 2: Inicializa USERNAME global no servidor
            const response = await fetch('/api/auth/init-username', { method: 'POST' });
            return response.json();
        },

        async authenticateWindows() {
            // PASSO 3: Autenticação usando USERNAME global
            const response = await fetch('/api/auth/windows', { method: 'POST' });
            return response.json();
        },

        async getCurrentUser() {
            // PASSO 3: Nova rota que usa USERNAME global
            const response = await fetch('/api/auth/me');
            return response.json();
        },

        async logout() {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
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
    // CONTROLE DE INTERFACE SIMPLIFICADO
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

    async function updateContextualInfo(userContext) {
        debugLog('updateContextualInfo chamado', userContext);
        
        if (!userContext) {
            debugError('Contexto de usuário inválido');
            return;
        }

        // Atualiza nome do usuário
        debugLog('Atualizando nome do usuário', userContext.nome);
        setUserDisplay(userContext.nome || '');

        // CORREÇÃO: Garante que o profile esteja definido
        if (!userContext.profile) {
            debugError('Profile não definido no contexto');
            return;
        }

        // DELEGA controle de perfil para callbacks externos
        debugLog('Delegando controle de perfil para módulo principal...');
        if (onAuthSuccessCallback && typeof onAuthSuccessCallback === 'function') {
            debugLog('Executando callback onAuthSuccess...');
            await onAuthSuccessCallback();
        }

        // Log para debug
        const contextInfo = {
            nome: userContext.nome,
            profile: userContext.profile,
            isFiscal: userContext.isFiscal,
            isAdmin: userContext.isAdmin,
            fiscalId: userContext.fiscalId
        };
        
        debugLog('🔄 AuthModule: Contexto processado', contextInfo);
        console.log('🔄 PASSO 3: Contexto processado via USERNAME global:', contextInfo);
    }

    // ===================================================================================================
    // INICIALIZAÇÃO USERNAME GLOBAL - PASSO 2
    // ===================================================================================================
    async function initializeUsernameOnServer() {
        try {
            debugLog('🔐 Inicializando USERNAME global no servidor...');
            
            const result = await api.initUsername();
            
            if (result.success) {
                debugLog('✅ USERNAME global inicializado', {
                    username: result.username,
                    already_initialized: result.already_initialized,
                    message: result.message
                });
                
                console.log(`✅ USERNAME Windows: ${result.username} ${result.already_initialized ? '(já inicializado)' : '(inicializado agora)'}`);
                return result;
            } else {
                debugError('❌ Falha ao inicializar USERNAME global', result);
                throw new Error(result.message || 'Falha ao inicializar USERNAME');
            }
            
        } catch (error) {
            debugError('❌ Erro ao inicializar USERNAME global', error);
            throw error;
        }
    }

    // ===================================================================================================
    // OPERAÇÕES DE AUTENTICAÇÃO - PASSO 3: SIMPLIFICADAS
    // ===================================================================================================
    async function performAuthentication() {
        try {
            debugLog('🚀 PASSO 3: Iniciando autenticação via USERNAME global...');
            console.log('🚀 PASSO 3: Iniciando autenticação via USERNAME global...');

            // 1. Verifica se USERNAME global está inicializado
            debugLog('📡 Verificando configurações do servidor...');
            authConfig = await api.getAuthInfo();
            debugLog('✅ Configuração recebida', authConfig);

            if (!authConfig.global_username_initialized) {
                throw new Error('USERNAME global não está inicializado no servidor');
            }

            // 2. PASSO 3: Autentica usando USERNAME global
            debugLog('🔐 Autenticando via USERNAME global...');
            const authResult = await api.authenticateWindows();
            debugLog('✅ Autenticação bem-sucedida', {
                profile: authResult.profile,
                nome: authResult.user?.nome,
                message: authResult.message
            });

            // 3. Armazena contexto do usuário
            context = authResult.user;

            // CORREÇÃO: Garante que o profile seja armazenado corretamente
            if (authResult.profile) {
                context.profile = authResult.profile;
            }

            debugLog('📝 Contexto armazenado', {
                context_profile: context?.profile,
                context_nome: context?.nome,
                context_fiscalId: context?.fiscalId,
                full_context: context
            });

            // 4. Atualiza interface
            debugLog('🖥️ Atualizando interface...');
            await updateContextualInfo(context);

            debugLog('✅ PASSO 3: Processo de autenticação concluído com sucesso');
            console.log('✅ PASSO 3: Processo de autenticação concluído com sucesso');

            return authResult;

        } catch (error) {
            debugError('❌ Erro na autenticação:', error);
            showError(error.message + '\n\nVerifique se:\n1. O USERNAME foi inicializado corretamente\n2. Você está cadastrado no sistema como Fiscal ou Administrador\n3. O servidor está funcionando corretamente');
            throw error;
        }
    }

    async function checkCurrentUser() {
        try {
            debugLog('🔍 PASSO 3: Verificando usuário atual via USERNAME global...');
            
            const userResponse = await api.getCurrentUser();
            
            if (userResponse.success && userResponse.user) {
                context = userResponse.user;
                
                debugLog('✅ PASSO 3: Usuário obtido via USERNAME global', {
                    nome: userResponse.user.nome,
                    profile: userResponse.profile,
                    fiscalId: userResponse.user.fiscalId
                });
                
                await updateContextualInfo(context);
                return userResponse.user;
            } else {
                throw new Error(userResponse.message || 'Usuário não encontrado');
            }
            
        } catch (error) {
            debugLog('⚠️ PASSO 3: Erro ao obter usuário atual, tentando autenticação completa');
            return await performAuthentication();
        }
    }

    async function performLogout() {
        try {
            debugLog('🚪 Executando logout...');
            
            const result = await api.logout();
            
            // Limpa contexto
            context = null;
            
            debugLog('✅ Logout concluído');
            showMessage(result.message || 'Logout realizado com sucesso');
            
            // Recarrega página para resetar estado
            window.location.reload();
            
        } catch (error) {
            debugError('❌ Erro no logout:', error);
            showError('Erro durante logout: ' + error.message);
        }
    }

    // ===================================================================================================
    // VERIFICAÇÃO DE STATUS - PASSO 3: SIMPLIFICADA
    // ===================================================================================================
    async function checkAuthenticationStatus() {
        debugLog('🔍 PASSO 3: Verificando status de autenticação...');
        
        try {
            // PASSO 3: Primeiro tenta obter usuário atual via USERNAME global
            return await checkCurrentUser();
            
        } catch (error) {
            debugError('❌ Erro ao verificar status de auth', error);
            console.error('❌ Erro ao verificar status de auth:', error);
            throw error;
        }
    }

    // ===================================================================================================
    // EVENT LISTENERS SIMPLIFICADOS
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
            debugLog('Modal de login removido');
        }
    }

    // ===================================================================================================
    // CARREGAMENTO DE CONFIGURAÇÃO
    // ===================================================================================================
    async function loadDebugConfig() {
        try {
            const response = await fetch('/api/auth/debug-config');
            if (response.ok) {
                const result = await response.json();
                DEBUG_CONFIG = result.config || {};
                debugLog('Debug config carregada', DEBUG_CONFIG);
            }
        } catch (error) {
            debugLog('Debug config não disponível (production mode)');
        }
    }

    // ===================================================================================================
    // INTERFACE PÚBLICA - PASSO 3: SIMPLIFICADA
    // ===================================================================================================
    const moduleInstance = {
        // Inicialização
        async init() {
            debugLog('🚀 Inicializando módulo de autenticação...');
            
            try {
                // Carrega configuração de debug
                await loadDebugConfig();
                
                // PASSO 2: Inicializa USERNAME global no servidor
                debugLog('🔐 Chamando inicialização de USERNAME global...');
                await initializeUsernameOnServer();
                
                // Configura event listeners
                bindEvents();
                
                isInitialized = true;
                debugLog('✅ Módulo inicializado (aguardando autenticação)');
                
            } catch (error) {
                debugError('❌ Erro na inicialização:', error);
                throw error;
            }
        },

        // Autenticação principal - PASSO 3: SIMPLIFICADA
        async checkOrAuthenticate() {
            debugLog('🔐 PASSO 3: checkOrAuthenticate chamado');
            
            if (!isInitialized) {
                throw new Error('Módulo não inicializado');
            }
            
            return await checkAuthenticationStatus();
        },

        // Callbacks
        setOnAuthSuccessCallback(callback) {
            onAuthSuccessCallback = callback;
            debugLog('Callback onAuthSuccess configurado');
        },

        // Logout
        async logout() {
            return await performLogout();
        },

        // Estado atual
        getCurrentUser() {
            return context;
        },

        isAuthenticated() {
            return context !== null;
        },

        // PASSO 3: NOVA FUNÇÃO para verificar usuário atual
        async refreshCurrentUser() {
            return await checkCurrentUser();
        },

        // API para compatibilidade
        api: {
            getCurrentUser: () => context,
            authenticateWindows: () => performAuthentication(),
            getAuthInfo: api.getAuthInfo,
            logout: performLogout,
            initUsername: api.initUsername,
            refreshUser: () => checkCurrentUser()  // NOVA
        }
    };

    // ===================================================================================================
    // REGISTRO GLOBAL
    // ===================================================================================================
    window.AuthModule = moduleInstance;
    
    console.log(`📦 ${MODULE_NAME}: Módulo de autenticação PASSO 3 - USERNAME GLOBAL para autenticação registrado`);

})();