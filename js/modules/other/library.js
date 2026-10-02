// ============================================
// SGE-NG - BIBLIOTECA DIGITAL
// Upload, leitura e download de ficheiros PDF
// ============================================

const SGELibrary = (() => {
    'use strict';

    const CATEGORIES = [
        { value: 'manual', label: 'Manuais Escolares' },
        { value: 'regulamento', label: 'Regulamentos' },
        { value: 'programa', label: 'Programas Curriculares' },
        { value: 'prova', label: 'Provas e Exames' },
        { value: 'formacao', label: 'Material de Formação' },
        { value: 'circular', label: 'Circulares e Avisos' },
        { value: 'outro', label: 'Outros Documentos' }
    ];

    async function render() {
        const schoolId = SGEAuth.getUserSchoolId();
        if (!schoolId) return SGEComponents.alert('Escola não encontrada.', 'error');

        const user = SGEAuth.getCurrentUser();
        const canUpload = ['admin_geral', 'director', 'subdirector', 'professor'].includes(user?.role);

        const files = await SGEDb.query('library_files', { schoolId }, { orderBy: ['createdAt', 'desc'] });

        let html = SGEComponents.pageHeader('Biblioteca Digital', 'Documentos e recursos digitais',
            canUpload ? [{ label: '+ Upload Ficheiro', type: 'primary', onClick: 'SGELibrary.openUploadModal()' }] : []
        );

        if (files.length === 0) {
            html += SGEComponents.emptyState('Biblioteca vazia.',
                canUpload ? `<button class="btn btn-primary btn-sm" onclick="SGELibrary.openUploadModal()">+ Primeiro Upload</button>` : ''
            );
            return html;
        }

        // Filtro por categoria
        html += `<div class="flex flex-wrap gap-2 mb-4">`;
        html += `<button class="btn btn-sm btn-primary" onclick="SGELibrary._filterCat('all')">Todos (${files.length})</button>`;
        for (const cat of CATEGORIES) {
            const count = files.filter(f => f.category === cat.value).length;
            if (count > 0) {
                html += `<button class="btn btn-sm btn-secondary" onclick="SGELibrary._filterCat('${cat.value}')">${cat.label} (${count})</button>`;
            }
        }
        html += `</div>`;

        // Grelha de ficheiros
        html += `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="library-grid">`;

        for (const file of files) {
            const catInfo = CATEGORIES.find(c => c.value === file.category);
            const uploadUser = await SGEDb.get('users', file.uploadedBy);
            const isPdf = file.fileName?.toLowerCase().endsWith('.pdf');

            html += `
                <div class="sge-card hover:shadow-md transition-shadow" data-category="${file.category}">
                    <div class="flex items-start gap-3 mb-3">
                        <div class="w-12 h-12 rounded-lg ${isPdf ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'} flex items-center justify-center text-xl flex-shrink-0">
                            ${isPdf ? '📕' : '📄'}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-bold text-gray-900 text-sm truncate" title="${_esc(file.fileName)}">${_esc(file.fileName)}</h4>
                            <p class="text-xs text-gray-500">${SGEComponents.badge(catInfo?.label || 'Outro', 'info')}</p>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400 mb-3">
                        ${SGEUtils.formatFileSize(file.fileSize || 0)} · ${SGEUtils.formatDate(file.createdAt)}
                    </p>
                    <div class="flex gap-2">
                        ${file.fileUrl ? `<a href="${file.fileUrl}" target="_blank" class="btn btn-sm btn-primary flex-1">📖 Ler</a>` : ''}
                        ${file.fileData ? `<button class="btn btn-sm btn-success flex-1" onclick="SGELibrary.downloadFile('${file.id}')">↓ Baixar</button>` : ''}
                        ${canUpload ? `<button class="btn btn-sm btn-danger-outline" onclick="SGELibrary.deleteFile('${file.id}')">✕</button>` : ''}
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        return html;
    }

    function openUploadModal() {
        SGEComponents.openFormModal({
            title: 'Upload de Ficheiro',
            fields: [
                { name: 'fileName', label: 'Nome do Documento', type: 'text', required: true, grid: 'full', placeholder: 'Ex: Manual de Matemática 10ª Classe' },
                { name: 'category', label: 'Categoria', type: 'select', required: true, options: CATEGORIES },
                { name: 'description', label: 'Descrição', type: 'textarea', grid: 'full', rows: 2 },
                { name: 'file', label: 'Ficheiro (PDF, DOC, etc.)', type: 'file', required: true, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png',
                    help: 'Tamanho máximo: 15 MB', maxFileSize: 15 }
            ],
            onSubmit: async (data) => {
                const file = data.file;
                if (!file) return SGENotifications.warning('Selecione um ficheiro.');
                if (file.size > 15 * 1024 * 1024) return SGENotifications.error('Ficheiro excede 15 MB.');

                const schoolId = SGEAuth.getUserSchoolId();
                let fileUrl = null;
                let fileData = null;

                // Tentar upload para Firebase Storage
                if (SGEFirebase.isOnline()) {
                    try {
                        const path = `schools/${schoolId}/library/${SGEUtils.generateShortId()}_${file.name}`;
                        fileUrl = await SGEFirebase.uploadFile(file, path, (progress) => {
                            console.log(`Upload: ${progress.toFixed(0)}%`);
                        });
                    } catch (e) {
                        console.warn('[Library] Upload para Storage falhou, guardando localmente:', e.message);
                    }
                }

                // Se não conseguiu upload, guardar base64 localmente (para ficheiros pequenos)
                if (!fileUrl && file.size < 5 * 1024 * 1024) {
                    try {
                        fileData = await SGEUtils.fileToBase64(file);
                    } catch {}
                }

                await SGEDb.put('library_files', {
                    schoolId,
                    fileName: data.fileName || file.name,
                    originalName: file.name,
                    category: data.category,
                    description: data.description || '',
                    fileSize: file.size,
                    fileType: file.type,
                    fileUrl,
                    fileData: fileData ? fileData.substring(0, 100) + '...' : null, // Não guardar base64 inteiro na listagem
                    uploadedBy: SGEAuth.getUserId(),
                    createdAt: SGEUtils.nowISO()
                });

                SGENotifications.success('Ficheiro enviado para a biblioteca!');
                SGERouter.navigate('/library');
            }
        });
    }

    async function downloadFile(id) {
        const file = await SGEDb.get('library_files', id);
        if (!file) return SGENotifications.error('Ficheiro não encontrado.');

        if (file.fileUrl) {
            window.open(file.fileUrl, '_blank');
        } else if (file.fileData) {
            // Download de base64
            const link = document.createElement('a');
            link.href = file.fileData;
            link.download = file.originalName || file.fileName;
            link.click();
        } else {
            SGENotifications.warning('Ficheiro não disponível para download.');
        }
    }

    async function deleteFile(id) {
        const ok = await SGEComponents.confirm({ title: 'Eliminar Ficheiro', message: 'Tem a certeza?', type: 'danger' });
        if (!ok) return;

        const file = await SGEDb.get('library_files', id);
        if (file?.fileUrl && SGEFirebase.isOnline()) {
            try {
                const path = file.fileUrl.split('/o/')[1]?.split('?')[0];
                if (path) await SGEFirebase.deleteFile(decodeURIComponent(path));
            } catch {}
        }

        await SGEDb.remove('library_files', id);
        SGENotifications.success('Ficheiro eliminado.');
        SGERouter.navigate('/library');
    }

    function _filterCat(cat) {
        const cards = document.querySelectorAll('#library-grid > div');
        cards.forEach(card => {
            if (cat === 'all' || card.dataset.category === cat) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { render, openUploadModal, downloadFile, deleteFile, _filterCat };
})();
window.SGELibrary = SGELibrary;