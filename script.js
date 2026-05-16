// ==========================================
// IMPORTACIONES FIREBASE (SDK v12.13.0)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, doc, updateDoc, 
    onSnapshot, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

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
const db = getFirestore(app, "foro"); 

const inventoryRef = collection(db, "inventory");
const salesRef = collection(db, "sales");

let currentProducts = []; 

// ==========================================
// CONTROL DE UI, MODALES Y MODO OSCURO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA MODO OSCURO ---
    const themeBtn = document.getElementById('themeToggle');
    
    if(localStorage.getItem('uraniumTheme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeBtn.innerText = "☀️ MODO CLARO";
    }

    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        
        themeBtn.innerText = isDark ? "☀️ MODO CLARO" : "🌙 MODO OSCURO";
        localStorage.setItem('uraniumTheme', isDark ? 'dark' : 'light');
    });

    // --- LÓGICA DE MODALES ---
    document.getElementById('btnOpenProductModal').addEventListener('click', () => {
        openModal('productModal');
    });
    
    document.getElementById('btnOpenSaleModal').addEventListener('click', () => {
        populateSalesDropdown();
        calculateTotal(); 
        openModal('saleModal');
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-close');
            closeModal(targetId);
        });
    });

    // --- EVENTOS DE FORMULARIO ---
    document.getElementById('submitProductBtn').addEventListener('click', handleAddProduct);
    document.getElementById('submitSaleBtn').addEventListener('click', handleRegisterSale);
    
    document.getElementById('saleQuantity').addEventListener('input', calculateTotal);
    document.getElementById('saleProductSelect').addEventListener('change', calculateTotal);

    listenToInventory();
    listenToSales();
});

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    setTimeout(clearForms, 300);
}

function clearForms() {
    document.getElementById('prodName').value = '';
    document.getElementById('prodPrice').value = '';
    document.getElementById('prodStock').value = '';
    document.getElementById('saleProductSelect').value = '';
    document.getElementById('saleQuantity').value = '1';
    document.getElementById('saleError').innerText = '';
    document.getElementById('saleTotalText').innerText = '$0 COP';
}

const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
};

// ==========================================
// FIREBASE: INVENTARIO
// ==========================================
async function handleAddProduct() {
    const name = document.getElementById('prodName').value.trim();
    const price = parseFloat(document.getElementById('prodPrice').value);
    const stock = parseInt(document.getElementById('prodStock').value);
    const btn = document.getElementById('submitProductBtn');

    if (!name || isNaN(price) || isNaN(stock)) {
        alert("Llena todos los campos correctamente."); return;
    }

    btn.innerText = "GUARDANDO..."; btn.disabled = true;

    try {
        await addDoc(inventoryRef, { name, price, stock, createdAt: serverTimestamp() });
        closeModal('productModal');
    } catch (error) {
        console.error(error); alert("Error de base de datos.");
    } finally {
        btn.innerText = "GUARDAR EN INVENTARIO"; btn.disabled = false;
    }
}

function listenToInventory() {
    const q = query(inventoryRef, orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('inventoryBody');
        tbody.innerHTML = ''; currentProducts = []; let totalStock = 0;

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Aún no hay productos.</td></tr>';
            document.getElementById('totalStockCount').innerText = "0";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            currentProducts.push({ id: docSnap.id, ...data }); 
            totalStock += data.stock;

            const statusBadge = data.stock > 0 
                ? `<span class="badge-ok">DISPONIBLE</span>` 
                : `<span class="badge-empty">AGOTADO</span>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.name}</td>
                <td>${formatMoney(data.price)}</td>
                <td><span class="badge-stock">${data.stock}</span></td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('totalStockCount').innerText = totalStock;
    });
}

// ==========================================
// FIREBASE: VENTAS
// ==========================================
function populateSalesDropdown() {
    const select = document.getElementById('saleProductSelect');
    select.innerHTML = '<option value="">-- Elige un producto --</option>';
    
    currentProducts.forEach(prod => {
        if(prod.stock > 0) {
            const option = document.createElement('option');
            option.value = prod.id;
            option.textContent = `${prod.name} (${formatMoney(prod.price)}) - Stock: ${prod.stock}`;
            select.appendChild(option);
        }
    });
}

function calculateTotal() {
    const select = document.getElementById('saleProductSelect');
    const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
    const totalText = document.getElementById('saleTotalText');
    
    if (!select.value) {
        totalText.innerText = "$0 COP"; return;
    }

    const selectedProduct = currentProducts.find(p => p.id === select.value);
    if (selectedProduct) totalText.innerText = formatMoney(selectedProduct.price * quantity);
}

async function handleRegisterSale() {
    const prodId = document.getElementById('saleProductSelect').value;
    const quantity = parseInt(document.getElementById('saleQuantity').value);
    const errorDiv = document.getElementById('saleError');
    const btn = document.getElementById('submitSaleBtn');

    if (!prodId || isNaN(quantity) || quantity <= 0) {
        errorDiv.innerText = "Ingresa datos válidos."; return;
    }

    const product = currentProducts.find(p => p.id === prodId);
    if (quantity > product.stock) {
        errorDiv.innerText = `Solo tienes ${product.stock} disponibles.`; return;
    }

    btn.innerText = "PROCESANDO..."; btn.disabled = true; errorDiv.innerText = "";

    try {
        await addDoc(salesRef, {
            productId: product.id, productName: product.name,
            quantity: quantity, total: (product.price * quantity),
            date: serverTimestamp()
        });

        await updateDoc(doc(db, "inventory", product.id), { stock: product.stock - quantity });
        closeModal('saleModal');
    } catch (error) {
        errorDiv.innerText = "Fallo de conexión al registrar la venta.";
    } finally {
        btn.innerText = "CONFIRMAR VENTA"; btn.disabled = false;
    }
}

function listenToSales() {
    const q = query(salesRef, orderBy("date", "desc"));
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('salesBody');
        tbody.innerHTML = ''; let revenue = 0; let salesCount = 0;

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin ventas registradas.</td></tr>';
            document.getElementById('totalRevenue').innerText = "$0";
            document.getElementById('totalSalesCount').innerText = "0"; return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            revenue += data.total; salesCount += data.quantity;
            const date = data.date ? data.date.toDate().toLocaleDateString('es-CO') : 'Hoy';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-muted" style="font-size:0.8rem;">${date}</td>
                <td>${data.productName}</td>
                <td><span class="badge-stock">${data.quantity}</span></td>
                <td class="accent-text">${formatMoney(data.total)}</td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('totalRevenue').innerText = formatMoney(revenue);
        document.getElementById('totalSalesCount').innerText = salesCount;
    });
}
