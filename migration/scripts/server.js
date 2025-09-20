import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fb from 'node-firebird-driver-native';
import dayjs from 'dayjs';
import PDFDocument from 'pdfkit';
import multer from 'multer';
const {createPool} = fb

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false
}));

app.use('/assets', express.static(path.resolve(__dirname, '../../client/assets')));
app.use('/', express.static(path.resolve(__dirname, '../../client')));

const pool = createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3050),
  // Em Firebird, "database" é o alias ou o caminho completo do .fdb
  database: process.env.DB_NAME, 
  user: process.env.DB_USER || 'SYSDBA',
  password: process.env.DB_PASS || 'masterkey',
});

// === ADAPTADOR DE COMPATIBILIDADE PARA pool.query (estilo mysql2) ===
// Mantém o contrato: await pool.query(sql, params) -> [rows, meta]
//  - rows: array de objetos (SELECT etc.)
//  - meta: { affectedRows, insertId, raw }
// Permite destruturações como: const [[row]] = await pool.query(...);

if (typeof pool.query !== 'function') {
  pool.query = async (sql, params = []) => {
    const conn = await pool.getConnection();
    try {
      // node-firebird-driver-native aceita execute(sql, params)
      const result = await conn.execute(sql, params);
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      const affected =
        (typeof result?.rowsAffected === 'number' ? result.rowsAffected : null) ??
        (typeof result?.count === 'number' ? result.count : 0);

      // Tenta inferir insertId quando houver INSERT ... RETURNING <id>
      let insertId = undefined;
      if (rows.length === 1 && rows[0] && typeof rows[0] === 'object') {
        const r = rows[0];
        // Procura chaves que pareçam ID (PASSAGEMID, FISCALID, ID, etc.)
        const key =
          Object.keys(r).find(k => /(^ID$|_ID$|ID$|ID\b|PASSAGEMID|FISCALID|EMBARCACAOID)/i.test(k)) ||
          Object.keys(r).find(k => /ID/i.test(k));
        if (key) insertId = r[key];
      }

      const meta = {
        affectedRows: affected ?? 0,
        insertId: insertId,
        raw: result, // se precisar depurar algo específico do driver
      };

      return [rows, meta];
    } finally {
      await conn.dispose();
    }
  };
}

if (typeof pool.execute !== 'function') {
  pool.execute = (sql, params = []) => pool.query(sql, params);
}


const STORAGE_DIR = process.env.STORAGE_DIR || './storage';
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
function ensurePsDir(id){
  const d = path.resolve(STORAGE_DIR, 'PS', String(id));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// FOTO DO USUÁRIO WINDOWS (ESM)
app.get('/api/me/photo', requireAuth, async (req, res) => {
  try {
    // 1) Foto do perfil do usuário logado (quando Node roda na sessão do usuário)
    const home   = os.homedir();
    const accDir = path.join(home, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'AccountPictures');
    let candidate = null;

    if (fs.existsSync(accDir)) {
      const entries = fs.readdirSync(accDir)
        .filter(f => f.toLowerCase().endsWith('.png'))
        .map(f => {
          const full = path.join(accDir, f);
          const st = fs.statSync(full);
          return { full, size: st.size, mtime: st.mtimeMs };
        })
        .sort((a, b) => (b.mtime - a.mtime) || (b.size - a.size));
      if (entries.length) candidate = entries[0].full;
    }

    // 2) Fallback padrão do Windows
    if (!candidate && process.env.ProgramData) {
      const fallback = path.join(process.env.ProgramData, 'Microsoft', 'User Account Pictures', 'user.png');
      if (fs.existsSync(fallback)) candidate = fallback;
    }

    // 3) Fallback do app (opcional: coloque um avatar em client/assets/user.png)
    if (!candidate) {
      const appAvatar = path.join(__dirname, '..', '..', 'client', 'assets', 'user.png');
      if (fs.existsSync(appAvatar)) candidate = appAvatar;
    }

    if (candidate) return res.sendFile(candidate);
    return res.status(404).end();
  } catch (e) {
    console.error(e);
    return res.status(404).end();
  }
});



async function resolveFiscalByName(nome){
  const [rows] = await pool.query('SELECT FIRST 1 FiscalId, Nome, Chave, Telefone FROM Fiscais WHERE UPPER(Nome)=UPPER(?)', [nome]);
  return rows[0] || null;
}
const USE_WINDOWS_AUTH = String(process.env.USE_WINDOWS_AUTH||'false').toLowerCase() === 'true';
function getWindowsUser(){ return process.env.USERNAME || process.env.USER || null; }

async function requireAuth(req, res, next){
  try{
    if (!req.session.ctx){
      if (USE_WINDOWS_AUTH){
        const win = getWindowsUser();
        if (!win) return res.status(401).json({ error: 'Credencial Windows não disponível' });
        const fiscal = await resolveFiscalByName(win);
        if (!fiscal) return res.status(403).json({ error: 'Usuário Windows não cadastrado na lista de fiscais' });
        req.session.ctx = { login: win, nome: fiscal.Nome, fiscalId: fiscal.FiscalId };
      } else {
        return res.status(401).json({ error: 'Sessão não iniciada. Faça login manual.' });
      }
    }
    req.ctx = req.session.ctx;
    next();
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Auth error' });
  }
}

// POST /api/embarcacoes – cria uma embarcação
app.post('/api/embarcacoes', requireAuth, async (req, res) => {
  try {
    const { Nome, PrimeiraEntradaPorto, TipoEmbarcacao } = req.body || {};
    if (!Nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    if (TipoEmbarcacao && String(TipoEmbarcacao).length > 20)
      return res.status(400).json({ error: 'Tipo da Embarcação até 20 caracteres' });

    // normaliza data (aceita yyyy-mm-dd; se vier dd/mm/aaaa, converte)
    let dt = null;
    if (PrimeiraEntradaPorto) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(PrimeiraEntradaPorto)) dt = PrimeiraEntradaPorto;
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(PrimeiraEntradaPorto)) {
        const [d,m,y] = PrimeiraEntradaPorto.split('/');
        dt = `${y}-${m}-${d}`;
      }
    }

    //impedir nome duplicado
    const [dup] = await pool.query('SELECT FIRST 1 1 FROM embarcacoes WHERE LOWER(Nome)=LOWER(?)', [Nome.trim()]);

    if (dup.length) return res.status(409).json({ error: 'Já existe embarcação com este nome' });

    const connInsEmb = await pool.getConnection();
    let novoEmbId;
    try {
      const rsEmb = await connInsEmb.execute(
        'INSERT INTO EMBARCACOES (Nome, PrimeiraEntradaPorto, TipoEmbarcacao) VALUES (?,?,?) RETURNING EmbarcacaoId',
        [Nome.trim(), dt, TipoEmbarcacao || null]
      );
      novoEmbId = rsEmb?.rows?.[0]?.EMBARCACAOID ?? rsEmb?.rows?.[0]?.EmbarcacaoId;
    } finally {
      await connInsEmb.dispose();
    }


    const [rows] = await pool.query(
      'SELECT FIRST 1 EmbarcacaoId, Nome, PrimeiraEntradaPorto, TipoEmbarcacao FROM embarcacoes WHERE EmbarcacaoId=?',
      [novoEmbId]
    );

    res.json(rows[0]);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao criar embarcação' });
  }
});




