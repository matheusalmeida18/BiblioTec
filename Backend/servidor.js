import express from 'express';
import cors from 'cors';
import { neon } from '@netlify/neon';

const app = express();

// ==========================================
// 🚨 ATENÇÃO: COLA AQUI O SEU LINK DO MUDDY-TREE
// Exemplo: "postgresql://neondb_owner:SENHA@ep-muddy-tree-08681875.us-east-2.aws.neon.tech/neondb?sslmode=require"
// ==========================================
const sql = neon("postgresql://neondb_owner:npg_fBR5l7PTUhne@ep-lively-dust-ajy8smtk-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require");

app.use(express.json());
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

console.log("🚀 Servidor conectado ao Banco de Dados Online (Neon)!");

// ==========================================
// --- ROTAS DE ALUNOS ---
// ==========================================

app.get('/alunos/:matricula', async (req, res) => {
    try {
        const { matricula } = req.params;
        const result = await sql.query('SELECT nome FROM alunos WHERE matricula = $1', [matricula]);
        result.length > 0 ? res.json(result[0]) : res.status(404).json({ erro: "Não encontrado" });
    } catch (e) { 
        console.error("❌ Erro GET aluno por matricula:", e);
        res.status(500).send(e.message); 
    }
});

app.get('/api/alunos/todos', async (req, res) => {
    try {
        const resultado = await sql.query('SELECT * FROM alunos ORDER BY nome ASC');
        res.json(resultado);
    } catch (err) {
        console.error("❌ Erro GET alunos/todos:", err);
        res.status(500).json({ error: 'Erro ao buscar alunos' });
    }
});

app.get('/api/alunos/busca', async (req, res) => {
    const { nome } = req.query;
    try {
        const result = await sql.query(
            "SELECT id, nome, turma FROM alunos WHERE nome ILIKE $1 LIMIT 5", 
            [`%${nome}%`]
        );
        res.json(result);
    } catch (e) {
        console.error("❌ Erro GET alunos/busca:", e);
        res.status(500).json({ erro: "Erro ao buscar alunos" });
    }
});

app.post('/api/alunos', async (req, res) => {
    const { nome, email, telefone, turma } = req.body;
    try {
        await sql.query(
            'INSERT INTO alunos (nome, email, telefone, turma) VALUES ($1, $2, $3, $4)', 
            [nome, email, telefone, turma]
        );
        console.log(`✅ Aluno ${nome} salvo com sucesso!`);
        res.status(201).json({ sucesso: true });
    } catch (e) {
        console.error("❌ Erro POST alunos:", e);
        res.status(500).json({ erro: "Erro ao salvar no banco de dados." });
    }
});

app.put('/api/alunos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, email } = req.body;
    try {
        await sql.query('UPDATE alunos SET nome = $1, email = $2 WHERE id = $3', [nome, email, id]);
        res.json({ sucesso: true });
    } catch (e) {
        console.error("❌ Erro PUT alunos:", e);
        res.status(500).json({ erro: "Erro ao atualizar aluno." });
    }
});

app.delete('/api/alunos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await sql.query('DELETE FROM alunos WHERE id = $1', [id]);
        res.status(200).json({ mensagem: "Aluno removido com sucesso!" });
    } catch (error) {
        console.error("❌ Erro DELETE alunos:", error);
        res.status(500).json({ erro: "Não é possível excluir: o aluno possui empréstimos." });
    }
});

// ==========================================
// --- ROTAS DE LIVROS ---
// ==========================================

app.get('/api/livros', async (req, res) => {
    try {
        const resultado = await sql.query('SELECT * FROM livros ORDER BY id DESC');
        res.json(resultado);
    } catch (erro) {
        console.error("❌ Erro GET livros:", erro);
        res.status(500).json({ erro: "Erro ao carregar o acervo do banco." });
    }
});

app.get('/api/livros/todos', async (req, res) => {
    try {
        const result = await sql.query('SELECT * FROM livros ORDER BY titulo ASC');
        res.json(result);
    } catch (e) { 
        console.error("❌ Erro GET livros/todos:", e);
        res.status(500).json({ erro: "Erro ao buscar livros." }); 
    }
});

app.post('/api/livros', async (req, res) => {
    const { isbn, titulo, autor, ano, capa_url } = req.body;
    
    // Verificação básica
    if (!isbn || !titulo) {
        return res.status(400).json({ erro: "ISBN e Título são obrigatórios!" });
    }

    try {
        await sql.query(
            "INSERT INTO livros (codigo_barras, titulo, autor, ano, capa_url, quantidade) VALUES ($1, $2, $3, $4, $5, $6)",
            [isbn, titulo, autor || 'Desconhecido', parseInt(ano) || 2026, capa_url || '', 1]
        );
        console.log(`✅ Livro ${titulo} salvo com sucesso!`);
        res.json({ sucesso: true });
    } catch (e) {
        console.error("❌ Erro POST livros:", e);
        res.status(500).json({ erro: "Erro ao salvar: " + e.message });
    }
});

