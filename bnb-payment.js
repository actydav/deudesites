// === pagos con el bnb ===
let bnbQrId = null;
let bnbCheckInterval = null;
const ACCOUNT_ID = 's9CG8FE7Id75ef2jeX9bUA=='; // Tu accountId
const AUTHORIZATION_ID = '713K7PvTlACs1gdmv9jGgA=='; // Tu authorizationId (cámbiala si es primera vez)
const BASE_URL = 'https://test.bnb.com.bo'; // Usa 'https' para seguridad; cambia a prod si aplica

// Función para obtener token JWT
async function getBnbToken() {
    try {
        const response = await fetch(`${BASE_URL}/ClientAuthentication.API/api/v1/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: ACCOUNT_ID,  // accountId como username
                password: AUTHORIZATION_ID  // authorizationId como password
            })
        });
        
        const data = await response.json();
        if (data.success) {
            return data.message;  // El token está en 'message'
        } else {
            throw new Error(data.message || 'Error al generar token');
        }
    } catch (err) {
        console.error('Error obteniendo token BNB:', err);
        alert('Error de autenticación con BNB: ' + err.message);
        return null;
    }
}

// Opcional: Función para actualizar credenciales (obligatorio la primera vez)
async function updateBnbCredentials(newPassword) {
    const token = await getBnbToken();  // Necesitas token para esto? PDF no lo especifica, pero asume sin token para primera vez.
    try {
        const response = await fetch(`${BASE_URL}/ClientAuthentication.API/api/v1/auth/UpdateCredentials`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`  // Si requiere token
            },
            body: JSON.stringify({
                AccountId: ACCOUNT_ID,
                actualAuthorizationId: AUTHORIZATION_ID,
                newAuthorizationId: newPassword  // Min 15 chars, con letra, número, special
            })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Credenciales actualizadas. Usa la nueva password de ahora en adelante.');
        } else {
            alert('Error actualizando credenciales: ' + data.message);
        }
    } catch (err) {
        console.error('Error actualizando credenciales:', err);
    }
}

// Nota: Si es la primera integración, llama updateBnbCredentials('tuNuevaPasswordSegura*1234567890') una vez.

async function openBnbQrModal(ci) {
    const modal = document.getElementById('bnb-qr-modal');
    const canvas = document.getElementById('bnb-qr-canvas');
    const idSpan = document.getElementById('bnb-qr-id');
    const status = document.getElementById('bnb-status');

    const student = await firebaseServices.students.getStudentByCI(ci);
    if (!student) return;

    const concept = 'Mensualidad';
    const amount = 150;
    const gloss = `Pago ${concept} - ${student.name} (CI: ${ci})`;

    const token = await getBnbToken();
    if (!token) return;

    const payload = {
        currency: "BOB",
        gloss: gloss,
        amount: amount.toString(),
        singleUse: "true",
        expirationDate: new Date(Date.now() + 30*60000).toISOString().split('T')[0]
    };

    try {
        const response = await fetch(`${BASE_URL}/QRSimple.API/api/v1/main/getQRWithImageAsync`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success && data.qr) {
            const img = new Image();
            img.src = 'data:image/png;base64,' + data.qr;
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
            };

            bnbQrId = data.id;  // ID del QR
            idSpan.textContent = bnbQrId;
            modal.classList.remove('hidden');

            bnbCheckInterval = setInterval(() => checkBnbPaymentStatus(ci, concept, amount, token), 5000);
        } else {
            alert("Error al generar QR: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión con BNB: " + err.message);
    }
}

async function checkBnbPaymentStatus(ci, concept, amount, token) {
    if (!bnbQrId) return;

    try {
        const response = await fetch(`${BASE_URL}/QRSimple.API/api/v1/main/getQRStatusAsync`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ qrId: bnbQrId })
        });
        
        const data = await response.json();
        const statusElem = document.getElementById('bnb-status');
        
        if (data.statusId === 2) {  // Pago confirmado
            statusElem.textContent = "¡PAGO CONFIRMADO!";
            statusElem.className = "text-sm font-bold text-green-600";

            const student = await firebaseServices.students.getStudentByCI(ci);
            if (student) {
                const result = await firebaseServices.payments.addPayment(student.id, concept, {
                    date: new Date().toISOString().split('T')[0],
                    amount: amount,
                    method: 'bnb'
                });

                if (result.success) {
                    await displayParentReport(ci);
                }
            }

            clearInterval(bnbCheckInterval);
            setTimeout(closeBnbModal, 2000);
        } else if (data.statusId === 3) {  // Expirado
            statusElem.textContent = "QR expirado";
            statusElem.className = "text-sm font-bold text-red-600";
            clearInterval(bnbCheckInterval);
        } else {
            statusElem.textContent = "Esperando pago...";
        }
    } catch (error) {
        console.error('Error verificando pago BNB:', error);
    }
}

function closeBnbModal() {
    document.getElementById('bnb-qr-modal').classList.add('hidden');
    if (bnbCheckInterval) clearInterval(bnbCheckInterval);
    bnbQrId = null;
}