/**
 * ARQUIVO: frontend/static/js/app.js
 * PSWEB - Coordenador Principal da Aplicação - DEBUG INTEGRADO COM BACKEND
 * CORREÇÃO: Inicialização sequencial dos módulos e event listeners
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
// VARIÁVEIS GLOBAIS DE CONTROLE
// ===================================================================================================
let USER_CONTEXT = null;
let USER_PROFILE = null;
let MODULES_INITIALIZED = false;

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
  
  // === AUDITORIA/DEBUG ===
  async debugSystemInfo() { return fetch('/debug-system').then(r => r.json()).catch(() => null); }
};

// Disponibiliza API globalmente
window.api = api;

// ===================================================================================================
// CONTROLE DE PERFIS E PERMISSÕES
// ===================================================================================================
function isAdmin() {
  return USER_PROFILE === 'ADMIN';
}

function showError(message) {
  alert('ERRO: ' + message);
}

function showSuccess(message) {
  alert('SUCESSO: ' + message);
}

function showConfirm(message) {
  return confirm(message);
}

// ===================================================================================================
// CONTROLE DE ABAS PRINCIPAIS
// ===================================================================================================
function setTab(targetTab) {
  debugLog(`Mudando para aba: ${targetTab}`);
  
  // Remove ativo de todos os botões
  $$('.tablink').forEach(btn => btn.classList.remove('active'));
  
  // Remove ativo de todas as abas
  $$('.tab').forEach(tab => tab.classList.remove('active'));
  
  // Ativa o botão clicado
  const activeButton = $(`.tablink[data-tab="${targetTab}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }
  
  // Ativa a aba correspondente
  const activeTab = $(`#tab-${targetTab}`);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  debugLog(`Aba ${targetTab} ativada`);
}

function setMainTab(targetTab) {
  // Função de compatibilidade para uso em módulos
  setTab(targetTab);
}

// ===================================================================================================
// INICIALIZAÇÃO DE MÓDULOS
// ===================================================================================================
async function initializeModules() {
  debugLog('🚀 Iniciando inicialização sequencial dos módulos...');
  
  const moduleInitOrder = [
    'AuthModule',
    'FiscaisModule', 
    'EmbarcacoesModule',
    'AdministradoresModule',
    'AdmPassagensModule',
    'PassagensModule'
  ];
  
  for (const moduleName of moduleInitOrder) {
    try {
      debugLog(`📦 Inicializando ${moduleName}...`);
      
      if (window[moduleName] && typeof window[moduleName].init === 'function') {
        await window[moduleName].init();
        debugLog(`✅ ${moduleName} inicializado com sucesso`);
      } else {
        debugLog(`⚠️ ${moduleName} não disponível ou sem método init()`);
      }
    } catch (error) {
      debugLog(`❌ Erro ao inicializar ${moduleName}:`, error);
      console.error(`❌ Erro ao inicializar ${moduleName}:`, error);
    }
  }
  
  MODULES_INITIALIZED = true;
  debugLog('✅ Todos os módulos inicializados');
}

async function postAuthInit() {
  debugLog('🔄 Executando inicialização pós-autenticação...');
  
  try {
    // Aguarda contexto de usuário
    USER_CONTEXT = window.AuthModule?.getCurrentUser();
    USER_PROFILE = USER_CONTEXT?.profile;
    
    debugLog('Contexto de usuário obtido:', {
      nome: USER_CONTEXT?.nome,
      profile: USER_PROFILE,
      fiscalId: USER_CONTEXT?.fiscalId
    });
    
    // Atualiza interface baseada no perfil
    updateUIForProfile();
    await loadUserPhoto();
    
    // *** CORREÇÃO PRINCIPAL: Força rebind dos event listeners após autenticação ***
    await rebindModuleEventListeners();
    
    debugLog('✅ Inicialização pós-auth concluída');
    
  } catch (error) {
    debugLog('❌ Erro na inicialização pós-auth:', error);
    console.error('❌ Erro na inicialização pós-auth:', error);
  }
}

// *** NOVA FUNÇÃO: Re-vincula event listeners dos módulos ***
async function rebindModuleEventListeners() {
  debugLog('🔗 Re-vinculando event listeners dos módulos...');
  
  // Força rebind do módulo de passagens (onde está o botão Nova PS)
  if (window.PassagensModule && typeof window.PassagensModule.rebindEvents === 'function') {
    try {
      await window.PassagensModule.rebindEvents();
      debugLog('✅ Event listeners do PassagensModule re-vinculados');
    } catch (error) {
      debugLog('❌ Erro ao re-vincular PassagensModule:', error);
    }
  }
  
  // Verifica especificamente o botão Nova PS
  const btnNova = $('#btnNova');
  if (btnNova) {
    debugLog('🔍 Botão Nova PS encontrado e verificado');
    
    // Se o módulo de passagens não tem rebindEvents, força bind manual
    if (!window.PassagensModule?.rebindEvents) {
      debugLog('⚠️ PassagensModule sem rebindEvents, aplicando bind manual...');
      
      // Remove listeners antigos
      const oldBtn = btnNova.cloneNode(true);
      btnNova.parentNode.replaceChild(oldBtn, btnNova);
      
      // Adiciona novo listener
      const newBtnNova = $('#btnNova');
      if (newBtnNova && window.PassagensModule?.onNovaPS_Guard) {
        newBtnNova.addEventListener('click', window.PassagensModule.onNovaPS_Guard);
        debugLog('✅ Event listener do botão Nova PS re-vinculado manualmente');
      }
    }
  } else {
    debugLog('❌ Botão Nova PS não encontrado no DOM');
  }
}

function updateUIForProfile() {
  debugLog('🖥️ Atualizando interface para perfil:', USER_PROFILE);
  
  // Atualiza nome do usuário
  const userNameEl = $('#userName');
  if (userNameEl && USER_CONTEXT?.nome) {
    userNameEl.textContent = USER_CONTEXT.nome;
  }

  // *** NOVO: Controla label de perfil admin ***
  const userProfileEl = $('#userProfile');
  if (userProfileEl) {
    if (isAdmin()) {
      userProfileEl.style.display = '';  // Mostra
      debugLog('✅ Label ADMINISTRADOR exibido');
    } else {
      userProfileEl.style.display = 'none';  // Oculta
      debugLog('🚫 Label ADMINISTRADOR ocultado');
    }
  }
  
  // Controla visibilidade da aba Cadastros baseada no perfil
  const cadastrosTab = $(`.tablink[data-tab="cadastros"]`);
  if (cadastrosTab) {
    const prof_info = getElement('profile');
    if (isAdmin()) {
      cadastrosTab.style.display = '';
      cadastrosTab.disabled = false;
      prof_info.innerText = "Perfil Administrador";
      debugLog('✅ Aba Cadastros habilitada para ADMIN');
    } else {
      cadastrosTab.style.display = 'none';
      cadastrosTab.disabled = true;
      prof_info.innerText = ""
      debugLog('🚫 Aba Cadastros ocultada para perfil USER');
    }
  }
}

async function loadUserPhoto() {
  try {
    const response = await fetch('/api/auth/photo');
    const result = await response.json();
    
    const userPhoto = $('#userPhoto');
    if (userPhoto && result.success && result.photo_url) {
      userPhoto.src = result.photo_url;
      userPhoto.style.display = 'block';
      debugLog('✅ Foto do usuário carregada');
    } else {
      userPhoto.style.display = 'none';
      debugLog('⚠️ Foto não encontrada ou erro na API');
    }
  } catch (error) {
    debugLog('❌ Erro ao carregar foto:', error);
    const userPhoto = $('#userPhoto');
    if (userPhoto) userPhoto.style.display = 'none';
  }
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

    // 3. Inicializa todos os módulos SEQUENCIALMENTE
    debugLog('Inicializando módulos...');
    await initializeModules();

    // 4. Configura callbacks para autenticação
    debugLog('Configurando callbacks de autenticação...');
    if (window.AuthModule && typeof window.AuthModule.setOnAuthSuccessCallback === 'function') {
      window.AuthModule.setOnAuthSuccessCallback(onPostAuthInit);
      debugLog('✅ Callback de autenticação configurado');
    }

    // 5. Inicia autenticação
    debugLog('Iniciando processo de autenticação...');
    if (window.AuthModule && typeof window.AuthModule.checkOrAuthenticate === 'function') {
      await window.AuthModule.checkOrAuthenticate();
    }

    debugLog('✅ Boot principal concluído');
    console.log('✅ PSWEB iniciado com sucesso');

  } catch (error) {
    debugLog('❌ Erro durante boot:', error);
    console.error('❌ Erro durante boot:', error);
    showError('Erro durante inicialização: ' + error.message);
  }
}

// ===================================================================================================
// UTILITÁRIOS DE DEBUG
// ===================================================================================================
window.debugApp = {
  getContext: () => USER_CONTEXT,
  getProfile: () => USER_PROFILE,
  getModulesStatus: () => MODULES_INITIALIZED,
  checkButton: (id) => {
    const btn = $(id);
    console.log(`Botão ${id}:`, {
      exists: !!btn,
      disabled: btn?.disabled,
      visible: btn ? window.getComputedStyle(btn).display !== 'none' : false,
      hasListeners: btn ? !!btn.onclick || btn.hasAttribute('onclick') : false
    });
    return btn;
  },
  forceRebind: () => rebindModuleEventListeners()
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