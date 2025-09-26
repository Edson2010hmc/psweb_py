/**
 * ARQUIVO: frontend/static/js/modules/passagens/passagens.js
 * PSWEB - Módulo de Passagens de Serviço - VERSÃO CORRIGIDA
 * CORREÇÃO: Adicionado rebindEvents() e melhorado controle de event listeners
 */

(() => {
    'use strict';

    const MODULE_NAME = 'PassagensModule';

    // ===================================================================================================
    // SELETORES E UTILITÁRIOS
    // ===================================================================================================
    function getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`${MODULE_NAME}: Elemento '${id}' não encontrado`);
        }
        return element;
    }

    function showError(message) {
        if (window.showError) {
            window.showError(message);
        } else {
            alert('ERRO: ' + message);
        }
    }

    function showSuccess(message) {
        if (window.showSuccess) {
            window.showSuccess(message);
        } else {
            alert('SUCESSO: ' + message);
        }
    }

    function showConfirm(message) {
        if (window.showConfirm) {
            return window.showConfirm(message);
        } else {
            return confirm(message);
        }
    }

    function setMainTab(tab) {
        if (window.setTab) {
            window.setTab(tab);
        } else if (window.setMainTab) {
            window.setMainTab(tab);
        }
    }

    // ===================================================================================================
    // SISTEMA DE SUBMÓDULOS
    // ===================================================================================================
    const subModules = {
        registry: new Map(),
        
        register(name, moduleInstance) {
            this.registry.set(name, moduleInstance);
            console.log(`📦 ${MODULE_NAME}: Submódulo '${name}' registrado`);
        },
        
        get(name) {
            return this.registry.get(name);
        },
        
        async initAll() {
            console.log(`🚀 ${MODULE_NAME}: Inicializando ${this.registry.size} submódulos...`);
            
            for (const [name, module] of this.registry) {
                try {
                    if (module && typeof module.init === 'function') {
                        await module.init();
                        console.log(`✅ ${MODULE_NAME}: Submódulo '${name}' inicializado`);
                    }
                } catch (error) {
                    console.error(`❌ ${MODULE_NAME}: Erro ao inicializar submódulo '${name}':`, error);
                }
            }
        },
        
        async notifyPSChange(psData) {
            for (const [name, module] of this.registry) {
                try {
                    if (module && typeof module.onPSChange === 'function') {
                        await module.onPSChange(psData);
                    }
                } catch (error) {
                    console.error(`❌ ${MODULE_NAME}: Erro ao notificar mudança de PS para '${name}':`, error);
                }
            }
        },
        
        async activateSubModule(name, psData) {
            const module = this.get(name);
            if (module && typeof module.onActivate === 'function') {
                try {
                    await module.onActivate(psData);
                } catch (error) {
                    console.error(`❌ ${MODULE_NAME}: Erro ao ativar submódulo '${name}':`, error);
                }
            }
        }
    };

    // ===================================================================================================
    // VARIÁVEIS DE ESTADO
    // ===================================================================================================
    let currentPS = null;
    let activeSubModule = 'porto';

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
            const response = await fetch('/api/passagens/' + id, {
                method: 'DELETE'
            });
            return response.json();
        }
    };

    // ===================================================================================================
    // NAVEGAÇÃO E CONTROLE DE INTERFACE
    // ===================================================================================================
    function setActiveSubModule(name) {
        console.log(`${MODULE_NAME}: Mudando para submódulo '${name}'`);
        
        activeSubModule = name;
        
        // Atualiza interface
        document.querySelectorAll('.sublink').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sub === name);
        });
        
        document.querySelectorAll('.subtab').forEach(tab => {
            tab.classList.toggle('active', tab.id === `sub-${name}`);
        });
        
        // Notifica submódulo ativo
        subModules.activateSubModule(name, currentPS);
    }

    function togglePSForm(show) {
        const placeholder = getElement('psPlaceholder');
        const form = getElement('psForm');
        
        if (placeholder && form) {
            if (show) {
                placeholder.classList.add('hidden');
                form.classList.remove('hidden');
            } else {
                placeholder.classList.remove('hidden');
                form.classList.add('hidden');
            }
        }
    }

    // ===================================================================================================
    // OPERAÇÕES DE PASSAGENS
    // ===================================================================================================
    async function searchPassagens() {
        try {
            const inicio = getElement('fInicio')?.value;
            const fim = getElement('fFim')?.value;
            
            const passagens = await api.listarPS(inicio, fim);
            updatePassagensList(passagens);
            
        } catch (error) {
            showError('Erro ao buscar passagens: ' + error.message);
        }
    }

    function updatePassagensList(passagens) {
        const lista = getElement('listaPS');
        if (!lista) return;
        
        lista.innerHTML = '';
        
        if (!Array.isArray(passagens) || passagens.length === 0) {
            lista.innerHTML = '<li class="empty">❌ Não há PS cadastrada</li>';
            return;
        }
        
        passagens.forEach(ps => {
        const embarcacao = window.EmbarcacoesModule?.getEmbarcacaoById(ps.EmbarcacaoId);
        const tipo = (embarcacao.TipoEmbarcacao || '').padEnd(5, ' ').slice(0, 5);
        
            const li = document.createElement('li');
            li.className = 'ps-item';
            li.innerHTML = `
                <div class="ps-info">
                    <div class="ps-linha1">${ps.NumeroPS || ps.PassagemId}-${tipo} ${ps.EmbarcacaoNome}</div>
                    <div class="ps-linha2">${ps.PeriodoInicio} a ${ps.PeriodoFim}</div>
                    <div class="ps-linha3">${ps.Status}</div>
                    <div class="ps-linha4">></div>
                </div>
            `;
            
            li.addEventListener('click', () => loadPassagem(ps.PassagemId));
            lista.appendChild(li);
        });
    }

    async function loadPassagem(id) {
        try {
            const ps = await api.getPS(id);
            
            if (!ps || ps.error) {
                showError(ps?.error || 'Passagem não encontrada');
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
            
            // Muda para aba de passagem
            setMainTab('passagem');
            
            console.log(`📋 PS carregada: ${ps.PassagemId}`);
            
        } catch (error) {
            showError('Erro ao carregar PS: ' + error.message);
        }
    }
    function formatarNumeroPS(numero) {
    if (!numero) return '';
    const str = numero.toString();
    if (str.length >= 4) {
        // Adiciona barra antes dos 4 últimos: "192025" → "19/2025"
        return str.slice(0, -4) + '/' + str.slice(-4);
    }
    return str;
}

    function populateHeaderFields(ps) {
        const fields = {
            'fNumero': ps.NumeroPS || ps.PassagemId || '',
            'fData': ps.DataEmissao || '',
            'fInicioPS': ps.PeriodoInicio,
            'fFimPS': ps.PeriodoFim,
            'fStatus': ps.Status,
            'fDesCNome': ps.FiscalDesembarcandoFormatado || ''
        };

        Object.entries(fields).forEach(([id, value]) => {
            const element = getElement(id);
            if (element) element.value = value;
        });

        // CORREÇÃO: Copia embarcação selecionada do modal
        const embInput = getElement('fEmb');
        const fiscdesem =getElement('fDesCNome');
        const psNumber = getElement('fNumero');
        if (embInput) {
            // Cenário 1: PS já existente → busca embarcação completa para concatenar
            if (ps.EmbarcacaoId && ps.EmbarcacaoNome) {
                const embarcacao = window.EmbarcacoesModule?.getEmbarcacaoById(ps.EmbarcacaoId);
                if (embarcacao) {
                    const tipo = (embarcacao.TipoEmbarcacao || '').padEnd(5, ' ').slice(0, 5);
                    embInput.value = `${tipo} ${embarcacao.Nome}`;
                } else {
                    embInput.value = ps.EmbarcacaoNome; // fallback
                }
            }
            // Cenário 2: PS recém-criada → pega do modal
            else {
                const modalSelect = getElement('selEmbNova');
                if (modalSelect && modalSelect.selectedOptions[0]) {
                    embInput.value = modalSelect.selectedOptions[0].text;
                }
            }
            embInput.disabled = true;
            fiscdesem.disabled = true;
            psNumber.disabled = true;
        }

        // Popula dropdown de fiscal embarcando
    const fiscalSelect = getElement('fEmbC');
    if (fiscalSelect && window.FiscaisModule) {
        window.FiscaisModule.populateSelect(fiscalSelect);
        fiscalSelect.value = ps.FiscalEmbarcandoId || '-Selecione'; // Força vazio se não tem ID
    }
    }

    function applyPermissions(ps) {
        const userContext = window.AuthModule?.getCurrentUser();
        
        const canEdit = (ps.Status === 'RASCUNHO') &&
                       (new Date() <= new Date(new Date(ps.PeriodoFim).getTime() + 24*60*60*1000)) &&
                       (ps.FiscalDesembarcandoId === userContext?.fiscalId);
        
        // Controla botões
        const btnSalvar = getElement('btnSalvar');
        const btnFinalizar = getElement('btnFinalizar');
        const btnExcluir = getElement('btnExcluirRasc');
        
        if (btnSalvar) btnSalvar.disabled = !canEdit;
        if (btnFinalizar) btnFinalizar.disabled = !canEdit;
        if (btnExcluir) btnExcluir.disabled = !canEdit;
    }

    // ===================================================================================================
    // OPERAÇÕES DE NOVA PS
    // ===================================================================================================
    function calcularPeriodoPS(embarcacaoId) {
        // Busca embarcação para pegar PrimeiraEntradaPorto
        const embarcacoes = window.EmbarcacoesModule?.getEmbarcacoes() || [];
        const embarcacao = embarcacoes.find(e => e.EmbarcacaoId === embarcacaoId);
        
        if (!embarcacao || !embarcacao.PrimeiraEntradaPorto) {
            throw new Error('Embarcação deve ter data de primeira entrada no porto');
        }
        
        const primeiraEntrada = new Date(embarcacao.PrimeiraEntradaPorto);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        // Calcula quantos dias passaram desde primeira entrada
        const diasPassados = Math.floor((hoje - primeiraEntrada) / (1000 * 60 * 60 * 24));
        
        // Calcula qual ciclo atual (vigente)
        const cicloAtual = Math.floor(diasPassados / 14);
        
        // Calcula início do ciclo vigente
        const inicioVigente = new Date(primeiraEntrada);
        inicioVigente.setDate(inicioVigente.getDate() + (cicloAtual * 14));
        
        // Calcula fim do ciclo vigente (13 dias depois do início)
        const fimVigente = new Date(inicioVigente);
        fimVigente.setDate(fimVigente.getDate() + 13);
        
        // Data de emissão (dia seguinte ao fim)
        const emissao = new Date(fimVigente);
        emissao.setDate(emissao.getDate() + 1);
        
        // *** CORREÇÃO: Contar emissões que caíram no ano da PS atual ***
        const ano = emissao.getFullYear();
        let psNoAno = 0;
        
        // Loop pelos ciclos anteriores para contar emissões no mesmo ano
        for (let ciclo = 0; ciclo < cicloAtual; ciclo++) {
            // Calcula data de emissão deste ciclo anterior
            const inicioEsseCiclo = new Date(primeiraEntrada);
            inicioEsseCiclo.setDate(inicioEsseCiclo.getDate() + (ciclo * 14));
            
            const fimEsseCiclo = new Date(inicioEsseCiclo);
            fimEsseCiclo.setDate(fimEsseCiclo.getDate() + 13);
            
            const emissaoEsseCiclo = new Date(fimEsseCiclo);
            emissaoEsseCiclo.setDate(emissaoEsseCiclo.getDate() + 1);
            
            // Se emissão deste ciclo foi no mesmo ano, conta
            if (emissaoEsseCiclo.getFullYear() === ano) {
                psNoAno++;
            }
        }
        
        // Numeração da PS atual (quantas já ocorreram no ano + 1)
        const numero = psNoAno + 1;
        
        return {
            inicio: inicioVigente.toISOString().slice(0,10),
            fim: fimVigente.toISOString().slice(0,10),
            emissao: emissao.toISOString().slice(0,10),
            numero,
            ano,
            numeroAno: `${numero.toString().padStart(3, '0')}${ano}`
        };
    }

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
        if (msg) {
            msg.innerText = 'Já existe uma PS em rascunho para o usuario logado';
            
            // *** NOVO: Remove mensagem após 5 segundos ***
            setTimeout(() => {
                msg.innerText = '';
            }, 5000);
        }
        return;
    }

    // sem rascunho → fluxo normal
    abrirModalNovaPS();
}

    async function criarNovaPS(embId) {
        try {
            const embarcacoes = window.EmbarcacoesModule?.getEmbarcacoes() || [];
            
            if (!embarcacoes.length) {
                showError('Cadastre ao menos uma embarcação.');
                return;
            }

            const embarcacao = embarcacoes.find(e => e.EmbarcacaoId === embId);
            if (!embarcacao) {
                showError('Embarcação não encontrada.');
                return;
            }

            const userContext = window.AuthModule?.getCurrentUser();
            if (!userContext || !userContext.fiscalId) {
                showError('Usuário não identificado.');
                return;
            }

            const periodo = calcularPeriodoPS(embId);
            
            const psData = {
                NumeroPS: periodo.numeroAno,
                DataEmissao: periodo.emissao,
                PeriodoInicio: periodo.inicio,
                PeriodoFim: periodo.fim,
                EmbarcacaoId: embId
            };

            const result = await api.criarPS(psData);
            
            if (result.error) {
                if (result.error.includes('usuário')) {
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
    // OUTRAS OPERAÇÕES
    // ===================================================================================================
    async function salvarPassagem(mostrarMensagens = true) {
    if (!currentPS) {
        if (mostrarMensagens) showError('Nenhuma PS carregada');
        return;
    }
    
    try {
        // Coleta dados dos formulários
        const dataEmissao = getElement('fData')?.value || null;
        const periodoInicio = getElement('fInicioPS')?.value || null;
        const periodoFim = getElement('fFimPS')?.value || null;
        const fiscalEmbarcandoId = getElement('fEmbC')?.value || null;
        
        // Converte string vazia para null
        const data = {
            DataEmissao: dataEmissao || null,
            PeriodoInicio: periodoInicio,
            PeriodoFim: periodoFim,
            EmbarcacaoId: currentPS.EmbarcacaoId, // Mantém o mesmo
            FiscalEmbarcandoId: fiscalEmbarcandoId ? Number(fiscalEmbarcandoId) : null
        };
        
        const result = await api.salvarPS(currentPS.PassagemId, data);
        
        if (result.error) {
            if (mostrarMensagens) showError(result.error);
        } else {
            if (mostrarMensagens) showSuccesss('Rascunho da PS salvo com sucesso');
            
            // Atualiza PS atual com dados salvos
            currentPS = result;
            await salvarSubmodulos(mostrarMensagens);
            
            // Recarrega lista para mostrar mudanças
            await searchPassagens();
        }
        
    } catch (error) {
        if (mostrarMensagens) showError('Erro ao salvar passagem: ' + error.message);
    }
}


    async function salvarAutomaticamente() {
        // Só salva se tem PS carregada, é rascunho e tem permissão
        if (!currentPS || currentPS.Status !== 'RASCUNHO') {
            return;
        }
        
        const userContext = window.AuthModule?.getCurrentUser();
        const canEdit = (currentPS.FiscalDesembarcandoId === userContext?.fiscalId);
        
        if (!canEdit) {
            return;
        }
        
        try {
            // Salva silenciosamente (sem mensagens de sucesso/erro)
            await salvarPassagem(false);
            await salvarSubmodulos(false);
            console.log(`📝 ${MODULE_NAME}: PS ${currentPS.PassagemId} salva automaticamente`);
        } catch (error) {
            console.warn(`⚠️ ${MODULE_NAME}: Erro no salvamento automático:`, error);
            // Não exibe erro para usuário em salvamento automático
        }
    }

        /**
     * Data de geração: 26/09/2025
     * Motivo da revisão: Criar função separada para salvamento de submódulos
     * Histórico: 
     * - v1.0: Função nova para separar responsabilidades e evitar duplicação de código
     */

    // ===================================================================================================
    // NOVA FUNÇÃO: SALVAMENTO DE SUBMÓDULOS
    // ===================================================================================================

    /**
     * Salva todos os submódulos registrados
     * @param {boolean} mostrarMensagens - Se deve exibir mensagens de erro/sucesso
     * @returns {boolean} - true se todos salvaram com sucesso, false se houve erros
     */
    async function salvarSubmodulos(mostrarMensagens = true) {
        if (!currentPS) {
            return true; // Sem PS carregada, considera sucesso
        }

        let subModuleErrors = [];
        let successCount = 0;
        
        console.log(`💾 ${MODULE_NAME}: Iniciando salvamento de ${subModules.registry.size} submódulos...`);
        
        for (const [subModuleName, subModuleInstance] of subModules.registry) {
            try {
                // Verifica se o submódulo tem método save()
                if (subModuleInstance && typeof subModuleInstance.save === 'function') {
                    console.log(`💾 ${MODULE_NAME}: Salvando submódulo '${subModuleName}'...`);
                    
                    const subResult = await subModuleInstance.save();
                    
                    if (subResult && subResult.error) {
                        throw new Error(subResult.error);
                    }
                    
                    successCount++;
                    console.log(`✅ ${MODULE_NAME}: Submódulo '${subModuleName}' salvo com sucesso`);
                } else {
                    console.log(`ℹ️ ${MODULE_NAME}: Submódulo '${subModuleName}' não possui método save()`);
                }
            } catch (subError) {
                const errorMsg = `Erro ao salvar ${subModuleName}: ${subError.message}`;
                subModuleErrors.push(errorMsg);
                console.error(`❌ ${MODULE_NAME}: ${errorMsg}`);
            }
        }

        // Exibe resultado apenas se solicitado
        if (mostrarMensagens && subModuleErrors.length > 0) {
            const errorList = subModuleErrors.join('\n• ');
            showError(`Erros nos submódulos:\n• ${errorList}`);
        }

        const success = subModuleErrors.length === 0;
        console.log(`${success ? '✅' : '⚠️'} ${MODULE_NAME}: Submódulos salvos - ${successCount} sucessos, ${subModuleErrors.length} erros`);
        
        return success;
    }









    async function finalizarPassagem() {
        if (!currentPS) return;
        
        if (!showConfirm('Confirma finalização da PS? Esta ação é irreversível.')) {
            return;
        }
        
        try {
            const result = await api.finalizarPS(currentPS.PassagemId);
            
            if (result.error) {
                showError(result.error);
            } else {
                showSuccess('PS finalizada com sucesso');
                await loadPassagem(currentPS.PassagemId); // Recarrega
            }
            
        } catch (error) {
            showError('Erro ao finalizar PS: ' + error.message);
        }
    }

    async function copiarPassagem() {
        if (!currentPS) return;
        
        try {
            const result = await api.copiarPS(currentPS.PassagemId);
            
            if (result.error) {
                showError(result.error);
            } else {
                showSuccess('PS copiada com sucesso');
                await searchPassagens();
                await loadPassagem(result.PassagemId);
            }
            
        } catch (error) {
            showError('Erro ao copiar PS: ' + error.message);
        }
    }

    async function excluirPassagemAtual() {
        if (!currentPS) return;
        
        if (!showConfirm(`Confirma exclusão da PS ${currentPS.NumeroPS}?\n\nEsta ação é permanente.`)) {
            return;
        }
        
        try {
            const result = await api.excluirPS(currentPS.PassagemId);
            
            if (result.error) {
                showError(result.error);
            } else {
                showSuccess('PS excluída com sucesso');
                await searchPassagens();
                togglePSForm(false);
                currentPS = null;
                setMainTab('consultas'); 
            }
            
        } catch (error) {
            showError('Erro ao excluir PS: ' + error.message);
        }
    }

    // ===================================================================================================
    // EVENT LISTENERS - VERSÃO CORRIGIDA
    // ===================================================================================================
    function bindEvents() {
        console.log(`🔗 ${MODULE_NAME}: Configurando event listeners...`);
        
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
            btnBuscar.removeEventListener('click', searchPassagens);
            btnBuscar.addEventListener('click', searchPassagens);
            console.log(`✅ ${MODULE_NAME}: Event listener 'btnBuscar' configurado`);
        }

        // Operações de PS
        const btnSalvar = getElement('btnSalvar');
        const btnFinalizar = getElement('btnFinalizar');
        const btnCopiar = getElement('btnCopiar');
        const btnExcluir = getElement('btnExcluirRasc');

        if (btnSalvar) {
            btnSalvar.removeEventListener('click', salvarPassagem);
            btnSalvar.addEventListener('click', salvarPassagem);
            console.log(`✅ ${MODULE_NAME}: Event listener 'btnSalvar' configurado`);
        }
        
        if (btnFinalizar) {
            btnFinalizar.removeEventListener('click', finalizarPassagem);
            btnFinalizar.addEventListener('click', finalizarPassagem);
            console.log(`✅ ${MODULE_NAME}: Event listener 'btnFinalizar' configurado`);
        }
        
        if (btnCopiar) {
            btnCopiar.removeEventListener('click', copiarPassagem);
            btnCopiar.addEventListener('click', copiarPassagem);
            console.log(`✅ ${MODULE_NAME}: Event listener 'btnCopiar' configurado`);
        }
        
        if (btnExcluir) {
            btnExcluir.removeEventListener('click', excluirPassagemAtual);
            btnExcluir.addEventListener('click', excluirPassagemAtual);
            console.log(`✅ ${MODULE_NAME}: Event listener 'btnExcluir' configurado`);
        }

        // *** CORREÇÃO PRINCIPAL: Botão Nova PS ***
        const btnNova = getElement('btnNova');
        if (btnNova) {
            btnNova.removeEventListener('click', onNovaPS_Guard);
            btnNova.addEventListener('click', onNovaPS_Guard);
            console.log(`✅ ${MODULE_NAME}: Event listener 'btnNova' configurado`);
        } else {
            console.warn(`⚠️ ${MODULE_NAME}: Botão 'btnNova' não encontrado`);
        }

        // Modal Nova PS
        const btnModalConfirmar = getElement('btnModalNovaConfirmar');
        const btnModalCancelar = getElement('btnModalNovaCancelar');

        if (btnModalConfirmar) {
            btnModalConfirmar.removeEventListener('click', confirmarModalNovaPS);
            btnModalConfirmar.addEventListener('click', confirmarModalNovaPS);
            console.log(`✅ ${MODULE_NAME}: Event listener 'btnModalConfirmar' configurado`);
        }
        
        if (btnModalCancelar) {
            btnModalCancelar.removeEventListener('click', fecharModalNovaPS);
            btnModalCancelar.addEventListener('click', fecharModalNovaPS);
            console.log(`✅ ${MODULE_NAME}: Event listener 'btnModalCancelar' configurado`);
        }
        
        const btnInicio = document.querySelector('.tablink[data-tab="consultas"]');
        if (btnInicio) {
            btnInicio.addEventListener('click', async (e) => {
                // Se tem PS aberta, salva antes de navegar
                if (currentPS) {
                    e.preventDefault(); // Para a navegação
                    await salvarAutomaticamente();
                    // Após salvar, navega manualmente
                    if (window.setTab) {
                        window.setTab('consultas');
                    }
                }
                // Se não tem PS, deixa navegar normalmente
            });
            console.log(`✅ ${MODULE_NAME}: Salvamento automático configurado`);
        }

        console.log(`✅ ${MODULE_NAME}: Todos os event listeners configurados`);
    }

    // *** NOVO MÉTODO: Re-vincula event listeners após autenticação ***
    async function rebindEvents() {
        console.log(`🔄 ${MODULE_NAME}: Re-vinculando event listeners após autenticação...`);
        
        // Aguarda um pouco para garantir que o DOM está atualizado
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Re-executa bind de eventos
        bindEvents();
        
        console.log(`✅ ${MODULE_NAME}: Event listeners re-vinculados com sucesso`);
    }

    // ===================================================================================================
    // INTERFACE PÚBLICA - VERSÃO EXPANDIDA
    // ===================================================================================================
    const moduleInstance = {
        // Inicialização
        async init() {
            console.log(`🚀 ${MODULE_NAME}: Inicializando módulo...`);
            
            bindEvents();
            await subModules.initAll();
            
            // Inicia com primeira busca
            await searchPassagens();
            
            console.log(`✅ ${MODULE_NAME}: Módulo inicializado com sucesso`);
        },

        // *** NOVO: Método para re-vincular event listeners ***
        async rebindEvents() {
            return await rebindEvents();
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

        // Operações principais
        async search() {
            return await searchPassagens();
        },

        async loadPS(id) {
            return await loadPassagem(id);
        },

        // *** EXPOSIÇÃO: Funções para uso externo ***
        onNovaPS_Guard: onNovaPS_Guard,
        
        // Estado atual
        getCurrentPS() {
            return currentPS;
        },

        getActiveSubModule() {
            return activeSubModule;
        },

        // API interna
        api: api
    };

    // ===================================================================================================
    // REGISTRO GLOBAL
    // ===================================================================================================
    window.PassagensModule = moduleInstance;
    
    console.log(`📦 ${MODULE_NAME}: Módulo registrado globalmente`);

})();