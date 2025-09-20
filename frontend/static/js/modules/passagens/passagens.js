/**
 * Módulo de Gestão de Passagens de Serviço (COORDENADOR)
 * Localização: frontend/static/js/modules/passagens/passagens.js
 * 
 * Responsabilidades:
 * - Coordenar todos os submódulos de PS
 * - Gerenciar navegação entre sub-abas 
 * - Controlar lista e busca de PS
 * - Gerenciar cabeçalho da PS (dados principais)
 * - Coordenar operações complexas (nova PS, cópia, finalizar)
 * - Gerenciar estado compartilhado entre submódulos
 */

const PassagensModule = (function() {
    'use strict';

    // ===================================================================================================
    // ESTADO INTERNO DO MÓDULO
    // ===================================================================================================
    let currentPS = null;
    let passagensList = [];
    let activeSubModule = 'porto';
    let registeredSubModules = {};

    // ===================================================================================================
    // SISTEMA DE REGISTRO DE SUBMÓDULOS
    // ===================================================================================================
    const subModules = {
        // Registra um submódulo no sistema
        register(name, moduleInstance) {
            registeredSubModules[name] = moduleInstance;
            console.log(`📌 Submódulo registrado: ${name}`);
        },

        // Obtém submódulo registrado
        get(name) {
            return registeredSubModules[name];
        },

        // Inicializa todos os submódulos registrados
        async initAll() {
            for (const [name, module] of Object.entries(registeredSubModules)) {
                if (module && typeof module.init === 'function') {
                    try {
                        await module.init();
                        console.log(`✅ Submódulo inicializado: ${name}`);
                    } catch (error) {
                        console.error(`❌ Erro ao inicializar submódulo ${name}:`, error);
                    }
                }
            }
        },

        // Notifica submódulo sobre mudança de PS
        async notifyPSChange(psData) {
            for (const [name, module] of Object.entries(registeredSubModules)) {
                if (module && typeof module.onPSChange === 'function') {
                    try {
                        await module.onPSChange(psData);
                    } catch (error) {
                        console.error(`❌ Erro ao notificar submódulo ${name} sobre mudança de PS:`, error);
                    }
                }
            }
        },

        // Placeholder para submódulos futuros
        placeholders: {
            // 🔄 TODO: Implementar submódulos quando criados
            // porto: null,        // ✅ Será o primeiro a ser extraído
            // sms: null,          // 🔄 TODO: Extrair do app.js futuramente  
            // rotina: null,       // 🔄 TODO: Implementar (IAPO, SMS, Smart RDO)
            // pendencias: null,   // 🔄 TODO: Implementar
            // ordens: null,       // 🔄 TODO: Implementar (OS)
            // gerais: null,       // 🔄 TODO: Implementar (Informações Gerais)
            // historico: null     // 🔄 TODO: Implementar (Log de auditoria)
        }
    };

    // ===================================================================================================
    // APIs ESPECÍFICAS DO MÓDULO
    // ===================================================================================================
    const api = {
        async listarPS(inicio, fim) {
            const params = new URLSearchParams();
            if (inicio) params.append('inicio', inicio);
            if (fim) params.append('fim', fim);
            
            const response = await fetch('/api/passagens?' + params.toString());
            return response.json();
        },

        async getPS(id) {
            const response = await fetch('/api/passagens/' + id);
            return response.json();
        },

        async criarPS(data) {
            const response = await fetch('/api/passagens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },

        async salvarPS(id, data) {
            const response = await fetch('/api/passagens/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },

        async finalizarPS(id) {
            const response = await fetch('/api/passagens/' + id + '/finalizar', {
                method: 'POST'
            });
            return response.json();
        },

        async copiarPS(id) {
            const response = await fetch('/api/passagens/' + id + '/copiar', {
                method: 'POST'
            });
            return response.json();
        },

        async excluirPS(id) {
            const response = await fetch('/api/admin/passagens/' + id, {
                method: 'DELETE'
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
        alert('Erro: ' + message);
    }

    function showSuccess(message) {
        alert(message);
    }

    function createOption(value, text) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        return option;
    }

    // ===================================================================================================
    // CONTROLE DE NAVEGAÇÃO ENTRE SUB-ABAS
    // ===================================================================================================
    function setActiveSubModule(subModuleName) {
        // Atualiza estado
        activeSubModule = subModuleName;

        // Atualiza UI - botões de navegação
        document.querySelectorAll('.sublink').forEach(button => {
            button.classList.toggle('active', button.dataset.sub === subModuleName);
        });

        // Atualiza UI - conteúdo das abas
        document.querySelectorAll('.subtab').forEach(tab => {
            tab.classList.toggle('active', tab.id === `sub-${subModuleName}`);
        });

        // Notifica submódulo ativo sobre ativação
        const activeModule = subModules.get(subModuleName);
        if (activeModule && typeof activeModule.onActivate === 'function') {
            activeModule.onActivate(currentPS);
        }

        console.log(`🎯 Submódulo ativo: ${subModuleName}`);
    }

    // ===================================================================================================
    // GESTÃO DE LISTA DE PS
    // ===================================================================================================
    function renderPassagensList(items) {
        const list = getElement('listaPS');
        if (!list) return;

        list.innerHTML = '';
        
        items.forEach(ps => {
            const li = document.createElement('li');
            
            // Determina papel do usuário atual
            const userContext = window.AuthModule?.getCurrentUser();
            const papel = (ps.FiscalEmbarcandoId === userContext?.fiscalId) ? 'Embarque'
                       : (ps.FiscalDesembarcandoId === userContext?.fiscalId) ? 'Desembarque' : '';
            
            const numero = ps.NumeroPS || ps.PassagemId || '---';

            li.innerHTML = `
                <div><strong>${numero} - ${ps.EmbarcacaoNome}</strong></div>
                <div class="tag">${ps.PeriodoInicio} a ${ps.PeriodoFim}</div>
                <div>${papel} - ${ps.DataEmissao}</div>
                <div>Status: <strong>${ps.Status}</strong></div>
            `;

            li.onclick = () => {
                // Muda para aba de passagem e carrega a PS
                setMainTab('passagem');
                loadPassagem(ps.PassagemId);
            };

            list.appendChild(li);
        });
    }

    async function searchPassagens() {
        try {
            const inicio = getElement('fInicio')?.value;
            const fim = getElement('fFim')?.value;
            
            passagensList = await api.listarPS(inicio, fim);
            renderPassagensList(passagensList);
            
        } catch (error) {
            showError('Erro ao buscar passagens: ' + error.message);
        }
    }

    // ===================================================================================================
    // GESTÃO DE PS INDIVIDUAL
    // ===================================================================================================
    function togglePSForm(show) {
        const placeholder = getElement('psPlaceholder');
        const form = getElement('psForm');
        
        if (placeholder) placeholder.classList.toggle('hidden', show);
        if (form) form.classList.toggle('hidden', !show);
    }

    async function loadPassagem(psId) {
        try {
            const ps = await api.getPS(psId);
            
            if (ps.error) {
                showError(ps.error);
                return;
            }

            currentPS = ps;
            togglePSForm(true);
            
            // Preenche campos do cabeçalho
            populateHeaderFields(ps);
            
            // Controla permissões
            applyPermissions(ps);
            
            // Notifica todos os submódulos sobre a mudança
            await subModules.notifyPSChange(ps);
            
            console.log(`📋 PS carregada: ${ps.PassagemId}`);
            
        } catch (error) {
            showError('Erro ao carregar PS: ' + error.message);
        }
    }

    function populateHeaderFields(ps) {
        // Preenche campos básicos
        const fields = {
            'fNumero': ps.NumeroPS || ps.PassagemId || '',
            'fData': ps.DataEmissao || '',
            'fInicioPS': ps.PeriodoInicio,
            'fFimPS': ps.PeriodoFim,
            'fStatus': ps.Status,
            'fDesCNome': ps.FiscalDesembarcandoNome || ''
        };

        Object.entries(fields).forEach(([id, value]) => {
            const element = getElement(id);
            if (element) element.value = value;
        });

        // Popula dropdown de embarcação
        const embSelect = getElement('fEmb');
        if (embSelect && window.EmbarcacoesModule) {
            window.EmbarcacoesModule.populateSelect(embSelect);
            embSelect.value = ps.EmbarcacaoId;
            embSelect.disabled = true; // Embarcação não pode ser alterada
        }

        // Popula dropdown de fiscal embarcando
        const fiscalSelect = getElement('fEmbC');
        if (fiscalSelect && window.FiscaisModule) {
            window.FiscaisModule.populateSelect(fiscalSelect);
            if (ps.FiscalEmbarcandoId) fiscalSelect.value = ps.FiscalEmbarcandoId;
        }
    }

    function applyPermissions(ps) {
        const userContext = window.AuthModule?.getCurrentUser();
        
        // Verifica se pode editar
        const canEdit = (ps.Status === 'RASCUNHO') &&
                      (new Date() <= new Date(new Date(ps.PeriodoFim).getTime() + 24*60*60*1000)) &&
                      (ps.FiscalDesembarcandoId === userContext?.fiscalId);

        // Aplica permissões nos campos
        ['fNumero', 'fData', 'fInicioPS', 'fFimPS', 'fEmbC', 'fDesCNome'].forEach(id => {
            const element = getElement(id);
            if (element) element.disabled = !canEdit;
        });

        // Aplica permissões nos botões
        const buttons = {
            'btnSalvar': canEdit,
            'btnFinalizar': canEdit,
            'btnCopiar': (ps.Status === 'FINALIZADA' && ps.FiscalEmbarcandoId === userContext?.fiscalId),
            'btnExcluirRasc': (ps.Status === 'RASCUNHO')
        };

        Object.entries(buttons).forEach(([id, enabled]) => {
            const button = getElement(id);
            if (button) button.disabled = !enabled;
        });

        // Aplica lock nos campos específicos da autenticação
        if (window.AuthModule) {
            window.AuthModule.applyDesembarcanteLock();
        }
    }

    // ===================================================================================================
    // OPERAÇÕES DE PS
    // ===================================================================================================
    async function salvarPassagem() {
        if (!currentPS) return;

        const payload = {
            NumeroPS: getElement('fNumero')?.value || null,
            DataEmissao: getElement('fData')?.value || null,
            PeriodoInicio: getElement('fInicioPS')?.value,
            PeriodoFim: getElement('fFimPS')?.value,
            EmbarcacaoId: Number(getElement('fEmb')?.value),
            FiscalEmbarcandoId: getElement('fEmbC')?.value ? Number(getElement('fEmbC')?.value) : null
        };

        try {
            const result = await api.salvarPS(currentPS.PassagemId, payload);
            
            if (result.error) {
                showError(result.error);
                return;
            }

            showSuccess('Rascunho salvo.');
            await loadPassagem(currentPS.PassagemId);
            await searchPassagens();
            
        } catch (error) {
            showError('Erro ao salvar: ' + error.message);
        }
    }

    async function finalizarPassagem() {
        if (!currentPS) return;

        try {
            const result = await api.finalizarPS(currentPS.PassagemId);
            
            if (result.error) {
                showError(result.error);
                return;
            }

            showSuccess('Finalizada. PDF em: ' + result.pdfPath);
            await loadPassagem(currentPS.PassagemId);
            await searchPassagens();
            
        } catch (error) {
            showError('Erro ao finalizar: ' + error.message);
        }
    }

    async function copiarPassagem() {
        if (!currentPS) return;

        try {
            const result = await api.copiarPS(currentPS.PassagemId);
            
            if (result.error) {
                showError(result.error);
                return;
            }

            showSuccess('Nova PS criada: ' + result.NewPassagemId);
            await searchPassagens();
            setMainTab('consultas');
            
        } catch (error) {
            showError('Erro ao copiar: ' + error.message);
        }
    }

    async function excluirPassagemAtual() {
        if (!currentPS) return;

        const confirmed = window.confirm('Confirma a exclusão desta PS? Esta ação é permanente.');
        if (!confirmed) return;

        try {
            const result = await api.excluirPS(currentPS.PassagemId);
            
            if (result.error) {
                showError(result.error);
                return;
            }

            showSuccess('Rascunho excluído.');
            await searchPassagens();
            setMainTab('consultas');
            togglePSForm(false);
            
        } catch (error) {
            showError('Erro ao excluir: ' + error.message);
        }
    }

    // ===================================================================================================
    // CONTROLE DE ABAS PRINCIPAIS
    // ===================================================================================================
    function setMainTab(tabId) {
        // Função externa - será chamada pelo app.js principal
        if (typeof window.setTab === 'function') {
            window.setTab(tabId);
        }
    }

    // ===================================================================================================
    // NOVA PS E MODAL
    // ===================================================================================================
    
    /**
     * Calcula os dados da próxima PS a partir da data de primeiro porto
     * @param {string|Date} primeiroPorto - data em formato "YYYY-MM-DD"
     * @param {Date} hoje - data de referência (normalmente new Date())
     * @returns {Object} { inicio, fim, emissao, numero, ano }
     */
    function calcularProximaPS(primeiroPorto, hoje = new Date()) {
        const duracao = 14; // dias

        const dtPrimeiro = new Date(primeiroPorto);
        const diasPassados = Math.floor((hoje - dtPrimeiro) / (1000*60*60*24));

        // Quantas PS cabem até hoje
        let psPassadas = Math.floor(diasPassados / duracao);

        // Início e fim da PS atual
        let inicio = new Date(dtPrimeiro.getTime() + psPassadas * duracao * 86400000);
        let fim = new Date(inicio.getTime() + (duracao-1) * 86400000);

        // Se hoje já passou do fim → próxima PS
        if (hoje > fim) {
            psPassadas++;
            inicio = new Date(inicio.getTime() + duracao * 86400000);
            fim = new Date(fim.getTime() + duracao * 86400000);
        }

        // Data de emissão = início da seguinte
        const emissao = new Date(inicio.getTime() + duracao * 86400000);

        // Número/ano reinicia a cada ano CIVIL, respeitando a PEP
        const ano = emissao.getFullYear();
        const inicioAno = new Date(ano, 0, 1);
        const ancora = dtPrimeiro > inicioAno ? dtPrimeiro : inicioAno;

        // posição ordinal da EMISSÃO dentro do ano civil (ciclos de 14 dias)
        const diasDesdeAncora = Math.floor((emissao - ancora) / (1000*60*60*24));
        const numero = Math.floor(diasDesdeAncora / duracao) + 1;

        return {
            inicio: inicio.toISOString().slice(0,10),
            fim: fim.toISOString().slice(0,10),
            emissao: emissao.toISOString().slice(0,10),
            numero,
            ano,
            numeroAno: `${numero}/${ano}`
        };
    }

    // Guarda contra criação de PS se já existe rascunho
    async function checkRascunhoExistente() {
        try {
            const userContext = window.AuthModule?.getCurrentUser();
            if (!userContext) return false;

            const lista = await api.listarPS();
            const hasRasc = Array.isArray(lista) && lista.some(ps =>
                ps && ps.Status === 'RASCUNHO' && ps.FiscalDesembarcandoId === userContext.fiscalId
            );

            return hasRasc;
        } catch (error) {
            console.error('Erro ao verificar rascunho:', error);
            return false;
        }
    }

    // Preenche dropdown de embarcações no modal
    function preencherModalEmbarcacoes() {
        const select = getElement('selEmbNova');
        if (!select) return;

        if (window.EmbarcacoesModule) {
            window.EmbarcacoesModule.populateSelect(select);
        }

        const btnOK = getElement('btnModalNovaConfirmar');
        if (btnOK) btnOK.disabled = true;

        // Event listener para habilitar botão quando selecionar embarcação
        select.onchange = () => {
            if (btnOK) btnOK.disabled = !(select && select.value);
        };
    }

    // Abre modal para nova PS
    function abrirModalNovaPS() {
        preencherModalEmbarcacoes();
        
        const modal = getElement('modalNovaPS');
        if (modal) {
            modal.classList.remove('hidden');
            
            // Desabilita navegação enquanto modal está aberto
            const btnInicio = document.querySelector('.topnav .tablink[data-tab="consultas"]');
            const btnCadastro = document.querySelector('.topnav .tablink[data-tab="cadastros"]');
            if (btnInicio) btnInicio.disabled = true;
            if (btnCadastro) btnCadastro.disabled = true;
        }
    }

    function fecharModalNovaPS() {
        const modal = getElement('modalNovaPS');
        if (modal) {
            modal.classList.add('hidden');
            
            // Reabilita navegação
            const btnInicio = document.querySelector('.topnav .tablink[data-tab="consultas"]');
            const btnCadastro = document.querySelector('.topnav .tablink[data-tab="cadastros"]');
            if (btnInicio) btnInicio.disabled = false;
            if (btnCadastro) btnCadastro.disabled = false;
        }
    }

    // Confirma criação de nova PS no modal
    async function confirmarModalNovaPS() {
        const select = getElement('selEmbNova');
        const msg = getElement('msgModalNovaPS');
        
        if (msg) msg.textContent = '';
        if (!select || !select.value) return;

        await criarNovaPS(Number(select.value));

        // Fecha modal somente se a aba "Passagem" estiver ativa (sucesso)
        const passTab = getElement('tab-passagem');
        if (passTab && passTab.classList.contains('active')) {
            fecharModalNovaPS();
        } else {
            const spanLista = getElement('msgNovaPS');
            if (spanLista && spanLista.textContent && msg) {
                msg.textContent = spanLista.textContent;
            }
        }
    }

    // Guarda contra criação de PS se já existe rascunho
    async function onNovaPS_Guard() {
        const msg = getElement('msgNovaPS');
        if (msg) msg.innerText = '';

        const hasRasc = await checkRascunhoExistente();
        if (hasRasc) {
            if (msg) msg.innerText = 'Já existe uma PS em rascunho para o usuario logado';
            return;
        }

        // sem rascunho → fluxo normal
        abrirModalNovaPS();
    }

    // Cria nova PS
    async function criarNovaPS(embId) {
        try {
            const embarcacoes = window.EmbarcacoesModule?.getEmbarcacoes() || [];
            
            if (!embarcacoes.length) {
                showError('Cadastre ao menos uma embarcação.');
                return;
            }

            const embarcacao = embarcacoes.find(e => e.EmbarcacaoId === embId) || embarcacoes[0];

            if (!embarcacao || !embarcacao.PrimeiraEntradaPorto) {
                showError('Embarcação sem data de primeiro porto cadastrada!');
                return;
            }

            const dados = calcularProximaPS(embarcacao.PrimeiraEntradaPorto);

            // Preenche campos calculados
            const fields = {
                'fInicioPS': dados.inicio,
                'fFimPS': dados.fim,
                'fData': dados.emissao,
                'fNumero': dados.numeroAno
            };

            Object.entries(fields).forEach(([id, value]) => {
                const element = getElement(id);
                if (element) element.value = value;
            });

            const payload = {
                EmbarcacaoId: embId,
                PeriodoInicio: dados.inicio,
                PeriodoFim: dados.fim,
                DataEmissao: dados.emissao,
                NumeroPS: dados.numeroAno
            };

            // Determina fiscal desembarcando
            const userContext = window.AuthModule?.getCurrentUser();
            const authMode = window.AuthModule?.getAuthMode();
            
            if (authMode === 'windows') {
                const nomeWin = (userContext?.nome || userContext?.fiscalNome || '').trim();
                if (!nomeWin) {
                    showError('Erro de autenticação');
                    return;
                }
                payload.FiscalDesembarcandoNome = nomeWin;
            } else {
                const nome = prompt('Fiscal que está desembarcando:');
                if (!nome) return;
                payload.FiscalDesembarcandoNome = nome.trim();
            }

            const result = await api.criarPS(payload);
            
            if (result && typeof result.error === "string") {
                if (result.error.toUpperCase().includes("RASCUNHO")) {
                    const msgEl = getElement("msgNovaPS");
                    if (msgEl) msgEl.innerText = result.error;
                } else {
                    showError(result.error);
                }
                return;
            }

            const msgEl = getElement("msgNovaPS");
            if (msgEl) msgEl.innerText = "";

            await searchPassagens();
            await loadPassagem(result.PassagemId);
            setMainTab('passagem');

        } catch (error) {
            showError('Erro ao criar PS: ' + error.message);
        }
    }

    // ===================================================================================================
    // EVENT LISTENERS
    // ===================================================================================================
    function bindEvents() {
        // Navegação entre sub-abas
        document.querySelectorAll('.sublink').forEach(button => {
            button.addEventListener('click', () => {
                const subModuleName = button.dataset.sub;
                if (subModuleName) {
                    setActiveSubModule(subModuleName);
                }
            });
        });

        // Busca de PS
        const btnBuscar = getElement('btnBuscar');
        if (btnBuscar) {
            btnBuscar.addEventListener('click', searchPassagens);
        }

        // Operações de PS
        const btnSalvar = getElement('btnSalvar');
        const btnFinalizar = getElement('btnFinalizar');
        const btnCopiar = getElement('btnCopiar');
        const btnExcluir = getElement('btnExcluirRasc');

        if (btnSalvar) btnSalvar.addEventListener('click', salvarPassagem);
        if (btnFinalizar) btnFinalizar.addEventListener('click', finalizarPassagem);
        if (btnCopiar) btnCopiar.addEventListener('click', copiarPassagem);
        if (btnExcluir) btnExcluir.addEventListener('click', excluirPassagemAtual);

        // Nova PS e Modal
        const btnNova = getElement('btnNova');
        const btnModalConfirmar = getElement('btnModalNovaConfirmar');
        const btnModalCancelar = getElement('btnModalNovaCancelar');

        if (btnNova) btnNova.addEventListener('click', onNovaPS_Guard);
        if (btnModalConfirmar) btnModalConfirmar.addEventListener('click', confirmarModalNovaPS);
        if (btnModalCancelar) btnModalCancelar.addEventListener('click', fecharModalNovaPS);
    }

    // ===================================================================================================
    // INTERFACE PÚBLICA
    // ===================================================================================================
    return {
        // Inicialização
        async init() {
            bindEvents();
            await subModules.initAll();
            
            // Inicia com primeira busca
            await searchPassagens();
            
            console.log('🚀 Módulo Passagens inicializado');
        },

        // Sistema de submódulos
        registerSubModule(name, moduleInstance) {
            subModules.register(name, moduleInstance);
        },

        getSubModule(name) {
            return subModules.get(name);
        },

        // Navegação
        setActiveSubModule(name) {
            setActiveSubModule(name);
        },

        getActiveSubModule() {
            return activeSubModule;
        },

        // Estado da PS atual
        getCurrentPS() {
            return currentPS;
        },

        async loadPS(id) {
            return await loadPassagem(id);
        },

        // Operações
        async search() {
            return await searchPassagens();
        },

        async save() {
            return await salvarPassagem();
        },

        async finalize() {
            return await finalizarPassagem();
        },

        async copy() {
            return await copiarPassagem();
        },

        async delete() {
            return await excluirPassagemAtual();
        },

        // Nova PS
        async createNew(embarcacaoId) {
            return await criarNovaPS(embarcacaoId);
        },

        openNewPSModal() {
            abrirModalNovaPS();
        },

        closeNewPSModal() {
            fecharModalNovaPS();
        },

        calcularProximaPS(primeiroPorto, hoje) {
            return calcularProximaPS(primeiroPorto, hoje);
        },

        // Interface para outros módulos
        onPSChange(callback) {
            // Sistema para outros módulos se registrarem para mudanças de PS
            // 🔄 TODO: Implementar sistema de eventos se necessário
        }
    };
})();

// Exporta o módulo (compatível com diferentes sistemas de módulos)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PassagensModule;
} else if (typeof window !== 'undefined') {
    window.PassagensModule = PassagensModule;
}