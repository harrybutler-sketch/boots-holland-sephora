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
                        <th style={{ width: '100px' }}>Date</th>
                        <th>Retailer</th>
                        <th>Manufacturer</th>
                        <th>Category</th>
                        <th>Product</th>
                        <th style={{ width: '100px' }}>Price</th>
                        <th style={{ width: '100px' }}>Rating</th>
                        <th style={{ width: '120px' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr key={`${item.product_url}-${index}`} className={item.status === 'Dealt With' ? 'row-dealt-with' : ''}>
                            <td style={{ fontSize: '0.85rem' }}>{item.date_found}</td>
                            <td>
                                <span className="badge badge-retailer">{item.retailer}</span>
                            </td>
                            <td>{item.manufacturer}</td>
                            <td style={{ fontSize: '0.8rem', color: '#6b7280' }}>{item.category}</td>
                            <td>
                                {item.product_url ? (
                                    <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="product-link">
                                        {item.product_name}
                                    </a>
                                ) : (
                                    item.product_name
                                )}
                            </td>
                            <td className="price">{item.price_display}</td>
                            <td>
                                <div className="rating">
                                    <span>★</span>
                                    <span>{item.rating || '-'}</span>
                                    <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>({item.reviews || 0})</span>
                                </div>
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
