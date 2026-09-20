/**
 * API Fetch Client for GeoSpatial Site Readiness Backend
 */
const API = {
    async getPresetProfiles() {
        const res = await fetch('/api/preset-profiles');
        return await res.json();
    },

    async getLayers() {
        const res = await fetch('/api/layers');
        return await res.json();
    },

    async getSummaryStats(presetKey = 'ev_charging') {
        const res = await fetch(`/api/summary-stats?preset_key=${presetKey}`);
        return await res.json();
    },

    async scorePoint(lat, lon, presetKey, customWeights = null, hardConstraints = true, decayType = null) {
        const res = await fetch('/api/score-point', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: lat,
                longitude: lon,
                preset_key: presetKey,
                custom_weights: customWeights,
                hard_constraints: hardConstraints,
                decay_type: decayType
            })
        });
        return await res.json();
    },

    async getH3Grid(resolution = 8, presetKey = 'ev_charging', includeGiStar = true, decayType = null, hardConstraints = true) {
        const res = await fetch('/api/h3-grid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resolution: resolution,
                preset_key: presetKey,
                include_gi_star: includeGiStar,
                decay_type: decayType,
                hard_constraints: hardConstraints
            })
        });
        return await res.json();
    },

    async getIsochrone(lat, lon, mode = 'drive', timeMinutes = [10, 20, 30]) {
        const res = await fetch('/api/isochrone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: lat,
                longitude: lon,
                mode: mode,
                time_minutes: timeMinutes
            })
        });
        return await res.json();
    },

    async routeToHub(lat, lon, hubType = 'highway') {
        const res = await fetch('/api/route-to-hub', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: lat,
                longitude: lon,
                hub_type: hubType
            })
        });
        return await res.json();
    },

    async compareSites(sites, presetKey = 'ev_charging', decayType = null, hardConstraints = true) {
        const res = await fetch('/api/compare-sites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sites: sites,
                preset_key: presetKey,
                decay_type: decayType,
                hard_constraints: hardConstraints
            })
        });
        return await res.json();
    },

    async runDBSCAN(epsKm = 1.5, minSamples = 2) {
        const res = await fetch(`/api/dbscan-clusters?eps_km=${epsKm}&min_samples=${minSamples}`, {
            method: 'POST'
        });
        return await res.json();
    },

    async polygonSearch(coords, presetKey = 'ev_charging', customWeights = null, decayType = null, hardConstraints = true) {
        const res = await fetch('/api/polygon-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                coordinates: coords,
                preset_key: presetKey,
                custom_weights: customWeights,
                decay_type: decayType,
                hard_constraints: hardConstraints
            })
        });
        return await res.json();
    },

    async aiQuery(queryText, presetKey = 'ev_charging', topN = 5) {
        const res = await fetch('/api/ai-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query_text: queryText,
                preset_key: presetKey,
                top_n: topN
            })
        });
        return await res.json();
    },

    async uploadLayer(layerName, file) {
        const formData = new FormData();
        formData.append('layer_name', layerName);
        formData.append('file', file);

        const res = await fetch('/api/upload-layer', {
            method: 'POST',
            body: formData
        });
        return await res.json();
    },

    async downloadPDF(lat, lon, presetKey, customWeights = null, hardConstraints = true, decayType = null) {
        const res = await fetch('/api/export-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: lat,
                longitude: lon,
                preset_key: presetKey,
                custom_weights: customWeights,
                hard_constraints: hardConstraints,
                decay_type: decayType
            })
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Site_Readiness_Report_${presetKey}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
};
