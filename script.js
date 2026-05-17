import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc, getDocs,
    onSnapshot, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const catApp = initializeApp(firebaseConfig, "CategoryApp"); const dbCat = getFirestore(catApp);

const inventoryRef = collection(db, "inventory");
const salesRef = collection(db, "sales");
const settingsRef = doc(dbCat, "settings", "categories");
const generalRef = doc(db, "settings", "general");
const closedMonthsRef = collection(db, "closed_months");

// TELEGRAM CONSTANTS
const BOT_TOKEN = "8776046886:AAERDniNNcDSNEJonVc32JJBawFuWSyiMTQ";
const CHAT_ID = "7056557759";

let currentProducts = []; let currentSales = []; let currentCategories = ["Netflix", "Disney+", "Amazon Prime", "Spotify", "HBO Max"]; 
let comboSelectedApps = []; let closedMonthsList = [];
let monthCounter = 1; let currentInputTarget = null; // Para el editor largo

document.addEventListener('DOMContentLoaded', () => {
    
    // TEMA
    const themeBtn = document.getElementById('themeToggle');
    if(localStorage.getItem('uraniumTheme') === 'dark') { document.body.classList.add('dark-mode'); themeBtn.innerText = "☀️"; }
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        themeBtn.innerText = document.body.classList.contains('dark-mode') ? "☀️" : "🌙";
        localStorage.setItem('uraniumTheme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });

    // PESTAÑAS
    const tabBtns = document.querySelectorAll('.tab-btn');
    const viewSections = document.querySelectorAll('.view-section');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active')); viewSections.forEach(sec => sec.classList.remove('active'));
            e.currentTarget.classList.add('active'); document.getElementById(e.currentTarget.getAttribute('data-target')).classList.add('active');
        });
    });

    // ABRIR MODALES BÁSICOS
    document.getElementById('btnOpenProductModal').addEventListener('click', () => openModal('productModal'));
    document.getElementById('btnOpenComboModal').addEventListener('click', () => { resetComboBuilder(); openModal('comboModal'); });
    document.getElementById('btnOpenSaleModal').addEventListener('click', () => {
        populateSalesDropdown(); 
        document.getElementById('salePriceOverride').value = ''; document.getElementById('saleTotalText').innerText = "$0 COP"; 
        openModal('saleModal');
    });
    const btnOpenCat = document.getElementById('btnOpenCategoryModal');
    if(btnOpenCat) { btnOpenCat.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('newCategoryInput').value = ''; openModal('categoryModal'); }); }
    document.getElementById('btnManageCategoriesModal').addEventListener('click', (e) => { e.preventDefault(); renderManageCategoriesList(); openModal('manageCategoriesModal'); });

    // MODALES CIERRE DE MES
    document.getElementById('btnReadyMonth').addEventListener('click', () => openModal('confirmModal1'));
    document.getElementById('btnConfirm1').addEventListener('click', () => { closeModal('confirmModal1'); openModal('confirmModal2'); });
    document.getElementById('btnConfirm2Real').addEventListener('click', handleCloseMonth);
    document.getElementById('btnUndoMonth').addEventListener('click', () => openModal('undoMonthModal'));
    document.getElementById('btnExecuteUndo').addEventListener('click', handleUndoMonth);
    document.getElementById('btnMonthsHistory').addEventListener('click', () => { renderMonthsHistory(); openModal('monthsHistoryModal'); });
    document.getElementById('btnManualAddMonth').addEventListener('click', handleManualAddMonth);

    // CERRAR MODALES GLOBALES
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => closeModal(e.currentTarget.getAttribute('data-close')));
    });

    // ACCIONES
    document.getElementById('inventoryFilter').addEventListener('change', renderInventoryTable);
    document.getElementById('submitCategoryBtn').addEventListener('click', handleAddCategory);
    document.getElementById('submitProductBtn').addEventListener('click', handleAddProduct);
    document.getElementById('submitEditProductBtn').addEventListener('click', handleEditProduct);
    document.getElementById('submitSaleBtn').addEventListener('click', handleRegisterSale);
    document.getElementById('submitEditSaleBtn').addEventListener('click', handleEditSale);
    document.getElementById('submitComboBtn').addEventListener('click', handleSaveCombo);
    
    // CALCULADORAS
    document.getElementById('btnSmartPrice').addEventListener('click', (e) => { e.preventDefault(); calculateSmartPrice(); });
    document.getElementById('comboFinalPrice').addEventListener('input', calculateComboFinancials);
    document.getElementById('saleProductSelect').addEventListener('change', () => {
        const prod = currentProducts.find(p => p.id === document.getElementById('saleProductSelect').value);
        document.getElementById('salePriceOverride').value = prod ? (prod.price || 0) : '';
        calculateSaleTotal();
    });
    document.getElementById('saleQuantity').addEventListener('input', calculateSaleTotal);
    document.getElementById('salePriceOverride').addEventListener('input', calculateSaleTotal); 
    document.getElementById('editSaleQuantity').addEventListener('input', calculateEditSaleTotal);
    document.getElementById('editSalePriceOverride').addEventListener('input', calculateEditSaleTotal); 

    // EDITOR DE TEXTO LARGO
    document.getElementById('saveLongTextBtn').addEventListener('click', () => {
        if(currentInputTarget) { document.getElementById(currentInputTarget).value = document.getElementById('longTextInput').value; }
        closeModal('textEditorModal');
    });

    // BASE DISTRIBUIDOR
    const baseInput = document.getElementById('baseCapital');
    baseInput.value = localStorage.getItem('uraniumBaseCapital') || 0;
    baseInput.addEventListener('input', (e) => { localStorage.setItem('uraniumBaseCapital', e.target.value); updatePartnerSplit(); });

    // INICIAR CONEXIONES
    listenToGeneralSettings();
    listenToCategories();
    listenToInventory();
    listenToSales();
    listenToClosedMonths();
});

