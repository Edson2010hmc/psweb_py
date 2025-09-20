/**
 * PSWEB - Coordenador Principal da Aplicação - ATUALIZADO
 * Localização: frontend/static/js/app.js
 * 
 * Responsabilidades:
 * - Coordenação geral da aplicação
 * - Navegação entre abas principais com controle de perfil
 * - Agregação de APIs de todos os módulos
 * - Utilitários genéricos compartilhados
 * - Inicialização e orquestração dos módulos
 * - Gerenciamento de estado global com perfis de usuário
 */

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
let AUTH_MODE = 'client_javascript'; // Modo de autenticação
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
 * Verifica se está usando autenticação Windows (sempre false agora)
 */
const isWindowsAuth = () => false;

/**
 * Verifica se usuário é administrador
 */
const isAdmin = () => USER_PROFILE === 'ADMIN';

/**
 * Verifica se usuário é apenas fiscal
 */
const isFiscal = () => USER_PROFILE === 'USUARIO';

/**
 * Normalização de chaves de objetos (compatibilidade)
 */
function _normalizeKeyToCamelPascal(k) {
  if (typeof k !== 'string' || !k) return k;
  const up = k.replace(/[_\s]+/g, '').toUpperCase();
  
  return up
    .replace(/([A-Z]+)(ID|CPF|CNPJ|OS|PS)$/g, (_, base, suf) =>
      base.charAt(0) + base.slice(1).toLowerCase() + suf.charAt(0) + suf.slice(1).toLowerCase()
    )
    .replace(/^([A-Z])/, (m) => m.toUpperCase())
    .replace(/([A-Z])([A-Z]+)/g, (m, a, b) => a + b.toLowerCase());
}

function normalizeDeep(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeDeep);
  } else if (value && typeof value === 'object' && Object.prototype.toString.call(value) === '[object Object]') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const nk = _normalizeKeyToCamelPascal(k);
      out[nk] = normalizeDeep(v);
    }
    return out;
  }
  return value;
}

// ===================================================================================================
// NAVEGAÇÃO PRINCIPAL ENTRE ABAS COM CONTROLE DE PERFIL
// ===================================================================================================

/**
 * Controla navegação entre abas principais com verificação de perfil
 */
