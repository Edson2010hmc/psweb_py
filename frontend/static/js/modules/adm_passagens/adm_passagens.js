/**
 * Módulo de Administração de Passagens de Serviço
 * Localização: frontend/static/js/modules/adm_passagens/adm_passagens.js
 * 
 * Responsabilidades:
 * - Gestão administrativa de PS (listar, excluir)
 * - Interface com a seção de cadastros
 * - Controle de permissões administrativas
 * - Operações administrativas em lote
 */

const AdmPassagensModule = (function() {
    'use strict';

    // ===================================================================================================
    // ESTADO INTERNO DO MÓDULO
    // ===================================================================================================
    let passagensList = [];
    let isLoading = false;

    // ===================================================================================================
    // CONSTANTES
    // ===================================================================================================
    const MODULE_NAME = 'adm_passagens';
    
    const ELEMENTS = {
        select: 'admin_ps_list',
        deleteButton: 'btnAdminPSDelete',
        hint: 'admin_ps_hint'
    };

    // ===================================================================================================
    // APIs ESPECÍFICAS DO MÓDULO
    // ===================================================================================================
    const api = {
        async listarTodasPS() {
            const response = await fetch('/api/admin/passagens');
            return response.json();
        },

        async excluirPS(id) {
            const response = await fetch(`/api/admin/passagens/${id}`, {
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

    function showConfirm(message) {
        return window.confirm(message);
    }

    // ===================================================================================================
    // CONTROLE DE UI
    // ===================================================================================================
    
    /**
     * Atualiza estado dos botões baseado na seleção
     */
    function updateButtons() {
        const select = getElement(ELEMENTS.select);
        const deleteButton = getElement(ELEMENTS.deleteButton);
        
        if (deleteButton) {
            deleteButton.disabled = !(select && select.value);
        }
    }

    /**
     * Renderiza lista de PS no select
     */
    function renderPassagensList() {
        const select = getElement(ELEMENTS.select);
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">— selecione —</option>';

        passagensList.forEach(ps => {
            const option = document.createElement('option');
            option.value = ps.PassagemId;
            
            // Determina papel do usuário (se disponível)
            const userContext = window.AuthModule?.getCurrentUser();
            const papel = (ps.FiscalEmbarcandoId === userContext?.fiscalId) ? ' (Embarque)'
                       : (ps.FiscalDesembarcandoId === userContext?.fiscalId) ? ' (Desembarque)' 
                       : '';

            // Formata texto da opção
            const periodoTexto = `${ps.PeriodoInicio} a ${ps.PeriodoFim}`;
            const statusTexto = ps.Status ? ` [${ps.Status}]` : '';
            option.textContent = `[${ps.EmbarcacaoNome}] ${periodoTexto}${statusTexto}${papel}`;
            
            select.appendChild(option);
        });

        // Restaura seleção se possível
        if (currentValue) {
            select.value = currentValue;
        }

        updateButtons();
    }

    /**
     * Carrega lista de PS do servidor
     */
    async function loadPassagens() {
        if (isLoading) return;
        
        try {
            isLoading = true;
            passagensList = await api.listarTodasPS();
            
            if (!Array.isArray(passagensList)) {
                passagensList = [];
            }
            
            renderPassagensList();
            console.log(`📋 ${MODULE_NAME}: ${passagensList.length} PS carregadas`);
            
        } catch (error) {
            console.error(`❌ ${MODULE_NAME}: Erro ao carregar PS:`, error);
            passagensList = [];
            renderPassagensList();
            showError('Erro ao carregar lista de passagens: ' + error.message);
        } finally {
            isLoading = false;
        }
    }

    // ===================================================================================================
    // OPERAÇÕES ADMINISTRATIVAS
    // ===================================================================================================
    
    /**
     * Exclui uma PS após confirmação
     */
    async function excluirPassagem() {
        const select = getElement(ELEMENTS.select);
        if (!select || !select.value) return;

        const id = Number(select.value);
        const ps = passagensList.find(p => p.PassagemId === id);
        
        // Monta texto descritivo da PS
        const textoPS = ps 
            ? `[${ps.EmbarcacaoNome}] ${ps.PeriodoInicio} a ${ps.PeriodoFim}`
            : `ID ${id}`;

        const deleteButton = getElement(ELEMENTS.deleteButton);
        
        // Desabilita botão durante operação
        if (deleteButton) deleteButton.disabled = true;

        // Confirma exclusão
        const confirmMessage = `Confirma excluir a PS ${textoPS}?\n\nEsta ação é permanente.`;
        const confirmed = showConfirm(confirmMessage);
        
        if (!confirmed) {
            if (deleteButton) deleteButton.disabled = false;
            updateButtons();
            return;
        }

        try {
            // Executa exclusão
            const result = await api.excluirPS(id);
            
            if (result && result.error) {
                throw new Error(result.error);
            }

            // Atualiza listas
            await loadPassagens();
            
            // Notifica outros módulos sobre mudança
            if (window.PassagensModule && typeof window.PassagensModule.search === 'function') {
                try {
                    await window.PassagensModule.search();
                } catch (searchError) {
                    console.warn('Erro ao atualizar lista principal:', searchError);
                }
            }

            showSuccess('PS excluída com sucesso.');
            console.log(`🗑️ ${MODULE_NAME}: PS ${id} excluída`);
            
        } catch (error) {
            console.error(`❌ ${MODULE_NAME}: Erro ao excluir PS ${id}:`, error);
            showError('Erro ao excluir PS: ' + error.message);
            
            // Reabilita botão em caso de erro
            if (deleteButton) deleteButton.disabled = false;
            updateButtons();
        }
    }

    // ===================================================================================================
    // EVENT HANDLERS
    // ===================================================================================================
    function bindEvents() {
        // Seleção de PS
        const select = getElement(ELEMENTS.select);
        if (select) {
            select.removeEventListener('change', updateButtons);
            select.addEventListener('change', updateButtons);
        }

        // Botão de exclusão
        const deleteButton = getElement(ELEMENTS.deleteButton);
        if (deleteButton) {
            deleteButton.removeEventListener('click', excluirPassagem);
            deleteButton.addEventListener('click', excluirPassagem);
        }
    }

    // ===================================================================================================
    // INTERFACES PÚBLICAS
    // ===================================================================================================

    /**
     * Inicializa o módulo
     */
    async function init() {
        bindEvents();
        console.log(`🎯 Módulo ${MODULE_NAME} inicializado`);
    }

    /**
     * Ativa o módulo (chamado quando aba de cadastros é ativada)
     */
    async function onActivate() {
        await loadPassagens();
        console.log(`🔄 ${MODULE_NAME}: Módulo ativado`);
    }

    /**
     * Desativa o módulo (limpeza se necessário)
     */
    function onDeactivate() {
        // Limpa seleção
        const select = getElement(ELEMENTS.select);
        if (select) {
            select.value = '';
        }
        updateButtons();
        console.log(`💤 ${MODULE_NAME}: Módulo desativado`);
    }

    /**
     * Força recarregamento da lista
     */
    async function refresh() {
        await loadPassagens();
        console.log(`🔄 ${MODULE_NAME}: Lista atualizada`);
    }

    // ===================================================================================================
    // INTERFACE PÚBLICA DO MÓDULO
    // ===================================================================================================
    return {
        // Identificação
        name: MODULE_NAME,

        // Ciclo de vida
        init,
        onActivate,
        onDeactivate,

        // Operações
        refresh,
        loadPassagens,
        excluirPassagem,

        // Estado
        getPassagensList() {
            return [...passagensList];
        },

        isLoading() {
            return isLoading;
        },

        // Utilitários
        updateButtons
    };
})();

// ===================================================================================================
// AUTO-REGISTRO NO SISTEMA GLOBAL
// ===================================================================================================

// Registra no sistema de módulos principais (se disponível)
if (typeof window !== 'undefined') {
    window.AdmPassagensModule = AdmPassagensModule;
    
    // Auto-inicialização quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            AdmPassagensModule.init();
        });
    } else {
        // DOM já carregado
        AdmPassagensModule.init();
    }
}

// Compatibilidade com sistemas de módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdmPassagensModule;
}