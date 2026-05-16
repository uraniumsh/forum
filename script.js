import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// ==========================================
// CONFIGURACIÓN FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyC2tMU45kFmdn-l4i9aiWN1u1fgnklSYqw",
    authDomain: "foro-9fcf9.firebaseapp.com",
    projectId: "foro-9fcf9",
    storageBucket: "foro-9fcf9.firebasestorage.app",
    messagingSenderId: "145843090601",
    appId: "1:145843090601:web:83d1e9e8b3b56e927765b8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, "foro");

// ==========================================
// VARIABLES GLOBALES
// ==========================================
const TELEGRAM_CHAT_ID = "7056557759";
const TELEGRAM_BOT_TOKEN = "8776046886:AAERDniNNcDSNEJonVc32JJBawFuWSyiMTQ";

let currentUserData = null; 
let transactionData = { paquete: '', monto: '', nombre: '', nequi: '' };

// ==========================================
// GESTIÓN DE EVENTOS DEL DOM (El fix del onclick)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // Navegación
    document.getElementById('navLogo').addEventListener('click', () => showView('feedView'));
    document.getElementById('adminBtn').addEventListener('click', () => showView('adminView'));
    
    // Modales (Abrir)
    document.getElementById('openPaymentModalBtn').addEventListener('click', () => openModal('paymentModal'));
    document.getElementById('authBtn').addEventListener('click', () => openModal('loginModal'));
    document.getElementById('newPostBtn').addEventListener('click', () => openModal('postModal'));
    
    // Modales (Cerrar) - Usa el atributo data-close
    document.querySelectorAll('.close-btn, [data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetModalId = e.currentTarget.getAttribute('data-close') || e.currentTarget.parentElement.parentElement.id;
            closeModal(targetModalId);
        });
    });

    // Eventos de Autenticación
    document.getElementById('submitLoginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

    // Eventos del Foro
    document.getElementById('submitPostBtn').addEventListener('click', handleCreatePost);

    // Eventos del Panel Admin
    document.getElementById('applySanctionBtn').addEventListener('click', handleApplySanction);
    document.getElementById('makeAdminBtn').addEventListener('click', () => handleManageRole('admin'));
    document.getElementById('revokeAdminBtn').addEventListener('click', () => handleManageRole('user'));

    // Flujo de Pagos (Paso 1: Seleccionar Gema)
    document.querySelectorAll('.gem-box').forEach(box => {
        box.addEventListener('click', () => {
            const amount = box.getAttribute('data-amount');
            const price = box.getAttribute('data-price');
            selectPackage(amount, price);
        });
    });

    // Flujo de Pagos (Pasos 2 y 3)
    document.getElementById('btnBackToStep1').addEventListener('click', () => goToStep(1));
    document.getElementById('btnGoToStep3').addEventListener('click', submitUserData);
    document.getElementById('webhookBtn').addEventListener('click', sendToWebhook);

    // Cargar inicial
    loadPosts();
});

// ==========================================
// FUNCIONES DE UI
// ==========================================
function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    if(viewId === 'feedView') loadPosts(); 
}

function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    if (modalId === 'paymentModal') resetPaymentFlow();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function goToStep(stepNumber) {
    for(let i=1; i<=4; i++) {
        const stepDiv = document.getElementById('step' + i);
        if(stepDiv) stepDiv.classList.add('hidden');
    }
    document.getElementById('step' + stepNumber).classList.remove('hidden');
}

function resetPaymentFlow() {
    goToStep(1);
    document.getElementById('nombreCompleto').value = '';
    document.getElementById('nequiNum').value = '';
    document.getElementById('comprobante').value = '';
    const btn = document.getElementById('webhookBtn');
    if(btn) { btn.innerText = "ENVIAR A REVISIÓN"; btn.disabled = false; }
}

// ==========================================
// LÓGICA DE AUTH FIREBASE
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                currentUserData = userDocSnap.data();
                currentUserData.uid = user.uid; 
            } else {
                currentUserData = {
                    uid: user.uid,
                    email: user.email,
                    role: (user.email === "juanrivera@urm.co") ? "superadmin" : "user",
                    esmeraldas: 0,
                    sanction: { partialBan: false, totalBan: false, isBlacklisted: false }
                };
                await updateDoc(userDocRef, currentUserData);
            }
            applyUserPermissions();
        } catch (e) {
            console.error("Error validando DB:", e);
            // Fallback si fallan permisos
            currentUserData = { uid: user.uid, email: user.email, role: "user", esmeraldas: 0, sanction: {} };
            applyUserPermissions();
        }
    } else {
        currentUserData = null;
        resetUIForGuest();
    }
});

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const errorDiv = document.getElementById('loginError');
    const btn = document.getElementById('submitLoginBtn');

    if(!email || !pass) { errorDiv.innerText = "Llena todos los campos."; return; }
    btn.innerText = "VERIFICANDO..."; btn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        closeModal('loginModal');
        errorDiv.innerText = "";
        document.getElementById('loginEmail').value = "";
        document.getElementById('loginPass').value = "";
    } catch (error) {
        errorDiv.innerText = "Error: Credenciales inválidas.";
    } finally {
        btn.innerText = "INICIAR SESIÓN"; btn.disabled = false;
    }
}