app.put('/api/livros/:isbn', async (req, res) => {
    const { isbn } = req.params;
    const { quantidade } = req.body;
    try {
        await sql.query('UPDATE livros SET quantidade = $1 WHERE codigo_barras = $2', [quantidade, isbn]);
        res.json({ sucesso: true });
    } catch (e) { 
        console.error("❌ Erro PUT livros:", e);
        res.status(500).json({ erro: "Erro ao atualizar estoque." }); 
    }
});

app.delete('/api/livros/:isbn', async (req, res) => {
    try {
        const { isbn } = req.params;
        await sql.query('DELETE FROM livros WHERE codigo_barras = $1', [isbn]);
        res.json({ sucesso: true });
    } catch (e) {
        console.error("❌ Erro DELETE livros:", e);
        res.status(500).json({ erro: "Erro ao excluir: livro pode estar emprestado." });
    }
});

// ==========================================
// --- MOVIMENTAÇÕES (EMPRÉSTIMOS E DEVOLUÇÕES) ---
// ==========================================

app.post('/api/emprestimos', async (req, res) => {
    const { nome_aluno, isbn } = req.body; 
    try {
        const checar = await sql.query("SELECT id FROM emprestimos WHERE livro_isbn = $1 AND status = 'ativo'", [isbn]);
        if (checar.length > 0) {
            return res.status(400).json({ erro: "Este exemplar físico já está emprestado no momento!" });
        }

        await sql.query('INSERT INTO emprestimos (aluno_nome, livro_isbn, data_saida, status) VALUES ($1, $2, NOW(), $3)', [nome_aluno, isbn, 'ativo']);
        res.status(201).json({ sucesso: true });
    } catch (error) {
        console.error("❌ Erro POST emprestimos:", error);
        res.status(500).json({ erro: error.message });
    }
});

app.post('/api/devolucoes', async (req, res) => {
    const { isbn } = req.body;
    try {
        const emprestimo = await sql.query("SELECT id FROM emprestimos WHERE livro_isbn = $1 AND status = 'ativo' LIMIT 1", [isbn]);
        if (emprestimo.length === 0) return res.status(404).json({ erro: "Sem empréstimo ativo." });

        await sql.query("UPDATE emprestimos SET status = 'devolvido' WHERE id = $1", [emprestimo[0].id]);
        await sql.query("UPDATE livros SET quantidade = quantidade + 1 WHERE codigo_barras = $1", [isbn]);
        res.json({ sucesso: true });
    } catch (e) { 
        console.error("❌ Erro POST devolucoes:", e);
        res.status(500).json({ erro: "Erro ao devolver." }); 
    }
});

app.get('/api/emprestimos/todos', async (req, res) => {
    try {
        const resultado = await sql.query('SELECT * FROM emprestimos ORDER BY data_saida DESC');
        res.json(resultado);
    } catch (err) {
        console.error("❌ Erro GET emprestimos/todos:", err);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

app.get('/api/relatorios/emprestimos', async (req, res) => {
    try {
        const result = await sql.query(`SELECT aluno_nome, livro_isbn, data_saida FROM emprestimos ORDER BY data_saida DESC`);
        res.json(result);
    } catch (e) {
        console.error("❌ Erro GET relatorios:", e);
        res.status(500).json({ erro: "Erro ao buscar dados do relatório" });
    }
});

app.get('/api/emprestimos/ativos', async (req, res) => {
    try {
        const resultado = await sql.query("SELECT * FROM emprestimos WHERE status = 'ativo' ORDER BY data_saida DESC");
        res.json(resultado);
    } catch (err) {
        console.error("❌ Erro GET emprestimos/ativos:", err);
        res.status(500).json({ error: 'Erro ao buscar ativos' });
    }
});

app.get('/api/devedores/:isbn', async (req, res) => {
    const { isbn } = req.params;
    try {
        const queryCompleta = `
            SELECT e.id, e.aluno_nome, a.turma, e.data_saida 
            FROM emprestimos e
            JOIN alunos a ON e.aluno_nome = a.nome
            WHERE e.livro_isbn = $1 AND e.status = 'ativo'
        `;
        const final = await sql.query(queryCompleta, [isbn]);
        res.json(final);
    } catch (erro) {
        console.error("❌ Erro GET devedores:", erro);
        res.status(500).json({ erro: "Erro ao buscar devedores." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}!`));