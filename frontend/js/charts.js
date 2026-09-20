/**
 * Chart.js Radar & Comparison Visualizations Module
 */
let radarChartInstance = null;
let comparisonRadarInstance = null;

const FACTOR_LABELS = [
    'Demographics',
    'Transportation',
    'Anchor Pull',
    'Market Saturation',
    'Zoning Suitability'
];

function extractFactorValues(subScores) {
    return [
        subScores.demographics || 0,
        subScores.transportation || 0,
        subScores.anchor_attraction || 0,
        subScores.competitor_penalty || 0,
        subScores.zoning_suitability || 0
    ];
}

function renderRadarChart(canvasId, subScores) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dataValues = extractFactorValues(subScores);

    if (radarChartInstance) {
        radarChartInstance.destroy();
    }

    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: FACTOR_LABELS,
            datasets: [{
                label: 'Sub-Factor Score',
                data: dataValues,
                backgroundColor: 'rgba(59, 130, 246, 0.3)',
                borderColor: '#3B82F6',
                borderWidth: 2.5,
                pointBackgroundColor: '#60A5FA',
                pointBorderColor: '#FFFFFF',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600 },
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.12)' },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: {
                        color: '#94A3B8',
                        font: { size: 10, weight: '600', family: 'Inter' }
                    },
                    ticks: {
                        display: false,
                        beginAtZero: true,
                        max: 100,
                        stepSize: 20
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#93C5FD',
                    bodyColor: '#FFFFFF',
                    borderColor: 'rgba(59, 130, 246, 0.4)',
                    borderWidth: 1,
                    padding: 8,
                    callbacks: {
                        label: (ctx) => `Score: ${ctx.raw.toFixed(1)} / 100`
                    }
                }
            }
        }
    });
}

function renderComparisonRadarChart(canvasId, comparedSites) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (comparisonRadarInstance) {
        comparisonRadarInstance.destroy();
    }

    const palette = [
        { border: '#3B82F6', bg: 'rgba(59, 130, 246, 0.2)' }, // Blue
        { border: '#10B981', bg: 'rgba(16, 185, 129, 0.2)' }, // Emerald
        { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.2)' }, // Amber
        { border: '#EC4899', bg: 'rgba(236, 72, 153, 0.2)' }  // Pink
    ];

    const datasets = comparedSites.map((site, idx) => {
        const color = palette[idx % palette.length];
        return {
            label: site.name || `Site ${idx + 1}`,
            data: extractFactorValues(site.sub_scores || {}),
            backgroundColor: color.bg,
            borderColor: color.border,
            borderWidth: 2,
            pointBackgroundColor: color.border,
            pointBorderColor: '#FFFFFF',
            pointRadius: 3.5,
            pointHoverRadius: 6
        };
    });

    comparisonRadarInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: FACTOR_LABELS,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.12)' },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: {
                        color: '#94A3B8',
                        font: { size: 10, weight: '600' }
                    },
                    ticks: {
                        display: false,
                        beginAtZero: true,
                        max: 100
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#E2E8F0',
                        boxWidth: 12,
                        font: { size: 11, weight: '500' }
                    }
                }
            }
        }
    });
}
