/**
 * Visualization type for rendering data
 */
export enum VisualizationType {
    Heatmap = 'heatmap',
    LineChart = 'line-chart',
    BarChart = 'bar-chart',
    AreaChart = 'area-chart',
    PieChart = 'pie-chart',
    DoughnutChart = 'doughnut-chart',
    RadarChart = 'radar-chart',
    PolarAreaChart = 'polar-area-chart',
    ScatterChart = 'scatter-chart',
    BubbleChart = 'bubble-chart',
    TagCloud = 'tag-cloud',
    /** Circular progress toward a goal target (issue #126) */
    Progress = 'progress',
    Timeline = 'timeline',
    /** Start-to-end span per period from two properties (issue #81) */
    RangeChart = 'range-chart'
}
