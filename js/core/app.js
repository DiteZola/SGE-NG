// ============================================
// SGE-NG - INICIALIZADOR PRINCIPAL
// Orquestra a inicialização de todos os serviços
// e decide o fluxo de arranque do sistema
// ============================================

const SGEApp = (() => {
    'use strict';

    let _initialized = false;
    let _appState = 'loading'; // loading, setup, login, ready, error

    // ============================================
    // FLUXO DE ARRANQUE
    // ============================================

    /**
     * Ponto de entrada principal do sistema
     * Chamado quando o DOM está pronto
     */
    async function boot() {
        console.log('========================================');
        console.log('  SGE-NG - Sistema de Gestão Escolar');
        console.log('  Versão 1.0.0');
        console.log('  A iniciar...');
        console.log('========================================');

        _updateLoadingStatus('A verificar o ambiente...', 10);

        try {
            // 1. Verificar compatibilidade do browser
            if (!_checkBrowserCompatibility()) {
                _showError('Browser não suportado. Use Chrome, Firefox ou Edge atualizado.');
                return;
            }

            _updateLoadingStatus('A inicializar base de dados...', 20);

            // 2. Inicializar IndexedDB
            const dbOk = await SGEDb.initialize();
            if (!dbOk) {
                _showError('Não foi possível inicializar a base de dados local.');
                return;
            }

            _updateLoadingStatus('A conectar ao Firebase...', 35);

            // 3. Inicializar Firebase (pode falhar se offline - não é crítico)
            const fbOk = await SGEFirebase.initialize();
            if (!fbOk) {
                console.warn('[App] Firebase não inicializado. Modo offline ativo.');
            }

            _updateLoadingStatus('A configurar segurança...', 50);

            // 4. Inicializar segurança
            SGESecurity.initialize();

            _updateLoadingStatus('A configurar autenticação...', 60);

            // 5. Inicializar autenticação
            await SGEAuth.initialize();

            _updateLoadingStatus('A configurar sincronização...', 70);

            // 6. Inicializar sincronização
            await SGESync.initialize();

            _updateLoadingStatus('A configurar router...', 80);

            // 7. Inicializar router
            SGERouter.initialize();
            _registerRoutes();
            _setupRouterGuards();

            _updateLoadingStatus('A verificar sessão...', 90);

            // 8. Verificar se o sistema já foi configurado
            const isConfigured = await SGEDb.getConfig('system_initialized');

            if (!isConfigured && SGEFirebase.isOnline()) {
                // Verificar no Firestore também
                try {
                    const configDoc = await SGEFirebase.getDB()
                        .collection('system_config')
                        .doc('system_initialized')
                        .get();
                    if (!configDoc.exists) {
                        _appState = 'setup';
                        _showSetupWizard();
                        return;
                    }
                } catch {
                    // Se offline e sem config local, mostrar setup
                    if (!isConfigured) {
                        _appState = 'setup';
                        _showSetupWizard();
                        return;
                    }
                }
            }

            // 9. Tentar restaurar sessão
            const session = await SGEAuth.restoreSession();

            if (session.restored) {
                _appState = 'ready';
                await _startApp(session.user);
            } else {
                _appState = 'login';
                _showLogin();
            }

            _updateLoadingStatus('Concluído!', 100);

        } catch (error) {
            console.error('[App] Erro fatal na inicialização:', error);
            _showError(`Erro na inicialização: ${error.message}`);
        }
    }

    // ============================================
    // VERIFICAÇÃO DE COMPATIBILIDADE
    // ============================================

    function _checkBrowserCompatibility() {
        const checks = {
            'IndexedDB': !!window.indexedDB,
            'Service Worker': 'serviceWorker' in navigator,
            'Web Crypto': !!(window.crypto && window.crypto.subtle),
            'ES6 Modules': typeof Promise !== 'undefined',
            'Fetch API': typeof fetch !== 'undefined',
            'LocalStorage': (() => { try { localStorage.setItem('t', '1'); localStorage.removeItem('t'); return true; } catch { return false; } })()
        };

        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);

        if (failed.length > 0) {
            console.error('[App] Funcionalidades não suportadas:', failed);
            // IndexedDB e Crypto são críticos
            if (!checks['IndexedDB'] || !checks['Web Crypto']) return false;
        }

        return true;
    }

    // ============================================
    // REGISTO DE ROTAS
    // ============================================

    function _registerRoutes() {
        SGERouter.registerAll({
            // Principal
            '/dashboard': {
                component: () => SGEDashboard?.render() || '<p>Dashboard em construção</p>',
                title: 'Painel de Controlo',
                module: 'dashboard', action: 'read',
                breadcrumb: [{ label: 'Painel', path: '/dashboard' }]
            },

            // Académico
            '/academic/school-years': {
                component: () => SGESchoolYear?.render() || '',
                title: 'Anos Letivos', module: 'academic',
                breadcrumb: [{ label: 'Académico', path: '#' }, { label: 'Anos Letivos', path: '/academic/school-years' }]
            },
            '/academic/classes': {
                component: () => SGEClasses?.render() || '',
                title: 'Classes', module: 'academic',
                breadcrumb: [{ label: 'Académico', path: '#' }, { label: 'Classes', path: '/academic/classes' }]
            },
            '/academic/sections': {
                component: () => SGESections?.render() || '',
                title: 'Turmas', module: 'academic',
                breadcrumb: [{ label: 'Académico', path: '#' }, { label: 'Turmas', path: '/academic/sections' }]
            },
            '/academic/shifts': {
                component: () => SGEShifts?.render() || '',
                title: 'Turnos', module: 'academic',
                breadcrumb: [{ label: 'Académico', path: '#' }, { label: 'Turnos', path: '/academic/shifts' }]
            },
            '/academic/subjects': {
                component: () => SGESubjects?.render() || '',
                title: 'Disciplinas', module: 'academic',
                breadcrumb: [{ label: 'Académico', path: '#' }, { label: 'Disciplinas', path: '/academic/subjects' }]
            },
            '/academic/assignments': {
                component: () => SGEAssignments?.render() || '',
                title: 'Atribuições', module: 'academic',
                breadcrumb: [{ label: 'Académico', path: '#' }, { label: 'Atribuições', path: '/academic/assignments' }]
            },

            // Gestão
            '/students': {
                component: () => SGEStudents?.render() || '',
                title: 'Estudantes', module: 'students',
                breadcrumb: [{ label: 'Estudantes', path: '/students' }]
            },
            '/students/:id': {
                component: (p) => SGEStudents?.renderDetail(p.id) || '',
                title: 'Ficha do Aluno', module: 'students',
                breadcrumb: [{ label: 'Estudantes', path: '/students' }, { label: 'Ficha', path: '#' }]
            },
            '/staff': {
                component: () => SGEStaff?.render() || '',
                title: 'Funcionários', module: 'staff',
                breadcrumb: [{ label: 'Funcionários', path: '/staff' }]
            },
            '/grades': {
                component: () => SGEGrades?.render() || '',
                title: 'Notas', module: 'grades',
                breadcrumb: [{ label: 'Notas', path: '/grades' }]
            },
            '/transcripts': {
                component: () => SGETranscripts?.render() || '',
                title: 'Pautas', module: 'transcripts',
                breadcrumb: [{ label: 'Pautas', path: '/transcripts' }]
            },
            '/attendance': {
                component: () => SGEAttendance?.render() || '',
                title: 'Presenças', module: 'attendance',
                breadcrumb: [{ label: 'Presenças', path: '/attendance' }]
            },
            '/history': {
                component: () => SGEHistory?.render() || '',
                title: 'Histórico Escolar', module: 'students',
                breadcrumb: [{ label: 'Histórico', path: '/history' }]
            },
            '/jury': {
                component: () => SGEJury?.render() || '',
                title: 'Comissões de Júri', module: 'jury',
                breadcrumb: [{ label: 'Júri', path: '/jury' }]
            },

            // Documentos
            '/documents/report-cards': {
                component: () => SGEReportCards?.render() || '',
                title: 'Boletins', module: 'documents',
                breadcrumb: [{ label: 'Documentos', path: '#' }, { label: 'Boletins', path: '/documents/report-cards' }]
            },
            '/documents/declarations': {
                component: () => SGEDeclarations?.render() || '',
                title: 'Declarações', module: 'documents',
                breadcrumb: [{ label: 'Documentos', path: '#' }, { label: 'Declarações', path: '/documents/declarations' }]
            },
            '/documents/certificates': {
                component: () => SGECertificates?.render() || '',
                title: 'Certificados', module: 'documents',
                breadcrumb: [{ label: 'Documentos', path: '#' }, { label: 'Certificados', path: '/documents/certificates' }]
            },
            '/documents/passes': {
                component: () => SGEPasses?.render() || '',
                title: 'Passes Escolares', module: 'documents',
                breadcrumb: [{ label: 'Documentos', path: '#' }, { label: 'Passes', path: '/documents/passes' }]
            },

            // Financeiro
            '/financial/config': {
                component: () => SGEFinConfig?.render() || '',
                title: 'Config. Financeira', module: 'financial',
                breadcrumb: [{ label: 'Financeiro', path: '#' }, { label: 'Configuração', path: '/financial/config' }]
            },
            '/financial/payments': {
                component: () => SGEPayments?.render() || '',
                title: 'Pagamentos', module: 'financial',
                breadcrumb: [{ label: 'Financeiro', path: '#' }, { label: 'Pagamentos', path: '/financial/payments' }]
            },
            '/financial/cashflow': {
                component: () => SGECashflow?.render() || '',
                title: 'Receitas/Despesas', module: 'financial',
                breadcrumb: [{ label: 'Financeiro', path: '#' }, { label: 'Fluxo de Caixa', path: '/financial/cashflow' }]
            },

            // Outros
            '/statistics': {
                component: () => SGEStatistics?.render() || '',
                title: 'Estatísticas', module: 'statistics',
                breadcrumb: [{ label: 'Estatísticas', path: '/statistics' }]
            },
            '/reports': {
                component: () => SGEReports?.render() || '',
                title: 'Relatórios', module: 'reports',
                breadcrumb: [{ label: 'Relatórios', path: '/reports' }]
            },
            '/patrimony': {
                component: () => SGEPatrimony?.render() || '',
                title: 'Património', module: 'patrimony',
                breadcrumb: [{ label: 'Património', path: '/patrimony' }]
            },
            '/messages': {
                component: () => SGEMessages?.render() || '',
                title: 'Mensagens', module: 'messages',
                breadcrumb: [{ label: 'Mensagens', path: '/messages' }]
            },
            '/events': {
                component: () => SGEEvents?.render() || '',
                title: 'Eventos', module: 'events',
                breadcrumb: [{ label: 'Eventos', path: '/events' }]
            },
            '/library': {
                component: () => SGELibrary?.render() || '',
                title: 'Biblioteca', module: 'library',
                breadcrumb: [{ label: 'Biblioteca', path: '/library' }]
            },

            // Sistema
            '/system/schools': {
                component: () => SGESchools?.render() || '',
                title: 'Escolas', module: 'schools',
                breadcrumb: [{ label: 'Sistema', path: '#' }, { label: 'Escolas', path: '/system/schools' }]
            },
            '/system/backup': {
                component: () => SGEBackup?.render() || '',
                title: 'Backup/Restauro', module: 'backup',
                breadcrumb: [{ label: 'Sistema', path: '#' }, { label: 'Backup', path: '/system/backup' }]
            },
            '/system/settings': {
                component: () => SGESettings?.render() || '',
                title: 'Configurações', module: 'settings',
                breadcrumb: [{ label: 'Sistema', path: '#' }, { label: 'Configurações', path: '/system/settings' }]
            },
            '/system/audit-logs': {
                component: () => SGEAuditLogs?.render() || '',
                title: 'Logs de Auditoria', module: 'audit_logs',
                breadcrumb: [{ label: 'Sistema', path: '#' }, { label: 'Auditoria', path: '/system/audit-logs' }]
            },
            '/system/users': {
                component: () => SGEUsers?.render() || '',
                title: 'Utilizadores', module: 'users',
                breadcrumb: [{ label: 'Sistema', path: '#' }, { label: 'Utilizadores', path: '/system/users' }]
            },
            '/system/utilities': {
                component: () => SGEUtilities?.render() || '',
                title: 'Utilidades', module: 'settings',
                breadcrumb: [{ label: 'Sistema', path: '#' }, { label: 'Utilidades', path: '/system/utilities' }]
            }
        });
    }

    // ============================================
    // GUARDAS DO ROUTER
    // ============================================

    function _setupRouterGuards() {
        SGERouter.beforeEach(async (to, from) => {
            // Se não está logado e não é rota de login, redirecionar
            if (!SGEAuth.isLoggedIn() && _appState !== 'setup') {
                _showLogin();
                return false;
            }
            return true;
        });
    }

    // ============================================
    // ARRANQUE DA APLICAÇÃO (Após Login)
    // ============================================

    async function _startApp(user) {
        console.log('[App] A iniciar aplicação para:', user.fullName || user.email);

        // Esconder ecrãs de login/setup
        SGEUtils.hide('#login-screen');
        SGEUtils.hide('#setup-screen');
        SGEUtils.hide('#loading-screen');

        // Mostrar app
        SGEUtils.show('#app-container');

        // Atualizar UI com dados do utilizador
        _updateUserUI(user);

        // Atualizar sidebar com permissões
        if (window.SGESidebar) {
            SGESidebar.render(user.role);
        }

        // Iniciar motores
        SGESecurity.startMonitoring();
        await SGERecovery.initialize();
        SGESync.startAutoSync();

        // Configurar indicadores de conexão
        _setupConnectionIndicators();

        // Configurar notificações de segurança
        SGESecurity.onSecurityAlert((level, message) => {
            if (window.SGENotifications) {
                SGENotifications.show(message, level);
            }
        });

        SGERecovery.onRecoveryNotification((notification) => {
            if (window.SGENotifications) {
                SGENotifications.show(notification.details?.message || notification.type, 'warning', 10000);
            }
        });

        // Sincronização inicial
        if (SGEFirebase.isOnline() && user.schoolId) {
            setTimeout(async () => {
                console.log('[App] Sincronização inicial...');
                await SGESync.fullSync(user.schoolId);
            }, 3000);
        }

        // Navegar para dashboard
        SGERouter.navigate('/dashboard');

        // Registar Service Worker
        _registerServiceWorker();

        _initialized = true;
        console.log('[App] Aplicação pronta!');
    }

    // ============================================
    // UI DO UTILIZADOR
    // ============================================

    function _updateUserUI(user) {
        const initials = SGEUtils.getInitials(user.fullName || user.email);
        const roleLabels = {
            admin_geral: 'Administrador Geral',
            director: 'Diretor',
            subdirector: 'Subdiretor',
            coordenador: 'Coordenador',
            secretario: 'Secretário',
            professor: 'Professor',
            funcionario: 'Funcionário'
        };

        // Sidebar
        const nameEl = document.getElementById('user-name-sidebar');
        const roleEl = document.getElementById('user-role-sidebar');
        const avatarEl = document.getElementById('user-avatar-sidebar');
        if (nameEl) nameEl.textContent = user.fullName || user.email;
        if (roleEl) roleEl.textContent = roleLabels[user.role] || user.role;
        if (avatarEl) avatarEl.textContent = initials;

        // Header
        const headerAvatar = document.getElementById('user-avatar-header');
        if (headerAvatar) headerAvatar.textContent = initials;

        // Dados da escola
        _loadSchoolInfo(user.schoolId);
    }

    async function _loadSchoolInfo(schoolId) {
        if (!schoolId) return;
        try {
            const school = await SGEDb.get('schools', schoolId);
            if (school) {
                const nameEl = document.getElementById('school-name-sidebar');
                if (nameEl) nameEl.textContent = school.name || 'SGE-NG';
            }

            // Carregar ano letivo atual
            const years = await SGEDb.getByIndex('school_years', 'schoolId', schoolId);
            const activeYear = years.find(y => y.status === 'active');
            const yearEl = document.getElementById('school-year-sidebar');
            if (yearEl) yearEl.textContent = activeYear ? `Ano ${activeYear.year}` : '---';

        } catch (e) {
            console.warn('[App] Erro ao carregar info da escola:', e.message);
        }
    }

    // ============================================
    // ECRÃS
    // ============================================

    function _showLogin() {
        SGEUtils.hide('#loading-screen');
        SGEUtils.hide('#setup-screen');
        SGEUtils.hide('#app-container');
        SGEUtils.show('#login-screen');

        // Configurar formulário de login
        _setupLoginForm();

        // Mostrar nota offline
        const offlineNote = document.getElementById('login-offline-note');
        if (offlineNote) {
            offlineNote.textContent = SGEFirebase.isOnline()
                ? ''
                : '⚠️ Modo offline - Os dados serão sincronizados quando a ligação for restabelecida.';
        }
    }

    function _showSetupWizard() {
        SGEUtils.hide('#loading-screen');
        SGEUtils.hide('#login-screen');
        SGEUtils.hide('#app-container');
        SGEUtils.show('#setup-screen');

        if (window.SGESetupWizard) {
            SGESetupWizard.render();
        }
    }

    function _showError(message) {
        SGEUtils.hide('#loading-screen');
        const container = document.getElementById('loading-screen');
        if (container) {
            container.innerHTML = `
                <div class="text-center p-8">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-danger-100 flex items-center justify-center">
                        <svg class="w-8 h-8 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                        </svg>
                    </div>
                    <h2 class="text-xl font-bold text-gray-900 mb-2">Erro no Sistema</h2>
                    <p class="text-gray-600 mb-6">${message}</p>
                    <button onclick="location.reload()" class="btn btn-primary">Recarregar Página</button>
                </div>
            `;
            SGEUtils.show(container);
        }
    }

    // ============================================
    // FORMULÁRIO DE LOGIN
    // ============================================

    function _setupLoginForm() {
        const form = document.getElementById('login-form');
        if (!form) return;

        // Prevenir duplo submit
        let isSubmitting = false;

        form.onsubmit = async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            isSubmitting = true;

            const email = document.getElementById('login-email')?.value || '';
            const password = document.getElementById('login-password')?.value || '';
            const errorEl = document.getElementById('login-error');
            const submitBtn = document.getElementById('login-submit-btn');

            // Esconder erro anterior
            if (errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }
            if (submitBtn) submitBtn.disabled = true;

            const result = await SGEAuth.login(email, password);

            if (result.success) {
                _appState = 'ready';
                await _startApp(result.user);
            } else {
                if (errorEl) {
                    errorEl.textContent = result.error;
                    errorEl.classList.remove('hidden');
                    errorEl.classList.add('animate-shake');
                    setTimeout(() => errorEl.classList.remove('animate-shake'), 500);
                }
            }

            if (submitBtn) submitBtn.disabled = false;
            isSubmitting = false;
        };

        // Toggle password
        const toggleBtn = document.getElementById('toggle-password');
        const passwordInput = document.getElementById('login-password');
        if (toggleBtn && passwordInput) {
            toggleBtn.onclick = () => {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';
            };
        }

        // Consulta de pais
        const parentBtn = document.getElementById('btn-parent-lookup');
        if (parentBtn) {
            parentBtn.onclick = () => {
                SGEUtils.show('#parent-lookup-modal');
            };
        }

        const closeParentBtn = document.getElementById('close-parent-lookup');
        if (closeParentBtn) {
            closeParentBtn.onclick = () => SGEUtils.hide('#parent-lookup-modal');
        }
    }

    // ============================================
    // INDICADORES DE CONEXÃO
    // ============================================

    function _setupConnectionIndicators() {
        const updateIndicator = (online) => {
            const indicator = document.getElementById('online-indicator');
            const syncDot = document.getElementById('sync-indicator');
            const syncText = document.getElementById('sync-status-text');
            const connBar = document.getElementById('connection-bar');
            const connText = document.getElementById('connection-text');

            if (online) {
                if (indicator) {
                    indicator.className = 'flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700';
                    indicator.innerHTML = '<div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div><span>Online</span>';
                }
                if (syncDot) syncDot.className = 'w-2 h-2 rounded-full bg-green-500';
                if (syncText) syncText.textContent = 'Sincronizado';
                if (connBar) connBar.classList.add('hidden');
            } else {
                if (indicator) {
                    indicator.className = 'flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700';
                    indicator.innerHTML = '<div class="w-1.5 h-1.5 rounded-full bg-red-500"></div><span>Offline</span>';
                }
                if (syncDot) syncDot.className = 'w-2 h-2 rounded-full bg-yellow-500';
                if (syncText) syncText.textContent = 'Modo Offline';
                if (connBar) {
                    connBar.classList.remove('hidden');
                    connBar.querySelector('div').className = 'px-4 py-2 text-center text-sm font-medium connection-offline';
                    if (connText) connText.textContent = '⚠️ Sem ligação à Internet. Os dados serão guardados localmente.';
                }
            }
        };

        SGEFirebase.onConnectionChange(updateIndicator);
        updateIndicator(SGEFirebase.isOnline());

        // Listener de sincronização
        SGESync.onSyncStateChange((status) => {
            const syncDot = document.getElementById('sync-indicator');
            const syncText = document.getElementById('sync-status-text');
            if (status === 'syncing') {
                if (syncDot) syncDot.className = 'w-2 h-2 rounded-full bg-blue-500 animate-pulse';
                if (syncText) syncText.textContent = 'A sincronizar...';
            } else if (status === 'pending') {
                if (syncDot) syncDot.className = 'w-2 h-2 rounded-full bg-yellow-500';
                if (syncText) syncText.textContent = 'Dados pendentes';
            } else {
                if (syncDot) syncDot.className = 'w-2 h-2 rounded-full bg-green-500';
                if (syncText) syncText.textContent = 'Sincronizado';
            }
        });
    }

    // ============================================
    // SERVICE WORKER
    // ============================================

    function _registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    console.log('[App] Service Worker registado:', reg.scope);
                    reg.addEventListener('updatefound', () => {
                        console.log('[App] Nova versão do Service Worker disponível');
                    });
                })
                .catch(err => console.warn('[App] Falha ao registar Service Worker:', err));
        }
    }

    // ============================================
    // LOADING
    // ============================================

    function _updateLoadingStatus(text, percent) {
        const statusEl = document.getElementById('loading-status');
        const progressEl = document.getElementById('loading-progress');
        if (statusEl) statusEl.textContent = text;
        if (progressEl) progressEl.style.width = `${percent}%`;
    }

    // ============================================
    // SIDEBAR E HEADER
    // ============================================

    function _setupUIControls() {
        // Toggle sidebar (mobile)
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const closeBtn = document.getElementById('sidebar-close-btn');

        const openSidebar = () => {
            if (sidebar) sidebar.classList.remove('-translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
        };
        const closeSidebar = () => {
            if (sidebar) sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        };

        if (toggleBtn) toggleBtn.onclick = openSidebar;
        if (closeBtn) closeBtn.onclick = closeSidebar;
        if (overlay) overlay.onclick = closeSidebar;

        // Logout
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                await SGEAuth.logout();
                _appState = 'login';
                _showLogin();
            };
        }

        // Footer year
        const footerYear = document.getElementById('footer-year');
        if (footerYear) footerYear.textContent = new Date().getFullYear();
    }

    // ============================================
    // API PÚBLICA
    // ============================================

    return {
        boot,
        getState: () => _appState,
        isInitialized: () => _initialized,
        restart: async () => {
            await SGEAuth.logout();
            location.reload();
        }
    };
})();

// ============================================
// ARRANQUE DO SISTEMA
// ============================================
// CÓDIGO CORRIGIDO (substituir todo o DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
    SGEApp.boot();
});