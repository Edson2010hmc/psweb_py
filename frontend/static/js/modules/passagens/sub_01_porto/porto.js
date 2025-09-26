/**
 * Submódulo Porto - Seções 1.1 a 1.10
 * Localização: frontend/static/js/modules/passagens/sub_01_porto/porto.js
 * 
 * Responsabilidades:
 * - Gestão das seções do Porto (1.1 a 1.10)
 * - Interface com módulo coordenador de Passagens
 * - Controle de visibilidade e permissões
 * - Tabelas dinâmicas e uploads de anexos
 * - Auto-registro no módulo principal
 */

const PortoSubModule = (function() {
    'use strict';

    // ===================================================================================================
    // ESTADO INTERNO DO SUBMÓDULO
    // ===================================================================================================
    let currentPS = null;
    let canEdit = false;

    // ===================================================================================================
    // CONSTANTES
    // ===================================================================================================
    const SUBMODULE_NAME = 'porto';

    // ===================================================================================================
    // APIs ESPECÍFICAS DO PORTO
    // ===================================================================================================
    const api = {
        async getData(psId) {
            const response = await fetch(`/api/passagens/${psId}/porto`);
            return response.json();
        },

        async saveData(psId, data) {
            const response = await fetch(`/api/passagens/${psId}/porto`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },

        async getListData(psId) {
            const response = await fetch(`/api/passagens/${psId}/porto-listas`);
            return response.json();
        },

        async saveListData(psId, data) {
            const response = await fetch(`/api/passagens/${psId}/porto-listas`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },

        async uploadAnexo(psId, file) {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`/api/passagens/${psId}/upload`, {
                method: 'POST',
                body: formData
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

    function showMessage(message, isError = false) {
        const msgEl = getElement('msgSalvarPorto');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.style.color = isError ? '#b33' : '#060';
        }
    }

    function clearMessage() {
        const msgEl = getElement('msgSalvarPorto');
        if (msgEl) msgEl.textContent = '';
    }

    // ===================================================================================================
    // CONTROLE DE VISIBILIDADE E TOGGLES
    // ===================================================================================================
    function applyVisibilityRules() {
        // 1.2 Manutenção preventiva
        const chNS = getElement('mpNaoSolicitada');
        const chNP = getElement('mpNaoProgramada');
        const mpFranquia = getElement('mpFranquia');
        const mpOS = getElement('mpOS');

        if (chNS && mpFranquia) {
            const off = chNS.checked;
            if (off) mpFranquia.value = '';
            mpFranquia.disabled = off;
        }
        if (chNP && mpOS) {
            const off = chNP.checked;
            if (off) mpOS.value = '';
            mpOS.disabled = off;
        }

        // 1.3 Abastecimento
        const abOff = getElement('abNaoPrevisto')?.checked;
        _disableElements(['abOS', 'abQtd', 'abDuracao', 'abObs', 'abAnexo'], abOff);
        _toggleTableVisibility(['abOS', 'abQtd', 'abDuracao', 'abObs', 'abAnexo'], abOff);

        // 1.4 ANVISA
        const anOff = getElement('anNaoPrevisto')?.checked;
        _disableElements(['anOS', 'anDesc', 'anObs'], anOff);

        // 1.5 Classe
        const clOff = getElement('clNaoPrevisto')?.checked;
        _disableElements(['clOS', 'clDesc', 'clObs'], clOff);

        // 1.6 Inspeções/Auditorias Petrobras
        const ipOff = getElement('ipNaoPrevisto')?.checked;
        _disableElements(['ipAud', 'ipGer', 'ipObs'], ipOff);

        // 1.7–1.10: esconder tabelas/botões quando "Não previsto"
        _toggleTableVisibility('eqNaoPrevisto', 'tblEq', 'btnAddEq');
        _toggleTableVisibility('emNaoPrevisto', 'tblEM', 'btnAddEM');
        _toggleTableVisibility('dmNaoPrevisto', 'tblDM', 'btnAddDM');
        _toggleTableVisibility('omNaoPrevisto', 'tblOM', 'btnAddOM');
    }

    function _disableElements(ids, disabled) {
        ids.forEach(id => {
            const el = getElement(id);
            if (el) el.disabled = disabled;
        });
    }

    function _toggleTableVisibility(checkboxId, tableId, buttonId) {
        const checkbox = getElement(checkboxId);
        const table = getElement(tableId);
        const button = getElement(buttonId);
        
        if (checkbox) {
            const hide = checkbox.checked;
            if (table) table.style.display = hide ? 'none' : '';
            if (button) button.style.display = hide ? 'none' : '';
        }
    }

    function bindVisibilityToggles() {
        const toggleIds = [
            'mpNaoSolicitada', 'mpNaoProgramada',
            'abNaoPrevisto', 'anNaoPrevisto', 'clNaoPrevisto', 'ipNaoPrevisto',
            'eqNaoPrevisto', 'emNaoPrevisto', 'dmNaoPrevisto', 'omNaoPrevisto'
        ];

        toggleIds.forEach(id => {
            const el = getElement(id);
            if (el && !el._portoBound) {
                el.addEventListener('change', applyVisibilityRules);
                el._portoBound = true;
            }
        });
    }

    // ===================================================================================================
    // CONTROLE DE PERMISSÕES
    // ===================================================================================================
    function applyPermissions(editPermission) {
        canEdit = editPermission;
        
        const scope = document.querySelector('#sub-porto');
        if (!scope) return;

        scope.querySelectorAll('input, textarea, select, button').forEach(el => {
            const isPortoAction = el.id && (
                el.id.startsWith('btnAdd') || 
                el.classList.contains('btn-del-row')
            );
            
            if (isPortoAction) {
                el.disabled = !editPermission;
            } else {
                el.disabled = !editPermission;
            }
        });
    }

    // ===================================================================================================
    // TABELAS DINÂMICAS (1.7 a 1.10)
    // ===================================================================================================
    function _createInput(type, className, placeholder = '', attrs = '') {
        return `<${type} class="${className}" placeholder="${placeholder}" ${attrs}>`;
    }

    function _createFileInput(className) {
        return `<input type="file" class="${className}">`;
    }

    function _getTableBody(tableId) {
        return document.querySelector(`#${tableId} tbody`);
    }

    // 1.7 Embarque de Equipes
    function addRowEq(data = { Tipo: '', Empresa: '', Nome: '', Observacoes: '' }) {
        const tbody = _getTableBody('tblEq');
        if (!tbody) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${_createInput('input', 'eq-tipo', 'Tipo')}</td>
            <td>${_createInput('input', 'eq-empresa', 'Empresa')}</td>
            <td>${_createInput('input', 'eq-nome', 'Nome')}</td>
            <td>${_createInput('input', 'eq-obs', 'Observações')}</td>
            <td><button class="btn secondary btn-del-row">Remover</button></td>
        `;
        tbody.appendChild(tr);

        // Preenche valores
        tr.querySelector('.eq-tipo').value = data.Tipo || '';
        tr.querySelector('.eq-empresa').value = data.Empresa || '';
        tr.querySelector('.eq-nome').value = data.Nome || '';
        tr.querySelector('.eq-obs').value = data.Observacoes || '';
    }

    // 1.8 Embarque de Materiais
    function addRowEM(data = { Origem: '', OS: '', Destino: '', RT: '', Observacoes: '', AnexoPath: null }) {
        const tbody = _getTableBody('tblEM');
        if (!tbody) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${_createInput('input', 'em-origem', 'Origem')}</td>
            <td>${_createInput('input', 'em-os', 'OS')}</td>
            <td>${_createInput('input', 'em-dest', 'Destino')}</td>
            <td>${_createInput('input', 'em-rt', 'RT')}</td>
            <td>${_createInput('input', 'em-obs', 'Observações')}</td>
            <td>${_createFileInput('em-file')}</td>
            <td><button class="btn secondary btn-del-row">Remover</button></td>
        `;
        tbody.appendChild(tr);

        // Preenche valores
        tr.querySelector('.em-origem').value = data.Origem || '';
        tr.querySelector('.em-os').value = data.OS || '';
        tr.querySelector('.em-dest').value = data.Destino || '';
        tr.querySelector('.em-rt').value = data.RT || '';
        tr.querySelector('.em-obs').value = data.Observacoes || '';
        tr.dataset.anexopath = data.AnexoPath || '';
    }

    // 1.9 Desembarque de Materiais
    function addRowDM(data = { OS: '', Origem: '', Destino: '', RT: '', Observacoes: '', AnexoPath: null }) {
        const tbody = _getTableBody('tblDM');
        if (!tbody) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${_createInput('input', 'dm-os', 'OS')}</td>
            <td>${_createInput('input', 'dm-origem', 'Origem')}</td>
            <td>${_createInput('input', 'dm-dest', 'Destino')}</td>
            <td>${_createInput('input', 'dm-rt', 'RT')}</td>
            <td>${_createInput('input', 'dm-obs', 'Observações')}</td>
            <td>${_createFileInput('dm-file')}</td>
            <td><button class="btn secondary btn-del-row">Remover</button></td>
        `;
        tbody.appendChild(tr);

        // Preenche valores
        tr.querySelector('.dm-os').value = data.OS || '';
        tr.querySelector('.dm-origem').value = data.Origem || '';
        tr.querySelector('.dm-dest').value = data.Destino || '';
        tr.querySelector('.dm-rt').value = data.RT || '';
        tr.querySelector('.dm-obs').value = data.Observacoes || '';
        tr.dataset.anexopath = data.AnexoPath || '';
    }

    // 1.10 OS Mobilização/Desmobilização
    function addRowOM(data = { OS: '', Descricao: '', Observacoes: '', AnexoPath: null }) {
        const tbody = _getTableBody('tblOM');
        if (!tbody) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${_createInput('input', 'om-os', 'OS')}</td>
            <td>${_createInput('input', 'om-desc', 'Descrição')}</td>
            <td>${_createInput('input', 'om-obs', 'Observações')}</td>
            <td>${_createFileInput('om-file')}</td>
            <td><button class="btn secondary btn-del-row">Remover</button></td>
        `;
        tbody.appendChild(tr);

        // Preenche valores
        tr.querySelector('.om-os').value = data.OS || '';
        tr.querySelector('.om-desc').value = data.Descricao || '';
        tr.querySelector('.om-obs').value = data.Observacoes || '';
        tr.dataset.anexopath = data.AnexoPath || '';
    }

    // Event listener para botões de remoção das tabelas
    function bindTableRowDeletes() {
        document.querySelectorAll('#tblEq, #tblEM, #tblDM, #tblOM').forEach(table => {
            // Remove listener anterior se existir
            table.removeEventListener('click', handleRowDelete);
            table.addEventListener('click', handleRowDelete);
        });
    }

    function handleRowDelete(event) {
        const button = event.target.closest('.btn-del-row');
        if (!button) return;
        
        const row = button.closest('tr');
        if (row) row.remove();
    }

    // ===================================================================================================
    // CARREGAMENTO DE DADOS
    // ===================================================================================================
    async function loadSimpleFields(psId) {
        try {
            const data = await api.getData(psId);
            if (!data || data.error) return;

            // 1.1 Troca de Turma
            if (data.trocaturma) {
                _setFieldValue('ttPorto', data.trocaturma.Porto);
                _setFieldValue('ttTerminal', data.trocaturma.Terminal);
                _setFieldValue('ttOS', data.trocaturma.OrdemServico);
                _setFieldValue('ttAtracacao', data.trocaturma.AtracacaoHora);
                _setFieldValue('ttDuracao', data.trocaturma.DuracaoMin);
                _setFieldValue('ttObs', data.trocaturma.Observacoes);
            }

            // 1.2 Manutenção Preventiva
            if (data.manutencaoPreventiva) {
                _setCheckboxValue('mpNaoSolicitada', data.manutencaoPreventiva.NaoSolicitada);
                _setFieldValue('mpFranquia', data.manutencaoPreventiva.FranquiaSolicitadaMin);
                _setCheckboxValue('mpNaoProgramada', data.manutencaoPreventiva.NaoProgramada);
                _setFieldValue('mpOS', data.manutencaoPreventiva.OrdemServico);
                _setFieldValue('mpSaldo', data.manutencaoPreventiva.SaldoFranquiaMin);
                _setFieldValue('mpObs', data.manutencaoPreventiva.Observacoes);
            }

            // 1.3 Abastecimento
            if (data.abastecimento) {
                _setCheckboxValue('abNaoPrevisto', data.abastecimento.NaoPrevisto);
                _setFieldValue('abOS', data.abastecimento.OrdemServico);
                _setFieldValue('abQtd', data.abastecimento.Quantidade_m3);
                _setFieldValue('abDuracao', data.abastecimento.DuracaoMin);
                _setFieldValue('abObs', data.abastecimento.Observacoes);
            }

            // 1.4 ANVISA
            if (data.anvisa) {
                _setCheckboxValue('anNaoPrevisto', data.anvisa.NaoPrevisto);
                _setFieldValue('anOS', data.anvisa.OrdemServico);
                _setFieldValue('anDesc', data.anvisa.Descricao);
                _setFieldValue('anObs', data.anvisa.Observacoes);
            }

            // 1.5 Classe
            if (data.classe) {
                _setCheckboxValue('clNaoPrevisto', data.classe.NaoPrevisto);
                _setFieldValue('clOS', data.classe.OrdemServico);
                _setFieldValue('clDesc', data.classe.Descricao);
                _setFieldValue('clObs', data.classe.Observacoes);
            }

            // 1.6 Inspeções Petrobras
            if (data.inspecoesPetrobras) {
                _setCheckboxValue('ipNaoPrevisto', data.inspecoesPetrobras.NaoPrevisto);
                _setFieldValue('ipGer', data.inspecoesPetrobras.Gerencia);      // CORREÇÃO: .Ger → .Gerencia
                _setFieldValue('ipAud', data.inspecoesPetrobras.Auditor);       // CORREÇÃO: .Aud → .Auditor  
                _setFieldValue('ipObs', data.inspecoesPetrobras.Observacoes);
            }

        } catch (error) {
            console.error('Erro ao carregar campos simples do Porto:', error);
        }
    }

    async function loadListFields(psId) {
        try {
            const data = await api.getListData(psId);
            if (!data || data.error) return;

            // Limpa tabelas
            ['tblEq', 'tblEM', 'tblDM', 'tblOM'].forEach(id => {
                const tbody = _getTableBody(id);
                if (tbody) tbody.innerHTML = '';
            });

            // 1.7 Equipes
            _setCheckboxValue('eqNaoPrevisto', data.equipes?.naoPrevisto);
            (data.equipes?.linhas || []).forEach(addRowEq);

            // 1.8 EM
            _setCheckboxValue('emNaoPrevisto', data.embarqueMateriais?.naoPrevisto);
            (data.embarqueMateriais?.linhas || []).forEach(addRowEM);

            // 1.9 DM
            _setCheckboxValue('dmNaoPrevisto', data.desembarqueMateriais?.naoPrevisto);
            (data.desembarqueMateriais?.linhas || []).forEach(addRowDM);

            // 1.10 OM
            _setCheckboxValue('omNaoPrevisto', data.osMobilizacao?.naoPrevisto);
            (data.osMobilizacao?.linhas || []).forEach(addRowOM);

        } catch (error) {
            console.error('Erro ao carregar listas do Porto:', error);
        }
    }

    function _setFieldValue(id, value) {
        const el = getElement(id);
        if (el) el.value = value ?? '';
    }

    function _setCheckboxValue(id, value) {
        const el = getElement(id);
        if (el) el.checked = !!Number(value);
    }

    // ===================================================================================================
    // SALVAMENTO DE DADOS
    // ===================================================================================================
    async function saveSimpleFields(psId) {
        // Upload de arquivos individuais se houver
        async function maybeUpload(fileInputId) {
            const el = getElement(fileInputId);
            if (!el || !el.files || el.files.length === 0) return null;
            
            const upload = await api.uploadAnexo(psId, el.files[0]);
            if (upload && upload.ok && upload.path) return upload.path;
            throw new Error('Falha no upload de anexo');
        }

        const RADEPath = await maybeUpload('mpRADE');
        const AbAnexo = await maybeUpload('abAnexo');

        const payload = {
            trocaturma: {
                Porto: getElement('ttPorto')?.value?.trim() || null,
                Terminal: getElement('ttTerminal')?.value?.trim() || null,
                OrdemServico: getElement('ttOS')?.value?.trim() || null,
                AtracacaoHora: getElement('ttAtracacao')?.value || null,
                DuracaoMin: getElement('ttDuracao')?.value ? Number(getElement('ttDuracao').value) : null,
                Observacoes: getElement('ttObs')?.value || null
            },
            manutencaoPreventiva: {
                NaoSolicitada: getElement('mpNaoSolicitada')?.checked ? 1 : 0,
                FranquiaSolicitadaMin: getElement('mpFranquia')?.value ? Number(getElement('mpFranquia').value) : null,
                NaoProgramada: getElement('mpNaoProgramada')?.checked ? 1 : 0,
                OrdemServico: getElement('mpOS')?.value || null,
                SaldoFranquiaMin: getElement('mpSaldo')?.value ? Number(getElement('mpSaldo').value) : null,
                RADEPath: RADEPath,
                Observacoes: getElement('mpObs')?.value || null
            },
            abastecimento: {
                NaoPrevisto: getElement('abNaoPrevisto')?.checked ? 1 : 0,
                OrdemServico: getElement('abOS')?.value || null,
                Quantidade_m3: getElement('abQtd')?.value ? Number(getElement('abQtd').value) : null,
                DuracaoMin: getElement('abDuracao')?.value ? Number(getElement('abDuracao').value) : null,
                Observacoes: getElement('abObs')?.value || null,
                AnexoPath: AbAnexo
            },
            anvisa: {
                NaoPrevisto: getElement('anNaoPrevisto')?.checked ? 1 : 0,
                OrdemServico: getElement('anOS')?.value || null,
                Descricao: getElement('anDesc')?.value || null,
                Observacoes: getElement('anObs')?.value || null
            },
            classe: {
                NaoPrevisto: getElement('clNaoPrevisto')?.checked ? 1 : 0,
                OrdemServico: getElement('clOS')?.value || null,
                Descricao: getElement('clDesc')?.value || null,
                Observacoes: getElement('clObs')?.value || null
            },
            inspecoesPetrobras: {
                NaoPrevisto: getElement('ipNaoPrevisto')?.checked ? 1 : 0,
                Auditor: getElement('ipAud')?.value || null,    // CORREÇÃO: Aud → Auditor  
                Gerencia: getElement('ipGer')?.value || null,   // CORREÇÃO: Ger → Gerencia
                Observacoes: getElement('ipObs')?.value || null
            }
        };

        return api.saveData(psId, payload);
    }

    async function saveListFields(psId) {
        // Upload de anexos das linhas
        async function maybeUploadRow(fileEl) {
            if (!fileEl || !fileEl.files || fileEl.files.length === 0) return null;
            
            const upload = await api.uploadAnexo(psId, fileEl.files[0]);
            if (upload && upload.ok && upload.path) return upload.path;
            throw new Error('Falha no upload de anexo em linha');
        }

        // Monta arrays de dados
        const eq = Array.from(document.querySelectorAll('#tblEq tbody tr')).map(tr => ({
            Tipo: tr.querySelector('.eq-tipo')?.value || null,
            Empresa: tr.querySelector('.eq-empresa')?.value || null,
            Nome: tr.querySelector('.eq-nome')?.value || null,
            Observacoes: tr.querySelector('.eq-obs')?.value || null
        }));

        const em = [];
        for (const tr of Array.from(document.querySelectorAll('#tblEM tbody tr'))) {
            const path = await maybeUploadRow(tr.querySelector('.em-file')) || (tr.dataset.anexopath || null);
            em.push({
                Origem: tr.querySelector('.em-origem')?.value || null,
                OS: tr.querySelector('.em-os')?.value || null,
                Destino: tr.querySelector('.em-dest')?.value || null,
                RT: tr.querySelector('.em-rt')?.value || null,
                Observacoes: tr.querySelector('.em-obs')?.value || null,
                AnexoPath: path
            });
        }

        const dm = [];
        for (const tr of Array.from(document.querySelectorAll('#tblDM tbody tr'))) {
            const path = await maybeUploadRow(tr.querySelector('.dm-file')) || (tr.dataset.anexopath || null);
            dm.push({
                OS: tr.querySelector('.dm-os')?.value || null,
                Origem: tr.querySelector('.dm-origem')?.value || null,
                Destino: tr.querySelector('.dm-dest')?.value || null,
                RT: tr.querySelector('.dm-rt')?.value || null,
                Observacoes: tr.querySelector('.dm-obs')?.value || null,
                AnexoPath: path
            });
        }

        const om = [];
        for (const tr of Array.from(document.querySelectorAll('#tblOM tbody tr'))) {
            const path = await maybeUploadRow(tr.querySelector('.om-file')) || (tr.dataset.anexopath || null);
            om.push({
                OS: tr.querySelector('.om-os')?.value || null,
                Descricao: tr.querySelector('.om-desc')?.value || null,
                Observacoes: tr.querySelector('.om-obs')?.value || null,
                AnexoPath: path
            });
        }

        const payload = {
            equipes: { naoPrevisto: getElement('eqNaoPrevisto')?.checked, linhas: eq },
            embarqueMateriais: { naoPrevisto: getElement('emNaoPrevisto')?.checked, linhas: em },
            desembarqueMateriais: { naoPrevisto: getElement('dmNaoPrevisto')?.checked, linhas: dm },
            osMobilizacao: { naoPrevisto: getElement('omNaoPrevisto')?.checked, linhas: om }
        };

        return api.saveListData(psId, payload);
    }

    async function saveAllPortoData() {
        if (!currentPS) {
            showMessage('Nenhuma PS carregada', true);
            return;
        }

        clearMessage();

        try {
            const result1 = await saveSimpleFields(currentPS.PassagemId);
            if (result1 && result1.error) throw new Error(result1.error);

            const result2 = await saveListFields(currentPS.PassagemId);
            if (result2 && result2.error) throw new Error(result2.error);

            showMessage('PORTO salvo com sucesso.');

        } catch (error) {
            showMessage('Falha ao salvar PORTO: ' + (error.message || error), true);
        }
    }

    // ===================================================================================================
    // EVENT LISTENERS
    // ===================================================================================================
    function bindEvents() {
        // Botões de adicionar linhas
        const addButtons = {
            'btnAddEq': () => addRowEq(),
            'btnAddEM': () => addRowEM(),
            'btnAddDM': () => addRowDM(),
            'btnAddOM': () => addRowOM()
        };

        Object.entries(addButtons).forEach(([id, handler]) => {
            const btn = getElement(id);
            if (btn) {
                btn.removeEventListener('click', handler);
                btn.addEventListener('click', handler);
            }
        });

        
        // Toggles de visibilidade
        bindVisibilityToggles();

        // Botões de remoção das tabelas
        bindTableRowDeletes();
    }

    // ===================================================================================================
    // INTERFACES COM MÓDULO COORDENADOR (OBRIGATÓRIAS)
    // ===================================================================================================
    
    /**
     * Interface obrigatória: Inicialização do submódulo
     */
    async function init() {
        bindEvents();
        console.log(`🎯 Submódulo ${SUBMODULE_NAME} inicializado`);
    }

    /**
     * Interface obrigatória: Chamada quando PS muda
     * @param {Object} psData - dados da PS atual
     */
    async function onPSChange(psData) {
        currentPS = psData;
        
        if (psData && psData.PassagemId) {
            await loadSimpleFields(psData.PassagemId);
            await loadListFields(psData.PassagemId);
            applyVisibilityRules();
            
            // Aplica permissões baseadas no status da PS
            const userContext = window.AuthModule?.getCurrentUser();
            const editPermission = (psData.Status === 'RASCUNHO') &&
                                 (new Date() <= new Date(new Date(psData.PeriodoFim).getTime() + 24*60*60*1000)) &&
                                 (psData.FiscalDesembarcandoId === userContext?.fiscalId);
            
            applyPermissions(editPermission);
        }
        
        console.log(`🔄 ${SUBMODULE_NAME}: PS alterada para ${psData?.PassagemId || 'null'}`);
    }

    /**
     * Interface obrigatória: Chamada quando sub-aba é ativada
     * @param {Object} psData - dados da PS atual  
     */
    async function onActivate(psData) {
        currentPS = psData;
        
        // Reaplica regras quando ativado
        applyVisibilityRules();
        
        console.log(`🎯 ${SUBMODULE_NAME}: Submódulo ativado`);
    }

    // ===================================================================================================
    // AUTO-REGISTRO NO MÓDULO COORDENADOR
    // ===================================================================================================
    
    // Registra automaticamente no módulo coordenador quando disponível
    function autoRegister() {
        if (window.PassagensModule && typeof window.PassagensModule.registerSubModule === 'function') {
            window.PassagensModule.registerSubModule(SUBMODULE_NAME, publicInterface);
            console.log(`📌 ${SUBMODULE_NAME}: Auto-registrado no módulo coordenador`);
        } else {
            // Tenta novamente após um tempo se o módulo coordenador ainda não estiver disponível
            setTimeout(autoRegister, 100);
        }
    }

    // ===================================================================================================
    // INTERFACE PÚBLICA DO SUBMÓDULO
    // ===================================================================================================
    const publicInterface = {
        // Interfaces obrigatórias para coordenador
        init,
        onPSChange,
        onActivate,

        // Métodos públicos específicos do Porto
        async save() {
            return await saveAllPortoData();
        },

        async reload() {
            if (currentPS) {
                await onPSChange(currentPS);
            }
        },

        // Getters
        getCurrentPS() {
            return currentPS;
        },

        canEdit() {
            return canEdit;
        },

        // Utilitários para outros submódulos (se necessário)
        addTableRow: {
            equipes: addRowEq,
            embarqueMateriais: addRowEM,
            desembarqueMateriais: addRowDM,
            osMobilizacao: addRowOM
        }
    };

    // Auto-registro quando módulo é carregado
    setTimeout(autoRegister, 0);

    return publicInterface;
})();

// Exporta o módulo (compatível com diferentes sistemas de módulos)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PortoSubModule;
} else if (typeof window !== 'undefined') {
    window.PortoSubModule = PortoSubModule;
}