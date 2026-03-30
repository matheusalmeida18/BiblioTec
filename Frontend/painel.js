const API_BASE = 'http://localhost:3000/api';

window.verificarAcesso = function() {
    const senha = document.getElementById('senhaAdmin').value.trim();
    if (senha === 'ieep123') {
        document.getElementById('modalLogin').style.display = 'none';
        window.carregarDados();
    } else {
        alert('Senha incorreta!');
    }
};

window.switchTab = function(tab) {
    const sections = ['sectionAlunos', 'sectionLivros', 'sectionAtivos'];
    const btns = ['btnTabAlunos', 'btnTabLivros', 'btnTabAtivos'];
    sections.forEach(s => document.getElementById(s).classList.add('hidden'));
    btns.forEach(b => {
        document.getElementById(b).classList.remove('tab-active');
        document.getElementById(b).classList.add('tab-inactive');
    });
    const targetSec = 'section' + tab.charAt(0).toUpperCase() + tab.slice(1);
    const targetBtn = 'btnTab' + tab.charAt(0).toUpperCase() + tab.slice(1);
    document.getElementById(targetSec).classList.remove('hidden');
    document.getElementById(targetBtn).classList.add('tab-active');
    document.getElementById(targetBtn).classList.remove('tab-inactive');
};

window.carregarDados = async function() {
    try {
        const [resA, resL, resE] = await Promise.all([
            fetch(`${API_BASE}/alunos/todos`),
            fetch(`${API_BASE}/livros/todos`),
            fetch(`${API_BASE}/emprestimos/ativos`)
        ]);
        const alunos = await resA.json();
        const livros = await resL.json();
        const ativos = await resE.json();
        document.getElementById('resumoLivros').innerText = livros.length || 0;
        document.getElementById('resumoAtivos').innerText = ativos.length || 0;

        document.getElementById('listaAlunos').innerHTML = alunos.map(a => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="px-6 py-4 font-medium">${a.nome}</td>
                <td class="px-6 py-4 text-slate-500">${a.turma || 'Geral'}</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="window.excluirRegistro('alunos', ${a.id}, '${a.nome}')" class="text-red-400 hover:text-red-600">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>`).join('');

        document.getElementById('listaLivros').innerHTML = livros.map(l => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="px-6 py-4 font-mono text-xs uppercase">${l.codigo_barras}</td>
                <td class="px-6 py-4 font-semibold">${l.titulo}</td>
                <td class="px-6 py-4 font-bold ${l.quantidade > 0 ? 'text-emerald-600' : 'text-red-600'}">${l.quantidade} un.</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="window.editarEstoque('${l.codigo_barras}', '${l.titulo}', ${l.quantidade})" class="text-blue-500 hover:text-blue-700 mr-4">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button onclick="window.excluirRegistro('livros', '${l.codigo_barras}', '${l.titulo}')" class="text-red-400 hover:text-red-600">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>`).join('');

        document.getElementById('listaAtivos').innerHTML = ativos.map(e => `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="px-6 py-4 font-bold text-indigo-600">${e.aluno_nome}</td>
                <td class="px-6 py-4 text-slate-600 font-medium">${e.livro_isbn}</td>
                <td class="px-6 py-4 text-slate-400 text-sm">${new Date(e.data_saida).toLocaleDateString('pt-BR')}</td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
};

window.gerarRelatorioPDF = async function() {
    try {
        const [resE, resA] = await Promise.all([
            fetch(`${API_BASE}/emprestimos/todos`),
            fetch(`${API_BASE}/alunos/todos`)
        ]);
        const todosE = await resE.json();
        const todosA = await resA.json();
        const listaE = Array.isArray(todosE) ? todosE : [];
        const listaA = Array.isArray(todosA) ? todosA : [];
        
        if (listaE.length === 0) { alert("Sem dados para o ranking."); return; }

        const ano = new Date().getFullYear();
        const agrupado = {};
        listaE.forEach(e => {
            if (new Date(e.data_saida).getFullYear() === ano) {
                if (!agrupado[e.aluno_nome]) {
                    const alu = listaA.find(a => a.nome === e.aluno_nome);
                    agrupado[e.aluno_nome] = { nome: e.aluno_nome, turma: (alu ? alu.turma : 'Geral'), total: 0 };
                }
                agrupado[e.aluno_nome].total += 1;
            }
        });

        const ranking = Object.values(agrupado).sort((a,b) => b.total - a.total);
        const linhas = ranking.map((al, idx) => `
            <tr>
                <td style="text-align:center;border:1px solid #ddd;">${idx+1}º</td>
                <td style="padding:8px;border:1px solid #ddd;">${al.nome}</td>
                <td style="padding:8px;border:1px solid #ddd;">${al.turma}</td>
                <td style="text-align:center;border:1px solid #ddd;font-weight:bold;">${al.total} livros</td>
            </tr>`).join('');

        const win = window.open('', '_blank');
        win.document.write(`<html><body><h1 style="color:#4f46e5;text-align:center;">🏆 Top Leitores ${ano}</h1><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f1f1f1;"><th>Pos</th><th>Nome</th><th>Turma</th><th>Total</th></tr></thead><tbody>${linhas}</tbody></table></body></html>`);
        win.document.close();
        setTimeout(() => win.print(), 500);
    } catch (e) { alert("Erro ao gerar ranking. Verifique se o servidor está rodando."); }
};

window.editarEstoque = async function(isbn, titulo, qtd) {
    const nova = prompt(`Novo estoque para: ${titulo}`, qtd);
    if (!nova) return;
    try {
        await fetch(`${API_BASE}/livros/${isbn}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ quantidade: parseInt(nova) })
        });
        window.carregarDados();
    } catch (err) { alert("Erro ao atualizar."); }
};

window.excluirRegistro = async function(tipo, id, nome) {
    if (!confirm(`Excluir ${nome}?`)) return;
    try {
        const res = await fetch(`${API_BASE}/${tipo}/${id}`, { method: 'DELETE' });
        if (res.ok) window.carregarDados();
        else alert("Não foi possível excluir.");
    } catch (e) { alert("Erro de conexão."); }
};