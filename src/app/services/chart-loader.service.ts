import { log } from '../../utils'

/**
 * Lazy-loaded Chart.js module
 */
let chartJsModule: typeof import('chart.js') | null = null
let isLoading = false
let loadPromise: Promise<typeof import('chart.js')> | null = null

/**
 * Service for managing Chart.js loading and registration.
 * Ensures Chart.js is only loaded and registered once globally.
 */
export class ChartLoaderService {
    /**
     * Get the Chart.js module, loading it if necessary.
     * This method is idempotent - multiple calls will return the same instance.
     */
    static async getChartJs(): Promise<typeof import('chart.js')> {
        // Already loaded
        if (chartJsModule) {
            return chartJsModule
        }

        // Currently loading - wait for existing promise
        if (isLoading && loadPromise) {
            return loadPromise
        }

        // Start loading
        isLoading = true
        loadPromise = this.loadAndRegister()

        try {
            chartJsModule = await loadPromise
            return chartJsModule
        } finally {
            isLoading = false
        }
    }

    /**
     * Load Chart.js and register all components
     */
    private static async loadAndRegister(): Promise<typeof import('chart.js')> {
        log('Loading Chart.js...', 'debug')
        const startTime = performance.now()

        const module = await import('chart.js')

        // Import and register annotation plugin
        const annotationPlugin = await import('chartjs-plugin-annotation')

        // Register all components once, including annotation plugin
        module.Chart.register(...module.registerables, annotationPlugin.default)

        const loadTime = performance.now() - startTime
        log(`Chart.js loaded and registered in ${loadTime.toFixed(1)}ms`, 'debug')

        return module
    }

    /**
     * Check if Chart.js is already loaded
     */
    static isLoaded(): boolean {
        return chartJsModule !== null
    }

    /**
     * Preload Chart.js in the background (non-blocking)
     */
    static preload(): void {
        if (!chartJsModule && !isLoading) {
            void this.getChartJs()
        }
    }
}
