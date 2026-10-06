import React, { useEffect, useRef, useState } from 'react';
import { useStudio } from '../studio.jsx';
import { Button, Card, Field, PageHeader, Spinner, cx, inputClass } from '../components/ui.jsx';
import { QUOTE_SIZES, quoteStylesFor, renderQuoteCard } from '../lib/images.js';

const RATIO = { square: 'aspect-square', portrait: 'aspect-4/5', landscape: 'aspect-video' };

const SIZE_HINTS = {
  square: 'Works everywhere',
  portrait: 'Best for Instagram',
  landscape: 'Best for X and LinkedIn links',
};

export default function Graphics() {
  const { workspace, navigate, setGenerator } = useStudio();
  const slug = workspace?.slug || 'moonboots';
  const styles = quoteStylesFor(slug);
  const styleKeys = Object.keys(styles);

  const [quote, setQuote] = useState('');
  const [style, setStyle] = useState(styleKeys[0]);
  const [size, setSize] = useState('square');
  const [image, setImage] = useState(null);
  const [rendering, setRendering] = useState(false);
  const renderId = useRef(0);

  // Styles differ between workspaces
  useEffect(() => { setStyle(Object.keys(quoteStylesFor(slug))[0]); }, [slug]);

  // Redraw shortly after each change
  useEffect(() => {
    const id = ++renderId.current;
    setRendering(true);
    const timer = setTimeout(async () => {
      try {
        const url = await renderQuoteCard({ quote, brand: slug, style, size });
        if (id === renderId.current) setImage(url);
      } catch (error) {
        console.error('Quote card failed:', error);
      } finally {
        if (id === renderId.current) setRendering(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [quote, style, size, slug]);

  const download = () => {
    if (!image) return;
    const name = (quote.trim().split(/\s+/).slice(0, 6).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'quote');
    const link = document.createElement('a');
    link.href = image;
    link.download = `${slug}-${name}-${size}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const writeAbout = () => {
    setGenerator(prev => ({ ...prev, topic: quote.trim() }));
    navigate('create');
  };

  return (
    <>
      <PageHeader title="Graphics" subtitle={`Make a quote card in the ${workspace?.name || ''} brand and download it as a PNG.`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
        <Card className="p-5 space-y-6">
          <Field label="Quote">
            <textarea
              value={quote}
              onChange={e => setQuote(e.target.value)}
              rows={5}
              placeholder={slug === 'touchline' ? 'Every child deserves a coach who has time to coach.' : 'Clarity beats complexity. Every time.'}
              className={cx(inputClass, 'resize-none leading-relaxed')}
            />
          </Field>

          <div>
            <p className="text-xs font-medium text-muted mb-2">Style</p>
            <div className="grid grid-cols-3 gap-2">
              {styleKeys.map(key => {
                const s = styles[key];
                return (
                  <button
                    key={key}
                    onClick={() => setStyle(key)}
                    className={cx('rounded-xl border p-1.5 text-left transition', style === key ? 'border-accent/70 ring-2 ring-accent/20' : 'border-line/60 hover:border-line')}
                  >
                    <span className="block h-12 rounded-lg relative overflow-hidden" style={{ background: s.radial ? `radial-gradient(circle at 50% 46%, ${s.bg[0]}, ${s.bg[1]})` : `linear-gradient(135deg, ${s.bg[0]}, ${s.bg[1]})` }}>
                      <span className="absolute left-2 top-2 w-3 h-3 rounded-full" style={{ backgroundColor: s.mark }} />
                      <span className="absolute left-2 right-4 bottom-4 h-1.5 rounded-sm" style={{ backgroundColor: s.text, opacity: 0.85 }} />
                      <span className="absolute left-2 w-8 bottom-2 h-1 rounded-sm" style={{ backgroundColor: s.footer }} />
                    </span>
                    <span className="block text-[11px] text-muted mt-1.5 px-0.5 truncate">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted mb-2">Size</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(QUOTE_SIZES).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => setSize(key)}
                  className={cx('rounded-xl border p-3 flex flex-col items-center gap-2 transition', size === key ? 'border-accent/70 ring-2 ring-accent/20 text-ink' : 'border-line/60 text-muted hover:text-ink')}
                >
                  <span className={cx('border-2 border-current rounded-xs', key === 'square' ? 'w-6 h-6' : key === 'portrait' ? 'w-5 h-6' : 'w-7 h-4')} />
                  <span className="text-[11px] font-medium">{s.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-faint mt-2">
              {QUOTE_SIZES[size].width} × {QUOTE_SIZES[size].height}px. {SIZE_HINTS[size]}.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button variant="primary" size="lg" icon="download" disabled={!quote.trim() || !image} onClick={download}>Download PNG</Button>
            <Button variant="ghost" icon="sparkles" disabled={!quote.trim()} onClick={writeAbout}>Write a post about this</Button>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 flex items-center justify-center bg-raised/20">
          <div className={cx('relative w-full', size === 'landscape' ? 'max-w-2xl' : size === 'portrait' ? 'max-w-sm' : 'max-w-md')}>
            <div className={cx('w-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-raised', RATIO[size])}>
              {image && <img src={image} alt="Quote card preview" className="w-full h-full object-contain" />}
            </div>
            {rendering && (
              <span className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 text-white"><Spinner className="w-4 h-4" /></span>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
