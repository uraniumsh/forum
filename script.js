// ==========================================
// IMPORTACIONES FIREBASE (SDK v10.8.0 ESTABLE)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, getDoc,
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

let currentProducts = []; 
let currentSales = []; // Guarda las ventas globalmente para el conteo
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
    document.getElementById('btnOpenComboModal').addEventListener('click', () => { resetComboBuilder(); openModal('comboModal'); });
    document.getElementById('btnOpenSaleModal').addEventListener('click', () => {
        populateSalesDropdown(); document.getElementById('saleTotalText').innerText = "$0 COP"; openModal('saleModal');
    });

    // CERRAR MODALES
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => closeModal(e.currentTarget.getAttribute('data-close')));
    });

    // ACCIONES GENERALES
    document.getElementById('inventoryFilter').addEventListener('change', renderInventoryTable);
    document.getElementById('submitProductBtn').addEventListener('click', handleAddProduct);
    document.getElementById('submitSaleBtn').addEventListener('click', handleRegisterSale);
    document.getElementById('submitComboBtn').addEventListener('click', handleSaveCombo);
    
    // CALCULO INTELIGENTE DE COMBO
    document.getElementById('btnSmartPrice').addEventListener('click', (e) => {
        e.preventDefault();
        calculateSmartPrice();
    });
    
    document.getElementById('saleQuantity').addEventListener('input', calculateSaleTotal);
    document.getElementById('saleProductSelect').addEventListener('change', calculateSaleTotal);
    document.getElementById('comboFinalPrice').addEventListener('input', calculateComboFinancials);

    // INICIAR CONEXIÓN
    listenToInventory();
    listenToSales();
});

function openModal(modalId) { document.getElementById(modalId).classList.add('active'); }
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    setTimeout(() => {
        if(modalId === 'productModal') {
            document.getElementById('prodName').value = ''; document.getElementById('prodPrice').value = '';
            document.getElementById('prodCost').value = ''; document.getElementById('prodStock').value = '';
        }
        if(modalId === 'saleModal') {
            document.getElementById('saleQuantity').value = '1'; document.getElementById('saleEmail').value = '';
            document.getElementById('salePassword').value = ''; document.getElementById('saleError').innerText = '';
        }
    }, 300);
}
const formatMoney = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

// ==========================================
// INVENTARIO Y ELIMINAR PRODUCTO
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
        closeModal('productModal');
    } catch (error) { alert("❌ Error: " + error.message); } 
    finally { btn.innerText = "GUARDAR PRODUCTO"; btn.disabled = false; }
}

window.deleteProduct = async function(id) {
    if(confirm("¿Seguro que quieres eliminar este producto del inventario de forma permanente?")) {
        try {
            await deleteDoc(doc(db, "inventory", id));
        } catch (e) { alert("Error al eliminar producto."); }
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
    tbody.innerHTML = ''; let totalStock = 0;

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
                <td>
                    <div style="display:flex; gap:5px;">
                        ${statusBadge}
                        <button class="btn-icon-sm danger" onclick="deleteProduct('${data.id}')" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    });
    document.getElementById('totalStockCount').innerText = totalStock;
}

// ==========================================
// CREADOR DE COMBOS Y PRECIO INTELIGENTE
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

    emptySlot.classList.remove('empty'); emptySlot.dataset.appId = appId;
    emptySlot.innerHTML = `<div class="app-icon" style="width:100%; height:100%; border-color:var(--primary);"><strong>${appData.name.substring(0,6)}</strong></div><div class="remove-app" onclick="removeAppFromSlot(this)">x</div>`;
    comboSelectedApps.push(appData); calculateComboFinancials();
}

window.removeAppFromSlot = function(element) {
    const slot = element.parentElement; const appId = slot.dataset.appId;
    const index = comboSelectedApps.findIndex(a => a.id === appId);
    if(index > -1) comboSelectedApps.splice(index, 1);
    slot.innerHTML = 'Toca una<br>App'; slot.classList.add('empty'); slot.removeAttribute('data-app-id');
    calculateComboFinancials();
};

function calculateSmartPrice() {
    let totalCost = 0; let regularPrice = 0;
    comboSelectedApps.forEach(app => { totalCost += (app.cost || 0); regularPrice += (app.price || 0); });
    
    if(regularPrice === 0) return;

    // Lógica: 15% de descuento sobre el precio regular. 
    // Si ese descuento daña la ganancia mínima (Costo + 20%), fijamos el mínimo en 20% ganancia.
    let smartPrice = regularPrice * 0.85; 
    let minProfitMargin = totalCost * 1.20;

    if (smartPrice < minProfitMargin) { smartPrice = minProfitMargin; }
    
    // Redondeo bonito para COP (a los 500 pesos más cercanos)
    smartPrice = Math.ceil(smartPrice / 500) * 500;
    
    document.getElementById('comboFinalPrice').value = smartPrice;
    calculateComboFinancials();
}

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
        closeModal('comboModal');
    } catch (error) { errorDiv.innerText = "Error: " + error.message; } 
    finally { btn.innerText = "GUARDAR COMBO EN INVENTARIO"; btn.disabled = false; }
}

