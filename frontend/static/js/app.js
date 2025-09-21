/**
 * ARQUIVO: frontend/static/js/app.js
 * PSWEB - Coordenador Principal da Aplicação - DEBUG INTEGRADO COM BACKEND
 */

// ===================================================================================================
// CONFIGURAÇÃO DE DEBUG - SINCRONIZADA COM BACKEND
// ===================================================================================================
let DEBUG_CONFIG = {
    DEBUG: false,
    DEBUG_AUTH: false,
    DEBUG_ROUTES: false
};

async function loadDebugConfig() {
    try {
        const response = await fetch('/api/auth/debug-config');
        if (response.ok) {
            const result = await response.json();
            DEBUG_CONFIG = result.config;
            console.log('🔧 Debug config carregada do backend:', DEBUG_CONFIG);
        }
    } catch (error) {
        // Se não conseguir carregar, mantém defaults (production mode)
        console.log('🔒 Debug config não disponível (production mode)');
    }
}

function debugLog(message, data = null) {
    if (DEBUG_CONFIG.DEBUG) {
        console.log(`🚀 [APP DEBUG] ${message}`, data || '');
    }
}

function debugAuth(message, data = null) {
    if (DEBUG_CONFIG.DEBUG_AUTH) {
        console.log(`🔐 [AUTH DEBUG] ${message}`, data || '');
    }
}

