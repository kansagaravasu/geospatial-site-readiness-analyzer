/**
 * Main Web Application Logic for GeoSpatial Site Readiness Analyzer
 */
let map = null;
let baseTileLayers = {};
let currentBaseMap = 'streets';

let mapLayers = {};
let h3HexLayerGroup = null;
let isochroneLayerGroup = null;
let routeLayerGroup = null;
let activeInspectorMarker = null;
let activePolygonDrawLayer = null;

let currentPresetKey = 'ev_charging';
let currentIsochroneMode = 'drive';
let selectedCoordinate = { lat: 22.5, lon: 78.9 }; // India center (no default site)
let currentInspectedSite = null;
let presetsData = {};
let currentH3GeoJSON = null;
let pinnedSites = [];

/** Indian Major Metro Cities Quick Jump */
const INDIAN_CITIES = {
    bengaluru: { name: 'Bengaluru (Tech Capital)', center: [12.9716, 77.5946], zoom: 12 },
    mumbai: { name: 'Mumbai (Financial Hub)', center: [19.0760, 72.8777], zoom: 12 },
    delhi: { name: 'Delhi-NCR (National Capital)', center: [28.6139, 77.2090], zoom: 12 },
    hyderabad: { name: 'Hyderabad (Cyberabad)', center: [17.3850, 78.4867], zoom: 12 },
    pune: { name: 'Pune (Automotive & IT)', center: [18.5204, 73.8567], zoom: 12 },
    chennai: { name: 'Chennai (Auto & Tech)', center: [13.0827, 80.2707], zoom: 12 }
};

function jumpToCity(cityKey) {
    const city = INDIAN_CITIES[cityKey] || INDIAN_CITIES['bengaluru'];
    map.flyTo(city.center, city.zoom, { duration: 1.2 });
    selectedCoordinate = { lat: city.center[0], lon: city.center[1] };
    const coordsEl = document.getElementById('cursorCoords');
    if (coordsEl) {
        coordsEl.innerText = `${city.center[0].toFixed(3)}° N, ${city.center[1].toFixed(3)}° E`;
    }
}

/** India State Data — comprehensive data for all major states */
const INDIA_STATE_DATA = {
    'Andhra Pradesh':      { region: 'South India', pop: '49.6M', gdp: '9.7', area: '162975', urban: '29%', tags: ['Amaravati Capital','Pharma Hub','EV Manufacturing','Sea Ports'], ev_score: 72, retail_score: 68, logistics_score: 78, solar_score: 85, telecom_score: 65 },
    'Arunachal Pradesh':   { region: 'Northeast India', pop: '1.4M', gdp: '0.3', area: '83743', urban: '23%', tags: ['Himalayan State','Hydro Power','Border State','Tourism'], ev_score: 28, retail_score: 22, logistics_score: 30, solar_score: 40, telecom_score: 35 },
    'Assam':               { region: 'Northeast India', pop: '31.2M', gdp: '1.6', area: '78438', urban: '14%', tags: ['Tea Gardens','Oil Fields','Brahmaputra River','NE Gateway'], ev_score: 42, retail_score: 45, logistics_score: 55, solar_score: 38, telecom_score: 50 },
    'Bihar':               { region: 'East India', pop: '104.1M', gdp: '4.4', area: '94163', urban: '11%', tags: ['Most Populous','Agriculture','Patna Capital','Ganga Plains'], ev_score: 35, retail_score: 55, logistics_score: 48, solar_score: 60, telecom_score: 45 },
    'Chhattisgarh':        { region: 'Central India', pop: '25.5M', gdp: '3.4', area: '135192', urban: '24%', tags: ['Steel Capital','Rice Bowl','Forest Cover','Tribal Culture'], ev_score: 45, retail_score: 42, logistics_score: 58, solar_score: 70, telecom_score: 48 },
    'Goa':                 { region: 'West India', pop: '1.5M', gdp: '0.8', area: '3702', urban: '62%', tags: ['Tourism Hub','Beach Economy','Smallest State','Port City'], ev_score: 68, retail_score: 75, logistics_score: 55, solar_score: 72, telecom_score: 80 },
    'Gujarat':             { region: 'West India', pop: '60.4M', gdp: '16.5', area: '196024', urban: '43%', tags: ['Industrial Leader','EV Hub','GIFT City','Longest Coast'], ev_score: 88, retail_score: 78, logistics_score: 90, solar_score: 92, telecom_score: 82 },
    'Haryana':             { region: 'North India', pop: '25.3M', gdp: '6.8', area: '44212', urban: '35%', tags: ['Auto Industry','NCR Region','Green Revolution','Gurugram IT'], ev_score: 82, retail_score: 80, logistics_score: 85, solar_score: 75, telecom_score: 88 },
    'Himachal Pradesh':    { region: 'North India', pop: '6.9M', gdp: '1.6', area: '55673', urban: '10%', tags: ['Himalayan State','Apple Economy','Hydro Power','Tourism'], ev_score: 40, retail_score: 38, logistics_score: 35, solar_score: 55, telecom_score: 52 },
    'Jharkhand':           { region: 'East India', pop: '32.9M', gdp: '3.2', area: '79716', urban: '24%', tags: ['Mineral Rich','Steel Plants','Tribal Belt','Coal Fields'], ev_score: 38, retail_score: 40, logistics_score: 52, solar_score: 65, telecom_score: 42 },
    'Karnataka':           { region: 'South India', pop: '61.1M', gdp: '17.0', area: '191791', urban: '39%', tags: ['IT Capital','Startup Hub','EV Bengaluru','Aerospace'], ev_score: 90, retail_score: 88, logistics_score: 85, solar_score: 80, telecom_score: 92 },
    'Kerala':              { region: 'South India', pop: '33.4M', gdp: '8.4', area: '38852', urban: '48%', tags: ['100% Literacy','Tourism','Sea Ports','NRI Economy'], ev_score: 75, retail_score: 82, logistics_score: 68, solar_score: 65, telecom_score: 85 },
    'Madhya Pradesh':      { region: 'Central India', pop: '72.6M', gdp: '9.2', area: '308252', urban: '28%', tags: ['Heart of India','Largest State','Agriculture','Tiger Reserves'], ev_score: 52, retail_score: 55, logistics_score: 62, solar_score: 78, telecom_score: 55 },
    'Maharashtra':         { region: 'West India', pop: '112.4M', gdp: '27.9', area: '307713', urban: '45%', tags: ['Financial Capital','Mumbai Metro','EV Policy','Auto Hub'], ev_score: 88, retail_score: 92, logistics_score: 90, solar_score: 82, telecom_score: 90 },
    'Manipur':             { region: 'Northeast India', pop: '2.9M', gdp: '0.3', area: '22327', urban: '30%', tags: ['Northeast Gate','Imphal Valley','Border State','Sports Hub'], ev_score: 30, retail_score: 28, logistics_score: 35, solar_score: 42, telecom_score: 40 },
    'Meghalaya':           { region: 'Northeast India', pop: '3.0M', gdp: '0.3', area: '22429', urban: '20%', tags: ['Wettest Place','Cherrapunji','Scotland of East','Tourism'], ev_score: 32, retail_score: 30, logistics_score: 35, solar_score: 30, telecom_score: 38 },
    'Mizoram':             { region: 'Northeast India', pop: '1.1M', gdp: '0.2', area: '21081', urban: '52%', tags: ['Hill State','Literacy 92%','Myanmar Border','Bamboo Economy'], ev_score: 28, retail_score: 32, logistics_score: 28, solar_score: 35, telecom_score: 42 },
    'Nagaland':            { region: 'Northeast India', pop: '2.0M', gdp: '0.2', area: '16579', urban: '29%', tags: ['Tribal Culture','Hornbill Festival','Myanmar Border','Organic State'], ev_score: 25, retail_score: 25, logistics_score: 28, solar_score: 38, telecom_score: 35 },
    'Odisha':              { region: 'East India', pop: '41.9M', gdp: '6.0', area: '155707', urban: '17%', tags: ['Mineral Rich','Steel Hub','IT Bhubaneswar','Tribal Heritage'], ev_score: 58, retail_score: 52, logistics_score: 65, solar_score: 72, telecom_score: 55 },
    'Punjab':              { region: 'North India', pop: '27.7M', gdp: '5.8', area: '50362', urban: '37%', tags: ['Green Revolution','Agriculture','Ludhiana Industry','Amritsar Tourism'], ev_score: 70, retail_score: 72, logistics_score: 78, solar_score: 68, telecom_score: 72 },
    'Rajasthan':           { region: 'North India', pop: '68.5M', gdp: '9.0', area: '342239', urban: '25%', tags: ['Solar Capital','Largest State','Tourism','Desert Ecology'], ev_score: 62, retail_score: 58, logistics_score: 70, solar_score: 95, telecom_score: 60 },
    'Sikkim':              { region: 'Northeast India', pop: '0.6M', gdp: '0.3', area: '7096', urban: '25%', tags: ['Organic State','Himalayan','Smallest NE State','Hydro Power'], ev_score: 30, retail_score: 28, logistics_score: 25, solar_score: 45, telecom_score: 40 },
    'Tamil Nadu':          { region: 'South India', pop: '72.1M', gdp: '18.5', area: '130058', urban: '48%', tags: ['Auto Hub','IT Chennai','EV Manufacturing','Ports'], ev_score: 85, retail_score: 85, logistics_score: 88, solar_score: 88, telecom_score: 85 },
    'Telangana':           { region: 'South India', pop: '35.0M', gdp: '9.7', area: '112077', urban: '39%', tags: ['Pharma Hub','IT Hyderabad','Aerospace','Data Centers'], ev_score: 82, retail_score: 80, logistics_score: 78, solar_score: 82, telecom_score: 88 },
    'Tripura':             { region: 'Northeast India', pop: '3.7M', gdp: '0.5', area: '10486', urban: '26%', tags: ['Bamboo State','NE Connectivity','Bangladesh Border','Rubber'], ev_score: 32, retail_score: 35, logistics_score: 40, solar_score: 38, telecom_score: 42 },
    'Uttar Pradesh':       { region: 'North India', pop: '199.8M', gdp: '17.0', area: '240928', urban: '22%', tags: ['Most Populous','Expressways','EV Policy','Religious Tourism'], ev_score: 60, retail_score: 72, logistics_score: 75, solar_score: 70, telecom_score: 65 },
    'Uttarakhand':         { region: 'North India', pop: '10.1M', gdp: '2.3', area: '53483', urban: '31%', tags: ['Devbhoomi','Hydro Power','Pharma Haridwar','Tourism'], ev_score: 50, retail_score: 48, logistics_score: 45, solar_score: 55, telecom_score: 58 },
    'West Bengal':         { region: 'East India', pop: '91.3M', gdp: '11.9', area: '88752', urban: '32%', tags: ['Cultural Capital','Kolkata Port','IT Hub','Jute Industry'], ev_score: 65, retail_score: 75, logistics_score: 72, solar_score: 60, telecom_score: 70 },
    'Delhi':               { region: 'National Capital Territory', pop: '16.8M', gdp: '7.8', area: '1484', urban: '98%', tags: ['Capital City','Metro Hub','EV Leader','Air Quality Concern'], ev_score: 88, retail_score: 95, logistics_score: 82, solar_score: 60, telecom_score: 95 },
    'Jammu & Kashmir':     { region: 'Union Territory', pop: '12.5M', gdp: '1.6', area: '42241', urban: '27%', tags: ['Tourism Paradise','Apple Economy','LoC Region','Solar Potential'], ev_score: 38, retail_score: 40, logistics_score: 35, solar_score: 58, telecom_score: 45 },
    'Ladakh':              { region: 'Union Territory', pop: '0.3M', gdp: '0.1', area: '59146', urban: '28%', tags: ['Highest UT','Solar Potential','Tourism','Strategic Border'], ev_score: 25, retail_score: 20, logistics_score: 20, solar_score: 88, telecom_score: 30 },
    'Chandigarh':          { region: 'Union Territory', pop: '1.1M', gdp: '0.4', area: '114', urban: '97%', tags: ['Smart City','Planned City','Le Corbusier','Punjab Capital'], ev_score: 82, retail_score: 88, logistics_score: 70, solar_score: 65, telecom_score: 90 },
    'Puducherry':          { region: 'Union Territory', pop: '1.2M', gdp: '0.3', area: '479', urban: '68%', tags: ['French Heritage','Tourism','Chemical Industry','Sea Port'], ev_score: 62, retail_score: 72, logistics_score: 58, solar_score: 68, telecom_score: 70 },
};

/** State bounding boxes for coordinate-to-state lookup [minLat, maxLat, minLon, maxLon] */
const INDIA_STATE_BOUNDS = {
    'Andaman & Nicobar':   [6.7, 13.7, 92.2, 93.9],
    'Andhra Pradesh':      [12.6, 19.9, 76.8, 84.8],
    'Arunachal Pradesh':   [26.6, 29.5, 91.5, 97.4],
    'Assam':               [24.1, 27.9, 89.7, 96.0],
    'Bihar':               [24.3, 27.5, 83.3, 88.3],
    'Chandigarh':          [30.6, 30.8, 76.7, 76.9],
    'Chhattisgarh':        [17.8, 24.1, 80.3, 84.4],
    'Delhi':               [28.4, 28.9, 76.8, 77.4],
    'Goa':                 [14.9, 15.8, 73.9, 74.4],
    'Gujarat':             [20.1, 24.7, 68.2, 74.5],
    'Haryana':             [27.7, 30.9, 74.5, 77.6],
    'Himachal Pradesh':    [30.4, 33.2, 75.6, 79.0],
    'Jammu & Kashmir':     [32.3, 36.9, 73.9, 80.4],
    'Jharkhand':           [21.9, 25.3, 83.3, 87.9],
    'Karnataka':           [11.6, 18.5, 74.1, 78.6],
    'Kerala':              [8.1, 12.8, 74.9, 77.4],
    'Ladakh':              [32.0, 36.0, 75.0, 80.5],
    'Lakshadweep':         [8.0, 12.5, 71.7, 74.1],
    'Madhya Pradesh':      [21.1, 26.9, 74.0, 82.8],
    'Maharashtra':         [15.6, 22.1, 72.6, 80.9],
    'Manipur':             [23.8, 25.7, 93.0, 94.8],
    'Meghalaya':           [25.0, 26.1, 89.8, 92.8],
    'Mizoram':             [21.9, 24.5, 92.2, 93.4],
    'Nagaland':            [25.1, 27.0, 93.3, 95.3],
    'Odisha':              [17.8, 22.6, 81.4, 87.5],
    'Puducherry':          [11.9, 12.1, 79.6, 79.9],
    'Punjab':              [29.5, 32.5, 73.9, 76.9],
    'Rajasthan':           [23.0, 30.2, 69.5, 78.3],
    'Sikkim':              [27.1, 28.1, 87.9, 88.9],
    'Tamil Nadu':          [8.1, 13.6, 77.0, 80.3],
    'Telangana':           [15.9, 19.9, 77.2, 81.8],
    'Tripura':             [22.9, 24.5, 91.2, 92.3],
    'Uttar Pradesh':       [23.9, 30.4, 77.1, 84.7],
    'Uttarakhand':         [28.7, 31.5, 77.6, 81.0],
    'West Bengal':         [21.4, 27.2, 85.8, 89.9],
};

/** Detect India state from coordinates */
function getIndiaState(lat, lon) {
    // Check India's general bounding box first
    if (lat < 6 || lat > 37 || lon < 68 || lon > 98) return null;

    // Special priority cases (smaller states/UTs first)
    if (lat >= 28.4 && lat <= 28.9 && lon >= 76.8 && lon <= 77.4) return 'Delhi';
    if (lat >= 30.6 && lat <= 30.8 && lon >= 76.7 && lon <= 76.9) return 'Chandigarh';
    if (lat >= 14.9 && lat <= 15.8 && lon >= 73.9 && lon <= 74.4) return 'Goa';

    let bestMatch = null;
    let bestArea = Infinity;

    for (const [state, [minLat, maxLat, minLon, maxLon]] of Object.entries(INDIA_STATE_BOUNDS)) {
        if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
            const area = (maxLat - minLat) * (maxLon - minLon);
            if (area < bestArea) {
                bestArea = area;
                bestMatch = state;
            }
        }
    }
    return bestMatch;
}

/** Get score for current preset */
function getStateScore(stateData) {
    const preset = currentPresetKey;
    if (preset === 'ev_charging')       return stateData.ev_score      || 50;
    if (preset === 'retail_store')      return stateData.retail_score   || 50;
    if (preset === 'warehouse_logistics') return stateData.logistics_score || 50;
    if (preset === 'solar_farm')        return stateData.solar_score    || 50;
    if (preset === 'telecom_tower')     return stateData.telecom_score  || 50;
    return stateData.ev_score || 50;
}

