export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  titleClassName = '',
  titleAs = 'h2',
}) {
  const TitleTag = titleAs;

  return (
    <div className="section-header">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <TitleTag className={titleClassName}>{title}</TitleTag>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
  );
}