app.post('/api/fiscais', requireAuth, async (req, res) => {
  try {
    const { Nome, Chave, Telefone } = req.body || {};
    if (!Nome || !Chave) return res.status(400).json({ error: 'Nome e Chave são obrigatórios' });
    if (typeof Chave !== 'string' || Chave.length !== 4) {
      return res.status(400).json({ error: 'Chave deve ter 4 caracteres' });
    }
    const tel = (Telefone || '').toString().slice(0, 15); // força limite 15

    // Evita duplicidade básica por Nome ou Chave
    const [dup] = await pool.query(
      'SELECT FIRST 1 1 FROM Fiscais WHERE Nome = ? OR Chave = ?',
      [Nome, Chave]
    );

    if (dup.length) return res.status(409).json({ error: 'Ja cadastrado' });

    const connInsFis = await pool.getConnection();
    let novoFisId;
    try {
      const rsFis = await connInsFis.execute(
        'INSERT INTO FISCAIS (Nome, Chave, Telefone) VALUES (?,?,?) RETURNING FiscalId',
        [Nome, Chave, tel]
      );
      novoFisId = rsFis?.rows?.[0]?.FISCALID ?? rsFis?.rows?.[0]?.FiscalId;
    } finally {
      await connInsFis.dispose();
    }
    return res.json({ ok: true, FiscalId: novoFisId });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao salvar' });
  }
});


app.post('/api/login-manual', async (req, res) => {
  if (USE_WINDOWS_AUTH) return res.status(400).json({ error: 'Login manual desativado em produção' });
  const { nome } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Informe seu nome completo' });
  const fiscal = await resolveFiscalByName(nome.trim());
  if (!fiscal) return res.status(403).json({ error: 'Usuário não cadastrado na lista de fiscais' });
  req.session.ctx = { login: nome.trim(), nome: fiscal.Nome, fiscalId: fiscal.FiscalId };
  res.json({ ok: true, me: req.session.ctx });
});

app.post('/api/logout', (req, res) => { req.session.destroy(()=> res.json({ ok:true })); });

app.get('/api/me', async (req, res) => {
  if (req.session?.ctx) return res.json({ mode: USE_WINDOWS_AUTH?'windows':'manual', me: req.session.ctx });
  if (USE_WINDOWS_AUTH){
    const win = getWindowsUser();
    if (!win) return res.status(401).json({ mode:'windows', error: 'Credencial Windows não disponível' });
    const fiscal = await resolveFiscalByName(win);
    if (!fiscal) return res.status(403).json({ mode:'windows', error: 'Usuário Windows não cadastrado' });
    const ctx = { login: win, nome: fiscal.Nome, fiscalId: fiscal.FiscalId };
    req.session.ctx = ctx;
    return res.json({ mode:'windows', me: ctx });
  }
  res.status(401).json({ mode:'manual', error: 'Sessão não iniciada' });
});

async function logEvent(passagemId, evento, descricao, detalhe, ctx){
  await pool.query(
    'INSERT INTO AuditLog (PassagemId, Evento, Descricao, AutorUser, AutorNome, Detalhe) VALUES (?,?,?,?,?,?)',
    [passagemId, evento, descricao, ctx?.login || '', ctx?.nome || '', detalhe || null]
  );
}

function canEdit(ps, ctx){
  const Status                 = ps.Status                 ?? ps.STATUS;
  const PeriodoFim             = ps.PeriodoFim             ?? ps.PERIODOFIM;
  const FiscalDesembarcandoId  = ps.FiscalDesembarcandoId  ?? ps.FISCALDESEMBARCANDOID;

  if (Status !== 'RASCUNHO') return false;
  const limite = dayjs(PeriodoFim).add(1,'day').endOf('day');
  if (dayjs().isAfter(limite)) return false;
  if (FiscalDesembarcandoId !== ctx.fiscalId) return false;
  return true;
}


app.get('/api/fiscais', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT FiscalId, Nome, Chave, Telefone FROM Fiscais ORDER BY Nome');
  res.json(rows);
});

app.get('/api/embarcacoes', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT EmbarcacaoId, Nome, PrimeiraEntradaPorto, TipoEmbarcacao FROM embarcacoes ORDER BY Nome'
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao listar embarcações' });
  }
});