// ===================================================================================================
// SELETORES E UTILITÁRIOS GENÉRICOS
// ===================================================================================================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ===================================================================================================
// API AGREGADOR - Ponto Central de Todas as APIs
// ===================================================================================================
const api = {
  // === AUTENTICAÇÃO (delegada para AuthModule) ===
  async me() { return window.AuthModule ? window.AuthModule.api.getCurrentUser() : await fetch('/api/auth/me').then(r => r.json()); },
  async logout() { return window.AuthModule ? window.AuthModule.logout() : await fetch('/api/auth/logout', {method:'POST'}).then(r => r.json()); },
  
  // === EMBARCAÇÕES (delegada para EmbarcacoesModule) ===
  async embarcacoes() { return window.EmbarcacoesModule ? window.EmbarcacoesModule.api.getAll() : await fetch('/api/embarcacoes/').then(r => r.json()); },
  async createEmbarcacao(data) { return window.EmbarcacoesModule ? window.EmbarcacoesModule.api.create(data) : await fetch('/api/embarcacoes/', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(r => r.json()); },
  async updateEmbarcacao(id, data) { return window.EmbarcacoesModule ? window.EmbarcacoesModule.api.update(id, data) : await fetch(`/api/embarcacoes/${id}/`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(r => r.json()); },
  async deleteEmbarcacao(id) { return window.EmbarcacoesModule ? window.EmbarcacoesModule.api.delete(id) : await fetch(`/api/embarcacoes/${id}/`, {method:'DELETE'}).then(r => r.json()); },
  
  // === FISCAIS (delegada para FiscaisModule) ===
  async fiscais() { return window.FiscaisModule ? window.FiscaisModule.api.getAll() : await fetch('/api/fiscais/').then(r => r.json()); },
  async createFiscal(data) { return window.FiscaisModule ? window.FiscaisModule.api.create(data) : await fetch('/api/fiscais/', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(r => r.json()); },
  async updateFiscal(id, data) { return window.FiscaisModule ? window.FiscaisModule.api.update(id, data) : await fetch(`/api/fiscais/${id}/`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(r => r.json()); },
  async deleteFiscal(id) { return window.FiscaisModule ? window.FiscaisModule.api.delete(id) : await fetch(`/api/fiscais/${id}/`, {method:'DELETE'}).then(r => r.json()); },
  
  // === PASSAGENS DE SERVIÇO (delegada para PassagensModule) ===
  async listarPS(inicio, fim) { return window.PassagensModule ? window.PassagensModule.api.listarPS(inicio, fim) : await fetch('/api/passagens?' + new URLSearchParams({inicio, fim})).then(r => r.json()); },
  async ps(id) { return window.PassagensModule ? window.PassagensModule.api.getPS(id) : await fetch('/api/passagens/' + id).then(r => r.json()); },
  async criarPS(data) { return window.PassagensModule ? window.PassagensModule.api.criarPS(data) : await fetch('/api/passagens', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(r => r.json()); },
  async salvarPS(id, data) { return window.PassagensModule ? window.PassagensModule.api.salvarPS(id, data) : await fetch('/api/passagens/' + id, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(r => r.json()); },
  async finalizar(id) { return window.PassagensModule ? window.PassagensModule.api.finalizarPS(id) : await fetch('/api/passagens/' + id + '/finalizar', {method:'POST'}).then(r => r.json()); },
  async copiar(id) { return window.PassagensModule ? window.PassagensModule.api.copiarPS(id) : await fetch('/api/passagens/' + id + '/copiar', {method:'POST'}).then(r => r.json()); },
  
  // === ADMINISTRADORES (delegada para AdministradoresModule) ===
  async administradores() { return window.AdministradoresModule ? window.AdministradoresModule.api.getAll() : await fetch('/api/administradores/').then(r => r.json()); },
  async createAdministrador(data) { return window.AdministradoresModule ? window.AdministradoresModule.api.create(data) : await fetch('/api/administradores/', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(r => r.json()); },
  async updateAdministrador(id, data) { return window.AdministradoresModule ? window.AdministradoresModule.api.update(id, data) : await fetch(`/api/administradores/${id}/`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(r => r.json()); },
  async deleteAdministrador(id) { return window.AdministradoresModule ? window.AdministradoresModule.api.delete(id) : await fetch(`/api/administradores/${id}/`, {method:'DELETE'}).then(r => r.json()); }
};

// ===================================================================================================
// VARIÁVEIS GLOBAIS ESSENCIAIS
// ===================================================================================================
let CTX = null;           // Contexto do usuário atual
let FISCAIS = [];         // Lista de fiscais (para compatibilidade)
let EMB = [];             // Lista de embarcações (para compatibilidade)
let CUR_PS = null;        // PS atual selecionada (para compatibilidade)
let AUTH_MODE = 'windows_server'; // Modo de autenticação
let USER_PROFILE = null;  // Perfil do usuário atual ('USUARIO' ou 'ADMIN')

// ===================================================================================================
// UTILITÁRIOS GENÉRICOS COMPARTILHADOS
// ===================================================================================================

/**
 * Mostra/esconde elemento
 */
function _show(el, on) { 
  if (el) el.style.display = on ? '' : 'none'; 
}

/**
 * Habilita/desabilita elemento
 */
function _disable(el, on) { 
  if (el) el.disabled = !!on; 
}

/**
 * Verifica se está usando autenticação Windows (sempre true agora)
 */
const isWindowsAuth = () => true;

/**
 * Verifica se usuário é administrador
 */
const isAdmin = () => {
    debugAuth('isAdmin() chamado, USER_PROFILE:', USER_PROFILE);
    return USER_PROFILE === 'ADMIN';
};

/**
 * Verifica se usuário é apenas fiscal
 */
const isFiscal = () => {
    debugAuth('isFiscal() chamado, USER_PROFILE:', USER_PROFILE);
    return USER_PROFILE === 'USUARIO';
};

// ===================================================================================================
// NAVEGAÇÃO PRINCIPAL ENTRE ABAS COM CONTROLE DE PERFIL
// ===================================================================================================

/**
 * Controla navegação entre abas principais com verificação de perfil
 */
function setTab(id) {
  debugLog(`setTab('${id}') chamado`);
  debugLog('USER_PROFILE atual:', USER_PROFILE);
  debugLog('isAdmin():', isAdmin());
  
  // Verifica permissão para aba de cadastros
  if (id === 'cadastros' && !isAdmin()) {
    debugLog('🚫 Acesso negado à aba Cadastros - perfil não é ADMIN');
    debugLog('USER_PROFILE:', USER_PROFILE);
    console.warn('🚫 Acesso negado à aba Cadastros - perfil USUARIO');
    alert('Acesso restrito a administradores');
    return;
  }

  // Limpa mensagens de erro
  const msgNovaPS = document.getElementById("msgNovaPS");
  if (msgNovaPS) msgNovaPS.innerText = "";

  // Atualiza UI das abas
  $$('.tablink').forEach(b => {
    const isActive = b.dataset.tab === id;
    b.classList.toggle('active', isActive);
    debugLog(`Tab button ${b.dataset.tab}:`, isActive ? 'ATIVA' : 'inativa');
  });
  
  $$('.tab').forEach(t => {
    const isActive = t.id === `tab-${id}`;
    t.classList.toggle('active', isActive);
    debugLog(`Tab content ${t.id}:`, isActive ? 'ATIVA' : 'inativa');
  });
  
  debugLog(`✅ Navegação para aba '${id}' concluída`);
  
  // Delega ativação/desativação para módulos específicos
  if (id === 'cadastros') {
    debugLog('Ativando módulos de cadastro...');
    // Ativa módulos de cadastro (só para ADMIN)
    if (window.FiscaisModule && typeof window.FiscaisModule.onActivate === 'function') {
      window.FiscaisModule.onActivate();
    }
    if (window.EmbarcacoesModule && typeof window.EmbarcacoesModule.onActivate === 'function') {
      window.EmbarcacoesModule.onActivate();
    }
    if (window.AdministradoresModule && typeof window.AdministradoresModule.onActivate === 'function') {
      window.AdministradoresModule.onActivate();
    }
    if (window.AdmPassagensModule && typeof window.AdmPassagensModule.onActivate === 'function') {
      window.AdmPassagensModule.onActivate();
    }
  } else {
    debugLog('Desativando módulos de cadastro...');
    // Desativa módulos de cadastro
    if (window.FiscaisModule && typeof window.FiscaisModule.onDeactivate === 'function') {
      window.FiscaisModule.onDeactivate();
    }
    if (window.EmbarcacoesModule && typeof window.EmbarcacoesModule.onDeactivate === 'function') {
      window.EmbarcacoesModule.onDeactivate();
    }
    if (window.AdministradoresModule && typeof window.AdministradoresModule.onDeactivate === 'function') {
      window.AdministradoresModule.onDeactivate();
    }
    if (window.AdmPassagensModule && typeof window.AdmPassagensModule.onDeactivate === 'function') {
      window.AdmPassagensModule.onDeactivate();
    }
  }

  // Ativa módulo de passagens se necessário
  if (id === 'consultas' || id === 'passagem') {
    debugLog('Ativando módulo de passagens...');
    if (window.PassagensModule && typeof window.PassagensModule.onActivate === 'function') {
      window.PassagensModule.onActivate();
    }
  }
}

/**
 * Define display do usuário logado
 */
function setUser(name) { 
  debugAuth('setUser() chamado com nome:', name);
  const userEl = $('#userName');
  if (userEl) {
    userEl.textContent = name || '';
    debugAuth('Nome do usuário atualizado na interface:', name);
  } else {
    debugAuth('ERRO: Elemento userName não encontrado!');
  }
}

/**
 * Aplica controles de perfil na interface principal - COM DEBUG DETALHADO
 */
function applyProfileControls(profile) {
  debugAuth('🎯 applyProfileControls() chamado com perfil:', profile);
  debugAuth('USER_PROFILE antes da atualização:', USER_PROFILE);
  
  USER_PROFILE = profile;
  debugAuth('USER_PROFILE após atualização:', USER_PROFILE);
  
  // Controla visibilidade do botão Cadastros
  const cadastrosButton = document.querySelector('.tablink[data-tab="cadastros"]');
  debugAuth('Botão cadastros encontrado:', !!cadastrosButton);
  
  if (cadastrosButton) {
    debugAuth('Estado atual do botão cadastros:');
    debugAuth('  - display:', cadastrosButton.style.display);
    debugAuth('  - disabled:', cadastrosButton.disabled);
    
    if (profile === 'ADMIN') {
      // Admin: botão visível
      cadastrosButton.style.display = '';
      cadastrosButton.disabled = false;
      cadastrosButton.title = 'Acesso liberado - Administrador';
      debugAuth('✅ Botão Cadastros VISÍVEL (perfil ADMIN)');
    } else {
      // Usuario: botão oculto
      cadastrosButton.style.display = 'none';
      cadastrosButton.disabled = true;
      debugAuth('❌ Botão Cadastros OCULTO (perfil USUARIO)');
      
      // Se está na aba cadastros, volta para início
      const cadastrosTab = document.getElementById('tab-cadastros');
      if (cadastrosTab && cadastrosTab.classList.contains('active')) {
        debugAuth('📍 Estava na aba cadastros, redirecionando para consultas...');
        setTab('consultas');
      }
    }
    
    debugAuth('Estado final do botão cadastros:');
    debugAuth('  - display:', cadastrosButton.style.display);
    debugAuth('  - disabled:', cadastrosButton.disabled);
  }
  
  // Atualiza título com perfil
  const subTitle = document.getElementById('subTitle');
  if (subTitle) {
    const profileText = profile === 'ADMIN' ? 'Administrador' : 'Usuário';
    const newTitle = `Fiscalização SUB/SSUB/MIS - ${profileText}`;
    subTitle.textContent = newTitle;
    debugAuth('Título atualizado:', newTitle);
  }
  
  debugAuth(`🎯 Perfil ${profile} aplicado na interface principal`);
  debugAuth('isAdmin() após aplicação:', isAdmin());
  debugAuth('isFiscal() após aplicação:', isFiscal());
}

// ===================================================================================================
// INICIALIZAÇÃO E ORQUESTRAÇÃO DOS MÓDULOS
// ===================================================================================================

/**
 * Inicializa todos os módulos da aplicação
 */
async function initializeModules() {
  debugLog('🔧 Iniciando inicialização dos módulos...');
  
  const modules = [
    'AuthModule',
    'FiscaisModule', 
    'EmbarcacoesModule',
    'AdministradoresModule',
    'AdmPassagensModule',
    'PassagensModule'
  ];

  for (const moduleName of modules) {
    debugLog(`Inicializando módulo: ${moduleName}`);
    const module = window[moduleName];
    if (module && typeof module.init === 'function') {
      try {
        await module.init();
        debugLog(`✅ ${moduleName} inicializado com sucesso`);
      } catch (error) {
        debugLog(`❌ Erro ao inicializar ${moduleName}:`, error);
        console.error(`❌ Erro ao inicializar ${moduleName}:`, error);
      }
    } else {
      debugLog(`⚠️ ${moduleName} não encontrado ou sem método init()`);
    }
  }
  
  debugLog('🔧 Inicialização dos módulos concluída');
}

/**
 * Inicialização pós-autenticação
 */
async function postAuthInit() {
  debugLog('🔄 Iniciando pós-autenticação...');
  
  // Carrega dados essenciais para compatibilidade
  try {
    debugLog('Carregando embarcações...');
    EMB = await api.embarcacoes();
    debugLog('Carregando fiscais...');
    FISCAIS = await api.fiscais();
    debugLog(`📊 Dados carregados: ${EMB.length} embarcações, ${FISCAIS.length} fiscais`);
  } catch (error) {
    debugLog('❌ Erro ao carregar dados:', error);
    console.error('❌ Erro ao carregar dados:', error);
  }

  // Inicia busca inicial de passagens
  if (window.PassagensModule && typeof window.PassagensModule.search === 'function') {
    try {
      debugLog('Iniciando busca inicial de passagens...');
      await window.PassagensModule.search();
      debugLog('✅ Busca inicial de passagens concluída');
    } catch (error) {
      debugLog('⚠️ Erro na busca inicial de passagens:', error);
      console.warn('⚠️ Erro na busca inicial de passagens:', error);
    }
  }
  
  debugLog('🔄 Pós-autenticação concluída');
}

/**
 * Atualiza contexto global após autenticação - COM DEBUG DETALHADO
 */
function updateGlobalContext() {
  debugAuth('🔄 updateGlobalContext() iniciado');
  
  if (window.AuthModule) {
    CTX = window.AuthModule.getCurrentUser();
    AUTH_MODE = window.AuthModule.getAuthMode();
    USER_PROFILE = window.AuthModule.getProfile();
    
    debugAuth('Contexto capturado do AuthModule:');
    debugAuth('  - CTX:', CTX);
    debugAuth('  - AUTH_MODE:', AUTH_MODE);
    debugAuth('  - USER_PROFILE:', USER_PROFILE);
    
    setUser(CTX?.nome || '');
    
    // Aplica controles de perfil
    if (USER_PROFILE) {
      debugAuth('Aplicando controles de perfil...');
      applyProfileControls(USER_PROFILE);
    } else {
      debugAuth('⚠️ USER_PROFILE não definido!');
    }
    
    debugAuth('🔄 Contexto global atualizado:', {
      nome: CTX?.nome,
      profile: USER_PROFILE,
      auth_mode: AUTH_MODE,
      isFiscal: CTX?.isFiscal,
      isAdmin: CTX?.isAdmin
    });
  } else {
    debugAuth('❌ AuthModule não disponível!');
  }
}

/**
 * Callback para sucesso de autenticação
 */
async function onAuthSuccess() {
  debugAuth('✅ onAuthSuccess() chamado');
  updateGlobalContext();
  debugAuth('✅ Autenticação bem-sucedida, contexto atualizado');
}

/**
 * Callback para inicialização pós-autenticação
 */
async function onPostAuthInit() {
  debugLog('✅ onPostAuthInit() chamado');
  await postAuthInit();
  debugLog('✅ Inicialização pós-auth concluída');
}

// ===================================================================================================
// EVENT LISTENERS PRINCIPAIS
// ===================================================================================================

/**
 * Configura event listeners de coordenação principal
 */
function bindMainEventListeners() {
  debugLog('🔗 Configurando event listeners principais...');
  
  // Navegação entre abas principais
  $$('.tablink').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      debugLog(`Clique na aba: ${tab}`);
      
      // Verifica permissão antes de navegar
      if (tab === 'cadastros' && !isAdmin()) {
        debugLog(`🚫 Tentativa de acesso negada à aba Cadastros (perfil: ${USER_PROFILE})`);
        console.warn('🚫 Tentativa de acesso negada à aba Cadastros');
        return;
      }
      
      setTab(tab);
    });
  });

  // Navegação entre sub-abas (delegada)
  $$('.sublink').forEach(button => {
    button.addEventListener('click', () => {
      const sub = button.dataset.sub;
      debugLog(`Clique na sub-aba: ${sub}`);
      setSub(sub);
    });
  });
  
  debugLog('🔗 Event listeners configurados');
}

/**
 * Controla navegação entre sub-abas (delegada para PassagensModule)
 */
function setSub(id) {
  debugLog(`setSub('${id}') chamado`);
  if (window.PassagensModule && typeof window.PassagensModule.setActiveSubModule === 'function') {
    window.PassagensModule.setActiveSubModule(id);
  } else {
    // Fallback básico se módulo não disponível
    $$('.sublink').forEach(b => b.classList.toggle('active', b.dataset.sub === id));
    $$('.subtab').forEach(t => t.classList.toggle('active', t.id === `sub-${id}`));
  }
}

// ===================================================================================================
// INICIALIZAÇÃO PRINCIPAL
// ===================================================================================================

/**
 * Boot principal da aplicação - COM DEBUG DETALHADO
 */
async function boot() {
  console.log('🚀 Iniciando PSWEB...');

  try {
    // 1. Carrega configuração de debug do backend
    debugLog('Carregando configuração de debug...');
    await loadDebugConfig();
    
    // 2. Configura event listeners principais
    debugLog('Configurando event listeners...');
    bindMainEventListeners();

    // 3. Inicializa todos os módulos
    debugLog('Inicializando módulos...');
    await initializeModules();

    // 4. Configura callbacks para autenticação
    debugAuth('Configurando callbacks de autenticação...');
    if (window.AuthModule) {
      window.AuthModule.onAuthSuccess(onAuthSuccess);
      window.AuthModule.onPostAuthInit(onPostAuthInit);
      debugAuth('Callbacks configurados');
    } else {
      debugAuth('❌ AuthModule não disponível para configurar callbacks');
    }

    // 5. Inicia processo de autenticação
    debugAuth('Iniciando processo de autenticação...');
    if (window.AuthModule) {
      const authenticated = await window.AuthModule.checkAuth();
      if (authenticated) {
        debugAuth('✅ Sistema autenticado, atualizando contexto...');
        updateGlobalContext();
        debugAuth('Iniciando pós-autenticação...');
        await postAuthInit();
        debugAuth('✅ Sistema completamente inicializado');
        console.log('✅ Sistema autenticado e inicializado');
      } else {
        debugAuth('❌ Falha na autenticação');
        console.error('❌ Falha na autenticação');
        alert('Falha na autenticação. Verifique se você está cadastrado no sistema.');
      }
    } else {
      debugAuth('❌ AuthModule não disponível');
      console.error('⚠️ AuthModule não disponível');
      alert('Erro: Módulo de autenticação não carregado');
    }

    debugLog('✅ PSWEB boot concluído');
    console.log('✅ PSWEB inicializado com sucesso');

  } catch (error) {
    debugLog('❌ Erro fatal na inicialização:', error);
    console.error('❌ Erro fatal na inicialização:', error);
    alert('Erro na inicialização da aplicação: ' + error.message);
  }
}

// ===================================================================================================
// COMPATIBILIDADE COM CÓDIGO LEGADO
// ===================================================================================================

/**
 * Funções de compatibilidade para código legado que ainda pode referenciar
 */
window.setTab = setTab;
window.setSub = setSub;
window.setUser = setUser;
window.api = api;
window.CTX = CTX;
window.FISCAIS = FISCAIS;
window.EMB = EMB;
window.CUR_PS = CUR_PS;
window.AUTH_MODE = AUTH_MODE;
window.USER_PROFILE = USER_PROFILE;
window.isWindowsAuth = isWindowsAuth;
window.isAdmin = isAdmin;
window.isFiscal = isFiscal;
window.applyProfileControls = applyProfileControls;

// === FUNÇÕES DE DEBUG EXPOSTAS GLOBALMENTE ===
window.debugApp = {
  showContext: () => {
    console.log('=== CONTEXTO ATUAL ===');
    console.log('CTX:', CTX);
    console.log('USER_PROFILE:', USER_PROFILE);
    console.log('AUTH_MODE:', AUTH_MODE);
    console.log('isAdmin():', isAdmin());
    console.log('isFiscal():', isFiscal());
    console.log('DEBUG_CONFIG:', DEBUG_CONFIG);
  },
  testProfileControls: (profile) => {
    console.log(`Testando perfil: ${profile}`);
    applyProfileControls(profile);
  },
  enableDebug: () => {
    DEBUG_CONFIG.DEBUG = true;
    DEBUG_CONFIG.DEBUG_AUTH = true;
    console.log('Debug habilitado manualmente');
  }
};

// ===================================================================================================
// INICIALIZAÇÃO AUTOMÁTICA
// ===================================================================================================

// Inicia aplicação quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // DOM já carregado
  boot();
}