window.openModal = function(id) { document.getElementById(id).classList.add('active'); }
window.closeModal = function(id) { document.getElementById(id).classList.remove('active'); }
const formatMoney = (a) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(a);

// EDITOR DE TEXTO
window.openTextEditor = function(targetInputId) {
    currentInputTarget = targetInputId;
    document.getElementById('longTextInput').value = document.getElementById(targetInputId).value;
    openModal('textEditorModal');
}
window.copyToClipboard = function(elementId) {
    const text = document.getElementById(elementId).innerText;
    if(!text || text === 'Sin Asignar') return;
    navigator.clipboard.writeText(text).then(() => {
        const btn = event.currentTarget;
        const originalText = btn.innerText;
        btn.innerText = "✅"; setTimeout(() => btn.innerText = originalText, 1000);
    });
}

// ==========================================
// CONFIGURACIÓN GENERAL (Contador Meses)
// ==========================================
function listenToGeneralSettings() {
    onSnapshot(generalRef, (docSnap) => {
        if (docSnap.exists()) {
            monthCounter = docSnap.data().currentMonth || 1;
        } else {
            setDoc(generalRef, { currentMonth: 1 }).catch(()=>{});
        }
        document.getElementById('currentMonthBadge').innerText = `#${monthCounter}`;
    });
}