// ==========================================
// VENTAS Y ELIMINACIÓN RESTAURANDO STOCK
// ==========================================
function populateSalesDropdown() {
    const select = document.getElementById('saleProductSelect');
    select.innerHTML = '<option value="">-- Elige un producto --</option>';
    currentProducts.forEach(prod => {
        if((prod.stock || 0) > 0) {
            select.innerHTML += `<option value="${prod.id}">${prod.isCombo ? "⚡" : ""} ${prod.name} - Disp: ${prod.stock}</option>`;
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
    const sEmail = document.getElementById('saleEmail').value.trim();
    const sPass = document.getElementById('salePassword').value.trim();
    const errorDiv = document.getElementById('saleError');
    const btn = document.getElementById('submitSaleBtn');

    if (!prodId || qty <= 0) { errorDiv.innerText = "Verifica el producto y la cantidad."; return; }
    const product = currentProducts.find(p => p.id === prodId);
    if (qty > (product.stock || 0)) { errorDiv.innerText = "Stock insuficiente."; return; }

    btn.innerText = "PROCESANDO..."; btn.disabled = true;

    try {
        const totalSale = (product.price || 0) * qty;
        const totalCost = (product.cost || 0) * qty;

        await addDoc(salesRef, {
            productId: product.id, productName: product.name, quantity: qty,
            total: totalSale, profit: (totalSale - totalCost), isCombo: product.isCombo || false,
            comboItems: product.comboItems || null, // Guardamos la info del combo en la venta para restaurar fácil
            accountEmail: sEmail, accountPassword: sPass,
            date: serverTimestamp()
        });

        // Descontar stock
        await updateDoc(doc(db, "inventory", product.id), { stock: product.stock - qty });
        if(product.isCombo && product.comboItems) {
            for(const itemId of product.comboItems) {
                const subItem = currentProducts.find(p => p.id === itemId);
                if(subItem) await updateDoc(doc(db, "inventory", subItem.id), { stock: subItem.stock - qty });
            }
        }
        closeModal('saleModal');
    } catch (e) { errorDiv.innerText = "Error: " + e.message; } 
    finally { btn.innerText = "CONFIRMAR VENTA"; btn.disabled = false; }
}

window.showSaleInfo = function(saleId) {
    const sale = currentSales.find(s => s.id === saleId);
    if(!sale) return;

    document.getElementById('infoEmail').innerText = sale.accountEmail || 'Sin Asignar';
    document.getElementById('infoPassword').innerText = sale.accountPassword || 'Sin Asignar';
    
    // Contar cuántas veces se ha vendido este mismo correo en la base de datos
    let timesSold = 0;
    if(sale.accountEmail && sale.accountEmail.trim() !== '') {
        const emailStr = sale.accountEmail.toLowerCase();
        timesSold = currentSales.filter(s => s.accountEmail && s.accountEmail.toLowerCase() === emailStr).length;
    }
    
    document.getElementById('infoTimesSold').innerText = timesSold;
    openModal('saleInfoModal');
}

window.deleteSale = async function(saleId) {
    if(!confirm("¿Deseas ELIMINAR esta venta? Su valor desaparecerá de las ganancias y el STOCK regresará al inventario.")) return;
    
    const sale = currentSales.find(s => s.id === saleId);
    if(!sale) return;

    try {
        // Eliminar venta
        await deleteDoc(doc(db, "sales", saleId));

        // Restaurar stock del producto principal
        const pRef = doc(db, "inventory", sale.productId);
        const pSnap = await getDoc(pRef);
        if(pSnap.exists()) {
            await updateDoc(pRef, { stock: pSnap.data().stock + sale.quantity });
        }

        // Restaurar stock si era un combo
        if(sale.isCombo && sale.comboItems) {
            for(let itemId of sale.comboItems) {
                const cRef = doc(db, "inventory", itemId);
                const cSnap = await getDoc(cRef);
                if(cSnap.exists()) {
                    await updateDoc(cRef, { stock: cSnap.data().stock + sale.quantity });
                }
            }
        }
    } catch (e) { alert("Error al eliminar venta."); }
}

function listenToSales() {
    onSnapshot(query(salesRef, orderBy("date", "desc")), (snapshot) => {
        const tbody = document.getElementById('salesBody');
        tbody.innerHTML = ''; let revenue = 0, salesCount = 0, totalProfit = 0;
        currentSales = [];

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin ventas.</td></tr>';
            document.getElementById('totalRevenue').innerText = "$0";
            document.getElementById('totalProfit').innerText = "$0";
            document.getElementById('totalSalesCount').innerText = "0"; return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            currentSales.push(data); // Guardamos para la info y borrado

            revenue += data.total || 0; salesCount += data.quantity || 0; totalProfit += data.profit || 0;
            const dateStr = data.date ? `${data.date.toDate().toLocaleDateString()} ${data.date.toDate().getHours()}:${data.date.toDate().getMinutes().toString().padStart(2, '0')}` : 'Reciente';

            tbody.innerHTML += `
                <tr>
                    <td class="text-muted" style="font-size:0.85rem;">${dateStr}</td>
                    <td><strong>${data.isCombo ? "⚡" : ""} ${data.productName}</strong></td>
                    <td>
                        <button class="btn-icon-sm" onclick="showSaleInfo('${data.id}')">📝 VER INFO</button>
                    </td>
                    <td class="accent-text"><strong>${formatMoney(data.total || 0)}</strong><br><span style="font-size:0.7rem;color:gray;">Cant: ${data.quantity}</span></td>
                    <td>
                        <button class="btn-icon-sm danger" onclick="deleteSale('${data.id}')" title="Eliminar Venta y Devolver Stock">🗑️</button>
                    </td>
                </tr>
            `;
        });
        document.getElementById('totalRevenue').innerText = formatMoney(revenue);
        document.getElementById('totalProfit').innerText = formatMoney(totalProfit);
        document.getElementById('totalSalesCount').innerText = salesCount;
    });
}
