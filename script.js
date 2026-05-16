// ==========================================
// 1. IMPORTACIONES FIREBASE (SDK v12.13.0)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    doc, 
    getDoc, 
    updateDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// ==========================================
// 2. CONFIGURACIÓN REAL DE FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyC2tMU45kFmdn-l4i9aiWN1u1fgnklSYqw",
    authDomain: "foro-9fcf9.firebaseapp.com",
    projectId: "foro-9fcf9",
    storageBucket: "foro-9fcf9.firebasestorage.app",
    messagingSenderId: "145843090601",
    appId: "1:145843090601:web:83d1e9e8b3b56e927765b8"
};

// Inicialización
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Conexión forzada a la base de datos "foro" 
// (Si tu DB resultara ser la default, borras el string "foro" de este paréntesis)
const db = getFirestore(app, "foro");

// ==========================================
// 3. CONFIGURACIÓN TELEGRAM Y VARIABLES
// ==========================================
const TELEGRAM_CHAT_ID = "7056557759";
const TELEGRAM_BOT_TOKEN = "8776046886:AAERDniNNcDSNEJonVc32JJBawFuWSyiMTQ";

let currentUserData = null; 
let transactionData = { paquete: '', monto: '', nombre: '', nequi: '' };

// ==========================================
// 4. CONTROL DE SESIÓN Y AUTH
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            currentUserData = userDocSnap.data();
            currentUserData.uid = user.uid; 
            applyUserPermissions();
        } else {
            currentUserData = {
                uid: user.uid,
                email: user.email,
                role: (user.email === "juanrivera@urm.co") ? "superadmin" : "user",
                esmeraldas: 0,
                sanction: { partialBan: false, totalBan: false, isBlacklisted: false }
            };
            await updateDoc(userDocRef, currentUserData).catch(() => {});
            applyUserPermissions();
        }
    } else {
        currentUserData = null;
        resetUIForGuest();
    }
});

document.getElementById('submitLoginBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const errorDiv = document.getElementById('loginError');
    const btn = document.getElementById('submitLoginBtn');

    if(!email || !pass) { errorDiv.innerText = "Llena todos los campos."; return; }

    btn.innerText = "Verificando...";
    btn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        closeModal('loginModal');
        errorDiv.innerText = "";
        document.getElementById('loginEmail').value = "";
        document.getElementById('loginPass').value = "";
    } catch (error) {
        errorDiv.innerText = "Error: Credenciales inválidas o usuario no existe.";
    } finally {
        btn.innerText = "Iniciar Sesión";
        btn.disabled = false;
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await signOut(auth);
});

function applyUserPermissions() {
    if (!currentUserData) return;

    if (currentUserData.sanction && currentUserData.sanction.totalBan) {
        document.getElementById('banMessage').innerText = "Tu cuenta ha sido bloqueada permanentemente.";
        document.getElementById('banScreen').classList.remove('hidden');
        return;
    }

    document.getElementById('authBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('newPostBtn').classList.remove('hidden');
    document.getElementById('esmeraldasCount').innerText = currentUserData.esmeraldas || 0;

    if (currentUserData.sanction && currentUserData.sanction.partialBan) {
        document.getElementById('newPostBtn').disabled = true;
        document.getElementById('newPostBtn').innerText = "Bloqueado para publicar";
    } else {
        document.getElementById('newPostBtn').disabled = false;
        document.getElementById('newPostBtn').innerText = "Crear Debate";
    }

    if (currentUserData.role === "superadmin" || currentUserData.role === "admin") {
        document.getElementById('adminBtn').classList.remove('hidden');
        if (currentUserData.role === "superadmin") {
            document.getElementById('superAdminCard').classList.remove('hidden');
        } else {
            document.getElementById('superAdminCard').classList.add('hidden');
        }
    }
}

function resetUIForGuest() {
    document.getElementById('adminBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');
    document.getElementById('newPostBtn').classList.add('hidden');
    document.getElementById('authBtn').classList.remove('hidden');
    document.getElementById('esmeraldasCount').innerText = "0";
    showView('feedView');
}

// ==========================================
// 5. SISTEMA DE DEBATES (FIREBASE)
// ==========================================
document.getElementById('submitPostBtn').addEventListener('click', async () => {
    if (!currentUserData) return alert("Debes iniciar sesión.");
    if (currentUserData.sanction?.partialBan) return alert("Estás bloqueado y no puedes publicar.");

    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const btn = document.getElementById('submitPostBtn');

    if (!title || !content) return alert("Llena el título y el contenido.");

    btn.innerText = "Publicando...";
    btn.disabled = true;

    try {
        await addDoc(collection(db, "posts"), {
            title: title,
            content: content,
            authorId: currentUserData.uid,
            authorEmail: currentUserData.email,
            isBlacklisted: currentUserData.sanction?.isBlacklisted || false,
            createdAt: serverTimestamp()
        });
        
        closeModal('postModal');
        document.getElementById('postTitle').value = "";
        document.getElementById('postContent').value = "";
        loadPosts(); 
    } catch (error) {
        console.error(error);
        alert("Error al crear el debate. Revisa las reglas de Firestore.");
    } finally {
        btn.innerText = "Publicar Debate";
        btn.disabled = false;
    }
});

async function loadPosts() {
    const feed = document.getElementById('feedContainer');
    feed.innerHTML = '<div class="text-center text-muted">Cargando debates...</div>';

    try {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        feed.innerHTML = ''; 
        
        if (querySnapshot.empty) {
            feed.innerHTML = '<div class="text-center text-muted">No hay debates aún. Sé el primero.</div>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            if (data.isBlacklisted) {
                if (!currentUserData) return; 
                if (currentUserData.role !== 'admin' && currentUserData.role !== 'superadmin' && currentUserData.sanction?.isBlacklisted !== true) {
                    return; 
                }
            }

            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'Justo ahora';
            
            const article = document.createElement('article');
            article.className = 'post-card';
            article.innerHTML = `
                <div class="post-meta">
                    <span class="author">${data.authorEmail.split('@')[0]}</span>
                    ${data.authorEmail === "juanrivera@urm.co" ? '<span class="badge">Creador</span>' : ''}
                    <span class="date">${date}</span>
                </div>
                <h3 class="post-title">${data.title}</h3>
                <div class="post-body">${data.content}</div>
            `;
            feed.appendChild(article);
        });

    } catch (error) {
        console.error(error);
        feed.innerHTML = '<div class="text-center text-danger">Error al cargar. Verifica reglas Firestore.</div>';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadPosts();
});

