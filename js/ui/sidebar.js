// ============================================
// SGE-NG - MENU LATERAL DINÂMICO
// Gera o sidebar com base nas permissões
// do perfil do utilizador logado
// ============================================

const SGESidebar = (() => {
    'use strict';

    // ============================================
    // DEFINIÇÃO COMPLETA DO MENU
    // Cada item tem: id, label, icon, route, module, action, children
    // ============================================

    const MENU_STRUCTURE = [
        // ---- PRINCIPAL ----
        {
            group: 'Principal',
            items: [
                {
                    id: 'dashboard',
                    label: 'Painel',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>`,
                    route: '/dashboard',
                    module: 'dashboard',
                    action: 'read'
                }
            ]
        },

        // ---- ACADÉMICO ----
        {
            group: 'Académico',
            items: [
                {
                    id: 'school-years',
                    label: 'Ano Letivo',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
                    route: '/academic/school-years',
                    module: 'academic',
                    action: 'read'
                },
                {
                    id: 'classes',
                    label: 'Classes',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`,
                    route: '/academic/classes',
                    module: 'academic',
                    action: 'read'
                },
                {
                    id: 'sections',
                    label: 'Turmas',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
                    route: '/academic/sections',
                    module: 'academic',
                    action: 'read'
                },
                {
                    id: 'shifts',
                    label: 'Turnos',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
                    route: '/academic/shifts',
                    module: 'academic',
                    action: 'read'
                },
                {
                    id: 'subjects',
                    label: 'Disciplinas',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
                    route: '/academic/subjects',
                    module: 'academic',
                    action: 'read'
                },
                {
                    id: 'assignments',
                    label: 'Atribuições',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>`,
                    route: '/academic/assignments',
                    module: 'academic',
                    action: 'read'
                }
            ]
        },

        // ---- GESTÃO ----
        {
            group: 'Gestão',
            items: [
                {
                    id: 'students',
                    label: 'Estudantes',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
                    route: '/students',
                    module: 'students',
                    action: 'read'
                },
                {
                    id: 'staff',
                    label: 'Funcionários',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`,
                    route: '/staff',
                    module: 'staff',
                    action: 'read'
                },
                {
                    id: 'grades',
                    label: 'Notas',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
                    route: '/grades',
                    module: 'grades',
                    action: 'read'
                },
                {
                    id: 'transcripts',
                    label: 'Pautas',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
                    route: '/transcripts',
                    module: 'transcripts',
                    action: 'read'
                },
                {
                    id: 'attendance',
                    label: 'Presenças',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
                    route: '/attendance',
                    module: 'attendance',
                    action: 'read'
                },
                {
                    id: 'history',
                    label: 'Histórico',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
                    route: '/history',
                    module: 'students',
                    action: 'read'
                }
            ]
        },

        // ---- DOCUMENTOS ----
        {
            group: 'Documentos',
            items: [
                {
                    id: 'report-cards',
                    label: 'Boletins',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>`,
                    route: '/documents/report-cards',
                    module: 'documents',
                    action: 'read'
                },
                {
                    id: 'declarations',
                    label: 'Declarações',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
                    route: '/documents/declarations',
                    module: 'documents',
                    action: 'read'
                },
                {
                    id: 'certificates',
                    label: 'Certificados',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>`,
                    route: '/documents/certificates',
                    module: 'documents',
                    action: 'read'
                },
                {
                    id: 'passes',
                    label: 'Passes',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"/></svg>`,
                    route: '/documents/passes',
                    module: 'documents',
                    action: 'read'
                }
            ]
        },

        // ---- FINANCEIRO ----
        {
            group: 'Financeiro',
            items: [
                {
                    id: 'fin-config',
                    label: 'Config. Financeira',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
                    route: '/financial/config',
                    module: 'financial',
                    action: 'read'
                },
                {
                    id: 'payments',
                    label: 'Pagamentos',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`,
                    route: '/financial/payments',
                    module: 'financial',
                    action: 'read'
                },
                {
                    id: 'cashflow',
                    label: 'Receitas/Despesas',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
                    route: '/financial/cashflow',
                    module: 'financial',
                    action: 'read'
                }
            ]
        },

        // ---- OUTROS ----
        {
            group: 'Outros',
            items: [
                {
                    id: 'statistics',
                    label: 'Estatísticas',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>`,
                    route: '/statistics',
                    module: 'statistics',
                    action: 'read'
                },
                {
                    id: 'reports',
                    label: 'Relatórios',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
                    route: '/reports',
                    module: 'reports',
                    action: 'read'
                },
                {
                    id: 'patrimony',
                    label: 'Património',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
                    route: '/patrimony',
                    module: 'patrimony',
                    action: 'read'
                },
                {
                    id: 'messages',
                    label: 'Mensagens',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>`,
                    route: '/messages',
                    module: 'messages',
                    action: 'read'
                },
                {
                    id: 'events',
                    label: 'Eventos',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
                    route: '/events',
                    module: 'events',
                    action: 'read'
                },
                {
                    id: 'library',
                    label: 'Biblioteca',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg>`,
                    route: '/library',
                    module: 'library',
                    action: 'read'
                }
            ]
        },

        // ---- SISTEMA ----
        {
            group: 'Sistema',
            items: [
                {
                    id: 'schools',
                    label: 'Escolas',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`,
                    route: '/system/schools',
                    module: 'schools',
                    action: 'read',
                    roles: ['admin_geral']
                },
                {
                    id: 'backup',
                    label: 'Backup/Restauro',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>`,
                    route: '/system/backup',
                    module: 'backup',
                    action: 'read'
                },
                {
                    id: 'settings',
                    label: 'Configurações',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
                    route: '/system/settings',
                    module: 'settings',
                    action: 'read'
                },
                {
                    id: 'audit-logs',
                    label: 'Auditoria',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
                    route: '/system/audit-logs',
                    module: 'audit_logs',
                    action: 'read'
                },
                {
                    id: 'users',
                    label: 'Utilizadores',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
                    route: '/system/users',
                    module: 'users',
                    action: 'read'
                },
                {
                    id: 'utilities',
                    label: 'Utilidades',
                    icon: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
                    route: '/system/utilities',
                    module: 'settings',
                    action: 'read'
                }
            ]
        }
    ];

    // ============================================
    // RENDERIZAÇÃO DO SIDEBAR
    // ============================================

    /**
     * Renderiza o menu lateral com base no papel do utilizador
     * @param {string} role - Papel do utilizador logado
     */
    function render(role) {
        const nav = document.getElementById('sidebar-nav');
        if (!nav) return;

        let html = '';

        MENU_STRUCTURE.forEach(group => {
            // Filtrar itens que o utilizador tem permissão de ver
            const visibleItems = group.items.filter(item => {
                // Se tem restrição de roles específicos
                if (item.roles && !item.roles.includes(role)) return false;
                // Verificar permissão no módulo
                if (item.module && item.action) {
                    return SGESecurity.hasPermission(role, item.module, item.action);
                }
                return true;
            });

            // Não mostrar grupo vazio
            if (visibleItems.length === 0) return;

            html += `<div class="sidebar-group-title">${group.group}</div>`;

            visibleItems.forEach(item => {
                html += `
                    <a href="#" data-route="${item.route}" class="sidebar-item" title="${item.label}">
                        ${item.icon}
                        <span class="truncate">${item.label}</span>
                    </a>
                `;
            });
        });

        nav.innerHTML = html;

        // Adicionar evento de clique para navegação
        nav.querySelectorAll('.sidebar-item[data-route]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const route = link.dataset.route;
                SGERouter.navigate(route);

                // Fechar sidebar no mobile
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebar-overlay');
                if (window.innerWidth < 1024) {
                    sidebar?.classList.add('-translate-x-full');
                    overlay?.classList.add('hidden');
                }
            });
        });
    }

    /**
     * Atualiza o item ativo no sidebar
     * @param {string} route - Rota atual
     */
    function setActive(route) {
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.route === route) {
                item.classList.add('active');
            }
        });
    }

    /**
     * Retorna a estrutura completa do menu (para outros usos)
     */
    function getMenuStructure() {
        return MENU_STRUCTURE;
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        render,
        setActive,
        getMenuStructure
    };
})();

window.SGESidebar = SGESidebar;