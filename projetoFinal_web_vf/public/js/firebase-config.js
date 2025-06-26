import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth    } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getStorage  } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

// Substitua pelos seus valores de configuração
const firebaseConfig = {
  apiKey: "AIzaSyBNTGF2R7Gty9GADrk7sHmM1l7URQJhSfo",
  authDomain: "nutrivida-9cc9c.firebaseapp.com",
  projectId: "nutrivida-9cc9c",
  storageBucket: "nutrivida-9cc9c.firebasestorage.app", // CORRETO
  messagingSenderId: "189989904624",
  appId: "1:189989904624:web:e8961f6bd4c4f72334a235"
};

// Inicializa o app
const app = initializeApp(firebaseConfig);

// Serviços que vamos usar
const auth      = getAuth(app);
const db        = getFirestore(app);
const storage = getStorage(app); // CORRETO

export { app, auth, db, storage };
