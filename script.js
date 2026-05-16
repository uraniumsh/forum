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
const db = getFirestore(app, "foro"); // Usando tu base de datos "foro"

// Colecciones
const inventoryRef = collection(db, "inventory");
const salesRef = collection(db, "sales");

// Variables globales para la lógica
let currentProducts = []; // Almacena el inventario localmente para cálculos

// ==========================================
// CONTROL DE UI Y MODALES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Abrir Modales
    document.getElementById('btnOpenProductModal').addEventListener('click', () => {
        document.getElementById('productModal').classList.remove('hidden');
    });
    
    document.getElementById('btnOpenSaleModal').addEventListener('click', () => {
        populateSalesDropdown();
        calculateTotal(); // Resetear cálculo
        document.getElementById('saleModal').classList.remove('hidden');
    });

    // Cerrar Modales
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('data-close');
            document.getElementById(target).classList.add('hidden');
            clearForms();
        });
    });

    // Eventos de Formularios
    document.getElementById('submitProductBtn').addEventListener('click', handleAddProduct);
    document.getElementById('submitSaleBtn').addEventListener('click', handleRegisterSale);
    
    // Calculadora dinámica al cambiar cantidad o producto
    document.getElementById('saleQuantity').addEventListener('input', calculateTotal);
    document.getElementById('saleProductSelect').addEventListener('change', calculateTotal);

    // Iniciar listeners en tiempo real
    listenToInventory();
    listenToSales();
});

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
// LÓGICA DE INVENTARIO
// ==========================================

async function handleAddProduct() {
    const name = document.getElementById('prodName').value.trim();
    const price = parseFloat(document.getElementById('prodPrice').value);
    const stock = parseInt(document.getElementById('prodStock').value);
    const btn = document.getElementById('submitProductBtn');

    if (!name || isNaN(price) || isNaN(stock)) {
        alert("Llena todos los campos correctamente.");
        return;
    }

    btn.innerText = "GUARDANDO..."; btn.disabled = true;

    try {
        await addDoc(inventoryRef, {
            name: name,
            price: price,
            stock: stock,
            createdAt: serverTimestamp()
        });
        document.getElementById('productModal').classList.add('hidden');
        clearForms();
    } catch (error) {
        console.error(error);
        alert("Error al guardar en Firestore.");
    } finally {
        btn.innerText = "GUARDAR PRODUCTO"; btn.disabled = false;
    }
}

// Escuchar cambios en inventario en Tiempo Real
function listenToInventory() {
    const q = query(inventoryRef, orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('inventoryBody');
        tbody.innerHTML = '';
        currentProducts = [];
        let totalStock = 0;

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay productos en inventario.</td></tr>';
            document.getElementById('totalStockCount').innerText = "0";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            currentProducts.push({ id, ...data }); // Guardar en array global
            
            totalStock += data.stock;

            const statusBadge = data.stock > 0 
                ? `<span class="badge-ok">DISPONIBLE</span>` 
                : `<span class="badge-empty">AGOTADO</span>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.name}</strong></td>
                <td>${formatMoney(data.price)}</td>
                <td><span class="badge-stock">${data.stock}</span></td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });

        // Actualizar métrica
        document.getElementById('totalStockCount').innerText = totalStock;
    });
}

// ==========================================
// LÓGICA DE VENTAS
// ==========================================

function populateSalesDropdown() {
    const select = document.getElementById('saleProductSelect');
    select.innerHTML = '<option value="">-- Elige un producto --</option>';
    
    currentProducts.forEach(prod => {
        if(prod.stock > 0) {
            const option = document.createElement('option');
            option.value = prod.id;
            option.textContent = `${prod.name} (${formatMoney(prod.price)}) - Disp: ${prod.stock}`;
            select.appendChild(option);
        }
    });
}

function calculateTotal() {
    const select = document.getElementById('saleProductSelect');
    const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
    const totalText = document.getElementById('saleTotalText');
    
    if (!select.value) {
        totalText.innerText = "$0 COP";
        return;
    }

    const selectedProduct = currentProducts.find(p => p.id === select.value);
    if (selectedProduct) {
        const total = selectedProduct.price * quantity;
        totalText.innerText = formatMoney(total);
    }
}

async function handleRegisterSale() {
    const prodId = document.getElementById('saleProductSelect').value;
    const quantity = parseInt(document.getElementById('saleQuantity').value);
    const errorDiv = document.getElementById('saleError');
    const btn = document.getElementById('submitSaleBtn');

    if (!prodId || isNaN(quantity) || quantity <= 0) {
        errorDiv.innerText = "Selecciona un producto y una cantidad válida.";
        return;
    }

    const product = currentProducts.find(p => p.id === prodId);
    if (quantity > product.stock) {
        errorDiv.innerText = `Error: Solo hay ${product.stock} unidades en stock.`;
        return;
    }

    const totalSale = product.price * quantity;
    btn.innerText = "PROCESANDO..."; btn.disabled = true;
    errorDiv.innerText = "";

    try {
        // 1. Registrar la venta
        await addDoc(salesRef, {
            productId: product.id,
            productName: product.name,
            quantity: quantity,
            total: totalSale,
            date: serverTimestamp()
        });

        // 2. Descontar el stock en Firestore
        const productRef = doc(db, "inventory", product.id);
        await updateDoc(productRef, {
            stock: product.stock - quantity
        });

        document.getElementById('saleModal').classList.add('hidden');
        clearForms();
    } catch (error) {
        console.error(error);
        errorDiv.innerText = "Error al registrar la venta.";
    } finally {
        btn.innerText = "CONFIRMAR VENTA"; btn.disabled = false;
    }
}

// Escuchar cambios en ventas en Tiempo Real
function listenToSales() {
    const q = query(salesRef, orderBy("date", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('salesBody');
        tbody.innerHTML = '';
        let revenue = 0;
        let salesCount = 0;

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Aún no hay ventas registradas.</td></tr>';
            document.getElementById('totalRevenue').innerText = "$0";
            document.getElementById('totalSalesCount').innerText = "0";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            revenue += data.total;
            salesCount += data.quantity; // O puedes sumar 1 si quieres contar transacciones en vez de artículos

            const date = data.date ? data.date.toDate().toLocaleString('es-CO', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : 'Ahora';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-muted">${date}</td>
                <td><strong>${data.productName}</strong></td>
                <td><span class="badge-stock">${data.quantity}</span></td>
                <td class="accent-text"><strong>${formatMoney(data.total)}</strong></td>
            `;
            tbody.appendChild(tr);
        });

        // Actualizar métricas
        document.getElementById('totalRevenue').innerText = formatMoney(revenue);
        document.getElementById('totalSalesCount').innerText = salesCount;
    });
}
