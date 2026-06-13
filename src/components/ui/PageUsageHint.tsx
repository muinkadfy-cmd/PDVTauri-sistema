import './PageUsageHint.css';

type PageUsageHintItem = {
  label: string;
  text: string;
};

type PageUsageHintProps = {
  title?: string;
  items: PageUsageHintItem[];
};

export default function PageUsageHint({
  title = 'Guia rápido',
  items,
}: PageUsageHintProps) {
  return (
    <section className="page-usage-hint" aria-label={title}>
      <div className="page-usage-hint__head">
        <span className="page-usage-hint__badge">{title}</span>
      </div>

      <div className="page-usage-hint__grid">
        {items.map((item) => (
          <div key={item.label} className="page-usage-hint__item">
            <span className="page-usage-hint__label">{item.label}</span>
            <span className="page-usage-hint__text">{item.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
