// ==========================================
// IMPORTACIONES FIREBASE (SDK v10.8.0)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, doc, updateDoc, setDoc,
    onSnapshot, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// CONFIGURACIÓN DE FIREBASE
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
const db = getFirestore(app);

const inventoryRef = collection(db, "inventory");
const salesRef = collection(db, "sales");
const settingsRef = doc(db, "settings", "categories");

let currentProducts = []; 
let currentCategories = ["Netflix", "Disney+", "Amazon Prime", "Spotify", "HBO Max", "Crunchyroll"]; 
let comboSelectedApps = []; 

// ==========================================
// EVENTOS PRINCIPALES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // TEMA OSCURO
    const themeBtn = document.getElementById('themeToggle');
    if(localStorage.getItem('uraniumTheme') === 'dark') {
        document.body.classList.add('dark-mode'); themeBtn.innerText = "☀️";
    }
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        themeBtn.innerText = document.body.classList.contains('dark-mode') ? "☀️" : "🌙";
        localStorage.setItem('uraniumTheme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });

    // PESTAÑAS (TABS)
    const tabBtns = document.querySelectorAll('.tab-btn');
    const viewSections = document.querySelectorAll('.view-section');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            viewSections.forEach(sec => sec.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(e.currentTarget.getAttribute('data-target')).classList.add('active');
        });
    });

    // ABRIR MODALES
    document.getElementById('btnOpenProductModal').addEventListener('click', () => openModal('productModal'));
    
    // Abrir modal aislado de categoría
    document.getElementById('btnOpenCategoryModal').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('newCategoryInput').value = '';
        document.getElementById('categoryError').innerText = '';
        openModal('categoryModal');
    });

    document.getElementById('btnOpenComboModal').addEventListener('click', () => {
        resetComboBuilder(); openModal('comboModal');
    });
    
    document.getElementById('btnOpenSaleModal').addEventListener('click', () => {
        populateSalesDropdown(); document.getElementById('saleTotalText').innerText = "$0 COP"; openModal('saleModal');
    });

    // CERRAR MODALES
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => closeModal(e.currentTarget.getAttribute('data-close')));
    });

    // BOTONES DE ACCIÓN
    document.getElementById('inventoryFilter').addEventListener('change', renderInventoryTable);
    
    document.getElementById('submitCategoryBtn').addEventListener('click', handleAddCategory);
    document.getElementById('submitProductBtn').addEventListener('click', handleAddProduct);
    document.getElementById('submitSaleBtn').addEventListener('click', handleRegisterSale);
    document.getElementById('submitComboBtn').addEventListener('click', handleSaveCombo);
    
    document.getElementById('saleQuantity').addEventListener('input', calculateSaleTotal);
    document.getElementById('saleProductSelect').addEventListener('change', calculateSaleTotal);
    document.getElementById('comboFinalPrice').addEventListener('input', calculateComboFinancials);

    // INICIAR CONEXIÓN
    listenToCategories();
    listenToInventory();
    listenToSales();
});

function openModal(modalId) { document.getElementById(modalId).classList.add('active'); }
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    setTimeout(() => {
        if(modalId === 'productModal') {
            document.getElementById('prodName').value = '';
            document.getElementById('prodPrice').value = '';
            document.getElementById('prodCost').value = '';
            document.getElementById('prodStock').value = '';
        }
        if(modalId === 'saleModal') {
            document.getElementById('saleQuantity').value = '1';
            document.getElementById('saleError').innerText = '';
        }
    }, 300);
}
const formatMoney = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

// ==========================================
// CATEGORÍAS (Lógica aislada en el mismo archivo)
// ==========================================
function listenToCategories() {
    try {
        onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().list) currentCategories = docSnap.data().list;
            updateCategorySelects();
        }, (err) => {
            console.log("Aviso: Permisos de Firestore no permiten leer settings. Usando base local.");
            updateCategorySelects();
        });
    } catch(e) { updateCategorySelects(); }
}

