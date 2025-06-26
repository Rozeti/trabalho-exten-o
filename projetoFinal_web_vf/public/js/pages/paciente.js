// public/js/pages/paciente.js
import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import {
  collection, query, where, orderBy,
  getDocs, addDoc, updateDoc, deleteDoc,
  doc, getDoc, Timestamp, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".nav-links a");
  const conteudo = document.getElementById("conteudo-dinamico");

  /* ================================================================
     SEÇÕES – HTML estático que o JS injeta
  ================================================================= */
  const secoes = {
    /* ------------------- HOME ------------------- */
    inicio: nome => `
      <section class="hero">
        <div class="hero-content">
          <div class="hero-text">
            <h1>Bem-vindo, ${nome}!</h1>
            <p>Gerencie suas informações, consulte arquivos enviados e agende suas consultas.</p>
          </div>
          <div class="hero-image">
            <img src="https://img.freepik.com/fotos-gratis/medico-de-tiro-medio-mostrando-resultados-para-o-paciente_23-2148302133.jpg"
                 alt="Área do Paciente"/>
          </div>
        </div>
      </section>`,

    /* ------------------- ARQUIVOS ---------------- */
    arquivos: `
      <section class="services">
        <div class="container">
          <h2>Arquivos enviados pelo nutricionista</h2>

          <!-- resumo da consulta aparece aqui -->
          <div id="resumoCardPaciente" hidden></div>

          <ul id="arquivosList">
            <li>Carregando arquivos…</li>
          </ul>
        </div>
      </section>`,

    /* ------------------- CONSULTAS -------------- */
consultas: `
      <section class="account-section">
        <div class="account-container">
          <h2>Agendar Consulta</h2>
          <form id="agendamentoForm" class="account-form">
            <div class="form-group">
              <label for="dataConsulta">Data da Consulta</label>
              <input type="date" id="dataConsulta" required>
            </div>
            <div class="form-group">
              <label for="horarioConsulta">Horário</label>
              <select id="horarioConsulta" required>
                <option value="">Selecione uma data primeiro</option>
              </select>
            </div>
            <button type="submit" class="btn-login-submit">Agendar Consulta</button>
          </form>
          <div class="titulo-consultas-agendadas">Consultas Agendadas</div>
          <ul id="listaConsultas" class="consultas-agendadas">
            <li>Carregando suas consultas...</li>
          </ul>
        </div>
      </section>
    `,
    "minha-conta": `
      <section class="account-section">
        <div class="account-container">
          <h2>Minha Conta</h2>
          <form id="accountForm" class="account-form">
            <div class="form-group">
              <label for="accountNome">Nome completo</label>
              <input type="text" id="accountNome" required>
            </div>
            <div class="form-group">
              <label for="accountEmail">E-mail</label>
              <input type="email" id="accountEmail" readonly>
            </div>
            <div class="form-group">
              <label for="accountTelefone">Telefone</label>
              <input type="tel" id="accountTelefone" required>
            </div>
            <div class="form-group">
              <label for="accountDataNascimento">Data de Nascimento</label>
              <input type="date" id="accountDataNascimento" required>
            </div>


            <div class="password-section">
              <h3>Alterar Senha</h3>
              <div class="form-group">
                <label for="currentPassword">Senha Atual (opcional)</label>
                <input type="password" id="currentPassword" placeholder="••••••••">
              </div>
              <div class="form-group">
                <label for="newPassword">Nova Senha</label>
                <input type="password" id="newPassword" placeholder="••••••••">
              </div>
              <div class="form-group">
                <label for="confirmPassword">Confirmar Nova Senha</label>
                <input type="password" id="confirmPassword" placeholder="••••••••">
              </div>
            </div>

            <button type="submit" class="btn-login-submit">Salvar Alterações</button>
            <button type="button" class="btn-delete-account">Excluir minha conta</button>
          </form>
        </div>
      </section>`
  };

  /* ================================================================
     NAVEGAÇÃO
  ================================================================= */
  async function carregarSecao(secao) {
    const user = auth.currentUser;
    if (!user) return;

    // Busca nome do paciente
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    const nome = userSnap.exists() ? userSnap.data().nome : "Paciente";

    // Injeta HTML
    conteudo.innerHTML = secao === "inicio"
      ? secoes.inicio(nome)
      : secoes[secao];

    navLinks.forEach(link =>
      link.classList.toggle("active", link.dataset.section === secao)
    );

    if (secao === "arquivos") {
      await carregarArquivos();
    }
    if (secao === "consultas") {
      configurarAgendamento();
      await carregarConsultasDoPaciente();
    }
    if (secao === "minha-conta") {
      await carregarDadosConta();
    }
  }


  /* ================================================================
     LISTA DE ARQUIVOS + RESUMO
  ================================================================= */
  async function carregarArquivos() {
    const ul   = document.getElementById("arquivosList");
    const card = document.getElementById("resumoCardPaciente");

    ul.innerHTML   = "<li>Carregando arquivos…</li>";
    card.hidden    = true;
    card.innerHTML = "";

    const user = auth.currentUser;
    const snaps = await getDocs(
      query(
        collection(db, "arquivosMeta"),
        where("pacienteId", "==", user.uid),
        orderBy("data", "desc")
      )
    );

    if (snaps.empty) { ul.innerHTML = "<li>Nenhum arquivo enviado.</li>"; return; }
    ul.innerHTML = "";

    /* percorre manualmente p/ poder usar await */
    for (const docSnap of snaps.docs) {
      const f = docSnap.data();
/* ----------- RESUMO ----------- */
if (f.categoria === "Resumo" || f.nome === "Resumo da consulta") {
  try {
    const txt = await fetch(f.url).then(r => r.text());

    /* 1. Lê linha-a-linha, acumulando até encontrar o próximo rótulo ----- */
    const info = {};
    let atual  = null;               // chave corrente (motivacao, etc.)
    txt.split(/\r?\n/).forEach(linha => {
      const rot = linha.match(/^([A-Za-zÀ-ÖØ-öø-ÿ ]+):\s*(.*)$/); // “Rótulo:”
      if (rot) {
        // normaliza “Motivação”, “Expectativas”…
        atual = rot[1].toLowerCase()
                      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
                      .replace(/\s+/g,"");          // motivacao / expectativas …
        info[atual] = rot[2].trim();               // já inicia com 1ª frase
      } else if (atual) {
        // continua o mesmo tópico → mantém quebras de parágrafo
        info[atual] += (info[atual] ? "<br>" : "") + linha.trim();
      }
    });

    /* 2. Injeta a estrutura visual do card ------------------------------- */
    card.innerHTML = `
      <h3 class="titulo-resumo">Resumo da consulta</h3>
      <div class="linha"></div>
      <div class="resumo-grid"></div>`;
    card.hidden = false;

    /* 3. Mesmo renderer usado pela nutricionista ------------------------- */
    function renderResumoConsulta(o) {
      const grid = card.querySelector(".resumo-grid");
      const campos = [
        ["Motivação",          "motivacao"],
        ["Expectativas",       "expectativas"],
        ["Objetivos clínicos", "objetivosclinicos"],
        ["Metas",              "metas"]
      ];
      grid.innerHTML = campos.map(([rot, k]) => {
        const val = o[k];
        return val ? `<div><strong>${rot}</strong><p>${val}</p></div>` : "";
      }).join("");
    }
    renderResumoConsulta(info);

  } catch (err) {
    console.error("Falha ao baixar o resumo:", err);
  }
  continue;            // não lista o arquivo na UL
}



      /* ----------- ARQUIVOS NORMAIS ----------- */
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="${f.url}" target="_blank">${f.nome}</a>
        <span>(${f.data})</span>`;
      ul.appendChild(li);
    }
  }

  /* ================================================================
     AGENDAMENTO DE CONSULTAS  (sem alterações)
  ================================================================= */
  function configurarAgendamento() {
    const dateInput = document.getElementById("dataConsulta");
    const timeSelect = document.getElementById("horarioConsulta");
    dateInput.min = new Date().toISOString().split("T")[0];

    dateInput.addEventListener("change", async () => {
      const dateVal = dateInput.value;
      timeSelect.innerHTML = `<option>Carregando horários...</option>`;
      if (!dateVal) {
        timeSelect.innerHTML = `<option>Selecione uma data</option>`;
        return;
      }
      const [y, m, d] = dateVal.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      if ([0, 6].includes(dt.getDay())) {
        alert("Somente de segunda a sexta.");
        dateInput.value = "";
        timeSelect.innerHTML = `<option>Selecione uma data</option>`;
        return;
      }
      const snap = await getDocs(
        query(
          collection(db, "consultas"),
          where("dataOrdenacao", "==", dateVal),
          where("status", "==", "agendada")
        )
      );
      const ocupados = snap.docs.map(d => d.data().horario);
      timeSelect.innerHTML = `<option value="">Selecione</option>`;
      for (let h = 11; h <= 17; h++) {
        ["00", "30"].forEach(mm => {
          const hora = `${String(h).padStart(2, "0")}:${mm}`;
          if (!ocupados.includes(hora)) {
            timeSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
          }
        });
      }
      if (!ocupados.includes("18:00")) {
        timeSelect.innerHTML += `<option value="18:00">18:00</option>`;
      }
      if (timeSelect.options.length === 1) {
        timeSelect.innerHTML = `<option>Nenhum horário</option>`;
      }
    });

    document.getElementById("agendamentoForm")
      .addEventListener("submit", async e => {
        e.preventDefault();
        const dateVal = dateInput.value;
        const timeVal = timeSelect.value;
        if (!dateVal || !timeVal) {
          alert("Selecione data e horário.");
          return;
        }
        const user = auth.currentUser;
        const ts = Timestamp.fromDate(
          new Date(
            ...dateVal.split("-").map(Number),
            ...timeVal.split(":").map(Number)
          )
        );
        const usuarioSnap = await getDoc(doc(db, "usuarios", user.uid));
        await addDoc(collection(db, "consultas"), {
          pacienteUid: user.uid,
          pacienteNome: usuarioSnap.data().nome,
          nutricionistaUid: "pBOn2cvKD2eaJpyOF2493if8bHy2",
          data: dateVal.split("-").reverse().join("/"),
          dataOrdenacao: dateVal,
          horario: timeVal,
          timestampConsulta: ts,
          status: "agendada",
          dataAgendamento: serverTimestamp()
        });
        alert(`Consulta agendada em ${dateVal} às ${timeVal}.`);
        e.target.reset();
        await carregarConsultasDoPaciente();
      });
  }
async function carregarConsultasDoPaciente() {
    const ul = document.getElementById("listaConsultas");
    ul.innerHTML = `<li>Carregando suas consultas...</li>`;
    const user = auth.currentUser;
    const snap = await getDocs(
      query(
        collection(db, "consultas"),
        where("pacienteUid", "==", user.uid),
        where("status", "==", "agendada"),
        orderBy("timestampConsulta", "asc")
      )
    );
    if (snap.empty) {
      ul.innerHTML = `<li>Nenhuma consulta agendada.</li>`;
      return;
    }
    ul.innerHTML = "";
    snap.forEach(docSnap => {
      const c = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="consulta-info">
          <div class="consulta-data">${c.data}</div>
          <div class="consulta-horario">${c.horario}</div>
        </div>
        <button class="btn-cancelar">Cancelar</button>
      `;
      li.querySelector(".btn-cancelar").addEventListener("click", async () => {
        const diffH = (c.timestampConsulta.toDate() - new Date()) / 1000 / 3600;
        if (diffH < 24) {
          alert("Só pode cancelar 24h antes.");
          return;
        }
        await updateDoc(doc(db, "consultas", docSnap.id), {
          status: "cancelada_paciente"
        });
        await carregarConsultasDoPaciente();
      });
      ul.appendChild(li);
    });
  }


  /* ================================================================
     DADOS DA CONTA  (inalterado)
  ================================================================= */
    async function carregarDadosConta() {
    const user = auth.currentUser;
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  const data = snap.data() || {};

  accountNome.value           = data.nome       || "";
  accountEmail.value          = data.email      || "";
  accountTelefone.value       = data.telefone   || "";
  accountDataNascimento.value = data.nascimento || "";

  /* ---------- toggle “ver senha” ---------- */
  ["currentPassword", "newPassword", "confirmPassword"].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;

    input.style.paddingRight = "2.5rem";
    input.parentElement.style.position = "relative";

    const eye    = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
    const eyeOff = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.81 21.81 0 0 1 5.06-6.88"/><path d="m1 1 22 22"/><path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"/></svg>`;

    input.insertAdjacentHTML(
      "afterend",
      `<button type="button" class="toggle-pass" aria-label="Mostrar senha">${eye}</button>`
    );

    const btn = input.parentElement.querySelector(".toggle-pass:last-child");
    btn.onclick = () => {
      const open = input.type === "password";
      input.type = open ? "text" : "password";
      btn.innerHTML = open ? eyeOff : eye;
    };
  });

  /* ---------- submit ---------- */
  accountForm.onsubmit = async e => {
    e.preventDefault();

    const curr = currentPassword.value;
    const nova = newPassword.value;
    const conf = confirmPassword.value;

    if (nova) {
      if (!curr)                   return alert("Digite a senha atual.");
      if (nova.length < 6)         return alert("A senha deve ter 6+ caracteres.");
      if (nova !== conf)           return alert("Nova senha e confirmação não conferem.");

      const cred = EmailAuthProvider.credential(user.email, curr);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, nova);
    }

    await updateDoc(doc(db,"usuarios",user.uid), {
      nome       : accountNome.value,
      telefone   : accountTelefone.value,
      nascimento : accountDataNascimento.value
    });

    alert("Dados atualizados!");
    currentPassword.value = newPassword.value = confirmPassword.value = "";
  };

  /* ---------- excluir conta ---------- */
  document.querySelector(".btn-delete-account").onclick = async () => {
    if (!confirm("Excluir conta? Isso não pode ser desfeito.")) return;
    await deleteDoc(doc(db, "usuarios", user.uid));
    await user.delete();
    alert("Conta excluída.");
    location.href = "index.html";
  };
}
  /* ================================================================
     EVENTOS GLOBAIS
  ================================================================= */
  navLinks.forEach(link => link.addEventListener("click", e => {
    e.preventDefault();
    carregarSecao(link.dataset.section);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));

  onAuthStateChanged(auth, user => {
    if (!user) location.href = "login.html";
    else carregarSecao("inicio");
  });
});

/* =================================================================
   CSS sugerido (adicione no seu paciente.css se quiser o estilo verde)
=================================================================== */
/*
#resumoCardPaciente{
  background:#F3FFF3;border-left:4px solid #0AA64E;border-radius:4px;
  padding:24px;margin:24px 0;
}
#resumoCardPaciente .titulo-resumo{color:#0AA64E;margin:0 0 8px 0;}
*/
