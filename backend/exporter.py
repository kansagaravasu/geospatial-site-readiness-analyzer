import os
import io
import json
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class ReportExporter:
    """Generates PDF Reports and Data Export formats (GeoJSON, CSV)."""

    @staticmethod
    def generate_site_pdf_bytes(site_data, explanation):
        """Generates PDF assessment report bytes for a site evaluation."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Heading1'],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#1E293B'),
            spaceAfter=10
        )
        subtitle_style = ParagraphStyle(
            'DocSubtitle',
            parent=styles['Normal'],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor('#64748B'),
            spaceAfter=15
        )
        heading2_style = ParagraphStyle(
            'DocHeading2',
            parent=styles['Heading2'],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor('#0F172A'),
            spaceBefore=12,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            'DocBody',
            parent=styles['Normal'],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#334155')
        )
        
        story = []
        
        # Header Title
        story.append(Paragraph("GeoSpatial Site Readiness Assessment Report", title_style))
        site_name = site_data.get("name", f"Site ({site_data['latitude']:.4f}, {site_data['longitude']:.4f})")
        story.append(Paragraph(f"<b>Target Site:</b> {site_name} | <b>Preset:</b> {site_data.get('preset_name', 'EV Charging')}", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#3B82F6'), spaceAfter=15))
        
        # Overall Score Banner Table
        score = site_data["site_readiness_score"]
        verdict = explanation["verdict"]
        score_color = colors.HexColor('#22C55E') if score >= 75 else (colors.HexColor('#F59E0B') if score >= 50 else colors.HexColor('#EF4444'))
        
        score_data = [
            [
                Paragraph(f"<font size=28 color='{score_color.hexval()}'><b>{score}/100</b></font><br/><b>Readiness Score</b>", body_style),
                Paragraph(f"<b>Verdict:</b> {verdict}<br/>{explanation['summary']}", body_style)
            ]
        ]
        score_table = Table(score_data, colWidths=[150, 390])
        score_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('PADDING', (0,0), (-1,-1), 10),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LINEBELOW', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1'))
        ]))
        story.append(score_table)
        story.append(Spacer(1, 15))
        
        # Factor Breakdown Table
        story.append(Paragraph("Sub-Factor Scoring Breakdown", heading2_style))
        sub = site_data["sub_scores"]
        weights = site_data.get("weights", {})
        
        table_data = [["Factor Name", "Weight", "Sub-Score (0-100)", "Weighted Impact"]]
        for key, name in [
            ("demographics", "Demographics & Purchasing Power"),
            ("transportation", "Transportation & Road Access"),
            ("anchor_attraction", "Anchor Tenant Pull"),
            ("competitor_penalty", "Competitor Market Saturation"),
            ("zoning_suitability", "Zoning & Land Use Suitability")
        ]:
            val = sub.get(key, 0)
            w = weights.get(key, 20)
            impact = f"{val * (w / 100.0):.1f} pts"
            table_data.append([name, f"{w}%", f"{val:.1f}", impact])
            
        breakdown_table = Table(table_data, colWidths=[220, 80, 120, 120])
        breakdown_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('PADDING', (0,0), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(breakdown_table)
        story.append(Spacer(1, 15))
        
        # Key Drivers & Penalties
        story.append(Paragraph("AI Diagnostic Insights", heading2_style))
        pos_list = explanation.get("positive_drivers", [])
        if pos_list:
            story.append(Paragraph("<b>Positive Score Drivers:</b>", body_style))
            for item in pos_list:
                story.append(Paragraph(f"• <b>{item['factor']}</b> ({item['impact']}): {item['detail']}", body_style))
            story.append(Spacer(1, 6))
            
        pen_list = explanation.get("penalty_drivers", [])
        if pen_list:
            story.append(Paragraph("<b>Risk & Penalty Drivers:</b>", body_style))
            for item in pen_list:
                story.append(Paragraph(f"• <b>{item['factor']}</b> ({item['impact']}): {item['detail']}", body_style))
            story.append(Spacer(1, 6))

        story.append(Spacer(1, 10))
        story.append(Paragraph(f"<b>Actionable Recommendation:</b> {explanation['actionable_advice']}", body_style))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def export_candidate_evaluations_geojson(evaluations):
        """Converts list of site evaluations into downloadable GeoJSON FeatureCollection."""
        features = []
        for item in evaluations:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [item["longitude"], item["latitude"]]
                },
                "properties": item
            })
        return json.dumps({"type": "FeatureCollection", "features": features}, indent=2)

    @staticmethod
    def export_candidate_evaluations_csv(evaluations):
        """Converts list of site evaluations into downloadable CSV bytes."""
        rows = []
        for item in evaluations:
            row = {
                "site_id": item.get("site_id", ""),
                "name": item.get("name", ""),
                "latitude": item["latitude"],
                "longitude": item["longitude"],
                "site_readiness_score": item["site_readiness_score"],
                "verdict": item.get("verdict", ""),
                "demographics_score": item["sub_scores"]["demographics"],
                "transportation_score": item["sub_scores"]["transportation"],
                "anchor_score": item["sub_scores"]["anchor_attraction"],
                "competitor_score": item["sub_scores"]["competitor_penalty"],
                "zoning_score": item["sub_scores"]["zoning_suitability"],
                "is_ineligible": item.get("is_ineligible", False),
                "exclusion_reason": item.get("exclusion_reason", "")
            }
            rows.append(row)
        df = pd.DataFrame(rows)
        buffer = io.StringIO()
        df.to_csv(buffer, index=False)
        return buffer.getvalue()
