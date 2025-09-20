/**
 * Módulo de Gestão de Fiscais
 * Localização: frontend/static/js/modules/fiscais/fiscais.js
 * 
 * Responsabilidades:
 * - CRUD de fiscais
 * - Interface de usuário específica
 * - Validações e controles de estado
 * - Comunicação com backend
 */

const FiscaisModule = (function() {
    'use strict';

    // ===================================================================================================
    // ESTADO INTERNO DO MÓDULO
    // ===================================================================================================
    let fiscais = [];
    let editingId = null;

    // ===================================================================================================
    // APIs ESPECÍFICAS DO MÓDULO
    // ===================================================================================================
    const api = {
        async getAll() {
            const response = await fetch('/api/fiscais/');
            return response.json();
        },

        async create(data) {
            const response = await fetch('/api/fiscais/', {
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
            const response = await fetch(`/api/fiscais/${id}/`, {
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
            const response = await fetch(`/api/fiscais/${id}/`, {
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
        const select = getElement('cad_f_list');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">— selecione —</option>';
        
        fiscais.forEach(fiscal => {
            const option = document.createElement('option');
            option.value = String(fiscal.FiscalId);
            option.textContent = `${(fiscal.Chave || '').toString().padEnd(4, ' ').slice(0, 4)} - ${fiscal.Nome}`;
            option.dataset.tel = fiscal.Telefone || '';
            select.appendChild(option);
        });
        
        // Restaura seleção se ainda existir
        if (currentValue && Array.from(select.options).some(o => o.value === currentValue)) {
            select.value = currentValue;
        }
        
        updateButtons();
    }

    function updateButtons() {
        const select = getElement('cad_f_list');
        const hasSelection = !!(select && select.value);
        
        const btnEdit = getElement('btnFiscalEditar');
        const btnDelete = getElement('btnFiscalExcluir');
        
        if (btnEdit) btnEdit.disabled = !hasSelection;
        if (btnDelete) btnDelete.disabled = !hasSelection;
    }

    function resetUI() {
        editingId = null;
        
        // Limpa campos
        const nome = getElement('cad_f_nome');
        const chave = getElement('cad_f_ch');
        const telefone = getElement('cad_f_tel');
        const select = getElement('cad_f_list');
        
        if (nome) nome.value = '';
        if (chave) chave.value = '';
        if (telefone) telefone.value = '';
        if (select) select.value = '';
        
        // Controla visibilidade dos botões
        setEditMode(false);
        updateButtons();
    }

    function setEditMode(isEditing) {
        const btnSave = getElement('btnSaveFiscal');
        const btnEdit = getElement('btnFiscalEditar');
        const btnDelete = getElement('btnFiscalExcluir');
        const editActions = getElement('fiscEditActions');
        const select = getElement('cad_f_list');

        if (btnSave) btnSave.style.display = isEditing ? 'none' : '';
        if (btnDelete) btnDelete.style.display = isEditing ? 'none' : '';
        if (btnEdit) btnEdit.disabled = isEditing;
        if (editActions) editActions.style.display = isEditing ? 'flex' : 'none';
        if (select) select.disabled = isEditing;
    }

    function enterEditMode(id, nome, chave, telefone) {
        editingId = id;
        
        const nomeEl = getElement('cad_f_nome');
        const chaveEl = getElement('cad_f_ch');
        const telefoneEl = getElement('cad_f_tel');
        
        if (nomeEl) nomeEl.value = nome || '';
        if (chaveEl) chaveEl.value = (chave || '').toString().slice(0, 4);
        if (telefoneEl) telefoneEl.value = telefone || '';
        
        setEditMode(true);
    }

    // ===================================================================================================
    // OPERAÇÕES CRUD
    // ===================================================================================================
    async function loadFiscais() {
        try {
            fiscais = await api.getAll();
            renderList();
        } catch (error) {
            showError('Falha ao carregar fiscais: ' + error.message);
        }
    }

    async function saveFiscal() {
        const nome = getElement('cad_f_nome')?.value?.trim() || '';
        const chave = getElement('cad_f_ch')?.value?.trim() || '';
        const telefone = (getElement('cad_f_tel')?.value || '').trim();

        if (!nome) {
            showError('Nome é obrigatório');
            return;
        }

        if (!chave || chave.length !== 4) {
            showError('Chave deve ter exatamente 4 caracteres');
            return;
        }

        try {
            await api.create({ Nome: nome, Chave: chave, Telefone: telefone });
            
            // Limpa campos
            resetUI();
            
            // Recarrega lista
            await loadFiscais();
            showSuccess('Fiscal salvo com sucesso');
            
        } catch (error) {
            showError(error.message);
        }
    }

    async function editFiscal() {
        const select = getElement('cad_f_list');
        if (!select || !select.value) return;
        
        const id = Number(select.value);
        const fiscal = fiscais.find(f => f.FiscalId === id);
        if (!fiscal) return;
        
        enterEditMode(id, fiscal.Nome, fiscal.Chave, fiscal.Telefone);
    }

    async function confirmEdit() {
        if (!editingId) return;

        const nome = getElement('cad_f_nome')?.value?.trim() || '';
        const chave = getElement('cad_f_ch')?.value?.trim() || '';
        const telefone = (getElement('cad_f_tel')?.value || '').trim();

        if (!nome) {
            showError('Nome é obrigatório');
            return;
        }

        if (!chave || chave.length !== 4) {
            showError('Chave deve ter exatamente 4 caracteres');
            return;
        }

        try {
            await api.update(editingId, { Nome: nome, Chave: chave, Telefone: telefone });
            await loadFiscais();
            resetUI();
            showSuccess('Fiscal atualizado com sucesso');
            
        } catch (error) {
            showError(error.message);
        }
    }

    function cancelEdit() {
        resetUI();
    }

    async function deleteFiscal() {
        const select = getElement('cad_f_list');
        if (!select || !select.value) return;
        
        const id = Number(select.value);
        const fiscal = fiscais.find(f => f.FiscalId === id);
        const displayName = fiscal ? `${(fiscal.Chave || '').toString().slice(0, 4)}-${fiscal.Nome}` : `ID ${id}`;

        // Desabilita botões durante operação
        const btnSave = getElement('btnSaveFiscal');
        const btnEdit = getElement('btnFiscalEditar');
        const btnDelete = getElement('btnFiscalExcluir');
        
        if (btnSave) btnSave.disabled = true;
        if (btnEdit) btnEdit.disabled = true;
        if (btnDelete) btnDelete.disabled = true;

        const confirmed = window.confirm(`Confirma a exclusão do fiscal ${displayName}?`);
        
        if (!confirmed) {
            // Reabilita botões
            if (btnSave) btnSave.disabled = false;
            if (btnEdit) btnEdit.disabled = false;
            updateButtons();
            return;
        }

        try {
            await api.delete(id);
            await loadFiscais();
            resetUI();
            showSuccess('Fiscal excluído com sucesso');
            
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
        const select = getElement('cad_f_list');
        if (select) {
            select.addEventListener('change', updateButtons);
        }

        // Botões principais
        const btnSave = getElement('btnSaveFiscal');
        const btnEdit = getElement('btnFiscalEditar');
        const btnDelete = getElement('btnFiscalExcluir');
        
        if (btnSave) btnSave.addEventListener('click', saveFiscal);
        if (btnEdit) btnEdit.addEventListener('click', editFiscal);
        if (btnDelete) btnDelete.addEventListener('click', deleteFiscal);

        // Botões de edição
        const btnConfirm = getElement('btnFiscalConfirma');
        const btnCancel = getElement('btnFiscalCancela');
        
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
            await loadFiscais();
        },

        // Métodos para interação externa
        async reload() {
            await loadFiscais();
        },

        reset() {
            resetUI();
        },

        // Getters para estado (se necessário)
        getFiscais() {
            return [...fiscais]; // Retorna cópia para evitar mutação
        },

        isEditing() {
            return editingId !== null;
        },

        // Função específica para popular dropdowns em outras telas
        populateSelect(selectElement) {
            if (!selectElement) return;
            
            selectElement.innerHTML = '';
            fiscais.forEach(fiscal => {
                const option = document.createElement('option');
                option.value = fiscal.FiscalId;
                option.textContent = `${fiscal.Chave}-${fiscal.Nome}`;
                selectElement.appendChild(option);
            });
        }
    };
})();

// Exporta o módulo (compatível com diferentes sistemas de módulos)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FiscaisModule;
} else if (typeof window !== 'undefined') {
    window.FiscaisModule = FiscaisModule;
}