function TurnPlaceholder({ title, message, detail, className = '', children }) {
  return (
    <div className={`turn-placeholder ${className}`.trim()} role="status">
      <img className="turn-placeholder-gif" src="/orbit/turn.webp" alt="" />
      {title && <strong className="turn-placeholder-title">{title}</strong>}
      <p className="turn-placeholder-message">{children ?? message}</p>
      {detail && <small className="turn-placeholder-detail">{detail}</small>}
    </div>
  )
}

export default TurnPlaceholder
