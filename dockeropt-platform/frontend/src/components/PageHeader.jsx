export default function PageHeader({ title, description, action, hero = false }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      <div>
        <h2 className={hero ? 'font-display text-2xl sm:text-3xl font-bold text-text' : 'font-display text-xl font-semibold text-text'}>
          {title}
        </h2>
        {description && <p className={hero ? 'text-sm sm:text-base text-text-dim mt-1.5 max-w-2xl' : 'text-sm text-text-faint mt-1 max-w-2xl'}>{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
