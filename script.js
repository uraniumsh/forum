// ==========================================
// IMPORTACIONES FIREBASE (SDK v10.8.0 ESTABLE)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc,
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
let currentSales = []; 
let currentCategories = ["Netflix", "Disney+", "Amazon Prime", "Spotify", "HBO Max", "Crunchyroll"]; 
let comboSelectedApps = []; 

// ==========================================
// EVENTOS Y UI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // Tema
    const themeBtn = document.getElementById('themeToggle');
    if(localStorage.getItem('uraniumTheme') === 'dark') { document.body.classList.add('dark-mode'); themeBtn.innerText = "☀️"; }
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        themeBtn.innerText = document.body.classList.contains('dark-mode') ? "☀️" : "🌙";
        localStorage.setItem('uraniumTheme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });

    // Pestañas
    const tabBtns = document.querySelectorAll('.tab-btn');
    const viewSections = document.querySelectorAll('.view-section');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active')); viewSections.forEach(sec => sec.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(e.currentTarget.getAttribute('data-target')).classList.add('active');
        });
    });

    // Modales Base
    document.getElementById('btnOpenProductModal').addEventListener('click', () => openModal('productModal'));
    document.getElementById('btnOpenComboModal').addEventListener('click', () => { resetComboBuilder(); openModal('comboModal'); });
    
    document.getElementById('btnOpenSaleModal').addEventListener('click', () => {
        populateSalesDropdown(); 
        document.getElementById('salePriceOverride').value = '';
        document.getElementById('saleTotalText').innerText = "$0 COP"; 
        openModal('saleModal');
    });

    // Modales de Categoría
    document.getElementById('btnOpenCategoryModal').addEventListener('click', (e) => {
        e.preventDefault(); 
        document.getElementById('newCategoryInput').value = '';
        document.getElementById('categoryError').innerText = '';
        openModal('categoryModal');
    });

    document.getElementById('btnManageCategoriesModal').addEventListener('click', (e) => {
        e.preventDefault(); 
        renderManageCategoriesList();
        openModal('manageCategoriesModal');
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => closeModal(e.currentTarget.getAttribute('data-close')));
    });

    // Acciones y Guardado
    document.getElementById('inventoryFilter').addEventListener('change', renderInventoryTable);
    document.getElementById('submitCategoryBtn').addEventListener('click', handleAddCategory);
    document.getElementById('submitProductBtn').addEventListener('click', handleAddProduct);
    document.getElementById('submitEditProductBtn').addEventListener('click', handleEditProduct);
    document.getElementById('submitSaleBtn').addEventListener('click', handleRegisterSale);
    document.getElementById('submitEditSaleBtn').addEventListener('click', handleEditSale);
    document.getElementById('submitComboBtn').addEventListener('click', handleSaveCombo);
    
    // Calculadoras dinámicas
    document.getElementById('btnSmartPrice').addEventListener('click', (e) => { e.preventDefault(); calculateSmartPrice(); });
    document.getElementById('comboFinalPrice').addEventListener('input', calculateComboFinancials);
    
    document.getElementById('saleProductSelect').addEventListener('change', () => {
        const prod = currentProducts.find(p => p.id === document.getElementById('saleProductSelect').value);
        if(prod) { document.getElementById('salePriceOverride').value = prod.price || 0; }
        else { document.getElementById('salePriceOverride').value = ''; }
        calculateSaleTotal();
    });
    document.getElementById('saleQuantity').addEventListener('input', calculateSaleTotal);
    document.getElementById('salePriceOverride').addEventListener('input', calculateSaleTotal); 
    
    // Calculadora Editar Venta
    document.getElementById('editSaleQuantity').addEventListener('input', calculateEditSaleTotal);
    document.getElementById('editSalePriceOverride').addEventListener('input', calculateEditSaleTotal); 

    // Calculadora Socios Base
    const baseInput = document.getElementById('baseCapital');
    baseInput.value = localStorage.getItem('uraniumBaseCapital') || 0;
    baseInput.addEventListener('input', (e) => {
        localStorage.setItem('uraniumBaseCapital', e.target.value);
    });

    listenToCategories();
    listenToInventory();
    listenToSales();
});

window.openModal = function(modalId) { document.getElementById(modalId).classList.add('active'); }
window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
}
const formatMoney = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

// ==========================================
// CATEGORÍAS (Lógica Unificada)
// ==========================================
function listenToCategories() {
    onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().list) currentCategories = docSnap.data().list;
        else setDoc(settingsRef, { list: currentCategories }).catch(()=>{});
        updateCategorySelects();
        if(document.getElementById('manageCategoriesModal').classList.contains('active')) renderManageCategoriesList();
    });
}