// ==========================================
// CATEGORÍAS
// ==========================================
function listenToCategories() {
    try { onSnapshot(settingsRef, (docSnap) => { if(docSnap.exists() && docSnap.data().list) { currentCategories = docSnap.data().list; } updateCategorySelects(); }); } catch(e) { updateCategorySelects(); }
}
function updateCategorySelects() {
    const s1=document.getElementById('prodCategory'), s2=document.getElementById('editProdCategory'), s3=document.getElementById('inventoryFilter');
    s1.innerHTML='<option value="">-- Selecciona --</option>'; s2.innerHTML=s1.innerHTML; s3.innerHTML='<option value="ALL">Todas</option>';
    currentCategories.forEach(cat => { s1.innerHTML+=`<option value="${cat}">${cat}</option>`; s2.innerHTML+=`<option value="${cat}">${cat}</option>`; s3.innerHTML+=`<option value="${cat}">${cat}</option>`; });
}
async function handleAddCategory() {
    const name = document.getElementById('newCategoryInput').value.trim(); const err = document.getElementById('categoryError');
    if(!name) { err.innerText = "Nombre inválido."; return; }
    if(currentCategories.some(c=>c.toLowerCase()===name.toLowerCase())) { err.innerText="Ya existe."; return; }
    currentCategories.push(name); updateCategorySelects(); document.getElementById('prodCategory').value = name;
    try { await setDoc(settingsRef, { list: currentCategories }, { merge: true }); closeModal('categoryModal'); } catch (e) { closeModal('categoryModal'); }
}
function renderManageCategoriesList() {
    const list = document.getElementById('categoriesListContainer'); list.innerHTML = '';
    currentCategories.forEach((cat, idx) => {
        list.innerHTML += `<div class="cat-list-item"><span>${cat}</span><button class="btn-icon-sm danger" onclick="deleteCategory(${idx})">🗑️</button></div>`;
    });
}
window.deleteCategory = async function(idx) {
    if(confirm(`¿Eliminar categoría "${currentCategories[idx]}"?`)) {
        currentCategories.splice(idx, 1);
        try { await setDoc(settingsRef, { list: currentCategories }, { merge: true }); renderManageCategoriesList(); } catch(e){}
    }
}

// ==========================================
// INVENTARIO
// ==========================================
async function handleAddProduct() {
    const category = document.getElementById('prodCategory').value || "General"; const name = document.getElementById('prodName').value.trim();
    const cost = parseFloat(document.getElementById('prodCost').value)||0; const price = parseFloat(document.getElementById('prodPrice').value)||0; const stock = parseInt(document.getElementById('prodStock').value)||0;
    if(!name || price<=0) { alert("Nombre y precio obligatorios."); return; }
    document.getElementById('submitProductBtn').innerText = "GUARDANDO...";
    try { await addDoc(inventoryRef, { category, name, cost, price, stock, isCombo: false, createdAt: serverTimestamp() }); closeModal('productModal'); } catch(e) {} finally { document.getElementById('submitProductBtn').innerText = "GUARDAR PRODUCTO"; }
}

window.deleteProduct = async function(id) { if(confirm("¿Eliminar producto?")) { await deleteDoc(doc(db, "inventory", id)); } }
window.adjustStock = async function(id, change) {
    const prod = currentProducts.find(p => p.id === id); if(!prod) return;
    const newStock = (prod.stock || 0) + change; if(newStock < 0) return; 
    await updateDoc(doc(db, "inventory", id), { stock: newStock });
}
window.openEditProduct = function(id) {
    const prod = currentProducts.find(p => p.id === id); if(!prod) return;
    document.getElementById('editProdId').value = prod.id; document.getElementById('editProdCategory').value = prod.category||'';
    document.getElementById('editProdName').value = prod.name||''; document.getElementById('editProdCost').value = prod.cost||0;
    document.getElementById('editProdPrice').value = prod.price||0; document.getElementById('editProdStock').value = prod.stock||0;
    openModal('editProductModal');
}
async function handleEditProduct() {
    const id = document.getElementById('editProdId').value;
    const data = { category: document.getElementById('editProdCategory').value||"General", name: document.getElementById('editProdName').value.trim(), cost: parseFloat(document.getElementById('editProdCost').value)||0, price: parseFloat(document.getElementById('editProdPrice').value)||0, stock: parseInt(document.getElementById('editProdStock').value)||0 };
    await updateDoc(doc(db, "inventory", id), data); closeModal('editProductModal');
}

