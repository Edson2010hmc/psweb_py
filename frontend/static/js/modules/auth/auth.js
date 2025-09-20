/**
 * Módulo de Autenticação - Cliente JavaScript - CORRIGIDO
 * Localização: frontend/static/js/modules/auth/auth.js
 * 
 * Responsabilidades:
 * - Captura AUTOMÁTICA de dados da máquina cliente (username, computername, etc.)
 * - Autenticação via API backend com dados do cliente
 * - Controle de perfis (USUARIO/ADMIN)
 * - Controle de visibilidade baseado em perfil
 * - Gerenciamento de token JWT
 * - SEM PROMPTS MANUAIS - TUDO AUTOMÁTICO
 */

const AuthModule = (function() {
    'use strict';

    // ===================================================================================================
    // ESTADO INTERNO DO MÓDULO
    // ===================================================================================================
    let context = null;
    let authToken = null;
    let authConfig = null;

    // ===================================================================================================
    // CAPTURA AUTOMÁTICA DE DADOS DO CLIENTE
    // ===================================================================================================
    
    /**
     * Captura username da máquina cliente - VERSÃO CORRIGIDA
     */
    function getClientUsername() {
        console.log('🔍 Iniciando captura de username...');
        
        try {
            let username = null;
            
            // Estratégia 1: Variáveis de ambiente (Node.js/Electron/Aplicação desktop)
            if (typeof process !== 'undefined' && process.env) {
                username = process.env.USERNAME || process.env.USER;
                if (username) {
                    console.log('✅ Username capturado via process.env:', username);
                    return username;
                }
            }
            
            // Estratégia 2: ActiveX Object (Internet Explorer/Edge Legacy)
            try {
                if (typeof ActiveXObject !== 'undefined') {
                    const wshNetwork = new ActiveXObject("WScript.Network");
                    username = wshNetwork.UserName;
                    if (username) {
                        console.log('✅ Username capturado via ActiveX:', username);
                        return username;
                    }
                }
            } catch (activeXError) {
                console.log('⚠️ ActiveX não disponível:', activeXError.message);
            }
            
            // Estratégia 3: WScript.Shell (se disponível)
            try {
                if (typeof ActiveXObject !== 'undefined') {
                    const wshShell = new ActiveXObject("WScript.Shell");
                    const userProfile = wshShell.ExpandEnvironmentStrings("%USERNAME%");
                    if (userProfile && userProfile !== "%USERNAME%") {
                        console.log('✅ Username capturado via WScript.Shell:', userProfile);
                        return userProfile;
                    }
                }
            } catch (wscriptError) {
                console.log('⚠️ WScript.Shell não disponível:', wscriptError.message);
            }
            
            // Estratégia 4: Variáveis globais do Windows (se injetadas)
            if (typeof window !== 'undefined' && window.USERNAME) {
                username = window.USERNAME;
                console.log('✅ Username capturado via window.USERNAME:', username);
                return username;
            }
            
            // Estratégia 5: Cookies ou sessionStorage (se definido por aplicação externa)
            try {
                const cookieUsername = document.cookie
                    .split('; ')
                    .find(row => row.startsWith('USERNAME='))
                    ?.split('=')[1];
                
                if (cookieUsername) {
                    console.log('✅ Username capturado via cookie:', cookieUsername);
                    return cookieUsername;
                }
            } catch (cookieError) {
                console.log('⚠️ Cookie USERNAME não disponível');
            }
            
            // ❌ NENHUMA ESTRATÉGIA FUNCIONOU
            console.error('❌ FALHA: Não foi possível capturar username automaticamente');
            console.error('❌ Estratégias tentadas:');
            console.error('   1. process.env.USERNAME/USER - Falhou');
            console.error('   2. ActiveX WScript.Network - Falhou');
            console.error('   3. WScript.Shell ExpandEnvironmentStrings - Falhou');
            console.error('   4. window.USERNAME - Falhou');
            console.error('   5. Document.cookie - Falhou');
            
            throw new Error('Não foi possível capturar username da máquina Windows automaticamente. Verifique se o navegador permite acesso às informações do sistema.');
            
        } catch (error) {
            console.error('❌ Erro crítico na captura de username:', error);
            throw error;
        }
    }
    
    /**
     * Captura nome do computador cliente
     */
    function getClientComputerName() {
        console.log('🔍 Capturando nome do computador...');
        
        try {
            let computerName = null;
            
            // Estratégia 1: Variáveis de ambiente
            if (typeof process !== 'undefined' && process.env) {
                computerName = process.env.COMPUTERNAME || process.env.HOSTNAME;
                if (computerName) {
                    console.log('✅ Computername capturado via process.env:', computerName);
                    return computerName;
                }
            }
            
            // Estratégia 2: ActiveX (IE/Edge legacy)
            try {
                if (typeof ActiveXObject !== 'undefined') {
                    const wshNetwork = new ActiveXObject("WScript.Network");
                    computerName = wshNetwork.ComputerName;
                    if (computerName) {
                        console.log('✅ Computername capturado via ActiveX:', computerName);
                        return computerName;
                    }
                }
            } catch (e) {
                console.log('⚠️ ActiveX computername não disponível');
            }
            
            // Estratégia 3: WScript.Shell
            try {
                if (typeof ActiveXObject !== 'undefined') {
                    const wshShell = new ActiveXObject("WScript.Shell");
                    computerName = wshShell.ExpandEnvironmentStrings("%COMPUTERNAME%");
                    if (computerName && computerName !== "%COMPUTERNAME%") {
                        console.log('✅ Computername capturado via WScript.Shell:', computerName);
                        return computerName;
                    }
                }
            } catch (e) {
                console.log('⚠️ WScript.Shell computername não disponível');
            }
            
            // Estratégia 4: Hostname do navegador (limitado)
            if (window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                computerName = window.location.hostname.toUpperCase();
                console.log('✅ Computername via hostname:', computerName);
                return computerName;
            }
            
            // Fallback
            computerName = 'UNKNOWN_COMPUTER';
            console.log('⚠️ Usando fallback para computername:', computerName);
            return computerName;
            
        } catch (error) {
            console.error('❌ Erro ao capturar nome do computador:', error);
            return 'ERROR_COMPUTER';
        }
    }
    
    /**
     * Captura domínio do cliente
     */
    function getClientDomain() {
        console.log('🔍 Capturando domínio...');
        
        try {
            let domain = null;
            
            // Estratégia 1: Variáveis de ambiente
            if (typeof process !== 'undefined' && process.env) {
                domain = process.env.USERDOMAIN || process.env.DOMAIN;
                if (domain) {
                    console.log('✅ Domínio capturado via process.env:', domain);
                    return domain;
                }
            }
            
            // Estratégia 2: ActiveX
            try {
                if (typeof ActiveXObject !== 'undefined') {
                    const wshNetwork = new ActiveXObject("WScript.Network");
                    domain = wshNetwork.UserDomain;
                    if (domain) {
                        console.log('✅ Domínio capturado via ActiveX:', domain);
                        return domain;
                    }
                }
            } catch (e) {
                console.log('⚠️ ActiveX domain não disponível');
            }
            
            // Estratégia 3: WScript.Shell
            try {
                if (typeof ActiveXObject !== 'undefined') {
                    const wshShell = new ActiveXObject("WScript.Shell");
                    domain = wshShell.ExpandEnvironmentStrings("%USERDOMAIN%");
                    if (domain && domain !== "%USERDOMAIN%") {
                        console.log('✅ Domínio capturado via WScript.Shell:', domain);
                        return domain;
                    }
                }
            } catch (e) {
                console.log('⚠️ WScript.Shell domain não disponível');
            }
            
            // Fallback
            domain = 'WORKGROUP';
            console.log('⚠️ Usando fallback para domínio:', domain);
            return domain;
            
        } catch (error) {
            console.error('❌ Erro ao capturar domínio:', error);
            return 'UNKNOWN_DOMAIN';
        }
    }
    
    /**
     * Monta dados completos do cliente para autenticação
     */
    function buildClientAuthData() {
        console.log('🏗️ Montando dados de autenticação...');
        
        // CAPTURA OBRIGATÓRIA DO USERNAME
        const username = getClientUsername(); // Pode lançar erro se falhar
        
        const clientData = {
            username: username,
            computerName: getClientComputerName(),
            domain: getClientDomain(),
            clientIP: null, // Será preenchido pelo servidor
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
            additional_info: {
                screen_resolution: `${screen.width}x${screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: navigator.language,
                platform: navigator.platform,
                browser: navigator.appName,
                version: navigator.appVersion
            }
        };
        
        console.log('📋 Dados de autenticação montados:', {
            username: clientData.username,
            computerName: clientData.computerName,
            domain: clientData.domain,
            timestamp: new Date(clientData.timestamp).toISOString()
        });
        
        return clientData;
    }

    // ===================================================================================================
    // APIs ESPECÍFICAS DO MÓDULO
    // ===================================================================================================
    const api = {
        async getAuthInfo() {
            const response = await fetch('/api/auth/info');
            return response.json();
        },

        async authenticateClient(clientData) {
            const response = await fetch('/api/auth/client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientData)
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
        }
    };

    // ===================================================================================================
    // UTILITÁRIOS
    // ===================================================================================================
    function getElement(id) {
        return document.getElementById(id);
    }

    function showError(message) {
        console.error('❌ Auth Error:', message);
        alert('Erro de Autenticação:\n\n' + message);
    }

    function showMessage(message) {
        console.log('ℹ️ Auth Info:', message);
    }

    // ===================================================================================================
    // CONTROLE DE INTERFACE E PERFIS
    // ===================================================================================================
    function setUserDisplay(name) {
        const userNameEl = getElement('userName');
        if (userNameEl) userNameEl.textContent = name || '';
    }

    function applyProfileBasedUI(profile) {
        /**
         * Controla visibilidade baseada no perfil:
         * - USUARIO (só fiscal): Botão "Cadastros" oculto
         * - ADMIN (administrador ou ambos): Botão "Cadastros" visível
         */
        
        // Controla botão "Cadastros" na navegação principal
        const cadastrosButton = document.querySelector('.tablink[data-tab="cadastros"]');
        
        if (cadastrosButton) {
            if (profile === 'ADMIN') {
                cadastrosButton.style.display = ''; // Visível para admins
                cadastrosButton.disabled = false;
                console.log('✅ Botão Cadastros VISÍVEL (perfil ADMIN)');
            } else {
                cadastrosButton.style.display = 'none'; // Oculto para usuários
                cadastrosButton.disabled = true;
                console.log('❌ Botão Cadastros OCULTO (perfil USUARIO)');
                
                // Se está na aba cadastros, volta para início
                const cadastrosTab = getElement('tab-cadastros');
                if (cadastrosTab && cadastrosTab.classList.contains('active')) {
                    if (typeof window.setTab === 'function') {
                        window.setTab('consultas');
                    }
                }
            }
        }
        
        console.log(`🎯 Perfil ${profile} aplicado na interface`);
    }

    function updateContextualInfo(userContext) {
        /**
         * Atualiza informações contextuais na interface
         */
        
        // Atualiza nome do usuário
        setUserDisplay(userContext?.nome || '');
        
        // Aplica perfil na UI
        if (userContext?.profile) {
            applyProfileBasedUI(userContext.profile);
        }
        
        // Atualiza título se necessário
        const subTitle = getElement('subTitle');
        if (subTitle && userContext?.profile) {
            const profileText = userContext.profile === 'ADMIN' ? 'Administrador' : 'Usuário';
            subTitle.textContent = `Fiscalização SUB/SSUB/MIS - ${profileText}`;
        }
        
        // Log para debug
        console.log('🔄 Interface atualizada:', {
            nome: userContext?.nome,
            profile: userContext?.profile,
            isFiscal: userContext?.isFiscal,
            isAdmin: userContext?.isAdmin
        });
    }

    // ===================================================================================================
    // OPERAÇÕES DE AUTENTICAÇÃO
    // ===================================================================================================
    async function performAuthentication() {
        try {
            console.log('🚀 Iniciando processo de autenticação automática...');
            
            // 1. Obtém configurações do servidor
            console.log('📡 Obtendo configurações do servidor...');
            authConfig = await api.getAuthInfo();
            console.log('✅ Configuração recebida:', authConfig);
            
            // 2. Coleta dados do cliente (pode falhar aqui se não conseguir username)
            console.log('💻 Coletando dados da máquina cliente...');
            const clientData = buildClientAuthData(); // Pode lançar exceção
            
            // 3. Autentica no servidor
            console.log('🔐 Enviando dados para autenticação...');
            const authResult = await api.authenticateClient(clientData);
            console.log('✅ Autenticação bem-sucedida:', {
                profile: authResult.profile,
                nome: authResult.user?.nome,
                message: authResult.message
            });
            
            // 4. Armazena token e contexto
            authToken = authResult.token;
            context = authResult.user;
            
            // 5. Atualiza interface
            updateContextualInfo(context);
            
            console.log('✅ Processo de autenticação concluído com sucesso');
            return context;
            
        } catch (error) {
            console.error('❌ FALHA na autenticação:', error);
            showError(error.message + '\n\nVerifique se:\n1. Você está cadastrado no sistema\n2. O navegador permite acesso às informações do Windows\n3. A rede permite conexão com o servidor');
            return null;
        }
    }

    async function performLogout() {
        try {
            console.log('👋 Realizando logout...');
            
            if (authToken) {
                await api.logout();
            }
            
            // Limpa estado local
            authToken = null;
            context = null;
            authConfig = null;
            
            console.log('✅ Logout realizado, recarregando página...');
            
            // Recarrega página para estado inicial
            location.reload();
            
        } catch (error) {
            console.error('❌ Erro no logout:', error);
            // Força reload mesmo com erro
            location.reload();
        }
    }

    async function checkAuthStatus() {
        try {
            if (!authToken || !context) {
                // Tenta autenticação automática
                return await performAuthentication();
            }
            
            // Verifica se token ainda é válido
            const userInfo = await api.getCurrentUser();
            
            if (userInfo && userInfo.user) {
                context = userInfo.user;
                updateContextualInfo(context);
                return context;
            }
            
            // Token inválido, tenta nova autenticação
            authToken = null;
            context = null;
            return await performAuthentication();
            
        } catch (error) {
            console.error('❌ Erro ao verificar status de auth:', error);
            // Tenta autenticação do zero
            authToken = null;
            context = null;
            return await performAuthentication();
        }
    }

    // ===================================================================================================
    // EVENT LISTENERS - SIMPLIFICADO (SEM MODAL)
    // ===================================================================================================
    function bindEvents() {
        // Botão de logout
        const btnLogout = getElement('btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', performLogout);
        }
        
        // REMOVE COMPLETAMENTE o modal de login
        const loginModal = getElement('loginModal');
        if (loginModal) {
            loginModal.style.display = 'none';
            loginModal.remove(); // Remove do DOM
            console.log('🗑️ Modal de login removido (não é mais necessário)');
        }
    }

    // ===================================================================================================
    // INTERFACE PÚBLICA
    // ===================================================================================================
    return {
        // Inicialização
        async init() {
            console.log('🔧 Inicializando AuthModule (captura automática)...');
            bindEvents();
            return await checkAuthStatus();
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
            return context !== null && authToken !== null;
        },

        getCurrentUser() {
            return context;
        },

        getAuthMode() {
            return 'client_javascript';
        },

        getContext() {
            return context;
        },

        getProfile() {
            return context?.profile || null;
        },

        // Verificações de perfil
        isAdmin() {
            return context?.profile === 'ADMIN';
        },

        isFiscal() {
            return context?.isFiscal === true;
        },

        // Controle de interface
        setUserDisplay(name) {
            setUserDisplay(name);
        },

        applyProfileUI(profile) {
            applyProfileBasedUI(profile);
        },

        // Callbacks para outros módulos
        onAuthSuccess(callback) {
            window.onAuthSuccess = callback;
        },

        onPostAuthInit(callback) {
            window.onPostAuthInit = callback;
        },

        // Funções de compatibilidade (removidas/simplificadas)
        showLoginModal() {
            console.log('⚠️ showLoginModal() não é mais usado - autenticação é automática');
        },

        hideLoginModal() {
            console.log('⚠️ hideLoginModal() não é mais usado');
        },

        applyDesembarcanteLock() {
            // Mantido para compatibilidade
            const el = getElement('fDesCNome');
            if (el && context) {
                el.value = context.nome || '';
                el.readOnly = true;
                el.setAttribute('aria-readonly', 'true');
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