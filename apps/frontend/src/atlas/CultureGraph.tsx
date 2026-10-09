import { CARD_TYPES, type CultureGraph as Graph } from '@atlas/shared';
import { type KeyboardEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { CARD_TYPE_COLORS } from './card-type-colors.ts';
import { useCultureGraph } from './content-api.ts';

// SVG geometry: nodes on a circle, labels outside it. Small graphs (~15 nodes) read well this
// way without a layout library.
const WIDTH = 660;
const HEIGHT = 440;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const RADIUS = 150;
const NODE_RADIUS = 13;
const LABEL_GAP = 20;
const MAX_LABEL = 24;

function shorten(title: string): string {
  return title.length > MAX_LABEL ? `${title.slice(0, MAX_LABEL - 1)}…` : title;
}

/** Link graph of a culture (DM-06): hover or focus a card to highlight its links, press to open. */
export function CultureGraph({ slug, year }: { slug: string; year: number | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const graph = useCultureGraph(slug, year);
  const [activeId, setActiveId] = useState<string | null>(null);

  const layout = useMemo(() => (graph.data ? placeNodes(graph.data) : null), [graph.data]);

  if (graph.isPending) return <p className="text-sm text-muted-foreground">{t('app.loading')}</p>;
  if (graph.isError || !layout) return <p role="alert">{t('culture.loadError')}</p>;

  const { nodes, edges, positions } = layout;
  const neighbours = new Set<string>();
  if (activeId) {
    neighbours.add(activeId);
    for (const edge of edges) {
      if (edge.fromId === activeId) neighbours.add(edge.toId);
      if (edge.toId === activeId) neighbours.add(edge.fromId);
    }
  }
  const titleOf = new Map(nodes.map((node) => [node.id, node.title]));
  const presentTypes = CARD_TYPES.filter((type) => nodes.some((node) => node.type === type));

  function open(cardSlug: string) {
    void navigate(`/cards/${cardSlug}`);
  }

  function onKey(event: KeyboardEvent, cardSlug: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open(cardSlug);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="culture-graph">
      <p className="text-sm text-muted-foreground">
        {edges.length === 0 ? t('culture.graphNoEdges') : t('culture.graphHint')}
      </p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full rounded-lg border bg-white"
        role="group"
        aria-label={t('culture.graphLabel', { nodes: nodes.length, edges: edges.length })}
      >
        <g aria-hidden="true">
          {edges.map((edge) => {
            const from = positions.get(edge.fromId);
            const to = positions.get(edge.toId);
            if (!from || !to) return null;
            const highlighted = edge.fromId === activeId || edge.toId === activeId;
            return (
              <line
                key={`${edge.fromId}-${edge.toId}-${edge.relationType}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={highlighted ? '#92400e' : '#a8a29e'}
                strokeWidth={highlighted ? 3 : 1.5}
                opacity={activeId === null || highlighted ? 1 : 0.15}
                data-testid="graph-edge"
              >
                <title>
                  {`${titleOf.get(edge.fromId) ?? ''} – ${t(`relation.outgoing.${edge.relationType}`)} – ${titleOf.get(edge.toId) ?? ''}`}
                </title>
              </line>
            );
          })}
        </g>
        {nodes.map((node) => {
          const point = positions.get(node.id);
          if (!point) return null;
          const dimmed = activeId !== null && !neighbours.has(node.id);
          const active = node.id === activeId;
          const cos = (point.x - CENTER.x) / RADIUS;
          const anchor = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
          const labelX = CENTER.x + ((point.x - CENTER.x) / RADIUS) * (RADIUS + LABEL_GAP);
          const labelY = CENTER.y + ((point.y - CENTER.y) / RADIUS) * (RADIUS + LABEL_GAP) + 4;
          return (
            <g
              key={node.id}
              role="link"
              tabIndex={0}
              aria-label={`${node.title} (${t(`cardType.${node.type}`)})`}
              data-testid={`graph-node-${node.slug}`}
              className="cursor-pointer outline-none"
              opacity={dimmed ? 0.3 : 1}
              onClick={() => open(node.slug)}
              onKeyDown={(event) => onKey(event, node.slug)}
              onMouseEnter={() => setActiveId(node.id)}
              onMouseLeave={() => setActiveId(null)}
              onFocus={() => setActiveId(node.id)}
              onBlur={() => setActiveId(null)}
            >
              <circle
                cx={point.x}
                cy={point.y}
                r={active ? NODE_RADIUS + 3 : NODE_RADIUS}
                fill={CARD_TYPE_COLORS[node.type]}
                stroke={active ? '#1c1917' : '#ffffff'}
                strokeWidth={active ? 3 : 2}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fontSize={12}
                fontWeight={active ? 700 : 400}
                fill="#1c1917"
              >
                {shorten(node.title)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul aria-label={t('culture.graphLegend')} className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {presentTypes.map((type) => (
          <li key={type} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: CARD_TYPE_COLORS[type] }}
            />
            {t(`cardType.${type}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Evenly spaced points on a circle, starting at the top; nodes arrive grouped by type. */
function placeNodes(graph: Graph) {
  const positions = new Map<string, { x: number; y: number }>();
  graph.nodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / graph.nodes.length - Math.PI / 2;
    positions.set(node.id, {
      x: CENTER.x + RADIUS * Math.cos(angle),
      y: CENTER.y + RADIUS * Math.sin(angle),
    });
  });
  return { nodes: graph.nodes, edges: graph.edges, positions };
}