function setTab(id) {
  // Verifica permissão para aba de cadastros
  if (id === 'cadastros' && !isAdmin()) {
    console.warn('🚫 Acesso negado à aba Cadastros - perfil USUARIO');
    alert('Acesso restrito a administradores');
    return;
  }

  // Limpa mensagens de erro
  const msgNovaPS = document.getElementById("msgNovaPS");
  if (msgNovaPS) msgNovaPS.innerText = "";

  // Atualiza UI das abas
  $$('.tablink').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${id}`));
  
  // Delega ativação/desativação para módulos específicos
  if (id === 'cadastros') {
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
    if (window.PassagensModule && typeof window.PassagensModule.onActivate === 'function') {
      window.PassagensModule.onActivate();
    }
  }
}

/**
 * Controla navegação entre sub-abas (delegada para PassagensModule)
 */
function setSub(id) {
  if (window.PassagensModule && typeof window.PassagensModule.setActiveSubModule === 'function') {
    window.PassagensModule.setActiveSubModule(id);
  } else {
    // Fallback básico se módulo não disponível
    $$('.sublink').forEach(b => b.classList.toggle('active', b.dataset.sub === id));
    $$('.subtab').forEach(t => t.classList.toggle('active', t.id === `sub-${id}`));
  }
}

/**
 * Define display do usuário logado
 */
function setUser(name) { 
  const userEl = $('#userName');
  if (userEl) userEl.textContent = name || ''; 
}

/**
 * Aplica controles de perfil na interface principal
 */
function applyProfileControls(profile) {
  USER_PROFILE = profile;
  
  // Controla visibilidade do botão Cadastros
  const cadastrosButton = document.querySelector('.tablink[data-tab="cadastros"]');
  
  if (cadastrosButton) {
    if (profile === 'ADMIN') {
      // Admin: botão visível
      cadastrosButton.style.display = '';
      cadastrosButton.disabled = false;
      cadastrosButton.title = 'Acesso liberado - Administrador';
    } else {
      // Usuario: botão oculto
      cadastrosButton.style.display = 'none';
      cadastrosButton.disabled = true;
      
      // Se está na aba cadastros, volta para início
      const cadastrosTab = document.getElementById('tab-cadastros');
      if (cadastrosTab && cadastrosTab.classList.contains('active')) {
        setTab('consultas');
      }
    }
  }
  
  // Atualiza título com perfil
  const subTitle = document.getElementById('subTitle');
  if (subTitle) {
    const profileText = profile === 'ADMIN' ? 'Administrador' : 'Usuário';
    subTitle.textContent = `Fiscalização SUB/SSUB/MIS - ${profileText}`;
  }
  
  console.log(`🎯 Perfil ${profile} aplicado na interface principal`);
}

// ===================================================================================================
// INICIALIZAÇÃO E ORQUESTRAÇÃO DOS MÓDULOS
// ===================================================================================================

/**
 * Inicializa todos os módulos da aplicação
 */
async function initializeModules() {
  const modules = [
    'AuthModule',
    'FiscaisModule', 
    'EmbarcacoesModule',
    'AdministradoresModule',
    'AdmPassagensModule',
    'PassagensModule'
  ];

  for (const moduleName of modules) {
    const module = window[moduleName];
    if (module && typeof module.init === 'function') {
      try {
        await module.init();
        console.log(`✅ ${moduleName} inicializado`);
      } catch (error) {
        console.error(`❌ Erro ao inicializar ${moduleName}:`, error);
      }
    }
  }
}

/**
 * Inicialização pós-autenticação
 */
async function postAuthInit() {
  // Carrega dados essenciais para compatibilidade
  try {
    EMB = await api.embarcacoes();
    FISCAIS = await api.fiscais();
    console.log(`📊 Dados carregados: ${EMB.length} embarcações, ${FISCAIS.length} fiscais`);
  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);
  }

  // Inicia busca inicial de passagens
  if (window.PassagensModule && typeof window.PassagensModule.search === 'function') {
    try {
      await window.PassagensModule.search();
    } catch (error) {
      console.warn('⚠️ Erro na busca inicial de passagens:', error);
    }
  }
}

/**
 * Atualiza contexto global após autenticação
 */
function updateGlobalContext() {
  if (window.AuthModule) {
    CTX = window.AuthModule.getCurrentUser();
    AUTH_MODE = window.AuthModule.getAuthMode();
    USER_PROFILE = window.AuthModule.getProfile();
    
    setUser(CTX?.nome || '');
    
    // Aplica controles de perfil
    if (USER_PROFILE) {
      applyProfileControls(USER_PROFILE);
    }
    
    console.log('🔄 Contexto global atualizado:', {
      nome: CTX?.nome,
      profile: USER_PROFILE,
      auth_mode: AUTH_MODE,
      isFiscal: CTX?.isFiscal,
      isAdmin: CTX?.isAdmin
    });
  }
}

/**
 * Callback para sucesso de autenticação
 */
async function onAuthSuccess() {
  updateGlobalContext();
  console.log('✅ Autenticação bem-sucedida, contexto atualizado');
}

/**
 * Callback para inicialização pós-autenticação
 */
async function onPostAuthInit() {
  await postAuthInit();
  console.log('✅ Inicialização pós-auth concluída');
}

// ===================================================================================================
// EVENT LISTENERS PRINCIPAIS
// ===================================================================================================

/**
 * Configura event listeners de coordenação principal
 */
function bindMainEventListeners() {
  // Navegação entre abas principais
  $$('.tablink').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      
      // Verifica permissão antes de navegar
      if (tab === 'cadastros' && !isAdmin()) {
        console.warn('🚫 Tentativa de acesso negada à aba Cadastros');
        return;
      }
      
      setTab(tab);
    });
  });

  // Navegação entre sub-abas (delegada)
  $$('.sublink').forEach(button => {
    button.addEventListener('click', () => setSub(button.dataset.sub));
  });
}

// ===================================================================================================
// INICIALIZAÇÃO PRINCIPAL
// ===================================================================================================

/**
 * Boot principal da aplicação
 */
async function boot() {
  console.log('🚀 Iniciando PSWEB com autenticação JavaScript...');

  try {
    // 1. Configura event listeners principais
    bindMainEventListeners();

    // 2. Inicializa todos os módulos
    await initializeModules();

    // 3. Configura callbacks para autenticação
    if (window.AuthModule) {
      window.AuthModule.onAuthSuccess(onAuthSuccess);
      window.AuthModule.onPostAuthInit(onPostAuthInit);
    }

    // 4. Inicia processo de autenticação
    if (window.AuthModule) {
      const authenticated = await window.AuthModule.checkAuth();
      if (authenticated) {
        updateGlobalContext();
        await postAuthInit();
        console.log('✅ Sistema autenticado e inicializado');
      } else {
        console.error('❌ Falha na autenticação');
        alert('Falha na autenticação. Verifique se você está cadastrado no sistema.');
      }
    } else {
      console.error('⚠️ AuthModule não disponível');
      alert('Erro: Módulo de autenticação não carregado');
    }

    console.log('✅ PSWEB inicializado com sucesso');

  } catch (error) {
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