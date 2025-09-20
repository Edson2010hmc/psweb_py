/**
 * Módulo de Gestão de Administradores
 * Localização: frontend/static/js/modules/administradores/administradores.js
 * 
 * Responsabilidades:
 * - CRUD de administradores
 * - Interface de usuário específica
 * - Validações e controles de estado
 * - Comunicação com backend
 */

const AdministradoresModule = (function() {
    'use strict';

    // ===================================================================================================
    // ESTADO INTERNO DO MÓDULO
    // ===================================================================================================
    let administradores = [];
    let editingId = null;

    // ===================================================================================================
    // APIs ESPECÍFICAS DO MÓDULO
    // ===================================================================================================
    const api = {
        async getAll() {
            const response = await fetch('/api/administradores/');
            return response.json();
        },

        async create(data) {
            const response = await fetch('/api/administradores/', {
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
            const response = await fetch(`/api/administradores/${id}/`, {
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
            const response = await fetch(`/api/administradores/${id}/`, {
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
        const select = getElement('cad_adm_list');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">— selecione —</option>';
        
        administradores.forEach(admin => {
            const option = document.createElement('option');
            option.value = String(admin.AdministradorId);
            option.textContent = `${(admin.Chave || '').toString().padEnd(4, ' ').slice(0, 4)} - ${admin.Nome}`;
            option.dataset.telefone = admin.Telefone || '';
            select.appendChild(option);
        });
        
        // Restaura seleção se ainda existir
        if (currentValue && Array.from(select.options).some(o => o.value === currentValue)) {
            select.value = currentValue;
        }
        
        updateButtons();
    }

    function updateButtons() {
        const select = getElement('cad_adm_list');
        const hasSelection = !!(select && select.value);
        
        const btnEdit = getElement('btnAdmEditar');
        const btnDelete = getElement('btnAdmlExcluir');
        
        if (btnEdit) btnEdit.disabled = !hasSelection;
        if (btnDelete) btnDelete.disabled = !hasSelection;
    }

    function resetUI() {
        editingId = null;
        
        // Limpa campos
        const nome = getElement('cad_adm_nome');
        const chave = getElement('cad_adm_ch');
        const telefone = getElement('cad_adm_tel');
        const select = getElement('cad_adm_list');
        
        if (nome) nome.value = '';
        if (chave) chave.value = '';
        if (telefone) telefone.value = '';
        if (select) select.value = '';
        
        // Controla visibilidade dos botões
        setEditMode(false);
        updateButtons();
    }

    function setEditMode(isEditing) {
        const btnSave = getElement('btnSaveAdm');
        const btnEdit = getElement('btnAdmEditar');
        const btnDelete = getElement('btnAdmlExcluir');
        const editActions = getElement('admEditActions');
        const select = getElement('cad_adm_list');

        if (btnSave) btnSave.style.display = isEditing ? 'none' : '';
        if (btnDelete) btnDelete.style.display = isEditing ? 'none' : '';
        if (btnEdit) btnEdit.disabled = isEditing;
        if (editActions) editActions.style.display = isEditing ? 'flex' : 'none';
        if (select) select.disabled = isEditing;
    }

    function enterEditMode(id, nome, chave, telefone) {
        editingId = id;
        
        const nomeEl = getElement('cad_adm_nome');
        const chaveEl = getElement('cad_adm_ch');
        const telefoneEl = getElement('cad_adm_tel');
        
        if (nomeEl) nomeEl.value = nome || '';
        if (chaveEl) chaveEl.value = (chave || '').toString().slice(0, 4);
        if (telefoneEl) telefoneEl.value = telefone || '';
        
        setEditMode(true);
    }

    // ===================================================================================================
    // OPERAÇÕES CRUD
    // ===================================================================================================
    async function loadAdministradores() {
        try {
            administradores = await api.getAll();
            renderList();
        } catch (error) {
            showError('Falha ao carregar administradores: ' + error.message);
        }
    }

    async function saveAdministrador() {
        const nome = getElement('cad_adm_nome')?.value?.trim() || '';
        const chave = getElement('cad_adm_ch')?.value?.trim() || '';
        const telefone = (getElement('cad_adm_tel')?.value || '').trim();

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
            await loadAdministradores();
            showSuccess('Administrador salvo com sucesso');
            
        } catch (error) {
            showError(error.message);
        }
    }

    async function editAdministrador() {
        const select = getElement('cad_adm_list');
        if (!select || !select.value) return;
        
        const id = Number(select.value);
        const admin = administradores.find(a => a.AdministradorId === id);
        if (!admin) return;
        
        enterEditMode(id, admin.Nome, admin.Chave, admin.Telefone);
    }

    async function confirmEdit() {
        if (!editingId) return;

        const nome = getElement('cad_adm_nome')?.value?.trim() || '';
        const chave = getElement('cad_adm_ch')?.value?.trim() || '';
        const telefone = (getElement('cad_adm_tel')?.value || '').trim();

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
            await loadAdministradores();
            resetUI();
            showSuccess('Administrador atualizado com sucesso');
            
        } catch (error) {
            showError(error.message);
        }
    }

    function cancelEdit() {
        resetUI();
    }

    async function deleteAdministrador() {
        const select = getElement('cad_adm_list');
        if (!select || !select.value) return;
        
        const id = Number(select.value);
        const admin = administradores.find(a => a.AdministradorId === id);
        const displayName = admin ? `${(admin.Chave || '').toString().slice(0, 4)}-${admin.Nome}` : `ID ${id}`;

        // Desabilita botões durante operação
        const btnSave = getElement('btnSaveAdm');
        const btnEdit = getElement('btnAdmEditar');
        const btnDelete = getElement('btnAdmlExcluir');
        
        if (btnSave) btnSave.disabled = true;
        if (btnEdit) btnEdit.disabled = true;
        if (btnDelete) btnDelete.disabled = true;

        const confirmed = window.confirm(`Confirma a exclusão do administrador ${displayName}?`);
        
        if (!confirmed) {
            // Reabilita botões
            if (btnSave) btnSave.disabled = false;
            if (btnEdit) btnEdit.disabled = false;
            updateButtons();
            return;
        }

        try {
            await api.delete(id);
            await loadAdministradores();
            if (btnSave) btnSave.disabled = false;
            if (btnEdit) btnEdit.disabled = false;
            resetUI();
            showSuccess('Administrador excluído com sucesso');
            
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
        const select = getElement('cad_adm_list');
        if (select) {
            select.addEventListener('change', updateButtons);
        }

        // Botões principais
        const btnSave = getElement('btnSaveAdm');
        const btnEdit = getElement('btnAdmEditar');
        const btnDelete = getElement('btnAdmlExcluir');
        
        if (btnSave) btnSave.addEventListener('click', saveAdministrador);
        if (btnEdit) btnEdit.addEventListener('click', editAdministrador);
        if (btnDelete) btnDelete.addEventListener('click', deleteAdministrador);

        // Botões de edição
        const btnConfirm = getElement('btnAdmConfirma');
        const btnCancel = getElement('btnAdmCancela');
        
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
            await loadAdministradores();
        },

        // Métodos para interação externa
        async reload() {
            await loadAdministradores();
        },

        reset() {
            resetUI();
        },

        // Getters para estado (se necessário)
        getAdministradores() {
            return [...administradores]; // Retorna cópia para evitar mutação
        },

        isEditing() {
            return editingId !== null;
        }
    };
})();

// Exporta o módulo (compatível com diferentes sistemas de módulos)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdministradoresModule;
} else if (typeof window !== 'undefined') {
    window.AdministradoresModule = AdministradoresModule;
}