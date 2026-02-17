import React from 'react';

const ResultsTable = ({ data, loading, onToggleStatus }) => {
    if (loading) {
        return <div className="card empty-state">Loading results...</div>;
    }

    if (!data || data.length === 0) {
        return <div className="card empty-state">No products found matching your criteria.</div>;
    }

    return (
        <div className="card table-container">
            <table>
                <thead>
                    <tr>
                        <th style={{ width: '60px' }}>Img</th>
                        <th style={{ width: '100px' }}>Date</th>
                        <th>Retailer</th>
                        <th>Manufacturer</th>
                        <th>Product</th>
                        <th style={{ width: '100px' }}>Price</th>
                        <th style={{ width: '80px' }}>Rating</th>
                        <th style={{ width: '100px' }}>Reviews</th>
                        <th style={{ width: '120px' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr key={`${item.product_url}-${index}`} className={item.status === 'Dealt With' ? 'row-dealt-with' : ''}>
                            <td style={{ textAlign: 'center' }}>
                                {item.image_url ? (
                                    <img
                                        src={item.image_url}
                                        alt=""
                                        style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                ) : (
                                    <div style={{ width: '40px', height: '40px', background: '#f3f4f6', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '10px' }}>
                                        N/A
                                    </div>
                                )}
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>{item.date_found}</td>
                            <td>
                                <span className="badge badge-retailer">{item.retailer}</span>
                            </td>
                            <td>
                                {item.manufacturer ? (
                                    <a
                                        href={`https://duckduckgo.com/?q=%21ducky+${encodeURIComponent(item.manufacturer)}+brand+official+website`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="brand-link"
                                        title={`Go to ${item.manufacturer} website`}
                                    >
                                        {item.manufacturer}
                                    </a>
                                ) : (
                                    item.manufacturer
                                )}
                            </td>
                            <td className="product-cell">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {item.product_url ? (
                                        <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="product-link">
                                            {item.product_name}
                                        </a>
                                    ) : (
                                        <span>{item.product_name}</span>
                                    )}
                                    {item.product_url && (
                                        <button
                                            className="btn-copy"
                                            onClick={() => {
                                                navigator.clipboard.writeText(item.product_url);
                                                const btn = document.activeElement;
                                                const originalText = btn.innerHTML;
                                                btn.innerHTML = '📋';
                                                setTimeout(() => { btn.innerHTML = '🔗'; }, 2000);
                                            }}
                                            title="Copy product URL"
                                            style={{ padding: '2px 4px', fontSize: '10px' }}
                                        >
                                            🔗
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td className="price">{item.price_display}</td>
                            <td>
                                <div className="rating">
                                    <span style={{ color: '#fbbf24' }}>★</span>
                                    <span>{item.rating || '-'}</span>
                                </div>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: '600', color: '#4b5563' }}>
                                {item.reviews || 0}
                            </td>
                            <td>
                                <button
                                    className={`btn btn-sm ${item.status === 'Dealt With' ? 'btn-success' : 'btn-outline'}`}
                                    onClick={() => onToggleStatus(item.product_url, item.status === 'Dealt With' ? 'Pending' : 'Dealt With')}
                                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                >
                                    {item.status === 'Dealt With' ? '✓ Dealt With' : 'Mark Dealt'}
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