function listenToInventory() {
    onSnapshot(query(inventoryRef, orderBy("createdAt", "desc")), (snapshot) => {
        currentProducts = []; snapshot.forEach((docSnap) => currentProducts.push({ id: docSnap.id, ...docSnap.data() }));
        renderInventoryTable(); if(document.getElementById('comboModal').classList.contains('active')) renderComboSourceApps();
    });
}
function renderInventoryTable() {
    const tbody = document.getElementById('inventoryBody'); const filter = document.getElementById('inventoryFilter').value;
    tbody.innerHTML = ''; let totalStock = 0;
    const filtered = filter === "ALL" ? currentProducts : currentProducts.filter(p => p.category === filter);
    if(filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center">Vacío</td></tr>'; document.getElementById('totalStockCount').innerText = "0"; return; }
    filtered.forEach(data => {
        totalStock += data.stock || 0;
        const sBadge = data.stock>0 ? `<span class="badge-ok">DISP</span>` : `<span class="badge-empty">AGOTADO</span>`;
        tbody.innerHTML += `<tr><td><strong>${data.name}</strong></td><td style="font-size:0.8rem;">${data.isCombo?'⚡ COMBO':(data.category||'')}</td>
        <td class="text-muted">${formatMoney(data.cost||0)}</td><td class="accent-text">${formatMoney(data.price||0)}</td>
        <td><div style="display:flex;gap:5px;align-items:center;"><button class="btn-icon-sm" onclick="adjustStock('${data.id}', -1)">-</button><span class="badge-stock">${data.stock||0}</span><button class="btn-icon-sm" onclick="adjustStock('${data.id}', 1)">+</button></div></td>
        <td><div style="display:flex; gap:5px; align-items:center;">${sBadge}<button class="btn-icon-sm warning" onclick="openEditProduct('${data.id}')">✏️</button><button class="btn-icon-sm danger" onclick="deleteProduct('${data.id}')">🗑️</button></div></td></tr>`;
    });
    document.getElementById('totalStockCount').innerText = totalStock;
}

// ==========================================
// COMBOS
// ==========================================
function resetComboBuilder() { comboSelectedApps=[]; document.getElementById('comboName').value=''; document.getElementById('comboFinalPrice').value=''; document.querySelectorAll('.combo-slot').forEach(s=>{s.innerHTML='Toca una<br>App';s.classList.add('empty');s.removeAttribute('data-app-id');}); renderComboSourceApps(); calculateComboFinancials(); }
function renderComboSourceApps() { const grid = document.getElementById('appsSourceGrid'); grid.innerHTML=''; currentProducts.filter(p=>p.stock>0 && !p.isCombo).forEach(app=>{ const div=document.createElement('div'); div.className='app-icon'; div.onclick=()=>addAppToComboSlot(app.id); div.innerHTML=`<strong>${app.name.substring(0,8)}</strong><br><span style="font-size:9px">${formatMoney(app.price)}</span>`; grid.appendChild(div); }); }
function addAppToComboSlot(appId) {
    const appData = currentProducts.find(p=>p.id===appId); if(!appData) return;
    const emptySlot = document.querySelector('.combo-slot.empty'); if(!emptySlot){alert("Lleno");return;}
    emptySlot.classList.remove('empty'); emptySlot.dataset.appId=appId; emptySlot.innerHTML=`<div class="app-icon" style="width:100%;height:100%;border-color:var(--primary);"><strong>${appData.name.substring(0,6)}</strong></div><div class="remove-app" onclick="removeAppFromSlot(this)">x</div>`;
    comboSelectedApps.push(appData); calculateComboFinancials();
}
window.removeAppFromSlot = function(el) { const slot=el.parentElement; const idx=comboSelectedApps.findIndex(a=>a.id===slot.dataset.appId); if(idx>-1)comboSelectedApps.splice(idx,1); slot.innerHTML='Toca una<br>App'; slot.classList.add('empty'); slot.removeAttribute('data-app-id'); calculateComboFinancials(); };
function calculateSmartPrice() { let tC=0, rP=0; comboSelectedApps.forEach(a=>{tC+=(a.cost||0); rP+=(a.price||0);}); if(rP===0)return; let sp = Math.max(rP*0.85, tC*1.20); document.getElementById('comboFinalPrice').value = Math.ceil(sp/500)*500; calculateComboFinancials(); }
function calculateComboFinancials() { let tC=0, rP=0; comboSelectedApps.forEach(a=>{tC+=(a.cost||0); rP+=(a.price||0);}); const fp=parseFloat(document.getElementById('comboFinalPrice').value)||0; document.getElementById('comboTotalCost').innerText=formatMoney(tC); document.getElementById('comboRegularPrice').innerText=formatMoney(rP); document.getElementById('comboDiscount').innerText=fp>0?formatMoney(rP-fp):"$0"; document.getElementById('comboProfit').innerText=fp>0?formatMoney(fp-tC):"$0"; }
async function handleSaveCombo() { const name=document.getElementById('comboName').value.trim(); const fp=parseFloat(document.getElementById('comboFinalPrice').value)||0; if(comboSelectedApps.length<2 || !name || fp<=0)return; let bC=0; comboSelectedApps.forEach(a=>bC+=(a.cost||0)); const mS=Math.min(...comboSelectedApps.map(a=>a.stock||0)); document.getElementById('submitComboBtn').innerText="CREANDO..."; await addDoc(inventoryRef, { name, category:"COMBOS", cost:bC, price:fp, stock:mS, isCombo:true, comboItems:comboSelectedApps.map(a=>a.id), createdAt:serverTimestamp() }); closeModal('comboModal'); document.getElementById('submitComboBtn').innerText="GUARDAR COMBO"; }

// ==========================================
// VENTAS
// ==========================================
function populateSalesDropdown() { const sel=document.getElementById('saleProductSelect'); sel.innerHTML='<option value="">-- Elige un producto --</option>'; currentProducts.filter(p=>(p.stock||0)>0).forEach(p=>{ sel.innerHTML+=`<option value="${p.id}">${p.isCombo?"⚡":""} ${p.name}</option>`; }); }
function calculateSaleTotal() { document.getElementById('saleTotalText').innerText = formatMoney((parseFloat(document.getElementById('salePriceOverride').value)||0) * (parseInt(document.getElementById('saleQuantity').value)||0)); }
function calculateEditSaleTotal() { document.getElementById('editSaleTotalText').innerText = formatMoney((parseFloat(document.getElementById('editSalePriceOverride').value)||0) * (parseInt(document.getElementById('editSaleQuantity').value)||0)); }

async function handleRegisterSale() {
    const prodId = document.getElementById('saleProductSelect').value; const qty = parseInt(document.getElementById('saleQuantity').value)||0; const customPrice = parseFloat(document.getElementById('salePriceOverride').value)||0;
    if(!prodId||qty<=0||customPrice<=0){alert("Datos inválidos");return;} const product = currentProducts.find(p=>p.id===prodId); if(qty>(product.stock||0)){alert("Stock insuficiente");return;}
    document.getElementById('submitSaleBtn').disabled=true;
    try {
        const totalSale=customPrice*qty; const totalCost=(product.cost||0)*qty;
        await addDoc(salesRef, {
            productId:product.id, productName:product.name, quantity:qty, salePriceUsed:customPrice, productCostUsed:product.cost||0,
            total:totalSale, profit:(totalSale-totalCost), isCombo:product.isCombo||false, comboItems:product.comboItems||null,
            accountEmail:document.getElementById('saleEmail').value.trim(), accountPassword:document.getElementById('salePassword').value.trim(),
            profile:document.getElementById('saleProfile').value.trim(), pin:document.getElementById('salePin').value.trim(), date:serverTimestamp()
        });
        await updateDoc(doc(db,"inventory",product.id), {stock:product.stock-qty});
        if(product.isCombo&&product.comboItems) { for(const iId of product.comboItems){ const s=currentProducts.find(p=>p.id===iId); if(s) await updateDoc(doc(db,"inventory",s.id),{stock:s.stock-qty}); } }
        closeModal('saleModal');
    } catch(e){} finally { document.getElementById('submitSaleBtn').disabled=false; }
}

window.openEditSale = function(saleId) {
    const sale = currentSales.find(s=>s.id===saleId); if(!sale)return;
    document.getElementById('editSaleId').value=sale.id; document.getElementById('editSaleProductName').innerText=sale.productName;
    document.getElementById('editSalePriceOverride').value=sale.salePriceUsed||(sale.total/sale.quantity)||0;
    document.getElementById('editSaleQuantity').value=sale.quantity; document.getElementById('editSaleQuantity').setAttribute('data-old-qty',sale.quantity); 
    document.getElementById('editSaleEmail').value=sale.accountEmail||''; document.getElementById('editSalePassword').value=sale.accountPassword||'';
    document.getElementById('editSaleProfile').value=sale.profile||''; document.getElementById('editSalePin').value=sale.pin||'';
    calculateEditSaleTotal(); openModal('editSaleModal');
}
async function handleEditSale() {
    const sale = currentSales.find(s=>s.id===document.getElementById('editSaleId').value); if(!sale)return;
    const nP = parseFloat(document.getElementById('editSalePriceOverride').value)||0; const nQ = parseInt(document.getElementById('editSaleQuantity').value)||0;
    if(nQ<=0||nP<=0)return; const diff = nQ - (parseInt(document.getElementById('editSaleQuantity').getAttribute('data-old-qty'))||sale.quantity);
    await updateDoc(doc(db, "sales", sale.id), { salePriceUsed:nP, quantity:nQ, total:nP*nQ, profit:(nP*nQ)-((sale.productCostUsed||0)*nQ), accountEmail:document.getElementById('editSaleEmail').value.trim(), accountPassword:document.getElementById('editSalePassword').value.trim(), profile:document.getElementById('editSaleProfile').value.trim(), pin:document.getElementById('editSalePin').value.trim() });
    if(diff!==0) { await adjustStock(sale.productId, -diff); if(sale.isCombo&&sale.comboItems){ for(let iId of sale.comboItems){ await adjustStock(iId, -diff); } } }
    closeModal('editSaleModal');
}

window.showSaleInfo = function(saleId) {
    const sale = currentSales.find(s=>s.id===saleId); if(!sale)return;
    document.getElementById('infoEmail').innerText = sale.accountEmail||'Sin Asignar'; document.getElementById('infoPassword').innerText = sale.accountPassword||'Sin Asignar';
    document.getElementById('infoProfile').innerText = sale.profile||'Sin Asignar'; document.getElementById('infoPin').innerText = sale.pin||'Sin Asignar';
    document.getElementById('infoTimesSold').innerText = (sale.accountEmail&&sale.accountEmail.trim()!=='') ? currentSales.filter(s=>s.accountEmail&&s.accountEmail.toLowerCase()===sale.accountEmail.toLowerCase()).length : 0;
    openModal('saleInfoModal');
}

window.deleteSale = async function(saleId) {
    if(!confirm("¿Eliminar esta venta y devolver stock?"))return; const sale=currentSales.find(s=>s.id===saleId); if(!sale)return;
    await deleteDoc(doc(db,"sales",saleId)); await adjustStock(sale.productId, sale.quantity);
    if(sale.isCombo&&sale.comboItems){ for(let iId of sale.comboItems) await adjustStock(iId, sale.quantity); }
}

function updatePartnerSplit() {
    const totalProfit = currentSales.reduce((sum, s) => sum + (s.profit||0), 0);
    const base = parseFloat(document.getElementById('baseCapital').value)||0;
    const net = totalProfit - base;
    const half = net / 2;
    document.getElementById('partner1Cut').innerText = formatMoney(half);
    document.getElementById('partner2Cut').innerText = formatMoney(half);
}

function listenToSales() {
    onSnapshot(query(salesRef, orderBy("date", "desc")), (snapshot) => {
        const tbody=document.getElementById('salesBody'); tbody.innerHTML=''; let r=0, c=0, p=0; currentSales=[];
        if(snapshot.empty) { tbody.innerHTML='<tr><td colspan="5" class="text-center text-muted">Sin ventas.</td></tr>'; document.getElementById('totalRevenue').innerText="$0"; document.getElementById('totalProfit').innerText="$0"; document.getElementById('totalSalesCount').innerText="0"; updatePartnerSplit(); return; }
        snapshot.forEach((docSnap) => {
            const data=docSnap.data(); data.id=docSnap.id; currentSales.push(data);
            r+=data.total||0; c+=data.quantity||0; p+=data.profit||0;
            const dStr=data.date?`${data.date.toDate().toLocaleDateString()} ${data.date.toDate().getHours()}:${data.date.toDate().getMinutes().toString().padStart(2,'0')}`:'Reciente';
            tbody.innerHTML+=`<tr><td class="text-muted" style="font-size:0.85rem;">${dStr}</td><td><strong>${data.isCombo?"⚡":""} ${data.productName}</strong></td><td><button class="btn-icon-sm" onclick="showSaleInfo('${data.id}')">📝 INFO</button></td><td class="accent-text"><strong>${formatMoney(data.total||0)}</strong><br><span style="font-size:0.7rem;color:gray;">Cant: ${data.quantity}</span></td><td><div style="display:flex;gap:5px;"><button class="btn-icon-sm warning" onclick="openEditSale('${data.id}')">✏️</button><button class="btn-icon-sm danger" onclick="deleteSale('${data.id}')">🗑️</button></div></td></tr>`;
        });
        document.getElementById('totalRevenue').innerText=formatMoney(r); document.getElementById('totalProfit').innerText=formatMoney(p); document.getElementById('totalSalesCount').innerText=c; updatePartnerSplit();
    });
}


// ==========================================
// SISTEMA DE CIERRE Y GESTIÓN DE MESES
// ==========================================

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    try { await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: 'Markdown' }) }); } catch(e){ console.log("Telegram Error", e); }
}

