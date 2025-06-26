/* ────────────────────────────────────────────────────────────────
    public/js/pages/login.js
    ─ login com captcha, mensagens de erro detalhadas e loader ─
───────────────────────────────────────────────────────────────── */
import { auth, db } from "../firebase-config.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  /* ──────────────────────────
      REFERÊNCIAS DO DOM
  ────────────────────────── */
  const form                 = document.getElementById("loginForm");
  const emailInput           = document.getElementById("email");
  const passwordInput        = document.getElementById("password");
  const captchaInput         = document.getElementById("captchaInput");
  const captchaText          = document.getElementById("captchaText");
  const refreshBtn           = document.getElementById("refreshCaptcha");
  const statusMessage        = document.getElementById("statusMessage");
  const loader               = document.getElementById("loader");
  const forgotPasswordLink   = document.querySelector(".forgot-password");

  /* ──────────────────────────
      UTILITÁRIAS
  ────────────────────────── */
  const showLoader = show =>
    loader.classList.toggle("hidden", !show);

  const showMessage = (msg, color = "#555") => {
    statusMessage.textContent   = msg;
    statusMessage.style.color   = color;
    statusMessage.classList.remove("hidden");
  };

  const generateCaptcha = () => {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  };

  /* ──────────────────────────
      CAPTCHA  (gera + refresh)
  ────────────────────────── */
  let currentCaptcha = generateCaptcha();
  captchaText.textContent = currentCaptcha;

  refreshBtn.addEventListener("click", () => {
    currentCaptcha        = generateCaptcha();
    captchaText.textContent = currentCaptcha;
    captchaInput.value      = "";
  });

  /* ──────────────────────────
      ESQUECI MINHA SENHA
  ────────────────────────── */
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = prompt(
      "Por favor, digite o seu e-mail para receber o link de redefinição de senha:"
    );
    if (!email) return;

    showLoader(true);
    showMessage("Enviando link de redefinição...");

    try {
      await sendPasswordResetEmail(auth, email);
      showMessage(
        `Link enviado! Verifique a caixa de entrada do e-mail ${email} para redefinir sua senha.`,
        "#28a745"
      );
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
      const msg =
        error.code === "auth/invalid-email"
          ? "O e-mail informado é inválido."
          : "Ocorreu um erro. Tente novamente.";
      showMessage(msg, "#d9534f");
    } finally {
      showLoader(false);
    }
  });
}


  /* ──────────────────────────
      SUBMIT DO LOGIN
  ────────────────────────── */
  form.addEventListener("submit", async e => {
    e.preventDefault();

    const email    = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const captIn   = captchaInput.value.trim().toUpperCase();

    statusMessage.classList.add("hidden");
    if (captIn !== currentCaptcha) {
      showMessage("Código de verificação incorreto. Tente novamente.", "#d9534f");
      currentCaptcha        = generateCaptcha();
      captchaText.textContent = currentCaptcha;
      captchaInput.value      = "";
      return;
    }

    showLoader(true);
    showMessage("Autenticando...");

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      const snap = await getDoc(doc(db, "usuarios", user.uid));
      if (!snap.exists()) {
        alert("Perfil não encontrado. Você será redirecionado para cadastro.");
        await auth.signOut();
        return (location.href = "cadastro.html");
      }

      const { role } = snap.data();
      showMessage("Login bem-sucedido. Redirecionando...", "#28a745");

      setTimeout(() => {
        if (role === "paciente")        location.href = "paciente.html";
        else if (role === "nutricionista") location.href = "nutricionista.html";
        else showMessage("Perfil desconhecido. Contate o suporte.", "#d9534f");
      }, 800);

    } catch (err) {
      console.error(err);

      const ERR_MSG = {
        "auth/invalid-email": "E-mail inválido.",
        "auth/user-not-found": "Usuário não encontrado.",
        "auth/wrong-password": "Senha incorreta.",
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
        "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
        "Data not found": "Dados do usuário não encontrados."
      };

      showMessage(ERR_MSG[err.code] || "Erro desconhecido.", "#d9534f");

    } finally {
      showLoader(false);
    }
  });
});