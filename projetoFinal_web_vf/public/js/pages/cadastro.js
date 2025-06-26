// Public/js/pages/cadastro.js
import { auth, db } from "../firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const captchaText  = document.getElementById("captchaText");
  const refreshBtn   = document.getElementById("refreshCaptcha");
  let currentCaptcha = generateCaptcha();
  captchaText.textContent = currentCaptcha;

  refreshBtn.addEventListener("click", () => {
    currentCaptcha = generateCaptcha();
    captchaText.textContent = currentCaptcha;
  });

  function generateCaptcha() {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let cap = "";
    for (let i = 0; i < 6; i++) {
      cap += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return cap;
  }

  const telefoneInput = document.getElementById("telefone");
  telefoneInput.addEventListener("input", e => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 0) v = "(" + v;
    if (v.length > 3) v = v.slice(0,3) + ") " + v.slice(3);
    if (v.length > 10) v = v.slice(0,10) + "-" + v.slice(10);
    e.target.value = v;
  });

  const form = document.getElementById("cadastroForm");
  form.addEventListener("submit", async e => {
    e.preventDefault();

    const nome      = document.getElementById("nome").value.trim();
    const email     = document.getElementById("email").value.trim();
    const telefone  = telefoneInput.value.trim();
    const telNum    = telefone.replace(/\D/g, "");
    const nascimento= document.getElementById("dataNascimento").value;
    const senha     = document.getElementById("senha").value;
    const confirma  = document.getElementById("confirmarSenha").value;
    const captchaIn = document.getElementById("captchaInput").value.trim();
    const role      = document.getElementById("role").value;

    if (senha !== confirma) {
      alert("As senhas não coincidem.");
      return;
    }
    if (captchaIn !== currentCaptcha) {
      alert("Código de verificação incorreto.");
      currentCaptcha = generateCaptcha();
      captchaText.textContent = currentCaptcha;
      document.getElementById("captchaInput").value = "";
      return;
    }
    if (!nascimento) {
      alert("Informe sua data de nascimento.");
      return;
    }
    const dataNasc = new Date(nascimento);
    const hoje     = new Date();
    const minIdade = new Date(hoje.getFullYear()-18,hoje.getMonth(),hoje.getDate());
    if (dataNasc > minIdade) {
      alert("Você deve ter pelo menos 18 anos.");
      return;
    }
    if (telNum.length !== 11) {
      alert("O telefone deve conter 11 números (DDD + número).");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      const user = cred.user;
      await setDoc(doc(db, "usuarios", user.uid), {
        nome, email, telefone, nascimento, role
      });
      alert("Cadastro realizado com sucesso!");
      window.location.href = "login.html";
    } catch (err) {
      console.error(err);
      alert("Erro: " + err.message);
    }

    form.reset();
    currentCaptcha = generateCaptcha();
    captchaText.textContent = currentCaptcha;
  });
});