async function handleCloseMonth() {
    const btn = document.getElementById('btnConfirm2Real'); btn.disabled = true; btn.innerText = "PROCESANDO CIERRE...";
    try {
        const r=currentSales.reduce((a,b)=>a+(b.total||0),0); const p=currentSales.reduce((a,b)=>a+(b.profit||0),0);
        const base = parseFloat(document.getElementById('baseCapital').value)||0; const net = p - base; const cut = net/2;
        
        let report = `📊 *CIERRE DE MES ${monthCounter}*\n-----------------------\n`;
        report += `💰 *Ingresos Brutos:* ${formatMoney(r)}\n📈 *Ganancia Bruta:* ${formatMoney(p)}\n🏦 *Base Distribuidor:* -${formatMoney(base)}\n`;
        report += `💵 *GANANCIA NETA:* ${formatMoney(net)}\n🤝 *Para cada Socio:* ${formatMoney(cut)}\n-----------------------\n📦 *PRODUCTOS VENDIDOS:*\n`;
        
        // Agrupar por producto
        let prodCounts = {};
        currentSales.forEach(s => { 
            if(!prodCounts[s.productName]) prodCounts[s.productName] = {qty: 0, total: 0};
            prodCounts[s.productName].qty += s.quantity; prodCounts[s.productName].total += s.total;
        });
        for(let key in prodCounts) { report += `- ${prodCounts[key].qty}x ${key} (${formatMoney(prodCounts[key].total)})\n`; }

        // 1. Guardar en Historial de Meses
        await setDoc(doc(closedMonthsRef, `month_${monthCounter}`), {
            monthNumber: monthCounter, reportText: report, dateClosed: serverTimestamp(),
            revenue: r, profit: p, base: base, netProfit: net, partnerCut: cut, salesSnapshot: currentSales
        });

        // 2. Enviar a Telegram
        await sendTelegramMessage(report);

        // 3. Borrar ventas actuales
        for(let sale of currentSales) { await deleteDoc(doc(db, "sales", sale.id)); }

        // 4. Subir contador
        await updateDoc(generalRef, { currentMonth: monthCounter + 1 });
        
        closeModal('confirmModal2'); alert(`✅ Mes ${monthCounter} cerrado correctamente. Enviado a Telegram.`);
    } catch(e) { alert("Error al cerrar mes."); console.error(e); } finally { btn.disabled = false; btn.innerText = "ESTOY 100% SEGURO, CERRAR MES"; }
}

