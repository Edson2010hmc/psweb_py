/**
 * Módulo de Gestão de Embarcações
 * Localização: frontend/static/js/modules/embarcacoes/embarcacoes.js
 * 
 * Responsabilidades:
 * - CRUD de embarcações
 * - Interface de usuário específica
 * - Validações e controles de estado
 * - Comunicação com backend
 */

const EmbarcacoesModule = (function() {
    'use strict';

    // ===================================================================================================
    // ESTADO INTERNO DO MÓDULO
    // ===================================================================================================
    let embarcacoes = [];
    let editingId = null;

    // ===================================================================================================
    // APIs ESPECÍFICAS DO MÓDULO
    // ===================================================================================================
    const api = {
        async getAll() {
            const response = await fetch('/api/embarcacoes/');
            return response.json();
        },

        async create(data) {
            const response = await fetch('/api/embarcacoes/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Erro ${response.status}`);
            }
            
            return response.json();
        },

        async update(id, data) {
            const response = await fetch(`/api/embarcacoes/${id}/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Erro ${response.status}`);
            }
            
            return response.json();
        },

        async delete(id) {
            const response = await fetch(`/api/embarcacoes/${id}/`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Erro ${response.status}`);
            }
            
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

    // ===================================================================================================
    // CONTROLE DE INTERFACE
    // ===================================================================================================
    function renderList() {
        const select = getElement('cad_e_list');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">— selecione —</option>';
        
        embarcacoes.forEach(embarcacao => {
            const option = document.createElement('option');
            option.value = String(embarcacao.EmbarcacaoId);
            option.textContent = `${(embarcacao.TipoEmbarcacao || '').toString().padEnd(5, ' ').slice(0, 5)} ${embarcacao.Nome}`;
            select.appendChild(option);
        });
        
        // Restaura seleção se ainda existir
        if (currentValue && Array.from(select.options).some(o => o.value === currentValue)) {
            select.value = currentValue;
        }
        
        updateButtons();
    }

    function updateButtons() {
        const select = getElement('cad_e_list');
        const hasSelection = !!(select && select.value && select.value !== '');
        
        const btnEdit = getElement('btnEmbEditar');
        const btnDelete = getElement('btnEmbExcluir');
        
        if (btnEdit) btnEdit.disabled = !hasSelection;
        if (btnDelete) btnDelete.disabled = !hasSelection;
    }

    function resetUI() {
        editingId = null;
        setEditMode(false);
        
        // Limpa campos
        const nome = getElement('cad_e_nome');
        const primeira = getElement('cad_e_primeira');
        const tipo = getElement('cad_e_tipo');
        const select = getElement('cad_e_list');
        
        if (nome) nome.value = '';
        if (primeira) primeira.value = '';
        if (tipo) tipo.value = '';
        if (select) select.value = '';
        
        updateButtons();
    }

    function setEditMode(isEditing) {
        const btnSave = getElement('btnSaveEmb');
        const btnEdit = getElement('btnEmbEditar');
        const btnDelete = getElement('btnEmbExcluir');
        const btnConfirm = getElement('btnEmbConfirma');
        const btnCancel = getElement('btnEmbCancela');
        const editActions = getElement('embEditActions');

        // Visibilidade
        if (btnSave) btnSave.style.display = isEditing ? 'none' : '';
        if (btnDelete) btnDelete.style.display = isEditing ? 'none' : '';
        if (btnConfirm) btnConfirm.style.display = isEditing ? '' : 'none';
        if (btnCancel) btnCancel.style.display = isEditing ? '' : 'none';
        if (editActions) editActions.style.display = isEditing ? 'flex' : 'none';

        // Habilitação
        if (btnSave) btnSave.disabled = isEditing;
        if (btnDelete) btnDelete.disabled = isEditing;
        if (btnEdit) btnEdit.disabled = isEditing;
        if (btnConfirm) btnConfirm.disabled = !isEditing;
        if (btnCancel) btnCancel.disabled = !isEditing;
    }

    function enterEditMode(id, nome, primeira, tipo) {
        editingId = id;
        
        const nomeEl = getElement('cad_e_nome');
        const primeiraEl = getElement('cad_e_primeira');
        const tipoEl = getElement('cad_e_tipo');
        
        if (nomeEl) nomeEl.value = nome || '';
        if (primeiraEl) primeiraEl.value = primeira ? String(primeira).slice(0, 10) : '';
        if (tipoEl) tipoEl.value = tipo || '';
        
        setEditMode(true);
    }

    // ===================================================================================================
    // OPERAÇÕES CRUD
    // ===================================================================================================
    async function loadEmbarcacoes() {
        try {
            embarcacoes = await api.getAll();
            renderList();
        } catch (error) {
            showError('Falha ao carregar embarcações: ' + error.message);
        }
    }

    async function saveEmbarcacao() {
        const nome = getElement('cad_e_nome')?.value?.trim();
        const primeira = getElement('cad_e_primeira')?.value || null;
        const tipo = getElement('cad_e_tipo')?.value?.trim() || null;

        if (!nome) {
            showError('Nome da embarcação é obrigatório');
            return;
        }

        try {
            await api.create({ 
                Nome: nome, 
                PrimeiraEntradaPorto: primeira, 
                TipoEmbarcacao: tipo 
            });
            
            // Limpa campos
            resetUI();
            
            // Recarrega lista
            await loadEmbarcacoes();
            showSuccess('Embarcação salva com sucesso');
            
        } catch (error) {
            showError(error.message);
        }
    }

    async function editEmbarcacao() {
        const select = getElement('cad_e_list');
        if (!select || !select.value) return;
        
        const id = Number(select.value);
        const embarcacao = embarcacoes.find(e => e.EmbarcacaoId === id);
        if (!embarcacao) return;
        
        enterEditMode(id, embarcacao.Nome, embarcacao.PrimeiraEntradaPorto, embarcacao.TipoEmbarcacao);
    }

    async function confirmEdit() {
        if (!editingId) return;

        const nome = getElement('cad_e_nome')?.value?.trim();
        const primeira = getElement('cad_e_primeira')?.value || null;
        const tipo = getElement('cad_e_tipo')?.value?.trim();

        if (!nome) {
            showError('Nome da embarcação é obrigatório');
            return;
        }

        try {
            await api.update(editingId, { 
                Nome: nome, 
                PrimeiraEntradaPorto: primeira, 
                TipoEmbarcacao: tipo 
            });
            
            await loadEmbarcacoes();
            resetUI();
            showSuccess('Embarcação atualizada com sucesso');
            
        } catch (error) {
            showError(error.message);
        }
    }

    function cancelEdit() {
        resetUI();
    }

    async function deleteEmbarcacao() {
        const select = getElement('cad_e_list');
        if (!select || !select.value) return;
        
        const id = Number(select.value);
        const embarcacao = embarcacoes.find(e => e.EmbarcacaoId === id);
        
        if (!embarcacao) return;

        // Desabilita botões durante operação
        const btnSave = getElement('btnSaveEmb');
        const btnEdit = getElement('btnEmbEditar');
        const btnDelete = getElement('btnEmbExcluir');
        
        if (btnSave) btnSave.disabled = true;
        if (btnEdit) btnEdit.disabled = true;
        if (btnDelete) btnDelete.disabled = true;

        const confirmed = window.confirm(`Confirma a exclusão da embarcação "${embarcacao.Nome}"?`);
        
        if (!confirmed) {
            // Reabilita botões
            if (btnSave) btnSave.disabled = false;
            if (btnEdit) btnEdit.disabled = false;
            updateButtons();
            return;
        }

        try {
            await api.delete(id);
            await loadEmbarcacoes();
            resetUI();
            showSuccess('Embarcação excluída com sucesso');
            
        } catch (error) {
            showError(error.message);
            // Reabilita botões em caso de erro
            if (btnSave) btnSave.disabled = false;
            if (btnEdit) btnEdit.disabled = false;
            updateButtons();
        }
    }

    // ===================================================================================================
    // EVENT LISTENERS
    // ===================================================================================================
    function bindEvents() {
        // Lista de seleção
        const select = getElement('cad_e_list');
        if (select) {
            select.addEventListener('change', updateButtons);
        }

        // Botões principais
        const btnSave = getElement('btnSaveEmb');
        const btnEdit = getElement('btnEmbEditar');
        const btnDelete = getElement('btnEmbExcluir');
        
        if (btnSave) btnSave.addEventListener('click', saveEmbarcacao);
        if (btnEdit) btnEdit.addEventListener('click', editEmbarcacao);
        if (btnDelete) btnDelete.addEventListener('click', deleteEmbarcacao);

        // Botões de edição
        const btnConfirm = getElement('btnEmbConfirma');
        const btnCancel = getElement('btnEmbCancela');
        
        if (btnConfirm) btnConfirm.addEventListener('click', confirmEdit);
        if (btnCancel) btnCancel.addEventListener('click', cancelEdit);
    }

    // ===================================================================================================
    // INTERFACE PÚBLICA
    // ===================================================================================================
    return {
        // Inicialização
        async init() {
            bindEvents();
            await loadEmbarcacoes();
        },

        // Métodos para interação externa
        async reload() {
            await loadEmbarcacoes();
        },

        reset() {
            resetUI();
        },

        // Getters para estado (se necessário)
        getEmbarcacoes() {
            return [...embarcacoes]; // Retorna cópia para evitar mutação
        },

        isEditing() {
            return editingId !== null;
        },

        // Função específica para popular dropdowns em outras telas
        populateSelect(selectElement) {
            if (!selectElement) return;
            
            selectElement.innerHTML = '<option value="">— selecione —</option>';
            embarcacoes.forEach(embarcacao => {
                const option = document.createElement('option');
                option.value = embarcacao.EmbarcacaoId;
                option.textContent = `${(embarcacao.TipoEmbarcacao || '').padEnd(5, ' ').slice(0, 5)} ${embarcacao.Nome}`;
                select.appendChild(option);
            });
        },

        // Função para buscar embarcação por ID (usado em nova PS)
        getEmbarcacaoById(id) {
            return embarcacoes.find(e => e.EmbarcacaoId === Number(id));
        }
    };
})();

// Exporta o módulo (compatível com diferentes sistemas de módulos)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmbarcacoesModule;
} else if (typeof window !== 'undefined') {
    window.EmbarcacoesModule = EmbarcacoesModule;
}