// ==========================================
// 6. FLUJO DE COMPRA WEBHOOK (TELEGRAM)
// ==========================================
window.selectPackage = (cantidad, precio) => {
    transactionData.paquete = cantidad + " Esmeraldas";
    transactionData.monto = "$" + precio;
    document.getElementById('selectedPackText').innerText = `${cantidad} Gemas por $${precio} COP`;
    goToStep(2);
};

window.submitUserData = () => {
    const nombre = document.getElementById('nombreCompleto').value.trim();
    const nequi = document.getElementById('nequiNum').value.trim();

    if (!nombre || !nequi) return alert("Debes llenar todos los datos para continuar.");

    transactionData.nombre = nombre;
    transactionData.nequi = nequi;
    document.getElementById('montoFinal').innerText = transactionData.monto;
    goToStep(3);
};

window.sendToWebhook = async () => {
    const fileInput = document.getElementById('comprobante');
    if (fileInput.files.length === 0) return alert("Adjunta el comprobante antes de enviar.");

    const btn = document.getElementById('webhookBtn');
    btn.innerText = "Procesando...";
    btn.disabled = true;

    const file = fileInput.files[0];
    const uEmail = currentUserData ? currentUserData.email : "INVITADO";
    const captionText = `
⬜ *RECARGA DE ESMERALDAS*
-----------------------------------
👤 *Cliente:* ${transactionData.nombre}
📧 *Cuenta:* ${uEmail}
📱 *Nequi Origen:* ${transactionData.nequi}
🛒 *Paquete:* ${transactionData.paquete}
💰 *Monto a Verificar:* ${transactionData.monto}
-----------------------------------`;

    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('photo', file);
    formData.append('caption', captionText);
    formData.append('parse_mode', 'Markdown');

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: formData });
        if (response.ok) {
            goToStep(4);
        } else {
            throw new Error("Error API Telegram");
        }
    } catch (error) {
        alert("Error de red al enviar el comprobante.");
        btn.innerText = "Enviar Comprobante";
        btn.disabled = false;
    }
};

window.goToStep = (stepNumber) => {
    for(let i=1; i<=4; i++) {
        const stepDiv = document.getElementById('step' + i);
        if(stepDiv) stepDiv.classList.add('hidden');
    }
    document.getElementById('step' + stepNumber).classList.remove('hidden');
};

function resetPaymentFlow() {
    goToStep(1);
    document.getElementById('nombreCompleto').value = '';
    document.getElementById('nequiNum').value = '';
    document.getElementById('comprobante').value = '';
    const btn = document.getElementById('webhookBtn');
    if(btn) {
        btn.innerText = "Enviar Comprobante";
        btn.disabled = false;
    }
}

// ==========================================
// 7. CONTROL DE MODALES UI
// ==========================================
window.showView = (viewId) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    if(viewId === 'feedView') loadPosts(); 
};

window.openModal = (modalId) => {
    document.getElementById(modalId).classList.remove('hidden');
    if (modalId === 'paymentModal') resetPaymentFlow();
};

window.closeModal = (modalId) => {
    document.getElementById(modalId).classList.add('hidden');
};

// ==========================================
// 8. PANEL DE ADMIN
// ==========================================
document.getElementById('applySanctionBtn').addEventListener('click', async () => {
    if (!currentUserData || (currentUserData.role !== 'admin' && currentUserData.role !== 'superadmin')) return;
    
    const targetUid = document.getElementById('targetUserId').value.trim();
    const type = document.getElementById('sanctionType').value;

    if(!targetUid) return alert("Ingresa un UID válido.");

    try {
        const userRef = doc(db, "users", targetUid);
        let sanctionUpdate = { partialBan: false, totalBan: false, isBlacklisted: false };
        
        if (type !== 'none') sanctionUpdate[type] = true;

        await updateDoc(userRef, { sanction: sanctionUpdate });
        alert("Sanción aplicada en la base de datos.");
    } catch (e) {
        alert("Error al aplicar sanción. Verifica UID y reglas Firestore.");
    }
});

window.manageRole = async (newRole) => {
    if (!currentUserData || currentUserData.role !== 'superadmin') return alert("Solo el creador puede hacer esto.");
    
    const targetUid = document.getElementById('newAdminId').value.trim();
    if(!targetUid) return;

    try {
        await updateDoc(doc(db, "users", targetUid), { role: newRole });
        alert(`Rol cambiado a ${newRole} exitosamente.`);
    } catch (e) {
        alert("Error modificando rol.");
    }
};
