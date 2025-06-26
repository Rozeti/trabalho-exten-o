/* public/js/pages/nutricionista.js
   – agenda + agendamento funcionais
   – autocomplete + cartão-resumo do paciente no agendamento
   – “Minha Conta” ligada ao Firestore                                  */

import { auth, db, storage } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import {
  collection, query, where, orderBy,
  getDocs, addDoc, updateDoc, deleteDoc,
  doc, getDoc, Timestamp, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes, getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".nav-links a");
  const conteudo = document.getElementById("conteudo-dinamico");

  /* =============================================================
     SEÇÕES DINÂMICAS
  ============================================================= */
  const secoes = {
    /* ---------- HOME ---------- */
    inicio: nome => `
      <section class="hero">
        <div class="hero-content">
          <div class="hero-text">
            <h1>Bem-vinda, Dra. ${nome}!</h1>
            <p>Sua plataforma completa para gerenciar pacientes, agendas e informações importantes.</p>
          </div>
          <div class="hero-image"><img src="assets/nath_1.png" /></div>
        </div>
      </section>`,

    /* ---------- PACIENTES ---------- */
    pacientes: `
      <section class="account-section">
        <div class="account-container">
          <h2>Gerenciar Pacientes</h2>
          <div class="search-box"><input type="text" id="searchPatient" placeholder="Buscar paciente..." /></div>
          <div class="patient-list" id="patientList"><p>Digite ao menos 2 letras para buscar.</p></div>
          <div id="detalhePaciente"></div>
        </div>
      </section>`,

    /* ---------- AGENDA ---------- */
    agenda: `
      <section class="account-section">
        <div class="account-container">
          <h2>Agenda</h2>
          <div id="agendaContainer" class="agenda-container"></div>
        </div>
      </section>`,

    /* ---------- AGENDAR CONSULTA ---------- */
    "agendar-consulta": `
      <section class="account-section">
        <div class="account-container">
          <h2>Agendar Consulta</h2>
          <form id="agendarConsultaForm" class="account-form">
            <div class="form-group" style="position:relative">
              <label for="pacienteSelect">Paciente</label>
              <input type="text" id="pacienteSelect" placeholder="Digite ao menos 2 letras">
              <input type="hidden" id="pacienteId">
              <div id="pacienteSugestoes" class="sugestoes-list"></div>
            </div>

            <!-- cartão-resumo aparecerá aqui -->
            <div id="pacienteInfoAgendamento" class="paciente-info-card" hidden></div>

            <div class="form-group"><label for="dataConsulta">Data</label><input type="date" id="dataConsulta" required></div>

            <div class="form-group">
              <label for="horarioConsulta">Horário</label>
              <select id="horarioConsulta" required><option value="">Selecione uma data primeiro</option></select>
            </div>

            <div class="form-group">
              <label for="tipoConsulta">Tipo</label>
              <select id="tipoConsulta" required>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
              </select>
            </div>

            <div class="form-group"><label for="observacoesConsulta">Observações</label><textarea id="observacoesConsulta" rows="3"></textarea></div>

            <button type="submit" class="btn-login-submit">Agendar Consulta</button>
          </form>
        </div>
      </section>`,

    /* ---------- MINHA CONTA ---------- */
    "minha-conta": `
      <section class="account-section">
        <div class="account-container">
          <h2>Minha Conta</h2>
          <form id="accountForm" class="account-form">
            <div class="form-group"><label for="accountNome">Nome completo</label><input type="text" id="accountNome" required></div>
            <div class="form-group"><label for="accountEmail">E-mail</label><input type="email" id="accountEmail" readonly></div>
            <div class="form-group"><label for="accountTelefone">Telefone</label><input type="tel" id="accountTelefone" required></div>
            <div class="form-group"><label for="accountDataNascimento">Data de Nascimento</label><input type="date" id="accountDataNascimento" required></div>

            <div class="password-section">
              <h3>Alterar Senha</h3>
              <div class="form-group"><label for="currentPassword">Senha Atual (opcional)</label><input type="password" id="currentPassword" placeholder="••••••••"></div>
              <div class="form-group"><label for="newPassword">Nova Senha</label><input type="password" id="newPassword" placeholder="••••••••"></div>
              <div class="form-group"><label for="confirmPassword">Confirmar Nova Senha</label><input type="password" id="confirmPassword" placeholder="••••••••"></div>
            </div>

            <button type="submit" class="btn-login-submit">Salvar Alterações</button>
            <button type="button" class="btn-delete-account">Excluir minha conta</button>
          </form>
        </div>
      </section>`
  };

  /* =============================================================
     NAVEGAÇÃO ENTRE SEÇÕES
  ============================================================= */
  async function carregarSecao(secao = "inicio") {
    const user = auth.currentUser;
    if (!user) return;
    let nome = "Nutricionista";
    try { const s = await getDoc(doc(db,"usuarios",user.uid)); if (s.exists()) nome = s.data().nome || nome; } catch{}

    conteudo.innerHTML = secao==="inicio" ? secoes.inicio(nome) : (secoes[secao]||"<p>Seção não encontrada.</p>");
    navLinks.forEach(a=>a.classList.toggle("active",a.dataset.section===secao));
    localStorage.setItem("secaoAtivaNutri",secao);

    if (secao==="pacientes")             configurarBuscaPacientes();
    else if (secao==="agenda")           carregarAgenda();
    else if (secao==="agendar-consulta") configurarAgendamento();
    else if (secao==="minha-conta")      carregarDadosNutricionista();
  }
  /* =============================================================
     BUSCA PACIENTES
  ============================================================= */
  async function configurarBuscaPacientes() {
    const input   = document.getElementById("searchPatient");
    const lista   = document.getElementById("patientList");
    const detalhe = document.getElementById("detalhePaciente");
    let to;

    input.addEventListener("input", () => {
      clearTimeout(to);
      lista.innerHTML   = "<p>Buscando...</p>";
      detalhe.innerHTML = "";
      to = setTimeout(async () => {
        const termo = input.value.trim().toLowerCase();
        if (termo.length < 2) { lista.innerHTML = "<p>Digite ao menos 2 letras.</p>"; return; }

        const snap = await getDocs(query(collection(db, "usuarios"), where("role", "==", "paciente")));
        const hits = [];
        snap.forEach(s => {
          const u = s.data();
          if (u.nome.toLowerCase().includes(termo) || (u.email && u.email.toLowerCase().includes(termo)))
            hits.push({ id: s.id, ...u });
        });

        if (!hits.length) { lista.innerHTML = "<p>Nenhum paciente encontrado.</p>"; return; }

        lista.innerHTML = "";
        hits.forEach(u => {
          const card = document.createElement("div");
          card.className = "patient-card";
          card.innerHTML = `<strong>${u.nome}</strong><br><small>${u.email}</small>`;
          card.onclick   = () => mostrarDetalhePaciente(u.id);
          lista.appendChild(card);
        });
      }, 300);
    });
  }

  /* =============================================================
     DETALHE DO PACIENTE (sem card-resumo; upload intacto)
  ============================================================= */
  async function mostrarDetalhePaciente(pid) {
    const detalhe = document.getElementById("detalhePaciente");
    const snap    = await getDoc(doc(db, "usuarios", pid));
    if (!snap.exists()) return;
    const d = snap.data();

    /* idade */
    let idadeText = "Nascimento não informado";
    if (d.nascimento) {
      const [y, m, day] = d.nascimento.split("-").map(Number);
      const birth       = new Date(y, m - 1, day);
      const age         = new Date().getFullYear() - birth.getFullYear();
      idadeText         = `${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y} (${age} anos)`;
    }

    /* ---------- template ---------- */
    detalhe.innerHTML = `
      <div class="patient-details-card">
        <div class="patient-details-header">
          <div class="patient-basic-info">
            <h3>${d.nome}</h3>
            <p>${d.profissao || "Profissão não informada"}</p>
            <p>${idadeText}</p>
          </div>
          <div class="patient-actions">
            <button class="btn-message">Enviar mensagem</button>
            <button class="btn-schedule">Agendar consulta</button>
          </div>
        </div>

        <form id="consultaForm" class="consulta-form">
          <h4 class="section-title">Informações de consulta</h4>
          <div class="form-group"><label for="motivacao">Motivação</label><textarea id="motivacao"></textarea></div>
          <div class="form-group"><label for="expectativas">Expectativas</label><textarea id="expectativas"></textarea></div>
          <div class="form-group"><label for="objetivosClinicos">Objetivos clínicos</label><textarea id="objetivosClinicos"></textarea></div>
          <div class="form-group"><label for="outrasInfo">Outras informações da consulta</label><textarea id="outrasInfo"></textarea></div>

          <h4 class="section-title">Metas</h4>
          <div class="form-group"><textarea id="metas"></textarea></div>
          <button type="submit" class="btn-consulta-submit">Salvar Informações</button>
        </form>

        <div class="arquivos-card">
          <div class="arquivos-header">
            <div><h4>Arquivos</h4><small>Anexos do cliente</small></div>
            <div class="arquivos-acoes">
              <button class="icon-button" title="Filtrar arquivos">☰</button>
              <button id="openFileModal" class="icon-button" title="Adicionar arquivo">＋</button>
            </div>
          </div>
          <div class="arquivos-lista"><div class="loading-bar"></div><p><em>Carregando arquivos...</em></p></div>
        </div>

        <!-- modal upload -->
        <div id="fileModal" class="modal">
          <div class="modal-content">
            <span id="closeFileModal" class="close">&times;</span>
            <h3>Adicionar arquivo</h3>
            <form id="fileForm">
              <div class="form-group"><label for="fileInput">Arquivo</label><input type="file" id="fileInput" required></div>
              <div class="form-group"><label for="fileName">Nome</label><input type="text" id="fileName" required></div>
              <div class="form-group"><label for="fileDesc">Descrição</label><textarea id="fileDesc" rows="2"></textarea></div>
              <div class="form-group"><label for="fileDate">Data</label><input type="text" id="fileDate" readonly></div>
              <div class="form-group">
                <label for="fileCategory">Categoria</label>
                <select id="fileCategory">
                  <option>Foto</option><option>Plano alimentar</option><option>Análises clínicas</option>
                  <option>Privacidade/Consentimento</option><option>Informações do cliente</option><option selected>Outro</option>
                </select>
              </div>
              <button type="submit" class="btn-login-submit">Enviar</button>
            </form>
          </div>
        </div>
      </div>`;

    /* refs DOM */
    const formConsulta  = detalhe.querySelector("#consultaForm");
    const listaArquivos = detalhe.querySelector(".arquivos-lista");
    const modal         = document.getElementById("fileModal");
    const btnOpen       = document.getElementById("openFileModal");
    const btnClose      = document.getElementById("closeFileModal");
    const fileForm      = document.getElementById("fileForm");
    const fileDate      = document.getElementById("fileDate");
    fileDate.value      = new Date().toLocaleDateString("pt-BR");

    /* carrega info já salvas */
    const infoSnap = await getDoc(doc(db, "consultasInfo", pid));
    if (infoSnap.exists()) {
      const info = infoSnap.data();
      [
        "motivacao","expectativas","objetivosClinicos","outrasInfo",
        "metas"
      ].forEach(k => {
        const el = detalhe.querySelector(`#${k}`);
        if (el && info[k] != null) el.value = info[k];
      });
    }

    /* salvar formulário */
    formConsulta.onsubmit = async e => {
      e.preventDefault();
      const payload = {};
      [
        "motivacao","expectativas","objetivosClinicos","outrasInfo","metas"
      ].forEach(k => {
        const el = detalhe.querySelector(`#${k}`);
        if (el) payload[k] = el.value.trim();
      });
      payload.updatedAt = new Date();
      await setDoc(doc(db, "consultasInfo", pid), payload, { merge: true });
      alert("Informações salvas!");
    };

    /* whatsapp / agendar */
    detalhe.querySelector(".btn-message").onclick  = () => {
      const tel = d.telefone ? d.telefone.replace(/\D/g, "") : "";
      if (!tel) return alert("Telefone não informado");
      window.open(`https://wa.me/${tel}`, "_blank");
    };
    detalhe.querySelector(".btn-schedule").onclick = () => {
      carregarSecao("agendar-consulta");
      document.getElementById("pacienteId").value  = pid;
      document.getElementById("pacienteSelect").value = d.nome;
    };

    /* modal upload */
    btnOpen.onclick  = () => modal.style.display = "block";
    btnClose.onclick = () => { modal.style.display = "none"; fileForm.reset(); };
    window.onclick   = e => { if (e.target === modal) { modal.style.display = "none"; fileForm.reset(); } };

    /* lista arquivos */
    async function carregarArquivos() {
      listaArquivos.innerHTML = "<p><em>Carregando...</em></p>";
      const snaps = await getDocs(query(collection(db, "arquivosMeta"), where("pacienteId", "==", pid), orderBy("data", "desc")));
      if (snaps.empty) return listaArquivos.innerHTML = "<p><em>Nenhum arquivo.</em></p>";
      listaArquivos.innerHTML = "";
      snaps.forEach(s => {
        const a = s.data();
        const item = document.createElement("div");
        item.className = "arquivo-item";
        item.innerHTML = `
          <div class="arquivo-info">
            <a href="${a.url}" target="_blank"><strong>${a.nome}</strong></a>
            <span class="arquivo-meta">${a.categoria} • ${a.data}</span>
            <p class="arquivo-desc">${a.descricao || ""}</p>
          </div>
          <button class="btn-del-arq" data-doc-id="${s.id}" data-file-path="${a.filePath}" data-file-name-display="${a.nome}">🗑</button>`;
        listaArquivos.appendChild(item);
      });
    }
    await carregarArquivos();

    listaArquivos.onclick = async ev => {
      const btn = ev.target.closest(".btn-del-arq");
      if (!btn) return;
      const { docId, filePath, fileNameDisplay } = btn.dataset;
      if (!confirm(`Excluir “${fileNameDisplay}”?`)) return;
      try { await deleteObject(storageRef(storage, filePath)); } catch {}
      await deleteDoc(doc(db, "arquivosMeta", docId));
      await carregarArquivos();
    };

    /* upload */
    fileForm.onsubmit = async e => {
      e.preventDefault();
      if (!fileForm.fileInput.files.length) return alert("Selecione um arquivo.");
      const f    = fileForm.fileInput.files[0];
      const path = `arquivos/${pid}/${f.name}`;
      const ref  = storageRef(storage, path);
      await uploadBytes(ref, f);
      const url  = await getDownloadURL(ref);
      await setDoc(doc(db, "arquivosMeta", `${pid}_${f.name}`), {
        pacienteId: pid,
        nome      : fileForm.fileName.value.trim(),
        descricao : fileForm.fileDesc.value.trim(),
        data      : fileForm.fileDate.value,
        categoria : fileForm.fileCategory.value,
        url, filePath: path
      });
      modal.style.display = "none";
      fileForm.reset();
      alert("Arquivo enviado!");
      await carregarArquivos();
    };
  }

  /* =============================================================
     AGENDAR CONSULTA – autocomplete + resumo
  ============================================================= */
  function configurarAgendamento(){
    const form       = document.getElementById("agendarConsultaForm");
    const dateInput  = document.getElementById("dataConsulta");
    const timeSelect = document.getElementById("horarioConsulta");
    const pacienteId = document.getElementById("pacienteId");
    const pacienteIn = document.getElementById("pacienteSelect");
    const listaSug   = document.getElementById("pacienteSugestoes");
    const cardInfo   = document.getElementById("pacienteInfoAgendamento");
    let dbTimer=null;

    /* ---------- autocomplete ---------- */
    pacienteIn.oninput = ()=>{
      clearTimeout(dbTimer);
      listaSug.innerHTML=""; pacienteId.value=""; cardInfo.hidden=true;
      const termo=pacienteIn.value.trim().toLowerCase();
      if(termo.length<2)return;
      dbTimer=setTimeout(async()=>{
        const snap=await getDocs(query(collection(db,"usuarios"),where("role","==","paciente")));
        const res=[];
        snap.forEach(s=>{
          const d=s.data();
          if(d.nome.toLowerCase().includes(termo)||(d.email&&d.email.toLowerCase().includes(termo)))
            res.push({id:s.id,...d});
        });
        if(!res.length){listaSug.innerHTML=`<div class="no-sugg">Nenhum resultado</div>`;return;}
        res.forEach(p=>{
          const div=document.createElement("div");
          div.className="sugg-item";
          div.innerHTML=`<strong>${p.nome}</strong><br><small>${p.email}</small>`;
          div.onclick=()=>{ selecionarPaciente(p); };
          listaSug.appendChild(div);
        });
      },300);
    };
    document.addEventListener("click",e=>{if(!pacienteIn.parentElement.contains(e.target))listaSug.innerHTML="";});

    async function selecionarPaciente(p){
      pacienteId.value  = p.id;
      pacienteIn.value  = p.nome;
      listaSug.innerHTML="";
    }

    /* ---------- datas/horários ---------- */
    dateInput.min=new Date().toISOString().split("T")[0];
    dateInput.onchange=async()=>{
      const val=dateInput.value;
      timeSelect.innerHTML="<option>Carregando…</option>";
      if(!val){timeSelect.innerHTML="<option>Selecione data</option>";return;}
      const dt=new Date(val+"T00:00:00");
      if([0,6].includes(dt.getDay())){alert("Agende apenas de segunda a sexta.");dateInput.value="";timeSelect.innerHTML="<option>Selecione data</option>";return;}
      const snap=await getDocs(query(collection(db,"consultas"),where("dataOrdenacao","==",val),where("status","==","agendada")));
      const ocupados=snap.docs.map(d=>d.data().horario);
      timeSelect.innerHTML="<option value=''>Selecione</option>";
      for(let h=11;h<=18;h++){
        ["00","30"].forEach(mm=>{
          const hh=`${String(h).padStart(2,"0")}:${mm}`;
          if(!ocupados.includes(hh))timeSelect.innerHTML+=`<option value="${hh}">${hh}</option>`;
        });
      }
      if(timeSelect.length===1)timeSelect.innerHTML="<option>Nenhum horário livre</option>";
    };

    /* ---------- submit ---------- */
    form.onsubmit=async e=>{
      e.preventDefault();
      if(!pacienteId.value)return alert("Selecione um paciente.");
      if(!dateInput.value||!timeSelect.value)return alert("Data/hora obrigatórios.");
      const ts=Timestamp.fromDate(new Date(...dateInput.value.split("-").map(Number),...timeSelect.value.split(":")));
      const pacSnap=await getDoc(doc(db,"usuarios",pacienteId.value));
      await addDoc(collection(db,"consultas"),{
        pacienteUid      :pacienteId.value,
        pacienteNome     :pacSnap.exists()?pacSnap.data().nome:"",
        nutricionistaUid :auth.currentUser.uid,
        data             :dateInput.value.split("-").reverse().join("/"),
        dataOrdenacao    :dateInput.value,
        horario          :timeSelect.value,
        tipo             :document.getElementById("tipoConsulta").value,
        observacoes      :document.getElementById("observacoesConsulta").value.trim(),
        timestampConsulta:ts,
        status:"agendada",
        dataAgendamento  :serverTimestamp()
      });
      alert("Consulta agendada!");
      form.reset(); cardInfo.hidden=true;
      timeSelect.innerHTML="<option>Selecione uma data primeiro</option>";
      carregarSecao("agenda");
    };
  }