async function handleUndoMonth() {
    if(monthCounter <= 1) { alert("No hay meses anteriores para deshacer."); closeModal('undoMonthModal'); return; }
    const prevMonth = monthCounter - 1;
    const btn = document.getElementById('btnExecuteUndo'); btn.disabled = true; btn.innerText = "RESTAURANDO...";
    try {
        const monthDoc = await getDoc(doc(closedMonthsRef, `month_${prevMonth}`));
        if(!monthDoc.exists()) { alert("No se encontraron los datos del mes anterior."); return; }
        
        // 1. Borrar ventas que haya en la tabla actual por error
        for(let sale of currentSales) { await deleteDoc(doc(db, "sales", sale.id)); }

        // 2. Insertar las ventas del snapshot viejo
        const oldSales = monthDoc.data().salesSnapshot || [];
        for(let sale of oldSales) {
            delete sale.id; // Quitar el ID viejo para que Firebase genere uno nuevo
            await addDoc(salesRef, sale);
        }

        // 3. Borrar el mes del historial y bajar contador
        await deleteDoc(doc(closedMonthsRef, `month_${prevMonth}`));
        await updateDoc(generalRef, { currentMonth: prevMonth });

        closeModal('undoMonthModal'); alert("✅ Mes deshecho. Ventas restauradas.");
    } catch(e) { alert("Error al deshacer."); } finally { btn.disabled = false; btn.innerText = "SÍ, DESHACER"; }
}

