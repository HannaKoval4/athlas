import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '../components/ui/button.tsx';
import { useCultureCards } from './content-api.ts';

/**
 * Horizontal gallery of the culture's illustrated cards (scroll-snap carousel).
 * Every slide is a link, so the gallery works with Tab and Enter; the arrow buttons scroll
 * by one view. Hidden when no card of the period has an image.
 */
export function CultureGallery({ cultureId, year }: { cultureId: string; year: number | null }) {
  const { t } = useTranslation();
  const cards = useCultureCards(cultureId, year);
  const track = useRef<HTMLUListElement>(null);

  const slides = (cards.data?.items ?? []).filter((card) => card.imageUrl);
  if (slides.length === 0) return null;

  function scroll(direction: 1 | -1) {
    const element = track.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth, behavior: 'smooth' });
  }

  return (
    <section
      aria-labelledby="gallery-title"
      aria-roledescription="carousel"
      className="flex flex-col gap-2"
      data-testid="culture-gallery"
    >
      <div className="flex items-center justify-between">
        <h3 id="gallery-title" className="font-semibold">
          {t('culture.gallery')}
        </h3>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => scroll(-1)}
            aria-label={t('culture.galleryPrev')}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => scroll(1)}
            aria-label={t('culture.galleryNext')}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <ul
        ref={track}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2"
      >
        {slides.map((card) => (
          <li key={card.id} className="w-40 shrink-0 snap-start">
            <Link
              to={`/cards/${card.slug}`}
              data-testid={`gallery-${card.slug}`}
              className="group flex flex-col gap-1 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <img
                src={card.imageUrl ?? undefined}
                alt=""
                loading="lazy"
                className="h-28 w-40 rounded-lg bg-muted object-cover transition-transform group-hover:scale-[1.03]"
              />
              <span className="text-sm leading-tight font-medium">{card.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