/* =============================================================
   AGENDA — lista + cancelamento
============================================================= */
async function carregarAgenda(){
  const cont = document.getElementById("agendaContainer");
  if (!cont) return;

  cont.innerHTML = "<p>Carregando agenda…</p>";

  /* puxa TODAS as consultas agendadas — do paciente ou da nutri   */
  const snap = await getDocs(
    query(
      collection(db,"consultas"),
      where("nutricionistaUid","==",auth.currentUser.uid),
      where("status","==","agendada")
    )
  );

  if (snap.empty){
    cont.innerHTML = "<p>Nenhuma consulta agendada.</p>";
    return;
  }

  /* agrupa por data ------------------------------------------- */
  const porDia = {};
  snap.forEach(docSnap=>{
    const c = docSnap.data();
    porDia[c.data] ??= [];
    porDia[c.data].push({id:docSnap.id, ...c});
  });

  /* monta cards ------------------------------------------------ */
  cont.innerHTML = "";
  Object.keys(porDia)
    .sort((a,b)=>{
      const [d1,m1,y1]=a.split("/").map(Number);
      const [d2,m2,y2]=b.split("/").map(Number);
      return new Date(y1,m1-1,d1) - new Date(y2,m2-1,d2);
    })
    .forEach(data=>{
      const card = document.createElement("div");
      card.className = "day-card";
      card.innerHTML = `<h3 class="day-title">${data}</h3>`;

      porDia[data]
        .sort((x,y)=>x.horario.localeCompare(y.horario))
        .forEach(c=>{
          const linha = document.createElement("div");
          linha.className = "appointment-item";
          linha.innerHTML = `
            <div>
              <strong>${c.horario}</strong> — ${c.pacienteNome || "Paciente"}
            </div>
            <button class="btn-cancel-agenda" data-id="${c.id}"
                    data-when="${c.timestampConsulta.seconds}">
              Cancelar
            </button>`;
          card.appendChild(linha);
        });

      cont.appendChild(card);
    });

  /* -----------------------------------------------------------
     CANCELAR (24 h de antecedência)
  ----------------------------------------------------------- */
  cont.onclick = async ev=>{
    const btn = ev.target.closest(".btn-cancel-agenda");
    if (!btn) return;

    const id        = btn.dataset.id;
    const tsSeconds = Number(btn.dataset.when);
    const diffHours = (tsSeconds*1000 - Date.now()) / 3_600_000;

    if (diffHours < 24){
      return alert("Só é possível cancelar com pelo menos 24 h de antecedência.");
    }
    if (!confirm("Confirmar cancelamento da consulta?")) return;

    await updateDoc(doc(db,"consultas",id),{
      status:"cancelada_nutricionista",
      dataCancelamento: serverTimestamp()
    });

    /* recarrega lista */
    await carregarAgenda();
  };
}

/* =============================================================
   MINHA CONTA – Nutricionista
============================================================= */
async function carregarDadosNutricionista () {
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


  /* =============================================================
     EVENTOS GLOBAIS
  ============================================================= */
  navLinks.forEach(l => l.onclick = e => { e.preventDefault(); carregarSecao(l.dataset.section); });
  onAuthStateChanged(auth, u => { if (!u) location.href = "login.html"; else carregarSecao(localStorage.getItem("secaoAtivaNutri") || "inicio"); });
  document.getElementById("logoutBtn").onclick = async () => { try { await auth.signOut(); location.href = "login.html"; } catch(e){ alert("Erro ao sair"); }};
}); /* DOMContentLoaded */