/** Render the left Readiness panel */
function renderReadinessPanel(scoreData, lat, lon) {
    // Switch to the readiness tab
    switchTab('readiness');

    // Hide prompt, show results
    document.getElementById('readiness-prompt').style.display = 'none';
    document.getElementById('readiness-result').style.display = 'block';

    const sm = scoreData.spatial_metrics || {};
    const pp = scoreData.place_profile || {};
    const isWater = pp.is_water_body || sm.population_density_sqkm === 0 || sm.state === 'Territorial Waters';

    const stateName = sm.state || getIndiaState(lat, lon);
    const stateData = (!isWater && stateName) ? (INDIA_STATE_DATA[stateName] || null) : null;
    const placeName = sm.place_name || pp.place_name || `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`;
    const region = sm.region || (stateData ? stateData.region : (isWater ? 'Maritime Zone' : 'India'));
    let stateScore = null;

    document.getElementById('stateName').textContent = placeName;
    document.getElementById('stateRegion').textContent = region;

    if (isWater) {
        document.getElementById('statePop').textContent   = '0 /km² (Water Area)';
        document.getElementById('stateGDP').textContent   = '₹0 (Maritime Surface)';
        document.getElementById('stateArea').textContent  = 'Marine / Aquatic';
        document.getElementById('stateUrban').textContent = 'Non-Habitable Aquatic';

        const scoreBadgeEl = document.getElementById('stateScoreBadge');
        scoreBadgeEl.textContent = '0/100';
        scoreBadgeEl.style.color = '#F43F5E';
        scoreBadgeEl.style.borderColor = 'rgba(244,63,94,0.35)';
        scoreBadgeEl.style.background  = 'rgba(244,63,94,0.1)';

        document.getElementById('stateTags').innerHTML = `
            <span class="state-tag" style="color:#38BDF8; border-color:rgba(56,189,248,0.3);">🌊 Water Body</span>
            <span class="state-tag" style="color:#F43F5E; border-color:rgba(244,63,94,0.3);">Non-Buildable</span>
            <span class="state-tag">0 Pop Density</span>
        `;
    } else {
        document.getElementById('statePop').textContent   = stateData ? stateData.pop : (sm.population_density_sqkm ? `${sm.population_density_sqkm.toLocaleString()} /km²` : 'N/A');
        document.getElementById('stateGDP').textContent   = stateData ? '₹' + stateData.gdp : (stateName || 'N/A');
        document.getElementById('stateArea').textContent  = stateData ? Number(stateData.area).toLocaleString() : (pp.distance_to_nearest_city_km ? `${pp.distance_to_nearest_city_km.toFixed(0)} km from ${pp.nearest_city_name || 'city'}` : 'N/A');
        document.getElementById('stateUrban').textContent = stateData ? stateData.urban : (pp.urban_classification || 'N/A');

        stateScore = stateData ? getStateScore(stateData) : null;
        const scoreBadgeEl = document.getElementById('stateScoreBadge');
        if (stateScore !== null) {
            scoreBadgeEl.textContent = `${stateScore}/100`;
            scoreBadgeEl.style.color = stateScore >= 75 ? '#34D399' : (stateScore >= 50 ? '#F59E0B' : '#F43F5E');
            scoreBadgeEl.style.borderColor = stateScore >= 75 ? 'rgba(52,211,153,0.35)' : (stateScore >= 50 ? 'rgba(245,158,11,0.35)' : 'rgba(244,63,94,0.35)');
            scoreBadgeEl.style.background  = stateScore >= 75 ? 'rgba(52,211,153,0.1)' : (stateScore >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(244,63,94,0.1)');
        } else {
            scoreBadgeEl.textContent = 'N/A';
        }

        const tagsEl = document.getElementById('stateTags');
        let tags = stateData?.tags || [];
        if (!tags.length && pp.locality_type) {
            tags = [pp.locality_type.split('(')[0].trim()];
        }
        if (pp.urban_classification && !stateData) tags.push(pp.urban_classification);
        tagsEl.innerHTML = tags.map(t => `<span class="state-tag">${t}</span>`).join('');
    }


    // --- Site Score Strip ---
    const score = scoreData.site_readiness_score || 0;
    const scoreEl = document.getElementById('lsScore');
    scoreEl.textContent = `${score.toFixed(1)} / 100`;
    scoreEl.style.color = score >= 75 ? '#34D399' : (score >= 50 ? '#F59E0B' : '#F43F5E');
    document.getElementById('lsVerdict').textContent = scoreData.ai_explanation?.verdict || 'Evaluated';

    // --- Explanation ---
    document.getElementById('lsExplanation').textContent = scoreData.ai_explanation?.summary || 'Site evaluation complete.';

    // --- Factor Bars ---
    const sub = scoreData.sub_scores || {};
    const factorConfig = [
        { key: 'demographics',       name: 'Population Density Fit',     weight: 'w×0.20', color: '#C084FC', rawFn: s => s ? `Raw: ~${Math.round(s * 150)} people/sq.mi` : '' },
        { key: 'transportation',      name: 'Highway Accessibility',       weight: 'w×0.30', color: '#60A5FA', rawFn: s => s ? `Raw: ${(100 - s) * 65}m to highway` : '' },
        { key: 'anchor_attraction',   name: 'Anchor Tenant Pull',          weight: 'w×0.20', color: '#FCD34D', rawFn: s => s ? `Nearest anchor: ${(100 - s) * 30}m away` : '' },
        { key: 'competitor_penalty',  name: 'Market Low Saturation',       weight: 'w×0.15', color: '#FB7185', rawFn: s => s ? `Competitor density score: ${s.toFixed(0)}/100` : '' },
        { key: 'zoning_suitability',  name: 'Zoning Suitability',          weight: 'w×0.10', color: '#34D399', rawFn: s => s ? `Zoning compliance: ${s > 50 ? 'Commercial / Industrial' : 'Residential / Restricted'}` : '' },
    ];

    // Add state-level factors if available
    if (stateData) {
        factorConfig.push(
            { key: '_state_infra',  name: 'State Infrastructure',  weight: 'w×0.05', color: '#22D3EE', rawFn: () => `${stateName} — ${stateData.region}`, _val: stateScore * 0.8 },
            { key: '_state_policy', name: 'State Policy Support',  weight: 'w×0.05', color: '#A78BFA', rawFn: () => stateData.tags.slice(0,2).join(', '), _val: stateScore * 0.9 }
        );
    }

    document.getElementById('fcCount').textContent = factorConfig.length;

    const barsEl = document.getElementById('factorBarsLeft');
    barsEl.innerHTML = factorConfig.map(fc => {
        const val = fc._val !== undefined ? fc._val : (sub[fc.key] || 0);
        const pts = (val / 100 * 10).toFixed(1);
        const ptsNum = parseFloat(pts);
        const ptsClass = ptsNum >= 5 ? 'positive' : (ptsNum >= 2 ? 'neutral' : 'negative');
        const ptsSign  = ptsNum >= 0 ? '+' : '';

        return `
        <div class="fc-factor-item">
            <div class="fc-factor-row">
                <div class="fc-factor-left">
                    <span class="fc-factor-name" style="color:${fc.color}">${fc.name}</span>
                    <span class="fc-factor-meta">${fc.weight}</span>
                </div>
                <div class="fc-factor-right">
                    <span class="fc-factor-score">${val.toFixed(1)}/100</span>
                    <span class="fc-factor-pts ${ptsClass}">${ptsSign}${pts} pts</span>
                </div>
            </div>
            <div class="fc-bar-track">
                <div class="fc-bar-fill" style="width:${val}%; background:${fc.color};"></div>
            </div>
            <div class="fc-factor-raw">${fc.rawFn(val)}</div>
        </div>`;
    }).join('');
}

/**
 * INDIA PLACES DATABASE — 800+ cities, districts, towns, industrial areas, highways
 * Each entry: { name, sub (state/district), lat, lon, type, icon, badge }
 */
const INDIA_PLACES_DB = [
    // ── METRO CITIES ──
    { name:'Mumbai – BKC Commercial Hub',      sub:'Maharashtra',         lat:19.0662, lon:72.8683, type:'metro',    icon:'🏙️', badge:'Metro' },
    { name:'Mumbai – Andheri West',            sub:'Maharashtra',         lat:19.1136, lon:72.8697, type:'metro',    icon:'🏙️', badge:'Metro' },
    { name:'Mumbai – Lower Parel',             sub:'Maharashtra',         lat:18.9982, lon:72.8313, type:'metro',    icon:'🏙️', badge:'Metro' },
    { name:'Mumbai – Thane',                   sub:'Maharashtra',         lat:19.2183, lon:72.9781, type:'metro',    icon:'🏙️', badge:'Metro' },
    { name:'Mumbai – Navi Mumbai',             sub:'Maharashtra',         lat:19.0330, lon:73.0297, type:'metro',    icon:'🏙️', badge:'Metro' },
    { name:'Mumbai – Powai',                   sub:'Maharashtra',         lat:19.1176, lon:72.9060, type:'metro',    icon:'💻', badge:'IT Hub' },
    { name:'Mumbai – Airoli',                  sub:'Maharashtra',         lat:19.1609, lon:72.9994, type:'metro',    icon:'🏗️', badge:'Industrial' },
    { name:'Delhi – Connaught Place',          sub:'National Capital Territory', lat:28.6315, lon:77.2167, type:'metro', icon:'🏛️', badge:'Metro' },
    { name:'Delhi – Saket District Centre',    sub:'National Capital Territory', lat:28.5244, lon:77.2167, type:'metro', icon:'🛍️', badge:'Retail' },
    { name:'Delhi – Dwarka',                   sub:'National Capital Territory', lat:28.5921, lon:77.0460, type:'metro', icon:'🏘️', badge:'Suburb' },
    { name:'Delhi – Rohini',                   sub:'National Capital Territory', lat:28.7495, lon:77.0536, type:'metro', icon:'🏘️', badge:'Suburb' },
    { name:'Delhi – Lajpat Nagar',             sub:'National Capital Territory', lat:28.5672, lon:77.2432, type:'metro', icon:'🛍️', badge:'Retail' },
    { name:'Delhi – Nehru Place IT Hub',       sub:'National Capital Territory', lat:28.5490, lon:77.2516, type:'metro', icon:'💻', badge:'IT Hub' },
    { name:'Delhi – Okhla Industrial Area',    sub:'National Capital Territory', lat:28.5355, lon:77.2726, type:'metro', icon:'🏭', badge:'Industrial' },
    { name:'Bengaluru – Koramangala',          sub:'Karnataka',           lat:12.9352, lon:77.6245, type:'metro',    icon:'💻', badge:'Startup' },
    { name:'Bengaluru – Electronic City',      sub:'Karnataka',           lat:12.8399, lon:77.6770, type:'metro',    icon:'💻', badge:'IT Hub' },
    { name:'Bengaluru – Whitefield',           sub:'Karnataka',           lat:12.9698, lon:77.7499, type:'metro',    icon:'💻', badge:'IT Hub' },
    { name:'Bengaluru – Sarjapur Road',        sub:'Karnataka',           lat:12.9076, lon:77.6893, type:'metro',    icon:'🏗️', badge:'Growth' },
    { name:'Bengaluru – MG Road',              sub:'Karnataka',           lat:12.9756, lon:77.6099, type:'metro',    icon:'🛍️', badge:'CBD' },
    { name:'Bengaluru – Hebbal',               sub:'Karnataka',           lat:13.0358, lon:77.5970, type:'metro',    icon:'🏗️', badge:'Growth' },
    { name:'Bengaluru – Yelahanka',            sub:'Karnataka',           lat:13.1004, lon:77.5963, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Bengaluru – HSR Layout',           sub:'Karnataka',           lat:12.9116, lon:77.6473, type:'metro',    icon:'💻', badge:'Tech' },
    { name:'Hyderabad – HITEC City',           sub:'Telangana',           lat:17.4435, lon:78.3772, type:'metro',    icon:'💻', badge:'IT Hub' },
    { name:'Hyderabad – Gachibowli',           sub:'Telangana',           lat:17.4401, lon:78.3489, type:'metro',    icon:'💻', badge:'IT Hub' },
    { name:'Hyderabad – Banjara Hills',        sub:'Telangana',           lat:17.4156, lon:78.4347, type:'metro',    icon:'🛍️', badge:'Upscale' },
    { name:'Hyderabad – Secunderabad',         sub:'Telangana',           lat:17.4400, lon:78.4983, type:'metro',    icon:'🏛️', badge:'CBD' },
    { name:'Hyderabad – Kukatpally',           sub:'Telangana',           lat:17.4849, lon:78.3988, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Hyderabad – Uppal',                sub:'Telangana',           lat:17.4056, lon:78.5586, type:'metro',    icon:'🏗️', badge:'Industrial' },
    { name:'Hyderabad – LB Nagar',             sub:'Telangana',           lat:17.3487, lon:78.5494, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Chennai – Anna Nagar',             sub:'Tamil Nadu',          lat:13.0850, lon:80.2101, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Chennai – OMR IT Corridor',        sub:'Tamil Nadu',          lat:12.9010, lon:80.2279, type:'metro',    icon:'💻', badge:'IT Hub' },
    { name:'Chennai – Porur',                  sub:'Tamil Nadu',          lat:13.0326, lon:80.1565, type:'metro',    icon:'🏗️', badge:'Industrial' },
    { name:'Chennai – Ambattur Industrial',    sub:'Tamil Nadu',          lat:13.1143, lon:80.1548, type:'metro',    icon:'🏭', badge:'Industrial' },
    { name:'Chennai – Guindy',                 sub:'Tamil Nadu',          lat:13.0067, lon:80.2206, type:'metro',    icon:'🏭', badge:'Industrial' },
    { name:'Chennai – Sholinganallur',         sub:'Tamil Nadu',          lat:12.9010, lon:80.2279, type:'metro',    icon:'💻', badge:'IT Hub' },
    { name:'Kolkata – Salt Lake Sector V',     sub:'West Bengal',         lat:22.5697, lon:88.4327, type:'metro',    icon:'💻', badge:'IT Hub' },
    { name:'Kolkata – Park Street',            sub:'West Bengal',         lat:22.5533, lon:88.3536, type:'metro',    icon:'🛍️', badge:'CBD' },
    { name:'Kolkata – Newtown Rajarhat',       sub:'West Bengal',         lat:22.5849, lon:88.4897, type:'metro',    icon:'🏗️', badge:'Growth' },
    { name:'Kolkata – Howrah',                 sub:'West Bengal',         lat:22.5958, lon:88.2636, type:'metro',    icon:'🏭', badge:'Industrial' },
    { name:'Pune – Hinjewadi IT Park',         sub:'Maharashtra',         lat:18.5913, lon:73.7389, type:'metro',    icon:'💻', badge:'IT Hub' },
    { name:'Pune – Viman Nagar',               sub:'Maharashtra',         lat:18.5679, lon:73.9143, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Pune – Baner',                     sub:'Maharashtra',         lat:18.5590, lon:73.7868, type:'metro',    icon:'💻', badge:'Tech' },
    { name:'Pune – Kothrud',                   sub:'Maharashtra',         lat:18.5043, lon:73.8080, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Pune – Wakad',                     sub:'Maharashtra',         lat:18.5989, lon:73.7614, type:'metro',    icon:'🏗️', badge:'Growth' },
    { name:'Pune – Hadapsar',                  sub:'Maharashtra',         lat:18.5018, lon:73.9325, type:'metro',    icon:'🏭', badge:'Industrial' },
    { name:'Pune – Pimpri-Chinchwad',          sub:'Maharashtra',         lat:18.6279, lon:73.7997, type:'metro',    icon:'🏭', badge:'Auto Hub' },
    // ── TIER-2 CITIES ──
    { name:'Ahmedabad – SG Highway Corridor',  sub:'Gujarat',             lat:23.0225, lon:72.5714, type:'tier2',    icon:'🏙️', badge:'Smart City' },
    { name:'Ahmedabad – GIFT City',            sub:'Gujarat',             lat:23.1622, lon:72.6841, type:'tier2',    icon:'💹', badge:'Fin Hub' },
    { name:'Ahmedabad – Naroda Industrial',    sub:'Gujarat',             lat:23.0878, lon:72.6559, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Surat – Diamond City',             sub:'Gujarat',             lat:21.1702, lon:72.8311, type:'tier2',    icon:'💎', badge:'Diamond' },
    { name:'Surat – Sachin GIDC',              sub:'Gujarat',             lat:21.0938, lon:72.8632, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Vadodara – Halol Industrial',      sub:'Gujarat',             lat:22.3072, lon:73.1812, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Rajkot',                           sub:'Gujarat',             lat:22.3039, lon:70.8022, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Jaipur – Malviya Nagar',           sub:'Rajasthan',           lat:26.8467, lon:75.7873, type:'tier2',    icon:'🏙️', badge:'Pink City' },
    { name:'Jaipur – Mansarovar',              sub:'Rajasthan',           lat:26.8584, lon:75.7575, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Jaipur – Sitapura Industrial',     sub:'Rajasthan',           lat:26.7765, lon:75.8408, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Jodhpur',                          sub:'Rajasthan',           lat:26.2389, lon:73.0243, type:'tier2',    icon:'🏯', badge:'Heritage' },
    { name:'Udaipur',                          sub:'Rajasthan',           lat:24.5854, lon:73.7125, type:'tier2',    icon:'🏯', badge:'Tourism' },
    { name:'Kota – Industrial Corridor',       sub:'Rajasthan',           lat:25.2138, lon:75.8648, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Lucknow – Gomti Nagar',            sub:'Uttar Pradesh',       lat:26.8467, lon:80.9462, type:'tier2',    icon:'🏛️', badge:'Capital' },
    { name:'Lucknow – IT City',                sub:'Uttar Pradesh',       lat:26.8924, lon:81.0125, type:'tier2',    icon:'💻', badge:'IT Hub' },
    { name:'Agra',                             sub:'Uttar Pradesh',       lat:27.1767, lon:78.0081, type:'tier2',    icon:'🕌', badge:'Tourism' },
    { name:'Varanasi',                         sub:'Uttar Pradesh',       lat:25.3176, lon:82.9739, type:'tier2',    icon:'🕌', badge:'Heritage' },
    { name:'Kanpur – Industrial',              sub:'Uttar Pradesh',       lat:26.4499, lon:80.3319, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Noida – Sector 62',                sub:'Uttar Pradesh',       lat:28.6272, lon:77.3641, type:'tier2',    icon:'💻', badge:'IT Hub' },
    { name:'Noida – Sector 18',                sub:'Uttar Pradesh',       lat:28.5706, lon:77.3272, type:'tier2',    icon:'🛍️', badge:'Retail' },
    { name:'Noida – Greater Noida',            sub:'Uttar Pradesh',       lat:28.4745, lon:77.5040, type:'tier2',    icon:'🏗️', badge:'Township' },
    { name:'Ghaziabad',                        sub:'Uttar Pradesh',       lat:28.6692, lon:77.4538, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Meerut',                           sub:'Uttar Pradesh',       lat:28.9845, lon:77.7064, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Gurugram – Cyber City',            sub:'Haryana',             lat:28.4949, lon:77.0880, type:'tier2',    icon:'💻', badge:'IT Hub' },
    { name:'Gurugram – DLF Phase 2',           sub:'Haryana',             lat:28.4854, lon:77.0893, type:'tier2',    icon:'🛍️', badge:'Upscale' },
    { name:'Gurugram – Manesar Industrial',    sub:'Haryana',             lat:28.3582, lon:76.9360, type:'tier2',    icon:'🏭', badge:'Auto Hub' },
    { name:'Faridabad – Industrial',           sub:'Haryana',             lat:28.4089, lon:77.3178, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Chandigarh – IT Park',             sub:'Chandigarh UT',       lat:30.7333, lon:76.7794, type:'tier2',    icon:'💻', badge:'Smart City' },
    { name:'Amritsar',                         sub:'Punjab',              lat:31.6340, lon:74.8723, type:'tier2',    icon:'🕌', badge:'Heritage' },
    { name:'Ludhiana – Industrial',            sub:'Punjab',              lat:30.9010, lon:75.8573, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Jalandhar',                        sub:'Punjab',              lat:31.3260, lon:75.5762, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Nagpur – MIHAN Special Economic Zone', sub:'Maharashtra',    lat:21.0775, lon:79.0716, type:'tier2',    icon:'✈️', badge:'SEZ' },
    { name:'Nagpur – Butibori Industrial',     sub:'Maharashtra',         lat:21.0015, lon:79.1263, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Aurangabad – Auto Cluster',        sub:'Maharashtra',         lat:19.8762, lon:75.3433, type:'tier2',    icon:'🏭', badge:'Auto Hub' },
    { name:'Nashik – Industrial MIDC',         sub:'Maharashtra',         lat:20.0059, lon:73.7756, type:'tier2',    icon:'🏭', badge:'Wine & Industry' },
    { name:'Coimbatore – Textile & IT',        sub:'Tamil Nadu',          lat:11.0168, lon:76.9558, type:'tier2',    icon:'🏭', badge:'Textile' },
    { name:'Madurai',                          sub:'Tamil Nadu',          lat:9.9252,  lon:78.1198, type:'tier2',    icon:'🕌', badge:'Heritage' },
    { name:'Tiruchirappalli (Trichy)',          sub:'Tamil Nadu',          lat:10.7905, lon:78.7047, type:'tier2',    icon:'🏭', badge:'Tier-2' },
    { name:'Tiruppur – Garment Hub',           sub:'Tamil Nadu',          lat:11.1085, lon:77.3411, type:'tier2',    icon:'🧵', badge:'Garments' },
    { name:'Salem',                            sub:'Tamil Nadu',          lat:11.6643, lon:78.1460, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Kochi – Smart City',               sub:'Kerala',              lat:9.9312,  lon:76.2673, type:'tier2',    icon:'🚢', badge:'Port City' },
    { name:'Kochi – Infopark Kakkanad',        sub:'Kerala',              lat:10.0209, lon:76.3513, type:'tier2',    icon:'💻', badge:'IT Hub' },
    { name:'Thiruvananthapuram – Technopark',  sub:'Kerala',              lat:8.5241,  lon:76.9366, type:'tier2',    icon:'💻', badge:'IT Hub' },
    { name:'Kozhikode (Calicut)',              sub:'Kerala',              lat:11.2588, lon:75.7804, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Bhubaneswar – IT Park',            sub:'Odisha',              lat:20.2961, lon:85.8189, type:'tier2',    icon:'💻', badge:'Smart City' },
    { name:'Cuttack',                          sub:'Odisha',              lat:20.4625, lon:85.8828, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Raipur',                           sub:'Chhattisgarh',        lat:21.2514, lon:81.6296, type:'tier2',    icon:'🏙️', badge:'Capital' },
    { name:'Indore – Pithampur Industrial',    sub:'Madhya Pradesh',      lat:22.7196, lon:75.8577, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Bhopal',                           sub:'Madhya Pradesh',      lat:23.2599, lon:77.4126, type:'tier2',    icon:'🏛️', badge:'Capital' },
    { name:'Gwalior',                          sub:'Madhya Pradesh',      lat:26.2183, lon:78.1828, type:'tier2',    icon:'🏯', badge:'Heritage' },
    { name:'Jabalpur',                         sub:'Madhya Pradesh',      lat:23.1815, lon:79.9864, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Patna',                            sub:'Bihar',               lat:25.5941, lon:85.1376, type:'tier2',    icon:'🏛️', badge:'Capital' },
    { name:'Guwahati – EPIP Industrial',       sub:'Assam',               lat:26.1445, lon:91.7362, type:'tier2',    icon:'🏭', badge:'NE Hub' },
    { name:'Shillong',                         sub:'Meghalaya',           lat:25.5788, lon:91.8933, type:'tier2',    icon:'🏞️', badge:'Hill City' },
    { name:'Imphal',                           sub:'Manipur',             lat:24.8170, lon:93.9368, type:'tier2',    icon:'🏙️', badge:'Capital' },
    { name:'Agartala',                         sub:'Tripura',             lat:23.8315, lon:91.2868, type:'tier2',    icon:'🏙️', badge:'Capital' },
    { name:'Dehradun',                         sub:'Uttarakhand',         lat:30.3165, lon:78.0322, type:'tier2',    icon:'🏔️', badge:'Hill City' },
    { name:'Haridwar – Industrial Growth Centre', sub:'Uttarakhand',     lat:29.9457, lon:78.1642, type:'tier2',    icon:'🏭', badge:'Industrial' },
    { name:'Panaji – Goa Capital',             sub:'Goa',                 lat:15.4989, lon:73.8278, type:'tier2',    icon:'🏖️', badge:'Tourism' },
    { name:'Vasco da Gama – Port',             sub:'Goa',                 lat:15.3940, lon:73.8128, type:'tier2',    icon:'🚢', badge:'Port' },
    { name:'Ranchi',                           sub:'Jharkhand',           lat:23.3441, lon:85.3096, type:'tier2',    icon:'🏛️', badge:'Capital' },
    { name:'Jamshedpur – TISCO Steel',         sub:'Jharkhand',           lat:22.8046, lon:86.2029, type:'tier2',    icon:'🏭', badge:'Steel City' },
    { name:'Dhanbad – Coal Capital',           sub:'Jharkhand',           lat:23.7957, lon:86.4304, type:'tier2',    icon:'⛏️', badge:'Coal' },
    { name:'Rourkela – Steel Plant',           sub:'Odisha',              lat:22.2604, lon:84.8536, type:'tier2',    icon:'🏭', badge:'Steel' },
    { name:'Vijayawada',                       sub:'Andhra Pradesh',      lat:16.5062, lon:80.6480, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Visakhapatnam – VIZAG Port',       sub:'Andhra Pradesh',      lat:17.6868, lon:83.2185, type:'tier2',    icon:'🚢', badge:'Port City' },
    { name:'Tirupati',                         sub:'Andhra Pradesh',      lat:13.6288, lon:79.4192, type:'tier2',    icon:'🕌', badge:'Pilgrim' },
    { name:'Kakinada – Port',                  sub:'Andhra Pradesh',      lat:16.9891, lon:82.2475, type:'tier2',    icon:'🚢', badge:'Port' },
    { name:'Guntur',                           sub:'Andhra Pradesh',      lat:16.3067, lon:80.4365, type:'tier2',    icon:'🌾', badge:'Agri Hub' },
    { name:'Mysuru (Mysore)',                  sub:'Karnataka',           lat:12.2958, lon:76.6394, type:'tier2',    icon:'🏯', badge:'Heritage' },
    { name:'Hubli-Dharwad',                    sub:'Karnataka',           lat:15.3647, lon:75.1240, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Mangaluru – Port',                 sub:'Karnataka',           lat:12.9141, lon:74.8560, type:'tier2',    icon:'🚢', badge:'Port' },
    { name:'Belagavi (Belgaum)',               sub:'Karnataka',           lat:15.8497, lon:74.4977, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Shimla',                           sub:'Himachal Pradesh',    lat:31.1048, lon:77.1734, type:'tier2',    icon:'🏔️', badge:'Hill City' },
    { name:'Srinagar',                         sub:'Jammu & Kashmir',     lat:34.0837, lon:74.7973, type:'tier2',    icon:'🏔️', badge:'Valley' },
    { name:'Jammu',                            sub:'Jammu & Kashmir',     lat:32.7266, lon:74.8570, type:'tier2',    icon:'🏛️', badge:'Winter Capital' },
    { name:'Leh – Ladakh',                     sub:'Ladakh',              lat:34.1526, lon:77.5771, type:'tier2',    icon:'🏔️', badge:'High Alt.' },
    // ── INDUSTRIAL & SEZ AREAS ──
    { name:'Pithampur – Auto Industrial',      sub:'Madhya Pradesh',      lat:22.5893, lon:75.6875, type:'industrial', icon:'🏭', badge:'Auto' },
    { name:'Hosur – Auto & Electronics Hub',   sub:'Tamil Nadu',          lat:12.7409, lon:77.8253, type:'industrial', icon:'🏭', badge:'EV Hub' },
    { name:'Sri City – SEZ',                   sub:'Andhra Pradesh',      lat:13.5511, lon:80.0298, type:'industrial', icon:'🏭', badge:'SEZ' },
    { name:'KIADB Bommasandra Industrial',     sub:'Karnataka',           lat:12.8182, lon:77.6997, type:'industrial', icon:'🏭', badge:'Industrial' },
    { name:'Chakan – Auto Cluster',            sub:'Maharashtra',         lat:18.7613, lon:73.8638, type:'industrial', icon:'🚗', badge:'Auto Hub' },
    { name:'Neemrana – Japanese Zone',         sub:'Rajasthan',           lat:27.9860, lon:76.3911, type:'industrial', icon:'🏭', badge:'Japan Zone' },
    { name:'Bawal Industrial (IMT)',           sub:'Haryana',             lat:28.0574, lon:76.5834, type:'industrial', icon:'🏭', badge:'IMT' },
    { name:'Kundli Industrial',                sub:'Haryana',             lat:28.8749, lon:77.0530, type:'industrial', icon:'🏭', badge:'Industrial' },
    { name:'Sanand – Tata/Maruti Plant',       sub:'Gujarat',             lat:22.9819, lon:72.3641, type:'industrial', icon:'🚗', badge:'Auto Hub' },
    { name:'Dahej – Chemical SEZ',             sub:'Gujarat',             lat:21.6975, lon:72.5373, type:'industrial', icon:'🧪', badge:'Chemical' },
    { name:'Hazira – LNG Terminal',            sub:'Gujarat',             lat:21.1211, lon:72.6364, type:'industrial', icon:'⛽', badge:'LNG' },
    { name:'Mundra Port SEZ',                  sub:'Gujarat',             lat:22.8392, lon:69.7220, type:'industrial', icon:'🚢', badge:'Port SEZ' },
    { name:'Kandla Port SEZ',                  sub:'Gujarat',             lat:23.0275, lon:70.2176, type:'industrial', icon:'🚢', badge:'Port' },
    { name:'Baddi Pharma Cluster',             sub:'Himachal Pradesh',    lat:30.9557, lon:76.7904, type:'industrial', icon:'💊', badge:'Pharma' },
    { name:'Hapur – Paper Mill Industrial',    sub:'Uttar Pradesh',       lat:28.7260, lon:77.7737, type:'industrial', icon:'🏭', badge:'Industrial' },
    { name:'Taloja MIDC',                      sub:'Maharashtra',         lat:19.0224, lon:73.1367, type:'industrial', icon:'🏭', badge:'MIDC' },
    { name:'Ranjangaon MIDC',                  sub:'Maharashtra',         lat:18.8060, lon:74.1556, type:'industrial', icon:'🏭', badge:'MIDC' },
    { name:'Tumkur Industrial Township',       sub:'Karnataka',           lat:13.3409, lon:77.1010, type:'industrial', icon:'🏭', badge:'Industrial' },
    { name:'Bidadi – Toyota Plant',            sub:'Karnataka',           lat:12.7980, lon:77.3896, type:'industrial', icon:'🚗', badge:'Auto' },
    { name:'Oragadam – Auto Cluster',          sub:'Tamil Nadu',          lat:12.7946, lon:80.0110, type:'industrial', icon:'🚗', badge:'Auto Hub' },
    { name:'Sriperumbudur SEZ',                sub:'Tamil Nadu',          lat:12.9724, lon:79.9557, type:'industrial', icon:'🏭', badge:'Electronics SEZ' },
    { name:'Vizag – Pharma City',              sub:'Andhra Pradesh',      lat:17.5933, lon:83.0534, type:'industrial', icon:'💊', badge:'Pharma' },
    { name:'Polepally SEZ',                    sub:'Telangana',           lat:16.7560, lon:78.1126, type:'industrial', icon:'💊', badge:'Pharma SEZ' },
    { name:'IDA Pashamylaram',                 sub:'Telangana',           lat:17.5604, lon:78.2099, type:'industrial', icon:'🏭', badge:'Industrial' },
    { name:'Kakinada SEZ',                     sub:'Andhra Pradesh',      lat:16.8966, lon:82.1924, type:'industrial', icon:'🏭', badge:'SEZ' },
    // ── STATES ──
    { name:'Andhra Pradesh',                   sub:'State Capital: Amaravati', lat:16.5062, lon:80.6480, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Arunachal Pradesh',                sub:'State Capital: Itanagar',  lat:27.0844, lon:93.6053, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Assam',                            sub:'State Capital: Dispur',    lat:26.1445, lon:91.7362, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Bihar',                            sub:'State Capital: Patna',     lat:25.5941, lon:85.1376, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Chhattisgarh',                     sub:'State Capital: Raipur',    lat:21.2514, lon:81.6296, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Goa',                              sub:'State Capital: Panaji',    lat:15.2993, lon:74.1240, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Gujarat',                          sub:'State Capital: Gandhinagar',lat:22.2587, lon:71.1924, type:'state',   icon:'🗺️', badge:'State' },
    { name:'Haryana',                          sub:'State Capital: Chandigarh', lat:29.0588, lon:76.0856, type:'state',   icon:'🗺️', badge:'State' },
    { name:'Himachal Pradesh',                 sub:'State Capital: Shimla',    lat:31.1048, lon:77.1734, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Jharkhand',                        sub:'State Capital: Ranchi',    lat:23.6102, lon:85.2799, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Karnataka',                        sub:'State Capital: Bengaluru', lat:15.3173, lon:75.7139, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Kerala',                           sub:'State Capital: Thiruvananthapuram', lat:10.8505, lon:76.2711, type:'state', icon:'🗺️', badge:'State' },
    { name:'Madhya Pradesh',                   sub:'State Capital: Bhopal',   lat:22.9734, lon:78.6569, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Maharashtra',                      sub:'State Capital: Mumbai',   lat:19.7515, lon:75.7139, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Manipur',                          sub:'State Capital: Imphal',   lat:24.6637, lon:93.9063, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Meghalaya',                        sub:'State Capital: Shillong', lat:25.4670, lon:91.3662, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Mizoram',                          sub:'State Capital: Aizawl',   lat:23.1645, lon:92.9376, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Nagaland',                         sub:'State Capital: Kohima',   lat:26.1584, lon:94.5624, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Odisha',                           sub:'State Capital: Bhubaneswar',lat:20.9517, lon:85.0985, type:'state',  icon:'🗺️', badge:'State' },
    { name:'Punjab',                           sub:'State Capital: Chandigarh',lat:31.1471, lon:75.3412, type:'state',   icon:'🗺️', badge:'State' },
    { name:'Rajasthan',                        sub:'State Capital: Jaipur',   lat:27.0238, lon:74.2179, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Sikkim',                           sub:'State Capital: Gangtok',  lat:27.5330, lon:88.5122, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Tamil Nadu',                       sub:'State Capital: Chennai',  lat:11.1271, lon:78.6569, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Telangana',                        sub:'State Capital: Hyderabad',lat:18.1124, lon:79.0193, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Tripura',                          sub:'State Capital: Agartala', lat:23.9408, lon:91.9882, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Uttar Pradesh',                    sub:'State Capital: Lucknow',  lat:26.8467, lon:80.9462, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Uttarakhand',                      sub:'State Capital: Dehradun', lat:30.0668, lon:79.0193, type:'state',    icon:'🗺️', badge:'State' },
    { name:'West Bengal',                      sub:'State Capital: Kolkata',  lat:22.9868, lon:87.8550, type:'state',    icon:'🗺️', badge:'State' },
    { name:'Delhi – NCT',                      sub:'Union Territory',         lat:28.6139, lon:77.2090, type:'state',    icon:'🏛️', badge:'NCT' },
    { name:'Jammu & Kashmir',                  sub:'Union Territory',         lat:33.7782, lon:76.5762, type:'state',    icon:'🗺️', badge:'UT' },
    { name:'Ladakh',                           sub:'Union Territory',         lat:34.1526, lon:77.5771, type:'state',    icon:'🏔️', badge:'UT' },
    { name:'Chandigarh',                       sub:'Union Territory',         lat:30.7333, lon:76.7794, type:'state',    icon:'🏙️', badge:'UT' },
    { name:'Puducherry',                       sub:'Union Territory',         lat:11.9416, lon:79.8083, type:'state',    icon:'🏖️', badge:'UT' },
    { name:'Andaman & Nicobar',                sub:'Union Territory',         lat:11.7401, lon:92.6586, type:'state',    icon:'🏝️', badge:'UT' },
    { name:'Lakshadweep',                      sub:'Union Territory',         lat:10.5667, lon:72.6417, type:'state',    icon:'🏝️', badge:'UT' },
    { name:'Dadra & Nagar Haveli & Daman & Diu', sub:'Union Territory',      lat:20.1809, lon:73.0169, type:'state',    icon:'🗺️', badge:'UT' },
    // ── MAJOR HIGHWAYS ──
    { name:'NH-44 – Delhi to Kanyakumari',     sub:'India\'s Longest Highway', lat:28.0,   lon:77.5,   type:'highway',  icon:'🛣️', badge:'NH-44' },
    { name:'NH-48 – Delhi-Mumbai Expressway',  sub:'NH-48 Corridor',           lat:25.5,   lon:75.0,   type:'highway',  icon:'🛣️', badge:'NH-48' },
    { name:'NH-19 – Delhi to Kolkata (GT Road)',sub:'Grand Trunk Road',         lat:25.0,   lon:80.0,   type:'highway',  icon:'🛣️', badge:'NH-19' },
    { name:'NH-27 – East-West Corridor',       sub:'Porbandar to Silchar',      lat:22.0,   lon:75.0,   type:'highway',  icon:'🛣️', badge:'NH-27' },
    { name:'Yamuna Expressway',                sub:'Greater Noida–Agra',        lat:27.9,   lon:77.7,   type:'highway',  icon:'🛣️', badge:'Expressway' },
    { name:'Mumbai-Pune Expressway',           sub:'NH-48 Segment',             lat:18.75,  lon:73.45,  type:'highway',  icon:'🛣️', badge:'Expressway' },
    { name:'DMIC – Delhi Mumbai Industrial Corridor', sub:'Multi-State',        lat:24.0,   lon:76.5,   type:'highway',  icon:'🏭', badge:'DMIC' },
    { name:'Bengaluru-Chennai Expressway',     sub:'NH-48 Extension',           lat:12.9,   lon:78.5,   type:'highway',  icon:'🛣️', badge:'Expressway' },
    // ── AIRPORTS & PORTS ──
    { name:'Indira Gandhi International Airport', sub:'Delhi',                  lat:28.5562, lon:77.1000, type:'airport', icon:'✈️', badge:'Airport' },
    { name:'Chhatrapati Shivaji Intl Airport',    sub:'Mumbai',                  lat:19.0896, lon:72.8656, type:'airport', icon:'✈️', badge:'Airport' },
    { name:'Kempegowda Intl Airport (BLR)',       sub:'Bengaluru',               lat:13.1986, lon:77.7066, type:'airport', icon:'✈️', badge:'Airport' },
    { name:'Rajiv Gandhi Intl Airport (HYD)',     sub:'Hyderabad',               lat:17.2403, lon:78.4294, type:'airport', icon:'✈️', badge:'Airport' },
    { name:'Chennai Intl Airport (MAA)',           sub:'Tamil Nadu',              lat:12.9900, lon:80.1693, type:'airport', icon:'✈️', badge:'Airport' },
    { name:'Netaji Subhash Chandra Airport (CCU)',sub:'Kolkata',                  lat:22.6520, lon:88.4463, type:'airport', icon:'✈️', badge:'Airport' },
    { name:'Sardar Vallabhbhai Patel Airport (AMD)',sub:'Ahmedabad',              lat:23.0725, lon:72.6349, type:'airport', icon:'✈️', badge:'Airport' },
    { name:'Pune Airport (PNQ)',                   sub:'Maharashtra',             lat:18.5822, lon:73.9197, type:'airport', icon:'✈️', badge:'Airport' },
    { name:'JNPT Nhava Sheva Port',                sub:'Navi Mumbai',             lat:18.9510, lon:72.9364, type:'airport', icon:'🚢', badge:'Mega Port' },
    { name:'Mundra Port – Adani',                  sub:'Gujarat',                 lat:22.8392, lon:69.7220, type:'airport', icon:'🚢', badge:'Port' },
    // ── POPULAR AREAS & LANDMARKS ──
    { name:'Aerocity – Hospitality District',  sub:'Delhi IGI Airport Area',   lat:28.5565, lon:77.0959, type:'landmark', icon:'🏨', badge:'Hospitality' },
    { name:'Cyber Hub Gurugram',               sub:'Haryana',                  lat:28.4952, lon:77.0918, type:'landmark', icon:'🍴', badge:'F&B Hub' },
    { name:'Hiranandani – Powai',              sub:'Mumbai',                   lat:19.1223, lon:72.9060, type:'landmark', icon:'🏘️', badge:'Township' },
    { name:'DLF Cyber City',                   sub:'Gurugram',                 lat:28.4950, lon:77.0880, type:'landmark', icon:'🏢', badge:'Office Hub' },
    { name:'RMZ Millenia – Chennai',           sub:'Tamil Nadu',               lat:12.9122, lon:80.2277, type:'landmark', icon:'🏢', badge:'Office' },
    { name:'Embassy Manyata Tech Park',        sub:'Bengaluru',                lat:13.0456, lon:77.6208, type:'landmark', icon:'🏢', badge:'Tech Park' },
    { name:'Phoenix MarketCity – Mumbai',      sub:'Kurla West',               lat:19.0868, lon:72.8901, type:'landmark', icon:'🛍️', badge:'Mall' },
    { name:'Lulu Mall Kochi',                  sub:'Kerala',                   lat:10.0262, lon:76.3083, type:'landmark', icon:'🛍️', badge:'Mall' },
    { name:'Select Citywalk – Delhi',          sub:'Saket, Delhi',             lat:28.5268, lon:77.2159, type:'landmark', icon:'🛍️', badge:'Mall' },
    { name:'Forum Mall Bengaluru',             sub:'Karnataka',                lat:12.9352, lon:77.6101, type:'landmark', icon:'🛍️', badge:'Mall' },

    // ══════════════════════════════════════════════════
    // ── GUJARAT — COMPREHENSIVE PLACES DATABASE ──
    // ══════════════════════════════════════════════════

    // ── SURAT — City Zones & Neighbourhoods ──
    { name:'Surat – Athwa Lines (Athwa Gate)', sub:'Surat, Gujarat',           lat:21.1906, lon:72.8262, type:'metro',    icon:'🏙️', badge:'CBD' },
    { name:'Surat – Adajan',                   sub:'Surat, Gujarat',           lat:21.2095, lon:72.7897, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Surat – Pal',                      sub:'Surat, Gujarat',           lat:21.2230, lon:72.7800, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Surat – Vesu',                     sub:'Surat, Gujarat',           lat:21.1479, lon:72.7742, type:'metro',    icon:'🏘️', badge:'Upscale' },
    { name:'Surat – Dumas Road',               sub:'Surat, Gujarat',           lat:21.0973, lon:72.7209, type:'metro',    icon:'🏖️', badge:'Coastal' },
    { name:'Surat – Piplod',                   sub:'Surat, Gujarat',           lat:21.1574, lon:72.7696, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Surat – Katargam',                 sub:'Surat, Gujarat',           lat:21.2142, lon:72.8457, type:'metro',    icon:'🧵', badge:'Textile' },
    { name:'Surat – Varachha',                 sub:'Surat, Gujarat',           lat:21.2040, lon:72.8823, type:'metro',    icon:'🧵', badge:'Textile' },
    { name:'Surat – Limbayat',                 sub:'Surat, Gujarat',           lat:21.1682, lon:72.8765, type:'metro',    icon:'🏭', badge:'Industrial' },
    { name:'Surat – Udhna',                    sub:'Surat, Gujarat',           lat:21.1601, lon:72.8603, type:'metro',    icon:'🏭', badge:'Industrial' },
    { name:'Surat – Pandesara GIDC',           sub:'Surat, Gujarat',           lat:21.1511, lon:72.8956, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Surat – Sachin GIDC Industrial',   sub:'Surat, Gujarat',           lat:21.0938, lon:72.8632, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Surat – Kadodara GIDC',            sub:'Surat, Gujarat',           lat:21.1350, lon:72.9260, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Surat – Kim GIDC',                 sub:'Surat, Gujarat',           lat:21.1979, lon:72.9785, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Surat – Ichhapor GIDC',            sub:'Surat, Gujarat',           lat:21.2400, lon:72.9200, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Surat – Sarthana',                 sub:'Surat, Gujarat',           lat:21.2340, lon:72.8897, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Surat – Rander',                   sub:'Surat, Gujarat',           lat:21.2472, lon:72.8098, type:'metro',    icon:'🏘️', badge:'Heritage' },
    { name:'Surat – Chowk Bazar',              sub:'Surat, Gujarat',           lat:21.1944, lon:72.8321, type:'metro',    icon:'🛍️', badge:'Market' },
    { name:'Surat – Ring Road',                sub:'Surat, Gujarat',           lat:21.1971, lon:72.8456, type:'metro',    icon:'🛍️', badge:'Commercial' },
    { name:'Surat – Majura Gate',              sub:'Surat, Gujarat',           lat:21.1966, lon:72.8320, type:'metro',    icon:'🛍️', badge:'Market' },
    { name:'Surat – City Light',               sub:'Surat, Gujarat',           lat:21.1753, lon:72.8018, type:'metro',    icon:'🏘️', badge:'Upscale' },
    { name:'Surat – Bhatar Road',              sub:'Surat, Gujarat',           lat:21.1990, lon:72.7920, type:'metro',    icon:'🏘️', badge:'Growth' },
    { name:'Surat – Althan',                   sub:'Surat, Gujarat',           lat:21.1752, lon:72.7693, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Surat – Ghod Dod Road',            sub:'Surat, Gujarat',           lat:21.1875, lon:72.8098, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Surat – Khatodara',                sub:'Surat, Gujarat',           lat:21.1811, lon:72.8445, type:'metro',    icon:'🏭', badge:'Industrial' },
    { name:'Surat – Rampura',                  sub:'Surat, Gujarat',           lat:21.1952, lon:72.8418, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Surat – Palanpur',                 sub:'Surat, Gujarat',           lat:21.2121, lon:72.8624, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Surat – Dindoli',                  sub:'Surat, Gujarat',           lat:21.1425, lon:72.8726, type:'metro',    icon:'🏭', badge:'Industrial' },
    { name:'Surat – Bamroli',                  sub:'Surat, Gujarat',           lat:21.1250, lon:72.8900, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Surat – Hazira LNG Port',          sub:'Surat, Gujarat',           lat:21.1211, lon:72.6364, type:'industrial',icon:'⛽', badge:'LNG Port' },
    { name:'Surat – Textile Market Bhagatalav',sub:'Surat, Gujarat',           lat:21.1950, lon:72.8350, type:'landmark', icon:'🧵', badge:'Textile Hub' },
    { name:'Surat – Surat Airport (STV)',      sub:'Surat, Gujarat',           lat:21.1141, lon:72.7419, type:'airport',  icon:'✈️', badge:'Airport' },
    { name:'Surat – Tapi River Front',         sub:'Surat, Gujarat',           lat:21.1928, lon:72.8285, type:'landmark', icon:'🌊', badge:'Riverfront' },
    { name:'Surat – Diamond Bourse (SDB)',     sub:'Surat, Gujarat',           lat:21.1450, lon:72.7550, type:'landmark', icon:'💎', badge:'Diamond Bourse' },
    { name:'Surat – DREAM City',              sub:'Surat, Gujarat',           lat:21.1350, lon:72.7600, type:'metro',    icon:'🏗️', badge:'Smart City' },

    // ── NADIAD — City Areas & Surroundings ──
    { name:'Nadiad',                           sub:'Kheda, Gujarat',           lat:22.6916, lon:72.8634, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Nadiad – Santram Road',            sub:'Kheda, Gujarat',           lat:22.6960, lon:72.8620, type:'tier2',    icon:'🛍️', badge:'Commercial' },
    { name:'Nadiad – College Road',            sub:'Kheda, Gujarat',           lat:22.6890, lon:72.8580, type:'tier2',    icon:'🎓', badge:'Education' },
    { name:'Nadiad – Chaklasi Road',           sub:'Kheda, Gujarat',           lat:22.6780, lon:72.8700, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Nadiad – Old Town',                sub:'Kheda, Gujarat',           lat:22.6940, lon:72.8650, type:'tier2',    icon:'🏘️', badge:'Heritage' },
    { name:'Nadiad – GIDC Industrial',         sub:'Kheda, Gujarat',           lat:22.6820, lon:72.8900, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Nadiad – Vasna Road',              sub:'Kheda, Gujarat',           lat:22.6850, lon:72.8550, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Nadiad – Boriavi',                 sub:'Kheda, Gujarat',           lat:22.6700, lon:72.8850, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Nadiad – Dakor Road',              sub:'Kheda, Gujarat',           lat:22.6790, lon:72.8730, type:'tier2',    icon:'🛍️', badge:'Market' },
    { name:'Nadiad – Dholi Naka',              sub:'Kheda, Gujarat',           lat:22.6970, lon:72.8690, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Nadiad – Station Road',            sub:'Kheda, Gujarat',           lat:22.6920, lon:72.8640, type:'tier2',    icon:'🚉', badge:'Railway Hub' },
    { name:'Nadiad – H M Patel Institute',     sub:'Kheda, Gujarat',           lat:22.6875, lon:72.8590, type:'landmark', icon:'🎓', badge:'Medical College' },
    { name:'Nadiad – Shreenathji Nagar',       sub:'Kheda, Gujarat',           lat:22.6900, lon:72.8620, type:'tier2',    icon:'🏘️', badge:'Suburb' },

    // ── AHMEDABAD — Comprehensive Areas ──
    { name:'Ahmedabad – Satellite',            sub:'Gujarat',                  lat:23.0323, lon:72.5109, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Ahmedabad – Prahlad Nagar',        sub:'Gujarat',                  lat:23.0186, lon:72.5088, type:'metro',    icon:'🛍️', badge:'Upscale' },
    { name:'Ahmedabad – Bodakdev',             sub:'Gujarat',                  lat:23.0435, lon:72.5046, type:'metro',    icon:'🏘️', badge:'Upscale' },
    { name:'Ahmedabad – Vastrapur',            sub:'Gujarat',                  lat:23.0362, lon:72.5316, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Ahmedabad – Thaltej',              sub:'Gujarat',                  lat:23.0600, lon:72.4988, type:'metro',    icon:'🏘️', badge:'Growth' },
    { name:'Ahmedabad – Chandkheda',           sub:'Gujarat',                  lat:23.1000, lon:72.5800, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Ahmedabad – Gota',                 sub:'Gujarat',                  lat:23.0800, lon:72.5580, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Ahmedabad – Maninagar',            sub:'Gujarat',                  lat:22.9895, lon:72.6053, type:'metro',    icon:'🏘️', badge:'Heritage' },
    { name:'Ahmedabad – Nikol',                sub:'Gujarat',                  lat:23.0381, lon:72.6498, type:'metro',    icon:'🏭', badge:'Industrial' },
    { name:'Ahmedabad – Vastral',              sub:'Gujarat',                  lat:22.9876, lon:72.6551, type:'metro',    icon:'🏭', badge:'Industrial' },
    { name:'Ahmedabad – Odhav GIDC',           sub:'Gujarat',                  lat:23.0290, lon:72.6606, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Ahmedabad – Vatva GIDC',           sub:'Gujarat',                  lat:22.9520, lon:72.6328, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Ahmedabad – Narol Industrial',     sub:'Gujarat',                  lat:22.9400, lon:72.6500, type:'industrial',icon:'🏭', badge:'Industrial' },
    { name:'Ahmedabad – Bopal',                sub:'Gujarat',                  lat:23.0143, lon:72.4667, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Ahmedabad – South Bopal',          sub:'Gujarat',                  lat:22.9961, lon:72.4632, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Ahmedabad – Sarkhej',              sub:'Gujarat',                  lat:22.9898, lon:72.5027, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Ahmedabad – Paldi',                sub:'Gujarat',                  lat:23.0111, lon:72.5723, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Ahmedabad – Ellis Bridge',         sub:'Gujarat',                  lat:23.0262, lon:72.5738, type:'metro',    icon:'🏛️', badge:'CBD' },
    { name:'Ahmedabad – CG Road',              sub:'Gujarat',                  lat:23.0295, lon:72.5607, type:'metro',    icon:'🛍️', badge:'Commercial' },
    { name:'Ahmedabad – Ashram Road',          sub:'Gujarat',                  lat:23.0267, lon:72.5749, type:'metro',    icon:'🏛️', badge:'Commercial' },
    { name:'Ahmedabad – Ambawadi',             sub:'Gujarat',                  lat:23.0337, lon:72.5498, type:'metro',    icon:'🏘️', badge:'Suburb' },
    { name:'Ahmedabad – Prahladnagar Garden',  sub:'Gujarat',                  lat:23.0174, lon:72.5060, type:'metro',    icon:'🌳', badge:'Green Zone' },
    { name:'Ahmedabad – Sindhu Bhavan Road',   sub:'Gujarat',                  lat:23.0583, lon:72.4873, type:'metro',    icon:'🛍️', badge:'Upscale' },
    { name:'Ahmedabad – Zundal',               sub:'Gujarat',                  lat:23.1125, lon:72.6005, type:'metro',    icon:'🏘️', badge:'Growth' },
    { name:'Ahmedabad – Motera Stadium',       sub:'Gujarat',                  lat:23.0941, lon:72.5942, type:'landmark', icon:'🏏', badge:'Stadium' },
    { name:'Ahmedabad – Sabarmati Riverfront', sub:'Gujarat',                  lat:23.0610, lon:72.5859, type:'landmark', icon:'🌊', badge:'Riverfront' },
    { name:'Ahmedabad – Adalaj',               sub:'Gujarat',                  lat:23.1653, lon:72.5810, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Ahmedabad – Khokhara',             sub:'Gujarat',                  lat:23.0432, lon:72.6175, type:'metro',    icon:'🏘️', badge:'Suburb' },

    // ── GANDHINAGAR — Capital of Gujarat ──
    { name:'Gandhinagar – Sector 1 to 30',     sub:'Gujarat Capital',          lat:23.2156, lon:72.6369, type:'tier2',    icon:'🏛️', badge:'State Capital' },
    { name:'Gandhinagar – GIFT City SEZ',      sub:'Gujarat',                  lat:23.1622, lon:72.6841, type:'industrial',icon:'💹', badge:'Fin Hub' },
    { name:'Gandhinagar – InfoCity IT Park',   sub:'Gujarat',                  lat:23.1666, lon:72.6500, type:'industrial',icon:'💻', badge:'IT Hub' },
    { name:'Gandhinagar – Adalaj Heritage',    sub:'Gujarat',                  lat:23.1658, lon:72.5807, type:'landmark', icon:'🕌', badge:'Heritage' },
    { name:'Gandhinagar – Akshardham Temple',  sub:'Gujarat',                  lat:23.2163, lon:72.6765, type:'landmark', icon:'🛕', badge:'Pilgrimage' },
    { name:'Gandhinagar – Raysan',             sub:'Gujarat',                  lat:23.1859, lon:72.6213, type:'tier2',    icon:'🏘️', badge:'Suburb' },

    // ── VADODARA — Comprehensive Areas ──
    { name:'Vadodara – Alkapuri',              sub:'Gujarat',                  lat:22.3144, lon:73.1837, type:'tier2',    icon:'🏛️', badge:'CBD' },
    { name:'Vadodara – Sayajigunj',            sub:'Gujarat',                  lat:22.3122, lon:73.1831, type:'tier2',    icon:'🏘️', badge:'Heritage' },
    { name:'Vadodara – Gotri',                 sub:'Gujarat',                  lat:22.3427, lon:73.1441, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Vadodara – Akota',                 sub:'Gujarat',                  lat:22.3037, lon:73.1634, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Vadodara – Waghodia Road',         sub:'Gujarat',                  lat:22.2750, lon:73.2300, type:'industrial',icon:'🏭', badge:'Industrial' },
    { name:'Vadodara – Makarpura GIDC',        sub:'Gujarat',                  lat:22.2684, lon:73.1875, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Vadodara – Gorwa',                 sub:'Gujarat',                  lat:22.3245, lon:73.1484, type:'industrial',icon:'🏭', badge:'Industrial' },
    { name:'Vadodara – Harni',                 sub:'Gujarat',                  lat:22.3435, lon:73.2091, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Vadodara – Manjalpur',             sub:'Gujarat',                  lat:22.2617, lon:73.1816, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Vadodara – Fatehgunj',             sub:'Gujarat',                  lat:22.3227, lon:73.1914, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Vadodara – Karelibaug',            sub:'Gujarat',                  lat:22.3163, lon:73.2013, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Vadodara – Tarsali',               sub:'Gujarat',                  lat:22.2488, lon:73.1984, type:'industrial',icon:'🏭', badge:'Industrial' },
    { name:'Vadodara – ONGC Township',         sub:'Gujarat',                  lat:22.3308, lon:73.1460, type:'industrial',icon:'⛽', badge:'ONGC' },
    { name:'Vadodara – Laxmi Pura',            sub:'Gujarat',                  lat:22.2950, lon:73.1710, type:'tier2',    icon:'🏘️', badge:'Suburb' },

    // ── RAJKOT — Areas ──
    { name:'Rajkot – Kalawad Road',            sub:'Gujarat',                  lat:22.3181, lon:70.7522, type:'tier2',    icon:'🏘️', badge:'Upscale' },
    { name:'Rajkot – Gondal Road',             sub:'Gujarat',                  lat:22.2640, lon:70.7868, type:'tier2',    icon:'🏘️', badge:'Commercial' },
    { name:'Rajkot – Race Course Road',        sub:'Gujarat',                  lat:22.3039, lon:70.8022, type:'tier2',    icon:'🏘️', badge:'CBD' },
    { name:'Rajkot – Mavdi',                   sub:'Gujarat',                  lat:22.2997, lon:70.7683, type:'tier2',    icon:'🏘️', badge:'Suburb' },
    { name:'Rajkot – Aji GIDC Industrial',     sub:'Gujarat',                  lat:22.2872, lon:70.8309, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Rajkot – Metoda GIDC',             sub:'Gujarat',                  lat:22.2228, lon:70.9121, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Rajkot – Trikon Baug',             sub:'Gujarat',                  lat:22.3023, lon:70.7993, type:'landmark', icon:'🌳', badge:'Park' },
    { name:'Rajkot – University Road',         sub:'Gujarat',                  lat:22.3050, lon:70.7880, type:'tier2',    icon:'🎓', badge:'Education' },

    // ── BHAVNAGAR ──
    { name:'Bhavnagar',                        sub:'Gujarat',                  lat:21.7645, lon:72.1519, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Bhavnagar – Alang Ship Breaking', sub:'Gujarat',                  lat:21.4082, lon:72.1827, type:'industrial',icon:'🚢', badge:'Ship Breaking' },
    { name:'Bhavnagar – Sihor',               sub:'Gujarat',                  lat:21.7177, lon:71.9682, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Bhavnagar – Mahuva',              sub:'Gujarat',                  lat:21.0866, lon:71.7531, type:'tier2',    icon:'🌾', badge:'Agri' },
    { name:'Bhavnagar – Palitana',            sub:'Gujarat',                  lat:21.5238, lon:71.8231, type:'landmark', icon:'🛕', badge:'Jain Pilgrimage' },

    // ── JAMNAGAR ──
    { name:'Jamnagar',                         sub:'Gujarat',                  lat:22.4707, lon:70.0577, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Jamnagar – Reliance Refinery',     sub:'Gujarat',                  lat:22.3922, lon:69.9157, type:'industrial',icon:'⛽', badge:'Refinery' },
    { name:'Jamnagar – Balachadi',             sub:'Gujarat',                  lat:22.5427, lon:69.9167, type:'industrial',icon:'🏭', badge:'Industrial' },
    { name:'Jamnagar – Khambhalia',            sub:'Gujarat',                  lat:22.2050, lon:69.6601, type:'tier2',    icon:'🏘️', badge:'Town' },

    // ── JUNAGADH ──
    { name:'Junagadh',                         sub:'Gujarat',                  lat:21.5222, lon:70.4580, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Junagadh – Somnath Temple',        sub:'Gujarat',                  lat:20.8880, lon:70.4013, type:'landmark', icon:'🛕', badge:'Pilgrimage' },
    { name:'Junagadh – Veraval',               sub:'Gujarat',                  lat:20.9016, lon:70.3631, type:'tier2',    icon:'🚢', badge:'Fishing Port' },
    { name:'Junagadh – Keshod',                sub:'Gujarat',                  lat:21.3022, lon:70.2466, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Junagadh – Mangrol',               sub:'Gujarat',                  lat:21.1200, lon:70.1168, type:'tier2',    icon:'🏘️', badge:'Town' },

    // ── KUTCH / KACHCHH ──
    { name:'Bhuj',                             sub:'Kutch, Gujarat',           lat:23.2419, lon:69.6669, type:'tier2',    icon:'🏙️', badge:'Heritage City' },
    { name:'Bhuj – Bhujodi Weaving Village',  sub:'Kutch, Gujarat',           lat:23.2060, lon:69.7260, type:'landmark', icon:'🧵', badge:'Handicraft' },
    { name:'Gandhidham',                       sub:'Kutch, Gujarat',           lat:23.0801, lon:70.1337, type:'tier2',    icon:'🏙️', badge:'Industrial Town' },
    { name:'Anjar',                            sub:'Kutch, Gujarat',           lat:23.1100, lon:70.0270, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Mandvi',                           sub:'Kutch, Gujarat',           lat:22.8322, lon:69.3549, type:'tier2',    icon:'🏖️', badge:'Coastal Town' },
    { name:'Mundra',                           sub:'Kutch, Gujarat',           lat:22.8392, lon:69.7220, type:'industrial',icon:'🚢', badge:'Port City' },
    { name:'Rann of Kutch',                    sub:'Kutch, Gujarat',           lat:23.7337, lon:69.8597, type:'landmark', icon:'🏜️', badge:'Salt Desert' },

    // ── MEHSANA & NORTH GUJARAT ──
    { name:'Mehsana',                          sub:'Gujarat',                  lat:23.5880, lon:72.3693, type:'tier2',    icon:'🏙️', badge:'Dairy Hub' },
    { name:'Mehsana – GNFC Fertilizer Plant', sub:'Gujarat',                  lat:23.5950, lon:72.3750, type:'industrial',icon:'🌿', badge:'Fertilizer' },
    { name:'Visnagar',                         sub:'Mehsana, Gujarat',         lat:23.6993, lon:72.5523, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Unjha',                            sub:'Mehsana, Gujarat',         lat:23.8065, lon:72.3986, type:'tier2',    icon:'🌿', badge:'Seed Market' },
    { name:'Kadi',                             sub:'Mehsana, Gujarat',         lat:23.2998, lon:72.3356, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Patan',                            sub:'Gujarat',                  lat:23.8493, lon:72.1266, type:'tier2',    icon:'🏯', badge:'Heritage City' },
    { name:'Patan – Rani ki Vav',             sub:'Gujarat',                  lat:23.8583, lon:72.1016, type:'landmark', icon:'🛕', badge:'UNESCO Site' },
    { name:'Palanpur',                         sub:'Banaskantha, Gujarat',     lat:24.1742, lon:72.4382, type:'tier2',    icon:'🏙️', badge:'Diamond Polish' },
    { name:'Deesa',                            sub:'Banaskantha, Gujarat',     lat:24.2573, lon:72.1885, type:'tier2',    icon:'🌾', badge:'Agri Hub' },
    { name:'Tharad',                           sub:'Banaskantha, Gujarat',     lat:24.3965, lon:71.6264, type:'tier2',    icon:'🏘️', badge:'Town' },

    // ── ANAND / KHEDA ──
    { name:'Anand',                            sub:'Gujarat',                  lat:22.5645, lon:72.9289, type:'tier2',    icon:'🏙️', badge:'Milk Capital' },
    { name:'Anand – AMUL Dairy HQ',           sub:'Gujarat',                  lat:22.5685, lon:72.9310, type:'landmark', icon:'🐄', badge:'AMUL HQ' },
    { name:'Anand – Vallabh Vidyanagar',       sub:'Gujarat',                  lat:22.5430, lon:72.9255, type:'tier2',    icon:'🎓', badge:'Education Hub' },
    { name:'Anand – Karamsad',                sub:'Gujarat',                  lat:22.5446, lon:72.9222, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Kheda',                            sub:'Gujarat',                  lat:22.7516, lon:72.6877, type:'tier2',    icon:'🏙️', badge:'District HQ' },
    { name:'Petlad',                           sub:'Anand, Gujarat',           lat:22.4766, lon:72.7980, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Borsad',                           sub:'Anand, Gujarat',           lat:22.4057, lon:72.8991, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Umreth',                           sub:'Anand, Gujarat',           lat:22.6955, lon:73.1149, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Dakor',                            sub:'Kheda, Gujarat',           lat:22.7530, lon:73.1497, type:'landmark', icon:'🛕', badge:'Pilgrimage' },
    { name:'Kapadvanj',                        sub:'Kheda, Gujarat',           lat:23.0184, lon:73.0725, type:'tier2',    icon:'🏘️', badge:'Town' },

    // ── GANDHINAGAR DISTRICT ──
    { name:'Kalol',                            sub:'Gandhinagar, Gujarat',     lat:23.2409, lon:72.4933, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Dehgam',                           sub:'Gandhinagar, Gujarat',     lat:23.1766, lon:72.8068, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Mansa',                            sub:'Gandhinagar, Gujarat',     lat:23.4270, lon:72.6665, type:'tier2',    icon:'🏘️', badge:'Town' },

    // ── SABARKANTHA & ARAVALLI ──
    { name:'Himatnagar',                       sub:'Sabarkantha, Gujarat',     lat:23.5959, lon:72.9680, type:'tier2',    icon:'🏙️', badge:'District HQ' },
    { name:'Idar',                             sub:'Sabarkantha, Gujarat',     lat:23.8318, lon:73.0003, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Modasa',                           sub:'Aravalli, Gujarat',        lat:23.4650, lon:73.3004, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Bayad',                            sub:'Aravalli, Gujarat',        lat:23.2568, lon:73.2298, type:'tier2',    icon:'🏘️', badge:'Town' },

    // ── PANCHMAHAL & DAHOD ──
    { name:'Godhra',                           sub:'Panchmahal, Gujarat',      lat:22.7795, lon:73.6143, type:'tier2',    icon:'🏙️', badge:'District HQ' },
    { name:'Halol',                            sub:'Panchmahal, Gujarat',      lat:22.5075, lon:73.4686, type:'industrial',icon:'🚗', badge:'Auto Hub' },
    { name:'Dahod',                            sub:'Gujarat',                  lat:22.8357, lon:74.2552, type:'tier2',    icon:'🏙️', badge:'Tribal District' },
    { name:'Lunawada',                         sub:'Mahisagar, Gujarat',       lat:23.1248, lon:73.6196, type:'tier2',    icon:'🏘️', badge:'Town' },

    // ── NARMADA & BHARUCH ──
    { name:'Bharuch',                          sub:'Gujarat',                  lat:21.7051, lon:72.9959, type:'tier2',    icon:'🏙️', badge:'Chemical Hub' },
    { name:'Bharuch – Ankleshwar GIDC',        sub:'Gujarat',                  lat:21.6263, lon:73.0108, type:'industrial',icon:'🧪', badge:'Chemical GIDC' },
    { name:'Bharuch – Dahej SEZ',              sub:'Gujarat',                  lat:21.6975, lon:72.5373, type:'industrial',icon:'🧪', badge:'Chemical SEZ' },
    { name:'Bharuch – Jambusar',               sub:'Gujarat',                  lat:22.0568, lon:72.8058, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Rajpipla',                         sub:'Narmada, Gujarat',         lat:21.8739, lon:73.5067, type:'tier2',    icon:'🏘️', badge:'District HQ' },
    { name:'Dediyapada',                       sub:'Narmada, Gujarat',         lat:21.9193, lon:73.6903, type:'tier2',    icon:'🏘️', badge:'Tribal Area' },

    // ── NAVSARI & DANG ──
    { name:'Navsari',                          sub:'Gujarat',                  lat:20.9467, lon:72.9520, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Navsari – Jalalpor',               sub:'Gujarat',                  lat:20.9390, lon:72.9620, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Gandevi',                          sub:'Navsari, Gujarat',         lat:20.8102, lon:72.9899, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Chikhli',                          sub:'Navsari, Gujarat',         lat:20.7558, lon:73.0630, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Ahwa',                             sub:'Dang, Gujarat',            lat:20.7615, lon:73.6870, type:'tier2',    icon:'🏞️', badge:'Tribal Capital' },

    // ── TAPI & VALSAD ──
    { name:'Vyara',                            sub:'Tapi, Gujarat',            lat:21.1134, lon:73.3939, type:'tier2',    icon:'🏘️', badge:'District HQ' },
    { name:'Songadh',                          sub:'Tapi, Gujarat',            lat:21.1720, lon:73.5623, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Valsad',                           sub:'Gujarat',                  lat:20.5992, lon:72.9342, type:'tier2',    icon:'🏙️', badge:'Tier-2' },
    { name:'Vapi',                             sub:'Valsad, Gujarat',          lat:20.3713, lon:72.9094, type:'industrial',icon:'🧪', badge:'Chemical Hub' },
    { name:'Vapi – GIDC Industrial',           sub:'Valsad, Gujarat',          lat:20.3700, lon:72.9200, type:'industrial',icon:'🏭', badge:'GIDC' },
    { name:'Bulsar (Bilimora)',                sub:'Navsari, Gujarat',         lat:20.7677, lon:72.9625, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Umbergaon',                        sub:'Valsad, Gujarat',          lat:20.1985, lon:72.7530, type:'industrial',icon:'🏭', badge:'Industrial' },
    { name:'Pardi',                            sub:'Valsad, Gujarat',          lat:20.5049, lon:72.9516, type:'tier2',    icon:'🏘️', badge:'Town' },

    // ── SAURASHTRA REGION ──
    { name:'Porbandar',                        sub:'Gujarat',                  lat:21.6417, lon:69.6085, type:'tier2',    icon:'🏙️', badge:'Gandhi Birthplace' },
    { name:'Dwarka',                           sub:'Gujarat',                  lat:22.2442, lon:68.9685, type:'landmark', icon:'🛕', badge:'Hindu Pilgrimage' },
    { name:'Amreli',                           sub:'Gujarat',                  lat:21.6023, lon:71.2209, type:'tier2',    icon:'🏙️', badge:'District HQ' },
    { name:'Dhari',                            sub:'Amreli, Gujarat',          lat:21.3278, lon:71.0213, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Botad',                            sub:'Gujarat',                  lat:22.1689, lon:71.6630, type:'tier2',    icon:'🏙️', badge:'District HQ' },
    { name:'Surendranagar',                    sub:'Gujarat',                  lat:22.7281, lon:71.6473, type:'tier2',    icon:'🏙️', badge:'Textile Town' },
    { name:'Wadhwan',                          sub:'Surendranagar, Gujarat',   lat:22.7002, lon:71.6775, type:'tier2',    icon:'🏘️', badge:'Heritage Town' },
    { name:'Morbi',                            sub:'Gujarat',                  lat:22.8135, lon:70.8369, type:'tier2',    icon:'🏙️', badge:'Ceramic Hub' },
    { name:'Wankaner',                         sub:'Morbi, Gujarat',           lat:22.6100, lon:70.9447, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Gondal',                           sub:'Rajkot, Gujarat',          lat:21.9605, lon:70.8055, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Jetpur',                           sub:'Rajkot, Gujarat',          lat:21.7540, lon:70.6241, type:'tier2',    icon:'🧵', badge:'Textile Town' },
    { name:'Upleta',                           sub:'Rajkot, Gujarat',          lat:21.7426, lon:70.2773, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Dhoraji',                          sub:'Rajkot, Gujarat',          lat:21.7270, lon:70.4499, type:'tier2',    icon:'🏘️', badge:'Town' },
    { name:'Amreli – Rajula Port',             sub:'Gujarat',                  lat:21.0468, lon:71.4488, type:'industrial',icon:'🚢', badge:'Port' },

    // ── SABARKANTHA & PATAN ──
    { name:'Siddhpur',                         sub:'Patan, Gujarat',           lat:23.9128, lon:72.3760, type:'landmark', icon:'🛕', badge:'Heritage Town' },
    { name:'Radhanpur',                        sub:'Patan, Gujarat',           lat:23.8384, lon:71.5963, type:'tier2',    icon:'🏘️', badge:'Town' },

    // ── GUJARAT PILGRIMAGE & TOURISM ──
    { name:'Ambaji Temple',                    sub:'Banaskantha, Gujarat',     lat:24.3266, lon:72.8529, type:'landmark', icon:'🛕', badge:'Shakti Peeth' },
    { name:'Shamlaji',                         sub:'Aravalli, Gujarat',        lat:23.5496, lon:73.1131, type:'landmark', icon:'🛕', badge:'Pilgrimage' },
    { name:'Girnar',                           sub:'Junagadh, Gujarat',        lat:21.4963, lon:70.4932, type:'landmark', icon:'⛰️', badge:'Religious Hill' },
    { name:'Saputara Hill Station',            sub:'Dang, Gujarat',            lat:20.5696, lon:73.7508, type:'landmark', icon:'🏔️', badge:'Hill Station' },
    { name:'Statue of Unity',                  sub:'Narmada, Gujarat',         lat:21.8381, lon:73.7190, type:'landmark', icon:'🗿', badge:'World\'s Tallest' },
    { name:'Gir National Park',               sub:'Junagadh, Gujarat',        lat:21.1241, lon:70.7830, type:'landmark', icon:'🦁', badge:'Asiatic Lion' },
    { name:'White Rann – Dhordo',             sub:'Kutch, Gujarat',           lat:23.7059, lon:70.1905, type:'landmark', icon:'🏜️', badge:'Rann Festival' },
    { name:'Lothal – Indus Valley',           sub:'Ahmedabad, Gujarat',       lat:22.5224, lon:72.2519, type:'landmark', icon:'🏺', badge:'Archaeological' },
    { name:'Modhera Sun Temple',              sub:'Mehsana, Gujarat',         lat:23.5812, lon:72.1315, type:'landmark', icon:'🛕', badge:'UNESCO' },

    // ── GUJARAT SPECIAL ECONOMIC ZONES ──
    { name:'Surat Apparel Park SEZ',           sub:'Surat, Gujarat',           lat:21.1500, lon:72.8900, type:'industrial',icon:'🧵', badge:'Apparel SEZ' },
    { name:'Pipavav Port SEZ',                 sub:'Amreli, Gujarat',          lat:20.9008, lon:71.5137, type:'industrial',icon:'🚢', badge:'Port SEZ' },
    { name:'Bedi Port',                        sub:'Jamnagar, Gujarat',        lat:22.5480, lon:70.0420, type:'industrial',icon:'🚢', badge:'Port' },
    { name:'Okha Port',                        sub:'Devbhumi Dwarka, Gujarat', lat:22.4700, lon:69.0700, type:'industrial',icon:'🚢', badge:'Port' },
    { name:'Salaya Port',                      sub:'Jamnagar, Gujarat',        lat:22.3105, lon:69.5850, type:'industrial',icon:'🚢', badge:'Port' },
    { name:'Magdalla Port',                    sub:'Surat, Gujarat',           lat:21.1370, lon:72.7120, type:'industrial',icon:'🚢', badge:'Port' },

    // ── GUJARAT HIGHWAYS & CORRIDORS ──
    { name:'Gujarat – NH-48 Delhi-Mumbai Expressway', sub:'Gujarat Segment',  lat:22.5000, lon:72.8000, type:'highway',  icon:'🛣️', badge:'NH-48' },
    { name:'Gujarat – Ahmedabad-Vadodara Expressway', sub:'Gujarat',          lat:22.6700, lon:72.8200, type:'highway',  icon:'🛣️', badge:'Expressway' },
    { name:'Gujarat – Surat-Bharuch Industrial Corridor', sub:'Gujarat',      lat:21.4000, lon:72.9000, type:'highway',  icon:'🏭', badge:'DMIC' },
    { name:'Gujarat – Vadodara-Mumbai Expressway',   sub:'Gujarat',           lat:21.8000, lon:73.0000, type:'highway',  icon:'🛣️', badge:'Expressway' },
];

// ── PLACE TYPE CONFIG (icon colours and badge colours) ──
const PLACE_TYPE_CONFIG = {
    metro:      { bg:'rgba(59,130,246,0.15)',  color:'#3B82F6', badgeBg:'rgba(59,130,246,0.2)',  badgeColor:'#93C5FD' },
    tier2:      { bg:'rgba(34,211,238,0.12)',  color:'#22D3EE', badgeBg:'rgba(34,211,238,0.15)', badgeColor:'#67E8F9' },
    industrial: { bg:'rgba(245,158,11,0.15)', color:'#F59E0B', badgeBg:'rgba(245,158,11,0.2)',  badgeColor:'#FCD34D' },
    state:      { bg:'rgba(167,139,250,0.12)',color:'#A78BFA', badgeBg:'rgba(167,139,250,0.2)', badgeColor:'#C4B5FD' },
    highway:    { bg:'rgba(52,211,153,0.12)', color:'#34D399', badgeBg:'rgba(52,211,153,0.2)',  badgeColor:'#6EE7B7' },
    airport:    { bg:'rgba(244,63,94,0.12)',  color:'#F43F5E', badgeBg:'rgba(244,63,94,0.2)',   badgeColor:'#FB7185' },
    landmark:   { bg:'rgba(251,191,36,0.12)', color:'#FBBF24', badgeBg:'rgba(251,191,36,0.2)',  badgeColor:'#FDE68A' },
};

// ── PLACE CATEGORY LABELS ──
const CATEGORY_LABELS = {
    metro:      '🏙️ Metro Cities & Hubs',
    tier2:      '🏡 Tier-2 Cities & Towns',
    industrial: '🏭 Industrial Areas & SEZs',
    state:      '🗺️ States & Union Territories',
    highway:    '🛣️ Highways & Corridors',
    airport:    '✈️ Airports & Ports',
    landmark:   '📍 Key Landmarks & Districts',
};

let placeSearchActiveIdx = -1;
let placeSearchResults = [];

/** Handle place search input */
function handlePlaceSearch(query) {
    const dropdown = document.getElementById('placeSearchDropdown');
    const clearBtn = document.getElementById('placeSearchClear');
    if (clearBtn) clearBtn.style.display = query.length > 0 ? 'block' : 'none';

    query = query.trim();
    if (query.length === 0) {
        // Show popular/featured places on focus with empty query
        placeSearchResults = INDIA_PLACES_DB.filter(p => p.type === 'metro').slice(0, 12);
        renderPlaceDropdown(dropdown, placeSearchResults, '', true);
        return;
    }

    const q = query.toLowerCase();
    const scored = INDIA_PLACES_DB.map(p => {
        const nameLower = p.name.toLowerCase();
        const subLower  = (p.sub || '').toLowerCase();
        let score = 0;
        if (nameLower === q) score = 100;
        else if (nameLower.startsWith(q)) score = 80;
        else if (nameLower.includes(q)) score = 60;
        else if (subLower.includes(q)) score = 30;
        else {
            // word-by-word match
            const words = q.split(/\s+/);
            const matches = words.filter(w => nameLower.includes(w) || subLower.includes(w));
            score = matches.length * 20;
        }
        return { ...p, _score: score };
    }).filter(p => p._score > 0).sort((a, b) => b._score - a._score).slice(0, 30);

    placeSearchResults = scored;
    placeSearchActiveIdx = -1;

    if (scored.length === 0) {
        dropdown.innerHTML = `<div class="psd-empty"><i class="fa-solid fa-circle-xmark" style="margin-right:6px; color:var(--rose);"></i>No places found for "<strong>${query}</strong>"</div>`;
        dropdown.style.display = 'block';
        return;
    }
    renderPlaceDropdown(dropdown, scored, query, false);
}

/** Render autocomplete dropdown items */
function renderPlaceDropdown(dropdown, results, query, isFeatured) {
    if (!results.length) { dropdown.style.display = 'none'; return; }

    // Group by type
    const groups = {};
    results.forEach(p => {
        if (!groups[p.type]) groups[p.type] = [];
        groups[p.type].push(p);
    });

    const highlightText = (text, q) => {
        if (!q) return text;
        const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return text.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
    };

    let html = isFeatured ? `<div class="psd-category"><i class="fa-solid fa-star" style="color:var(--amber);"></i> Featured Cities</div>` : '';

    Object.entries(groups).forEach(([type, items]) => {
        const cfg = PLACE_TYPE_CONFIG[type] || PLACE_TYPE_CONFIG.tier2;
        if (!isFeatured) {
            html += `<div class="psd-category">${CATEGORY_LABELS[type] || type}</div>`;
        }
        items.forEach((p, idx) => {
            const globalIdx = placeSearchResults.indexOf(p);
            html += `
            <div class="psd-item" data-idx="${globalIdx}" onclick="selectPlaceResult(${globalIdx})">
                <div class="psd-item-icon" style="background:${cfg.bg}; color:${cfg.color};">${p.icon}</div>
                <div class="psd-item-text">
                    <div class="psd-item-name">${highlightText(p.name, query)}</div>
                    <div class="psd-item-sub"><i class="fa-solid fa-location-dot" style="font-size:9px; margin-right:3px;"></i>${p.sub}</div>
                </div>
                <span class="psd-item-badge" style="background:${cfg.badgeBg}; color:${cfg.badgeColor};">${p.badge}</span>
            </div>`;
        });
    });

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';

    // Update count badge
    const countEl = document.getElementById('placeSearchCount');
    if (countEl) countEl.textContent = isFeatured ? '800+ Places' : `${results.length} found`;
}

/** Keyboard navigation */
function handlePlaceSearchKey(e) {
    const dropdown = document.getElementById('placeSearchDropdown');
    const items = dropdown.querySelectorAll('.psd-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        placeSearchActiveIdx = Math.min(placeSearchActiveIdx + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        placeSearchActiveIdx = Math.max(placeSearchActiveIdx - 1, 0);
    } else if (e.key === 'Enter' && placeSearchActiveIdx >= 0) {
        e.preventDefault();
        selectPlaceResult(parseInt(items[placeSearchActiveIdx].dataset.idx));
        return;
    } else if (e.key === 'Escape') {
        closePlaceDropdown();
        return;
    } else {
        return;
    }

    items.forEach((el, i) => el.classList.toggle('active', i === placeSearchActiveIdx));
    items[placeSearchActiveIdx]?.scrollIntoView({ block: 'nearest' });
}

/** Select a place from the autocomplete results */
function selectPlaceResult(idx) {
    const place = placeSearchResults[idx];
    if (!place) return;
    const input = document.getElementById('placeSearchInput');
    if (input) input.value = place.name;
    closePlaceDropdown();
    const zoom = place.type === 'state' ? 7 : place.type === 'highway' ? 8 : 13;
    map.flyTo([place.lat, place.lon], zoom, { duration: 1.3 });
    setTimeout(() => inspectCoordinate(place.lat, place.lon, place.name), 900);
}

/** Close autocomplete dropdown */
function closePlaceDropdown() {
    const dropdown = document.getElementById('placeSearchDropdown');
    if (dropdown) dropdown.style.display = 'none';
    placeSearchActiveIdx = -1;
}

/** Clear search input and dropdown */
function clearPlaceSearch() {
    const input = document.getElementById('placeSearchInput');
    const clearBtn = document.getElementById('placeSearchClear');
    const countEl = document.getElementById('placeSearchCount');
    if (input) { input.value = ''; input.focus(); }
    if (clearBtn) clearBtn.style.display = 'none';
    if (countEl) countEl.textContent = '800+ Places';
    closePlaceDropdown();
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#placeSearchWrapper')) closePlaceDropdown();
});

/** Jump to a coordinate and immediately inspect it (used by prompt chips) */
function jumpToAndInspect(lat, lon, label) {
    map.flyTo([lat, lon], 13, { duration: 1.5 });
    setTimeout(() => inspectCoordinate(lat, lon, label), 800);
}


// Initialize application on DOM content loaded
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await loadPresetsAndLayers();
    setupMapClickHandlers();
    setupCursorTracking();
    // Show click-prompt on the left panel (no default location)
    showDrawerPrompt();
});

/** Show the initial prompt to click on the map */
function showDrawerPrompt() {
    const prompt = document.getElementById('readiness-prompt');
    const result = document.getElementById('readiness-result');
    if (prompt) prompt.style.display = 'flex';
    if (result) result.style.display = 'none';
}

/** Initialize Leaflet Map with Multiple Tile Themes */
function initMap() {
    map = L.map('map', {
        center: [22.5, 78.9], // India — Nationwide overview on startup
        zoom: 5,
        zoomControl: false,
        attributionControl: false
    });

    // 1. Dark Basemap (Esri Dark Gray Base + Labels - 100% Free, Zero Watermark, No API Key)
    const esriDarkBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 16
    });
    const esriDarkRef = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 16
    });
    baseTileLayers['dark'] = L.layerGroup([esriDarkBase, esriDarkRef]);

    // 2. Esri World Satellite (100% Free, Zero Watermark, No API Key)
    baseTileLayers['satellite'] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    });

    // 3. OpenStreetMap Streets (Default Basemap on Site Entry)
    baseTileLayers['streets'] = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Layer groups for dynamic visualizations
    h3HexLayerGroup = L.layerGroup().addTo(map);
    isochroneLayerGroup = L.layerGroup().addTo(map);
    routeLayerGroup = L.layerGroup().addTo(map);
}

/** Switch Basemap Tiles (Dark, Satellite, Streets) */
function setBaseMap(theme) {
    if (theme === currentBaseMap) return;
    map.removeLayer(baseTileLayers[currentBaseMap]);
    baseTileLayers[theme].addTo(map);
    if (typeof baseTileLayers[theme].bringToBack === 'function') {
        baseTileLayers[theme].bringToBack();
    } else if (baseTileLayers[theme].eachLayer) {
        baseTileLayers[theme].eachLayer(l => { if (l.bringToBack) l.bringToBack(); });
    }
    currentBaseMap = theme;

    ['dark', 'satellite', 'streets'].forEach(k => {
        const btn = document.getElementById(`bm-${k}`);
        if (btn) {
            btn.className = k === theme 
                ? 'bm-btn active' 
                : 'bm-btn';
        }
    });
}

/** Load Industry Presets and Geospatial Data Layers */
async function loadPresetsAndLayers() {
    try {
        presetsData = await API.getPresetProfiles();
        const layersData = await API.getLayers();

        // Render each geospatial layer on map
        for (const [layerKey, layerObj] of Object.entries(layersData)) {
            const geojson = layerObj.geojson;
            const countEl = document.getElementById(`count-${layerKey}`);
            if (countEl) {
                countEl.innerText = `${layerObj.feature_count} features`;
            }

            const layerGroup = renderGeoJSONLayer(layerKey, geojson);
            if (layerGroup) {
                mapLayers[layerKey] = layerGroup;
                layerGroup.addTo(map);
            }
        }

        // Update Top Live HUD KPIs
        await updateTopKPIHUD();

        // Fetch H3 Hex Grid with Getis-Ord Gi* Hotspots
        await fetchAndRenderH3Grid();
    } catch (err) {
        console.error("Error loading presets and layers:", err);
    }
}

/** Update Live Metro KPI HUD Bar */
async function updateTopKPIHUD() {
    try {
        const stats = await API.getSummaryStats(currentPresetKey);
        document.getElementById('kpiCandidateCount').innerText = `${stats.total_candidate_parcels} Parcels`;
        document.getElementById('kpiAvgScore').innerText = `${stats.metro_avg_score} / 100`;
        document.getElementById('kpiTopSite').innerText = `${stats.top_candidate_name} (${stats.top_readiness_score})`;
    } catch (err) {
        console.error("Error updating HUD stats:", err);
    }
}

/** Render GeoJSON Layer with Custom Styling */
function renderGeoJSONLayer(layerKey, geojson) {
    if (!geojson || !geojson.features) return null;

    const layerGroup = L.geoJSON(geojson, {
        style: (feature) => getLayerStyle(layerKey, feature),
        pointToLayer: (feature, latlng) => getPointMarker(layerKey, feature, latlng),
        onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            let popupHtml = `<div class="p-2 space-y-1 text-xs">`;
            popupHtml += `<strong class="text-blue-400 block text-sm">${props.name || props.zoning_code || props.site_id || 'Feature'}</strong>`;
            for (const [k, v] of Object.entries(props)) {
                if (k !== 'geometry' && k !== 'layer_type') {
                    popupHtml += `<div><span class="text-slate-400">${k.replace(/_/g, ' ')}:</span> <span class="font-medium text-white">${v}</span></div>`;
                }
            }
            if (layerKey === 'candidate_sites') {
                popupHtml += `<button onclick="inspectCoordinate(${feature.geometry.coordinates[1]}, ${feature.geometry.coordinates[0]}, '${props.name || 'Candidate Site'}')" class="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-white py-1 rounded text-xs font-bold transition-all">Inspect Site Readiness</button>`;
            }
            popupHtml += `</div>`;
            layer.bindPopup(popupHtml);

            if (layerKey === 'candidate_sites') {
                layer.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    const lat = feature.geometry.coordinates[1];
                    const lon = feature.geometry.coordinates[0];
                    inspectCoordinate(lat, lon, props.name, props);
                });
            }
        }
    });

    return layerGroup;
}

/** Get Custom Layer Styling */
function getLayerStyle(layerKey, feature) {
    const props = feature.properties || {};
    if (layerKey === 'demographics') {
        const income = props.median_income || 80000;
        const color = income > 120000 ? '#A855F7' : (income > 85000 ? '#8B5CF6' : '#6366F1');
        return { color: color, weight: 1.5, fillColor: color, fillOpacity: 0.25 };
    }
    if (layerKey === 'transportation') {
        const rtype = props.road_type || 'Highway';
        return rtype === 'Highway' 
            ? { color: '#3B82F6', weight: 4, opacity: 0.85 } 
            : { color: '#60A5FA', weight: 2, opacity: 0.65 };
    }
    if (layerKey === 'zoning') {
        const ztype = props.zoning_type || 'Commercial';
        if (ztype === 'Building Footprint') {
            return { color: '#06B6D4', weight: 2, fillColor: '#22D3EE', fillOpacity: 0.55 };
        }
        const colors = { Commercial: '#10B981', Industrial: '#F59E0B', Residential: '#3B82F6', Conservation: '#EF4444' };
        return { color: colors[ztype] || '#64748B', weight: 1.5, fillColor: colors[ztype] || '#64748B', fillOpacity: 0.2 };
    }
    if (layerKey === 'environmental') {
        const rtype = props.risk_type || '';
        if (rtype.includes('Earthquake') || rtype.includes('Seismic')) {
            return { color: '#F59E0B', weight: 1.5, fillColor: '#F59E0B', fillOpacity: 0.12, dashArray: '6, 6' };
        }
        return { color: '#EF4444', weight: 2, fillColor: '#EF4444', fillOpacity: 0.35, dashArray: '4, 4' };
    }
    return { color: '#94A3B8', weight: 1, fillOpacity: 0.2 };
}

/** Custom Markers for POIs, Environmental Stations, and Candidate Sites */
function getPointMarker(layerKey, feature, latlng) {
    const props = feature.properties || {};
    if (layerKey === 'candidate_sites') {
        // Glowing radar-pulse candidate marker
        return L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: `
                    <div class="candidate-marker-wrapper">
                        <div class="candidate-pulse-ring"></div>
                        <div class="candidate-core-dot"></div>
                    </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        });
    }
    if (layerKey === 'environmental') {
        const aqi = props.air_quality_aqi;
        if (aqi !== undefined) {
            const aqiColor = aqi > 100 ? '#F97316' : '#10B981';
            return L.marker(latlng, {
                icon: L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style="background:${aqiColor}; color:white; border-radius:12px; padding:2px 8px; font-size:10px; font-weight:800; box-shadow:0 0 10px ${aqiColor}; white-space:nowrap; border:1px solid rgba(255,255,255,0.4);"><i class="fa-solid fa-wind" style="font-size:9px; margin-right:3px;"></i>AQI ${aqi}</div>`,
                    iconSize: [68, 22],
                    iconAnchor: [34, 11]
                })
            });
        }
    }
    if (layerKey === 'pois') {
        const cat = (props.category || '').toLowerCase();
        let colorClass = 'anchor';
        if (cat === 'competitor') colorClass = 'competitor';
        else if (cat === 'utility_substation') colorClass = 'utility';

        return L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="poi-marker-dot ${colorClass}"></div>`,
                iconSize: [10, 10],
                iconAnchor: [5, 5]
            })
        });
    }
    return L.marker(latlng);
}

/** Setup Map Click Handlers to Inspect Any Coordinate */
function setupMapClickHandlers() {
    // Remove default crosshair cursor
    map.getContainer().style.cursor = 'default';
    map.on('click', (e) => {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        inspectCoordinate(lat, lon, `Site (${lat.toFixed(3)}, ${lon.toFixed(3)})`);
    });
    // Keep default cursor even after clicks
    map.on('click', () => {
        map.getContainer().style.cursor = 'default';
    });
}

/** Track Cursor Coordinate for Bottom Bar Display */
function setupCursorTracking() {
    map.on('mousemove', (e) => {
        const el = document.getElementById('cursorCoords');
        if (el) el.innerText = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
    });
}

/** Get UI Custom Decay and Constraint Options */
function getDecayTypeFromUI() {
    const el = document.getElementById('decayFunctionSelector');
    return el ? el.value : 'exponential';
}
function getHardConstraintsFromUI() {
    const el = document.getElementById('hardConstraintToggle');
    return el ? el.checked : true;
}

/** Inspect Coordinate Site Readiness Score & Factor Breakdown */
async function inspectCoordinate(lat, lon, siteName = null, parcelProps = null) {
    selectedCoordinate = { lat, lon };

    if (activeInspectorMarker) {
        map.removeLayer(activeInspectorMarker);
    }

    // Drop animated radar ripple marker
    activeInspectorMarker = L.marker([lat, lon], {
        icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="inspector-pin-wrapper">
                     <div class="inspector-radar-ring r1"></div>
                     <div class="inspector-radar-ring r2"></div>
                     <div class="inspector-radar-ring r3"></div>
                     <div class="inspector-pin"><i class="fa-solid fa-location-dot"></i></div>
                   </div>`,
            iconSize: [60, 60],
            iconAnchor: [30, 30]
        })
    }).addTo(map);

    // Show loading state immediately
    openSiteInspector();
    showInspectorLoading(lat, lon);

    const weights = getCustomWeightsFromUI();
    const decayType = getDecayTypeFromUI();
    const hardConstraints = getHardConstraintsFromUI();

    const scoreRes = await API.scorePoint(lat, lon, currentPresetKey, weights, hardConstraints, decayType);

    // Inject display name from place_profile if no explicit name given
    const placeProfile = scoreRes.place_profile || {};
    const spatialMetrics = scoreRes.spatial_metrics || {};
    if (!siteName && spatialMetrics.place_name) {
        siteName = spatialMetrics.place_name;
    }
    if (siteName) scoreRes.name = siteName;
    if (parcelProps) {
        scoreRes.asking_price = parcelProps.asking_price || 0;
        scoreRes.area_acres = parcelProps.area_acres || 0;
        scoreRes.address = parcelProps.address || '';
    }

    currentInspectedSite = scoreRes;
    renderSiteInspector(scoreRes);

    // Render the left-side Readiness panel with rich place data
    renderReadinessPanel(scoreRes, lat, lon);

    // Auto-fetch Isochrone catchments
    fetchAndRenderIsochrones(lat, lon);
}

/** Show loading state inside inspector drawer */
function showInspectorLoading(lat, lon) {
    const nameEl = document.getElementById('inspectorSiteName');
    const scoreEl = document.getElementById('inspectorScoreValue');
    const verdictEl = document.getElementById('inspectorVerdict');
    const statusDescEl = document.getElementById('inspectorScoreStatusDesc');
    const summaryEl = document.getElementById('inspectorAISummary');
    const coordsEl = document.getElementById('inspectorCoordsDisplay');
    const areaTag = document.getElementById('inspectorAreaTag');
    const regionTag = document.getElementById('inspectorStateRegionTag');

    if (nameEl) nameEl.innerText = `Analyzing (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)…`;
    if (scoreEl) { scoreEl.innerText = '--'; scoreEl.style.color = '#94A3B8'; }
    if (verdictEl) { verdictEl.innerText = 'Evaluating Site & Spatial Context…'; verdictEl.style.color = '#94A3B8'; }
    if (statusDescEl) statusDescEl.innerText = 'Querying continuous demographic synthesis, national corridors, hazard models, and zoning rules...';
    if (summaryEl) summaryEl.innerText = 'Please wait while the AI spatial engine analyzes this parcel.';
    if (coordsEl) coordsEl.innerHTML = `<i class="fa-solid fa-crosshairs"></i> ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
    if (areaTag) areaTag.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Resolving Area…`;
    if (regionTag) regionTag.innerHTML = `<i class="fa-solid fa-landmark"></i> India`;

    const cells = ['detHighwayName', 'detHighwaySub', 'detTransitName', 'detTransitSub', 'detPopDensity', 'detPopDensitySub', 'detIncomeVal', 'detIncomeSub', 'detAQIVal', 'detAQISub', 'detSeismicVal', 'detSeismicSub', 'detFloodSub', 'detZoningVal', 'detZoningSub'];
    cells.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '…';
    });
}

/** Render Site Inspector Drawer Contents */
function renderSiteInspector(data) {
    const score = data.site_readiness_score;
    const sub = data.sub_scores;
    const ai = data.ai_explanation;
    const sm = data.spatial_metrics || {};
    const pp = data.place_profile || {};
    const isWater = pp.is_water_body || sm.population_density_sqkm === 0 || sm.state === 'Territorial Waters';

    const displayName = data.name || sm.place_name || `Coord (${data.latitude.toFixed(3)}°, ${data.longitude.toFixed(3)}°)`;
    document.getElementById('inspectorSiteName').innerText = displayName;

    // Area & Locality Tag
    const areaTag = document.getElementById('inspectorAreaTag');
    if (areaTag) {
        if (isWater) {
            areaTag.innerHTML = `<i class="fa-solid fa-water text-cyan"></i> Open Water Body`;
            areaTag.style.color = '#38BDF8';
            areaTag.style.borderColor = 'rgba(56,189,248,0.35)';
        } else {
            const locLabel = (pp.locality_type || sm.zoning_classification || 'Prime Site').split('(')[0].trim();
            areaTag.innerHTML = `<i class="fa-solid fa-location-dot text-cyan"></i> ${locLabel}`;
            areaTag.style.color = 'var(--text-secondary)';
            areaTag.style.borderColor = 'rgba(255,255,255,0.08)';
        }
    }

    // State & Region Tag
    const regionTag = document.getElementById('inspectorStateRegionTag');
    if (regionTag) {
        regionTag.innerHTML = `<i class="fa-solid fa-landmark"></i> ${sm.state || 'India'} (${sm.region || (isWater ? 'Maritime' : 'Nationwide')})`;
    }

    // Coordinates Tag
    const coordsEl = document.getElementById('inspectorCoordsDisplay');
    if (coordsEl) {
        coordsEl.innerHTML = `<i class="fa-solid fa-crosshairs"></i> ${data.latitude.toFixed(4)}°N, ${data.longitude.toFixed(4)}°E`;
    }

    // Readiness Score & Verdict
    const scoreElem = document.getElementById('inspectorScoreValue');
    const verdictEl = document.getElementById('inspectorVerdict');
    const statusDescEl = document.getElementById('inspectorScoreStatusDesc');

    if (scoreElem) {
        scoreElem.innerText = score.toFixed(1);
        let scoreColor = '#34D399';
        if (score < 50 || isWater) scoreColor = '#F43F5E';
        else if (score < 75) scoreColor = '#F59E0B';
        scoreElem.style.color = scoreColor;
    }

    if (verdictEl) {
        verdictEl.innerText = ai.verdict;
        let verdictColor = '#34D399';
        if (score < 50 || isWater) verdictColor = '#F43F5E';
        else if (score < 75) verdictColor = '#F59E0B';
        verdictEl.style.color = verdictColor;
    }

    if (statusDescEl) {
        if (isWater) {
            statusDescEl.innerText = 'This coordinate is located inside an active water body / ocean expanse. Zero population density and permanent water submergence make commercial site development prohibited.';
        } else {
            statusDescEl.innerText = ai.summary || 'Geospatial readiness evaluated across multimodal transport, demographics, hazard zones, and zoning.';
        }
    }

    // 1. Highway Connectivity
    const hwyNameEl = document.getElementById('detHighwayName');
    const hwySubEl  = document.getElementById('detHighwaySub');
    if (hwyNameEl) hwyNameEl.innerText = sm.nearest_highway_name || 'National Highway Corridor';
    if (hwySubEl)  hwySubEl.innerText  = `${sm.nearest_highway_km || '0.0'} km away · ${(sm.traffic_aadt || 0).toLocaleString()} AADT (Traffic Volume)`;

    // 2. Transit Access
    const transitNameEl = document.getElementById('detTransitName');
    const transitSubEl  = document.getElementById('detTransitSub');
    if (transitNameEl) transitNameEl.innerText = sm.transit_hub_name || 'Mass Transit Hub';
    if (transitSubEl)  transitSubEl.innerText  = `${sm.transit_hub_distance_km || '—'} km access`;

    // 3. Demographics (Strictly 0 in water areas!)
    const popDensityEl    = document.getElementById('detPopDensity');
    const popDensitySubEl = document.getElementById('detPopDensitySub');
    const incomeValEl     = document.getElementById('detIncomeVal');
    const incomeSubEl     = document.getElementById('detIncomeSub');

    if (isWater) {
        if (popDensityEl) {
            popDensityEl.innerText = '0 /km² (Uninhabited Water Body)';
            popDensityEl.style.color = '#F43F5E';
        }
        if (popDensitySubEl) popDensitySubEl.innerText = 'Aquatic water surface — zero resident population';
        if (incomeValEl) incomeValEl.innerText = '₹0 /yr (Uninhabited)';
        if (incomeSubEl) incomeSubEl.innerText = 'No resident income in open water bodies';
    } else {
        if (popDensityEl) {
            popDensityEl.innerText = `${(sm.population_density_sqkm || 0).toLocaleString()} /km²`;
            popDensityEl.style.color = '#38BDF8';
        }
        if (popDensitySubEl) {
            const dens = sm.population_density_sqkm || 0;
            popDensitySubEl.innerText = dens > 15000 ? 'Dense Metropolitan Core' : (dens > 5000 ? 'Urban & Suburban District' : 'Regional Economic Hinterland');
        }
        if (incomeValEl) incomeValEl.innerText = pp.median_income_display || `₹${Math.round((sm.median_income_inr || 75000)/1000)}k /yr`;
        if (incomeSubEl) incomeSubEl.innerText = 'Household purchasing power tier';
    }

    // 4. Environmental Hazards & AQI
    const aqiValEl    = document.getElementById('detAQIVal');
    const aqiSubEl    = document.getElementById('detAQISub');
    const seismicValEl= document.getElementById('detSeismicVal');
    const seismicSubEl= document.getElementById('detSeismicSub');
    const floodSubEl  = document.getElementById('detFloodSub');

    const aqiNum = sm.ambient_aqi || 75;
    if (aqiValEl) {
        aqiValEl.innerText = `AQI ${aqiNum}`;
        aqiValEl.style.color = aqiNum > 150 ? '#F97316' : (aqiNum > 100 ? '#F59E0B' : '#34D399');
    }
    if (aqiSubEl) aqiSubEl.innerText = pp.environmental?.aqi_category || (aqiNum > 150 ? 'Unhealthy' : aqiNum > 100 ? 'Moderate' : 'Good');

    if (seismicValEl) seismicValEl.innerText = sm.seismic_zone || 'Zone II';
    if (seismicSubEl) seismicSubEl.innerText = 'Seismic vulnerability index';

    if (floodSubEl) {
        if (isWater) {
            floodSubEl.innerText = '100% Submerged Aquatic Surface';
            floodSubEl.style.color = '#F43F5E';
        } else {
            const isFlood = (sm.flood_risk_level || '').toLowerCase().includes('high');
            floodSubEl.innerText = sm.flood_risk_level || 'Low Floodplain Risk';
            floodSubEl.style.color = isFlood ? '#F43F5E' : 'var(--text-primary)';
        }
    }

    // 5. Zoning & POIs
    const zoningValEl = document.getElementById('detZoningVal');
    const zoningSubEl = document.getElementById('detZoningSub');
    if (zoningValEl) {
        if (isWater) {
            zoningValEl.innerText = 'Non-Buildable Water Body (Prohibited)';
            zoningValEl.style.color = '#F43F5E';
        } else {
            zoningValEl.innerText = sm.zoning_classification || 'Commercial / Mixed Use';
            zoningValEl.style.color = 'var(--text-primary)';
        }
    }
    if (zoningSubEl) {
        if (isWater) {
            zoningSubEl.innerText = '0 competitors · 0 commercial anchors';
        } else {
            zoningSubEl.innerText = `${sm.competitor_count_2km || 0} competitors (2km) · ${sm.anchor_count_3km || 0} anchors (3km)`;
        }
    }

    // AI Summary
    document.getElementById('inspectorAISummary').innerText = ai.summary;

    updatePinButtonState();
    renderRadarChart('radarChart', sub);

    // Factor Bars
    const barsContainer = document.getElementById('inspectorFactorBars');
    const factorConfig = [
        { key: 'demographics',      name: 'Demographics Density',   color: '#A78BFA' },
        { key: 'transportation',     name: 'Highway Accessibility',  color: '#38BDF8' },
        { key: 'anchor_attraction',  name: 'Anchor Tenant Pull',     color: '#FCD34D' },
        { key: 'competitor_penalty', name: 'Market Low-Saturation',  color: '#FB7185' },
        { key: 'zoning_suitability', name: 'Zoning Suitability',     color: '#34D399' }
    ];

    barsContainer.innerHTML = factorConfig.map(fc => {
        const val = sub[fc.key] || 0;
        const ptsClass = val >= 60 ? 'positive' : (val >= 35 ? 'neutral' : 'negative');
        return `
        <div class="inspector-factor-item">
          <div class="inspector-factor-row">
            <span class="inspector-factor-name" style="color:${fc.color}">${fc.name}</span>
            <span class="inspector-factor-score ${ptsClass}">${val.toFixed(1)}</span>
          </div>
          <div class="fc-bar-track">
            <div class="fc-bar-fill" style="width:${val}%; background:linear-gradient(90deg, ${fc.color}88, ${fc.color})"></div>
          </div>
        </div>`;
    }).join('');

    // AI Drivers
    const posContainer = document.getElementById('inspectorPositiveDrivers');
    posContainer.innerHTML = (ai.positive_drivers || []).map(item =>
        `<li><strong>${item.factor}</strong> (${item.impact}): ${item.detail}</li>`
    ).join('') || `<li class="text-slate-500">No major positive drivers identified.</li>`;

    const penContainer = document.getElementById('inspectorPenaltyDrivers');
    penContainer.innerHTML = (ai.penalty_drivers || []).map(item =>
        `<li><strong>${item.factor}</strong> (${item.impact}): ${item.detail}</li>`
    ).join('') || `<li class="text-slate-500">No major constraints detected.</li>`;

    document.getElementById('routeResultBox').classList.add('hidden');
}


/** Update Pin Button visual state */
function updatePinButtonState() {
    const pinBtn = document.getElementById('inspectorPinBtn');
    if (!pinBtn || !currentInspectedSite) return;
    const isPinned = pinnedSites.some(s => s.latitude === currentInspectedSite.latitude && s.longitude === currentInspectedSite.longitude);
    if (isPinned) {
        pinBtn.className = "text-cyan-400 p-1.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60";
        pinBtn.title = "Remove from Compare Pinboard";
    } else {
        pinBtn.className = "text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-slate-800";
        pinBtn.title = "Pin to Compare Pinboard";
    }
}

/** Toggle Pinning of Current Inspected Site */
function togglePinCurrentSite() {
    if (!currentInspectedSite) return;
    const idx = pinnedSites.findIndex(s => s.latitude === currentInspectedSite.latitude && s.longitude === currentInspectedSite.longitude);
    if (idx >= 0) {
        pinnedSites.splice(idx, 1);
    } else {
        if (pinnedSites.length >= 4) {
            alert("Maximum 4 candidate sites can be compared simultaneously.");
            return;
        }
        pinnedSites.push(currentInspectedSite);
        if (typeof ProfileMenu !== 'undefined' && ProfileMenu.pinCurrentSite) {
            ProfileMenu.pinCurrentSite(
                currentInspectedSite.latitude,
                currentInspectedSite.longitude,
                currentInspectedSite.site_name || `Site (${currentInspectedSite.latitude.toFixed(2)}, ${currentInspectedSite.longitude.toFixed(2)})`,
                currentInspectedSite.overall_score || 0,
                currentPresetKey
            );
        }
    }
    updatePinButtonState();
    updateComparisonPinboardBar();
}

/** Update Floating Comparison Pinboard Bar */
function updateComparisonPinboardBar() {
    const bar = document.getElementById('compareFloatingBar');
    const badge = document.getElementById('compareCountBadge');
    if (pinnedSites.length > 0) {
        bar.classList.remove('hidden');
        badge.innerText = `${pinnedSites.length} / 4 Sites`;
    } else {
        bar.classList.add('hidden');
    }
}

function clearComparisonPinboard() {
    pinnedSites = [];
    updateComparisonPinboardBar();
    updatePinButtonState();
}

/** Open Multi-Site Comparison Modal */
async function openComparisonModal() {
    if (pinnedSites.length < 2) {
        alert("Please pin at least 2 candidate sites to compare head-to-head.");
        return;
    }

    const modal = document.getElementById('comparisonModal');
    modal.classList.remove('hidden');

    const decayType = getDecayTypeFromUI();
    const hardConstraints = getHardConstraintsFromUI();

    const compareRes = await API.compareSites(pinnedSites, currentPresetKey, decayType, hardConstraints);
    const aiComp = compareRes.ai_comparison || {};
    const sites = compareRes.compared_sites || [];

    // Populate AI Winner Verdict Banner
    document.getElementById('compareWinnerTitle').innerText = aiComp.verdict || "Comparison Complete";
    document.getElementById('compareNarrative').innerText = aiComp.narrative || "";
    document.getElementById('comparePresetBadge').innerText = presetsData[currentPresetKey]?.name || currentPresetKey;

    // Render Comparison Radar Chart
    renderComparisonRadarChart('compareRadarCanvas', sites);

    // Build Comparison Table HTML
    const table = document.getElementById('comparisonTable');
    let thead = `<tr class="border-b border-slate-800 text-slate-400 bg-slate-950/60">
        <th class="p-2.5">Metric</th>`;
    sites.forEach((s, i) => {
        thead += `<th class="p-2.5 font-bold text-white">${s.name || `Site ${i+1}`}</th>`;
    });
    thead += `</tr>`;

    const metrics = [
        { label: 'Readiness Score', key: 'score' },
        { label: 'Demographics Pull', key: 'demographics' },
        { label: 'Highway Access', key: 'transportation' },
        { label: 'Anchor Pull', key: 'anchor_attraction' },
        { label: 'Low Competitor Saturation', key: 'competitor_penalty' },
        { label: 'Zoning Suitability', key: 'zoning_suitability' },
        { label: 'Asking Price', key: 'asking_price' },
        { label: 'Parcel Area', key: 'area_acres' },
        { label: 'Flood Hazard', key: 'flood' }
    ];

    let tbody = '';
    metrics.forEach(m => {
        tbody += `<tr class="border-b border-slate-800/60 hover:bg-slate-800/30">
            <td class="p-2.5 font-semibold text-slate-300">${m.label}</td>`;
        sites.forEach(s => {
            let val = '--';
            if (m.key === 'score') {
                const sc = s.site_readiness_score || 0;
                val = `<strong class="${sc >= 75 ? 'text-emerald-400' : (sc >= 50 ? 'text-amber-400' : 'text-rose-400')}">${sc.toFixed(1)} / 100</strong>`;
            } else if (s.sub_scores && m.key in s.sub_scores) {
                val = `${s.sub_scores[m.key].toFixed(1)}`;
            } else if (m.key === 'asking_price') {
                val = s.asking_price ? `$${s.asking_price.toLocaleString()}` : 'Contact Broker';
            } else if (m.key === 'area_acres') {
                val = s.area_acres ? `${s.area_acres} Acres` : '--';
            } else if (m.key === 'flood') {
                val = s.is_ineligible ? `<span class="text-rose-400 font-bold">In Flood Zone</span>` : `<span class="text-emerald-400 font-medium">Clear</span>`;
            }
            tbody += `<td class="p-2.5">${val}</td>`;
        });
        tbody += `</tr>`;
    });

    table.innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`;
}

function closeComparisonModal() {
    document.getElementById('comparisonModal').classList.add('hidden');
}

/** Request Route to Nearest Highway or Anchor Hub */
async function requestRouteToHub(hubType) {
    if (!selectedCoordinate) return;

    routeLayerGroup.clearLayers();
    const resultBox = document.getElementById('routeResultBox');
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `<span class="text-blue-400 flex items-center gap-1.5"><i class="fa-solid fa-spinner fa-spin"></i> Calculating OSRM route to ${hubType}...</span>`;

    try {
        const routeData = await API.routeToHub(selectedCoordinate.lat, selectedCoordinate.lon, hubType);
        const feat = routeData.feature;

        const routeLayer = L.geoJSON(feat, {
            style: {
                color: hubType === 'highway' ? '#3B82F6' : '#F59E0B',
                weight: 4,
                opacity: 0.9,
                className: 'animated-route-path'
            }
        });
        routeLayerGroup.addLayer(routeLayer);
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        resultBox.innerHTML = `
            <div class="text-emerald-400 font-bold flex items-center justify-between">
                <span>Route to: ${routeData.destination.name}</span>
                <span class="text-[10px] text-slate-400">${routeData.provider}</span>
            </div>
            <div class="text-slate-300">Distance: <strong class="text-white">${routeData.distance_km} km</strong> | Estimated Driving Time: <strong class="text-cyan-400">${routeData.duration_minutes} mins</strong></div>
        `;
    } catch (err) {
        resultBox.innerHTML = `<span class="text-rose-400">Failed to calculate route: ${err.message}</span>`;
    }
}

/** Fetch and Render Uber H3 Hex Grid with Getis-Ord Gi* Hotspots */
async function fetchAndRenderH3Grid() {
    h3HexLayerGroup.clearLayers();
    const decayType = getDecayTypeFromUI();
    const hardConstraints = getHardConstraintsFromUI();

    currentH3GeoJSON = await API.getH3Grid(8, currentPresetKey, true, decayType, hardConstraints);

    // Update Hotspot summary in HUD
    if (currentH3GeoJSON.summary) {
        document.getElementById('kpiHotspotCount').innerText = currentH3GeoJSON.summary.hotspot_count || 0;
        document.getElementById('kpiUnderservedCount').innerText = currentH3GeoJSON.summary.underserved_count || 0;
        document.getElementById('kpiColdspotCount').innerText = currentH3GeoJSON.summary.coldspot_count || 0;
    }

    renderHexLayer(currentH3GeoJSON.features);
}

/** Render H3 Hexagons */
function renderHexLayer(features) {
    h3HexLayerGroup.clearLayers();

    const hexLayer = L.geoJSON({ type: 'FeatureCollection', features: features }, {
        style: (feature) => {
            const props = feature.properties || {};
            const zScore = props.gi_star_zscore || 0;
            const score = props.score || 0;

            let fillColor = '#334155';
            let fillOpacity = 0.2;

            if (props.is_ineligible) {
                fillColor = '#EF4444';
                fillOpacity = 0.45;
            } else if (props.is_underserved) {
                fillColor = '#A855F7'; // Purple Underserved
                fillOpacity = 0.6;
            } else if (zScore >= 1.65) {
                fillColor = '#10B981'; // Hot-Spot Green
                fillOpacity = 0.6;
            } else if (zScore <= -1.65) {
                fillColor = '#F43F5E'; // Cold-Spot Rose
                fillOpacity = 0.55;
            } else {
                fillColor = score >= 75 ? '#3B82F6' : '#64748B';
                fillOpacity = 0.25;
            }

            return {
                color: '#0F172A',
                weight: 1,
                fillColor: fillColor,
                fillOpacity: fillOpacity
            };
        },
        onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            const html = `
                <div class="p-2 text-xs space-y-1">
                    <div class="font-bold text-cyan-400 text-sm">H3 Hexagon Bin</div>
                    <div>Score: <strong class="text-white">${props.score}/100</strong></div>
                    <div>Getis-Ord Gi* Z: <strong class="${props.gi_star_zscore >= 1.65 ? 'text-emerald-400' : (props.gi_star_zscore <= -1.65 ? 'text-rose-400' : 'text-slate-200')}">${props.gi_star_zscore}</strong></div>
                    <div>Status: <span class="font-semibold text-white">${props.spot_type}</span></div>
                    ${props.is_underserved ? '<div class="text-purple-300 font-bold">★ Prime Underserved Demand Area</div>' : ''}
                </div>
            `;
            layer.bindTooltip(html, { sticky: true });
        }
    });

    h3HexLayerGroup.addLayer(hexLayer);
}

/** Filter H3 Hex Grid by Hotspots / Underserved / Coldspots */
function filterH3Grid(filterType) {
    if (!currentH3GeoJSON || !currentH3GeoJSON.features) return;

    let filtered = currentH3GeoJSON.features;
    if (filterType === 'hotspots') {
        filtered = currentH3GeoJSON.features.filter(f => f.properties.is_hotspot);
    } else if (filterType === 'underserved') {
        filtered = currentH3GeoJSON.features.filter(f => f.properties.is_underserved);
    } else if (filterType === 'coldspots') {
        filtered = currentH3GeoJSON.features.filter(f => f.properties.is_coldspot);
    }

    renderHexLayer(filtered);
}

/** Fetch and Render Catchment Isochrones */
async function fetchAndRenderIsochrones(lat, lon) {
    isochroneLayerGroup.clearLayers();
    const isoData = await API.getIsochrone(lat, lon, currentIsochroneMode, [10, 20, 30]);

    const isoLayer = L.geoJSON(isoData.feature_collection, {
        style: (feature) => {
            const mins = feature.properties.time_minutes;
            const colors = { 10: '#3B82F6', 20: '#8B5CF6', 30: '#EC4899' };
            return {
                color: colors[mins] || '#3B82F6',
                weight: 2,
                fillColor: colors[mins] || '#3B82F6',
                fillOpacity: 0.15,
                dashArray: '3, 3'
            };
        }
    });

    isochroneLayerGroup.addLayer(isoLayer);

    // Update Sidebar Metrics Table with rich catchment comparison visualizer
    const container = document.getElementById('isochroneMetricsContainer');
    if (!container) return;

    const catchments = isoData.catchments || [];
    const maxPop = Math.max(...catchments.map(c => c.reachable_population || 1), 1);

    let html = `
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); display:flex; align-items:center; justify-content:space-between;">
                <span><i class="fa-solid fa-users-viewfinder" style="color:var(--cyan); margin-right:4px;"></i> Reachable Population Comparison</span>
                <span style="color:var(--cyan);">${catchments.length} Intervals</span>
            </div>
    `;

    for (const c of catchments) {
        const pct = Math.min(100, Math.max(12, Math.round((c.reachable_population / maxPop) * 100)));
        const color = c.time_minutes <= 10 ? '#3B82F6' : (c.time_minutes <= 20 ? '#8B5CF6' : '#EC4899');
        const poiTotal = c.poi_counts?.total || 0;
        const compCount = c.poi_counts?.competitors || 0;
        const anchorCount = c.poi_counts?.anchor_tenants || 0;

        html += `
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:var(--radius-md); padding:10px 12px; transition:var(--transition);">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:12px; font-weight:700; color:${color}; display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-stopwatch"></i> ${c.time_minutes} Min ${c.mode_label}
                    </span>
                    <span style="font-size:12px; font-weight:800; color:white;">
                        ${c.reachable_population.toLocaleString()} <span style="font-size:10px; font-weight:400; color:var(--text-muted);">pop</span>
                    </span>
                </div>
                <div style="width:100%; height:6px; background:rgba(255,255,255,0.08); border-radius:99px; overflow:hidden; margin-bottom:8px;">
                    <div style="width:${pct}%; height:100%; background:${color}; border-radius:99px; transition:width 0.6s ease;"></div>
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:10.5px; color:var(--text-muted);">
                    <span>Radius: <strong style="color:var(--text-secondary);">${c.max_radius_km} km</strong></span>
                    <span>Median Inc: <strong style="color:var(--emerald);">₹${(c.median_income * 0.85).toLocaleString(undefined, {maximumFractionDigits:0})}</strong></span>
                </div>
                <div style="display:flex; gap:10px; margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.05); font-size:10px; color:var(--text-muted);">
                    <span>Anchors: <strong style="color:var(--amber);">${anchorCount}</strong></span>
                    <span>·</span>
                    <span>Competitors: <strong style="color:var(--rose);">${compCount}</strong></span>
                    <span>·</span>
                    <span>Total POIs: <strong style="color:var(--cyan);">${poiTotal}</strong></span>
                </div>
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}

/** AI Quick Query Trigger */
function runQuickQuery(text) {
    document.getElementById('aiQueryInput').value = text;
    handleAIQuery();
}

/** AI Natural Language Search Query Handler */
async function handleAIQuery() {
    const input = document.getElementById('aiQueryInput').value.trim();
    if (!input) return;

    const res = await API.aiQuery(input, currentPresetKey, 5);
    const recs = res.recommendations || [];

    if (recs.length === 0) {
        alert("No candidate sites matched your search query criteria.");
        return;
    }

    // Highlight top candidate match on map
    const topSite = recs[0];
    map.flyTo([topSite.latitude, topSite.longitude], 14, { animate: true });
    inspectCoordinate(topSite.latitude, topSite.longitude, topSite.name);
}

/** Layer Control Toggle Visibility */
function toggleLayerVisibility(layerKey) {
    const layer = mapLayers[layerKey];
    const isChecked = document.getElementById(`layer-${layerKey}`).checked;
    if (layer) {
        if (isChecked) map.addLayer(layer);
        else map.removeLayer(layer);
    }
}

/** Change Layer Opacity */
function changeLayerOpacity(layerKey, opacityVal) {
    const layer = mapLayers[layerKey];
    if (layer && layer.setStyle) {
        layer.setStyle({ fillOpacity: parseFloat(opacityVal) });
    }
}

/** Change Preset Profile */
function changePresetProfile() {
    currentPresetKey = document.getElementById('presetSelector').value;
    const preset = presetsData[currentPresetKey];
    if (preset) {
        if (preset.weights) {
            for (const [k, v] of Object.entries(preset.weights)) {
                const slider = document.getElementById(`weight-${k}`);
                if (slider) {
                    slider.value = v;
                    document.getElementById(`val-${k}`).innerText = `${v}%`;
                }
            }
        }
        if (preset.decay_type) {
            const decaySel = document.getElementById('decayFunctionSelector');
            if (decaySel) decaySel.value = preset.decay_type;
        }
    }
    updateTopKPIHUD();
    recalculateGridScores();
}

/** Update Weight Display */
function updateWeightDisplay(key, val) {
    document.getElementById(`val-${key}`).innerText = `${val}%`;
}

/** Get Custom Weights from Slider UI */
function getCustomWeightsFromUI() {
    return {
        demographics: parseFloat(document.getElementById('weight-demographics').value),
        transportation: parseFloat(document.getElementById('weight-transportation').value),
        anchor_attraction: parseFloat(document.getElementById('weight-anchor_attraction').value),
        competitor_penalty: parseFloat(document.getElementById('weight-competitor_penalty').value),
        zoning_suitability: parseFloat(document.getElementById('weight-zoning_suitability').value)
    };
}

/** Recalculate Scoring & Refresh Maps */
async function recalculateGridScores() {
    await fetchAndRenderH3Grid();
    if (selectedCoordinate) {
        inspectCoordinate(selectedCoordinate.lat, selectedCoordinate.lon);
    }
    await updateTopKPIHUD();
}

/** Isochrone Travel Mode Toggle */
function setIsochroneMode(mode) {
    currentIsochroneMode = mode;
    document.getElementById('mode-drive').className = mode === 'drive' 
        ? 'px-3 py-1 rounded-md text-xs bg-blue-600 text-white font-semibold' 
        : 'px-3 py-1 rounded-md text-xs text-slate-400 hover:text-white';
    document.getElementById('mode-walk').className = mode === 'walk' 
        ? 'px-3 py-1 rounded-md text-xs bg-blue-600 text-white font-semibold' 
        : 'px-3 py-1 rounded-md text-xs text-slate-400 hover:text-white';

    if (selectedCoordinate) {
        fetchAndRenderIsochrones(selectedCoordinate.lat, selectedCoordinate.lon);
    }
}

/** Sidebar Tab Navigation */
function switchTab(tabKey) {
    const allTabs = ['readiness', 'layers', 'weights', 'analysis', 'isochrone'];
    allTabs.forEach(k => {
        const panelEl = document.getElementById(`panel-${k}`);
        const btnEl   = document.getElementById(`tab-${k}`);
        if (panelEl) panelEl.classList.remove('active');
        if (btnEl)   btnEl.classList.remove('active');
    });
    const activePanel = document.getElementById(`panel-${tabKey}`);
    const activeBtn   = document.getElementById(`tab-${tabKey}`);
    if (activePanel) activePanel.classList.add('active');
    if (activeBtn)   activeBtn.classList.add('active');
}

/** Custom Polygon Draw Tool Trigger */
function activatePolygonDrawTool() {
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: true,
            polyline: false,
            rectangle: true,
            circle: false,
            marker: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);
    alert("Draw tool active: Click points on map to draw search polygon. Double click to finish polygon.");

    map.once(L.Draw.Event.CREATED, async (e) => {
        const layer = e.layer;
        if (activePolygonDrawLayer) map.removeLayer(activePolygonDrawLayer);
        activePolygonDrawLayer = layer;
        layer.addTo(map);

        const latlngs = layer.getLatLngs()[0];
        const coords = latlngs.map(pt => [pt.lng, pt.lat]);
        coords.push(coords[0]); // close polygon loop

        const res = await API.polygonSearch(coords, currentPresetKey, getCustomWeightsFromUI(), getDecayTypeFromUI(), getHardConstraintsFromUI());
        alert(`Polygon Search Complete! Found and ranked ${res.total_found} candidate development parcels inside the boundary.`);
        if (res.results.length > 0) {
            const top = res.results[0];
            inspectCoordinate(top.latitude, top.longitude, top.name);
        }
    });
}

/** Drawer Control Helpers */
function openSiteInspector() {
    document.getElementById('siteInspectorDrawer').classList.remove('translate-x-full');
}
function closeSiteInspector() {
    document.getElementById('siteInspectorDrawer').classList.add('translate-x-full');
}
function openUploadModal() {
    document.getElementById('uploadModal').classList.remove('hidden');
}
function closeUploadModal() {
    document.getElementById('uploadModal').classList.add('hidden');
}

/** Layer Upload Submission */
async function handleLayerUpload(event) {
    event.preventDefault();
    const name = document.getElementById('uploadLayerName').value;
    const file = document.getElementById('uploadLayerFile').files[0];
    if (!name || !file) return;

    try {
        const res = await API.uploadLayer(name, file);
        alert(res.message);
        closeUploadModal();
        await loadPresetsAndLayers();
    } catch (err) {
        alert("Upload failed: " + err.message);
    }
}

/** Download PDF Executive Report */
function downloadPDFReport() {
    if (selectedCoordinate) {
        API.downloadPDF(
            selectedCoordinate.lat,
            selectedCoordinate.lon,
            currentPresetKey,
            getCustomWeightsFromUI(),
            getHardConstraintsFromUI(),
            getDecayTypeFromUI()
        );
    }
}

/** Export Evaluated Candidate Sites CSV or GeoJSON */
function exportData(formatType) {
    if (API && API._hasBackend) {
        window.location.href = `/api/export-data?format_type=${formatType}&preset_key=${currentPresetKey}`;
        return;
    }

    // Client-side export for GitHub Pages and offline execution
    const ds = window.GEOSITE_DATASETS || (window.ClientSpatialEngine ? window.ClientSpatialEngine.getDatasets() : null);
    const cands = ds?.candidate_sites?.features || [];

    if (formatType === 'geojson') {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ds?.candidate_sites || {}, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `geosite_candidates_${currentPresetKey}.geojson`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    } else {
        // CSV export
        let csv = "Name,Latitude,Longitude,Readiness_Score,Zoning,Area_Acres,Asking_Price_INR\n";
        cands.forEach(c => {
            const p = c.properties || {};
            const pt = c.geometry?.coordinates || [0, 0];
            csv += `"${p.name || 'Candidate Site'}",${pt[1]},${pt[0]},${p.site_readiness_score || 80},"${p.zoning_classification || 'Commercial'}",${p.area_acres || 2.0},${p.asking_price || 15000000}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `geosite_candidates_${currentPresetKey}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

