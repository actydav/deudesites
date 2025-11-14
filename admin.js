// ===== panel de admin y func. =====

async function openAdminModal() {
    document.getElementById('admin-modal').style.display = 'block';
    await filterStudentsByGradeAndParallel();
    updateConceptDropdown();
    updateExpenseDropdown();
    displayInstitutionalExpenses();
    openTab('courses');
}

function closeAdminModal() {
    document.getElementById('admin-modal').style.display = 'none';
}

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

// Función para exportar datos del curso actual a Excel
async function exportCourseToExcel() {
    const grade = document.getElementById('admin-grade').value;
    const parallel = document.getElementById('admin-parallel').value;
    
    const courseStudents = await firebaseServices.students.filterStudents(grade, parallel);
    
    // Crear datos para Excel
    const data = [
        ['Nombre', 'CI', 'Grado', 'Paralelo', 'Mensualidad Pagada', 'Estado']
    ];
    
    courseStudents.forEach(student => {
        const mensualidad = student.payments?.['Mensualidad']?.total || 0;
        const estado = mensualidad >= monthlyFee ? 'Al día' : 'Pendiente';
        
        data.push([
            `${student.lastNamePaternal} ${student.lastNameMaternal} ${student.firstName}`,
            student.ci,
            student.grade,
            student.parallel,
            `${mensualidad} Bs`,
            estado
        ]);
    });
    
    // Crear y descargar archivo Excel
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Curso");
    XLSX.writeFile(wb, `curso_${grade || 'todos'}_${parallel || 'todos'}.xlsx`);
}

