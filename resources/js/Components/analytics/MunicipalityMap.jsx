import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import boundaries from "@/data/aklanMunicipalities.geo.json";

/**
 * Choropleth of TB cases per municipality, drawn from the real municipality
 * boundaries in `aklanMunicipalities.geo.json` (PSA administrative outlines,
 * trimmed to the 15 municipalities the programme covers).
 *
 * Privacy: this component only ever receives the aggregated per-municipality
 * counts produced by `App\Support\TbAnalytics`. No patient row, name, address,
 * or contact number reaches it.
 *
 * No tile layer is attached — the polygons are the map, so the dashboard makes
 * no third-party requests and works offline.
 */

/** Light → dark as case counts rise. Index 0 is "no recorded cases". */
export const CHOROPLETH_STEPS = [
    "#f7ecec",
    "#f3cfcb",
    "#e9a79f",
    "#dc7b70",
    "#cc5244",
    "#a93226",
];

/**
 * Buckets counts into the colour scale. The breaks are derived from the
 * highest count in the current dataset rather than fixed, so the scale still
 * separates municipalities when the numbers are small.
 */
export function makeScale(maxCases) {
    const max = Math.max(maxCases, 1);
    const breaks = [1, 2, 3, 4, 5].map((step) =>
        Math.max(step, Math.ceil((max * step) / 5)),
    );

    return {
        breaks,
        colorFor(cases) {
            if (!cases) return CHOROPLETH_STEPS[0];

            const index = breaks.findIndex((limit) => cases <= limit);

            return CHOROPLETH_STEPS[index === -1 ? CHOROPLETH_STEPS.length - 1 : index];
        },
    };
}

export default function MunicipalityMap({ data, selected, onSelect }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const layerRef = useRef(null);
    // Read inside Leaflet event handlers, which are bound once per data change.
    const selectedRef = useRef(selected);
    const onSelectRef = useRef(onSelect);
    selectedRef.current = selected;
    onSelectRef.current = onSelect;

    const casesByMunicipality = useMemo(
        () =>
            Object.fromEntries(
                data.map((entry) => [entry.municipality, entry.tb_cases]),
            ),
        [data],
    );

    const scale = useMemo(
        () => makeScale(Math.max(0, ...data.map((entry) => entry.tb_cases))),
        [data],
    );

    // Create the map once.
    useEffect(() => {
        if (mapRef.current || !containerRef.current) return undefined;

        const map = L.map(containerRef.current, {
            attributionControl: false,
            zoomControl: true,
            scrollWheelZoom: false,
            dragging: true,
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            layerRef.current = null;
        };
    }, []);

    // Redraw the polygons whenever the counts change.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (layerRef.current) {
            layerRef.current.remove();
        }

        const layer = L.geoJSON(boundaries, {
            style: (feature) => {
                const name = feature.properties.municipality;

                return {
                    fillColor: scale.colorFor(casesByMunicipality[name] ?? 0),
                    fillOpacity: 0.9,
                    color: selectedRef.current === name ? "#1a1a1a" : "#ffffff",
                    weight: selectedRef.current === name ? 2.5 : 1,
                };
            },
            onEachFeature: (feature, featureLayer) => {
                const name = feature.properties.municipality;
                const cases = casesByMunicipality[name] ?? 0;

                featureLayer.bindTooltip(
                    `<strong>${name}</strong><br>${feature.properties.province}<br>${cases} TB ${cases === 1 ? "case" : "cases"}`,
                    { sticky: true, direction: "top", className: "carelink-map-tip" },
                );

                featureLayer.on({
                    click: () =>
                        onSelectRef.current?.(
                            selectedRef.current === name ? null : name,
                        ),
                    mouseover: () => featureLayer.setStyle({ weight: 2.5 }),
                    mouseout: () =>
                        featureLayer.setStyle({
                            weight: selectedRef.current === name ? 2.5 : 1,
                        }),
                });
            },
        }).addTo(map);

        layerRef.current = layer;
        map.fitBounds(layer.getBounds(), { padding: [10, 10] });
        // Guard against the card being laid out after the map initialises.
        window.setTimeout(() => map.invalidateSize(), 0);
    }, [casesByMunicipality, scale]);

    // Restyle on selection without rebuilding the layer.
    useEffect(() => {
        layerRef.current?.eachLayer((featureLayer) => {
            const name = featureLayer.feature.properties.municipality;
            featureLayer.setStyle({
                color: selected === name ? "#1a1a1a" : "#ffffff",
                weight: selected === name ? 2.5 : 1,
            });
        });
    }, [selected]);

    return (
        <div className="flex h-full flex-col gap-2">
            <div
                ref={containerRef}
                role="img"
                aria-label="TB cases by municipality"
                className="min-h-[260px] flex-1 overflow-hidden rounded-lg border border-line-soft bg-shell [&_.leaflet-container]:bg-shell"
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px] text-muted">
                <span className="font-semibold">TB cases</span>
                {CHOROPLETH_STEPS.map((color, index) => (
                    <span key={color} className="flex items-center gap-1">
                        <span
                            className="size-3 rounded-sm border border-white/70"
                            style={{ background: color }}
                            aria-hidden="true"
                        />
                        {index === 0
                            ? "0"
                            : index === CHOROPLETH_STEPS.length - 1
                              ? `${scale.breaks[index - 2] + 1}+`
                              : `≤${scale.breaks[index - 1]}`}
                    </span>
                ))}
            </div>
        </div>
    );
}
