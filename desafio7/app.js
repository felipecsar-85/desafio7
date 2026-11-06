const app = document.getElementById("app");

// ---------- API simulada (dados locais em português) ----------
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Guardamos a Promise (e não só o resultado), assim chamadas simultâneas
// reutilizam a mesma requisição ao dados.json
let dbPromise;
function db() {
  dbPromise ??= fetch("dados.json").then((res) => {
    if (!res.ok) throw new Error("Não foi possível carregar os dados.");
    return res.json();
  });
  return dbPromise;
}

const api = {
  async listarPosts() {
    await delay(300);
    return (await db()).posts;
  },
  async obterPost(id) {
    await delay(400);
    const post = (await db()).posts.find((p) => p.id === Number(id));
    if (!post) throw new Error("Post não encontrado.");
    return post;
  },
  async listarComentarios(id) {
    await delay(600);
    return (await db()).comentarios.filter((c) => c.postId === Number(id));
  },
  async enviarComentario(postId, dados) {
    await delay(500);
    const novo = { id: Date.now(), postId: Number(postId), ...dados };
    (await db()).comentarios.push(novo); // persiste só enquanto a página está aberta
    return novo;
  },
};

// ---------- Escapa HTML (evita injeção via comentários) ----------
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Página: lista de posts ----------
async function renderList() {
  app.innerHTML = "<p>Carregando posts...</p>";
  try {
    const posts = await api.listarPosts();
    app.innerHTML = posts
      .map(
        (p) => `
        <article class="card">
          <h2>${esc(p.title)}</h2>
          <p>${esc(p.body.slice(0, 100))}...</p>
          <a href="#/post/${p.id}">Ler mais →</a>
        </article>`
      )
      .join("");
  } catch (err) {
    app.innerHTML = `<p class="msg">${esc(err.message)}</p>`;
  }
}

// ---------- Página: detalhe do post + comentários ----------
async function renderPost(id) {
  app.innerHTML = "<p>Carregando post...</p>";
  try {
    // Requisições SIMULTÂNEAS: post e comentários disparam ao mesmo tempo
    const [post, comments] = await Promise.all([
      api.obterPost(id),
      api.listarComentarios(id),
    ]);

    app.innerHTML = `
      <a href="#/">← Voltar</a>
      <article class="card">
        <h2>${esc(post.title)}</h2>
        <p>${esc(post.body)}</p>
      </article>

      <h3>Comentários (<span id="count">${comments.length}</span>)</h3>
      <div id="comments">${comments.map(commentHTML).join("")}</div>

      <form id="comment-form">
        <input name="name" placeholder="Seu nome" required />
        <input name="email" type="email" placeholder="Seu e-mail" required />
        <textarea name="body" rows="3" placeholder="Seu comentário" required></textarea>
        <button type="submit">Enviar comentário</button>
        <p class="msg" id="form-msg"></p>
      </form>`;

    document.getElementById("comment-form").addEventListener("submit", (e) => sendComment(e, id));
  } catch (err) {
    app.innerHTML = `<a href="#/">← Voltar</a><p class="msg">${esc(err.message)}</p>`;
  }
}

function commentHTML(c) {
  return `
    <div class="comment">
      <strong>${esc(c.name)}</strong><br />
      <small>${esc(c.email)}</small>
      <p>${esc(c.body)}</p>
    </div>`;
}

// ---------- Envio de novo comentário ----------
async function sendComment(e, postId) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector("button");
  const msg = document.getElementById("form-msg");
  const data = Object.fromEntries(new FormData(form));

  btn.disabled = true;
  msg.textContent = "";

  try {
    const created = await api.enviarComentario(postId, data);

    document.getElementById("comments").insertAdjacentHTML("beforeend", commentHTML(created));
    const count = document.getElementById("count");
    count.textContent = Number(count.textContent) + 1;
    form.reset();
  } catch (err) {
    msg.textContent = "Não foi possível enviar o comentário.";
  } finally {
    btn.disabled = false;
  }
}

// ---------- Roteador simples por hash ----------
function router() {
  const match = location.hash.match(/^#\/post\/(\d+)$/);
  match ? renderPost(match[1]) : renderList();
}
window.addEventListener("hashchange", router);
router();