function updateCategorySelects() {
    const prodSelect = document.getElementById('prodCategory');
    const filterSelect = document.getElementById('inventoryFilter');
    
    prodSelect.innerHTML = '<option value="">-- Selecciona --</option>';
    filterSelect.innerHTML = '<option value="ALL">Todas las Categorías</option>';

    currentCategories.forEach(cat => {
        prodSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        filterSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

async function handleAddCategory() {
    const inputEl = document.getElementById('newCategoryInput');
    const errorDiv = document.getElementById('categoryError');
    const btn = document.getElementById('submitCategoryBtn');
    const newCat = inputEl.value.trim();

    if (!newCat) { errorDiv.innerText = "Escribe un nombre válido."; return; }

    if(currentCategories.map(c => c.toLowerCase()).includes(newCat.toLowerCase())) {
        errorDiv.innerText = "Esta categoría ya existe."; return;
    }

    btn.innerText = "GUARDANDO..."; btn.disabled = true; errorDiv.innerText = "";

    // 1. Guardar local y actualizar selects inmediatamente para UX fluida
    currentCategories.push(newCat);
    updateCategorySelects();
    document.getElementById('prodCategory').value = newCat;

    // 2. Intentar guardar en Firestore
    try {
        await setDoc(settingsRef, { list: currentCategories }, { merge: true });
        closeModal('categoryModal');
    } catch (e) {
        console.warn("Se guardó localmente. Error Firestore:", e);
        closeModal('categoryModal');
    } finally {
        btn.innerText = "AÑADIR CATEGORÍA"; btn.disabled = false;
    }
}

// ==========================================
// INVENTARIO
// ==========================================
async function handleAddProduct() {
    const category = document.getElementById('prodCategory').value || "General";
    const name = document.getElementById('prodName').value.trim();
    const cost = parseFloat(document.getElementById('prodCost').value) || 0;
    const price = parseFloat(document.getElementById('prodPrice').value) || 0;
    const stock = parseInt(document.getElementById('prodStock').value) || 0;
    const btn = document.getElementById('submitProductBtn');

    if (!name || price <= 0) { alert("El nombre y el precio de venta son obligatorios."); return; }

    btn.innerText = "GUARDANDO..."; btn.disabled = true;

    try {
        await addDoc(inventoryRef, { category, name, cost, price, stock, isCombo: false, createdAt: serverTimestamp() });
        alert("✅ Producto guardado en la Base de Datos.");
        closeModal('productModal');
    } catch (error) {
        alert("❌ Error: " + error.message);
    } finally {
        btn.innerText = "GUARDAR PRODUCTO"; btn.disabled = false;
    }
}

function listenToInventory() {
    const q = query(inventoryRef, orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        currentProducts = [];
        snapshot.forEach((docSnap) => currentProducts.push({ id: docSnap.id, ...docSnap.data() }));
        renderInventoryTable();
        if(document.getElementById('comboModal').classList.contains('active')) renderComboSourceApps();
    });
}

function renderInventoryTable() {
    const tbody = document.getElementById('inventoryBody');
    const filter = document.getElementById('inventoryFilter').value;
    tbody.innerHTML = ''; 
    let totalStock = 0;

    const filtered = filter === "ALL" ? currentProducts : currentProducts.filter(p => p.category === filter);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Inventario vacío.</td></tr>';
        document.getElementById('totalStockCount').innerText = "0"; return;
    }

    filtered.forEach(data => {
        totalStock += data.stock || 0;
        const statusBadge = data.stock > 0 ? `<span class="badge-ok">DISPONIBLE</span>` : `<span class="badge-empty">AGOTADO</span>`;
        const catBadge = data.isCombo ? `<span class="text-warning">⚡ COMBO</span>` : (data.category || 'General');

        tbody.innerHTML += `
            <tr>
                <td><strong>${data.name}</strong></td>
                <td style="font-size:0.8rem;">${catBadge}</td>
                <td class="text-muted">${formatMoney(data.cost || 0)}</td>
                <td class="accent-text">${formatMoney(data.price || 0)}</td>
                <td><span class="badge-stock">${data.stock || 0}</span></td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
    document.getElementById('totalStockCount').innerText = totalStock;
}

// ==========================================
// CREADOR DE COMBOS
// ==========================================
function resetComboBuilder() {
    comboSelectedApps = [];
    document.getElementById('comboName').value = '';
    document.getElementById('comboFinalPrice').value = '';
    
    document.querySelectorAll('.combo-slot').forEach(slot => {
        slot.innerHTML = 'Toca una<br>App';
        slot.classList.add('empty'); slot.removeAttribute('data-app-id');
    });
    renderComboSourceApps(); calculateComboFinancials();
}

function renderComboSourceApps() {
    const grid = document.getElementById('appsSourceGrid');
    grid.innerHTML = '';
    const available = currentProducts.filter(p => p.stock > 0 && !p.isCombo);
    
    available.forEach(app => {
        const div = document.createElement('div');
        div.className = 'app-icon';
        div.onclick = () => addAppToComboSlot(app.id);
        div.innerHTML = `<strong>${app.name.substring(0, 8)}</strong><br><span style="font-size:9px">${formatMoney(app.price)}</span>`;
        grid.appendChild(div);
    });
}

function addAppToComboSlot(appId) {
    const appData = currentProducts.find(p => p.id === appId);
    if(!appData) return;

    const emptySlot = document.querySelector('.combo-slot.empty');
    if(!emptySlot) { alert("Ranuras llenas."); return; }

    emptySlot.classList.remove('empty');
    emptySlot.dataset.appId = appId;
    emptySlot.innerHTML = `
        <div class="app-icon" style="width:100%; height:100%; border-color:var(--primary);">
            <strong>${appData.name.substring(0,6)}</strong>
        </div>
        <div class="remove-app" onclick="removeAppFromSlot(this)">x</div>
    `;
    comboSelectedApps.push(appData); calculateComboFinancials();
}

window.removeAppFromSlot = function(element) {
    const slot = element.parentElement;
    const appId = slot.dataset.appId;
    
    const index = comboSelectedApps.findIndex(a => a.id === appId);
    if(index > -1) comboSelectedApps.splice(index, 1);
    
    slot.innerHTML = 'Toca una<br>App'; slot.classList.add('empty'); slot.removeAttribute('data-app-id');
    calculateComboFinancials();
};

function calculateComboFinancials() {
    let totalCost = 0; let regularPrice = 0;
    comboSelectedApps.forEach(app => { totalCost += (app.cost || 0); regularPrice += (app.price || 0); });

    document.getElementById('comboTotalCost').innerText = formatMoney(totalCost);
    document.getElementById('comboRegularPrice').innerText = formatMoney(regularPrice);

    const finalPrice = parseFloat(document.getElementById('comboFinalPrice').value) || 0;
    document.getElementById('comboDiscount').innerText = finalPrice > 0 ? formatMoney(regularPrice - finalPrice) : "$0";
    document.getElementById('comboProfit').innerText = finalPrice > 0 ? formatMoney(finalPrice - totalCost) : "$0";
}

async function handleSaveCombo() {
    const name = document.getElementById('comboName').value.trim();
    const finalPrice = parseFloat(document.getElementById('comboFinalPrice').value) || 0;
    const btn = document.getElementById('submitComboBtn');
    const errorDiv = document.getElementById('comboError');

    if(comboSelectedApps.length < 2) { errorDiv.innerText = "Selecciona al menos 2 apps tocándolas."; return; }
    if(!name || finalPrice <= 0) { errorDiv.innerText = "Nombre y precio válidos requeridos."; return; }

    let baseCost = 0; comboSelectedApps.forEach(a => baseCost += (a.cost || 0));
    const minStock = Math.min(...comboSelectedApps.map(a => a.stock || 0));

    btn.innerText = "CREANDO..."; btn.disabled = true; errorDiv.innerText = "";

    try {
        await addDoc(inventoryRef, {
            name, category: "COMBOS", cost: baseCost, price: finalPrice,
            stock: minStock, isCombo: true, comboItems: comboSelectedApps.map(a => a.id), createdAt: serverTimestamp()
        });
        alert("✅ Combo guardado en Firebase.");
        closeModal('comboModal');
    } catch (error) {
        errorDiv.innerText = "Error: " + error.message;
    } finally {
        btn.innerText = "GUARDAR COMBO EN INVENTARIO"; btn.disabled = false;
    }
}

// ==========================================
// VENTAS
// ==========================================
function populateSalesDropdown() {
    const select = document.getElementById('saleProductSelect');
    select.innerHTML = '<option value="">-- Elige un producto --</option>';
    
    currentProducts.forEach(prod => {
        if((prod.stock || 0) > 0) {
            const prefix = prod.isCombo ? "⚡" : "";
            select.innerHTML += `<option value="${prod.id}">${prefix} ${prod.name} - Disp: ${prod.stock}</option>`;
        }
    });
}

function calculateSaleTotal() {
    const prod = currentProducts.find(p => p.id === document.getElementById('saleProductSelect').value);
    const qty = parseInt(document.getElementById('saleQuantity').value) || 0;
    document.getElementById('saleTotalText').innerText = prod ? formatMoney((prod.price || 0) * qty) : "$0 COP";
}

async function handleRegisterSale() {
    const prodId = document.getElementById('saleProductSelect').value;
    const qty = parseInt(document.getElementById('saleQuantity').value) || 0;
    const errorDiv = document.getElementById('saleError');
    const btn = document.getElementById('submitSaleBtn');

    if (!prodId || qty <= 0) { errorDiv.innerText = "Datos inválidos."; return; }
    const product = currentProducts.find(p => p.id === prodId);
    if (qty > (product.stock || 0)) { errorDiv.innerText = "Stock insuficiente."; return; }

    btn.innerText = "PROCESANDO..."; btn.disabled = true;

    try {
        const totalSale = (product.price || 0) * qty;
        const totalCost = (product.cost || 0) * qty;

        await addDoc(salesRef, {
            productId: product.id, productName: product.name, quantity: qty,
            total: totalSale, profit: (totalSale - totalCost), isCombo: product.isCombo || false, date: serverTimestamp()
        });

        await updateDoc(doc(db, "inventory", product.id), { stock: product.stock - qty });
        if(product.isCombo && product.comboItems) {
            for(const itemId of product.comboItems) {
                const subItem = currentProducts.find(p => p.id === itemId);
                if(subItem) await updateDoc(doc(db, "inventory", subItem.id), { stock: subItem.stock - qty });
            }
        }
        alert("✅ Venta registrada y descontada del stock.");
        closeModal('saleModal');
    } catch (error) { 
        errorDiv.innerText = "Error al procesar: " + error.message; 
    } finally { 
        btn.innerText = "CONFIRMAR VENTA"; btn.disabled = false; 
    }
}

function listenToSales() {
    onSnapshot(query(salesRef, orderBy("date", "desc")), (snapshot) => {
        const tbody = document.getElementById('salesBody');
        tbody.innerHTML = ''; let revenue = 0, salesCount = 0, totalProfit = 0;

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin ventas.</td></tr>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            revenue += data.total || 0; salesCount += data.quantity || 0; totalProfit += data.profit || 0;
            const dateStr = data.date ? `${data.date.toDate().toLocaleDateString()} ${data.date.toDate().getHours()}:${data.date.toDate().getMinutes().toString().padStart(2, '0')}` : 'Reciente';

            tbody.innerHTML += `
                <tr>
                    <td class="text-muted" style="font-size:0.85rem;">${dateStr}</td>
                    <td><strong>${data.isCombo ? "⚡" : ""} ${data.productName}</strong></td>
                    <td><span class="badge-stock">${data.quantity}</span></td>
                    <td class="accent-text"><strong>${formatMoney(data.total || 0)}</strong></td>
                </tr>
            `;
        });
        document.getElementById('totalRevenue').innerText = formatMoney(revenue);
        document.getElementById('totalProfit').innerText = formatMoney(totalProfit);
        document.getElementById('totalSalesCount').innerText = salesCount;
    });
}