function listenToClosedMonths() {
    onSnapshot(query(closedMonthsRef, orderBy("monthNumber", "desc")), (snapshot) => {
        closedMonthsList = []; snapshot.forEach(doc => closedMonthsList.push({id: doc.id, ...doc.data()}));
    });
}

function renderMonthsHistory() {
    const c = document.getElementById('monthsListContainer'); c.innerHTML = '';
    if(closedMonthsList.length === 0) { c.innerHTML = '<p class="text-center">No hay historial.</p>'; return; }
    
    closedMonthsList.forEach(m => {
        c.innerHTML += `
        <div class="month-list-item" onclick="openMonthDetail('${m.id}')">
            <div><strong>MES ${m.monthNumber}</strong><br><span style="font-size:0.8rem; color:gray;">Neta: ${formatMoney(m.netProfit)}</span></div>
            <button class="btn-icon-sm danger" onclick="event.stopPropagation(); deleteClosedMonth('${m.id}')">🗑️</button>
        </div>`;
    });
}

window.openMonthDetail = function(id) {
    const m = closedMonthsList.find(x => x.id === id); if(!m) return;
    document.getElementById('detailMonthTitle').innerText = `REPORTE MES ${m.monthNumber}`;
    document.getElementById('detailMonthText').innerText = m.reportText;
    openModal('monthDetailModal');
}

window.deleteClosedMonth = async function(id) {
    if(confirm("¿Eliminar este mes del historial de forma permanente? No alterará la tabla actual.")) {
        await deleteDoc(doc(closedMonthsRef, id));
        renderMonthsHistory();
    }
}

async function handleManualAddMonth() {
    const note = prompt("Escribe una nota o resumen manual para este mes:");
    if(!note) return;
    const num = prompt("¿Qué número de mes es? (Ej. 5)");
    if(!num) return;
    await setDoc(doc(closedMonthsRef, `month_manual_${Date.now()}`), {
        monthNumber: parseInt(num), reportText: `📝 *REGISTRO MANUAL MES ${num}*\n\n${note}`,
        dateClosed: serverTimestamp(), revenue: 0, profit: 0, base: 0, netProfit: 0, partnerCut: 0
    });
    renderMonthsHistory();
}