app.get('/api/passagens', requireAuth, async (req, res) => {
  const { inicio, fim } = req.query;
  let sql = `
    SELECT p.*, 
       e.Nome AS "EmbarcacaoNome", 
       fe.Nome AS "FiscalEmbarcandoNome", 
       fd.Nome AS "FiscalDesembarcandoNome"
    FROM Passagens p
    JOIN Embarcacoes e ON e.EmbarcacaoId = p.EmbarcacaoId
    LEFT JOIN Fiscais fe ON fe.FiscalId = p.FiscalEmbarcandoId
    JOIN Fiscais fd ON fd.FiscalId = p.FiscalDesembarcandoId
    WHERE (p.FiscalEmbarcandoId = ? OR p.FiscalDesembarcandoId = ?)
    `;
  const params = [req.ctx.fiscalId, req.ctx.fiscalId];
  if (inicio){ sql += ' AND p.PeriodoInicio >= ?'; params.push(inicio); }
  if (fim){ sql += ' AND p.PeriodoFim <= ?'; params.push(fim); }
  sql += ' ORDER BY p.PeriodoInicio DESC';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

app.get('/api/passagens/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(`
    SELECT FIRST 1 p.*, e.Nome AS "EmbarcacaoNome", fe.Nome AS "FiscalEmbarcandoNome", fd.Nome AS "FiscalDesembarcandoNome"
    FROM Passagens p
    JOIN Embarcacoes e ON e.EmbarcacaoId = p.EmbarcacaoId
    LEFT JOIN Fiscais fe ON fe.FiscalId = p.FiscalEmbarcandoId
    JOIN Fiscais fd ON fd.FiscalId = p.FiscalDesembarcandoId
    WHERE p.PassagemId=?

  `,[id]);
  const ps = rows[0];
  if (!ps) return res.status(404).json({error:'PS não encontrada'});
  const FiscalEmbarcandoId    = ps.FiscalEmbarcandoId    ?? ps.FISCALEMBARCANDOID;
  const FiscalDesembarcandoId = ps.FiscalDesembarcandoId ?? ps.FISCALDESEMBARCANDOID; 
  if (FiscalEmbarcandoId !== req.ctx.fiscalId && FiscalDesembarcandoId !== req.ctx.fiscalId){
    return res.status(403).json({error:'Acesso negado'});
  }

  res.json(ps);
});







app.post('/api/passagens', requireAuth, async (req, res) => {
  try {
    const { NumeroPS, DataEmissao, PeriodoInicio, PeriodoFim, EmbarcacaoId, FiscalEmbarcandoId, FiscalDesembarcandoNome } = req.body;
    if (!EmbarcacaoId || !PeriodoInicio || !PeriodoFim || !FiscalDesembarcandoNome){
      return res.status(400).json({error:'Campos obrigatórios: EmbarcacaoId, PeriodoInicio, PeriodoFim, FiscalDesembarcandoNome'});
    }

    const desemb = await resolveFiscalByName(FiscalDesembarcandoNome);
    if (!desemb) return res.status(400).json({error:'Fiscal não cadastrado - Desembarque'});

    // fiscal desembarcando só pode ter 1 rascunho
    const [jaRascunho] = await pool.query(
      "SELECT FIRST 1 PassagemId FROM Passagens WHERE FiscalDesembarcandoId=? AND Status='RASCUNHO'",
      [desemb.FiscalId]
    );

    if (jaRascunho.length){
      return res.status(400).json({ error: 'Passagem de serviço já existe, no modo rascunho, para o fiscal!' });
    }

    // 🔹 Se não tem rascunho, cria nova PS

    const connInsPs = await pool.getConnection();
    let id;
    try {
      const rsPs = await connInsPs.execute(`
        INSERT INTO PASSAGENS
          (NumeroPS, DataEmissao, PeriodoInicio, PeriodoFim, EmbarcacaoId, FiscalEmbarcandoId, FiscalDesembarcandoId, Status, OwnerUser)
        VALUES (?,?,?,?,?,?,?,?,?)
        RETURNING PassagemId
      `, [
        NumeroPS || null, DataEmissao || null, PeriodoInicio, PeriodoFim, EmbarcacaoId,
        FiscalEmbarcandoId || null, desemb.FiscalId, 'RASCUNHO', req.ctx.login
      ]);
      id = rsPs?.rows?.[0]?.PASSAGEMID ?? rsPs?.rows?.[0]?.PassagemId;
    } finally {
      await connInsPs.dispose();
    }

    
    //const id = r.insertId;
    
    
    await logEvent(id, 'CREATE', 'Criou a PS.', null, req.ctx);
    res.json({ PassagemId: id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao criar passagem de serviço' });
  }
});


//APP PUT PASSAGEM DE SERVIÇO---------------------------------------------------------------------

app.put('/api/passagens/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(`SELECT FIRST 1 * FROM Passagens WHERE PassagemId=?`, [id]);
  const ps = rows[0];

  // 1) valida existência
  if (!ps) return res.status(404).json({ error:'PS não encontrada' });

  // 2) valida permissão/janela
  const [nr] = await pool.query(`
    SELECT FIRST 1 p.*, fe.Nome AS "FiscalEmbarcandoNome", fd.Nome AS "FiscalDesembarcandoNome"
    FROM Passagens p
    LEFT JOIN Fiscais fe ON fe.FiscalId = p.FiscalEmbarcandoId
    JOIN Fiscais fd ON fd.FiscalId = p.FiscalDesembarcandoId
    WHERE p.PassagemId=?`, [id]);
  const withNames = nr[0];
  if (!canEdit(withNames, req.ctx)) {
    return res.status(403).json({ error:'Janela de edição encerrada ou não está desembarcando.' });
  }

  // inicializa registros da seção PORTO (1.1–1.10) para a nova PS
  try {
    // 1.1 e 1.2 (linhas “singulares”)
    await pool.query('INSERT INTO porto_trocaturma (PassagemId) VALUES (?)', [id]);
    await pool.query('INSERT INTO porto_manutencaopreventiva (PassagemId, NaoSolicitada, NaoProgramada) VALUES (?,?,?)', [id, 0, 0]);

    // 1.3–1.6 (com flag NaoPrevisto disponível)
    await pool.query('INSERT INTO porto_abastecimento (PassagemId, NaoPrevisto) VALUES (?,1)', [id]);
    await pool.query('INSERT INTO porto_anvisa (PassagemId, NaoPrevisto) VALUES (?,1)', [id]);
    await pool.query('INSERT INTO porto_classe (PassagemId, NaoPrevisto) VALUES (?,1)', [id]);
    await pool.query('INSERT INTO porto_inspecoespetrobras (PassagemId, NaoPrevisto) VALUES (?,1)', [id]);

    // 1.7–1.10 (listas) — cria “sentinela” NaoPrevisto=1
    await pool.query('INSERT INTO porto_embarqueequipes (PassagemId, NaoPrevisto) VALUES (?,1)', [id]);
    await pool.query('INSERT INTO porto_embarquemateriais (PassagemId, NaoPrevisto) VALUES (?,1)', [id]);
    await pool.query('INSERT INTO porto_desembarquemateriais (PassagemId, NaoPrevisto) VALUES (?,1)', [id]);
    await pool.query('INSERT INTO porto_osmobilizacao (PassagemId, NaoPrevisto) VALUES (?,1)', [id]);

    // log opcional desta inicialização
    await logEvent(id, 'UPDATE', 'Inicializou registros da seção PORTO (1.1–1.10).', null, req.ctx);
  } catch (e) {
    console.error('Falha ao inicializar PORTO da PS', id, e);
    // não bloqueia a atualização da PS
  }

  // 4) segue com atualização do cabeçalho
  const { NumeroPS, DataEmissao, PeriodoInicio, PeriodoFim, EmbarcacaoId, FiscalEmbarcandoId } = req.body;
  await pool.query(`
    UPDATE Passagens SET
      NumeroPS=?, DataEmissao=?, PeriodoInicio=?, PeriodoFim=?, EmbarcacaoId=?, FiscalEmbarcandoId=?
    WHERE PassagemId=?
  `, [ NumeroPS || null, DataEmissao || null, PeriodoInicio, PeriodoFim, EmbarcacaoId, FiscalEmbarcandoId || null, id ]);

  await logEvent(id, 'UPDATE', 'Atualizou Cabeçalho.', null, req.ctx);
  res.json({ ok:true });
});


app.post('/api/passagens/:id/finalizar', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(`
    SELECT FIRST 1 p.*, e.Nome AS "EmbarcacaoNome", fe.Nome AS "FiscalEmbarcandoNome", fd.Nome AS "FiscalDesembarcandoNome"
    FROM Passagens p
    JOIN Embarcacoes e ON e.EmbarcacaoId = p.EmbarcacaoId
    LEFT JOIN Fiscais fe ON fe.FiscalId = p.FiscalEmbarcandoId
    JOIN Fiscais fd ON fd.FiscalId = p.FiscalDesembarcandoId
    WHERE p.PassagemId=?
  `,[id]);
  const ps = rows[0];
  if (!ps) return res.status(404).json({error:'PS não encontrada'});
  if (!canEdit(ps, req.ctx)) return res.status(403).json({error:'Não pode finalizar'});

  const logoPath = process.env.PDF_LOGO || path.resolve(__dirname, '../../client/assets/logo.png');
  const dir = ensurePsDir(id);
  const fileName = `PS_${ps.EmbarcacaoNome}_${dayjs(ps.PeriodoInicio).format('YYYYMMDD')}-${dayjs(ps.PeriodoFim).format('YYYYMMDD')}.pdf`.replace(/[\/:*?"<>|]+/g,'_');
  const pdfPath = path.join(dir, fileName);

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);
  if (fs.existsSync(logoPath)){ try{ doc.image(logoPath, 36, 24, { width: 120 }); }catch{} }
  doc.fillColor('#0b7a66').fontSize(16).text(`PASSAGEM DE SERVIÇO – ${ps.EmbarcacaoNome}`, 180, 30, { align: 'left' });
  doc.moveDown(2).fillColor('#222').fontSize(11);
  doc.text(`Número: ${ps.NumeroPS || '-'}`);
  doc.text(`Data: ${ps.DataEmissao || '-'}`);
  doc.text(`Período: ${ps.PeriodoInicio} a ${ps.PeriodoFim}`);
  doc.text(`Fiscal Embarcando: ${ps.FiscalEmbarcandoNome || '-'}  |  Fiscal Desembarcando: ${ps.FiscalDesembarcandoNome || '-'}`);
  doc.moveDown().fontSize(9).fillColor('#666').text('(PDF de teste completo — layout final pode ser expandido por seção)');
  doc.end();
  await new Promise(r => stream.on('finish', r));

  await pool.query(`UPDATE Passagens SET Status='FINALIZADA', PdfPath=? WHERE PassagemId=?`,[pdfPath, id]);

  await logEvent(id, 'FINALIZAR', 'Finalizou PS e gerou PDF.', pdfPath, req.ctx);
  res.json({ ok:true, pdfPath });
});

app.post('/api/passagens/:id/copiar', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(`
    SELECT FIRST 1 p.*, fe.FiscalId AS "EmbarcanteId"
    FROM Passagens p
    LEFT JOIN Fiscais fe ON fe.FiscalId = p.FiscalEmbarcandoId
    WHERE p.PassagemId=?
  `,[id]);
  const ps = rows[0];
  if (!ps) return res.status(404).json({error:'PS não encontrada'});
  if (ps.Status !== 'FINALIZADA') return res.status(400).json({error:'Somente PS finalizada pode ser copiada'});
  if (ps.EmbarcanteId !== req.ctx.fiscalId) return res.status(403).json({error:'Somente o embarcante pode copiar esta PS'});

  const nextInicio = dayjs(ps.PeriodoFim).add(1,'day').format('YYYY-MM-DD');
  const nextFim = dayjs(ps.PeriodoFim).add(14,'day').format('YYYY-MM-DD');

  const connCopy = await pool.getConnection();
  let newId;
  try {
    const rsCopy = await connCopy.execute(`
      INSERT INTO PASSAGENS
        (NumeroPS, DataEmissao, PeriodoInicio, PeriodoFim, EmbarcacaoId, FiscalEmbarcandoId, FiscalDesembarcandoId, Status, OwnerUser)
      VALUES (?,?,?,?,?,?,?,?,?)
      RETURNING PassagemId
    `,[ null, dayjs().format('YYYY-MM-DD'), nextInicio, nextFim, ps.EmbarcacaoId, null, ps.EmbarcanteId, 'RASCUNHO', req.ctx.login ]);
    newId = rsCopy?.rows?.[0]?.PASSAGEMID ?? rsCopy?.rows?.[0]?.PassagemId;
  } finally {
    await connCopy.dispose();
  }

  //const newId = r.insertId;



  await logEvent(id, 'COPIAR', 'Copiou PS para nova PS (+14 dias).', `NovaPassagemId=${newId}`, req.ctx);
  res.json({ NewPassagemId: newId });
});

app.get('/api/admin/passagens', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         p.PassagemId, p.EmbarcacaoId, e.Nome AS "EmbarcacaoNome",
         p.PeriodoInicio, p.PeriodoFim,
         p.Status, p.NumeroPS, p.DataEmissao,
         p.FiscalEmbarcandoId, fe.Nome AS "FiscalEmbarcandoNome",
         p.FiscalDesembarcandoId, fd.Nome AS "FiscalDesembarcandoNome"
       FROM passagens p
       JOIN embarcacoes e ON e.EmbarcacaoId = p.EmbarcacaoId
       LEFT JOIN fiscais fe ON fe.FiscalId = p.FiscalEmbarcandoId
       LEFT JOIN fiscais fd ON fd.FiscalId = p.FiscalDesembarcandoId
       ORDER BY p.PeriodoInicio DESC, p.PassagemId DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao listar passagens' });
  }
});

app.delete('/api/admin/passagens/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  const conn = await pool.getConnection();
  const tr = await conn.startTransaction(); // Firebird
  try {

    //await conn.beginTransaction();

    // apaga dependências (tabelas filhas)
    const tables = [
  'porto_trocaturma','porto_manutencaopreventiva','porto_abastecimento',
  'porto_anvisa','porto_classe','porto_inspecoespetrobras', // ← adicionadas
  'porto_embarqueequipes','porto_embarquemateriais','porto_desembarquemateriais','porto_osmobilizacao',
  'rotina_iapo','rotina_rac_qsms',
  'sms_anomalias','sms_lv_mangueiras','sms_lv_seguranca','sms_auditoriahorasegura','sms_ais_sobdemanda',
  'os_previstas','os_interrompidas','os_infosgerais',
  'informacoesgeraisfinais',
  'broa_arquivos','broa_statusporto','contrato_pendencias',
  'auditlog'
];
    for (const t of tables) {
      await tr.execute(`DELETE FROM ${t} WHERE PassagemId = ?`, [id]);
    }

    // apaga a passagem
    const rsDel = await tr.execute('DELETE FROM PASSAGENS WHERE PassagemId = ?', [id]);
    const afetadas = (rsDel?.rowsAffected ?? rsDel?.count ?? 0);
    if (afetadas === 0) {
      await tr.rollback();
      return res.status(404).json({ error: 'Passagem não encontrada' });
    }


    await tr.commit();
    res.json({ ok: true });
    } catch (e) {
      console.error(e);
      try { await tr.rollback(); } catch(_) {}
      res.status(500).json({ error: 'Falha ao excluir passagem' });
    } finally {
      await conn.dispose();
    }

});
// PUT /api/fiscais/:id – atualiza Nome, Chave (4) e Telefone (<=15)
app.put('/api/fiscais/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { Nome, Chave, Telefone } = req.body || {};
    if (!id || !Nome || !Chave) return res.status(400).json({ error: 'Parâmetros inválidos' });
    if (String(Chave).length !== 4) return res.status(400).json({ error: 'Chave deve ter 4 caracteres' });
    if (Telefone && String(Telefone).length > 15) return res.status(400).json({ error: 'Telefone até 15 caracteres' });

    // opcional: impedir chave duplicada em outro fiscal
    const [dup] = await pool.query(
      'SELECT FIRST 1 FiscalId FROM Fiscais WHERE LOWER(Chave)=LOWER(?) AND FiscalId<>?',
      [String(Chave), id]
    );

    if (dup.length) return res.status(409).json({ error: 'Chave já utilizada por outro fiscal' });

    const [, r] = await pool.query(
      'UPDATE fiscais SET Nome=?, Chave=?, Telefone=? WHERE FiscalId=?',
      [String(Nome).trim(), String(Chave).trim(), Telefone || '', id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Fiscal não encontrado' });


    const [rows] = await pool.query('SELECT FIRST 1 FiscalId, Nome, Chave, Telefone FROM fiscais WHERE FiscalId=?', [id]);
    res.json(rows[0]);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao atualizar fiscal' });
  }
});

// DELETE /api/fiscais/:id – exclui fiscal (bloqueia se houver PS vinculadas)
app.delete('/api/fiscais/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });

    // Verifica vínculo em passagens
    const [ref] = await pool.query(
      'SELECT FIRST 1 PassagemId FROM Passagens WHERE FiscalEmbarcandoId=? OR FiscalDesembarcandoId=?',
      [id, id]
    );

    if (ref.length) return res.status(409).json({ error: 'Não é possível excluir: há PS vinculadas a este fiscal.' });

    const [, r] = await pool.query('DELETE FROM fiscais WHERE FiscalId=?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Fiscal não encontrado' });

    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao excluir fiscal' });
  }
});


// PUT /api/embarcacoes/:id – renomeia embarcação
app.put('/api/embarcacoes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { Nome, PrimeiraEntradaPorto, TipoEmbarcacao } = req.body || {};
    if (!id || !Nome) return res.status(400).json({ error: 'Parâmetros inválidos' });
    if (TipoEmbarcacao && String(TipoEmbarcacao).length > 20)
      return res.status(400).json({ error: 'Tipo da Embarcação até 20 caracteres' });

    // normaliza data
    let dt = null;
    if (PrimeiraEntradaPorto) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(PrimeiraEntradaPorto)) dt = PrimeiraEntradaPorto;
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(PrimeiraEntradaPorto)) {
        const [d,m,y] = PrimeiraEntradaPorto.split('/');
        dt = `${y}-${m}-${d}`;
      }
    }

    // opcional: impedir nome duplicado em outro id
    const [dup] = await pool.query(
      'SELECT FIRST 1 EmbarcacaoId FROM Embarcacoes WHERE LOWER(Nome)=LOWER(?) AND EmbarcacaoId<>?',
      [Nome.trim(), id]
    );

    if (dup.length) return res.status(409).json({ error: 'Já existe embarcação com este nome' });

    const [, r] = await pool.query(
      'UPDATE embarcacoes SET Nome=?, PrimeiraEntradaPorto=?, TipoEmbarcacao=? WHERE EmbarcacaoId=?',
      [Nome.trim(), dt, TipoEmbarcacao || null, id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Embarcação não encontrada' });


    const [rows] = await pool.query(
      'SELECT FIRST 1 EmbarcacaoId, Nome, PrimeiraEntradaPorto, TipoEmbarcacao FROM embarcacoes WHERE EmbarcacaoId=?',
      [id]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Falha ao atualizar embarcação' });
  }
});


// DELETE /api/embarcacoes/:id – exclui embarcação
app.delete('/api/embarcacoes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Parâmetro inválido' });

    // tenta excluir; se houver FK (PS vinculada), MySQL retorna erro
    // checa vínculo com PS antes de excluir (compatível com Firebird)
    const [vinc] = await pool.query(
      'SELECT FIRST 1 PassagemId FROM Passagens WHERE EmbarcacaoId=?',
      [id]
    );
    if (vinc.length) {
      return res.status(409).json({ error: 'Não é possível excluir: existem passagens vinculadas.' });
    }

    const [, r] = await pool.query('DELETE FROM embarcacoes WHERE EmbarcacaoId=?', [id]);
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Embarcação não encontrada' });
    }


    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Falha ao excluir embarcação' });
  }
});


const upload = multer({ storage: multer.diskStorage({
  destination: function(req, file, cb){
  const n = Number(req.params.id);
  if (!Number.isFinite(n) || n <= 0) return cb(new Error('ID inválido'));
  cb(null, ensurePsDir(n));
},
  filename: function(req, file, cb){
    const sanitized = file.originalname.replace(/[\/:*?"<>|]+/g,'_');
    cb(null, Date.now() + '_' + sanitized);
  }
}) });

app.post('/api/passagens/:id/upload', requireAuth, upload.single('file'), async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query('SELECT FIRST 1 * FROM Passagens WHERE PassagemId=?',[id]);
  const ps = rows[0];
  if (!ps) return res.status(404).json({error:'PS não encontrada'});
  const FiscalEmbarcandoId    = ps.FiscalEmbarcandoId    ?? ps.FISCALEMBARCANDOID;
  const FiscalDesembarcandoId = ps.FiscalDesembarcandoId ?? ps.FISCALDESEMBARCANDOID;
  if (FiscalEmbarcandoId !== req.ctx.fiscalId && FiscalDesembarcandoId !== req.ctx.fiscalId){
    return res.status(403).json({error:'Acesso negado'});
  }
  await pool.query(
    'INSERT INTO AuditLog (PassagemId, Evento, Descricao, AutorUser, AutorNome, Detalhe) VALUES (?,?,?,?,?,?)',
    [id, 'UPLOAD', `Upload de arquivo (${req.file.originalname})`, req.ctx.login, req.ctx.nome, req.file.path]
  );
  res.json({ path: req.file.path });
});


// === SEÇÃO PORTO (1.1–1.6) ================================================================================================
// GET agregado
app.get('/api/passagens/:id/porto', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try {
    const [[t1]] = await pool.query('SELECT FIRST 1 * FROM porto_trocaturma WHERE PassagemId=?', [id]);
    const [[t2]] = await pool.query('SELECT FIRST 1 * FROM porto_manutencaopreventiva WHERE PassagemId=?', [id]);
    const [[t3]] = await pool.query('SELECT FIRST 1 * FROM porto_abastecimento WHERE PassagemId=?', [id]);
    const [[t4]] = await pool.query('SELECT FIRST 1 * FROM porto_anvisa WHERE PassagemId=?', [id]);
    const [[t5]] = await pool.query('SELECT FIRST 1 * FROM porto_classe WHERE PassagemId=?', [id]);
    const [[t6]] = await pool.query('SELECT FIRST 1 * FROM porto_inspecoespetrobras WHERE PassagemId=?', [id]);


    res.json({
      trocaturma: t1 || null,
      manutencaoPreventiva: t2 || null,
      abastecimento: t3 || null,
      anvisa: t4 || null,
      classe: t5 || null,
      inspecoesPetrobras: t6 || null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar PORTO' });
  }
});

// PUT agregado (upsert 1.1–1.6, com limpeza)
app.put('/api/passagens/:id/porto', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  // PS e canEdit
  const [[ps]] = await pool.query(`
    SELECT FIRST 1 p.*, fe.Nome AS "FiscalEmbarcandoNome", fd.Nome AS "FiscalDesembarcandoNome"
    FROM Passagens p
    LEFT JOIN Fiscais fe ON fe.FiscalId = p.FiscalEmbarcandoId
    JOIN  Fiscais fd ON fd.FiscalId = p.FiscalDesembarcandoId
    WHERE p.PassagemId=?`, [id]);
  if (!ps) return res.status(404).json({ error: 'PS não encontrada' });
  if (!canEdit(ps, req.ctx)) return res.status(403).json({ error: 'Janela de edição encerrada ou você não é o desembarcante.' });

  const { trocaturma, manutencaoPreventiva, abastecimento, anvisa, classe, inspecoesPetrobras } = req.body || {};

  const conn = await pool.getConnection();
  const tr = await conn.startTransaction();

  try {
    

    // 1.1 Troca de Turma (obrigatória)
    if (trocaturma) {
      const TT = {
        Porto: (trocaturma.Porto || '').trim(),
        Terminal: (trocaturma.Terminal || '').trim(),
        OrdemServico: (trocaturma.OrdemServico || '').trim(),
        AtracacaoHora: trocaturma.AtracacaoHora || null,
        DuracaoMin: trocaturma.DuracaoMin != null ? Number(trocaturma.DuracaoMin) : null,
        Observacoes: trocaturma.Observacoes || null
      };
      // valida obrigatórios
      if (!TT.Porto || !TT.Terminal || !TT.OrdemServico || !TT.AtracacaoHora || TT.DuracaoMin == null) {
        await tr.rollback();
        return res.status(400).json({ error: 'Campos obrigatórios ausentes em 1.1 Troca de Turma.' });
      }
      await tr.execute(`
        UPDATE OR INSERT INTO porto_trocaturma
          (PassagemId, Porto, Terminal, OrdemServico, AtracacaoHora, DuracaoMin, Observacoes)
        VALUES (?,?,?,?,?,?,?)
        MATCHING (PassagemId)
      `,[ id, TT.Porto, TT.Terminal, TT.OrdemServico, TT.AtracacaoHora, TT.DuracaoMin, TT.Observacoes ]);
    }

    // 1.2 Manutenção Preventiva (limpeza conforme flags)
    if (manutencaoPreventiva) {
      const MP = { ...manutencaoPreventiva };
      const naoSolic = Number(MP.NaoSolicitada) === 1;
      const naoProg  = Number(MP.NaoProgramada) === 1;
      const franquia = naoSolic ? null : (MP.FranquiaSolicitadaMin != null ? Number(MP.FranquiaSolicitadaMin) : null);
      const os       = naoProg  ? null : (MP.OrdemServico || null);
      const saldo    = MP.SaldoFranquiaMin != null ? Number(MP.SaldoFranquiaMin) : null;
      const rade     = MP.RADEPath || null;
      const obs      = MP.Observacoes || null;

      await tr.execute(`
        UPDATE OR INSERT INTO porto_manutencaopreventiva
          (PassagemId, NaoSolicitada, FranquiaSolicitadaMin, NaoProgramada, OrdemServico, SaldoFranquiaMin, RADEPath, Observacoes)
        VALUES (?,?,?,?,?,?,?,?)
        MATCHING (PassagemId)
      `, [id, (naoSolic ? 1 : 0), franquia, (naoProg ? 1 : 0), os, saldo, rade, obs]);

      }

    // 1.3 Abastecimento
    if (abastecimento) {
      const AB = { ...abastecimento };
      const naoPrev = Number(AB.NaoPrevisto) === 1;
      const os   = naoPrev ? null : (AB.OrdemServico || null);
      const qnt  = naoPrev ? null : (AB.Quantidade_m3 != null ? Number(AB.Quantidade_m3) : null);
      const dur  = naoPrev ? null : (AB.DuracaoMin != null ? Number(AB.DuracaoMin) : null);
      const obs  = naoPrev ? null : (AB.Observacoes || null);
      const anexo= naoPrev ? null : (AB.AnexoPath || null);

      await tr.execute(`
        UPDATE OR INSERT INTO porto_abastecimento
          (PassagemId, NaoPrevisto, OrdemServico, Quantidade_m3, DuracaoMin, Observacoes, AnexoPath)
        VALUES (?,?,?,?,?,?,?)
        MATCHING (PassagemId)
      `, [id, (naoPrev ? 1 : 0), os, qnt, dur, obs, anexo]);


    }

    // 1.4 ANVISA
    if (anvisa) {
      const A = { ...anvisa };
      const naoPrev = Number(A.NaoPrevisto) === 1;
      const os  = naoPrev ? null : (A.OrdemServico || null);
      const desc= naoPrev ? null : (A.Descricao || null);
      const obs = naoPrev ? null : (A.Observacoes || null);

      await tr.execute(`
        UPDATE OR INSERT INTO porto_anvisa
          (PassagemId, NaoPrevisto, OrdemServico, Descricao, Observacoes)
        VALUES (?,?,?,?,?)
        MATCHING (PassagemId)
      `, [id, (naoPrev ? 1 : 0), os, desc, obs]);
    }

    // 1.5 Classe
    if (classe) {
      const C = { ...classe };
      const naoPrev = Number(C.NaoPrevisto) === 1;
      const os  = naoPrev ? null : (C.OrdemServico || null);
      const desc= naoPrev ? null : (C.Descricao || null);
      const obs = naoPrev ? null : (C.Observacoes || null);

      await tr.execute(`
        UPDATE OR INSERT INTO porto_classe
          (PassagemId, NaoPrevisto, OrdemServico, Descricao, Observacoes)
        VALUES (?,?,?,?,?)
        MATCHING (PassagemId)
      `, [id, (naoPrev ? 1 : 0), os, desc, obs]);

    }

    // 1.6 Inspeções/Auditorias Petrobras
    if (inspecoesPetrobras) {
      const IP = { ...inspecoesPetrobras };
      const naoPrev = Number(IP.NaoPrevisto) === 1;
      const aud = naoPrev ? null : (IP.Auditor || null);
      const ger = naoPrev ? null : (IP.Gerencia || null);
      const obs = naoPrev ? null : (IP.Observacoes || null);

      await tr.execute(`
        UPDATE OR INSERT INTO porto_inspecoespetrobras
          (PassagemId, NaoPrevisto, Auditor, Gerencia, Observacoes)
        VALUES (?,?,?,?,?)
        MATCHING (PassagemId)
      `, [id, (naoPrev ? 1 : 0), aud, ger, obs]);

    }

    await logEvent(id, 'PORTO_SAVE', 'Atualizou Seção 1 (1.1–1.6).', null, req.ctx);
    await tr.commit();

    // devolve o estado atualizado
    const [[t1]] = await pool.query('SELECT FIRST 1 * FROM porto_trocaturma WHERE PassagemId=?', [id]);
    const [[t2]] = await pool.query('SELECT FIRST 1 * FROM porto_manutencaopreventiva WHERE PassagemId=?', [id]);
    const [[t3]] = await pool.query('SELECT FIRST 1 * FROM porto_abastecimento WHERE PassagemId=?', [id]);
    const [[t4]] = await pool.query('SELECT FIRST 1 * FROM porto_anvisa WHERE PassagemId=?', [id]);
    const [[t5]] = await pool.query('SELECT FIRST 1 * FROM porto_classe WHERE PassagemId=?', [id]);
    const [[t6]] = await pool.query('SELECT FIRST 1 * FROM porto_inspecoespetrobras WHERE PassagemId=?', [id]);


    res.json({
      trocaturma: t1 || null,
      manutencaoPreventiva: t2 || null,
      abastecimento: t3 || null,
      anvisa: t4 || null,
      classe: t5 || null,
      inspecoesPetrobras: t6 || null
    });

  } catch (e) {
    try { await 
    tr.rollback(); } catch {}
    console.error(e);
    res.status(500).json({ error: 'Falha ao salvar PORTO' });
  } finally {
    await conn.dispose();

  }
});



// =================== PORTO (1.7–1.10) - LISTAS (GET/PUT agregado) ===================
app.get('/api/passagens/:id/porto-listas', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try {
    const [eq] = await pool.query(
      'SELECT EmbEqId, NaoPrevisto, Tipo, Empresa, Nome, Observacoes FROM porto_embarqueequipes WHERE PassagemId=? ORDER BY EmbEqId',
      [id]
    );
    const [em] = await pool.query(
      'SELECT EmbMatId, NaoPrevisto, Origem, OS, Destino, RT, Observacoes, AnexoPath FROM porto_embarquemateriais WHERE PassagemId=? ORDER BY EmbMatId',
      [id]
    );
    const [dm] = await pool.query(
      'SELECT DesembMatId, NaoPrevisto, OS, Origem, Destino, RT, Observacoes, AnexoPath FROM porto_desembarquemateriais WHERE PassagemId=? ORDER BY DesembMatId',
      [id]
    );
    const [om] = await pool.query(
      'SELECT OSMobId, NaoPrevisto, OS, Descricao, Observacoes, AnexoPath FROM porto_osmobilizacao WHERE PassagemId=? ORDER BY OSMobId',
      [id]
    );

    function packList(rows, fields) {
      const naoPrev = rows.length > 0 && rows.every(r =>
        Number(r.NaoPrevisto) === 1 && fields.every(f => r[f] == null || r[f] === '')
      );
      const linhas = rows.filter(r => Number(r.NaoPrevisto) !== 1).map(r => {
        const o = {};
        fields.forEach(f => o[f] = r[f] ?? null);
        return o;
      });
      return { naoPrevisto: naoPrev, linhas };
    }

    res.json({
      equipes: packList(eq, ['Tipo','Empresa','Nome','Observacoes']),
      embarqueMateriais: packList(em, ['Origem','OS','Destino','RT','Observacoes','AnexoPath']),
      desembarqueMateriais: packList(dm, ['OS','Origem','Destino','RT','Observacoes','AnexoPath']),
      osMobilizacao: packList(om, ['OS','Descricao','Observacoes','AnexoPath'])
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar listas do PORTO' });
  }
});

app.put('/api/passagens/:id/porto-listas', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  // verifica permissão/estado da PS
  const [[ps]] = await pool.query(`
    SELECT FIRST 1 p.*, fe.Nome AS "FiscalEmbarcandoNome", fd.Nome AS "FiscalDesembarcandoNome"
    FROM Passagens p
    LEFT JOIN Fiscais fe ON fe.FiscalId = p.FiscalEmbarcandoId
    JOIN  Fiscais fd ON fd.FiscalId = p.FiscalDesembarcandoId
    WHERE p.PassagemId=?`, [id]);
  if (!ps) return res.status(404).json({ error: 'PS não encontrada' });
  if (!canEdit(ps, req.ctx)) return res.status(403).json({ error: 'Janela de edição encerrada ou você não é o desembarcante.' });

  const body = req.body || {};
  const conn = await pool.getConnection();
  let tr;                       
  try {
    tr = await conn.startTransaction();
    // helper para gravar lista----------------------------------------------------------------------
    async function saveList(table, fields, payload){
      await tr.execute(`DELETE FROM ${table} WHERE PassagemId=?`, [id]);
      if (!payload || payload.naoPrevisto === true) {
        await tr.execute(`INSERT INTO ${table} (PassagemId, NaoPrevisto) VALUES (?,1)`, [id]);
        return { count: 0, naoPrevisto: true };
      }
      const linhas = Array.isArray(payload.linhas) ? payload.linhas : [];
      let count = 0;
      for (const it of linhas) {
        const cols = ['PassagemId','NaoPrevisto', ...fields];
        const vals = [id, 0, ...fields.map(f => (it[f] ?? null))];
        const qs = cols.map(()=>'?').join(',');
        await tr.execute(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${qs})`, vals);
        count++;
      }
      return { count, naoPrevisto: false };
    }

    const rEq = await saveList('porto_embarqueequipes', ['Tipo','Empresa','Nome','Observacoes'], body.equipes);
    const rEm = await saveList('porto_embarquemateriais', ['Origem','OS','Destino','RT','Observacoes','AnexoPath'], body.embarqueMateriais);
    const rDm = await saveList('porto_desembarquemateriais', ['OS','Origem','Destino','RT','Observacoes','AnexoPath'], body.desembarqueMateriais);
    const rOm = await saveList('porto_osmobilizacao', ['OS','Descricao','Observacoes','AnexoPath'], body.osMobilizacao);

    await tr.commit();
    res.json({ ok: true, resumo: { equipes:rEq, embarqueMateriais:rEm, desembarqueMateriais:rDm, osMobilizacao:rOm } });
  } catch (e) {
    try { await tr.rollback(); } catch (_) {}
    console.error(e);
    res.status(500).json({ error: 'Falha ao salvar listas do PORTO' });
  } finally {
    await conn.dispose();

  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('PS app on', PORT, 'mode=', USE_WINDOWS_AUTH?'windows':'manual'));
