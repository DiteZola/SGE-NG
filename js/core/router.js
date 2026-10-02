// ============================================
// SGE-NG - ROUTER SPA
// Navegação entre módulos sem recarregar a página
// Gestão de URLs, histórico e permissões
// ============================================

const SGERouter = (() => {
    'use strict';

    // Registo de rotas
    const _routes = {};
    let _currentRoute = null;
    let _currentParams = {};
    let _beforeEachGuards = [];
    let _afterEachHooks = [];
    let _notFoundHandler = null;
    let _initialized = false;

    // ============================================
    // REGISTO DE ROTAS
    // ============================================

    /**
     * Regista uma rota
     * @param {string} path - Caminho (ex: '/dashboard', '/students/:id')
     * @param {object} config - Configuração da rota
     *   config.component: Function que retorna HTML ou renderiza no contentor
     *   config.title: Título da página
     *   config.module: Módulo para verificação de permissões
     *   config.action: Ação para verificação de permissões (default: 'read')
     *   config.breadcrumb: Array de breadcrumbs [{label, path}]
     *   config.layout: 'default' | 'full' | 'auth'
     */
    function register(path, config) {
        _routes[path] = {
            path,
            component: config.component || (() => '<p>Página em construção</p>'),
            title: config.title || 'SGE-NG',
            module: config.module || null,
            action: config.action || 'read',
            breadcrumb: config.breadcrumb || [],
            layout: config.layout || 'default',
            meta: config.meta || {}
        };
    }

    /**
     * Regista múltiplas rotas de uma vez
     * @param {object} routes - { '/path': config, ... }
     */
    function registerAll(routes) {
        Object.entries(routes).forEach(([path, config]) => register(path, config));
    }

    // ============================================
    // GUARDAS DE NAVEGAÇÃO
    // ============================================

    /**
     * Adiciona guarda executado ANTES de cada navegação
     * @param {Function} guard - Recebe (to, from) e deve retornar:
     *   true = permitir, false = bloquear, '/path' = redirecionar
     */
    function beforeEach(guard) {
        if (typeof guard === 'function') _beforeEachGuards.push(guard);
    }

    /**
     * Adiciona hook executado DEPOIS de cada navegação
     * @param {Function} hook - Recebe (to, from)
     */
    function afterEach(hook) {
        if (typeof hook === 'function') _afterEachHooks.push(hook);
    }

    /**
     * Define handler para rotas não encontradas (404)
     */
    function onNotFound(handler) {
        _notFoundHandler = handler;
    }

    // ============================================
    // NAVEGAÇÃO
    // ============================================

    /**
     * Navega para uma rota
     * @param {string} path - Caminho (ex: '/students', '/students/abc123')
     * @param {object} [params] - Parâmetros adicionais
     * @param {boolean} [replace] - Substituir histórico em vez de adicionar
     * @returns {Promise<boolean>}
     */
    async function navigate(path, params = {}, replace = false) {
        try {
            // Separar path de query string
            const [basePath, queryString] = path.split('?');
            const queryParams = _parseQueryString(queryString);
            const allParams = { ...params, ...queryParams };

            // Encontrar rota correspondente
            const routeMatch = _matchRoute(basePath);

            if (!routeMatch) {
                console.warn(`[Router] Rota não encontrada: ${basePath}`);
                if (_notFoundHandler) {
                    _notFoundHandler(basePath);
                } else {
                    _renderNotFound(basePath);
                }
                return false;
            }

            const { route, routeParams } = routeMatch;
            const mergedParams = { ...routeParams, ...allParams };

            // Executar guardas
            const from = _currentRoute ? { path: _currentRoute.path, params: _currentParams } : null;
            const to = { path: route.path, params: mergedParams, route };

            for (const guard of _beforeEachGuards) {
                const result = await guard(to, from);
                if (result === false) {
                    console.log('[Router] Navegação bloqueada por guarda');
                    return false;
                }
                if (typeof result === 'string') {
                    // Redirecionar
                    return navigate(result, params, true);
                }
            }

            // Verificar permissões
            if (route.module && route.action) {
                if (!SGEAuth.can(route.module, route.action)) {
                    console.warn(`[Router] Sem permissão: ${route.module}.${route.action}`);
                    _renderNoPermission(route);
                    return false;
                }
            }

            // Atualizar estado
            const previousRoute = _currentRoute;
            _currentRoute = route;
            _currentParams = mergedParams;

            // Atualizar URL
            const url = _buildUrl(basePath, mergedParams);
            if (replace) {
                history.replaceState({ path: basePath, params: mergedParams }, '', url);
            } else {
                history.pushState({ path: basePath, params: mergedParams }, '', url);
            }

            // Atualizar título
            document.title = `${route.title} | SGE-NG`;

            // Atualizar UI
            _updatePageTitle(route.title);
            _updateBreadcrumbs(route.breadcrumb, mergedParams);
            _updateActiveSidebar(route.path);

            // Renderizar componente
            await _renderRoute(route, mergedParams);

            // Executar hooks pós-navegação
            _afterEachHooks.forEach(hook => {
                try { hook(to, from); } catch (e) { console.error('[Router] Hook error:', e); }
            });

            // Scroll para o topo
            const mainContent = document.getElementById('main-content');
            if (mainContent) mainContent.scrollTop = 0;

            return true;

        } catch (error) {
            console.error('[Router] Erro na navegação:', error);
            return false;
        }
    }

    /**
     * Volta à rota anterior
     */
    function back() {
        history.back();
    }

    /**
     * Avança na história
     */
    function forward() {
        history.forward();
    }

    // ============================================
    // MATCHING DE ROTAS
    // ============================================

    /**
     * Encontra a rota que corresponde ao path
     * Suporta parâmetros dinâmicos: /students/:id
     */
    function _matchRoute(path) {
        // 1. Match exato
        if (_routes[path]) {
            return { route: _routes[path], routeParams: {} };
        }

        // 2. Match com parâmetros dinâmicos
        for (const [routePath, route] of Object.entries(_routes)) {
            const params = _matchDynamicPath(routePath, path);
            if (params !== null) {
                return { route, routeParams: params };
            }
        }

        // 3. Match wildcard (rotas que terminam em /*)
        for (const [routePath, route] of Object.entries(_routes)) {
            if (routePath.endsWith('/*')) {
                const prefix = routePath.slice(0, -2);
                if (path.startsWith(prefix)) {
                    return { route, routeParams: { wildcard: path.slice(prefix.length) } };
                }
            }
        }

        return null;
    }

    /**
     * Compara path dinâmico com path real
     * Ex: /students/:id vs /students/abc123 -> { id: 'abc123' }
     */
    function _matchDynamicPath(routePath, actualPath) {
        const routeParts = routePath.split('/').filter(Boolean);
        const actualParts = actualPath.split('/').filter(Boolean);

        if (routeParts.length !== actualParts.length) return null;

        const params = {};
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                params[routeParts[i].slice(1)] = decodeURIComponent(actualParts[i]);
            } else if (routeParts[i] !== actualParts[i]) {
                return null;
            }
        }

        return params;
    }

    // ============================================
    // RENDERIZAÇÃO
    // ============================================

    async function _renderRoute(route, params) {
        const container = document.getElementById('main-content');
        if (!container) return;

        // Mostrar loading
        container.innerHTML = `
            <div class="flex items-center justify-center h-64">
                <div class="text-center">
                    <div class="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3"></div>
                    <p class="text-sm text-gray-500">A carregar...</p>
                </div>
            </div>
        `;

        try {
            // Executar componente
            const result = route.component(params);

            // Se é uma Promise, aguardar
            const html = result instanceof Promise ? await result : result;

            if (typeof html === 'string') {
                container.innerHTML = html;
            } else if (html instanceof HTMLElement) {
                container.innerHTML = '';
                container.appendChild(html);
            }

            // Disparar evento para módulos inicializarem
            container.dispatchEvent(new CustomEvent('route-rendered', {
                detail: { route: route.path, params }
            }));

        } catch (error) {
            console.error(`[Router] Erro ao renderizar ${route.path}:`, error);
            container.innerHTML = `
                <div class="flex items-center justify-center h-64">
                    <div class="text-center">
                        <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-danger-100 flex items-center justify-center">
                            <svg class="w-6 h-6 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                            </svg>
                        </div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-1">Erro ao carregar página</h3>
                        <p class="text-sm text-gray-500 mb-4">${error.message}</p>
                        <button onclick="SGERouter.navigate('${route.path}')" class="btn btn-primary btn-sm">Tentar novamente</button>
                    </div>
                </div>
            `;
        }
    }

    function _renderNotFound(path) {
        const container = document.getElementById('main-content');
        if (!container) return;
        container.innerHTML = `
            <div class="flex items-center justify-center h-64">
                <div class="text-center">
                    <h1 class="text-6xl font-bold text-gray-200 mb-4">404</h1>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Página não encontrada</h3>
                    <p class="text-sm text-gray-500 mb-4">O caminho "${path}" não existe.</p>
                    <button onclick="SGERouter.navigate('/dashboard')" class="btn btn-primary btn-sm">Ir para o Painel</button>
                </div>
            </div>
        `;
    }

    function _renderNoPermission(route) {
        const container = document.getElementById('main-content');
        if (!container) return;
        container.innerHTML = `
            <div class="flex items-center justify-center h-64">
                <div class="text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-danger-100 flex items-center justify-center">
                        <svg class="w-8 h-8 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Acesso Negado</h3>
                    <p class="text-sm text-gray-500 mb-4">Não tem permissão para aceder a "${route.title}".</p>
                    <button onclick="SGERouter.navigate('/dashboard')" class="btn btn-primary btn-sm">Voltar ao Painel</button>
                </div>
            </div>
        `;
    }

    // ============================================
    // ATUALIZAÇÃO DA UI
    // ============================================

    function _updatePageTitle(title) {
        const el = document.getElementById('page-title');
        if (el) el.textContent = title;
    }

    function _updateBreadcrumbs(breadcrumbs, params) {
        const el = document.getElementById('breadcrumbs');
        if (!el || !breadcrumbs || breadcrumbs.length === 0) {
            if (el) el.innerHTML = '';
            return;
        }

        el.innerHTML = breadcrumbs.map((crumb, i) => {
            const label = crumb.label.replace(/:(\w+)/g, (_, key) => params[key] || key);
            const isLast = i === breadcrumbs.length - 1;

            if (isLast) {
                return `<span class="text-gray-900 font-medium">${label}</span>`;
            }
            return `
                <a href="#" onclick="event.preventDefault(); SGERouter.navigate('${crumb.path}')"
                   class="hover:text-primary-600 transition-colors">${label}</a>
                <svg class="w-4 h-4 mx-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            `;
        }).join('');
    }

    function _updateActiveSidebar(path) {
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
            const itemPath = item.dataset.route;
            if (itemPath && (path === itemPath || path.startsWith(itemPath + '/'))) {
                item.classList.add('active');
            }
        });
    }

    // ============================================
    // UTILITÁRIOS
    // ============================================

    function _parseQueryString(qs) {
        if (!qs) return {};
        const params = {};
        qs.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        });
        return params;
    }

    function _buildUrl(path, params) {
        // Substituir parâmetros dinâmicos no path
        let url = path;
        const queryParams = {};

        for (const [key, value] of Object.entries(params)) {
            if (url.includes(`:${key}`)) {
                url = url.replace(`:${key}`, encodeURIComponent(value));
            } else {
                queryParams[key] = value;
            }
        }

        const qs = Object.entries(queryParams)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');

        return qs ? `${url}?${qs}` : url;
    }

    // ============================================
    // ESTADO ATUAL
    // ============================================

    function getCurrentPath() { return _currentRoute?.path || '/'; }
    function getCurrentParams() { return { ..._currentParams }; }
    function getCurrentRoute() { return _currentRoute; }

    // ============================================
    // INICIALIZAÇÃO
    // ============================================

    function initialize() {
        if (_initialized) return;

        // Escutar botão voltar/avançar do browser
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.path) {
                navigate(event.state.path, event.state.params || {}, true);
            } else {
                navigate('/dashboard', {}, true);
            }
        });

        // Interceptar cliques em links internos
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[data-route]');
            if (link) {
                event.preventDefault();
                const path = link.dataset.route;
                const params = {};
                // Extrair data-params-* attributes
                for (const attr of link.attributes) {
                    if (attr.name.startsWith('data-param-')) {
                        params[attr.name.replace('data-param-', '')] = attr.value;
                    }
                }
                navigate(path, params);
            }
        });

        _initialized = true;
        console.log('[Router] Router SPA inicializado');
    }

    // ============================================
    // API PÚBLICA
    // ============================================
    return {
        initialize,
        register,
        registerAll,
        beforeEach,
        afterEach,
        onNotFound,
        navigate,
        back,
        forward,
        getCurrentPath,
        getCurrentParams,
        getCurrentRoute
    };
})();

window.SGERouter = SGERouter;