// Función para exportar datos de todo el colegio a Excel
async function exportSchoolToExcel() {
    const allStudents = await firebaseServices.students.getStudents();
    
    // Crear datos para Excel
    const data = [
        ['Nombre', 'CI', 'Grado', 'Paralelo', 'Mensualidad Pagada', 'Estado', 'Grupo Familiar']
    ];
    
    allStudents.forEach(student => {
        const mensualidad = student.payments?.['Mensualidad']?.total || 0;
        const estado = mensualidad >= monthlyFee ? 'Al día' : 'Pendiente';
        const grupoFamiliar = student.familyGroup ? 'Sí' : 'No';
        
        data.push([
            `${student.lastNamePaternal} ${student.lastNameMaternal} ${student.firstName}`,
            student.ci,
            student.grade,
            student.parallel,
            `${mensualidad} Bs`,
            estado,
            grupoFamiliar
        ]);
    });
    
    // Crear y descargar archivo Excel
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Todo el Colegio");
    XLSX.writeFile(wb, `colegio_completo_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Gestión de egresos institucionales
async function addInstitutionalExpense() {
    const concept = document.getElementById('institutional-expense-concept').value.trim();
    const amount = parseFloat(document.getElementById('institutional-expense-amount').value) || 0;
    const category = document.getElementById('institutional-expense-category').value;
    const description = document.getElementById('institutional-expense-description').value.trim();
    
    if (!concept || amount <= 0 || !category) {
        alert('Complete todos los campos correctamente');
        return;
    }
    
    try {
        const expenseData = {
            concept,
            amount,
            category,
            description,
            date: new Date().toISOString().split('T')[0],
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await firebaseServices.institutionalExpenses.addExpense(expenseData);
        
        alert('Egreso institucional registrado exitosamente');
        
        // Limpiar formulario
        document.getElementById('institutional-expense-concept').value = '';
        document.getElementById('institutional-expense-amount').value = '';
        document.getElementById('institutional-expense-description').value = '';
        
        // Actualizar lista de egresos
        displayInstitutionalExpenses();
        
    } catch (error) {
        console.error('Error registrando egreso institucional:', error);
        alert('Error al registrar egreso: ' + error.message);
    }
}

// Mostrar egresos institucionales
async function displayInstitutionalExpenses() {
    const container = document.getElementById('institutional-expenses-list');
    
    try {
        const expenses = await firebaseServices.institutionalExpenses.getExpenses(50);
        
        if (expenses.length === 0) {
            container.innerHTML = '<p class="text-gray-600">No hay egresos registrados.</p>';
            return;
        }
        
        let html = '<h4 class="font-semibold mb-3 fya-red-text">Egresos Institucionales Recientes</h4>';
        html += '<div class="space-y-3 max-h-60 overflow-y-auto">';
        
        let total = 0;
        expenses.forEach(expense => {
            total += expense.amount;
            
            html += `
                <div class="p-3 border rounded bg-gray-50">
                    <div class="flex justify-between items-start">
                        <div>
                            <strong>${expense.concept}</strong>
                            <span class="text-sm bg-red-100 text-red-800 px-2 py-1 rounded ml-2">${expense.category}</span>
                        </div>
                        <span class="font-bold text-red-600">${expense.amount} Bs</span>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">${expense.description || 'Sin descripción'}</p>
                    <p class="text-xs text-gray-500 mt-1">${expense.date}</p>
                </div>
            `;
        });
        
        html += '</div>';
        html += `<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <strong>Total Egresos:</strong> <span class="font-bold text-red-600">${total.toFixed(2)} Bs</span>
                 </div>`;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando egresos institucionales:', error);
        container.innerHTML = '<p class="text-red-600">Error al cargar egresos.</p>';
    }
}

async function filterStudentsByGradeAndParallel() {
    const grade = document.getElementById('admin-grade').value;
    const parallel = document.getElementById('admin-parallel').value;
    
    students = await firebaseServices.students.filterStudents(grade, parallel);
    updateStudentList();
    updateStatistics();
}

function updateStudentList() {
    const list = document.getElementById('student-list');
    list.innerHTML = '';

    if (students.length === 0) {
        list.innerHTML = '<p class="text-gray-600">No hay estudiantes.</p>';
        return;
    }

    students.forEach((student) => {
        const div = document.createElement('div');
        div.className = 'p-2 border-b cursor-pointer hover:bg-red-50';
        div.innerText = `${student.lastNamePaternal} ${student.lastNameMaternal} ${student.firstName}`;
        div.onclick = () => displayStudentDetails(student.id);
        list.appendChild(div);
    });
}

async function updateStatistics() {
    document.getElementById('total-students').innerText = students.length;
    
    const totalIncome = students.reduce((sum, student) => {
        return sum + concepts.reduce((p, c) => p + (student.payments?.[c]?.total || 0), 0);
    }, 0);
    document.getElementById('total-income').innerText = `Bs ${totalIncome.toFixed(2)}`;

    const pending = students.reduce((sum, student) => {
        const exp = expenses.reduce((e, ex) => e + (student.expenses?.[ex]?.total || 0), 0);
        const paid = concepts.reduce((p, c) => p + (student.payments?.[c]?.total || 0), 0);
        
        let fee = 0;
        if (student.familyGroup) {
            const family = students.filter(st => st.familyGroup === student.familyGroup);
            const primaryPayer = family.find(st => st.isPrimaryPayer);
            if (primaryPayer?.ci === student.ci) {
                fee = monthlyFee;
            }
        } else {
            fee = monthlyFee;
        }
        
        return sum + Math.max(0, fee + exp - paid);
    }, 0);
    
    document.getElementById('pending-amount').innerText = `Bs ${pending.toFixed(2)}`;

    const upToDate = students.filter(student => {
        if (student.familyGroup) {
            const family = students.filter(st => st.familyGroup === student.familyGroup);
            const primaryPayer = family.find(st => st.isPrimaryPayer);
            const primaryPayerMensualidad = primaryPayer?.payments?.['Mensualidad']?.total || 0;
            return primaryPayerMensualidad >= monthlyFee;
        } else {
            const studentMensualidad = student.payments?.['Mensualidad']?.total || 0;
            return studentMensualidad >= monthlyFee;
        }
    }).length;
    
    document.getElementById('up-to-date').innerText = upToDate;
}

async function displayStudentDetails(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const details = document.getElementById('student-details');
    
    const familyStudents = student.familyGroup ? 
        students.filter(s => s.familyGroup === student.familyGroup) : [student];
    
    details.innerHTML = `
        <h3 class="text-xl font-semibold fya-red-text">${student.lastNamePaternal} ${student.lastNameMaternal} ${student.firstName}</h3>
        <p><strong>CI:</strong> ${student.ci}</p>
        <p><strong>Grado:</strong> ${student.grade} ${student.parallel}</p>
        
        ${student.familyGroup ? familyStudents.filter(s => s.ci !== student.ci).map(sib => 
            `<p class="text-sm text-orange-700"><strong>Hermano:</strong> ${sib.name} (CI: ${sib.ci})</p>`
        ).join('') : ''}

        <h4 class="font-medium mt-4 fya-red-text">Ingresos:</h4>
        ${concepts.map(c => {
            if (c === 'Mensualidad') {
                const payments = familyStudents.map(st => ({ 
                    name: st.name, 
                    ci: st.ci, 
                    paid: st.payments?.[c]?.total || 0 
                })).filter(p => p.paid > 0);
                
                return `
                    <div class="mb-4 p-3 border rounded bg-gray-50">
                        <h5 class="font-medium fya-red-text">${c} (Total: ${student.payments?.[c]?.total || 0} Bs)</h5>
                        ${payments.length > 0 ? `
                            <p class="text-sm"><strong>Pagado por:</strong></p>
                            <ul class="pl-5 text-sm list-disc">
                                ${payments.map(p => `<li class="text-green-700">${p.name} (${p.ci === student.ci ? 'este' : 'hermano'}) - ${p.paid} Bs</li>`).join('')}
                            </ul>
                        ` : '<p class="text-sm text-gray-500">Sin pagos</p>'}
                        ${student.isPrimaryPayer || !student.familyGroup ? `
                            <div class="flex gap-2 mt-2">
                                <input type="date" id="pay-date-${student.id}-${c}" class="p-1 border rounded text-sm">
                                <input type="number" id="pay-amt-${student.id}-${c}" placeholder="Monto" class="p-1 border rounded text-sm">
                                <button onclick="addPayment('${student.id}', '${c}')" class="fya-red text-white text-xs p-1 rounded">Añadir</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            return `
                <div class="mb-4">
                    <h5 class="font-medium fya-red-text">${c} (Total: ${student.payments?.[c]?.total || 0} Bs)</h5>
                    <ul class="pl-5 text-sm list-disc">
                        ${(student.payments?.[c]?.payments || []).map(p => `<li>${p.date}: ${p.amount} Bs</li>`).join('') || '<li>Sin pagos</li>'}
                    </ul>
                    <div class="flex gap-2 mt-2">
                        <input type="date" id="pay-date-${student.id}-${c}" class="p-1 border rounded text-sm">
                        <input type="number" id="pay-amt-${student.id}-${c}" placeholder="Monto" class="p-1 border rounded text-sm">
                        <button onclick="addPayment('${student.id}', '${c}')" class="fya-red text-white text-xs p-1 rounded">Añadir</button>
                    </div>
                </div>
            `;
        }).join('')}

        <h4 class="font-medium mt-4 fya-red-text">Egresos:</h4>
        ${expenses.map(e => `
            <div class="mb-2 flex gap-2 items-center">
                <label class="w-32">${e}:</label>
                <input type="number" id="exp-${student.id}-${e}" value="${student.expenses?.[e]?.total || 0}" class="p-1 border rounded w-24">
                <button onclick="updateExpense('${student.id}', '${e}')" class="fya-red text-white text-xs p-1 rounded">OK</button>
            </div>
        `).join('')}

        <button onclick="deleteStudent('${student.id}')" class="fya-red text-white p-2 rounded mt-4">Eliminar estudiante</button>
    `;
}

async function addPayment(studentId, concept) {
    const date = document.getElementById(`pay-date-${studentId}-${concept}`).value;
    const amount = parseFloat(document.getElementById(`pay-amt-${studentId}-${concept}`).value) || 0;
    
    if (!date || !amount || amount <= 0) {
        alert('Por favor ingrese fecha y monto válidos');
        return;
    }

    const result = await firebaseServices.payments.addPayment(studentId, concept, {
        date,
        amount,
        method: 'manual'
    });

    if (result.success) {
        alert('Pago registrado exitosamente');
        await filterStudentsByGradeAndParallel();
        const student = students.find(s => s.id === studentId);
        if (student) await displayStudentDetails(studentId);
    } else {
        alert('Error registrando pago: ' + result.error);
    }
}

async function updateExpense(studentId, expense) {
    const val = parseFloat(document.getElementById(`exp-${studentId}-${expense}`).value) || 0;
    const student = students.find(s => s.id === studentId);
    
    if (student) {
        if (!student.expenses) student.expenses = {};
        student.expenses[expense] = { total: val };
        
        const result = await firebaseServices.students.saveStudent(student);
        if (result.success) {
            await filterStudentsByGradeAndParallel();
        } else {
            alert('Error actualizando gasto: ' + result.error);
        }
    }
}

async function deleteStudent(studentId) {
    if (confirm('¿Eliminar estudiante?')) {
        const result = await firebaseServices.students.deleteStudent(studentId);
        if (result.success) {
            document.getElementById('student-details').innerHTML = '<p>Seleccione un estudiante.</p>';
            await filterStudentsByGradeAndParallel();
        } else {
            alert('Error eliminando estudiante: ' + result.error);
        }
    }
}

async function searchStudent() {
    const query = document.getElementById('search-student').value.toLowerCase();
    const filtered = await firebaseServices.students.searchStudents(query);
    const list = document.getElementById('student-list');
    
    list.innerHTML = '';
    if (filtered.length === 0) {
        list.innerHTML = '<p class="text-gray-600">No encontrado.</p>';
    } else {
        filtered.forEach(student => {
            const div = document.createElement('div');
            div.className = 'p-2 border-b cursor-pointer hover:bg-red-50';
            div.innerText = student.name;
            div.onclick = () => displayStudentDetails(student.id);
            list.appendChild(div);
        });
        await displayStudentDetails(filtered[0].id);
    }
}

// ===== ENLAZAR HERMANOS =====
async function linkSiblings() {
    const ci1 = prompt("C.I. del primer estudiante:");
    const ci2 = prompt("C.I. del segundo estudiante:");
    
    if (!ci1 || !ci2 || ci1 === ci2) {
        alert("CI inválidos.");
        return;
    }

    const allStudents = await firebaseServices.students.getStudents();
    const s1 = allStudents.find(s => s.ci === ci1);
    const s2 = allStudents.find(s => s.ci === ci2);
    
    if (!s1 || !s2) {
        alert("Estudiante no encontrado.");
        return;
    }

    const groupId = s1.familyGroup || s2.familyGroup || Date.now().toString();
    s1.familyGroup = groupId;
    s2.familyGroup = groupId;

    const primary = allStudents.find(s => s.familyGroup === groupId && s.isPrimaryPayer);
    if (!primary) s1.isPrimaryPayer = true;
    s2.isPrimaryPayer = false;

    // Guardar cambios
    await firebaseServices.students.saveStudent(s1);
    await firebaseServices.students.saveStudent(s2);

    alert("¡Hermanos enlazados! Solo uno paga la mensualidad.");
    await filterStudentsByGradeAndParallel();
}

// ===== FUNCIONES DE CONFIGURACIÓN =====
function updateConceptDropdown() {
    const select = document.getElementById('delete-concept');
    select.innerHTML = '<option value="">Seleccione</option>';
    concepts.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.text = c;
        select.appendChild(opt);
    });
}

function updateExpenseDropdown() {
    const select = document.getElementById('delete-expense');
    select.innerHTML = '<option value="">Seleccione</option>';
    expenses.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e;
        opt.text = e;
        select.appendChild(opt);
    });
}

async function addConcept() {
    const c = document.getElementById('new-concept').value.trim();
    
    if (!c) {
        alert('Ingrese un concepto válido');
        return;
    }

    if (concepts.includes(c)) {
        alert('Este concepto ya existe');
        return;
    }

    concepts.push(c);
    const result = await firebaseServices.config.updateConcepts(concepts);
    
    if (result.success) {
        alert('Concepto añadido exitosamente');
        document.getElementById('new-concept').value = '';
        updateConceptDropdown();
        
        // Actualizar todos los estudiantes con el nuevo concepto
        const allStudents = await firebaseServices.students.getStudents();
        for (const student of allStudents) {
            if (!student.payments) student.payments = {};
            student.payments[c] = { payments: [], total: 0 };
            await firebaseServices.students.saveStudent(student);
        }
    } else {
        alert('Error añadiendo concepto: ' + result.error);
        concepts.pop();
    }
}

async function addExpense() {
    const e = document.getElementById('new-expense').value.trim();
    
    if (!e) {
        alert('Ingrese un concepto válido');
        return;
    }

    if (expenses.includes(e)) {
        alert('Este concepto ya existe');
        return;
    }

    expenses.push(e);
    const result = await firebaseServices.config.updateExpenses(expenses);
    
    if (result.success) {
        alert('Gasto añadido exitosamente');
        document.getElementById('new-expense').value = '';
        updateExpenseDropdown();
    } else {
        alert('Error añadiendo gasto: ' + result.error);
        expenses.pop();
    }
}

async function deleteConcept() {
    const c = document.getElementById('delete-concept').value;
    
    if (!c) {
        alert('Seleccione un concepto');
        return;
    }

    if (!confirm(`¿Eliminar "${c}"?`)) return;

    concepts = concepts.filter(x => x !== c);
    const result = await firebaseServices.config.updateConcepts(concepts);
    
    if (result.success) {
        updateConceptDropdown();
        alert('Concepto eliminado');
    } else {
        alert('Error eliminando concepto: ' + result.error);
        concepts.push(c);
    }
}

async function deleteExpense() {
    const e = document.getElementById('delete-expense').value;
    
    if (!e) {
        alert('Seleccione un gasto');
        return;
    }

    if (!confirm(`¿Eliminar "${e}"?`)) return;

    expenses = expenses.filter(x => x !== e);
    const result = await firebaseServices.config.updateExpenses(expenses);
    
    if (result.success) {
        updateExpenseDropdown();
        alert('Gasto eliminado');
    } else {
        alert('Error eliminando gasto: ' + result.error);
        expenses.push(e);
    }
}