function updateCategorySelects() {
    const prodSelect = document.getElementById('prodCategory');
    const editProdSelect = document.getElementById('editProdCategory');
    const filterSelect = document.getElementById('inventoryFilter');
    
    prodSelect.innerHTML = '<option value="">-- Selecciona --</option>';
    editProdSelect.innerHTML = '<option value="">-- Selecciona --</option>';
    filterSelect.innerHTML = '<option value="ALL">Todas las Categorías</option>';

    currentCategories.forEach(cat => {
        prodSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        editProdSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        filterSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

async function handleAddCategory() {
    const newCatName = document.getElementById('newCategoryInput').value.trim();
    const btn = document.getElementById('submitCategoryBtn');
    const err = document.getElementById('categoryError');

    if (!newCatName) { err.innerText = "Escribe un nombre válido."; return; }
    if(currentCategories.some(c => c.toLowerCase() === newCatName.toLowerCase())) { err.innerText = "Esta categoría ya existe."; return; }

    btn.innerText = "GUARDANDO..."; btn.disabled = true; err.innerText = "";
    currentCategories.push(newCatName);
    updateCategorySelects();
    document.getElementById('prodCategory').value = newCatName;

    try {
        await setDoc(settingsRef, { list: currentCategories }, { merge: true });
        closeModal('categoryModal');
    } catch (e) { closeModal('categoryModal'); } 
    finally { btn.innerText = "AÑADIR CATEGORÍA"; btn.disabled = false; }
}

function renderManageCategoriesList() {
    const listContainer = document.getElementById('categoriesListContainer');
    listContainer.innerHTML = '';
    
    if(currentCategories.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-muted">No hay categorías.</p>'; return;
    }

    currentCategories.forEach((cat, index) => {
        const div = document.createElement('div');
        div.className = 'cat-list-item';
        div.innerHTML = `<span>${cat}</span><button class="btn-icon-sm danger" onclick="deleteCategory(${index})" title="Eliminar">🗑️</button>`;
        listContainer.appendChild(div);
    });
}

window.deleteCategory = async function(idx) {
    const catToDelete = currentCategories[idx];
    if(confirm(`¿Seguro que deseas eliminar la categoría "${catToDelete}"? Los productos que la usan no se borrarán.`)) {
        const newCats = currentCategories.filter((_, i) => i != idx);
        try { await setDoc(settingsRef, { list: newCats }, { merge: true }); } 
        catch(err) { alert("Error al eliminar la categoría."); }
    }
}

// ==========================================
// INVENTARIO (AGREGAR, EDITAR, ELIMINAR)
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
    if(confirm("¿Seguro que quieres eliminar este producto de forma permanente?")) {
        try { await deleteDoc(doc(db, "inventory", id)); } catch (e) { alert("Error al eliminar."); }
    }
}

window.adjustStock = async function(id, change) {
    const prod = currentProducts.find(p => p.id === id);
    if(!prod) return;
    const newStock = (prod.stock || 0) + change;
    if(newStock < 0) return; 
    try { await updateDoc(doc(db, "inventory", id), { stock: newStock }); } 
    catch(e) { alert("Error actualizando stock."); }
}

window.openEditProduct = function(id) {
    const prod = currentProducts.find(p => p.id === id);
    if(!prod) return;
    document.getElementById('editProdId').value = prod.id;
    document.getElementById('editProdCategory').value = prod.category || '';
    document.getElementById('editProdName').value = prod.name || '';
    document.getElementById('editProdCost').value = prod.cost || 0;
    document.getElementById('editProdPrice').value = prod.price || 0;
    document.getElementById('editProdStock').value = prod.stock || 0;
    openModal('editProductModal');
}

async function handleEditProduct() {
    const id = document.getElementById('editProdId').value;
    const category = document.getElementById('editProdCategory').value || "General";
    const name = document.getElementById('editProdName').value.trim();
    const cost = parseFloat(document.getElementById('editProdCost').value) || 0;
    const price = parseFloat(document.getElementById('editProdPrice').value) || 0;
    const stock = parseInt(document.getElementById('editProdStock').value) || 0;
    const btn = document.getElementById('submitEditProductBtn');

    if (!name || price <= 0) { alert("Nombre y precio válidos requeridos."); return; }
    btn.innerText = "ACTUALIZANDO..."; btn.disabled = true;

    try {
        await updateDoc(doc(db, "inventory", id), { category, name, cost, price, stock });
        closeModal('editProductModal');
    } catch (e) { alert("Error al actualizar producto."); } 
    finally { btn.innerText = "ACTUALIZAR PRODUCTO"; btn.disabled = false; }
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
                <td>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <button class="btn-icon-sm" onclick="adjustStock('${data.id}', -1)">-</button>
                        <span class="badge-stock">${data.stock || 0}</span>
                        <button class="btn-icon-sm" onclick="adjustStock('${data.id}', 1)">+</button>
                    </div>
                </td>
                <td>
                    <div style="display:flex; gap:10px; align-items:center;">
                        ${statusBadge}
                        <button class="btn-icon-sm warning" onclick="openEditProduct('${data.id}')" title="Editar">✏️</button>
                        <button class="btn-icon-sm danger" onclick="deleteProduct('${data.id}')" title="Eliminar">🗑️</button>
                    </div>
                </td>
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
    document.getElementById('comboName').value = ''; document.getElementById('comboFinalPrice').value = '';
    document.querySelectorAll('.combo-slot').forEach(slot => {
        slot.innerHTML = 'Toca una<br>App'; slot.classList.add('empty'); slot.removeAttribute('data-app-id');
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
    
    let smartPrice = regularPrice * 0.85; 
    let minProfitMargin = totalCost * 1.20;

    if (smartPrice < minProfitMargin) { smartPrice = minProfitMargin; }
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

    if(comboSelectedApps.length < 2) { errorDiv.innerText = "Selecciona al menos 2 apps."; return; }
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
    finally { btn.innerText = "GUARDAR COMBO"; btn.disabled = false; }
}

// ==========================================
// VENTAS (REGISTRAR, EDITAR, ELIMINAR, INFO)
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
    const price = parseFloat(document.getElementById('salePriceOverride').value) || 0;
    const qty = parseInt(document.getElementById('saleQuantity').value) || 0;
    document.getElementById('saleTotalText').innerText = formatMoney(price * qty);
}

function calculateEditSaleTotal() {
    const price = parseFloat(document.getElementById('editSalePriceOverride').value) || 0;
    const qty = parseInt(document.getElementById('editSaleQuantity').value) || 0;
    document.getElementById('editSaleTotalText').innerText = formatMoney(price * qty);
}

async function handleRegisterSale() {
    const prodId = document.getElementById('saleProductSelect').value;
    const qty = parseInt(document.getElementById('saleQuantity').value) || 0;
    const customPrice = parseFloat(document.getElementById('salePriceOverride').value) || 0;
    const sEmail = document.getElementById('saleEmail').value.trim();
    const sPass = document.getElementById('salePassword').value.trim();
    const errorDiv = document.getElementById('saleError');
    const btn = document.getElementById('submitSaleBtn');

    if (!prodId || qty <= 0 || customPrice <= 0) { errorDiv.innerText = "Verifica los datos."; return; }
    const product = currentProducts.find(p => p.id === prodId);
    if (qty > (product.stock || 0)) { errorDiv.innerText = "Stock insuficiente."; return; }

    btn.innerText = "PROCESANDO..."; btn.disabled = true;

    try {
        const totalSale = customPrice * qty;
        const totalCost = (product.cost || 0) * qty;

        await addDoc(salesRef, {
            productId: product.id, productName: product.name, quantity: qty,
            salePriceUsed: customPrice, productCostUsed: product.cost || 0, // Guardamos el costo histórico por si cambia en el inventario
            total: totalSale, profit: (totalSale - totalCost), isCombo: product.isCombo || false,
            comboItems: product.comboItems || null,
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

window.openEditSale = function(saleId) {
    const sale = currentSales.find(s => s.id === saleId);
    if(!sale) return;
    
    document.getElementById('editSaleId').value = sale.id;
    document.getElementById('editSaleProductName').innerText = sale.productName;
    document.getElementById('editSalePriceOverride').value = sale.salePriceUsed || (sale.total / sale.quantity) || 0;
    
    // Guardamos la cantidad original para hacer la matemática del stock si la cambia
    document.getElementById('editSaleQuantity').value = sale.quantity;
    document.getElementById('editSaleQuantity').setAttribute('data-old-qty', sale.quantity); 
    
    document.getElementById('editSaleEmail').value = sale.accountEmail || '';
    document.getElementById('editSalePassword').value = sale.accountPassword || '';
    
    calculateEditSaleTotal();
    openModal('editSaleModal');
}

async function handleEditSale() {
    const saleId = document.getElementById('editSaleId').value;
    const sale = currentSales.find(s => s.id === saleId);
    if(!sale) return;

    const newPrice = parseFloat(document.getElementById('editSalePriceOverride').value) || 0;
    const newQty = parseInt(document.getElementById('editSaleQuantity').value) || 0;
    const oldQty = parseInt(document.getElementById('editSaleQuantity').getAttribute('data-old-qty')) || sale.quantity;
    const newEmail = document.getElementById('editSaleEmail').value.trim();
    const newPass = document.getElementById('editSalePassword').value.trim();
    const btn = document.getElementById('submitEditSaleBtn');

    if(newQty <= 0 || newPrice <= 0) { alert("Valores inválidos."); return; }

    btn.innerText = "ACTUALIZANDO..."; btn.disabled = true;

    try {
        const qtyDiff = newQty - oldQty; // Si es positivo, sacó más stock. Si es negativo, devolvió stock.
        const productCost = sale.productCostUsed || 0; // Usar el costo que tenía cuando se vendió
        
        const newTotal = newPrice * newQty;
        const newProfit = newTotal - (productCost * newQty);

        // 1. Actualizar venta
        await updateDoc(doc(db, "sales", saleId), {
            salePriceUsed: newPrice, quantity: newQty,
            total: newTotal, profit: newProfit,
            accountEmail: newEmail, accountPassword: newPass
        });

        // 2. Ajustar Stock si la cantidad cambió
        if(qtyDiff !== 0) {
            const pRef = doc(db, "inventory", sale.productId);
            const pSnap = await getDoc(pRef);
            if(pSnap.exists()) {
                await updateDoc(pRef, { stock: pSnap.data().stock - qtyDiff });
            }
            if(sale.isCombo && sale.comboItems) {
                for(let itemId of sale.comboItems) {
                    const cRef = doc(db, "inventory", itemId);
                    const cSnap = await getDoc(cRef);
                    if(cSnap.exists()) { await updateDoc(cRef, { stock: cSnap.data().stock - qtyDiff }); }
                }
            }
        }
        closeModal('editSaleModal');
    } catch (e) { alert("Error al editar venta: " + e.message); }
    finally { btn.innerText = "ACTUALIZAR VENTA"; btn.disabled = false; }
}

window.showSaleInfo = function(saleId) {
    const sale = currentSales.find(s => s.id === saleId);
    if(!sale) return;

    document.getElementById('infoEmail').innerText = sale.accountEmail || 'Sin Asignar';
    document.getElementById('infoPassword').innerText = sale.accountPassword || 'Sin Asignar';
    
    let timesSold = 0;
    if(sale.accountEmail && sale.accountEmail.trim() !== '') {
        const emailStr = sale.accountEmail.toLowerCase();
        timesSold = currentSales.filter(s => s.accountEmail && s.accountEmail.toLowerCase() === emailStr).length;
    }
    document.getElementById('infoTimesSold').innerText = timesSold;
    openModal('saleInfoModal');
}

window.deleteSale = async function(saleId) {
    if(!confirm("¿Deseas ELIMINAR esta venta? El STOCK regresará al inventario automáticamente.")) return;
    
    const sale = currentSales.find(s => s.id === saleId);
    if(!sale) return;

    try {
        await deleteDoc(doc(db, "sales", saleId));

        const pRef = doc(db, "inventory", sale.productId);
        const pSnap = await getDoc(pRef);
        if(pSnap.exists()) { await updateDoc(pRef, { stock: pSnap.data().stock + sale.quantity }); }

        if(sale.isCombo && sale.comboItems) {
            for(let itemId of sale.comboItems) {
                const cRef = doc(db, "inventory", itemId);
                const cSnap = await getDoc(cRef);
                if(cSnap.exists()) { await updateDoc(cRef, { stock: cSnap.data().stock + sale.quantity }); }
            }
        }
    } catch (e) { alert("Error al eliminar venta."); }
}

function updatePartnerSplit(netProfit) {
    const half = netProfit / 2;
    document.getElementById('partner1Cut').innerText = formatMoney(half);
    document.getElementById('partner2Cut').innerText = formatMoney(half);
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
            document.getElementById('totalSalesCount').innerText = "0"; 
            updatePartnerSplit(0); return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            currentSales.push(data);

            revenue += data.total || 0; salesCount += data.quantity || 0; totalProfit += data.profit || 0;
            const dateStr = data.date ? `${data.date.toDate().toLocaleDateString()} ${data.date.toDate().getHours()}:${data.date.toDate().getMinutes().toString().padStart(2, '0')}` : 'Reciente';

            tbody.innerHTML += `
                <tr>
                    <td class="text-muted" style="font-size:0.85rem;">${dateStr}</td>
                    <td><strong>${data.isCombo ? "⚡" : ""} ${data.productName}</strong></td>
                    <td><button class="btn-icon-sm" onclick="showSaleInfo('${data.id}')">📝 VER INFO</button></td>
                    <td class="accent-text"><strong>${formatMoney(data.total || 0)}</strong><br><span style="font-size:0.7rem;color:gray;">Cant: ${data.quantity}</span></td>
                    <td>
                        <div style="display:flex; gap:10px;">
                            <button class="btn-icon-sm warning" onclick="openEditSale('${data.id}')" title="Editar">✏️</button>
                            <button class="btn-icon-sm danger" onclick="deleteSale('${data.id}')" title="Eliminar y Devolver Stock">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        document.getElementById('totalRevenue').innerText = formatMoney(revenue);
        document.getElementById('totalProfit').innerText = formatMoney(totalProfit);
        document.getElementById('totalSalesCount').innerText = salesCount;
        updatePartnerSplit(totalProfit);
    });
}
