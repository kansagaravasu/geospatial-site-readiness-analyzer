import re

class AISiteExplainer:
    """Generates AI Factor Explanations and Natural Language Site Recommendations."""

    @staticmethod
    def explain_scoring_result(scoring_dict):
        """
        Generates structured natural language explanation of positive drivers,
        penalties, risk alerts, and overall recommendation.
        """
        score = scoring_dict["site_readiness_score"]
        preset_name = scoring_dict.get("preset_name", "Site")
        sub_scores = scoring_dict["sub_scores"]
        metrics = scoring_dict.get("spatial_metrics", {})
        is_ineligible = scoring_dict.get("is_ineligible", False)
        exclusion_reason = scoring_dict.get("exclusion_reason")

        # Extract localized place metadata
        place_name = metrics.get("place_name", "Candidate Site")
        state_name = metrics.get("state", "India")
        dist_hwy = metrics.get("nearest_highway_km", 1.0)
        hwy_name = metrics.get("nearest_highway_name", "National Highway Corridor")
        transit_name = metrics.get("transit_hub_name", "Transit Hub")
        transit_dist = metrics.get("transit_hub_distance_km", 2.0)
        pop_dens = metrics.get("population_density_sqkm", 5000)
        zoning = metrics.get("zoning_classification", "Commercial")
        seismic = metrics.get("seismic_zone", "Zone II")
        aqi_val = metrics.get("ambient_aqi", 75)


        if is_ineligible:
            if pop_dens == 0 or "Water" in place_name or "Ocean" in place_name or "Sea" in place_name or "Submerged" in str(exclusion_reason):
                return {
                    "verdict": "DISQUALIFIED - WATER BODY / AQUATIC ZONE",
                    "summary": f"{place_name} is situated in an open water body / marine zone. Population density is strictly 0 persons/km², the surface is 100% submerged, and commercial site construction is prohibited under environmental & CRZ protection regulations.",
                    "positive_drivers": [],
                    "penalty_drivers": [
                        {"factor": "Zero Population Density", "impact": "0 pts", "detail": "Population density is 0 /km² across water bodies."},
                        {"factor": "Permanent Submergence", "impact": "Disqualified (-100 pts)", "detail": "Submerged aquatic environment with zero ground buildability."},
                        {"factor": "Environmental / CRZ Protection", "impact": "Strict Exclusion", "detail": "Development is barred by Coastal Regulation Zone and wetland protection acts."}
                    ],
                    "actionable_advice": f"Select an inland or onshore terrestrial parcel on dry ground outside water bodies and marine expanses."
                }
            return {
                "verdict": "CRITICAL RISK - INELIGIBLE SITE",
                "summary": f"{place_name} ({state_name}) is disqualified with a score of 0/100 due to severe spatial constraints: {exclusion_reason}.",
                "positive_drivers": [],
                "penalty_drivers": [
                    {"factor": "Exclusion Constraint", "impact": "Disqualified (-100 pts)", "detail": exclusion_reason}
                ],
                "actionable_advice": f"Do not proceed with site acquisition at {place_name}. Search adjacent parcels outside hazard zones."
            }


        positive_drivers = []
        penalty_drivers = []

        # Analyze Demographics
        demo = sub_scores["demographics"]
        if demo >= 70:
            positive_drivers.append({
                "factor": "Dense Demographic Catchment",
                "impact": f"+{demo:.0f} pts",
                "detail": f"High demographic density (~{pop_dens:,} people/km²) in {place_name} providing high local consumer capture."
            })
        elif demo < 40:
            penalty_drivers.append({
                "factor": "Sparse Demographics",
                "impact": f"{demo:.0f} pts",
                "detail": f"Lower population density (~{pop_dens:,} people/km²) requires attracting vehicular/transit-based traffic."
            })

        # Analyze Transportation
        trans = sub_scores["transportation"]
        if trans >= 70:
            positive_drivers.append({
                "factor": "Prime Arterial Access",
                "impact": f"+{trans:.0f} pts",
                "detail": f"Direct strategic link to {hwy_name} ({dist_hwy} km) and {transit_name} ({transit_dist} km)."
            })
        elif trans < 40:
            penalty_drivers.append({
                "factor": "Peripheral Transit Distance",
                "impact": f"{trans:.0f} pts",
                "detail": f"Nearest highway {hwy_name} is {dist_hwy} km away, requiring last-mile access connectivity."
            })

        # Analyze Anchor Pull
        anchor = sub_scores["anchor_attraction"]
        anchor_cnt = metrics["anchor_count_3km"]
        if anchor >= 55:
            positive_drivers.append({
                "factor": "Commercial Anchor Proximity",
                "impact": f"+{anchor:.0f} pts",
                "detail": f"Surrounded by {anchor_cnt} major commercial anchors, retail magnets, or industrial logistics nodes."
            })

        # Analyze Competitors
        comp = sub_scores["competitor_penalty"]
        comp_cnt = metrics["competitor_count_2km"]
        if comp >= 75:
            positive_drivers.append({
                "factor": "High Market Opportunity (Low Competition)",
                "impact": f"+{comp:.0f} pts",
                "detail": f"Unsaturated territory with only {comp_cnt} competitor(s) within 2 km, prime for market capture."
            })
        elif comp < 50:
            penalty_drivers.append({
                "factor": "Competitive Saturation",
                "impact": f"{comp:.0f} pts",
                "detail": f"Established cluster of {comp_cnt} competing operators within 2 km."
            })

        # Determine Verdict & Local Summary
        if score >= 80:
            verdict = "EXCELLENT SITE READINESS"
            summary = f"{place_name} ({state_name}) scores {score}/100 for {preset_name}. Located {dist_hwy} km from {hwy_name} with ~{pop_dens:,} pop/km² in a compliant {zoning} zone. Clean baseline (AQI {aqi_val}, {seismic.split('(')[0].strip()})."
            advice = f"Highly recommended site in {place_name}. Rapidly initiate leaseholder discussions and grid/zoning permits."
        elif score >= 60:
            verdict = "MODERATE TO HIGH POTENTIAL"
            summary = f"{place_name} ({state_name}) scores {score}/100 for {preset_name}. Viable location {dist_hwy} km from {hwy_name} with solid demand pull and manageable trade-offs."
            advice = f"Feasible site candidate in {state_name}. Consider road access signages or incentives to counter competitive/transit factors."
        else:
            verdict = "MARGINAL / DEVELOPMENTAL SITE"
            summary = f"{place_name} ({state_name}) scores {score}/100 for {preset_name}. Substantial constraints in highway proximity ({dist_hwy} km to {hwy_name}) or low demographic density (~{pop_dens:,}/km²)."
            advice = f"Keep {place_name} on watchlist for future corridor expansion or seek alternatives closer to active interchanges."

        return {
            "verdict": verdict,
            "summary": summary,
            "positive_drivers": positive_drivers,
            "penalty_drivers": penalty_drivers,
            "actionable_advice": advice
        }

    @classmethod
    def query_recommendations(cls, query_text, candidate_evaluations, top_n=5):
        """
        Parses natural language search queries to filter and rank candidate sites.
        """
        query_lower = query_text.lower()
        
        # Check criteria keywords
        require_low_competitors = "competitor" in query_lower or "unsaturated" in query_lower
        require_high_traffic = "traffic" in query_lower or "highway" in query_lower or "access" in query_lower
        require_high_income = "income" in query_lower or "wealthy" in query_lower
        require_high_score = "top" in query_lower or "best" in query_lower or "highest" in query_lower

        filtered = []
        for site in candidate_evaluations:
            if site.get("is_ineligible"):
                continue
                
            score = site["site_readiness_score"]
            sub = site["sub_scores"]
            metrics = site["spatial_metrics"]
            
            match_score = score
            
            if require_low_competitors and sub["competitor_penalty"] >= 75:
                match_score += 15
            if require_high_traffic and sub["transportation"] >= 70:
                match_score += 15
            if require_high_income and sub["demographics"] >= 70:
                match_score += 15
                
            site_copy = dict(site)
            site_copy["query_match_score"] = round(match_score, 1)
            filtered.append(site_copy)
            
        ranked = sorted(filtered, key=lambda x: x["query_match_score"], reverse=True)[:top_n]
        
        return {
            "query": query_text,
            "total_matches": len(filtered),
            "recommendations": ranked
        }

    @classmethod
    def explain_site_comparison(cls, compared_sites):
        """
        Generates comparative AI head-to-head analysis between 2 to 4 candidate sites.
        Highlights trade-offs, strengths, weaknesses, and a decisive recommendation.
        """
        if not compared_sites:
            return {"verdict": "No sites to compare", "summary": "", "rankings": []}

        # Sort sites descending by readiness score
        sorted_sites = sorted(compared_sites, key=lambda s: s.get("site_readiness_score", 0), reverse=True)
        top_site = sorted_sites[0]
        top_name = top_site.get("name", "Top Site")
        top_score = top_site.get("site_readiness_score", 0)

        # Find category leaders
        categories = {
            "demographics": "Demographic Pull",
            "transportation": "Highway Access",
            "anchor_attraction": "Anchor Pull",
            "competitor_penalty": "Market Low-Saturation",
            "zoning_suitability": "Zoning Alignment"
        }
        leaders = {}
        for cat_key, cat_label in categories.items():
            best = max(compared_sites, key=lambda s: s.get("sub_scores", {}).get(cat_key, 0))
            best_val = best.get("sub_scores", {}).get(cat_key, 0)
            leaders[cat_label] = f"{best.get('name', 'Site')} ({best_val:.1f}/100)"

        site_summaries = []
        for rank, site in enumerate(sorted_sites, start=1):
            s_name = site.get("name", f"Site {rank}")
            s_score = site.get("site_readiness_score", 0)
            s_sub = site.get("sub_scores", {})
            ineligible = site.get("is_ineligible", False)

            # Find top strength and top vulnerability
            sorted_factors = sorted(s_sub.items(), key=lambda x: x[1], reverse=True)
            top_strength = categories.get(sorted_factors[0][0], sorted_factors[0][0]) if sorted_factors else "General"
            top_weakness = categories.get(sorted_factors[-1][0], sorted_factors[-1][0]) if sorted_factors else "General"

            site_summaries.append({
                "rank": rank,
                "name": s_name,
                "score": s_score,
                "is_winner": (rank == 1 and not ineligible),
                "is_ineligible": ineligible,
                "key_advantage": f"Highest strength in {top_strength} ({sorted_factors[0][1]:.1f})",
                "key_tradeoff": f"Lower score in {top_weakness} ({sorted_factors[-1][1]:.1f})" if not ineligible else site.get("exclusion_reason", "Disqualified")
            })

        if top_site.get("is_ineligible"):
            verdict = "ALL COMPARED SITES CONTAIN CRITICAL CONSTRAINTS"
            narrative = "The evaluated sites present severe environmental flood risks or regulatory constraints under hard threshold rules."
        else:
            verdict = f"RECOMMENDED CANDIDATE: {top_name} ({top_score}/100)"
            runner_up_str = f" surpassing {sorted_sites[1].get('name', 'Runner-up')} by {top_score - sorted_sites[1].get('site_readiness_score', 0):.1f} points" if len(sorted_sites) > 1 else ""
            narrative = f"{top_name} leads the comparative evaluation with an overall score of {top_score}/100{runner_up_str}. It provides the most balanced combination of demographic purchasing power, highway accessibility, and manageable competitor density."

        return {
            "verdict": verdict,
            "narrative": narrative,
            "top_site_name": top_name,
            "top_site_score": top_score,
            "category_leaders": leaders,
            "site_summaries": site_summaries
        }