function applyUserPermissions() {
    if (!currentUserData) return;

    if (currentUserData.sanction?.totalBan) {
        document.getElementById('banScreen').classList.remove('hidden');
        return;
    }

    document.getElementById('authBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('newPostBtn').classList.remove('hidden');
    document.getElementById('esmeraldasCount').innerText = currentUserData.esmeraldas || 0;

    const postBtn = document.getElementById('newPostBtn');
    if (currentUserData.sanction?.partialBan) {
        postBtn.disabled = true; postBtn.innerText = "BLOQUEADO";
    } else {
        postBtn.disabled = false; postBtn.innerText = "CREAR DEBATE";
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
// FORO (LEER Y ESCRIBIR POSTS)
// ==========================================
async function handleCreatePost() {
    if (!currentUserData) return alert("Debes iniciar sesión.");
    if (currentUserData.sanction?.partialBan) return alert("Estás bloqueado.");

    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const btn = document.getElementById('submitPostBtn');

    if (!title || !content) return alert("Llena el título y el contenido.");
    btn.innerText = "PUBLICANDO..."; btn.disabled = true;

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
        alert("Error al crear el debate.");
        console.error(error);
    } finally {
        btn.innerText = "PUBLICAR"; btn.disabled = false;
    }
}

async function loadPosts() {
    const feed = document.getElementById('feedContainer');
    feed.innerHTML = '<div class="text-center text-muted">Cargando base de datos...</div>';

    try {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        feed.innerHTML = ''; 
        
        if (querySnapshot.empty) {
            feed.innerHTML = '<div class="text-center text-muted">No hay datos en el servidor.</div>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            if (data.isBlacklisted) {
                if (!currentUserData) return; 
                if (currentUserData.role !== 'admin' && currentUserData.role !== 'superadmin' && currentUserData.sanction?.isBlacklisted !== true) return; 
            }

            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'Nuevo';
            
            const article = document.createElement('article');
            article.className = 'post-card';
            article.innerHTML = `
                <div class="post-meta">
                    <span class="author">${data.authorEmail.split('@')[0]}</span>
                    ${data.authorEmail === "juanrivera@urm.co" ? '<span class="badge">CREADOR</span>' : ''}
                    <span class="date">${date}</span>
                </div>
                <h3 class="post-title">${data.title}</h3>
                <div class="post-body">${data.content}</div>
            `;
            feed.appendChild(article);
        });
    } catch (error) {
        feed.innerHTML = '<div class="text-center error-text">Error de lectura Firestore.</div>';
        console.error(error);
    }
}

// ==========================================
// FLUJO DE PAGOS (WEBHOOK)
// ==========================================
function selectPackage(cantidad, precio) {
    transactionData.paquete = cantidad + " Gemas";
    transactionData.monto = "$" + new Intl.NumberFormat('es-CO').format(precio);
    document.getElementById('selectedPackText').innerText = `${cantidad} Gemas por ${transactionData.monto} COP`;
    goToStep(2);
}

function submitUserData() {
    const nombre = document.getElementById('nombreCompleto').value.trim();
    const nequi = document.getElementById('nequiNum').value.trim();

    if (!nombre || !nequi) return alert("Completa los campos.");
    transactionData.nombre = nombre;
    transactionData.nequi = nequi;
    document.getElementById('montoFinal').innerText = transactionData.monto;
    goToStep(3);
}

async function sendToWebhook() {
    const fileInput = document.getElementById('comprobante');
    if (fileInput.files.length === 0) return alert("Adjunta imagen obligatoria.");

    const btn = document.getElementById('webhookBtn');
    btn.innerText = "PROCESANDO..."; btn.disabled = true;

    const file = fileInput.files[0];
    const uEmail = currentUserData ? currentUserData.email : "INVITADO";
    const captionText = `
⬜ *COMPRA DE ESMERALDAS*
-----------------------------------
👤 *Cliente:* ${transactionData.nombre}
📧 *Cuenta:* ${uEmail}
📱 *Nequi Origen:* ${transactionData.nequi}
🛒 *Paquete:* ${transactionData.paquete}
💰 *Monto Validar:* ${transactionData.monto}
-----------------------------------`;

    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('photo', file);
    formData.append('caption', captionText);
    formData.append('parse_mode', 'Markdown');

    try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: formData });
        if (res.ok) goToStep(4);
        else throw new Error("API Error");
    } catch (error) {
        alert("Fallo de red al conectar con el servidor.");
        btn.innerText = "ENVIAR A REVISIÓN"; btn.disabled = false;
    }
}

// ==========================================
// PANEL DE ADMIN
// ==========================================
async function handleApplySanction() {
    if (!currentUserData || !['admin', 'superadmin'].includes(currentUserData.role)) return;
    
    const targetUid = document.getElementById('targetUserId').value.trim();
    const type = document.getElementById('sanctionType').value;
    if(!targetUid) return alert("Ingresa un UID.");

    try {
        const userRef = doc(db, "users", targetUid);
        let sanctionUpdate = { partialBan: false, totalBan: false, isBlacklisted: false };
        if (type !== 'none') sanctionUpdate[type] = true;

        await updateDoc(userRef, { sanction: sanctionUpdate });
        alert("Comando de base de datos ejecutado con éxito.");
        document.getElementById('targetUserId').value = '';
    } catch (e) {
        alert("Permisos denegados en Firestore para este UID.");
    }
}

async function handleManageRole(newRole) {
    if (!currentUserData || currentUserData.role !== 'superadmin') return alert("Acceso denegado.");
    
    const targetUid = document.getElementById('newAdminId').value.trim();
    if(!targetUid) return;

    try {
        await updateDoc(doc(db, "users", targetUid), { role: newRole });
        alert(`Rango asignado: ${newRole.toUpperCase()}`);
        document.getElementById('newAdminId').value = '';
    } catch (e) {
        alert("Fallo de escritura en Firestore.");
    }
}
