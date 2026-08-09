function HeadTotals({ stats }) {
  const visibles = stats.filter((stat) => stat.value !== null && stat.value !== undefined);

  if (visibles.length === 0) {
    return null;
  }

  return (
    <div className="page-head__totals">
      {visibles.map((stat) => (
        <span key={stat.label}>
          <strong>{stat.value.toLocaleString('es-MX')}</strong> {stat.label}
        </span>
      ))}
    </div>
  );
}

export default HeadTotals;
