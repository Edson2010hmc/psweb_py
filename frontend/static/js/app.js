
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const api = {
  async me(){ const r = await fetch('/api/me'); return r.json(); },
  async loginManual(nome){ const r = await fetch('/api/login-manual',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nome})}); return r.json(); },
  async logout(){ const r = await fetch('/api/logout',{method:'POST'}); return r.json(); },
  async embarcacoes(){ const r = await fetch('/api/embarcacoes'); return r.json(); },
  async fiscais(){ const r = await fetch('/api/fiscais'); return r.json(); },
  async listarPS(inicio, fim){ const p = new URLSearchParams(); if (inicio) p.append('inicio',inicio); if (fim) p.append('fim',fim); const r = await fetch('/api/passagens?'+p.toString()); return r.json(); },
  async ps(id){ const r = await fetch('/api/passagens/'+id); return r.json(); },
  async criarPS(data){ const r = await fetch('/api/passagens', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) }); return r.json(); },
  async salvarPS(id, data){ const r = await fetch('/api/passagens/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) }); return r.json(); },
  async finalizar(id){ const r = await fetch('/api/passagens/'+id+'/finalizar', { method:'POST' }); return r.json(); },
  async copiar(id){ const r = await fetch('/api/passagens/'+id+'/copiar', { method:'POST' }); return r.json(); },
  async adminListarPS(){ const r = await fetch('/api/admin/passagens'); return r.json(); },
  async adminExcluirPS(id){ const r = await fetch('/api/admin/passagens/'+id, { method:'DELETE' }); return r.json(); }
};

let EMB_EDITING_ID = null;
let CTX=null; 
let FISCAIS=[]; 
let EMB=[]; 
let CUR_PS=null;
let AUTH_MODE = 'manual'; // 'windows' ou 'manual', vem do /api/me
const isWindowsAuth = () => AUTH_MODE === 'windows';
let ADMIN_PS = [];
let FISC_EDITING_ID = null;


// ===  Normalização opcional de chaves de objetos  ===
function _normalizeKeyToCamelPascal(k) {
  // Converte "EMBARCACAOID" -> "EmbarcacaoId" | "PASSAGEM_ID" -> "PassagemId"
  if (typeof k !== 'string' || !k) return k;
  const up = k.replace(/[_\s]+/g, '').toUpperCase();
  
  // separa blocos por transições heurísticas (ID, CPF, etc. viram "Id", "Cpf")
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
// === [END] Normalização opcional de chaves ===






// Helpers simples
function _show(el, on){ if(el) el.style.display = on ? '' : 'none'; }
function _disable(el, on){ if(el) el.disabled = !!on; }

// Aplica regras de visibilidade/disable conforme checkboxes
function applyPortoVisibility(){
  // 1.2 Manutenção preventiva
  const chNS = document.getElementById('mpNaoSolicitada');
  const chNP = document.getElementById('mpNaoProgramada');
  const mpFranquia = document.getElementById('mpFranquia');
  const mpOS = document.getElementById('mpOS');

  if (chNS && mpFranquia){
    const off = chNS.checked;               // PDF: "Não solicitada" -> Franquia = 0 e inativa
    if (off) mpFranquia.value = '';
    _disable(mpFranquia, off);
  }
  if (chNP && mpOS){
    const off = chNP.checked;               // PDF: "Não programada" -> OS vazia e inativa
    if (off) mpOS.value = '';
    _disable(mpOS, off);
  }

  // 1.3 Abastecimento
  const abOff = document.getElementById('abNaoPrevisto')?.checked;
  _disable(document.getElementById('abOS'),      abOff);
  _disable(document.getElementById('abQtd'),     abOff);
  _disable(document.getElementById('abDuracao'), abOff);
  _disable(document.getElementById('abObs'),     abOff);
  _disable(document.getElementById('abAnexo'),   abOff);

  // 1.4 ANVISA
  const anOff = document.getElementById('anNaoPrevisto')?.checked;
  _disable(document.getElementById('anOS'),   anOff);
  _disable(document.getElementById('anDesc'), anOff);
  _disable(document.getElementById('anObs'),  anOff);

  // 1.5 Classe
  const clOff = document.getElementById('clNaoPrevisto')?.checked;
  _disable(document.getElementById('clOS'),   clOff);
  _disable(document.getElementById('clDesc'), clOff);
  _disable(document.getElementById('clObs'),  clOff);

  // 1.6 Inspeções/Auditorias Petrobras
  const ipOff = document.getElementById('ipNaoPrevisto')?.checked;
  _disable(document.getElementById('ipAud'), ipOff);
  _disable(document.getElementById('ipGer'), ipOff);
  _disable(document.getElementById('ipObs'), ipOff);

  // 1.7–1.10: esconder tabelas/botões quando "Não previsto"
  const eqOff = document.getElementById('eqNaoPrevisto')?.checked;
  _show(document.getElementById('tblEq'),     !eqOff);
  _show(document.getElementById('btnAddEq'),  !eqOff);

  const emOff = document.getElementById('emNaoPrevisto')?.checked;
  _show(document.getElementById('tblEM'),     !emOff);
  _show(document.getElementById('btnAddEM'),  !emOff);

  const dmOff = document.getElementById('dmNaoPrevisto')?.checked;
  _show(document.getElementById('tblDM'),     !dmOff);
  _show(document.getElementById('btnAddDM'),  !dmOff);

  const omOff = document.getElementById('omNaoPrevisto')?.checked;
  _show(document.getElementById('tblOM'),     !omOff);
  _show(document.getElementById('btnAddOM'),  !omOff);
}

// liga os eventos
function bindPortoToggles(){
  [
    'mpNaoSolicitada','mpNaoProgramada',
    'abNaoPrevisto','anNaoPrevisto','clNaoPrevisto','ipNaoPrevisto',
    'eqNaoPrevisto','emNaoPrevisto','dmNaoPrevisto','omNaoPrevisto'
  ].forEach(id=>{
    const el = document.getElementById(id);
    if (el && !el._portoBound){
      el.addEventListener('change', applyPortoVisibility);
      el._portoBound = true;
    }
  });
}

//Inicializa ao abrir a sub-aba PORTO e também após carregar dados
document.addEventListener('DOMContentLoaded', ()=>{
  bindPortoToggles();
  // Se a sub-aba já estiver ativa e houver PS carregada
  applyPortoVisibility();
});

// Garante que roda após cada carregarPorto_11a16 / 17a110
const _carregar11a16 = window.carregarPorto_11a16;
window.carregarPorto_11a16 = async function(psId){
  const r = await _carregar11a16(psId);
  bindPortoToggles(); applyPortoVisibility();
  return r;
};
const _carregar17a110 = window.carregarPorto_17a110;
window.carregarPorto_17a110 = async function(psId){
  const r = await _carregar17a110(psId);
  bindPortoToggles(); applyPortoVisibility();
  return r;
};

// APIs específicas para partes da PS (Porto e Listas)
api.portoGet = async function(id){
  const r = await fetch(`/api/passagens/${id}/porto`);
  return r.json();
};
api.portoSave = async function(id, data){
  const r = await fetch(`/api/passagens/${id}/porto`, {
    method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
  });
  return r.json();
};
api.portoListasGet = async function(id){
  const r = await fetch(`/api/passagens/${id}/porto-listas`);
  return r.json();
};
api.portoListasSave = async function(id, data){
  const r = await fetch(`/api/passagens/${id}/porto-listas`, {
    method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
  });
  return r.json();
};
api.uploadAnexo = async function(id, file){
  const fd = new FormData(); fd.append('file', file);
  const r = await fetch(`/api/passagens/${id}/upload`, { method:'POST', body: fd });
  return r.json(); // { ok:true, path: '...' }
};
// Fim APIs específicas para partes da PS





// Carrega os dados da seção Porto 1.1 a 1.6 na UI
async function carregarPorto_11a16(psId){
  const d = await api.portoGet(psId);
  if (!d || d.error) return;

  // 1.1 Troca de Turma
  if (d.trocaturma){
    $('#ttPorto').value    = d.trocaturma.Porto ?? '';
    $('#ttTerminal').value = d.trocaturma.Terminal ?? '';
    $('#ttOS').value       = d.trocaturma.OrdemServico ?? '';
    $('#ttAtracacao').value= d.trocaturma.AtracacaoHora ?? '';
    $('#ttDuracao').value  = d.trocaturma.DuracaoMin ?? '';
    $('#ttObs').value      = d.trocaturma.Observacoes ?? '';
  }

  // 1.2 Manutenção Preventiva
  if (d.manutencaoPreventiva){
    $('#mpNaoSolicitada').checked = !!Number(d.manutencaoPreventiva.NaoSolicitada);
    $('#mpFranquia').value        = d.manutencaoPreventiva.FranquiaSolicitadaMin ?? '';
    $('#mpNaoProgramada').checked = !!Number(d.manutencaoPreventiva.NaoProgramada);
    $('#mpOS').value              = d.manutencaoPreventiva.OrdemServico ?? '';
    $('#mpSaldo').value           = d.manutencaoPreventiva.SaldoFranquiaMin ?? '';
    $('#mpObs').value             = d.manutencaoPreventiva.Observacoes ?? '';
    // RADEPath é tratado no upload no salvar (não “preenche” input file)
  }

  // 1.3 Abastecimento
  if (d.abastecimento){
    $('#abNaoPrevisto').checked = !!Number(d.abastecimento.NaoPrevisto);
    $('#abOS').value            = d.abastecimento.OrdemServico ?? '';
    $('#abQtd').value           = d.abastecimento.Quantidade_m3 ?? '';
    $('#abDuracao').value       = d.abastecimento.DuracaoMin ?? '';
    $('#abObs').value           = d.abastecimento.Observacoes ?? '';
    // AnexoPath idem: trataremos no salvar
  }

  // 1.4 ANVISA
  if (d.anvisa){
    $('#anNaoPrevisto').checked = !!Number(d.anvisa.NaoPrevisto);
    $('#anOS').value            = d.anvisa.OrdemServico ?? '';
    $('#anDesc').value          = d.anvisa.Descricao ?? '';
    $('#anObs').value           = d.anvisa.Observacoes ?? '';
  }

  // 1.5 Classe
  if (d.classe){
    $('#clNaoPrevisto').checked = !!Number(d.classe.NaoPrevisto);
    $('#clOS').value            = d.classe.OrdemServico ?? '';
    $('#clDesc').value          = d.classe.Descricao ?? '';
    $('#clObs').value           = d.classe.Observacoes ?? '';
  }

  // 1.6 Inspeções Petrobras
  if (d.inspecoesPetrobras){
    $('#ipNaoPrevisto').checked = !!Number(d.inspecoesPetrobras.NaoPrevisto);
    $('#ipGer').value           = d.inspecoesPetrobras.Ger ?? '';
    $('#ipAud').value           = d.inspecoesPetrobras.Aud ?? '';
    $('#ipObs').value           = d.inspecoesPetrobras.Observacoes ?? '';
  }
}

async function salvarPorto_11a16(psId){
  // helpers de upload de arquivos individuais (se houver)
  async function maybeUpload(fileInputId){
    const el = document.getElementById(fileInputId);
    if (!el || !el.files || el.files.length === 0) return null;
    const up = await api.uploadAnexo(psId, el.files[0]);
    if (up && up.ok && up.path) return up.path;
    throw new Error('Falha no upload de anexo');
  }

  const RADEPath = await maybeUpload('mpRADE');
  const AbAnexo  = await maybeUpload('abAnexo');

  const body = {
    trocaturma: {
      Porto: $('#ttPorto').value.trim(),
      Terminal: $('#ttTerminal').value.trim(),
      OrdemServico: $('#ttOS').value.trim(),
      AtracacaoHora: $('#ttAtracacao').value || null,
      DuracaoMin: $('#ttDuracao').value ? Number($('#ttDuracao').value) : null,
      Observacoes: $('#ttObs').value || null
    },
    manutencaoPreventiva: {
      NaoSolicitada: $('#mpNaoSolicitada').checked ? 1 : 0,
      FranquiaSolicitadaMin: $('#mpFranquia').value ? Number($('#mpFranquia').value) : null,
      NaoProgramada: $('#mpNaoProgramada').checked ? 1 : 0,
      OrdemServico: $('#mpOS').value || null,
      SaldoFranquiaMin: $('#mpSaldo').value ? Number($('#mpSaldo').value) : null,
      RADEPath: RADEPath,
      Observacoes: $('#mpObs').value || null
    },
    abastecimento: {
      NaoPrevisto: $('#abNaoPrevisto').checked ? 1 : 0,
      OrdemServico: $('#abOS').value || null,
      Quantidade_m3: $('#abQtd').value ? Number($('#abQtd').value) : null,
      DuracaoMin: $('#abDuracao').value ? Number($('#abDuracao').value) : null,
      Observacoes: $('#abObs').value || null,
      AnexoPath: AbAnexo
    },
    anvisa: {
      NaoPrevisto: $('#anNaoPrevisto').checked ? 1 : 0,
      OrdemServico: $('#anOS').value || null,
      Descricao: $('#anDesc').value || null,
      Observacoes: $('#anObs').value || null
    },
    classe: {
      NaoPrevisto: $('#clNaoPrevisto').checked ? 1 : 0,
      OrdemServico: $('#clOS').value || null,
      Descricao: $('#clDesc').value || null,
      Observacoes: $('#clObs').value || null
    },
    inspecoesPetrobras: {
      NaoPrevisto: $('#ipNaoPrevisto').checked ? 1 : 0,
      Ger: $('#ipGer').value || null,
      Aud: $('#ipAud').value || null,
      Observacoes: $('#ipObs').value || null
    }
  };

  return api.portoSave(psId, body);
}//--fim de salvarPorto_11a16




//-----------------------------------PORTO 1.7 a 1.10----------------------------
function _rowInput(type, cls, placeholder='', attrs=''){
  return `<${type} class="${cls}" placeholder="${placeholder}" ${attrs}>`;
}
function _rowFile(cls){ return `<input type="file" class="${cls}">`; }

function _tbl(tid){ return document.querySelector(`#${tid} tbody`); }

function addRowEq(v={Tipo:'',Empresa:'',Nome:'',Observacoes:''}){
  const tb = _tbl('tblEq'); if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${_rowInput('input','eq-tipo','Tipo')}</td>
    <td>${_rowInput('input','eq-empresa','Empresa')}</td>
    <td>${_rowInput('input','eq-nome','Nome')}</td>
    <td>${_rowInput('input','eq-obs','Observações')}</td>
    <td><button class="btn secondary btn-del-row">Remover</button></td>`;
  tb.appendChild(tr);
  tr.querySelector('.eq-tipo').value = v.Tipo || '';
  tr.querySelector('.eq-empresa').value = v.Empresa || '';
  tr.querySelector('.eq-nome').value = v.Nome || '';
  tr.querySelector('.eq-obs').value = v.Observacoes || '';
}

function addRowEM(v={Origem:'',OS:'',Destino:'',RT:'',Observacoes:'',AnexoPath:null}){
  const tb = _tbl('tblEM'); if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${_rowInput('input','em-origem','Origem')}</td>
    <td>${_rowInput('input','em-os','OS')}</td>
    <td>${_rowInput('input','em-dest','Destino')}</td>
    <td>${_rowInput('input','em-rt','RT')}</td>
    <td>${_rowInput('input','em-obs','Observações')}</td>
    <td>${_rowFile('em-file')}</td>
    <td><button class="btn secondary btn-del-row">Remover</button></td>`;
  tb.appendChild(tr);
  tr.querySelector('.em-origem').value = v.Origem || '';
  tr.querySelector('.em-os').value     = v.OS || '';
  tr.querySelector('.em-dest').value   = v.Destino || '';
  tr.querySelector('.em-rt').value     = v.RT || '';
  tr.querySelector('.em-obs').value    = v.Observacoes || '';
  tr.dataset.anexopath = v.AnexoPath || '';
}

function addRowDM(v={OS:'',Origem:'',Destino:'',RT:'',Observacoes:'',AnexoPath:null}){
  const tb = _tbl('tblDM'); if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${_rowInput('input','dm-os','OS')}</td>
    <td>${_rowInput('input','dm-origem','Origem')}</td>
    <td>${_rowInput('input','dm-dest','Destino')}</td>
    <td>${_rowInput('input','dm-rt','RT')}</td>
    <td>${_rowInput('input','dm-obs','Observações')}</td>
    <td>${_rowFile('dm-file')}</td>
    <td><button class="btn secondary btn-del-row">Remover</button></td>`;
  tb.appendChild(tr);
  tr.querySelector('.dm-os').value     = v.OS || '';
  tr.querySelector('.dm-origem').value = v.Origem || '';
  tr.querySelector('.dm-dest').value   = v.Destino || '';
  tr.querySelector('.dm-rt').value     = v.RT || '';
  tr.querySelector('.dm-obs').value    = v.Observacoes || '';
  tr.dataset.anexopath = v.AnexoPath || '';
}

function addRowOM(v={OS:'',Descricao:'',Observacoes:'',AnexoPath:null}){
  const tb = _tbl('tblOM'); if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${_rowInput('input','om-os','OS')}</td>
    <td>${_rowInput('input','om-desc','Descrição')}</td>
    <td>${_rowInput('input','om-obs','Observações')}</td>
    <td>${_rowFile('om-file')}</td>
    <td><button class="btn secondary btn-del-row">Remover</button></td>`;
  tb.appendChild(tr);
  tr.querySelector('.om-os').value   = v.OS || '';
  tr.querySelector('.om-desc').value = v.Descricao || '';
  tr.querySelector('.om-obs').value  = v.Observacoes || '';
  tr.dataset.anexopath = v.AnexoPath || '';
}

function bindTableRowDeletes(){
  document.querySelectorAll('#tblEq, #tblEM, #tblDM, #tblOM').forEach(tbl=>{
    tbl.addEventListener('click', (ev)=>{
      const b = ev.target.closest('.btn-del-row'); if (!b) return;
      const tr = b.closest('tr'); if (tr) tr.remove();
    });
  });
}

async function carregarPorto_17a110(psId){
  const d = await api.portoListasGet(psId);
  if (!d || d.error) return;

  // Limpa tabelas
  ['tblEq','tblEM','tblDM','tblOM'].forEach(id=>{
    const tb = _tbl(id); if (tb) tb.innerHTML = '';
  });

  // 1.7 Equipes
  $('#eqNaoPrevisto').checked = !!(d.equipes?.naoPrevisto);
  (d.equipes?.linhas || []).forEach(addRowEq);

  // 1.8 EM
  $('#emNaoPrevisto').checked = !!(d.embarqueMateriais?.naoPrevisto);
  (d.embarqueMateriais?.linhas || []).forEach(addRowEM);

  // 1.9 DM
  $('#dmNaoPrevisto').checked = !!(d.desembarqueMateriais?.naoPrevisto);
  (d.desembarqueMateriais?.linhas || []).forEach(addRowDM);

  // 1.10 OM
  $('#omNaoPrevisto').checked = !!(d.osMobilizacao?.naoPrevisto);
  (d.osMobilizacao?.linhas || []).forEach(addRowOM);

  applyPortoVisibility();

}

async function salvarPorto_17a110(psId){
  // Upload de anexos das linhas, se houver
  async function maybeUploadRow(fileEl){
    if (!fileEl || !fileEl.files || fileEl.files.length === 0) return null;
    const up = await api.uploadAnexo(psId, fileEl.files[0]);
    if (up && up.ok && up.path) return up.path;
    throw new Error('Falha no upload de anexo em linha');
  }

  // monta arrays
  const eq = Array.from(document.querySelectorAll('#tblEq tbody tr')).map(tr=>({
    Tipo: tr.querySelector('.eq-tipo')?.value || null,
    Empresa: tr.querySelector('.eq-empresa')?.value || null,
    Nome: tr.querySelector('.eq-nome')?.value || null,
    Observacoes: tr.querySelector('.eq-obs')?.value || null
  }));

  const em = [];
  for (const tr of Array.from(document.querySelectorAll('#tblEM tbody tr'))){
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
  for (const tr of Array.from(document.querySelectorAll('#tblDM tbody tr'))){
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
  for (const tr of Array.from(document.querySelectorAll('#tblOM tbody tr'))){
    const path = await maybeUploadRow(tr.querySelector('.om-file')) || (tr.dataset.anexopath || null);
    om.push({
      OS: tr.querySelector('.om-os')?.value || null,
      Descricao: tr.querySelector('.om-desc')?.value || null,
      Observacoes: tr.querySelector('.om-obs')?.value || null,
      AnexoPath: path
    });
  }

  const body = {
    equipes: { naoPrevisto: $('#eqNaoPrevisto').checked, linhas: eq },
    embarqueMateriais: { naoPrevisto: $('#emNaoPrevisto').checked, linhas: em },
    desembarqueMateriais: { naoPrevisto: $('#dmNaoPrevisto').checked, linhas: dm },
    osMobilizacao: { naoPrevisto: $('#omNaoPrevisto').checked, linhas: om }
  };
  return api.portoListasSave(psId, body);
}

function aplicarLockPorto(){
  // Reaproveita a lógica já aplicada nos botões gerais:
  const canEdit = !($('#btnSalvar')?.disabled);
  const scope = document.querySelector('#sub-porto');
  if (!scope) return;
  scope.querySelectorAll('input, textarea, select, button').forEach(el=>{
    const isAdd = el.id && (el.id.startsWith('btnAdd') || el.id==='btnSalvarPorto');
    if (isAdd) el.disabled = !canEdit;
    else el.disabled = !canEdit;
  });
}





//-----------------------------------FISCAIS CADASTRO----------------------------
function renderFiscalList() {
  const sel = document.getElementById('cad_f_list');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— selecione —</option>';
  (FISCAIS || []).forEach(f => {
    const opt = document.createElement('option');
    opt.value = String(f.FiscalId);
    opt.textContent = `${(f.Chave||'').toString().padEnd(4,' ').slice(0,4)} - ${f.Nome}`;
    opt.dataset.tel = f.Telefone || '';
    sel.appendChild(opt);
  });
  if (cur && Array.from(sel.options).some(o=>o.value===cur)) sel.value = cur;
  updateFiscalButtons();
}

function updateFiscalButtons() {
  const sel = document.getElementById('cad_f_list');
  const hasSel = !!(sel && sel.value);
  const bEd = document.getElementById('btnFiscalEditar');
  const bEx = document.getElementById('btnFiscalExcluir');
  if (bEd) bEd.disabled = !hasSel;
  if (bEx) bEx.disabled = !hasSel;
}

function fiscalResetUI() {
  FISC_EDITING_ID = null;
  const n = document.getElementById('cad_f_nome'); if (n) n.value = '';
  const c = document.getElementById('cad_f_ch');   if (c) c.value = '';
  const t = document.getElementById('cad_f_tel');  if (t) t.value = '';

  const btnSave = document.getElementById('btnSaveFiscal');
  const btnEd   = document.getElementById('btnFiscalEditar');
  const btnEx   = document.getElementById('btnFiscalExcluir');
  const editBox = document.getElementById('fiscEditActions');
  const sel = document.getElementById('cad_f_list');
  if (btnSave) btnSave.style.display = '';
  if (btnEx)   btnEx.style.display   = '';
  if (btnEd)   { btnEd.style.display = ''; btnEd.disabled = true; }
  if (editBox) editBox.style.display = 'none';
  if (sel) sel.disabled = false;
  if (sel) sel.value = '';
  updateFiscalButtons();
}

function fiscalEnterEditMode(id, nome, chave, telefone) {
  FISC_EDITING_ID = id;
  const n = document.getElementById('cad_f_nome'); if (n) n.value = nome || '';
  const c = document.getElementById('cad_f_ch');   if (c) c.value = (chave||'').toString().slice(0,4);
  const t = document.getElementById('cad_f_tel');  if (t) t.value = telefone || '';

  const btnSave = document.getElementById('btnSaveFiscal');
  const btnEd   = document.getElementById('btnFiscalEditar');
  const btnEx   = document.getElementById('btnFiscalExcluir');
  const editBox = document.getElementById('fiscEditActions');
  const sel = document.getElementById('cad_f_list');
  if (btnSave) btnSave.style.display = 'none';
  if (btnEx)   btnEx.style.display   = 'none';
  if (btnEd)   btnEd.disabled        = true;
  if (editBox) editBox.style.display = 'flex';
  if (sel) sel.disabled = true;
}


async function onFiscalEditar(){
  const sel = document.getElementById('cad_f_list');
  if (!sel || !sel.value) return;
  const id = Number(sel.value);
  const it = (FISCAIS || []).find(f => f.FiscalId === id);
  if (!it) return;
  fiscalEnterEditMode(id, it.Nome, it.Chave, it.Telefone);
}

async function onFiscalConfirma(){
  const id = FISC_EDITING_ID;
  if (!id) return;

  const nome = document.getElementById('cad_f_nome')?.value?.trim() || '';
  const chave = document.getElementById('cad_f_ch')?.value?.trim() || '';
  const telefone = (document.getElementById('cad_f_tel')?.value || '').trim();
  
  if (!nome || !chave) { alert('Preencha Nome e Chave do Fiscal.'); return; }
  if (chave.length !== 4){ alert('Chave deve ter 4 caracteres.'); return; }
  if (telefone && telefone.length > 15){ alert('Telefone deve ter no máximo 15 caracteres.'); return; }

  const r = await fetch(`/api/fiscais/${id}`, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ Nome:nome, Chave:chave, Telefone:telefone })
  });
  const j = await r.json().catch(()=>({}));
  if (!r.ok){ alert(j.error || 'Falha ao salvar alterações'); return; }

  try { FISCAIS = await api.fiscais(); } catch(_) {}
  renderFiscalList();
  fiscalResetUI();
  // reabilita a combo após confirmar edição
  alert('Alterações salvas.');
}

function onFiscalCancela(){
  fiscalResetUI();
}

async function onFiscalExcluir(){
  const sel = document.getElementById('cad_f_list');
  if (!sel || !sel.value) return;
  const id = Number(sel.value);
  const it = (FISCAIS || []).find(f => f.FiscalId === id);
  const txt = it ? `${(it.Chave||'').toString().slice(0,4)}-${it.Nome}` : `ID ${id}`;

  const bSave = document.getElementById('btnSaveFiscal');
  const bEd   = document.getElementById('btnFiscalEditar');
  const bEx   = document.getElementById('btnFiscalExcluir');
  if (bSave) bSave.disabled = true;
  if (bEd)   bEd.disabled   = true;

  const ok = window.confirm(`Confirma a exclusão do fiscal ${txt}?`);
  if (!ok){
    if (bSave) bSave.disabled = false;
    if (bEd)   bEd.disabled   = false;
    updateFiscalButtons();
    return;
  }

  const r = await fetch(`/api/fiscais/${id}`, { method:'DELETE' });
  const j = await r.json().catch(()=>({}));
  if (!r.ok){
    alert(j.error || 'Falha ao excluir (verifique se há PS vinculadas).');
    if (bSave) bSave.disabled = false;
    if (bEd)   bEd.disabled   = false;
    updateFiscalButtons();
    return;
  }

  try { FISCAIS = await api.fiscais(); } catch(_) {}
  renderFiscalList();
  fiscalResetUI();
  const bSave2 = document.getElementById('btnSaveFiscal');
  if (bSave2) bSave2.disabled = false;
  alert('Fiscal excluído.');
}


//-----------------------------------PASSAGENS DE SERVIÇO CADASTRO----------------------------

function renderAdminPSList(){
  const sel = document.getElementById('admin_ps_list');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— selecione —</option>';
  ADMIN_PS.forEach(ps => {
    const papel = (ps.FiscalEmbarcandoId===CTX?.fiscalId) ? 'Embarque'
                : (ps.FiscalDesembarcandoId===CTX?.fiscalId) ? 'Desembarque' : '';
    const label = `[${ps.EmbarcacaoNome}] [${ps.PeriodoInicio} a ${ps.PeriodoFim}]` + (papel?` [${papel}]`:``);
    const opt = document.createElement('option');
    opt.value = String(ps.PassagemId);
    opt.textContent = label;
    sel.appendChild(opt);
  });
  if (cur && Array.from(sel.options).some(o=>o.value===cur)) sel.value = cur;
  updateAdminPSButtons();
}


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
  // (âncora = max(01/jan do ano da EMISSÃO, data do primeiro porto))
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


async function onNovaPS_Guard() {
  // limpa mensagem anterior
  const msg = document.getElementById('msgNovaPS');
  if (msg) msg.innerText = '';

  try {
    const lista = await api.listarPS(); // já existe no seu api
    const hasRasc = Array.isArray(lista) && lista.some(ps =>
      ps && ps.Status === 'RASCUNHO' && ps.FiscalDesembarcandoId === CTX?.fiscalId
    );

    if (hasRasc) {
      if (msg) msg.innerText = 'Já existe uma PS em rascunho para o usuario logado';
      // não abre o modal
      return;
    }
  } catch(_){ /* falha na checagem → segue fluxo atual */ }

  // sem rascunho → fluxo normal
  abrirModalNovaPS_forcado();
}



function preencherModalEmbarcacoes() {
  const sel = document.getElementById('selEmbNova');
  if (!sel) return;

  // limpa e repõe o placeholder
  sel.innerHTML = '<option value="">— selecione —</option>';

  // preenche usando a fonte já utilizada no projeto
  (EMB || []).forEach(e => {
    const opt = document.createElement('option');
    opt.value = String(e.EmbarcacaoId);
    opt.textContent = `${(e.TipoEmbarcacao || '').toString().padEnd(5, ' ').slice(0, 5)} ${e.Nome}`;
    sel.appendChild(opt);
  });

  // desabilita Confirmar até escolher algo
  const btnOK = document.getElementById('btnModalNovaConfirmar');
  if (btnOK) btnOK.disabled = true;
}




async function abrirModalNovaPS_forcado() {
  if (!EMB.length) { try { EMB = await api.embarcacoes(); } catch(_) {} }
  preencherModalEmbarcacoes();
  // reutiliza função existente para exibir o modal
  const sel = document.getElementById('selEmbNova');
  if (sel) {
    sel.onchange = () => {
      const btnOK = document.getElementById('btnModalNovaConfirmar');
      if (btnOK) btnOK.disabled = !(sel && sel.value);
    };
  }
  abrirModalNovaPS(); // já existe no projeto
}


async function confirmarModalNovaPS() {
  const sel = document.getElementById('selEmbNova');
  const msg = document.getElementById('msgModalNovaPS');
  if (msg) msg.textContent = '';
  if (!sel || !sel.value) return;

  // chama o fluxo já existente, apenas informando a embarcação escolhida
  await novaPS(Number(sel.value));  // novaPS será ajustada para aceitar embId (item 3)

  // fecha o modal somente se a aba "Passagem" estiver ativa (sucesso)
  const passTab = document.getElementById('tab-passagem');
  if (passTab && passTab.classList.contains('active')) {
    fecharModalNovaPS(); // já existe no projeto
  } else {
    // Em caso de erro (ex.: rascunho existente), a mensagem já é exibida no span original (#msgNovaPS)
    // Opcional: espelhar em msgModalNovaPS, se desejar, SEM remover o comportamento atual.
    const spanLista = document.getElementById('msgNovaPS'); // já existe na tela Consultas
    if (spanLista && spanLista.textContent && msg) {
      msg.textContent = spanLista.textContent;
    }
  }
}









async function onAdminPSDelete(){
  const sel = document.getElementById('admin_ps_list');
  if (!sel || !sel.value) return;
  const id = Number(sel.value);
  const item = ADMIN_PS.find(p=>p.PassagemId===id);
  const txt = item ? `[${item.EmbarcacaoNome}] ${item.PeriodoInicio} a ${item.PeriodoFim}` : `ID ${id}`;
  const btn = document.getElementById('btnAdminPSDelete');
  if (btn) btn.disabled = true;
  const ok = window.confirm(`Confirma excluir a PS ${txt}? Esta ação é permanente.`);
  if (!ok){ if (btn) btn.disabled=false; return; }

  const r = await api.adminExcluirPS(id);
  if (r && r.error){
    alert(r.error);
    if (btn) btn.disabled=false;
    return;
  }
  // Atualiza a lista admin e a lista "Minhas PS" da tela de Consultas
  await adminLoadPS();
  try{ await buscar(); }catch(_){}
  alert('PS excluída.');
}


function updateAdminPSButtons(){
  const sel = document.getElementById('admin_ps_list');
  const btn = document.getElementById('btnAdminPSDelete');
  if (btn) btn.disabled = !(sel && sel.value);
}

async function adminLoadPS(){
  try{
    ADMIN_PS = await api.adminListarPS();
    if (!Array.isArray(ADMIN_PS)) ADMIN_PS = [];
  }catch(_){ ADMIN_PS = []; }
  renderAdminPSList();
}


function applyDesembarcanteLock() {
  const el = document.getElementById('fDesCNome');
  if (!el) return;

  if (isWindowsAuth()) {
    // usa o nome do usuário logado vindo do /api/me
    const nomeLogado = (CTX && (CTX.nome || CTX.fiscalNome)) || '';
    if (nomeLogado) el.value = nomeLogado;
    el.readOnly = true;             // não editável em modo Windows
    el.setAttribute('aria-readonly','true');
  } else {
    // modo manual: liberado para digitar
    el.readOnly = false;
    el.removeAttribute('aria-readonly');
    if (!el.value) el.placeholder = 'Digite o nome conforme cadastro';
  }
}
function renderEmbList() {
  const sel = document.getElementById('cad_e_list');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— selecione —</option>';
  EMB.forEach(e => {
    const opt = document.createElement('option');
    opt.value = String(e.EmbarcacaoId);
    opt.textContent = `${(e.TipoEmbarcacao||'').toString().padEnd(5,' ').slice(0,5)} ${e.Nome}`;
    sel.appendChild(opt);
  });
  // tenta manter seleção
  if (cur && Array.from(sel.options).some(o => o.value === cur)) sel.value = cur;
  updateEmbButtons();
}

// === Embarcações: habilita/desabilita botões conforme seleção ===
function updateEmbButtons() {
  const $list       = document.getElementById('cad_e_list');
  const hasSel      = !!($list && $list.value && $list.value !== ''); // FiscalId/EmbarcacaoId selecionado
  const $btnEditar  = document.getElementById('btnEmbEditar');
  const $btnExcluir = document.getElementById('btnEmbExcluir');

  if ($btnEditar)  $btnEditar.disabled  = !hasSel;
  if ($btnExcluir) $btnExcluir.disabled = !hasSel;
}


function embResetUI(){
  EMB_EDITING_ID = null;
  embSetEditing(false);
  const n = document.getElementById('cad_e_nome');     if (n) n.value = '';
  const p = document.getElementById('cad_e_primeira'); if (p) p.value = '';
  const t = document.getElementById('cad_e_tipo');     if (t) t.value = '';
  // limpa seleção
  const sel = document.getElementById('cad_e_list');
  if (sel) sel.value = '';

  updateEmbButtons();
}

function embEnterEditMode(id, nome, primeiraEntradaPorto, tipoEmbarcacao) {
  try {
    // Preenchimento dos inputs (IDs já usados no projeto)
    const $nome    = document.getElementById('cad_e_nome');
    const $primeira= document.getElementById('cad_e_primeira');   // data (AAAA-MM-DD)
    const $tipo    = document.getElementById('cad_e_tipo');

    if ($nome)     $nome.value     = (nome ?? '').toString();
    if ($primeira) $primeira.value = (primeiraEntradaPorto ?? '').toString();
    if ($tipo)     $tipo.value     = (tipoEmbarcacao ?? '').toString();

    // Guarda o ID em atributo data-* para uso pelo Confirmar
    const $root = document.getElementById('cad_embarcacoes_root') || document.body;
    $root.dataset.embEditingId = String(id);

    // Ajuste de visibilidade/estado dos botões (espelha fluxo de Fiscais)
    const hide  = el => el && (el.style.display = 'none');
    const show  = el => el && (el.style.display = '');
    const dis   = (el, v=true) => el && (el.disabled = v);

    const $btnSalvar   = document.getElementById('btnSaveEmb');
    const $btnEditar   = document.getElementById('btnEmbEditar');
    const $btnExcluir  = document.getElementById('btnEmbExcluir');
    const $btnConfirma = document.getElementById('btnEmbConfirma');
    const $btnCancela  = document.getElementById('btnEmbCancela');

    hide($btnSalvar);
    hide($btnExcluir);
    dis($btnEditar, true);
    show($btnConfirma);
    show($btnCancela);
  } catch (err) {
    console.error('embEnterEditMode error:', err);
    alert('Não foi possível entrar no modo de edição da embarcação.');
  }
}


function setTab(id){
  document.getElementById("msgNovaPS").innerText = "";
  const leavingCad = !document.getElementById(`tab-${id}`)?.classList.contains('active')
                     && document.getElementById('tab-cadastros')?.classList.contains('active');
  $$('.tablink').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $$('.tab').forEach(t=>t.classList.toggle('active', t.id===`tab-${id}`));
  // se saiu de Cadastros, reseta o estado de edição/exclusão
  if (id === 'cadastros') {
    renderFiscalList();
    renderEmbList();
  } else {
    fiscalResetUI();
    embResetUI(); 
    }
  }

function setSub(id){
  $$('.sublink').forEach(b=>b.classList.toggle('active', b.dataset.sub===id));
  $$('.subtab').forEach(t=>t.classList.toggle('active', t.id===`sub-${id}`));
}
function setUser(name){ $('#userName').textContent = name || ''; }

function renderLista(items){
  const list = $('#listaPS');
  list.innerHTML = '';
  for (const ps of items){
    const li = document.createElement('li');
    const papel = (ps.FiscalEmbarcandoId===CTX?.fiscalId) ? 'Embarque'
             : (ps.FiscalDesembarcandoId===CTX?.fiscalId) ? 'Desembarque' : '';
    // monta numero/ano - embarcação
    const ano = ps.DataEmissao ? new Date(ps.DataEmissao).getFullYear() : '----';
    const numero = ps.NumeroPS || ps.PassagemId || '---';

    li.innerHTML = `
      <div><strong>${numero} - ${ps.EmbarcacaoNome}</strong></div>
      <div class="tag">${ps.PeriodoInicio} a ${ps.PeriodoFim}</div>
      <div>${papel} - ${ps.DataEmissao}</div>
      <div>Status: <strong>${ps.Status}</strong></div>
    `;

    // clique abre a aba Passagem e carrega a PS correspondente
    li.onclick = () => {
      setTab('passagem');
      carregarPS(ps.PassagemId);
    };

    list.appendChild(li);
  }
}


function opt(v,t){ const o=document.createElement('option'); o.value=v; o.textContent=t; return o; }
function togglePsForm(show){ $('#psPlaceholder').classList.toggle('hidden', show); $('#psForm').classList.toggle('hidden', !show); }

async function carregarPS(id){
  const ps = await api.ps(id); if (ps.error){ alert(ps.error); return; }
  CUR_PS = ps; togglePsForm(true);
  $('#fNumero').value = ps.NumeroPS || ps.PassagemId || '';
  $('#fData').value = ps.DataEmissao || '';
  $('#fInicioPS').value = ps.PeriodoInicio;
  $('#fFimPS').value = ps.PeriodoFim;
  $('#fStatus').value = ps.Status;

  const embSel = $('#fEmb'); embSel.innerHTML=''; EMB.forEach(e=>embSel.appendChild(opt(e.EmbarcacaoId, e.Nome))); embSel.value = ps.EmbarcacaoId;
  $('#fEmb').disabled = true;   

  const embCF = $('#fEmbC'); embCF.innerHTML=''; FISCAIS.forEach(f=>embCF.appendChild(opt(f.FiscalId, `${f.Chave}-${f.Nome}`))); if (ps.FiscalEmbarcandoId) embCF.value = ps.FiscalEmbarcandoId;
  $('#fDesCNome').value = ps.FiscalDesembarcandoNome || '';
   
  



  const canEdit = (ps.Status==='RASCUNHO') &&
    (new Date() <= new Date(new Date(ps.PeriodoFim).getTime()+24*60*60*1000)) &&
    (ps.FiscalDesembarcandoId===CTX.fiscalId);
  ['#fNumero','#fData','#fInicioPS','#fFimPS','#fEmbC','#fDesCNome'].forEach(sel => $(sel).disabled = !canEdit);
  $('#btnSalvar').disabled = !canEdit;
  $('#btnFinalizar').disabled = !canEdit;
  $('#btnCopiar').disabled = !(ps.Status==='FINALIZADA' && ps.FiscalEmbarcandoId===CTX.fiscalId);
  $('#btnExcluirRasc').disabled = !(ps.Status === 'RASCUNHO');
  applyDesembarcanteLock(); // <-- acrescentar aqui
  carregarPorto_11a16(ps.PassagemId);
  carregarPorto_17a110(ps.PassagemId).then(()=> aplicarLockPorto());
} 




async function saveEmbarcacao() {
  const Nome = document.getElementById('cad_e_nome')?.value?.trim();
  const PrimeiraEntradaPorto = document.getElementById('cad_e_primeira')?.value || null; // yyyy-mm-dd
  const TipoEmbarcacao = document.getElementById('cad_e_tipo')?.value?.trim() || null;

  if (!Nome) { alert('Informe o tipo,nome e data da primeiro porto da embarcação.'); return; }
  if (TipoEmbarcacao && TipoEmbarcacao.length > 10) {
    alert('Tipo da Embarcação deve ter no máximo 10 caracteres.');
    return;
  }

  try {
    const r = await fetch('/api/embarcacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Nome, PrimeiraEntradaPorto, TipoEmbarcacao })
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error || 'Erro ao salvar'); return; }

    // limpa inputs
    document.getElementById('cad_e_nome').value = '';
    document.getElementById('cad_e_primeira').value = '';
    document.getElementById('cad_e_tipo').value = '';

    // recarrega lista
    try { EMB = await api.embarcacoes(); } catch(_) {}
    if (typeof renderEmbList === 'function') renderEmbList();

    alert('Embarcação salva.');
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
}


async function salvarPS(){
  if (!CUR_PS) return;
  const payload = {
    NumeroPS: $('#fNumero').value || null,
    DataEmissao: $('#fData').value || null,
    PeriodoInicio: $('#fInicioPS').value,
    PeriodoFim: $('#fFimPS').value,
    EmbarcacaoId: Number($('#fEmb').value),
    FiscalEmbarcandoId: $('#fEmbC').value? Number($('#fEmbC').value): null
  };
  const r = await api.salvarPS(CUR_PS.PassagemId, payload);
  if (r.error){ alert(r.error); return; }
  alert('Rascunho salvo.');
  await carregarPS(CUR_PS.PassagemId);
  await buscar();
}

async function finalizarPS(){
  if (!CUR_PS) return;
  const r = await api.finalizar(CUR_PS.PassagemId);
  if (r.error){ alert(r.error); return; }
  alert('Finalizada. PDF em: '+r.pdfPath);
  await carregarPS(CUR_PS.PassagemId);
  await buscar();
}

async function copiarPS(){
  if (!CUR_PS) return;
  const r = await api.copiar(CUR_PS.PassagemId);
  if (r.error){ alert(r.error); return; }
  alert('Nova PS criada: '+r.NewPassagemId);
  await buscar();
  setTab('consultas');
}

async function excluirPSAtualRascunho(){
  if (!CUR_PS) return;

  const ok = window.confirm('Confirma a exclusão desta PS? Esta ação é permanente.');
  if (!ok) return;

  const r = await api.adminExcluirPS(CUR_PS.PassagemId);
  if (r && r.error){
    alert(r.error);
    return;
  }

  alert('Rascunho excluído.');
  await buscar();            // atualiza lista em Consultas
  setTab('consultas');       // volta para Consultas
  togglePsForm(false);       // esconde formulário
}





function abrirModalNovaPS(){
  document.getElementById("modalNovaPS").classList.remove("hidden");
  // ↓ DESATIVA “Início” e “Cadastros”
  const btnInicio   = document.querySelector('.topnav .tablink[data-tab="consultas"]');
  const btnCadastro = document.querySelector('.topnav .tablink[data-tab="cadastros"]');
  if (btnInicio)   btnInicio.disabled   = true;
  if (btnCadastro) btnCadastro.disabled = true;
}
function fecharModalNovaPS(){
  document.getElementById("modalNovaPS").classList.add("hidden");
  const btnInicio   = document.querySelector('.topnav .tablink[data-tab="consultas"]');
  const btnCadastro = document.querySelector('.topnav .tablink[data-tab="cadastros"]');
  if (btnInicio)   btnInicio.disabled   = false;
  if (btnCadastro) btnCadastro.disabled = false;
}


//async function novaPS(){
async function novaPS(embIdParam){
  if (!EMB.length){ 
    alert('Cadastre ao menos uma embarcação.'); 
    return; 
  }

  
  const embSel = document.getElementById('fEmb');
  //const embId = embSel && embSel.value ? Number(embSel.value) : EMB[0].EmbarcacaoId;
  const embId = (typeof embIdParam === 'number' && embIdParam > 0)
   ? embIdParam
   : (embSel && embSel.value ? Number(embSel.value) : EMB[0].EmbarcacaoId);
  const embarcacao = EMB.find(e => e.EmbarcacaoId === embId);

  if (!embarcacao || !embarcacao.PrimeiraEntradaPorto){
    alert('Embarcação sem data de primeiro porto cadastrada!');
    return;
  }

  // calcula a próxima PS com base no primeiro porto
  const dados = calcularProximaPS(embarcacao.PrimeiraEntradaPorto);

  // 🔹 Pré-preenche imediatamente os campos no formulário
  document.getElementById("fInicioPS").value = dados.inicio;
  document.getElementById("fFimPS").value    = dados.fim;
  document.getElementById("fData").value     = dados.emissao;
  document.getElementById("fNumero").value   = dados.numeroAno;

  // prepara o payload
  const payload = { 
    EmbarcacaoId: embId, 
    PeriodoInicio: dados.inicio, 
    PeriodoFim: dados.fim,
    DataEmissao: dados.emissao,
    NumeroPS: dados.numeroAno
  };

  if (isWindowsAuth()){
    const nomeWin = (CTX?.nome || CTX?.fiscalNome || '').trim();
    if (!nomeWin){
      alert('Erro de autenticação');
      return;
    }
    payload.FiscalDesembarcandoNome = nomeWin;
  } else {
    const nome = prompt('Fiscal que está desembarcando:');
    if (!nome) return;
    payload.FiscalDesembarcandoNome = nome.trim();
  }

  const r = await api.criarPS(payload);
 if (r && typeof r.error === "string"){ 
  if (r.error.toUpperCase().includes("RASCUNHO")){
    document.getElementById("msgNovaPS").innerText = r.error;
  } else {
    alert(r.error);
  }
  return; 
}

// limpar mensagem caso não tenha erro
document.getElementById("msgNovaPS").innerText = "";

  await buscar();
  await carregarPS(r.PassagemId);
  setTab('passagem');
}



function embSetEditing(on){
  const $ = id => document.getElementById(id);

  const bSave   = $('btnSaveEmb');
  const bEdit   = $('btnEmbEditar');
  const bDel    = $('btnEmbExcluir');
  const bOk     = $('btnEmbConfirma');
  const bCancel = $('btnEmbCancela');
  const boxEdit = $('embEditActions');           // << container dos botões de edição

  // 1) Visibilidade (display)
  if (bSave)   bSave.style.display   = on ? 'none' : '';
  if (bDel)    bDel.style.display    = on ? 'none' : '';
  if (bOk)     bOk.style.display     = on ? '' : 'none';
  if (bCancel) bCancel.style.display = on ? '' : 'none';
  if (boxEdit) boxEdit.style.display = on ? 'flex' : 'none';  // << TORNAR CONTAINER VISÍVEL EM EDIÇÃO


  // 2) Habilitação (disabled)
  if (bSave)   bSave.disabled   = on;     // em edição: desativa Salvar
  if (bDel)    bDel.disabled    = on;     // em edição: desativa Excluir
  if (bEdit)   bEdit.disabled   = on;     // em edição: desativa Editar
  if (bOk)     bOk.disabled     = !on;    // Confirmar só habilitado em edição
  if (bCancel) bCancel.disabled = !on;    // Cancelar só habilitado em edição
}



function onEmbEditar(){
  const sel = document.getElementById('cad_e_list');
  if (!sel || !sel.value) return;
  const id = Number(sel.value);
  const it = (EMB||[]).find(e => e.EmbarcacaoId === id);
  if (!it) return;

  EMB_EDITING_ID = id;
  document.getElementById('cad_e_nome').value = it.Nome || '';
  document.getElementById('cad_e_primeira').value = it.PrimeiraEntradaPorto ? String(it.PrimeiraEntradaPorto).slice(0,10) : '';
  document.getElementById('cad_e_tipo').value = it.TipoEmbarcacao || '';

  embSetEditing(true); // ← AQUI é onde os botões Salvar/Excluir ficam inativos
}

// Confirmar (salvar alterações)

async function onEmbConfirma() {
 const id = EMB_EDITING_ID; // ou a sua variável correspondente
  if (!id) return;

  const Nome = document.getElementById('cad_e_nome')?.value?.trim();
  const PrimeiraEntradaPorto = document.getElementById('cad_e_primeira')?.value || null; // yyyy-mm-dd
  const TipoEmbarcacao = document.getElementById('cad_e_tipo')?.value?.trim();

  if (!Nome) { alert('Informe o Nome da embarcação.'); return; }
  if (TipoEmbarcacao && TipoEmbarcacao.length > 20) {
    alert('Tipo da Embarcação deve ter no máximo 20 caracteres.');
    return;
  }

  const r = await fetch(`/api/embarcacoes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Nome, PrimeiraEntradaPorto, TipoEmbarcacao })
  });
  const j = await r.json().catch(()=>({}));
  if (!r.ok) { alert(j.error || 'Falha ao salvar alterações'); return; }

  // recarrega a lista e restaura UI
  try { EMB = await api.embarcacoes(); } catch(_) {}
  if (typeof renderEmbList === 'function') renderEmbList();

  // limpar campos e restaurar botões (use suas funções utilitárias existentes)
  document.getElementById('cad_e_primeira').value = '';
  document.getElementById('cad_e_tipo').value = '';
  document.getElementById('cad_e_nome').value = '';
  embResetUI();
  renderEmbList();
  alert('Alterações salvas.');
}

// Cancelar edição
function onEmbCancela() {
  embResetUI();
}

// Excluir embarcação
async function onEmbExcluir() {
  const sel = document.getElementById('cad_e_list');
  if (!sel || !sel.value) return;
  const id = Number(sel.value);
  const it = EMB.find(e => e.EmbarcacaoId === id);
  if (!it) return;

  // desativa botões enquanto a caixa de diálogo está aberta
  const btnSave = document.getElementById('btnSaveEmb');
  const btnEd   = document.getElementById('btnEmbEditar');
  const btnEx   = document.getElementById('btnEmbExcluir');
  if (btnSave) btnSave.disabled = true;
  if (btnEd)   btnEd.disabled   = true;

  const ok = window.confirm(`Confirma a exclusão da embarcação "${it.Nome}"?`);
  if (!ok) {
    if (btnSave) btnSave.disabled = false;
    if (btnEd)   btnEd.disabled   = false;
    updateEmbButtons();
    return;
  }

  // DELETE /api/embarcacoes/:id
  const r = await fetch(`/api/embarcacoes/${id}`, { method: 'DELETE' });
  const j = await r.json().catch(()=>({}));
  if (!r.ok) {
    alert(j.error || 'Falha ao excluir. Verifique se não há PS vinculadas.');
    if (btnSave) btnSave.disabled = false;
    if (btnEd)   btnEd.disabled   = false;
    updateEmbButtons();
    return;
  }

  // refresh lista e UI
  try { EMB = await api.embarcacoes(); } catch(_) {}
  renderEmbList();
  embResetUI();
  alert('Embarcação excluída.');
}


async function buscar(){
  
  const itens = await api.listarPS($('#fInicio').value, $('#fFim').value);
  renderLista(itens);
}

// --- [ACRÉSCIMO] Salvamento de Fiscais ---
async function saveFiscal(){
  const nome = document.getElementById('cad_f_nome')?.value?.trim();
  const chave = document.getElementById('cad_f_ch')?.value?.trim();
  const telefone = document.getElementById('cad_f_tel')?.value?.trim();

  if (!nome || !chave) { alert('Preencha Nome e Chave.'); return; }
  if (chave.length !== 4) { alert('Chave deve ter 4 caracteres.'); return; }
  if (telefone && telefone.length > 15) { alert('Telefone deve ter no máximo 15 caracteres.'); return; }

  const r = await fetch('/api/fiscais', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ Nome:nome, Chave:chave, Telefone:telefone || '' })
  });
  const j = await r.json();
  if (!r.ok) { alert(j.error || 'Erro ao salvar'); return; }

  // Limpa campos e (se existir) recarrega a lista local
  document.getElementById('cad_f_nome').value = '';
  document.getElementById('cad_f_ch').value = '';
  document.getElementById('cad_f_tel').value = '';

  try {
    if (typeof api?.fiscais === 'function') {
      // mantém compatibilidade com seu carregamento atual
      FISCAIS = await api.fiscais();
    }
  } catch (_) {}
  alert('Fiscal salvo.');
  renderFiscalList();

};

// Binder discreto sem interferir no restante

// === Embarcações: binds de UI (lista e botões) ===
// Observação: as funções de ação (onEmbSalvar/Editar/Excluir/Confirmar/Cancelar)
// já existem no projeto. Aqui apenas conectamos os eventos.
document.addEventListener('DOMContentLoaded', () => {
  const $list       = document.getElementById('cad_e_list');
  const $btnSalvar  = document.getElementById('btnSaveEmb');
  const $btnEditar  = document.getElementById('btnEmbEditar');
  const $btnExcluir = document.getElementById('btnEmbExcluir');
  const $btnConf    = document.getElementById('btnEmbConfirma');
  const $btnCanc    = document.getElementById('btnEmbCancela');

  if ($list) {
    // Habilita/desabilita Editar/Excluir conforme seleção
    $list.addEventListener('change', updateEmbButtons);
    // Inicializa estado ao carregar
    updateEmbButtons();
  }

  if ($btnSalvar && typeof onEmbSalvar === 'function') {
    $btnSalvar.addEventListener('click', onEmbSalvar);
  }
  if ($btnEditar && typeof onEmbEditar === 'function') {
    $btnEditar.addEventListener('click', onEmbEditar);
  }
  if ($btnExcluir && typeof onEmbExcluir === 'function') {
    $btnExcluir.addEventListener('click', onEmbExcluir);
  }
  if ($btnConf && typeof onEmbConfirma === 'function') {
    $btnConf.addEventListener('click', onEmbConfirma);
  }
  if ($btnCanc && typeof onEmbCancela === 'function') {
    $btnCanc.addEventListener('click', onEmbCancela);
  }
});





document.addEventListener('DOMContentLoaded', () => {
  const selF = document.getElementById('cad_f_list');
  if (selF) selF.addEventListener('change', updateFiscalButtons);

  const bEdF = document.getElementById('btnFiscalEditar');
  if (bEdF) bEdF.addEventListener('click', onFiscalEditar);

  const bExF = document.getElementById('btnFiscalExcluir');
  if (bExF) bExF.addEventListener('click', onFiscalExcluir);

  const bOkF = document.getElementById('btnFiscalConfirma');
  if (bOkF) bOkF.addEventListener('click', onFiscalConfirma);

  const bNoF = document.getElementById('btnFiscalCancela');
  if (bNoF) bNoF.addEventListener('click', onFiscalCancela);
});

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnSaveFiscal');
  if (btn) btn.addEventListener('click', saveFiscal);
});




document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('admin_ps_list');
  if (sel) sel.addEventListener('change', updateAdminPSButtons);
  const del = document.getElementById('btnAdminPSDelete');
  if (del) del.addEventListener('click', onAdminPSDelete);
});


document.addEventListener('DOMContentLoaded', () => {
  const btnEmb = document.getElementById('btnSaveEmb');
  if (btnEmb) btnEmb.addEventListener('click', saveEmbarcacao);
});



// Events
$$('.tablink').forEach(b => b.onclick = ()=> setTab(b.dataset.tab));
$$('.sublink').forEach(b => b.onclick = ()=> setSub(b.dataset.sub));
$('#btnBuscar').onclick = buscar;
//$('#btnNova').onclick = novaPS;
$('#btnNova').onclick = onNovaPS_Guard;
$('#btnSalvar').onclick = salvarPS;
$('#btnFinalizar').onclick = finalizarPS;
$('#btnCopiar').onclick = copiarPS;
$('#btnModalNovaCancelar').onclick  = fecharModalNovaPS;
$('#btnModalNovaConfirmar').onclick = confirmarModalNovaPS;
$('#btnExcluirRasc').onclick = excluirPSAtualRascunho;


// PORTO — binds
$('#btnAddEq')   && ($('#btnAddEq').onclick   = ()=> addRowEq());
$('#btnAddEM')   && ($('#btnAddEM').onclick   = ()=> addRowEM());
$('#btnAddDM')   && ($('#btnAddDM').onclick   = ()=> addRowDM());
$('#btnAddOM')   && ($('#btnAddOM').onclick   = ()=> addRowOM());
$('#btnSalvarPorto') && ($('#btnSalvarPorto').onclick = async ()=>{
  if (!CUR_PS) return;
  try{
    const r1 = await salvarPorto_11a16(CUR_PS.PassagemId);
    if (r1 && r1.error) throw new Error(r1.error);
    const r2 = await salvarPorto_17a110(CUR_PS.PassagemId);
    if (r2 && r2.error) throw new Error(r2.error);
    document.getElementById('msgSalvarPorto').textContent = 'PORTO salvo com sucesso.';
  }catch(e){
    document.getElementById('msgSalvarPorto').textContent = 'Falha ao salvar PORTO: ' + (e.message||e);
  }
});

function applyPortoVisibilityLists(){
  const pairs = [
    {chk:'#eqNaoPrevisto', tbl:'#tblEq', btn:'#btnAddEq'},
    {chk:'#emNaoPrevisto', tbl:'#tblEM', btn:'#btnAddEM'},
    {chk:'#dmNaoPrevisto', tbl:'#tblDM', btn:'#btnAddDM'},
    {chk:'#omNaoPrevisto', tbl:'#tblOM', btn:'#btnAddOM'},
  ];
  pairs.forEach(p=>{
    const chk = document.querySelector(p.chk);
    const tbl = document.querySelector(p.tbl);
    const btn = document.querySelector(p.btn);
    const on = !!(chk && chk.checked);
    if (tbl){ 
      tbl.style.display = on ? 'none' : '';
      // desabilita/habilita todos os inputs da tabela
      tbl.querySelectorAll('input, textarea, select, button').forEach(el=> el.disabled = on);
    }
    if (btn){ btn.style.display = on ? 'none' : ''; btn.disabled = on; }
  });
}

// listeners de mudança nas 4 checkboxes:
['#eqNaoPrevisto','#emNaoPrevisto','#dmNaoPrevisto','#omNaoPrevisto'].forEach(sel=>{
  const el = document.querySelector(sel);
  if (el) el.addEventListener('change', applyPortoVisibilityLists);
});



// Ao trocar a sub-aba, carregar dados do PORTO
const _prevSetSub = setSub;
setSub = function(id){
  _prevSetSub(id);
  if (id==='porto' && CUR_PS){
    carregarPorto_11a16(CUR_PS.PassagemId);
    carregarPorto_17a110(CUR_PS.PassagemId).then(()=> aplicarLockPorto());
  }
};
// Fim PORTO — binds


// Login modal
const modal = $('#loginModal');
$('#btnLogout').onclick = async ()=>{ await api.logout(); location.reload(); };
$('#btnLogin').onclick = async ()=>{
  const nome = $('#loginNome').value.trim();
  if (!nome){ $('#loginMsg').textContent = 'Informe seu nome'; return; }
  const r = await api.loginManual(nome);
  if (r.error){ $('#loginMsg').textContent = r.error; return; }
  modal.classList.add('hidden');
  await bootAfterAuth();
};
// Fim Login modal

// Novo boot que chama após o login manual
async function bootAfterAuth(){
  const me = await api.me();
  if (me.error){ $('#loginMsg').textContent = me.error; modal.classList.remove('hidden'); return; }
  AUTH_MODE = me.mode || 'manual';
  CTX = me.me; setUser(CTX?.nome || '');
  applyDesembarcanteLock(); // <-- aplica logo após sabermos o modo e o usuário
  EMB = await api.embarcacoes();
  renderEmbList();
  FISCAIS = await api.fiscais(); 
  renderFiscalList();
  refreshUserPhoto();
  await adminLoadPS();
  await buscar();
}// Fim boot após login manual


// Boot inicial
async function boot(){
  const me = await api.me();
  if (me.mode==='manual' && me.error){
    modal.classList.remove('hidden');
    return;
  }
  if (me.mode==='windows' && me.error){
    document.body.innerHTML = '<div style="padding:20px;color:#b00">Usuário Windows não cadastrado na lista de fiscais. Contate o administrador.</div>';
    return;
  }
  if (me.me){
    AUTH_MODE = me.mode || 'manual';            // <-- NOVO
    CTX = me.me; setUser(CTX?.nome || '');
    applyDesembarcanteLock();                   // <-- NOVO
    EMB = await api.embarcacoes();
    renderEmbList();
    FISCAIS = await api.fiscais(); 
    renderFiscalList();
    await adminLoadPS();
    await buscar();
  }
}

// Foto do usuário (pega de /api/me/photo). Se não houver, mantém escondido.
function refreshUserPhoto() {
  const img = document.getElementById('userPhoto');
  if (!img) return;
  img.onerror = () => { img.style.display = 'none'; };
  img.onload  = () => { img.style.display = 'inline-block'; };
  // cache-buster pra não ficar imagem antiga
  img.src = '/api/me/photo?t=' + Date.now();
}

// chama após a página subir (sem interferir no seu bootstrap atual)
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(refreshUserPhoto, 150);
});




boot();
