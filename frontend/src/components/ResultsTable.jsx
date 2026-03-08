import React from 'react';

const ResultsTable = ({ data, loading, onToggleStatus }) => {
    if (loading) {
        return <div className="card empty-state">Loading results...</div>;
    }

    if (!data || data.length === 0) {
        return <div className="card empty-state">No products found matching your criteria.</div>;
    }

    return (
        <div className="card table-container" style={{ padding: '0', overflow: 'hidden' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
                <thead>
                    <tr>
                        <th style={{ width: '80px', paddingLeft: '2rem' }}>Img</th>
                        <th style={{ width: '120px' }}>Date</th>
                        <th>Retailer</th>
                        <th>Manufacturer</th>
                        <th>Product</th>
                        <th style={{ width: '100px' }}>Price</th>
                        <th style={{ width: '100px' }}>Rating</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>Reviews</th>
                        <th style={{ width: '140px', paddingRight: '2rem' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr key={`${item.product_url}-${index}`} className={item.status === 'Dealt With' ? 'row-dealt-with' : ''}>
                            <td style={{ paddingLeft: '2rem' }}>
                                {item.image_url ? (
                                    <img
                                        src={item.image_url}
                                        alt=""
                                        style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #f1f5f9', background: 'white' }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                ) : (
                                    <div style={{ width: '48px', height: '48px', background: '#f8fafc', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '10px', border: '1px solid #f1f5f9' }}>
                                        N/A
                                    </div>
                                )}
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>
                                {new Date(item.date_found).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </td>
                            <td>
                                <span className="badge badge-retailer" style={{ background: 'rgba(91, 59, 161, 0.08)', color: 'var(--color-purple)', border: '1px solid rgba(91, 59, 161, 0.1)' }}>{item.retailer}</span>
                            </td>
                            <td>
                                {item.manufacturer ? (
                                    <a
                                        href={`https://duckduckgo.com/?q=%21ducky+${encodeURIComponent(item.manufacturer)}+brand+official+website`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'var(--color-text-primary)', textDecoration: 'none', fontWeight: '600', fontSize: '0.95rem' }}
                                        title={`Go to ${item.manufacturer} website`}
                                    >
                                        {item.manufacturer}
                                    </a>
                                ) : (
                                    <span style={{ color: '#94a3b8' }}>-</span>
                                )}
                            </td>
                            <td className="product-cell">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {item.product_url ? (
                                        <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="product-link" style={{ fontSize: '0.95rem' }}>
                                            {item.product_name}
                                        </a>
                                    ) : (
                                        <span style={{ fontSize: '0.95rem' }}>{item.product_name}</span>
                                    )}
                                    {item.product_url && (
                                        <button
                                            className="btn-copy"
                                            onClick={() => {
                                                navigator.clipboard.writeText(item.product_url);
                                                const btn = document.activeElement;
                                                btn.innerHTML = '📋';
                                                setTimeout(() => { btn.innerHTML = '🔗'; }, 2000);
                                            }}
                                            title="Copy product URL"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '12px', opacity: '0.5' }}
                                        >
                                            🔗
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td className="price" style={{ fontSize: '1rem' }}>{item.price_display}</td>
                            <td>
                                <div className="rating" style={{ background: 'rgba(244, 185, 91, 0.1)', padding: '4px 8px', borderRadius: '6px', width: 'fit-content' }}>
                                    <span style={{ color: 'var(--color-yellow)', fontSize: '14px' }}>★</span>
                                    <span style={{ fontWeight: '700', color: '#92400e', fontSize: '0.85rem' }}>{item.rating || '0.0'}</span>
                                </div>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                                {item.reviews || 0}
                            </td>
                            <td style={{ paddingRight: '2rem' }}>
                                <button
                                    className={`btn ${item.status === 'Dealt With' ? '' : 'btn-outline'}`}
                                    onClick={() => onToggleStatus(item.product_url, item.status === 'Dealt With' ? 'Pending' : 'Dealt With')}
                                    style={{
                                        fontSize: '0.8rem',
                                        padding: '0.5rem 1rem',
                                        background: item.status === 'Dealt With' ? 'var(--color-teal)' : 'transparent',
                                        borderColor: item.status === 'Dealt With' ? 'var(--color-teal)' : 'var(--color-purple)',
                                        color: item.status === 'Dealt With' ? 'white' : 'var(--color-purple)',
                                        minWidth: '100px'
                                    }}
                                >
                                    {item.status === 'Dealt With' ? '✓ Done' : 'Mark Done'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ResultsTable;
