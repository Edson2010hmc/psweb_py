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
 * Verifica se usuário é admin
 */
const isAdmin = () => {
    debugAuth('isAdmin() chamado, USER_PROFILE:', USER_PROFILE);
    return USER_PROFILE === 'ADMIN';
};

/**
 * Verifica se usuário não é admin
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
 * FUNÇÃO PRINCIPAL: Aplica controles de perfil na interface - COM DEBUG DETALHADO E CORREÇÕES
 */
function applyProfileControls(profile) {
  debugAuth('🎯 === INICIANDO applyProfileControls ===');
  debugAuth('Perfil recebido:', profile);
  debugAuth('USER_PROFILE antes da atualização:', USER_PROFILE);
  
  // Atualiza variável global
  USER_PROFILE = profile;
  debugAuth('USER_PROFILE após atualização:', USER_PROFILE);
  
  // Localiza o botão de cadastros
  const cadastrosButton = document.querySelector('.tablink[data-tab="cadastros"]');
  debugAuth('🔍 Procurando botão cadastros...');
  debugAuth('Botão cadastros encontrado:', !!cadastrosButton);
  
  if (!cadastrosButton) {
    debugAuth('❌ CRÍTICO: Botão cadastros não encontrado no DOM!');
    console.error('❌ CRÍTICO: Botão cadastros não encontrado no DOM!');
    
    // Tenta localizar todos os botões tablink para debug
    const allTablinks = document.querySelectorAll('.tablink');
    debugAuth('Todos os botões tablink encontrados:', allTablinks.length);
    allTablinks.forEach((btn, idx) => {
      debugAuth(`  ${idx}: data-tab="${btn.dataset.tab}", texto="${btn.textContent}"`);
    });
    
    return;
  }
  
  debugAuth('📊 Estado ANTES das alterações:');
  debugAuth('  - display:', window.getComputedStyle(cadastrosButton).display);
  debugAuth('  - disabled:', cadastrosButton.disabled);
  debugAuth('  - style.display:', cadastrosButton.style.display);
  debugAuth('  - classList:', Array.from(cadastrosButton.classList));
  
  // Aplica controles baseados no perfil
  if (profile === 'ADMIN') {
    debugAuth('🔧 Aplicando controles para ADMIN...');
    
    // Remove qualquer ocultação anterior
    cadastrosButton.style.display = '';
    cadastrosButton.style.visibility = '';
    cadastrosButton.disabled = false;
    cadastrosButton.title = 'Acesso liberado - Administrador';
    
    // Remove classes que possam ocultar o botão
    cadastrosButton.classList.remove('hidden', 'disabled');
    
    debugAuth('✅ Botão Cadastros VISÍVEL E HABILITADO (perfil ADMIN)');
    console.log('✅ Botão Cadastros VISÍVEL E HABILITADO (perfil ADMIN)');
    
  } else {
    debugAuth('🔧 Aplicando controles para USUARIO...');
    
    // Oculta o botão para usuários comuns
    cadastrosButton.style.display = 'none';
    cadastrosButton.disabled = true;
    cadastrosButton.title = 'Acesso restrito - Somente administradores';
    
    debugAuth('❌ Botão Cadastros OCULTO (perfil USUARIO)');
    console.log('❌ Botão Cadastros OCULTO (perfil USUARIO)');
    
    // Se está na aba cadastros, volta para início
    const cadastrosTab = document.getElementById('tab-cadastros');
    if (cadastrosTab && cadastrosTab.classList.contains('active')) {
      debugAuth('📍 Estava na aba cadastros, redirecionando para consultas...');
      console.log('📍 Estava na aba cadastros, redirecionando para consultas...');
      setTab('consultas');
    }
  }
  
  debugAuth('📊 Estado APÓS as alterações:');
  debugAuth('  - display:', window.getComputedStyle(cadastrosButton).display);
  debugAuth('  - disabled:', cadastrosButton.disabled);
  debugAuth('  - style.display:', cadastrosButton.style.display);
  debugAuth('  - classList:', Array.from(cadastrosButton.classList));
  
  // Atualiza título com perfil
  const subTitle = document.getElementById('subTitle');
  if (subTitle) {
    const profileText = profile === 'ADMIN' ? 'Perfil ADMIN' : 'Perfil FISCAL';
    const newTitle = `Fiscalização SUB/SSUB/MIS - ${profileText}`;
    subTitle.textContent = newTitle;
    debugAuth('Título atualizado:', newTitle);
  }
  
  // Força uma verificação adicional após 100ms (para garantir que mudanças persistam)
  setTimeout(() => {
    const currentDisplay = window.getComputedStyle(cadastrosButton).display;
    const currentDisabled = cadastrosButton.disabled;
    
    debugAuth('🔍 Verificação pós-aplicação (100ms depois):');
    debugAuth(`  - display: ${currentDisplay}`);
    debugAuth(`  - disabled: ${currentDisabled}`);
    debugAuth(`  - perfil esperado: ${profile}`);
    
    if (profile === 'ADMIN' && (currentDisplay === 'none' || currentDisabled)) {
      debugAuth('⚠️ INCONSISTÊNCIA DETECTADA! Botão deveria estar visível para ADMIN');
      console.warn('⚠️ INCONSISTÊNCIA DETECTADA! Botão deveria estar visível para ADMIN');
      
      // Força novamente
      cadastrosButton.style.display = '';
      cadastrosButton.disabled = false;
      debugAuth('🔧 Forçando visibilidade novamente...');
    }
  }, 100);
  
  debugAuth(`🎯 === FIM applyProfileControls - Perfil ${profile} aplicado ===`);
  debugAuth('isAdmin() após aplicação:', isAdmin());
  debugAuth('isFiscal() após aplicação:', isFiscal());
  console.log(`🎯 Perfil ${profile} aplicado na interface principal`);
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
 * Atualiza contexto global após autenticação - COM DEBUG 
 */
function updateGlobalContext() {
  debugAuth('🔄 === INICIANDO updateGlobalContext ===');
  
  if (!window.AuthModule) {
    debugAuth('❌ AuthModule não disponível!');
    return;
  }
  
  // Captura dados do AuthModule
  CTX = window.AuthModule.getCurrentUser();
  AUTH_MODE = window.AuthModule.getAuthMode();
  USER_PROFILE = window.AuthModule.getProfile();
  
  debugAuth('📋 Dados capturados do AuthModule:');
  debugAuth('  - CTX:', CTX);
  debugAuth('  - AUTH_MODE:', AUTH_MODE);
  debugAuth('  - USER_PROFILE:', USER_PROFILE);
  
  // Valida se dados foram capturados corretamente
  if (!CTX) {
    debugAuth('❌ CTX não foi capturado!');
    console.error('❌ CTX não foi capturado do AuthModule!');
    return;
  }
  
  if (!USER_PROFILE) {
    debugAuth('❌ USER_PROFILE não foi capturado!');
    console.error('❌ USER_PROFILE não foi capturado do AuthModule!');
    return;
  }
  
  // Atualiza nome do usuário
  debugAuth('Atualizando nome do usuário na interface...');
  setUser(CTX?.nome || '');
  
  // CHAMA A FUNÇÃO PRINCIPAL de controle de perfil
  debugAuth('🎯 Chamando applyProfileControls...');
  applyProfileControls(USER_PROFILE);
  
  // Log final de verificação
  debugAuth('🔄 === FIM updateGlobalContext ===');
  debugAuth('Estado final:', {
    nome: CTX?.nome,
    profile: USER_PROFILE,
    auth_mode: AUTH_MODE,
    isFiscal: CTX?.isFiscal,
    isAdmin: CTX?.isAdmin,
    isAdminFunction: isAdmin(),
    isFiscalFunction: isFiscal()
  });
  
  console.log('🔄 Contexto global atualizado:', {
    nome: CTX?.nome,
    profile: USER_PROFILE,
    auth_mode: AUTH_MODE
  });
}

/**
 * Callback para sucesso de autenticação - CORRIGIDO
 */
async function onAuthSuccess() {
  debugAuth('✅ === onAuthSuccess CHAMADO ===');
  
  // Aguarda um frame para garantir que AuthModule finalizou
  await new Promise(resolve => requestAnimationFrame(resolve));
  
  debugAuth('Atualizando contexto global...');
  updateGlobalContext();
  
  debugAuth('✅ onAuthSuccess concluído');
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

    // 3. Configura callbacks para autenticação (antes da inicialização dos módulos)
    debugAuth('Configurando callbacks de autenticação...');
    let callbacksExecutadosAntecipadamente = false;
    if (window.AuthModule) {
      window.AuthModule.onAuthSuccess(onAuthSuccess);
      window.AuthModule.onPostAuthInit(onPostAuthInit);
      debugAuth('Callbacks configurados com sucesso');

      try {
        const ctx = typeof window.AuthModule.getCurrentUser === 'function'
          ? window.AuthModule.getCurrentUser()
          : null;
        const hasCtx = ctx && (typeof ctx === 'object' ? Object.keys(ctx).length > 0 : true);
        const jaAutenticado = hasCtx ||
          (typeof window.AuthModule.isAuthenticated === 'function' && window.AuthModule.isAuthenticated());

        if (jaAutenticado) {
          debugAuth('⚡ Autenticação pré-existente detectada; executando atualização imediata de contexto.');
          updateGlobalContext();
          await postAuthInit();
          callbacksExecutadosAntecipadamente = true;
          debugAuth('⚡ Fluxo pós-autenticação executado antecipadamente.');
        }
      } catch (error) {
        debugAuth('⚠️ Não foi possível executar callbacks antecipados:', error);
        console.warn('⚠️ Não foi possível executar callbacks antecipados:', error);
      }
    } else {
      debugAuth('❌ AuthModule não disponível para configurar callbacks');
    }

    // 4. Inicializa todos os módulos
    debugLog('Inicializando módulos...');
    await initializeModules();

    // 5. Valida autenticação (callbacks podem já ter sido executados)
    debugAuth('Validando estado de autenticação com AuthModule...');
    if (window.AuthModule) {
      const authenticated = await window.AuthModule.checkAuth();
      if (authenticated) {
        if (callbacksExecutadosAntecipadamente) {
          debugAuth('✅ Token válido. Callbacks já haviam sido executados antecipadamente.');
        } else {
          debugAuth('✅ Token válido. Callbacks acionados pelo AuthModule durante a validação.');
        }
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
    console.log(`🧪 Testando perfil: ${profile}`);
    applyProfileControls(profile);
  },
  enableDebug: () => {
    DEBUG_CONFIG.DEBUG = true;
    DEBUG_CONFIG.DEBUG_AUTH = true;
    console.log('🔧 Debug habilitado manualmente');
  },
  forceUpdateProfile: () => {
    console.log('🔧 Forçando atualização de perfil...');
    updateGlobalContext();
  },
  checkCadastrosButton: () => {
    const btn = document.querySelector('.tablink[data-tab="cadastros"]');
    console.log('=== ESTADO DO BOTÃO CADASTROS ===');
    console.log('Encontrado:', !!btn);
    if (btn) {
      console.log('Display computed:', window.getComputedStyle(btn).display);
      console.log('Display style:', btn.style.display);
      console.log('Disabled:', btn.disabled);
      console.log('Classes:', Array.from(btn.classList));
      console.log('Title:', btn.title);
    }
    console.log('USER_PROFILE:', USER_PROFILE);
    console.log('isAdmin():', isAdmin());
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